#!/usr/bin/env python3
"""
Update document_metadata status for documents that have completed processing
"""
import os
import sys
from pathlib import Path

# Add parent directories to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))  # src

# Load environment variables from root
from services.env_loader import load_env
load_env()

from services.supabase_helpers import get_supabase_client


def update_document_status():
    """Update status for documents based on their processing state."""
    print("=== Updating Document Status ===\n")
    
    client = get_supabase_client()
    
    # First, let's update documents where ingestion job is marked 'done'
    print("1. Updating documents with 'done' ingestion jobs...")
    done_jobs = client.table('fireflies_ingestion_jobs').select('metadata_id').eq('stage', 'done').execute()
    done_metadata_ids = [job['metadata_id'] for job in done_jobs.data if job.get('metadata_id')]
    
    if done_metadata_ids:
        # Update in batches
        batch_size = 50
        updated_count = 0
        
        for i in range(0, len(done_metadata_ids), batch_size):
            batch = done_metadata_ids[i:i+batch_size]
            result = client.table('document_metadata').update({'status': 'complete'}).in_('id', batch).neq('status', 'complete').execute()
            updated_count += len(result.data)
        
        print(f"   Updated {updated_count} documents to 'complete' status based on job status")
    
    # Check documents at 'embedded' status that have extracted data
    print("\n2. Checking documents at 'embedded' status...")
    embedded_docs = client.table('document_metadata').select('id').eq('status', 'embedded').execute()
    
    embedded_with_extracts = []
    for doc in embedded_docs.data:
        # Check if it has any decisions, risks, or opportunities
        decisions = client.table('decisions').select('id').eq('metadata_id', doc['id']).limit(1).execute()
        risks = client.table('risks').select('id').eq('metadata_id', doc['id']).limit(1).execute()
        opportunities = client.table('opportunities').select('id').eq('metadata_id', doc['id']).limit(1).execute()
        
        if decisions.data or risks.data or opportunities.data:
            embedded_with_extracts.append(doc['id'])
    
    if embedded_with_extracts:
        # Update these to complete
        result = client.table('document_metadata').update({'status': 'complete'}).in_('id', embedded_with_extracts).execute()
        print(f"   Updated {len(result.data)} documents from 'embedded' to 'complete'")
    else:
        print("   No embedded documents with extracted data found")
    
    # Check documents at 'segmented' status that have segments with embeddings
    print("\n3. Checking documents at 'segmented' status...")
    segmented_docs = client.table('document_metadata').select('id').eq('status', 'segmented').execute()
    
    segmented_with_embeddings = []
    for doc in segmented_docs.data[:50]:  # Check first 50 to avoid timeout
        # Check if it has segments with embeddings
        segments = client.table('meeting_segments').select('summary_embedding').eq('metadata_id', doc['id']).not_.is_('summary_embedding', 'null').limit(1).execute()
        
        if segments.data:
            segmented_with_embeddings.append(doc['id'])
    
    if segmented_with_embeddings:
        # Update these to embedded
        result = client.table('document_metadata').update({'status': 'embedded'}).in_('id', segmented_with_embeddings).execute()
        print(f"   Updated {len(result.data)} documents from 'segmented' to 'embedded'")
    
    # Final status check
    print("\n=== Final Status Distribution ===")
    result = client.table('document_metadata').select('status').execute()
    status_counts = {}
    for doc in result.data:
        status = doc.get('status') or 'NULL'
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print(f"Total documents: {len(result.data)}")
    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count}")


if __name__ == "__main__":
    update_document_status()