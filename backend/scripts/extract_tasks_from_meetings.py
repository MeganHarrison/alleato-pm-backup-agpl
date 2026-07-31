#!/usr/bin/env python3
"""
Extract actionable tasks from meeting documents using GPT-5.4.

Usage:
    cd backend
    source venv/bin/activate
    PYTHONPATH="src" python scripts/extract_tasks_from_meetings.py
    PYTHONPATH="src" python scripts/extract_tasks_from_meetings.py --project-id 67
    PYTHONPATH="src" python scripts/extract_tasks_from_meetings.py --update

This script:
1. Fetches all projects with meeting documents (document_metadata)
2. Analyzes meeting content to extract actionable tasks
3. Uses GPT-5.4 to parse action items, decisions, and commitments
4. Outputs structured task data (can be saved to database or exported)
"""

import argparse
import asyncio
import json
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


TASK_EXTRACTION_PROMPT = """You are an AI project management assistant analyzing meeting documents to extract actionable tasks.

Based on the meeting documents below, extract ALL actionable tasks, action items, commitments, and deliverables.

For each task, provide:
1. **Title**: Clear, actionable task description (start with verb: "Complete...", "Review...", "Submit...")
2. **Assignee**: Person responsible (if mentioned, otherwise "Unassigned")
3. **Due Date**: Deadline or timeframe (if mentioned, otherwise "TBD")
4. **Priority**: High, Medium, or Low (infer from context)
5. **Status**: Not Started, In Progress, or Completed (infer from context)
6. **Context**: Brief note about why this task matters or where it came from
7. **Source**: Which meeting/document this came from (title and date)

Return the tasks as a JSON array with this structure:
```json
[
  {{
    "title": "Submit revised design drawings to client",
    "assignee": "John Smith",
    "due_date": "2025-01-15",
    "priority": "High",
    "status": "Not Started",
    "context": "Client requested changes to foundation design",
    "source": "Weekly Design Review - 2025-01-08"
  }}
]
```

PROJECT: {project_name}

MEETING DOCUMENTS:
{documents}

Extract all tasks as JSON:"""


def get_projects_with_meetings(client) -> List[Dict]:
    """Fetch all projects that have associated meeting documents."""
    result = client.table('projects').select(
        'id, name, client, phase, project_manager'
    ).execute()

    projects = result.data or []

    # Filter to only projects with meetings
    projects_with_meetings = []
    for project in projects:
        docs = client.table('document_metadata').select(
            'id', count='exact'
        ).eq('project_id', project['id']).limit(1).execute()

        if docs.count and docs.count > 0:
            projects_with_meetings.append(project)

    return projects_with_meetings


def get_project_info(client, project_id: int) -> Optional[dict]:
    """Fetch project details."""
    result = client.table('projects').select(
        'id, name, client, phase, project_manager'
    ).eq('id', project_id).single().execute()
    return result.data


def get_meeting_documents(client, project_id: int, limit: int = 20, days_back: int = 90) -> List[Dict]:
    """Fetch recent meeting documents for a project."""
    # Get documents from the last N days
    from datetime import timedelta, UTC
    cutoff_date = (datetime.now(UTC) - timedelta(days=days_back)).isoformat()

    docs_result = client.table('document_metadata').select(
        'id, title, date, summary, content, overview, action_items, bullet_points, participants'
    ).eq('project_id', project_id).gte('date', cutoff_date).order('date', desc=True).limit(limit).execute()

    return docs_result.data or []


def extract_tasks_with_gpt5(project_name: str, documents: str) -> List[Dict]:
    """Extract tasks using GPT-5.4."""
    openai_client = OpenAI()

    prompt = TASK_EXTRACTION_PROMPT.format(
        project_name=project_name,
        documents=documents
    )

    response = openai_client.chat.completions.create(
        model="gpt-5.4",
        messages=[
            {
                "role": "system",
                "content": "You are an expert project management assistant. Extract actionable tasks from meeting documents and return them as valid JSON."
            },
            {"role": "user", "content": prompt}
        ],
        max_completion_tokens=8000,  # Increased to allow for reasoning tokens
        temperature=0.5,
        response_format={"type": "json_object"}
    )

    content = response.choices[0].message.content

    # Debug: print response length
    print(f"Debug: Response length: {len(content) if content else 0} characters")

    if not content or content.strip() == "":
        print("Error: Empty response from GPT-5.4")
        print(f"Full response object: {response}")
        return []

    # Parse JSON response
    try:
        # GPT-5.4 might wrap in a JSON object, extract the array
        result = json.loads(content)
        if isinstance(result, dict) and 'tasks' in result:
            return result['tasks']
        elif isinstance(result, list):
            return result
        else:
            print(f"Warning: Unexpected JSON structure: {result}")
            return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print(f"Response content (first 500 chars): {content[:500]}")
        return []


def save_tasks_to_json(tasks: List[Dict], project_id: int, project_name: str, output_dir: str = "output"):
    """Save extracted tasks to a JSON file."""
    os.makedirs(output_dir, exist_ok=True)

    filename = f"{output_dir}/tasks_project_{project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    from datetime import UTC
    output = {
        "project_id": project_id,
        "project_name": project_name,
        "extracted_at": datetime.now(UTC).isoformat(),
        "task_count": len(tasks),
        "tasks": tasks
    }

    with open(filename, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"✓ Saved tasks to: {filename}")
    return filename


async def process_project(supabase, project: Dict, save_output: bool = False, days_back: int = 90, max_documents: int = 20):
    """Process a single project to extract tasks."""
    project_id = project['id']
    project_name = project['name']

    print(f"\n{'='*80}")
    print(f"Processing Project: {project_name} (ID: {project_id})")
    print(f"{'='*80}")

    # Get meeting documents
    print(f"Fetching meeting documents from last {days_back} days...")
    documents = get_meeting_documents(supabase, project_id, limit=max_documents, days_back=days_back)
    print(f"Found {len(documents)} documents")

    if not documents:
        print("⚠ No documents found for this project. Skipping.")
        return None

    # Build document text for analysis
    document_parts = []
    for doc in documents:
        title = doc.get('title', 'Untitled Document')
        date = doc.get('date', 'Unknown date')

        # Aggregate content focused on action items
        parts = []

        # Prioritize action items and bullet points
        if doc.get('action_items'):
            parts.append(f"Action Items: {doc['action_items']}")

        if doc.get('bullet_points'):
            parts.append(f"Key Points: {doc['bullet_points']}")

        if doc.get('summary'):
            parts.append(f"Summary: {doc['summary']}")

        # Add overview/content if needed
        if doc.get('overview'):
            parts.append(f"Overview: {doc['overview']}")
        elif doc.get('content'):
            content = doc['content']
            # Truncate very long content
            if len(content) > 3000:
                content = content[:3000] + "\n[... truncated ...]"
            parts.append(f"Content: {content}")

        if doc.get('participants'):
            parts.append(f"Participants: {doc['participants']}")

        if parts:
            document_parts.append(f"""
--- MEETING: {title} ({date}) ---
{chr(10).join(parts)}
""")

    if not document_parts:
        print("⚠ No content found in documents. Skipping.")
        return None

    documents_text = "\n".join(document_parts)
    print(f"Total content length: {len(documents_text):,} characters")

    # Truncate if too long
    max_chars = 80000
    if len(documents_text) > max_chars:
        print(f"Truncating to {max_chars:,} characters...")
        documents_text = documents_text[:max_chars]

    # Extract tasks
    print(f"\nExtracting tasks with GPT-5.4...")
    try:
        tasks = extract_tasks_with_gpt5(project_name, documents_text)
    except Exception as e:
        print(f"✗ Error extracting tasks: {e}")
        return None

    if not tasks:
        print("⚠ No tasks extracted.")
        return None

    print(f"\n✓ Extracted {len(tasks)} tasks\n")

    # Display tasks
    print(f"{'='*80}")
    print("EXTRACTED TASKS:")
    print(f"{'='*80}\n")

    for i, task in enumerate(tasks, 1):
        print(f"{i}. {task.get('title', 'Untitled')}")
        print(f"   Assignee: {task.get('assignee', 'Unassigned')}")
        print(f"   Due: {task.get('due_date', 'TBD')}")
        print(f"   Priority: {task.get('priority', 'Medium')} | Status: {task.get('status', 'Not Started')}")
        if task.get('context'):
            print(f"   Context: {task.get('context')}")
        if task.get('source'):
            print(f"   Source: {task.get('source')}")
        print()

    # Save to file if requested
    if save_output:
        save_tasks_to_json(tasks, project_id, project_name)

    return tasks


async def main():
    parser = argparse.ArgumentParser(
        description='Extract actionable tasks from meeting documents using GPT-5.4'
    )
    parser.add_argument(
        '--project-id',
        type=int,
        help='Specific project ID to process (optional, processes all if not specified)'
    )
    parser.add_argument(
        '--save',
        action='store_true',
        help='Save extracted tasks to JSON files'
    )
    parser.add_argument(
        '--days-back',
        type=int,
        default=90,
        help='Number of days back to analyze (default: 90)'
    )
    parser.add_argument(
        '--max-documents',
        type=int,
        default=20,
        help='Maximum documents to analyze per project (default: 20)'
    )
    args = parser.parse_args()

    print(f"\n{'='*80}")
    print(f"Task Extraction from Meeting Documents (GPT-5.4)")
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
    all_tasks = []
    for i, project in enumerate(projects, 1):
        print(f"\n[{i}/{len(projects)}]")
        tasks = await process_project(
            supabase,
            project,
            save_output=args.save,
            days_back=args.days_back,
            max_documents=args.max_documents
        )
        if tasks:
            all_tasks.append({
                'project_id': project['id'],
                'project_name': project['name'],
                'tasks': tasks
            })

        # Small delay between projects to avoid rate limits
        if i < len(projects):
            await asyncio.sleep(1)

    # Final summary
    print(f"\n{'='*80}")
    print("BATCH PROCESSING COMPLETE")
    print(f"{'='*80}")

    total_tasks = sum(len(p['tasks']) for p in all_tasks)
    print(f"Processed: {len(all_tasks)} projects")
    print(f"Total tasks extracted: {total_tasks}")

    if args.save:
        print(f"\n✓ Task files saved to ./output/ directory")
    else:
        print(f"\n⚠ Tasks not saved. Use --save flag to save to JSON files")


if __name__ == '__main__':
    asyncio.run(main())
