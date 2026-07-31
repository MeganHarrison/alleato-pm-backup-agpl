#!/usr/bin/env python3
"""Update documents to complete where ingestion job is done"""

import sys
from pathlib import Path

# Add parent directories to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))  # src

# Load environment variables from root
from services.env_loader import load_env
load_env()

from services.supabase_helpers import get_supabase_client

client = get_supabase_client()

# Check done jobs that aren't marked complete
jobs = client.table('fireflies_ingestion_jobs').select('metadata_id').eq('stage', 'done').execute()
done_ids = [j['metadata_id'] for j in jobs.data if j.get('metadata_id')]

print(f"Found {len(done_ids)} jobs with stage 'done'")

# Check their document status
docs = client.table('document_metadata').select('id, status').in_('id', done_ids).execute()

status_counts = {}
for doc in docs.data:
    status = doc.get('status', 'NULL')
    status_counts[status] = status_counts.get(status, 0) + 1

print('\n=== Documents with DONE ingestion jobs ===')
print(f'Total: {len(docs.data)}')
for status, count in sorted(status_counts.items()):
    print(f'  Status "{status}": {count}')

# Update any that aren't complete
not_complete = [doc['id'] for doc in docs.data if doc.get('status') != 'complete']
if not_complete:
    print(f'\nUpdating {len(not_complete)} documents to complete...')
    result = client.table('document_metadata').update({'status': 'complete'}).in_('id', not_complete).execute()
    print(f'Updated: {len(result.data)} documents')
    
    # Final check
    print('\n=== After Update ===')
    final = client.table('document_metadata').select('status').execute()
    complete_count = len([d for d in final.data if d.get('status') == 'complete'])
    print(f'Total complete documents: {complete_count}/{len(final.data)}')
else:
    print('\nAll done jobs already have complete status!')