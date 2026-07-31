from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


PHASES = (
    "outlook",
    "sharepoint",
    "communications",
    "attachment_promotion",
    "ocr",
    # Keep OCR before embedding so newly recovered text is queued in the same
    # orchestration. Per-phase bounds plus the outer 55-minute wrapper prevent
    # earlier work from silently starving this terminal handoff.
    "embedding",
)
SOURCE_PHASES = frozenset({"outlook", "sharepoint"})
DOWNSTREAM_PHASES = frozenset(PHASES) - SOURCE_PHASES
ORCHESTRATION_STARTED_AT_ENV = "GRAPH_SYNC_ORCHESTRATION_STARTED_AT"
ORCHESTRATION_STATE_DIR_ENV = "GRAPH_SYNC_ORCHESTRATION_STATE_DIR"


def _phase_timeout_seconds() -> int:
    raw = os.environ.get("GRAPH_SYNC_PHASE_TIMEOUT_SECONDS", "480")
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError("GRAPH_SYNC_PHASE_TIMEOUT_SECONDS must be an integer") from exc
    if value < 60 or value > 1800:
        raise ValueError("GRAPH_SYNC_PHASE_TIMEOUT_SECONDS must be between 60 and 1800")
    return value


def _exit_code_for_result(result: dict) -> int:
    """Fail the scheduler whenever any source or downstream phase failed."""
    return 1 if result.get("errors") else 0


def _downstream_source_summary(
    *,
    communications_synced: int,
    sync_emails_enabled: bool,
    compile_outlook_conversations: bool,
) -> dict[str, object]:
    outlook_users = [
        value.strip()
        for value in os.environ.get("MICROSOFT_SYNC_USERS", "").split(",")
        if value.strip()
    ]
    return {
        "status": "complete",
        "outlook": 0,
        "teams": 0,
        "teams_dm": 0,
        "onedrive": 0,
        "sharepoint": 0,
        "communications_synced": communications_synced,
        "total_synced": 0,
        "errors": [],
        "sync_emails_enabled": sync_emails_enabled,
        "sync_teams_enabled": False,
        "sync_teams_dm_enabled": False,
        "sync_onedrive_enabled": False,
        "sync_sharepoint_enabled": False,
        "outlook_users_selected": outlook_users,
        "compile_outlook_conversations": compile_outlook_conversations,
    }


def _write_phase_state(phase: str, result: dict) -> None:
    """Atomically expose a bounded child result to the lightweight parent."""
    state_dir_raw = os.environ.get(ORCHESTRATION_STATE_DIR_ENV)
    if not state_dir_raw:
        return
    state_dir = Path(state_dir_raw)
    state_dir.mkdir(parents=True, exist_ok=True)
    target = state_dir / f"{phase}.json"
    pending = state_dir / f".{phase}.json.tmp"
    pending.write_text(
        json.dumps(result, default=str),
        encoding="utf-8",
    )
    pending.replace(target)


def _read_phase_state(state_dir: Path, phase: str) -> dict:
    path = state_dir / f"{phase}.json"
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    return value if isinstance(value, dict) else {}


def _bounded_phase_receipt_metadata(result: dict) -> dict[str, object]:
    allowed = (
        "status",
        "total_synced",
        "outlook",
        "teams",
        "teams_dm",
        "onedrive",
        "sharepoint",
        "sharepoint_failed",
        "errors",
        "outlook_conversations",
        "outlook_vectorization_status",
        "project_backfill",
        "intelligence_extraction",
        "attachment_promotion",
        "ocr",
        "embed",
        "embed_fireflies",
    )
    return {key: result[key] for key in allowed if key in result}


def _build_ocr_phase_result(ocr_result: dict) -> dict[str, object]:
    """Turn per-document OCR outcomes into a fail-loud phase receipt."""
    ocr_failures = int(ocr_result.get("failed") or 0)
    errors = [f"OCR failed for {ocr_failures} document(s)"] if ocr_failures else []
    return {
        "status": "complete_with_errors" if errors else "complete",
        "total_synced": 0,
        "errors": errors,
        "ocr": ocr_result,
    }


def _apply_sharepoint_scope_override(encoded_scopes: str) -> list[str]:
    """Validate a shell-safe exact-scope override for operator recovery."""
    from src.services.integrations.microsoft_graph.sharepoint_scopes import (
        parse_explicit_sharepoint_scopes,
    )

    try:
        decoded = base64.b64decode(
            encoded_scopes,
            validate=True,
        ).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError(
            "--sharepoint-scopes-base64 must be base64-encoded UTF-8 JSON"
        ) from exc
    try:
        structured = json.loads(decoded)
    except json.JSONDecodeError as exc:
        raise ValueError(
            "--sharepoint-scopes-base64 must decode to a JSON string array"
        ) from exc
    if not isinstance(structured, list) or not all(
        isinstance(entry, str) for entry in structured
    ):
        raise ValueError(
            "--sharepoint-scopes-base64 must decode to a JSON string array"
        )
    scopes = parse_explicit_sharepoint_scopes(decoded)
    if not scopes:
        raise ValueError("--sharepoint-scopes-base64 must contain at least one scope")
    os.environ["SHAREPOINT_PROJECT_DISCOVERY_ENABLED"] = "false"
    os.environ["SHAREPOINT_SYNC_FOLDERS"] = decoded
    return [scope.entry for scope in scopes]


def _run_phase(phase: str) -> int:
    """Run one memory-isolated Graph phase."""
    from graph_sync_common import (
        assert_service_role_key,
        bool_env,
        bounded_int_env,
    )
    from src.services.env_loader import load_env
    from src.services.supabase_helpers import get_supabase_client

    load_env()
    assert_service_role_key("SUPABASE_SERVICE_ROLE_KEY")
    assert_service_role_key("RAG_SUPABASE_SERVICE_ROLE_KEY")

    if phase == "ocr":
        # Keep the OCR worker genuinely isolated. Importing the monolithic
        # Graph sync module here also imports the embedding and communications
        # stacks, leaving too little headroom for Poppler/Tesseract on Render's
        # 512 MiB cron worker.
        if not bool_env("GRAPH_SYNC_RUN_OCR", True):
            result = {
                "status": "complete",
                "total_synced": 0,
                "errors": [],
                "ocr": {
                    "status": "skipped",
                    "reason": "GRAPH_SYNC_RUN_OCR=false",
                },
            }
        else:
            from src.services.integrations.microsoft_graph.ocr_worker import (
                run_ocr_pass,
            )

            ocr_result = run_ocr_pass(
                get_supabase_client(),
                limit=bounded_int_env(
                    "DOCUMENT_OCR_BATCH_SIZE",
                    2,
                    1,
                    25,
                ),
            )
            result = _build_ocr_phase_result(ocr_result)
    elif phase == "outlook":
        from src.services.integrations.microsoft_graph.sync import run_graph_sync

        result = run_graph_sync(
            get_supabase_client(),
            run_outlook=bool_env("GRAPH_SYNC_OUTLOOK", True),
            run_teams=False,
            run_onedrive=False,
            run_sharepoint=False,
            run_embedding=False,
            run_ocr=False,
            run_attachment_promotion=False,
            run_downstream=False,
            verify_outlook_persisted_count=bool_env(
                "GRAPH_VERIFY_OUTLOOK_PERSISTED_COUNT",
                True,
            ),
        )
    elif phase == "sharepoint":
        from src.services.integrations.microsoft_graph.sync import run_graph_sync

        result = run_graph_sync(
            get_supabase_client(),
            run_outlook=False,
            run_teams=False,
            run_onedrive=bool_env("GRAPH_SYNC_ONEDRIVE", False),
            run_sharepoint=bool_env("GRAPH_SYNC_SHAREPOINT", True),
            run_embedding=False,
            run_ocr=False,
            run_attachment_promotion=False,
            run_downstream=False,
        )
    elif phase in DOWNSTREAM_PHASES:
        from src.services.integrations.microsoft_graph.sync import run_graph_sync

        sync_started_at_raw = os.environ.get(ORCHESTRATION_STARTED_AT_ENV)
        sync_started_at = (
            datetime.fromisoformat(sync_started_at_raw)
            if sync_started_at_raw
            else datetime.now(timezone.utc) - timedelta(minutes=5)
        )
        outlook_enabled = bool_env("GRAPH_SYNC_OUTLOOK", True)
        teams_enabled = bool_env("GRAPH_SYNC_TEAMS", False)
        teams_dm_enabled = bool_env("GRAPH_SYNC_TEAMS_DM", False)
        communications_enabled = outlook_enabled or teams_enabled or teams_dm_enabled
        is_communications = phase == "communications"
        is_attachment_promotion = phase == "attachment_promotion"
        is_embedding = phase == "embedding"
        result = run_graph_sync(
            get_supabase_client(),
            run_outlook=False,
            run_teams=False,
            run_onedrive=False,
            run_sharepoint=False,
            run_embedding=(is_embedding and bool_env("GRAPH_SYNC_RUN_EMBEDDING", True)),
            run_ocr=False,
            run_attachment_promotion=(
                is_attachment_promotion
                and bool_env(
                    "GRAPH_SYNC_RUN_ATTACHMENT_PROMOTION",
                    True,
                )
            ),
            embed_limit=bounded_int_env("GRAPH_EMBEDDING_LIMIT", 100, 1, 100),
            ocr_batch_size=bounded_int_env(
                "DOCUMENT_OCR_BATCH_SIZE",
                2,
                1,
                25,
            ),
            attachment_promotion_limit=bounded_int_env(
                "GRAPH_ATTACHMENT_PROMOTION_LIMIT",
                50,
                1,
                200,
            ),
            source_summary_override={
                **_downstream_source_summary(
                    communications_synced=(
                        1 if is_communications and communications_enabled else 0
                    ),
                    sync_emails_enabled=(
                        outlook_enabled and (is_communications or is_embedding)
                    ),
                    compile_outlook_conversations=is_communications,
                ),
                "sync_teams_enabled": teams_enabled and is_communications,
                "sync_teams_dm_enabled": (teams_dm_enabled and is_communications),
            },
            sync_started_at_override=sync_started_at,
            record_source_receipt=False,
            record_downstream_receipt=False,
        )
    else:
        raise ValueError(f"Unknown Graph sync phase: {phase}")

    _write_phase_state(phase, result)
    print(json.dumps({"phase": phase, **result}, indent=2, default=str))
    return _exit_code_for_result(result)


def _record_orchestration_receipts(
    phase_results: list[dict[str, object]],
    *,
    started_at: datetime,
) -> None:
    """Persist one truthful aggregate source and downstream receipt."""
    from graph_sync_common import assert_service_role_key
    from src.services.env_loader import load_env
    from src.services.health.source_sync_health import record_sync_run
    from src.services.supabase_helpers import get_supabase_client

    load_env()
    assert_service_role_key("SUPABASE_SERVICE_ROLE_KEY")
    supabase = get_supabase_client()
    finished_at = datetime.now(timezone.utc)
    for stage, phase_names in (
        ("source_reconciliation", SOURCE_PHASES),
        ("downstream_enrichment", DOWNSTREAM_PHASES),
    ):
        owned_results = [
            result for result in phase_results if str(result["phase"]) in phase_names
        ]
        failed = [
            str(result["phase"])
            for result in owned_results
            if int(result["exit_code"]) != 0
        ]
        item_errors = sum(
            len((result.get("result") or {}).get("errors") or [])
            for result in owned_results
        )
        missing_terminal_results = sum(
            1
            for result in owned_results
            if int(result["exit_code"]) != 0 and not result.get("result")
        )
        if stage == "source_reconciliation":
            items_seen = sum(
                int((result.get("result") or {}).get("total_synced") or 0)
                for result in owned_results
            )
            items_synced = items_seen
        else:
            # Downstream phases process heterogeneous units (conversations,
            # attachments, OCR documents, chunks). Their exact per-phase
            # counters remain in metadata; inventing one aggregate item count
            # would be misleading.
            items_seen = 0
            items_synced = 0
        record_sync_run(
            supabase,
            source=(
                "microsoft_graph_source_sync"
                if stage == "source_reconciliation"
                else "microsoft_graph_downstream"
            ),
            resource_id=stage,
            resource_name=(
                "Microsoft Graph source reconciliation"
                if stage == "source_reconciliation"
                else "Microsoft Graph downstream enrichment"
            ),
            stage=stage,
            status="failed" if failed else "succeeded",
            started_at=started_at,
            finished_at=finished_at,
            items_seen=items_seen,
            items_synced=items_synced,
            items_failed=item_errors + missing_terminal_results,
            error_message=(
                f"Failed isolated phase(s): {', '.join(failed)}" if failed else None
            ),
            metadata={"isolated_phases": owned_results},
        )


def _run_isolated_phases() -> int:
    """Run all lanes in fresh processes and preserve every failure receipt.

    Source ingestion, document parsing/OCR, and embedding have different memory
    profiles. Running them in one long-lived Python process allowed native/XML
    parser allocations to accumulate until Render killed the 512 MiB worker.
    Fresh child processes make memory ownership explicit and guarantee release
    between lanes while the lightweight parent continues later phases even when
    one lane fails.
    """
    orchestration_started_at = datetime.now(timezone.utc)
    phase_results: list[dict[str, object]] = []
    overall_exit = 0
    phase_env = os.environ.copy()
    phase_env[ORCHESTRATION_STARTED_AT_ENV] = (
        orchestration_started_at - timedelta(minutes=5)
    ).isoformat()
    phase_timeout_seconds = _phase_timeout_seconds()
    with tempfile.TemporaryDirectory(
        prefix="graph-sync-orchestration-"
    ) as raw_state_dir:
        state_dir = Path(raw_state_dir)
        phase_env[ORCHESTRATION_STATE_DIR_ENV] = str(state_dir)
        for phase in PHASES:
            try:
                completed = subprocess.run(
                    [sys.executable, str(Path(__file__).resolve()), "--phase", phase],
                    check=False,
                    env=phase_env,
                    timeout=phase_timeout_seconds,
                )
            except subprocess.TimeoutExpired:
                overall_exit = 1
                phase_results.append(
                    {
                        "phase": phase,
                        "exit_code": 124,
                        "status": "failed",
                        "error": (
                            f"Graph sync phase exceeded {phase_timeout_seconds} seconds"
                        ),
                        "result": {},
                    }
                )
                continue
            child_result = _read_phase_state(state_dir, phase)
            phase_results.append(
                {
                    "phase": phase,
                    "exit_code": completed.returncode,
                    "status": ("succeeded" if completed.returncode == 0 else "failed"),
                    "result": _bounded_phase_receipt_metadata(child_result),
                }
            )
            if completed.returncode != 0:
                overall_exit = 1

    try:
        _record_orchestration_receipts(
            phase_results,
            started_at=orchestration_started_at,
        )
    except Exception as exc:
        overall_exit = 1
        phase_results.append(
            {
                "phase": "orchestration_receipts",
                "exit_code": 1,
                "status": "failed",
                "error": str(exc),
            }
        )

    print(
        json.dumps(
            {
                "status": "complete" if overall_exit == 0 else "complete_with_errors",
                "isolated_phases": phase_results,
            },
            indent=2,
        )
    )
    return overall_exit


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=PHASES)
    parser.add_argument("--sharepoint-scopes-base64")
    args = parser.parse_args(argv)
    if args.sharepoint_scopes_base64:
        if args.phase != "sharepoint":
            parser.error("--sharepoint-scopes-base64 requires --phase sharepoint")
        try:
            selected = _apply_sharepoint_scope_override(args.sharepoint_scopes_base64)
        except ValueError as exc:
            parser.error(str(exc))
        print(
            json.dumps(
                {"sharepoint_scope_override": selected},
                indent=2,
            )
        )
    if args.phase:
        return _run_phase(args.phase)
    return _run_isolated_phases()


if __name__ == "__main__":
    raise SystemExit(main())
