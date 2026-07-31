#!/usr/bin/env python3
"""
Seed cost code divisions, cost codes, cost code types, and project-level cost codes.

Run this after rebuilding the budget schema so the frontend selectors have data.
"""

import os
from pathlib import Path
from typing import List, Dict
import uuid

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).parent.parent.parent
load_dotenv(ROOT / '.env.local')
load_dotenv(ROOT / '.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL and service key are required")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

DIVISIONS: List[Dict] = [
    {"code": "01", "title": "01 General Requirements", "sort_order": 1},
    {"code": "02", "title": "02 Existing Conditions", "sort_order": 2},
    {"code": "03", "title": "03 Concrete", "sort_order": 3},
    {"code": "04", "title": "04 Masonry", "sort_order": 4},
    {"code": "05", "title": "05 Metals", "sort_order": 5},
    {"code": "06", "title": "06 Wood, Plastics, and Composites", "sort_order": 6},
    {"code": "07", "title": "07 Thermal and Moisture Protection", "sort_order": 7},
    {"code": "08", "title": "08 Openings", "sort_order": 8},
    {"code": "09", "title": "09 Finishes", "sort_order": 9},
]

COST_CODES = [
    ("01-1000", "01", "Project Management & Coordination"),
    ("01-2000", "01", "Allowances"),
    ("01-3000", "01", "Administrative Requirements"),
    ("01-5000", "01", "Temporary Facilities & Controls"),
    ("03-1000", "03", "Concrete Forming & Accessories"),
    ("03-2000", "03", "Concrete Reinforcing"),
    ("03-3000", "03", "Cast-in-Place Concrete"),
    ("09-1000", "09", "Plaster & Gypsum Board"),
    ("09-2000", "09", "Tiling"),
    ("09-4000", "09", "Flooring"),
]

COST_CODE_TYPES = [
    {"code": "R", "description": "Regular"},
    {"code": "L", "description": "Labor"},
    {"code": "E", "description": "Equipment"},
]


def upsert_divisions():
    for division in DIVISIONS:
        supabase.table('cost_code_divisions').upsert(division, on_conflict='code').execute()


def upsert_cost_codes():
    result = supabase.table('cost_code_divisions').select('id, code, title').execute()
    code_map = {row['code']: row for row in result.data or []}

    rows = []
    for code, division_code, description in COST_CODES:
        division = code_map.get(division_code)
        if not division:
            continue
        rows.append({
            "id": code,
            "division_id": division['id'],
            "division_title": division['title'],
            "description": description,
            "status": "True",
        })

    if rows:
        supabase.table('cost_codes').upsert(rows, on_conflict='id').execute()


def upsert_cost_code_types():
    rows = []
    for entry in COST_CODE_TYPES:
        rows.append({
            "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"cost_type_{entry['code']}")),
            **entry,
        })
    supabase.table('cost_code_types').upsert(rows, on_conflict='id').execute()


def seed_project_cost_codes():
    projects = supabase.table('projects').select('id').limit(1).execute().data or []
    if not projects:
        print("No projects found; skipping project_cost_codes seeding.")
        return

    project_id = projects[0]['id']
    cost_code_rows = supabase.table('cost_codes').select('id').limit(len(COST_CODES)).execute().data or []

    entries = [{
        "project_id": project_id,
        "cost_code_id": row['id'],
        "is_active": True,
    } for row in cost_code_rows]

    if entries:
        supabase.table('project_cost_codes').upsert(entries).execute()


def main():
    upsert_divisions()
    upsert_cost_codes()
    upsert_cost_code_types()
    seed_project_cost_codes()
    print("Cost code data seeded successfully.")


if __name__ == '__main__':
    main()
