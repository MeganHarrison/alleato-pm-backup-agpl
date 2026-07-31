#!/usr/bin/env python3
"""
Comprehensive fix for document_metadata status based on actual processing state
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


def fix_document_statuses():
    """Fix document statuses based on actual data presence."""
    print("=== Comprehensive Document Status Fix ===\n")
    
    client = get_supabase_client()
    
    # Get all documents
    all_docs = client.table('document_metadata').select('id, status').execute()
    print(f"Total documents: {len(all_docs.data)}")
    
    updates_made = {
        'to_complete': 0,
        'to_embedded': 0,
        'to_segmented': 0,
    }
    
    # Process in batches to avoid timeout
    batch_size = 50
    for i in range(0, len(all_docs.data), batch_size):
        batch = all_docs.data[i:i+batch_size]
        print(f"\nProcessing batch {i//batch_size + 1} ({i}-{min(i+batch_size, len(all_docs.data))})")
        
        for doc in batch:
            doc_id = doc['id']
            current_status = doc.get('status')
            
            # Skip if already complete
            if current_status == 'complete':
                continue
            
            # Check what data exists for this document
            has_segments = False
            has_embeddings = False
            has_extracts = False
            
            # Check for segments
            segments = client.table('meeting_segments').select('id, summary_embedding').eq('metadata_id', doc_id).limit(5).execute()
            if segments.data:
                has_segments = True
                # Check if segments have embeddings
                if any(seg.get('summary_embedding') is not None for seg in segments.data):
                    has_embeddings = True
            
            # Check for extracted data (decisions, risks, opportunities)
            decisions = client.table('decisions').select('id').eq('metadata_id', doc_id).limit(1).execute()
            risks = client.table('risks').select('id').eq('metadata_id', doc_id).limit(1).execute()
            opportunities = client.table('opportunities').select('id').eq('metadata_id', doc_id).limit(1).execute()
            
            if decisions.data or risks.data or opportunities.data:
                has_extracts = True
            
            # Determine correct status
            new_status = current_status
            if has_extracts or (has_embeddings and has_segments):
                new_status = 'complete'
                updates_made['to_complete'] += 1
            elif has_embeddings:
                new_status = 'embedded'
                updates_made['to_embedded'] += 1
            elif has_segments:
                new_status = 'segmented'
                updates_made['to_segmented'] += 1
            
            # Update if needed
            if new_status != current_status and new_status:
                try:
                    client.table('document_metadata').update({'status': new_status}).eq('id', doc_id).execute()
                    print(f"  Updated {doc_id[:8]}... from '{current_status}' to '{new_status}'")
                except Exception as e:
                    print(f"  Error updating {doc_id[:8]}...: {e}")
    
    print(f"\n=== Update Summary ===")
    print(f"Documents updated to 'complete': {updates_made['to_complete']}")
    print(f"Documents updated to 'embedded': {updates_made['to_embedded']}")
    print(f"Documents updated to 'segmented': {updates_made['to_segmented']}")
    
    # Final status check
    print("\n=== Final Status Distribution ===")
    result = client.table('document_metadata').select('status').execute()
    status_counts = {}
    for doc in result.data:
        status = doc.get('status') or 'NULL'
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print(f"Total documents: {len(result.data)}")
    for status, count in sorted(status_counts.items()):
        percentage = (count / len(result.data)) * 100
        print(f"  {status}: {count} ({percentage:.1f}%)")


if __name__ == "__main__":
    fix_document_statuses()