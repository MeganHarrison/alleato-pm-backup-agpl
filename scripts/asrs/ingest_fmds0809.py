#!/usr/bin/env python3
"""Stage the validated FMDS 8-9 April 2026 source using the shared corpus runner."""

from __future__ import annotations

import sys

from ingest_fmds0834 import main


if __name__ == "__main__":
    sys.argv[1:1] = ["--document-config", "fmds0809-2026-04"]
    raise SystemExit(main())
