#!/usr/bin/env python3
"""
Schema Validation Script
========================
Validates that all database column references in the codebase match the actual Supabase schema.

Run this script to catch schema mismatches BEFORE they cause runtime errors.

Usage:
    python scripts/validate_schema.py

This script:
1. Fetches the actual schema from Supabase
2. Scans Python files for .select() and column references
3. Reports any columns that don't exist in the actual schema
"""

import os
import re
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
# Load from project root .env.local
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / '.env.local')
load_dotenv(project_root / '.env')

from supabase import create_client

def get_supabase_schema():
    """Fetch actual table schemas from Supabase by querying tables directly."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        sys.exit(1)

    supabase = create_client(url, key)

    # Query each known table to get columns (information_schema not accessible via REST API)
    return get_schema_fallback(supabase)


def get_schema_fallback(supabase):
    """Fallback method: query each known table to get columns."""
    known_tables = [
        'projects', 'tasks', 'risks', 'decisions', 'opportunities',
        'document_metadata', 'meeting_segments', 'contacts', 'app_users',
        'ingestion_jobs', 'chunks', 'commitments', 'document_chunks',
        'documents', 'ai_tasks', 'project_insights', 'project_activity_view',
        'fireflies_ingestion_jobs'
    ]

    schema = {}
    for table in known_tables:
        try:
            # Query with limit 1 to get column names
            result = supabase.table(table).select('*').limit(1).execute()
            if result.data and len(result.data) > 0:
                schema[table] = set(result.data[0].keys())
            else:
                # Empty table - try to get schema from error message or use empty set
                schema[table] = set()
        except Exception as e:
            print(f"  Warning: Could not query table '{table}': {e}")

    return schema


def extract_select_columns(file_path: str) -> list:
    """Extract .select() column references from a Python file."""
    issues = []

    with open(file_path, 'r') as f:
        content = f.read()
        lines = content.split('\n')

    # Pattern to match .table('table_name').select('columns')
    # Handles multi-line selects
    table_select_pattern = re.compile(
        r"\.table\(['\"](\w+)['\"]\)\.select\(\s*['\"]([^'\"]+)['\"]",
        re.MULTILINE
    )

    for match in table_select_pattern.finditer(content):
        table_name = match.group(1)
        columns_str = match.group(2)

        # Find line number
        pos = match.start()
        line_num = content[:pos].count('\n') + 1

        # Parse columns (handle "col1, col2, col3" format)
        columns = [c.strip() for c in columns_str.split(',')]

        # Clean up column names (remove count='exact', aliases, etc.)
        clean_columns = []
        for col in columns:
            # Remove function calls like count='exact'
            col = col.split('(')[0].strip()
            # Remove aliases (e.g., "name as project_name")
            col = col.split(' ')[0].strip()
            if col and col != '*':
                clean_columns.append(col)

        issues.append({
            'file': file_path,
            'line': line_num,
            'table': table_name,
            'columns': clean_columns,
            'raw': columns_str
        })

    return issues


def validate_schema(schema: dict, references: list) -> list:
    """Check if referenced columns exist in the actual schema."""
    errors = []

    for ref in references:
        table = ref['table']

        if table not in schema:
            errors.append({
                **ref,
                'error': f"Table '{table}' not found in schema",
                'type': 'missing_table'
            })
            continue

        table_columns = schema[table]
        for col in ref['columns']:
            if col not in table_columns:
                # Find similar columns (possible typos)
                similar = [c for c in table_columns if col.lower() in c.lower() or c.lower() in col.lower()]
                errors.append({
                    **ref,
                    'error': f"Column '{col}' not found in table '{table}'",
                    'column': col,
                    'similar': similar,
                    'available': sorted(table_columns),
                    'type': 'missing_column'
                })

    return errors


def scan_codebase(root_dir: str) -> list:
    """Scan Python files for database column references."""
    all_references = []

    # Directories to scan (exclude migration/utility scripts that may reference future tables)
    scan_dirs = [
        'src/services',
        'src/api',
    ]

    # Files to skip (migrations, utilities that may reference future schema)
    skip_files = {
        'migrate_to_insights.py',
        'generate_project_summary.py'
    }

    for scan_dir in scan_dirs:
        full_path = Path(root_dir) / scan_dir
        if not full_path.exists():
            continue

        for py_file in full_path.rglob('*.py'):
            # Skip this validation script itself to avoid false positives
            if py_file.name == 'validate_schema.py':
                continue
            refs = extract_select_columns(str(py_file))
            all_references.extend(refs)

    return all_references


def main():
    print("=" * 60)
    print("SCHEMA VALIDATION REPORT")
    print("=" * 60)
    print()

    backend_dir = Path(__file__).parent.parent

    # Step 1: Get actual schema from Supabase
    print("1. Fetching schema from Supabase...")
    try:
        schema = get_supabase_schema()
        print(f"   Found {len(schema)} tables")
        for table, cols in sorted(schema.items()):
            print(f"   - {table}: {len(cols)} columns")
    except Exception as e:
        print(f"   ERROR: Could not fetch schema: {e}")
        sys.exit(1)
    print()

    # Step 2: Scan codebase for column references
    print("2. Scanning codebase for database references...")
    references = scan_codebase(str(backend_dir))
    print(f"   Found {len(references)} SELECT statements")
    print()

    # Step 3: Validate
    print("3. Validating column references...")
    errors = validate_schema(schema, references)
    print()

    # Step 4: Report
    if errors:
        print("=" * 60)
        print(f"FOUND {len(errors)} SCHEMA ERRORS!")
        print("=" * 60)
        print()

        for err in errors:
            print(f"FILE: {err['file']}")
            print(f"LINE: {err['line']}")
            print(f"ERROR: {err['error']}")
            if err['type'] == 'missing_column':
                print(f"COLUMN: {err['column']}")
                if err.get('similar'):
                    print(f"SIMILAR: {', '.join(err['similar'])}")
                print(f"AVAILABLE COLUMNS: {', '.join(err['available'][:10])}...")
            print(f"QUERY: .table('{err['table']}').select('{err['raw']}')")
            print("-" * 40)
            print()

        print(f"Total errors: {len(errors)}")
        sys.exit(1)
    else:
        print("=" * 60)
        print("ALL SCHEMA REFERENCES VALID!")
        print("=" * 60)
        sys.exit(0)


if __name__ == '__main__':
    main()
