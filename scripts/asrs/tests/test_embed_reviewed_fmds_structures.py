from __future__ import annotations

import sys
import unittest
from unittest.mock import patch
from pathlib import Path


ASRS_DIR = Path(__file__).resolve().parents[1]
if str(ASRS_DIR) not in sys.path:
    sys.path.insert(0, str(ASRS_DIR))

from embed_reviewed_fmds_structures import build_chunk_rows  # noqa: E402
from fmds_embedding_utils import embedding_client  # noqa: E402


REVISION = {"id": "revision-1", "revision_label": "2026-04"}


class StructuredFmdsSerializationTests(unittest.TestCase):
    def test_serializes_approved_table_with_exact_cells_and_review_notes(self) -> None:
        source = {
            "id": "table-1",
            "table_identifier": "2.1.4.5.4",
            "title": "Hose Demand",
            "page_start": 12,
            "review_status": "reviewed",
        }
        event = {
            "id": "event-1",
            "decision": "approved",
            "candidate_ids": ["candidate-1"],
            "notes": "Confirmed against the authoritative source.",
        }
        candidate = {
            "id": "candidate-1",
            "source_type": "table",
            "source_id": "table-1",
            "output": {
                "region_native_text": "Table source context",
                "review_proposal": {
                    "kind": "table_transcription",
                    "columns": ["Type", "Hose Demand"],
                    "rows": [["Standard-Coverage", "250 (950)"]],
                },
            },
        }

        rows = build_chunk_rows(REVISION, "table", source, event, candidate)

        self.assertEqual(len(rows), 1)
        self.assertIn("Type: Standard-Coverage", rows[0]["content"])
        self.assertIn("Hose Demand: 250 (950)", rows[0]["content"])
        self.assertIn("Confirmed against the authoritative source", rows[0]["content"])
        self.assertEqual(rows[0]["review_event_id"], "event-1")
        self.assertEqual(len(rows[0]["content_sha256"]), 64)

    def test_serializes_approved_figure_with_resolved_boundary_note(self) -> None:
        source = {
            "id": "figure-1",
            "figure_identifier": "2.2.1.5.1",
            "title": "Vertical Barriers",
            "page_number": 21,
            "review_status": "reviewed",
        }
        event = {
            "id": "event-2",
            "decision": "approved",
            "candidate_ids": ["candidate-2"],
            "notes": "Exactly 1.5 in. is included and exactly 0.5 in. is included.",
        }
        candidate = {
            "id": "candidate-2",
            "source_type": "figure",
            "source_id": "figure-1",
            "output": {
                "review_proposal": {
                    "kind": "figure_fact_review",
                    "facts": [
                        "Gross flue-space width is ≥1.5 in. (38 mm).",
                        "Net flue-space width is ≤0.5 in. (13 mm).",
                        "Horizontal distance must be greater than 10 ft.",
                    ],
                    "structured_figure": {
                        "figure_type": "decision diagram",
                        "summary": "Determines whether vertical barriers are required.",
                        "measurements": [
                            {
                                "text": "≥1.5 in. (38 mm)",
                                "applies_to": "gross flue-space width",
                            },
                            {
                                "text": "≤0.5 in. (13 mm)",
                                "applies_to": "net flue-space width",
                            },
                        ],
                        "decision_nodes": [],
                        "relationships": [],
                        "entities": [],
                        "labels": ["Gross flue-space width", "Net flue-space width"],
                        "references": ["Section 2.2.1.5"],
                        "ambiguities": [],
                    },
                }
            },
        }

        rows = build_chunk_rows(REVISION, "figure", source, event, candidate)

        self.assertIn("Horizontal distance must be greater than 10 ft", rows[0]["content"])
        self.assertIn("≥1.5 in. (38 mm)", rows[0]["content"])
        self.assertIn("≤0.5 in. (13 mm)", rows[0]["content"])
        self.assertIn("horizontal-loading ASRS", rows[0]["content"])
        self.assertNotIn("Exactly 1.5 in. is included", rows[0]["content"])

    def test_rejects_unreviewed_source(self) -> None:
        source = {
            "id": "table-1",
            "table_identifier": "2.1",
            "page_start": 12,
            "review_status": "needs_review",
        }
        event = {
            "id": "event-1",
            "decision": "approved",
            "candidate_ids": ["candidate-1"],
        }
        candidate = {
            "id": "candidate-1",
            "source_type": "table",
            "source_id": "table-1",
            "output": {},
        }

        with self.assertRaisesRegex(ValueError, "is not reviewed"):
            build_chunk_rows(REVISION, "table", source, event, candidate)

    def test_rejects_ambiguous_multi_candidate_approval(self) -> None:
        source = {
            "id": "figure-1",
            "figure_identifier": "2.2",
            "page_number": 20,
            "review_status": "reviewed",
        }
        event = {
            "id": "event-1",
            "decision": "approved",
            "candidate_ids": ["candidate-1", "candidate-2"],
        }
        candidate = {
            "id": "candidate-1",
            "source_type": "figure",
            "source_id": "figure-1",
            "output": {},
        }

        with self.assertRaisesRegex(ValueError, "exactly one approved candidate"):
            build_chunk_rows(REVISION, "figure", source, event, candidate)

    @patch.dict(
        "os.environ",
        {
            "AI_PROVIDER_PATH": "openai",
            "OPENAI_API_KEY": "test-openai-key",
            "AI_GATEWAY_API_KEY": "test-gateway-key",
        },
        clear=False,
    )
    def test_explicit_openai_path_bypasses_gateway(self) -> None:
        _client, model, provider = embedding_client()

        self.assertEqual(provider, "openai")
        self.assertEqual(model, "text-embedding-3-large")

    @patch.dict(
        "os.environ",
        {
            "AI_PROVIDER_PATH": "vercel_gateway",
            "AI_GATEWAY_API_KEY": "test-gateway-key",
            "AI_GATEWAY_EMBEDDING_MODEL": "openai/text-embedding-3-large",
        },
        clear=False,
    )
    def test_vercel_gateway_alias_uses_ai_gateway(self) -> None:
        client, model, provider = embedding_client()

        self.assertEqual(provider, "ai-gateway")
        self.assertEqual(model, "openai/text-embedding-3-large")
        self.assertEqual(str(client.base_url), "https://ai-gateway.vercel.sh/v1/")


if __name__ == "__main__":
    unittest.main()