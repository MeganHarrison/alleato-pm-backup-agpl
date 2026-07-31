from __future__ import annotations

import copy
import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "correct_fmds0834_tables.py"
SPEC = importlib.util.spec_from_file_location("correct_fmds0834_tables", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def source_output() -> dict:
    return {
        "candidate_only": True,
        "requires_visual_validation": True,
        "verification": {
            "exact_match": False,
            "completeness": "partial",
            "confidence": 0.8,
            "discrepancies": [{"description": "missing text"}],
        },
        "extracted_structure": {
            "columns": [
                {"label": "Condition"},
                {"label": "Value"},
            ],
            "rows": [
                {
                    "kind": "header",
                    "cells": [{"text": "Condition"}, {"text": "Value"}],
                },
                {
                    "kind": "body",
                    "cells": [
                        {"text": "Original", "row_span": 1, "column_span": 1},
                        {"text": "10", "row_span": 1, "column_span": 1},
                    ],
                },
                {
                    "kind": "note",
                    "cells": [{"text": "Full-width footnote", "column_span": 2}],
                },
            ],
            "governing_text": ["Incomplete"],
        },
    }


def entry() -> dict:
    return {
        "source_id": "source-id",
        "identifier": "2.2.3",
        "source_candidate_id": "candidate-id",
        "source_candidate_output_sha256": "source-hash",
        "reviewed_at": "2026-07-21T18:11:00-04:00",
        "notes": "Exact source-image correction.",
        "correction": {
            "governing_text": ["Full governing paragraph."],
            "column_patches": [
                {"column_index": 0, "changes": {"label": "Correct condition"}}
            ],
            "cell_insertions": [],
            "cell_deletions": [],
            "row_insertions": [],
            "cell_patches": [
                {
                    "row_index": 1,
                    "cell_index": 0,
                    "changes": {"text": "Corrected", "row_span": 2},
                }
            ],
            "questions": [],
        },
    }


def test_build_corrected_output_preserves_source_and_creates_review_proposal() -> None:
    original = source_output()
    corrected = MODULE.build_corrected_output(original, entry())

    assert original == source_output()
    assert corrected["requires_visual_validation"] is False
    assert corrected["extracted_structure"]["governing_text"] == [
        "Full governing paragraph."
    ]
    assert (
        corrected["extracted_structure"]["rows"][1]["cells"][0]["text"] == "Corrected"
    )
    assert corrected["extracted_structure"]["rows"][1]["cells"][0]["row_span"] == 2
    assert corrected["review_proposal"] == {
        "kind": "table_transcription",
        "columns": ["Correct condition", "Value"],
        "rows": [["Corrected", "10"]],
        "questions": [],
    }
    assert corrected["adjudication"]["exact_match"] is True
    assert corrected["verification"]["discrepancies"] == []


def test_review_fingerprint_is_deterministic_and_correction_sensitive() -> None:
    first = MODULE.build_corrected_output(source_output(), entry())
    second = MODULE.build_corrected_output(source_output(), entry())
    changed_entry = copy.deepcopy(entry())
    changed_entry["correction"]["governing_text"] = ["Different paragraph."]
    changed = MODULE.build_corrected_output(source_output(), changed_entry)

    assert first["review_fingerprint"] == second["review_fingerprint"]
    assert first["review_fingerprint"] != changed["review_fingerprint"]


def test_cell_insertion_repairs_a_short_body_row() -> None:
    original = source_output()
    original["extracted_structure"]["rows"][1]["cells"].pop(0)
    correction = entry()
    correction["correction"]["cell_patches"] = []
    correction["correction"]["cell_insertions"] = [
        {
            "row_index": 1,
            "cell_index": 0,
            "cell": {
                "text": "Original",
                "unit": None,
                "is_blank": False,
                "row_span": 1,
                "column_span": 1,
                "normalized_value": None,
                "confidence": 1.0,
            },
        }
    ]

    corrected = MODULE.build_corrected_output(original, correction)

    assert corrected["review_proposal"]["rows"] == [["Original", "10"]]


def test_source_title_correction_updates_candidate_title_and_fingerprint() -> None:
    original = source_output()
    original["extracted_structure"]["title"] = "Sprnkler guidance"
    correction = entry()
    correction["correction"]["source_title"] = "Sprinkler guidance"

    corrected = MODULE.build_corrected_output(original, correction)

    assert original["extracted_structure"]["title"] == "Sprnkler guidance"
    assert corrected["extracted_structure"]["title"] == "Sprinkler guidance"
    changed = copy.deepcopy(correction)
    changed["correction"]["source_title"] = "Another title"
    assert (
        corrected["review_fingerprint"]
        != MODULE.build_corrected_output(original, changed)["review_fingerprint"]
    )


def test_row_insertion_restores_missing_body_rows_and_reindexes_structure() -> None:
    original = source_output()
    correction = entry()
    correction["correction"]["cell_patches"] = []
    correction["correction"]["row_insertions"] = [
        {
            "row_index": 2,
            "row": {
                "kind": "body",
                "row_index": 2,
                "cells": [
                    {"text": "Inserted", "row_span": 1, "column_span": 1},
                    {"text": "20", "row_span": 1, "column_span": 1},
                ],
            },
        }
    ]

    corrected = MODULE.build_corrected_output(original, correction)

    assert corrected["review_proposal"]["rows"] == [
        ["Original", "10"],
        ["Inserted", "20"],
    ]
    assert corrected["extracted_structure"]["rows"][2]["row_index"] == 2


def test_cell_deletion_removes_duplicate_merged_header_cell() -> None:
    original = source_output()
    original["extracted_structure"]["rows"][0]["cells"].insert(
        0, {"text": "", "row_span": 2, "column_span": 1}
    )
    correction = entry()
    correction["correction"]["cell_deletions"] = [
        {"row_index": 0, "cell_index": 0}
    ]

    corrected = MODULE.build_corrected_output(original, correction)

    assert [
        cell["text"] for cell in corrected["extracted_structure"]["rows"][0]["cells"]
    ] == ["Condition", "Value"]
