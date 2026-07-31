#!/usr/bin/env python3
"""
Generate AI-powered project summaries for all projects with meetings using GPT-4o.

Usage:
    cd backend
    source venv/bin/activate
    PYTHONPATH="src" python scripts/generate_project_summaries_batch.py
    PYTHONPATH="src" python scripts/generate_project_summaries_batch.py --project-id 67
    PYTHONPATH="src" python scripts/generate_project_summaries_batch.py --update

This script:
1. Fetches all projects with associated meeting documents (document_metadata)
2. For each project, aggregates meeting content (transcripts, summaries, action items)
3. Uses GPT-4o to generate a comprehensive, data-driven project summary
4. Optionally updates the project's summary field in Supabase
"""

import argparse
import asyncio
import os
import sys
from typing import Optional, List, Dict
from datetime import datetime

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


SUMMARY_PROMPT = """You are an AI Chief of Staff analyzing meeting documents for a construction/engineering project.

Based on the meeting documents below, generate a comprehensive project summary with SPECIFIC, DATA-DRIVEN insights.

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
CLIENT: {client}
PHASE: {phase}

MEETING DOCUMENTS:
{documents}

Generate a detailed, data-driven project summary (2-4 paragraphs):"""


def get_projects_with_meetings(client) -> List[Dict]:
    """Fetch all projects that have associated meeting documents."""
    # Get projects with their document count
    result = client.table('projects').select(
        'id, name, summary, client, phase, project_manager'
    ).execute()

    projects = result.data or []

    # Filter to only projects with meetings
    projects_with_meetings = []
    for project in projects:
        # Check if project has any document_metadata entries
        docs = client.table('document_metadata').select(
            'id', count='exact'
        ).eq('project_id', project['id']).limit(1).execute()

        if docs.count and docs.count > 0:
            projects_with_meetings.append(project)

    return projects_with_meetings


def get_project_info(client, project_id: int) -> Optional[dict]:
    """Fetch project details."""
    result = client.table('projects').select(
        'id, name, summary, client, phase, project_manager'
    ).eq('id', project_id).single().execute()
    return result.data


def get_meeting_documents(client, project_id: int, limit: int = 50) -> List[Dict]:
    """Fetch meeting documents for a project."""
    docs_result = client.table('document_metadata').select(
        'id, title, date, summary, content, overview, action_items, bullet_points, participants'
    ).eq('project_id', project_id).order('date', desc=True).limit(limit).execute()

    return docs_result.data or []


def generate_summary_with_gpt5(project_name: str, client: str, phase: str, documents: str) -> str:
    """Generate summary using GPT-4o."""
    openai_client = OpenAI()

    prompt = SUMMARY_PROMPT.format(
        project_name=project_name,
        client=client or "Unknown",
        phase=phase or "Unknown",
        documents=documents
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
        client.table('projects').update({
            'summary': summary
        }).eq('id', project_id).execute()
        return True
    except Exception as e:
        print(f"Error updating summary: {e}")
        return False


async def process_project(supabase, project: Dict, update: bool = False, max_documents: int = 30):
    """Process a single project to generate its summary."""
    project_id = project['id']
    project_name = project['name']

    print(f"\n{'='*80}")
    print(f"Processing Project: {project_name} (ID: {project_id})")
    print(f"{'='*80}")
    print(f"Client: {project.get('client', 'Unknown')}")
    print(f"Phase: {project.get('phase', 'Unknown')}")
    print(f"Project Manager: {project.get('project_manager', 'Unknown')}")

    if project.get('summary'):
        print(f"\nCurrent Summary: {project['summary'][:150]}...")

    # Get meeting documents
    print(f"\nFetching meeting documents...")
    documents = get_meeting_documents(supabase, project_id, limit=max_documents)
    print(f"Found {len(documents)} documents")

    if not documents:
        print("⚠ No documents found for this project. Skipping.")
        return None

    # Build document text for analysis
    document_parts = []
    for doc in documents:
        title = doc.get('title', 'Untitled Document')
        date = doc.get('date', 'Unknown date')

        # Aggregate all available content
        parts = []

        # Use overview first (most concise), then content
        if doc.get('overview'):
            parts.append(f"Overview: {doc['overview']}")
        elif doc.get('content'):
            content = doc['content']
            # Truncate very long content
            if len(content) > 5000:
                content = content[:5000] + "\n[... content truncated ...]"
            parts.append(f"Content: {content}")

        if doc.get('summary'):
            parts.append(f"Summary: {doc['summary']}")

        if doc.get('action_items'):
            parts.append(f"Action Items: {doc['action_items']}")

        if doc.get('bullet_points'):
            parts.append(f"Key Points: {doc['bullet_points']}")

        if doc.get('participants'):
            parts.append(f"Participants: {doc['participants']}")

        if parts:
            document_parts.append(f"""
--- DOCUMENT: {title} ({date}) ---
{chr(10).join(parts)}
""")

    if not document_parts:
        print("⚠ No content found in documents. Skipping.")
        return None

    documents_text = "\n".join(document_parts)
    print(f"Total content length: {len(documents_text):,} characters")

    # Truncate if too long for context window
    max_chars = 100000  # GPT-4o context window limit
    if len(documents_text) > max_chars:
        print(f"Truncating to {max_chars:,} characters...")
        documents_text = documents_text[:max_chars]

    # Generate summary
    print(f"\nGenerating summary with GPT-4o...")
    try:
        new_summary = generate_summary_with_gpt5(
            project_name,
            project.get('client', ''),
            project.get('phase', ''),
            documents_text
        )
    except Exception as e:
        print(f"✗ Error generating summary: {e}")
        return None

    print(f"\n{'='*80}")
    print("GENERATED SUMMARY:")
    print(f"{'='*80}")
    print(new_summary)
    print(f"{'='*80}\n")

    if update:
        print("Updating project summary in database...")
        if update_project_summary(supabase, project_id, new_summary):
            print("✓ Summary updated successfully!")
        else:
            print("✗ Failed to update summary")

    return new_summary


async def main():
    parser = argparse.ArgumentParser(
        description='Generate AI project summaries from meeting documents using GPT-4o'
    )
    parser.add_argument(
        '--project-id',
        type=int,
        help='Specific project ID to process (optional, processes all if not specified)'
    )
    parser.add_argument(
        '--update',
        action='store_true',
        help='Update the summaries in database'
    )
    parser.add_argument(
        '--max-documents',
        type=int,
        default=30,
        help='Maximum documents to analyze per project'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run without updating database (same as not using --update)'
    )
    args = parser.parse_args()

    print(f"\n{'='*80}")
    print(f"Project Summary Generator (GPT-4o)")
    print(f"{'='*80}\n")

    supabase = get_supabase_client()

    # Determine which projects to process
    if args.project_id:
        # Process single project
        project = get_project_info(supabase, args.project_id)
        if not project:
            print(f"Error: Project {args.project_id} not found")
            return
        projects = [project]
    else:
        # Process all projects with meetings
        print("Fetching all projects with meetings...")
        projects = get_projects_with_meetings(supabase)
        print(f"Found {len(projects)} projects with meetings\n")

    if not projects:
        print("No projects to process.")
        return

    # Process each project
    results = []
    for i, project in enumerate(projects, 1):
        print(f"\n[{i}/{len(projects)}]")
        summary = await process_project(
            supabase,
            project,
            update=args.update and not args.dry_run,
            max_documents=args.max_documents
        )
        if summary:
            results.append({
                'project_id': project['id'],
                'project_name': project['name'],
                'summary': summary
            })

        # Small delay between projects to avoid rate limits
        if i < len(projects):
            await asyncio.sleep(1)

    # Final summary
    print(f"\n{'='*80}")
    print("BATCH PROCESSING COMPLETE")
    print(f"{'='*80}")
    print(f"Processed: {len(results)} / {len(projects)} projects")
    if not args.update or args.dry_run:
        print("\n⚠ Dry run mode - no summaries were saved to database.")
        print("To save summaries, run with --update flag")


if __name__ == '__main__':
    asyncio.run(main())
