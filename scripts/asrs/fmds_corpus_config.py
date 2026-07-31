"""Validated immutable source identities for the dedicated ASRS FMDS corpus."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FmdsCorpusConfig:
    document_code: str
    display_name: str
    revision_label: str
    publication_date: str
    expected_page_count: int
    expected_table_count: int | None
    expected_figure_count: int | None
    expected_source_sha256: str | None
    accepted_figure_caption_labels: tuple[str, ...] | None
    running_line_patterns: tuple[str, ...]
    representative_queries: tuple[str, ...]


FMDS0834_2026_04 = FmdsCorpusConfig(
    document_code="FMDS0834",
    display_name="FMDS 8-34",
    revision_label="2026-04",
    publication_date="2026-04-01",
    expected_page_count=122,
    expected_table_count=58,
    expected_figure_count=60,
    expected_source_sha256="c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed",
    # This exact revision uses abbreviated source captions for every real
    # figure. The lone full "Figure" match is a table cell on PDF page 43.
    accepted_figure_caption_labels=("Fig.",),
    running_line_patterns=(
        r"FM Property Loss Prevention Data Sheets\s+8-34",
        r"Protection for Automatic Storage\s+8-34",
        r"8-34\s+Protection for Automatic Storage",
    ),
    representative_queries=(
        "closed-top combustible containers horizontal-loading ASRS sprinkler design",
        "top-loading ASRS ceiling height 28 ft sprinkler protection",
        "vertically enclosed ASRS storage over 55 ft protection",
    ),
)

FMDS0809_2026_04 = FmdsCorpusConfig(
    document_code="FMDS0809",
    display_name="FMDS 8-9",
    revision_label="2026-04",
    publication_date="2026-04-01",
    expected_page_count=103,
    expected_table_count=None,
    expected_figure_count=None,
    expected_source_sha256="12417a5cf08d0b8e16b73108d8b93648b0c4b9c3c2559f4925313c682ae4be9b",
    accepted_figure_caption_labels=None,
    running_line_patterns=(
        r"FM Property Loss Prevention Data Sheets\s+8-9",
        r"Storage of Class 1, 2, 3, 4 and Plastic Commodities\s+8-9",
        r"8-9\s+Storage of Class 1, 2, 3, 4 and Plastic Commodities",
    ),
    representative_queries=(
        "ceiling-level protection Class 4 commodity open-frame rack storage",
        "in-rack sprinkler hydraulic design storage arrangements",
        "cartoned expanded plastic storage protection guidelines",
    ),
)


CONFIGURATIONS = {
    "fmds0834-2026-04": FMDS0834_2026_04,
    "fmds0809-2026-04": FMDS0809_2026_04,
}


def load_config(name: str) -> FmdsCorpusConfig:
    try:
        return CONFIGURATIONS[name]
    except KeyError as error:
        choices = ", ".join(sorted(CONFIGURATIONS))
        raise ValueError(f"Unknown FMDS corpus configuration {name!r}; choose one of: {choices}") from error


def config_name_from_path(path: Path) -> str:
    return path.stem