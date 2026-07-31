from __future__ import annotations

import unittest

import fitz

from scripts.asrs.localize_fmds_table_crop import (
    display_rect,
    stored_table_is_compatible,
    trailing_context_blocks,
)


class LocalizeFmdsTableCropTest(unittest.TestCase):
    def test_display_rect_rotates_native_geometry_into_page_coordinates(self) -> None:
        document = fitz.open()
        page = document.new_page(width=612, height=792)
        page.set_rotation(90)

        displayed = display_rect(page, fitz.Rect(88, 100, 106, 738))

        self.assertAlmostEqual(displayed.x0, 54, delta=1)
        self.assertAlmostEqual(displayed.y0, 88, delta=1)
        self.assertAlmostEqual(displayed.x1, 692, delta=1)
        self.assertAlmostEqual(displayed.y1, 106, delta=1)

    def test_compatible_stored_table_must_follow_and_overlap_caption(self) -> None:
        document = fitz.open()
        page = document.new_page(width=792, height=612)
        caption = fitz.Rect(54, 89, 692, 106)

        self.assertTrue(
            stored_table_is_compatible(page, caption, fitz.Rect(50, 162, 696, 412))
        )
        self.assertFalse(
            stored_table_is_compatible(page, caption, fitz.Rect(50, 300, 696, 550))
        )
        self.assertFalse(
            stored_table_is_compatible(page, caption, fitz.Rect(700, 162, 790, 412))
        )

    def test_trailing_context_keeps_footnotes_but_not_page_footer(self) -> None:
        document = fitz.open()
        page = document.new_page(width=792, height=612)
        page.insert_textbox(fitz.Rect(50, 414, 700, 445), "a Minimum aisle width applies", fontsize=9)
        page.insert_textbox(fitz.Rect(10, 560, 500, 580), "©2026 Factory Mutual", fontsize=9)

        blocks = trailing_context_blocks(page, fitz.Rect(50, 160, 700, 412), None)

        self.assertEqual([block[4] for block in blocks], ["a Minimum aisle width applies"])

    def test_trailing_context_stops_before_next_table_caption(self) -> None:
        document = fitz.open()
        page = document.new_page(width=792, height=612)
        page.insert_textbox(fitz.Rect(50, 414, 700, 445), "a Required footnote", fontsize=9)
        page.insert_textbox(fitz.Rect(50, 470, 700, 500), "Unrelated following text", fontsize=9)

        blocks = trailing_context_blocks(page, fitz.Rect(50, 160, 700, 412), 460)

        self.assertEqual([block[4] for block in blocks], ["a Required footnote"])


if __name__ == "__main__":
    unittest.main()
