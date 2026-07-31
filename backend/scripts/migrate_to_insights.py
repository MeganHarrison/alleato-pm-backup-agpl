#!/usr/bin/env python3
"""
Migrate existing risks, decisions, and opportunities to the unified insights table.

Usage:
    cd backend
    source venv/bin/activate
    PYTHONPATH="src" python scripts/migrate_to_insights.py

Options:
    --dry-run    Show what would be migrated without actually inserting
"""

import argparse
import os
import sys
from datetime import datetime
from uuid import uuid4

# Add canonical backend src path for imports. Retired worker package paths must
# not be reintroduced; background ingestion lives under src/services.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from dotenv import load_dotenv

# Load environment
env_locations = [
    os.path.join(os.path.dirname(__file__), '..', '..', '.env'),
    os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'),
]
for env_path in env_locations:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break

from services.supabase_helpers import get_supabase_client


def migrate_risks(client, dry_run: bool = False) -> int:
    """Migrate risks table to insights."""
    print("\n📋 Migrating risks...")

    result = client.table('risks').select('*').execute()
    risks = result.data or []

    print(f"  Found {len(risks)} risks")

    migrated = 0
    for risk in risks:
        insight = {
            'type': 'risk',
            'title': risk.get('title'),
            'description': risk.get('description', ''),
            'status': risk.get('status', 'open'),
            'project_ids': risk.get('project_ids', []),
            'owner': risk.get('owner_name'),
            'metadata': {
                'likelihood': risk.get('likelihood'),
                'impact': risk.get('impact'),
                'category': risk.get('category'),
                'mitigation': risk.get('mitigation'),
                'original_id': risk.get('id'),
                'migrated_from': 'risks',
            },
            'created_at': risk.get('created_at'),
        }

        if dry_run:
            print(f"    [DRY RUN] Would insert: {insight['description'][:60]}...")
        else:
            try:
                client.table('insights').insert(insight).execute()
                migrated += 1
            except Exception as e:
                print(f"    ❌ Error migrating risk: {e}")

    return migrated


def migrate_decisions(client, dry_run: bool = False) -> int:
    """Migrate decisions table to insights."""
    print("\n📋 Migrating decisions...")

    result = client.table('decisions').select('*').execute()
    decisions = result.data or []

    print(f"  Found {len(decisions)} decisions")

    migrated = 0
    for decision in decisions:
        insight = {
            'type': 'decision',
            'title': decision.get('title'),
            'description': decision.get('description', ''),
            'status': decision.get('status', 'open'),
            'project_ids': decision.get('project_ids', []),
            'owner': decision.get('owner_name'),
            'metadata': {
                'rationale': decision.get('rationale'),
                'decision_date': decision.get('decision_date'),
                'original_id': decision.get('id'),
                'migrated_from': 'decisions',
            },
            'created_at': decision.get('created_at'),
        }

        if dry_run:
            print(f"    [DRY RUN] Would insert: {insight['description'][:60]}...")
        else:
            try:
                client.table('insights').insert(insight).execute()
                migrated += 1
            except Exception as e:
                print(f"    ❌ Error migrating decision: {e}")

    return migrated


def migrate_opportunities(client, dry_run: bool = False) -> int:
    """Migrate opportunities table to insights."""
    print("\n📋 Migrating opportunities...")

    result = client.table('opportunities').select('*').execute()
    opportunities = result.data or []

    print(f"  Found {len(opportunities)} opportunities")

    migrated = 0
    for opp in opportunities:
        insight = {
            'type': 'opportunity',
            'title': opp.get('title'),
            'description': opp.get('description', ''),
            'status': opp.get('status', 'open'),
            'project_ids': opp.get('project_ids', []),
            'owner': opp.get('owner_name'),
            'metadata': {
                'potential_value': opp.get('potential_value'),
                'next_step': opp.get('next_step'),
                'type': opp.get('type'),
                'original_id': opp.get('id'),
                'migrated_from': 'opportunities',
            },
            'created_at': opp.get('created_at'),
        }

        if dry_run:
            print(f"    [DRY RUN] Would insert: {insight['description'][:60]}...")
        else:
            try:
                client.table('insights').insert(insight).execute()
                migrated += 1
            except Exception as e:
                print(f"    ❌ Error migrating opportunity: {e}")

    return migrated


def main():
    parser = argparse.ArgumentParser(description='Migrate to unified insights table')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be migrated')
    args = parser.parse_args()

    print("=" * 60)
    print("Insights Table Migration")
    print("=" * 60)

    if args.dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made\n")

    client = get_supabase_client()

    # Check if insights table exists
    try:
        client.table('insights').select('id').limit(1).execute()
        print("✓ Insights table exists")
    except Exception as e:
        print(f"❌ Insights table does not exist. Run the migration SQL first:")
        print(f"   migrations/001_create_insights_table.sql")
        return

    # Migrate each type
    risks_migrated = migrate_risks(client, args.dry_run)
    decisions_migrated = migrate_decisions(client, args.dry_run)
    opportunities_migrated = migrate_opportunities(client, args.dry_run)

    # Summary
    print("\n" + "=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"  Risks migrated:         {risks_migrated}")
    print(f"  Decisions migrated:     {decisions_migrated}")
    print(f"  Opportunities migrated: {opportunities_migrated}")
    print(f"  Total:                  {risks_migrated + decisions_migrated + opportunities_migrated}")

    if args.dry_run:
        print("\n⚠️  This was a dry run. Run without --dry-run to actually migrate.")
    else:
        print("\n✓ Migration complete!")
        print("\nNext steps:")
        print("  1. Verify data in insights table")
        print("  2. Update application code to use insights table")
        print("  3. Eventually drop old tables (risks, decisions, opportunities)")


if __name__ == '__main__':
    main()
