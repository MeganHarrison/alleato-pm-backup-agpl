#!/usr/bin/env python3
"""
Generate AI-powered project summary from meeting transcripts.

Usage:
    cd backend
    source venv/bin/activate
    PYTHONPATH="src" python scripts/generate_project_summary.py --project-id 67

This script:
1. Fetches all meeting transcripts for a project
2. Sends them to an LLM to generate a comprehensive summary
3. Optionally updates the project's summary field in Supabase
"""

import argparse
import asyncio
import os
import sys
from typing import Optional

# Add canonical backend src path for imports. Retired worker package paths must
# not be reintroduced; background ingestion now lives under src/services.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Load environment variables
from dotenv import load_dotenv

# Try multiple locations for .env
env_locations = [
    os.path.join(os.path.dirname(__file__), '..', '..', '.env'),
    os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'),
    os.path.join(os.path.dirname(__file__), '..', '.env'),
    os.path.join(os.path.dirname(__file__), '..', '.env.local'),
]

for env_path in env_locations:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded env from: {env_path}")
        break

from openai import OpenAI
from services.supabase_helpers import get_supabase_client


SUMMARY_PROMPT = """You are an AI Chief of Staff analyzing meeting transcripts for a construction/engineering project.

Based on the meeting transcripts below, generate a comprehensive project summary with SPECIFIC, DATA-DRIVEN insights.

Your analysis MUST include:

1. **Project Overview**: What is this project about? What's being built/delivered? What is the scope?

2. **Key Stakeholders**: Who are the main people involved? List specific names and their roles mentioned in the meetings.

3. **Current Status**: What phase is the project in? What milestones have been completed? What work is currently in progress?

4. **Critical Issues & Risks**:
   - Identify SPECIFIC risks mentioned in the meetings (e.g., "Structural steel delivery delayed by 3 weeks", "Budget overrun of $450K on foundation work")
   - Look for schedule delays, cost overruns, design issues, permitting problems, subcontractor performance issues
   - Quote specific concerns raised by team members
   - Flag any recurring themes or patterns across multiple meetings
   - If NO specific risks are mentioned, state "No specific risks identified in recent meetings" rather than providing generic risks

5. **Recent Decisions**: What concrete decisions have been made? List specific action items, scope changes, or direction changes.

6. **Next Steps**: What are the immediate priorities? What deadlines are approaching?

CRITICAL: Be SPECIFIC. Reference actual data points, names, numbers, and dates from the meetings. Avoid generic statements like "there may be delays" - instead say "John mentioned 2-week delay on electrical rough-in due to inspector availability" or similar concrete details.

If certain information is not available in the meetings, explicitly state "Not discussed in recent meetings" rather than making assumptions.

PROJECT NAME: {project_name}

MEETING TRANSCRIPTS:
{transcripts}

Generate a detailed, data-driven project summary (2-4 paragraphs):"""


def get_project_info(client, project_id: int) -> Optional[dict]:
    """Fetch project details."""
    result = client.table('projects').select('id, name, summary, client, phase, project_manager').eq('id', project_id).single().execute()
    return result.data


def get_meeting_transcripts(client, project_id: int, limit: int = 20) -> list:
    """Fetch meeting transcripts for a project."""
    # Pull transcript-bearing columns from document_metadata directly. `content`
    # holds the full transcript; `raw_text` is the fallback for older rows.
    docs_result = client.table('document_metadata').select(
        'id, title, date, summary, content, overview, raw_text'
    ).eq('project_id', project_id).order('date', desc=True).limit(limit).execute()

    return docs_result.data or []




def generate_summary_with_openai(project_name: str, transcripts: str) -> str:
    """Generate summary using OpenAI GPT-4o."""
    openai_client = OpenAI()

    prompt = SUMMARY_PROMPT.format(
        project_name=project_name,
        transcripts=transcripts
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert project analyst specializing in construction and engineering projects. You create clear, actionable summaries for executives. Always provide specific, data-driven insights based on the actual meeting content."},
            {"role": "user", "content": prompt}
        ],
        max_completion_tokens=2000,
        temperature=0.7
    )

    return response.choices[0].message.content


def update_project_summary(client, project_id: int, summary: str) -> bool:
    """Update the project summary in Supabase."""
    try:
        client.table('projects').update({'summary': summary}).eq('id', project_id).execute()
        return True
    except Exception as e:
        print(f"Error updating summary: {e}")
        return False


async def main():
    parser = argparse.ArgumentParser(description='Generate AI project summary from meeting transcripts')
    parser.add_argument('--project-id', type=int, required=True, help='Project ID to summarize')
    parser.add_argument('--update', action='store_true', help='Update the summary in database')
    parser.add_argument('--max-meetings', type=int, default=10, help='Maximum meetings to analyze')
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"Project Summary Generator")
    print(f"{'='*60}\n")

    supabase = get_supabase_client()

    # Get project info
    project = get_project_info(supabase, args.project_id)
    if not project:
        print(f"Error: Project {args.project_id} not found")
        return

    print(f"Project: {project['name']} (ID: {project['id']})")
    print(f"Phase: {project.get('phase', 'Unknown')}")
    print(f"Client: {project.get('client', 'Unknown')}")
    print(f"Project Manager: {project.get('project_manager', 'Unknown')}")

    if project.get('summary'):
        print(f"\nCurrent Summary:")
        print(f"  {project['summary'][:200]}...")

    # Get meeting transcripts
    print(f"\nFetching meeting transcripts...")
    meetings = get_meeting_transcripts(supabase, args.project_id, limit=args.max_meetings)
    print(f"Found {len(meetings)} meetings")

    if not meetings:
        print("No meetings found for this project. Cannot generate summary.")
        return

    # Build transcript text
    transcript_parts = []
    for meeting in meetings:
        title = meeting.get('title', 'Untitled Meeting')
        date = meeting.get('date', 'Unknown date')

        # Prefer overview (condensed) → content (full transcript) → raw_text (legacy ingest).
        content = (
            meeting.get('overview')
            or meeting.get('content')
            or meeting.get('raw_text')
            or ''
        )

        if content:
            # Truncate very long transcripts
            if len(content) > 8000:
                content = content[:8000] + "\n[... transcript truncated ...]"

            transcript_parts.append(f"""
--- MEETING: {title} ({date}) ---
{content}
""")
        elif meeting.get('summary'):
            transcript_parts.append(f"""
--- MEETING: {title} ({date}) ---
Summary: {meeting['summary']}
""")

    if not transcript_parts:
        print("No transcript content found. Cannot generate summary.")
        return

    transcripts_text = "\n".join(transcript_parts)
    print(f"\nTotal transcript length: {len(transcripts_text):,} characters")

    # Truncate if too long for context window
    max_chars = 100000
    if len(transcripts_text) > max_chars:
        print(f"Truncating to {max_chars:,} characters...")
        transcripts_text = transcripts_text[:max_chars]

    # Generate summary
    print(f"\nGenerating summary with GPT-4o...")
    try:
        new_summary = generate_summary_with_openai(project['name'], transcripts_text)
    except Exception as e:
        print(f"Error generating summary: {e}")
        return

    print(f"\n{'='*60}")
    print("GENERATED SUMMARY:")
    print(f"{'='*60}")
    print(new_summary)
    print(f"{'='*60}\n")

    if args.update:
        print("Updating project summary in database...")
        if update_project_summary(supabase, args.project_id, new_summary):
            print("✓ Summary updated successfully!")
        else:
            print("✗ Failed to update summary")
    else:
        print("To save this summary, run with --update flag")


if __name__ == '__main__':
    asyncio.run(main())
