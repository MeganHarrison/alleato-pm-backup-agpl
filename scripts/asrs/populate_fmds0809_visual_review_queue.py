#!/usr/bin/env python3
"""Seed the FMDS 8-9 review queue without approving source objects."""

from __future__ import annotations

import sys

from populate_fmds_visual_review_queue import main


if __name__ == "__main__":
    sys.argv[1:1] = ["--document-config", "fmds0809-2026-04"]
    raise SystemExit(main())
