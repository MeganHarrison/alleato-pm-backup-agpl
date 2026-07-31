import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.services import url_resource_ingestion as module


def _response(url: str, html: str, content_type: str = "text/html; charset=utf-8", status_code: int = 200):
    return SimpleNamespace(
        url=url,
        text=html,
        status_code=status_code,
        headers={"content-type": content_type},
    )


def test_url_resource_ingestion_dry_run_normalizes_and_extracts(monkeypatch):
    html = """
    <html>
      <head>
        <title>Alleato URL Test</title>
        <meta name="description" content="Verification description" />
      </head>
      <body>
        <main>
          <p>This is a long enough paragraph to pass extraction thresholds.</p>
          <p>It contains enough readable content for the generic document parser path.</p>
          <p>The service should normalize tracking parameters and preserve the original URL.</p>
        </main>
      </body>
    </html>
    """
    monkeypatch.setattr(module.requests, "get", lambda *args, **kwargs: _response("https://example.com/path?x=1", html))
    store = MagicMock()
    store.fetch_rag_document_metadata.return_value = {}
    service = module.UrlResourceIngestionService(store=store)

    result = service.ingest_url(
        "https://example.com/path/?utm_source=test&x=1#fragment",
        project_id=876,
        dry_run=True,
        run_pipeline=False,
    )

    assert result["status"] == "dry_run"
    assert result["normalized_url"] == "https://example.com/path?x=1"
    assert result["document_id"].startswith("web_resource_")
    assert result["title"] == "Alleato URL Test"
    store.upsert_document_metadata.assert_not_called()


def test_url_resource_ingestion_skips_unchanged_hash(monkeypatch):
    html = """
    <html><body><main>
      <p>Readable content for unchanged hash testing.</p>
      <p>Enough content to satisfy extraction length guardrails.</p>
      <p>Duplicate URL submissions should skip expensive reprocessing.</p>
    </main></body></html>
    """
    monkeypatch.setattr(module.requests, "get", lambda *args, **kwargs: _response("https://example.com/docs", html))
    store = MagicMock()
    service = module.UrlResourceIngestionService(store=store)
    extraction = service._fetch_and_extract("https://example.com/docs")
    store.fetch_rag_document_metadata.return_value = {"content_hash": extraction.content_hash}

    result = service.ingest_url("https://example.com/docs", run_pipeline=False)

    assert result["status"] == "skipped_unchanged"
    assert "same content hash" in result["reason"]
    store.upsert_document_metadata.assert_not_called()


def test_url_resource_ingestion_writes_metadata_and_runs_pipeline(monkeypatch):
    html = """
    <html>
      <head><title>Resource Page</title></head>
      <body>
        <article>
          <p>First paragraph with enough content for resource ingestion.</p>
          <p>Second paragraph keeps the extract above the minimum threshold.</p>
          <p>Third paragraph proves this should land in the existing document chunk path.</p>
        </article>
      </body>
    </html>
    """
    monkeypatch.setattr(module.requests, "get", lambda *args, **kwargs: _response("https://example.com/resource", html))
    monkeypatch.setattr(
        module,
        "enqueue_document_workflow",
        lambda metadata_id, **kwargs: {
            "status": "queued",
            "documentId": metadata_id,
            "runId": "run-1",
        },
    )
    update_state = MagicMock()
    monkeypatch.setattr(module, "update_ingestion_job_state", update_state)

    store = MagicMock()
    store.fetch_rag_document_metadata.side_effect = [
        {},
        {
            "category": "resource",
            "type": "web_page",
            "source_web_url": "https://example.com/resource",
            "url": "https://example.com/resource",
            "content_hash": "final-hash",
        },
    ]
    store.query_chunks.return_value = [{"chunk_id": "c1"}, {"chunk_id": "c2"}]

    service = module.UrlResourceIngestionService(store=store)
    result = service.ingest_url("https://example.com/resource", project_id=123, run_pipeline=True)

    assert result["status"] == "ingested"
    assert result["pipeline_status"] == "queued"
    assert result["chunk_count"] == 2
    payload = store.upsert_document_metadata.call_args.args[0]
    assert payload["category"] == "resource"
    assert payload["type"] == "web_page"
    assert payload["source_web_url"] == "https://example.com/resource"
    assert payload["url"] == "https://example.com/resource"
    assert payload["project_id"] == 123
    update_state.assert_called_once()
