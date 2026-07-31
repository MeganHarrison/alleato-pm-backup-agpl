#!/usr/bin/env python3
"""Verify FMDS 8-9 April 2026 staging coverage without activating it."""

from __future__ import annotations

import sys

from verify_fmds0834 import main


if __name__ == "__main__":
    sys.argv[1:1] = ["--document-config", "fmds0809-2026-04"]
    raise SystemExit(main())
