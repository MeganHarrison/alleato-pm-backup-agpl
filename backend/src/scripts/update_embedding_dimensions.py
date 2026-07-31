#!/usr/bin/env python3
"""Update the database schema to use 1536-dimensional embeddings"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

from supabase import create_client

def update_embedding_dimensions():
    print("Updating embedding dimensions from 3072 to 1536...")
    print("WARNING: This will remove all existing embeddings!\n")
    
    # Confirm action
    response = input("Do you want to proceed? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration cancelled.")
        return
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return
    
    client = create_client(url, key)
    
    try:
        # Read the migration SQL
        sql_file = Path(__file__).parent.parent / 'sql' / 'update_embedding_dimensions.sql'
        if not sql_file.exists():
            print(f"Error: SQL file not found at {sql_file}")
            return
            
        with open(sql_file, 'r') as f:
            sql_commands = f.read()
        
        # Split into individual statements (crude but works for this case)
        statements = [s.strip() for s in sql_commands.split(';') if s.strip() and not s.strip().startswith('--')]
        
        print(f"\nExecuting {len(statements)} SQL statements...")
        
        # Execute each statement
        for i, statement in enumerate(statements, 1):
            if 'SELECT' in statement and 'information_schema' in statement:
                # This is the verification query
                result = client.rpc('execute_sql', {'query': statement}).execute()
                print(f"\nStatement {i}: Verification query")
                if result.data:
                    print("Column info:", result.data)
            else:
                # For DDL statements, we need to use raw SQL execution
                # Supabase Python client doesn't support DDL directly
                print(f"\nStatement {i}: {statement[:50]}...")
                
                # We'll use the execute_sql RPC function if it exists
                try:
                    client.rpc('execute_sql', {'query': statement}).execute()
                    print("✓ Success")
                except Exception as e:
                    if 'execute_sql' in str(e):
                        print("⚠️  execute_sql RPC not available. Please run the SQL manually in Supabase SQL editor.")
                        print("\nSQL to run:")
                        print("-" * 60)
                        print(statement)
                        print("-" * 60)
                    else:
                        print(f"✗ Error: {e}")
        
        print("\n" + "="*60)
        print("Migration steps completed!")
        print("="*60)
        
        # Check if we can verify the change
        try:
            # Try to check if the column exists
            test_result = client.table("document_chunks").select("chunk_id").limit(1).execute()
            print("\n✓ Database connection verified")
            
            print("\nNOTE: If execute_sql RPC is not available, please:")
            print("1. Go to Supabase Dashboard > SQL Editor")
            print("2. Copy and run the SQL from: sql/update_embedding_dimensions.sql")
            print("3. After running, re-ingest documents with embeddings")
            
        except Exception as e:
            print(f"\nCouldn't verify changes: {e}")
    
    except Exception as e:
        print(f"\nError during migration: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_embedding_dimensions()