#!/usr/bin/env python3
"""
Extract insights (risks, decisions, opportunities, tasks) from meeting transcripts.

This script processes meeting transcripts and uses AI to extract structured insights,
storing them in the existing tables (risks, decisions, opportunities, tasks).

Usage:
    cd backend
    source venv/bin/activate
    PYTHONPATH="src" python scripts/extract_meeting_insights.py --meeting-id <uuid>
    PYTHONPATH="src" python scripts/extract_meeting_insights.py --project-id <id> --unprocessed
    PYTHONPATH="src" python scripts/extract_meeting_insights.py --all-unprocessed

Options:
    --meeting-id      Process a specific meeting by document_metadata ID
    --project-id      Process all meetings for a project
    --unprocessed     Only process meetings that haven't been processed yet
    --all-unprocessed Process all unprocessed meetings across all projects
    --dry-run         Show what would be extracted without saving
    --verbose         Show detailed extraction output
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
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
        print(f"Loaded env from: {env_path}")
        break

from openai import OpenAI
from services.supabase_helpers import get_supabase_client


EXTRACTION_PROMPT = """You are an AI assistant analyzing a construction project meeting transcript. Extract structured insights from the transcript.

For each insight you find, categorize it as one of:
- **risk**: Something that could go wrong, a concern, a potential problem
- **decision**: A choice that was made, something agreed upon, a direction chosen
- **opportunity**: A potential improvement, cost saving, schedule acceleration, or positive possibility
- **task**: An action item or commitment - something someone needs to do

For each insight, provide:
1. type: The category (risk, decision, opportunity, task)
2. description: Clear, concise description of the insight (1-2 sentences)
3. owner: Person responsible or who raised it (if mentioned)
4. status: Usually "open" unless explicitly resolved in the meeting
5. confidence: Your confidence in this extraction (0.0-1.0)
6. metadata: Type-specific additional data

Metadata by type:
- risk: {{ "likelihood": "low/medium/high", "impact": "low/medium/high", "category": "schedule/cost/quality/safety/scope" }}
- decision: {{ "rationale": "why this was decided" }}
- opportunity: {{ "type": "cost_savings/schedule/quality/relationship", "next_step": "suggested action" }}
- task: {{ "due_date": "when (if mentioned)", "priority": "high/medium/low" }}

PROJECT: {project_name}
MEETING: {meeting_title}
DATE: {meeting_date}

TRANSCRIPT:
{transcript}

Return a JSON object with an "insights" array containing ALL extracted insights. Only include insights that are clearly stated or strongly implied in the transcript. Do not invent or assume things not discussed.

Your response MUST be in this exact format:
{{
  "insights": [
    {{
      "type": "risk",
      "description": "Geotech report delay could push foundation pour past the weather window",
      "owner": "Chad",
      "status": "open",
      "confidence": 0.9,
      "metadata": {{
        "likelihood": "medium",
        "impact": "high",
        "category": "schedule"
      }}
    }},
    {{
      "type": "decision",
      "description": "Team agreed to proceed with prefab option for the canopy to save 3 weeks",
      "owner": "AJ",
      "status": "resolved",
      "confidence": 0.95,
      "metadata": {{
        "rationale": "Schedule savings outweigh minor cost increase"
      }}
    }},
    {{
      "type": "task",
      "description": "Keith will deliver structural calculations revision by Friday",
      "owner": "Keith",
      "status": "open",
      "confidence": 0.85,
      "metadata": {{
        "due_date": "Friday",
        "priority": "high"
      }}
    }}
  ]
}}

Extract ALL relevant insights from the transcript and return them in the insights array:"""


def get_meeting(client, meeting_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single meeting by ID."""
    result = client.table('document_metadata').select(
        'id, title, date, project_id, content, overview, summary'
    ).eq('id', meeting_id).single().execute()
    return result.data


def get_project(client, project_id: int) -> Optional[Dict[str, Any]]:
    """Fetch project details."""
    result = client.table('projects').select('id, name').eq('id', project_id).single().execute()
    return result.data


def get_unprocessed_meetings(client, project_id: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Get meetings that haven't been processed for insights yet."""
    # Get meetings that have content
    query = client.table('document_metadata').select(
        'id, title, date, project_id, content, overview'
    ).not_.is_('content', 'null').order('date', desc=True).limit(limit)

    if project_id:
        query = query.eq('project_id', project_id)

    result = query.execute()
    meetings = result.data or []

    # Filter out already processed meetings by checking existing tables
    processed_ids = set()
    if meetings:
        meeting_ids = [m['id'] for m in meetings]
        # Check risks, decisions, opportunities, tasks tables for metadata_id
        for table in ['risks', 'decisions', 'opportunities', 'tasks']:
            try:
                table_result = client.table(table).select('metadata_id').in_('metadata_id', meeting_ids).execute()
                processed_ids.update({i['metadata_id'] for i in (table_result.data or []) if i.get('metadata_id')})
            except Exception:
                pass

    return [m for m in meetings if m['id'] not in processed_ids]


def extract_insights_with_ai(
    project_name: str,
    meeting_title: str,
    meeting_date: str,
    transcript: str
) -> List[Dict[str, Any]]:
    """Use OpenAI to extract insights from transcript."""
    openai_client = OpenAI()

    prompt = EXTRACTION_PROMPT.format(
        project_name=project_name,
        meeting_title=meeting_title,
        meeting_date=meeting_date or "Unknown",
        transcript=transcript[:50000]  # Limit transcript length
    )

    response = openai_client.chat.completions.create(
        model="GPT-5.4",
        messages=[
            {
                "role": "system",
                "content": "You are an expert construction project analyst. Extract insights accurately and conservatively - only extract what is clearly stated or strongly implied."
            },
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        max_completion_tokens=4000,
        temperature=0.3  # Lower temperature for more consistent extraction
    )

    try:
        raw_content = response.choices[0].message.content
        result = json.loads(raw_content)
        # Handle various response formats
        if isinstance(result, list):
            return result
        elif isinstance(result, dict):
            # Check for 'insights' key
            if 'insights' in result:
                return result['insights']
            # Check if it's a single insight object (has 'type' and 'description')
            if 'type' in result and 'description' in result:
                return [result]  # Wrap single insight in array
            # Try to find an array in the response
            for key, value in result.items():
                if isinstance(value, list):
                    return value
        print(f"    ⚠️  Unexpected response format: {type(result)}")
        print(f"    Response preview: {raw_content[:200]}...")
        return []
    except json.JSONDecodeError as e:
        print(f"    ⚠️  JSON parse error: {e}")
        print(f"    Raw response: {response.choices[0].message.content[:200]}...")
        return []


def save_insights(
    client,
    insights: List[Dict[str, Any]],
    meeting_id: str,
    project_id: int,
    dry_run: bool = False
) -> Dict[str, int]:
    """Save extracted insights to the appropriate tables (risks, decisions, opportunities, tasks)."""
    saved = {'risk': 0, 'decision': 0, 'opportunity': 0, 'task': 0}

    for insight in insights:
        insight_type = insight.get('type', 'risk')
        metadata = insight.get('metadata', {})
        owner = insight.get('owner')
        description = insight.get('description', '')
        status = insight.get('status', 'open')

        # Build base record with common fields
        base_record = {
            'metadata_id': meeting_id,
            'description': description,
            'status': status,
            'owner_name': owner,
            'project_ids': [project_id] if project_id else [],
        }

        if insight_type == 'risk':
            record = {
                **base_record,
                'likelihood': metadata.get('likelihood'),
                'impact': metadata.get('impact'),
                'category': metadata.get('category'),
            }
            table = 'risks'

        elif insight_type == 'decision':
            record = {
                **base_record,
                'status': 'active',  # decisions use 'active' not 'open'
                'rationale': metadata.get('rationale'),
            }
            table = 'decisions'

        elif insight_type == 'opportunity':
            record = {
                **base_record,
                'type': metadata.get('type'),
                'next_step': metadata.get('next_step'),
            }
            table = 'opportunities'

        elif insight_type == 'task':
            # Clean up due_date - only use values that look like actual dates (YYYY-MM-DD or similar)
            due_date = metadata.get('due_date')
            if due_date:
                due_date_lower = due_date.lower()
                # Reject non-date strings (relative times, placeholders, etc.)
                invalid_patterns = [
                    'immediate', 'not specified', 'none', 'asap', 'tbd', 'unknown',
                    'next week', 'this week', 'unspecified', 'before', 'after', 'starting',
                    'soon', 'later', 'pending', 'ongoing', 'in progress'
                ]
                if any(pattern in due_date_lower for pattern in invalid_patterns):
                    due_date = None
                # Also reject if it doesn't contain digits (actual dates have numbers)
                elif not any(c.isdigit() for c in due_date):
                    due_date = None

            record = {
                'metadata_id': meeting_id,
                'description': description,
                'status': status,
                'assignee_name': owner,  # tasks use assignee_name
                'project_ids': [project_id] if project_id else [],
                'due_date': due_date,
                'priority': metadata.get('priority'),
            }
            table = 'tasks'
        else:
            continue  # Skip unknown types

        if dry_run:
            print(f"      [DRY RUN] {insight_type.upper()}: {description[:60]}...")
        else:
            try:
                client.table(table).insert(record).execute()
                saved[insight_type] = saved.get(insight_type, 0) + 1
            except Exception as e:
                print(f"      ❌ Error saving {insight_type}: {e}")

    return saved


async def process_meeting(
    client,
    meeting: Dict[str, Any],
    dry_run: bool = False,
    verbose: bool = False
) -> Dict[str, int]:
    """Process a single meeting and extract insights."""
    meeting_id = meeting['id']
    project_id = meeting.get('project_id')

    # Get project name
    project_name = "Unknown Project"
    if project_id:
        project = get_project(client, project_id)
        if project:
            project_name = project['name']

    meeting_title = meeting.get('title', 'Untitled Meeting')
    meeting_date = meeting.get('date')

    # Get transcript content - prefer full content over summary/overview
    transcript = meeting.get('content') or meeting.get('overview') or ''

    if not transcript:
        print(f"  ⚠️  No transcript content for meeting: {meeting_title}")
        return {'risk': 0, 'decision': 0, 'opportunity': 0, 'task': 0}

    print(f"\n  📝 Processing: {meeting_title}")
    print(f"     Project: {project_name}")
    print(f"     Date: {meeting_date}")
    print(f"     Transcript length: {len(transcript):,} chars")

    # Extract insights
    print(f"     Extracting insights...")
    insights = extract_insights_with_ai(
        project_name=project_name,
        meeting_title=meeting_title,
        meeting_date=str(meeting_date) if meeting_date else "Unknown",
        transcript=transcript
    )

    print(f"     Found {len(insights)} insights")

    # Count by type
    counts = {'risk': 0, 'decision': 0, 'opportunity': 0, 'task': 0}
    for insight in insights:
        insight_type = insight.get('type', 'risk')
        counts[insight_type] = counts.get(insight_type, 0) + 1

    if verbose:
        for insight in insights:
            confidence = insight.get('confidence', 0)
            print(f"      [{insight['type'].upper()}] ({confidence:.0%}) {insight['description'][:70]}...")

    # Save insights
    saved_counts = save_insights(client, insights, meeting_id, project_id, dry_run)

    if not dry_run:
        total_saved = sum(saved_counts.values())
        print(f"     ✓ Saved {total_saved} insights (R:{saved_counts['risk']} D:{saved_counts['decision']} O:{saved_counts['opportunity']} T:{saved_counts['task']})")

    return counts


async def main():
    parser = argparse.ArgumentParser(description='Extract insights from meeting transcripts')
    parser.add_argument('--meeting-id', type=str, help='Process a specific meeting')
    parser.add_argument('--project-id', type=int, help='Process meetings for a project')
    parser.add_argument('--unprocessed', action='store_true', help='Only process unprocessed meetings')
    parser.add_argument('--all-unprocessed', action='store_true', help='Process all unprocessed meetings')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be extracted')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')
    parser.add_argument('--limit', type=int, default=10, help='Max meetings to process')
    args = parser.parse_args()

    print("=" * 60)
    print("Meeting Insight Extractor")
    print("=" * 60)
    print("Extracts risks, decisions, opportunities, and tasks from meetings")

    if args.dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made\n")

    client = get_supabase_client()

    meetings_to_process = []

    if args.meeting_id:
        # Process single meeting
        meeting = get_meeting(client, args.meeting_id)
        if meeting:
            meetings_to_process = [meeting]
        else:
            print(f"❌ Meeting not found: {args.meeting_id}")
            return

    elif args.all_unprocessed:
        # Process all unprocessed meetings
        meetings_to_process = get_unprocessed_meetings(client, limit=args.limit)
        print(f"\nFound {len(meetings_to_process)} unprocessed meetings")

    elif args.project_id:
        if args.unprocessed:
            meetings_to_process = get_unprocessed_meetings(client, project_id=args.project_id, limit=args.limit)
        else:
            result = client.table('document_metadata').select(
                'id, title, date, project_id, content, overview'
            ).eq('project_id', args.project_id).not_.is_('content', 'null').order('date', desc=True).limit(args.limit).execute()
            meetings_to_process = result.data or []

        print(f"\nFound {len(meetings_to_process)} meetings for project {args.project_id}")

    else:
        print("❌ Please specify --meeting-id, --project-id, or --all-unprocessed")
        return

    if not meetings_to_process:
        print("No meetings to process.")
        return

    # Process meetings
    total_counts = {'risk': 0, 'decision': 0, 'opportunity': 0, 'task': 0}

    for meeting in meetings_to_process:
        try:
            counts = await process_meeting(client, meeting, args.dry_run, args.verbose)
            for key, value in counts.items():
                total_counts[key] = total_counts.get(key, 0) + value
        except Exception as e:
            print(f"  ❌ Error processing meeting {meeting.get('title')}: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("Extraction Summary")
    print("=" * 60)
    print(f"  Meetings processed:     {len(meetings_to_process)}")
    print(f"  Risks extracted:        {total_counts.get('risk', 0)}")
    print(f"  Decisions extracted:    {total_counts.get('decision', 0)}")
    print(f"  Opportunities extracted:{total_counts.get('opportunity', 0)}")
    print(f"  Tasks extracted:        {total_counts.get('task', 0)}")
    print(f"  Total insights:         {sum(total_counts.values())}")

    if args.dry_run:
        print("\n⚠️  This was a dry run. Run without --dry-run to actually save.")


if __name__ == '__main__':
    asyncio.run(main())
