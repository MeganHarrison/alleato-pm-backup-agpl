from __future__ import annotations

import math
import re
import tempfile
import threading
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

_PDF_NAME_RE = re.compile(r"^/[A-Za-z]")
_PDF_NUMBER_RE = re.compile(r"^-?\d+\.?\d*$")
_PDF_OBJ_REF_RE = re.compile(r"^\d+\s+\d+\s+(obj|R)\b", re.IGNORECASE)

# PDF structural keywords that can never appear as legitimate task names.
# "obj endobj xref" is the reported pattern (PDF cross-reference table content).
_PDF_STRUCTURAL_KEYWORDS = frozenset({
    "obj", "endobj", "xref", "trailer", "startxref",
    "stream", "endstream",
})


def _is_pdf_token(name: str) -> bool:
    """Return True if this string looks like a raw PDF internal object, not a task name."""
    s = name.strip()
    # PDF name objects: /FlateDecode, /TilingType, /Type, etc.
    if _PDF_NAME_RE.match(s):
        return True
    # Bare floating-point coordinates (e.g. "751.439")
    if _PDF_NUMBER_RE.match(s):
        return True
    # PDF dictionary delimiters embedded in the name
    if "<<" in s or ">>" in s:
        return True
    # Single PDF structural keyword (e.g. "obj", "endobj", "xref")
    if s.lower() in _PDF_STRUCTURAL_KEYWORDS:
        return True
    # PDF indirect object reference: "1 0 obj", "5 2 R"
    if _PDF_OBJ_REF_RE.match(s):
        return True
    # Compound PDF keyword sequence: "obj endobj xref" — all words are PDF keywords
    words = s.lower().split()
    if len(words) >= 2 and all(w in _PDF_STRUCTURAL_KEYWORDS for w in words):
        return True
    return False


class MicrosoftProjectParseError(Exception):
    """Raised when a Microsoft Project file cannot be parsed safely."""


@dataclass
class ParsedScheduleTask:
    external_id: str
    parent_external_id: Optional[str]
    name: str
    wbs_code: Optional[str]
    start_date: Optional[str]
    finish_date: Optional[str]
    duration_days: Optional[int]
    percent_complete: int
    status: str
    is_milestone: bool
    sort_order: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "external_id": self.external_id,
            "parent_external_id": self.parent_external_id,
            "name": self.name,
            "wbs_code": self.wbs_code,
            "start_date": self.start_date,
            "finish_date": self.finish_date,
            "duration_days": self.duration_days,
            "percent_complete": self.percent_complete,
            "status": self.status,
            "is_milestone": self.is_milestone,
            "sort_order": self.sort_order,
        }


_jvm_lock = threading.Lock()


def parse_microsoft_project_file(file_name: str, content: bytes) -> List[Dict[str, Any]]:
    if content[:8].lstrip()[:4] == b"%PDF":
        raise MicrosoftProjectParseError(
            "This file is a PDF. Upload a Microsoft Project .mpp, .mpt, or XML file."
        )

    suffix = Path(file_name).suffix.lower()
    if suffix == ".xml":
        tasks = _parse_mspdi_xml(content)
    elif suffix in {".mpp", ".mpt"}:
        tasks = _parse_mpp_with_mpxj(file_name, content)
    else:
        raise MicrosoftProjectParseError("Upload a Microsoft Project .mpp, .mpt, or XML file.")

    if not tasks:
        raise MicrosoftProjectParseError("No active Microsoft Project tasks were found in this file.")

    return [task.to_dict() for task in tasks]


def _parse_mspdi_xml(content: bytes) -> List[ParsedScheduleTask]:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise MicrosoftProjectParseError("This file is not valid Microsoft Project XML.") from exc

    task_nodes = [node for node in root.iter() if _local_name(node.tag) == "Task"]
    outline_to_external_id: Dict[str, str] = {}
    parsed_tasks: List[ParsedScheduleTask] = []

    for index, node in enumerate(task_nodes, start=1):
        name = _child_text(node, "Name")
        active = _child_text(node, "Active")
        if not name or active == "0" or _is_pdf_token(name):
            continue

        uid = _child_text(node, "UID") or _child_text(node, "ID") or str(index)
        outline = _child_text(node, "OutlineNumber")
        if outline == "0":
            continue
        external_id = outline or uid
        if outline:
            outline_to_external_id[outline] = external_id

        percent_complete = _parse_percent(_child_text(node, "PercentComplete"))
        is_milestone = _is_truthy(_child_text(node, "Milestone"))
        duration_days = 0 if is_milestone else _parse_mspdi_duration(_child_text(node, "Duration"))

        parsed_tasks.append(
            ParsedScheduleTask(
                external_id=external_id,
                parent_external_id=None,
                name=name,
                wbs_code=outline,
                start_date=_parse_date(_child_text(node, "Start")),
                finish_date=_parse_date(_child_text(node, "Finish")),
                duration_days=duration_days,
                percent_complete=percent_complete,
                status=_status_from_percent(percent_complete),
                is_milestone=is_milestone,
                sort_order=index,
            )
        )

    return _attach_parent_external_ids(parsed_tasks, outline_to_external_id)


def _parse_mpp_with_mpxj(file_name: str, content: bytes) -> List[ParsedScheduleTask]:
    try:
        import jpype
        import mpxj  # noqa: F401 - importing registers the bundled MPXJ classpath
    except ImportError as exc:
        raise MicrosoftProjectParseError(
            "Native .mpp import is not installed on the backend. Install mpxj and Java, then retry."
        ) from exc

    with tempfile.TemporaryDirectory(prefix="alleato-mpp-import-") as tmp_dir:
        file_path = Path(tmp_dir) / Path(file_name).name
        file_path.write_bytes(content)

        with _jvm_lock:
            try:
                if not jpype.isJVMStarted():
                    jpype.startJVM()

                from org.mpxj.reader import UniversalProjectReader

                project = UniversalProjectReader().read(str(file_path))
                task_nodes = list(project.getTasks())
            except Exception as exc:
                message = str(exc)
                if "password" in message.lower():
                    raise MicrosoftProjectParseError("Password-protected .mpp files are not supported.") from exc
                if _is_missing_java_runtime_error(message):
                    raise MicrosoftProjectParseError(
                        "Native .mpp import requires Java on the backend. Install a Java runtime and retry."
                    ) from exc
                raise MicrosoftProjectParseError(f"Unable to read Microsoft Project file: {message[:300]}") from exc

    outline_to_external_id: Dict[str, str] = {}
    parsed_tasks: List[ParsedScheduleTask] = []

    for index, task in enumerate(task_nodes, start=1):
        name = _java_string(_call(task, "getName"))
        active = _call(task, "getActive")
        if not name or active is False or _is_pdf_token(name):
            continue

        uid = _java_string(_call(task, "getUniqueID")) or _java_string(_call(task, "getID")) or str(index)
        outline = _java_string(_call(task, "getOutlineNumber"))
        if outline == "0":
            continue
        external_id = outline or uid
        if outline:
            outline_to_external_id[outline] = external_id

        percent_complete = _parse_percent(_java_string(_call(task, "getPercentageComplete")))
        is_milestone = bool(_call(task, "getMilestone"))
        start_date = _parse_java_date(_call(task, "getStart"))
        finish_date = _parse_java_date(_call(task, "getFinish"))

        parsed_tasks.append(
            ParsedScheduleTask(
                external_id=external_id,
                parent_external_id=None,
                name=name,
                wbs_code=outline,
                start_date=start_date,
                finish_date=finish_date,
                duration_days=0 if is_milestone else _duration_days(start_date, finish_date),
                percent_complete=percent_complete,
                status=_status_from_percent(percent_complete),
                is_milestone=is_milestone,
                sort_order=index,
            )
        )

    return _attach_parent_external_ids(parsed_tasks, outline_to_external_id)


def _attach_parent_external_ids(
    tasks: List[ParsedScheduleTask],
    outline_to_external_id: Dict[str, str],
) -> List[ParsedScheduleTask]:
    for index, task in enumerate(tasks, start=1):
        parent_outline = _parent_outline(task.wbs_code)
        task.parent_external_id = outline_to_external_id.get(parent_outline or "")
        task.sort_order = index
    return tasks


def _is_missing_java_runtime_error(message: str) -> bool:
    lowered = message.lower()
    java_markers = (
        "no jvm shared library file",
        "unable to find java",
        "java_home",
        "jvm.dll",
        "libjvm",
    )
    return any(marker in lowered for marker in java_markers)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(node: ET.Element, child_name: str) -> Optional[str]:
    for child in node:
        if _local_name(child.tag) == child_name and child.text:
            value = child.text.strip()
            return value or None
    return None


def _parse_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        try:
            return date.fromisoformat(value[:10]).isoformat()
        except ValueError:
            return None


def _parse_java_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    return _parse_date(str(value))


def _parse_mspdi_duration(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    days = 0
    hours = 0
    minutes = 0
    date_part, _, time_part = value.partition("T")
    if date_part.startswith("P") and date_part.endswith("D"):
        days = _safe_int(date_part[1:-1])
    if time_part:
        if "H" in time_part:
            hours = _safe_int(time_part.split("H", 1)[0])
        if "M" in time_part:
            minute_source = time_part.split("H", 1)[-1].split("M", 1)[0]
            minutes = _safe_int(minute_source)
    return days + math.ceil((hours + minutes / 60) / 8)


def _duration_days(start_date: Optional[str], finish_date: Optional[str]) -> Optional[int]:
    if not start_date or not finish_date:
        return None
    try:
        start = date.fromisoformat(start_date)
        finish = date.fromisoformat(finish_date)
    except ValueError:
        return None
    return max(0, (finish - start).days + 1)


def _parse_percent(value: Optional[str]) -> int:
    if not value:
        return 0
    try:
        parsed = int(float(value))
    except ValueError:
        return 0
    return min(100, max(0, parsed))


def _status_from_percent(percent_complete: int) -> str:
    if percent_complete >= 100:
        return "complete"
    if percent_complete > 0:
        return "in_progress"
    return "not_started"


def _is_truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes"}


def _parent_outline(outline: Optional[str]) -> Optional[str]:
    if not outline or "." not in outline:
        return None
    return ".".join(outline.split(".")[:-1])


def _safe_int(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        return 0


def _call(value: Any, method_name: str) -> Any:
    method = getattr(value, method_name, None)
    if method is None:
        return None
    try:
        return method()
    except Exception:
        return None


def _java_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
