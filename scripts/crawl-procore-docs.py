#!/usr/bin/env python3
"""
Script to crawl Procore documentation using the crawl4ai MCP server.
This will crawl https://support.procore.com/products/online/user-guide/project-level
up to 2 levels deep and store in Supabase.
"""

import asyncio
import sys
import os

# Add the MCP module path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'mcp-crawl4ai-rag', 'src'))

from crawl4ai_mcp import smart_crawl_url, Crawl4AIContext
from crawl4ai import AsyncWebCrawler, BrowserConfig
from utils import get_supabase_client


async def main():
    """Main crawl function."""
    print("Initializing crawler and Supabase client...")

    # Create browser configuration
    browser_config = BrowserConfig(
        headless=True,
        verbose=False
    )

    # Initialize the crawler
    crawler = AsyncWebCrawler(config=browser_config)
    await crawler.__aenter__()

    # Initialize Supabase client
    supabase_client = get_supabase_client()

    # Create context
    class MockRequestContext:
        def __init__(self, lifespan_context):
            self.lifespan_context = lifespan_context

    class MockContext:
        def __init__(self, request_context):
            self.request_context = request_context

    lifespan_context = Crawl4AIContext(
        crawler=crawler,
        supabase_client=supabase_client,
        reranking_model=None,
        knowledge_validator=None,
        repo_extractor=None
    )

    request_context = MockRequestContext(lifespan_context)
    ctx = MockContext(request_context)

    try:
        print("\nStarting crawl of Procore documentation...")
        print("URL: https://support.procore.com/products/online/user-guide/project-level")
        print("Max depth: 2 levels")
        print("Max concurrent: 5 sessions\n")

        # Call the smart_crawl_url function
        result = await smart_crawl_url(
            ctx=ctx,
            url="https://support.procore.com/products/online/user-guide/project-level",
            max_depth=2,
            max_concurrent=5,
            chunk_size=5000
        )

        print("\n" + "="*80)
        print("CRAWL RESULT:")
        print("="*80)
        print(result)
        print("="*80)

    finally:
        # Clean up
        await crawler.__aexit__(None, None, None)
        print("\nCrawler shut down successfully.")


if __name__ == "__main__":
    asyncio.run(main())
