from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any


ASRS_SCRIPTS = Path(__file__).resolve().parents[1]
if str(ASRS_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(ASRS_SCRIPTS))

from fmds_corpus_config import FMDS0834_2026_04  # noqa: E402
from ingest_fmds0834 import apply_document_config, extract_captions  # noqa: E402


class FakePage:
    def __init__(self, blocks: list[tuple[Any, ...]]) -> None:
        self.blocks = blocks

    def get_text(self, kind: str, *, sort: bool) -> list[tuple[Any, ...]]:
        if kind != "blocks" or not sort:
            raise AssertionError("caption extraction must request sorted text blocks")
        return self.blocks

    def find_tables(self) -> Any:
        raise AssertionError("figure-only input must not invoke table detection")


class Fmds0834CaptionInventoryTest(unittest.TestCase):
    def setUp(self) -> None:
        apply_document_config(FMDS0834_2026_04)

    def test_exact_revision_accepts_fig_abbreviation_and_rejects_full_figure_table_cell(self) -> None:
        page = FakePage(
            [
                (20, 20, 500, 40, "Fig. 2.2.3.2.1(d). Real source figure", 0, 0),
                (
                    20,
                    80,
                    500,
                    100,
                    "Figure 2.2.3.2.1(c). Class 3 25 (7.6) 30 (9.1)",
                    1,
                    0,
                ),
            ]
        )

        captions = extract_captions(page, 43)  # type: ignore[arg-type]

        self.assertEqual(len(captions), 1)
        self.assertEqual(captions[0].kind, "figure")
        self.assertEqual(captions[0].identifier, "2.2.3.2.1(d)")
        self.assertEqual(captions[0].title, "Real source figure")

    def test_contents_pages_remain_excluded(self) -> None:
        page = FakePage([(20, 20, 500, 40, "Fig. 1.2. Contents listing", 0, 0)])

        self.assertEqual(extract_captions(page, 7), [])  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()