import importlib
import sys
import types
from unittest.mock import MagicMock


def _stub_module(monkeypatch, name, function_name):
    module = types.ModuleType(name)
    function = MagicMock(return_value={"owner": function_name})
    setattr(module, function_name, function)
    monkeypatch.setitem(sys.modules, name, module)
    return function


def _load_stage_runner(monkeypatch):
    functions = {
        "run_document_parser": _stub_module(
            monkeypatch,
            "src.services.pipeline.document_parser",
            "run_document_parser",
        ),
        "run_embedder": _stub_module(
            monkeypatch,
            "src.services.pipeline.embedder",
            "run_embedder",
        ),
        "run_extractor": _stub_module(
            monkeypatch,
            "src.services.pipeline.extractor",
            "run_extractor",
        ),
        "run_financial_parser": _stub_module(
            monkeypatch,
            "src.services.pipeline.financial_parser",
            "run_financial_parser",
        ),
        "run_parser": _stub_module(
            monkeypatch,
            "src.services.pipeline.parser",
            "run_parser",
        ),
        "run_vision_analyzer": _stub_module(
            monkeypatch,
            "src.services.pipeline.vision_analyzer",
            "run_vision_analyzer",
        ),
    }

    helpers = types.ModuleType("src.services.supabase_helpers")
    helpers.get_supabase_client = MagicMock(return_value=MagicMock())
    helpers.get_rag_read_client = MagicMock(return_value=MagicMock())
    monkeypatch.setitem(sys.modules, "src.services.supabase_helpers", helpers)

    graph_embed = types.ModuleType(
        "src.services.integrations.microsoft_graph.embed",
    )
    graph_embed.embed_graph_document = MagicMock(return_value=4)
    monkeypatch.setitem(
        sys.modules,
        "src.services.integrations.microsoft_graph.embed",
        graph_embed,
    )

    sys.modules.pop("src.services.pipeline.stage_runner", None)
    module = importlib.import_module("src.services.pipeline.stage_runner")
    return module, functions, graph_embed


def test_graph_document_vision_is_owned_by_explicit_vision_stage(monkeypatch):
    stage_runner, functions, _graph_embed = _load_stage_runner(monkeypatch)
    monkeypatch.setattr(
        stage_runner,
        "_load_document",
        lambda _client, metadata_id: {
            "id": metadata_id,
            "category": "document",
            "file_name": "drawing.pdf",
            "source_system": "sharepoint",
            "status": "raw_ingested",
            "project_id": 67,
        },
    )

    result = stage_runner.run_pipeline_stage(
        "doc-1",
        "vision",
        source_type="sharepoint",
    )

    assert result["stage"] == "vision"
    assert "skipped" not in result
    functions["run_vision_analyzer"].assert_called_once()


def test_load_falls_back_to_rag_mirror_with_live_storage_schema(monkeypatch):
    stage_runner, _functions, _graph_embed = _load_stage_runner(monkeypatch)
    pm_client = MagicMock()
    pm_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    rag_client = MagicMock()
    rag_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": "doc-rag",
            "category": "email",
            "file_name": "message.txt",
            "storage_path": "outlook/message.txt",
            "source_system": "outlook_email",
            "embedding_status": "embedded",
            "project_id": 178,
        }
    ]
    monkeypatch.setattr(stage_runner, "get_rag_read_client", lambda: rag_client)

    row = stage_runner._load_document(pm_client, "doc-rag")

    assert row["file_path"] == "outlook/message.txt"
    assert row["status"] == "embedded"
    rag_select = rag_client.table.return_value.select.call_args.args[0]
    assert "storage_path" in rag_select
    assert "file_path" not in rag_select


def test_graph_parse_skips_but_graph_embedding_uses_graph_chunker(monkeypatch):
    stage_runner, functions, graph_embed = _load_stage_runner(monkeypatch)
    monkeypatch.setattr(
        stage_runner,
        "_load_document",
        lambda _client, metadata_id: {
            "id": metadata_id,
            "category": "email",
            "file_name": "message.txt",
            "source_system": "outlook_email",
            "status": "raw_ingested",
            "project_id": 67,
        },
    )

    parse = stage_runner.run_pipeline_stage("doc-2", "parse")
    vision = stage_runner.run_pipeline_stage("doc-2", "vision")
    embed = stage_runner.run_pipeline_stage("doc-2", "embed")

    assert parse["skipped"] is True
    assert "already materialized normalized content" in parse["reason"]
    assert vision["skipped"] is True
    assert "normalized Graph communications" in vision["reason"]
    functions["run_vision_analyzer"].assert_not_called()
    assert embed["result"]["chunkCount"] == 4
    graph_embed.embed_graph_document.assert_called_once()


def test_graph_embedding_fails_loudly_when_no_chunks_are_created(monkeypatch):
    stage_runner, _functions, graph_embed = _load_stage_runner(monkeypatch)
    graph_embed.embed_graph_document.return_value = 0
    monkeypatch.setattr(
        stage_runner,
        "_load_document",
        lambda _client, metadata_id: {
            "id": metadata_id,
            "category": "email",
            "file_name": "message.txt",
            "source_system": "teams_dm",
            "status": "raw_ingested",
            "project_id": 67,
        },
    )

    try:
        stage_runner.run_pipeline_stage("doc-3", "embed")
    except RuntimeError as exc:
        assert "produced no chunks" in str(exc)
    else:
        raise AssertionError("zero-chunk Graph embedding must fail loudly")
