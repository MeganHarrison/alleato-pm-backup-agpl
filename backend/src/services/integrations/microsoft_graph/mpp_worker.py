"""Isolated MPXJ worker used by the bounded SharePoint MPP extractor."""

from __future__ import annotations

import os
import sys


def extract_mpp(path: str) -> str:
    try:
        import jpype
        import mpxj  # noqa: F401 - registers bundled MPXJ jars
    except ImportError as exc:
        raise RuntimeError("mpxj and jpype are required for MPP extraction") from exc

    try:
        heap_mb = int(os.environ.get("MPP_JAVA_MAX_HEAP_MB", "128"))
    except ValueError:
        heap_mb = 128
    heap_mb = max(64, min(heap_mb, 256))
    if not jpype.isJVMStarted():
        jpype.startJVM(
            "-Xms32m",
            f"-Xmx{heap_mb}m",
            "-XX:+ExitOnOutOfMemoryError",
        )

    from org.mpxj.reader import UniversalProjectReader

    project = UniversalProjectReader().read(path)
    lines: list[str] = ["[Project properties]"]
    properties = project.getProjectProperties()
    for label, method in (
        ("Title", "getProjectTitle"),
        ("Company", "getCompany"),
        ("Manager", "getManager"),
        ("Start", "getStartDate"),
        ("Finish", "getFinishDate"),
        ("Status date", "getStatusDate"),
    ):
        value = getattr(properties, method)()
        if value is not None:
            lines.append(f"{label}: {value}")

    lines.append("[Tasks]")
    for task in project.getTasks():
        values = [
            f"ID={task.getID()}",
            f"Name={task.getName()}",
            f"Start={task.getStart()}",
            f"Finish={task.getFinish()}",
            f"Duration={task.getDuration()}",
            f"PercentComplete={task.getPercentageComplete()}",
        ]
        notes = task.getNotes()
        if notes:
            values.append(f"Notes={notes}")
        lines.append(" | ".join(values))

    lines.append("[Resources]")
    for resource in project.getResources():
        if resource.getName():
            lines.append(
                f"ID={resource.getID()} | Name={resource.getName()} | "
                f"Email={resource.getEmailAddress()}"
            )
    return "\n".join(lines).strip()


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: mpp_worker.py <path>", file=sys.stderr)
        return 2
    try:
        print(extract_mpp(sys.argv[1]))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
