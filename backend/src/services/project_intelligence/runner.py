"""The only scheduled executable for backend Project Intelligence projections."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Sequence

from src.services.env_loader import load_env
from src.services.ops.db_pressure_guard import (
    enforce_app_db_pressure_guard,
)
from src.services.project_intelligence.ownership import (
    assert_former_projection_paths_absent,
)
from src.services.supabase_helpers import get_supabase_client


def _emit(event: str, **payload: Any) -> None:
    print(json.dumps({"event": event, **payload}, default=str), flush=True)


def _domain_exit_code(summary: dict[str, Any]) -> int:
    """Require every runnable domain target to compile without a hidden partial."""

    return 0 if summary.get("status") == "ok" and summary.get("compiled", 0) > 0 else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="projection", required=True)

    domain = subparsers.add_parser(
        "domain-packets",
        help="Compile company_process domain packets",
    )
    domain.add_argument("--lookback-days", type=int, default=60)
    domain.add_argument("--doc-limit", type=int, default=150)
    domain.add_argument("--target-slug", default=None)

    project = subparsers.add_parser(
        "project-sweep",
        help="Run the project communications and current-state safety sweep",
    )
    project.add_argument(
        "--max-projects",
        type=int,
        default=int(os.getenv("SYNTHESIS_SWEEP_MAX_PROJECTS", "200")),
    )
    project.add_argument(
        "--max-extractions-per-project",
        type=int,
        default=int(os.getenv("SYNTHESIS_SWEEP_MAX_EXTRACTIONS", "25")),
    )
    project.add_argument(
        "--since-days",
        type=int,
        default=int(os.getenv("SYNTHESIS_SWEEP_SINCE_DAYS", "14")),
    )
    return parser


def _run_domain_packets(args: argparse.Namespace) -> int:
    from src.services.project_intelligence.projections.domain_packets import (
        DOMAIN_COMPILER_VERSION,
        compile_all_domain_packets,
        compile_domain_packet,
    )

    enforce_app_db_pressure_guard("domain_packet_compiler")
    supabase = get_supabase_client()
    _emit(
        "project_intelligence_projection_start",
        projection="domain-packets",
        compiler_version=DOMAIN_COMPILER_VERSION,
        lookback_days=args.lookback_days,
        doc_limit=args.doc_limit,
        target_slug=args.target_slug,
    )

    if args.target_slug:
        response = (
            supabase.table("intelligence_targets")
            .select("id, slug")
            .eq("target_type", "company_process")
            .eq("slug", args.target_slug)
            .maybe_single()
            .execute()
        )
        target = getattr(response, "data", None)
        if not target:
            _emit(
                "project_intelligence_projection_failed",
                projection="domain-packets",
                reason="target_not_found",
                target_slug=args.target_slug,
            )
            return 1
        result = compile_domain_packet(
            supabase,
            target["id"],
            lookback_days=args.lookback_days,
            doc_limit=args.doc_limit,
        )
        _emit(
            "project_intelligence_projection_complete",
            projection="domain-packets",
            result=result,
        )
        return 0 if result.get("status") in {"compiled", "skipped_no_documents"} else 1

    summary = compile_all_domain_packets(
        supabase,
        lookback_days=args.lookback_days,
        doc_limit=args.doc_limit,
    )
    _emit(
        "project_intelligence_projection_complete",
        projection="domain-packets",
        summary=summary,
    )
    return _domain_exit_code(summary)


def _run_project_sweep(args: argparse.Namespace) -> int:
    from src.services.project_intelligence.projections.project_communications import (
        _sweep_exit_code,
        run_synthesis_sweep,
    )

    _emit(
        "project_intelligence_projection_start",
        projection="project-sweep",
        max_projects=args.max_projects,
        max_extractions_per_project=args.max_extractions_per_project,
        since_days=args.since_days,
    )
    summary = run_synthesis_sweep(
        max_projects=args.max_projects,
        max_extractions_per_project=args.max_extractions_per_project,
        since_days=args.since_days,
    )
    _emit(
        "project_intelligence_projection_complete",
        projection="project-sweep",
        summary=summary,
    )
    return _sweep_exit_code(summary)


def main(argv: Sequence[str] | None = None) -> int:
    load_env()
    repo_root = Path(__file__).resolve().parents[4]
    assert_former_projection_paths_absent(repo_root)
    args = build_parser().parse_args(argv)
    if args.projection == "domain-packets":
        return _run_domain_packets(args)
    if args.projection == "project-sweep":
        return _run_project_sweep(args)
    raise RuntimeError(f"Unsupported Project Intelligence projection: {args.projection}")


if __name__ == "__main__":
    raise SystemExit(main())
