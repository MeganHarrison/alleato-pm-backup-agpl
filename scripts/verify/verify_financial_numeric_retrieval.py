#!/usr/bin/env python3
"""End-to-end financial retrieval verification.

Seeds a known financial row into Supabase and verifies the backend `/api/chat`
returns the exact numeric amount using structured financial retrieval.

Usage:
  cd /Users/meganharrison/Documents/alleato-pm
  python3 scripts/verify/verify_financial_numeric_retrieval.py \
    --project-id 43 \
    --backend-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from services.env_loader import load_env


@dataclass
class VerifyResult:
    passed: bool
    message: str
    details: Dict[str, Any]


def _get_supabase_client():
    try:
        from services.supabase_helpers import get_supabase_client
    except Exception as exc:
        raise RuntimeError(
            "Supabase Python dependency is missing. Install backend deps first: "
            "`cd backend && pip install -r requirements.txt`"
        ) from exc
    return get_supabase_client()


def _seed_fixture(client, project_id: int, amount: str) -> str:
    metadata_id = str(uuid4())

    client.table("document_metadata").insert(
        {
            "id": metadata_id,
            "title": "Verification Budget Fixture",
            "category": "financial_document",
            "type": "document",
            "source": "verification_script",
            "status": "segmented",
            "phase": "ingest",
            "project_id": project_id,
            "file_name": "verification-budget.xlsx",
        }
    ).execute()

    client.table("document_rows").insert(
        {
            "dataset_id": metadata_id,
            "row_data": {
                "sheet": "Budget",
                "row_index": 1,
                "columns": {
                    "Cost Code": "03-3000",
                    "Description": "Concrete",
                    "Amount": amount,
                    "Period": "Q3 2024",
                },
            },
        }
    ).execute()

    return metadata_id


def _cleanup_fixture(client, metadata_id: str) -> None:
    client.table("document_rows").delete().eq("dataset_id", metadata_id).execute()
    client.table("document_metadata").delete().eq("id", metadata_id).execute()


def verify(project_id: int, backend_url: str, amount: str, cleanup: bool) -> VerifyResult:
    client = _get_supabase_client()
    metadata_id = _seed_fixture(client, project_id=project_id, amount=amount)

    try:
        payload = {
            "message": "What is the concrete amount in Q3 budget?",
            "project_id": project_id,
            "limit": 5,
        }
        response = requests.post(
            f"{backend_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=30,
        )

        if response.status_code != 200:
            return VerifyResult(
                passed=False,
                message="Backend /api/chat returned non-200",
                details={"status_code": response.status_code, "body": response.text[:500]},
            )

        data = response.json()
        sources = data.get("sources") or []
        if not sources:
            return VerifyResult(
                passed=False,
                message="No sources returned from /api/chat",
                details={"response": data},
            )

        first = sources[0]
        mode = (first.get("metadata") or {}).get("retrieval_mode")
        snippet = first.get("snippet") or ""

        if mode != "financial_structured":
            return VerifyResult(
                passed=False,
                message="Did not use financial_structured retrieval mode",
                details={"retrieval_mode": mode, "source": first},
            )

        if amount not in snippet:
            return VerifyResult(
                passed=False,
                message="Exact numeric amount not present in returned snippet",
                details={"expected_amount": amount, "snippet": snippet, "source": first},
            )

        return VerifyResult(
            passed=True,
            message="Financial numeric retrieval verification passed",
            details={"metadata_id": metadata_id, "snippet": snippet, "source": first},
        )
    finally:
        if cleanup:
            _cleanup_fixture(client, metadata_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify structured financial numeric retrieval end-to-end")
    parser.add_argument("--project-id", type=int, required=True)
    parser.add_argument("--backend-url", default=os.getenv("PYTHON_BACKEND_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--amount", default="125000")
    parser.add_argument("--no-cleanup", action="store_true", help="Keep seeded fixture rows for inspection")
    return parser.parse_args()


def main() -> int:
    load_env()
    args = parse_args()
    result = verify(
        project_id=args.project_id,
        backend_url=args.backend_url,
        amount=args.amount,
        cleanup=not args.no_cleanup,
    )
    print(json.dumps(result.__dict__, indent=2))
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
