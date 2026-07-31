#!/usr/bin/env python3
"""
Test script for the embedding generation API endpoint
"""

import requests
import json
import time

# Configuration
API_BASE_URL = "http://localhost:8051"  # Adjust if your API runs on a different port
ADMIN_API_URL = f"{API_BASE_URL}/api/admin"

def test_pipeline_stats():
    """Test getting pipeline statistics"""
    print("Testing pipeline statistics...")
    try:
        response = requests.get(f"{ADMIN_API_URL}/documents/pipeline-stats")
        if response.status_code == 200:
            stats = response.json()
            print("✅ Pipeline Statistics:")
            print(f"   Stage counts: {stats.get('stage_counts', {})}")
            print(f"   Total documents: {stats.get('total_documents', 0)}")
            return True
        else:
            print(f"❌ Failed to get stats: {response.status_code} - {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API. Is the server running on port 8051?")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_trigger_embeddings():
    """Test triggering embedding generation"""
    print("\nTesting embedding generation trigger...")
    try:
        payload = {
            "stage": "raw_ingested",
            "limit": 5,
            "skip_extraction": False,
            "skip_embedding": False
        }
        
        response = requests.post(
            f"{ADMIN_API_URL}/documents/generate-embeddings",
            json=payload
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Embedding generation response:")
            print(f"   Status: {result.get('status')}")
            print(f"   Message: {result.get('message')}")
            print(f"   Task ID: {result.get('task_id')}")
            
            # Check task status if task was started
            if result.get('task_id'):
                time.sleep(2)  # Wait a bit
                check_task_status(result['task_id'])
            
            return True
        else:
            print(f"❌ Failed to trigger embeddings: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def check_task_status(task_id):
    """Check the status of an embedding task"""
    print(f"\nChecking status of task {task_id}...")
    try:
        response = requests.get(f"{ADMIN_API_URL}/documents/embedding-status/{task_id}")
        if response.status_code == 200:
            status = response.json()
            print(f"✅ Task status:")
            print(f"   Status: {status.get('status')}")
            if status.get('stdout'):
                print(f"   Output: {status.get('stdout')[:200]}...")
            if status.get('stderr'):
                print(f"   Errors: {status.get('stderr')[:200]}...")
        else:
            print(f"❌ Failed to get task status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking task status: {e}")

def main():
    print("=" * 60)
    print("Embedding API Test Script")
    print("=" * 60)
    
    # Test 1: Get pipeline statistics
    stats_ok = test_pipeline_stats()
    
    # Test 2: Trigger embedding generation
    if stats_ok:
        test_trigger_embeddings()
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)
    
    print("\nIf the API is not running, start it with:")
    print("cd backend && source venv/bin/activate && python -m uvicorn src.api.main:app --reload --port 8051")

if __name__ == "__main__":
    main()