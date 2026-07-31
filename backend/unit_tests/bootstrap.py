"""Lightweight module loader for pure backend unit tests.

This bypasses `backend/tests/conftest.py`, which imports the full FastAPI app
and optional runtime dependencies that pure compiler/service unit tests do not
need. The loader creates minimal package stubs so individual modules can be
loaded directly from disk with only the dependencies they actually use.
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = BACKEND_ROOT / "src"
SERVICES_ROOT = SRC_ROOT / "services"
INTELLIGENCE_ROOT = SERVICES_ROOT / "intelligence"


def _ensure_package(name: str, path: Path) -> None:
    module = sys.modules.get(name)
    if module is None:
        module = types.ModuleType(name)
        module.__path__ = [str(path)]  # type: ignore[attr-defined]
        sys.modules[name] = module
        return
    if not hasattr(module, "__path__"):
        module.__path__ = [str(path)]  # type: ignore[attr-defined]


def _install_stub_modules() -> None:
    client_mod = types.ModuleType("services.intelligence.client")
    client_mod.MODEL_PROJECT_INTELLIGENCE = "test-model"
    client_mod.extract_with_retry = lambda *args, **kwargs: {}
    sys.modules["services.intelligence.client"] = client_mod

    prompts_mod = types.ModuleType("services.intelligence.prompts")
    prompts_mod.build_email_extraction_messages = lambda *args, **kwargs: []
    prompts_mod.build_extraction_messages = lambda *args, **kwargs: []
    sys.modules["services.intelligence.prompts"] = prompts_mod

    task_assignees_mod = types.ModuleType("services.task_assignees")
    task_assignees_mod.clean_text = lambda value: str(value or "").strip() or None
    task_assignees_mod.TaskAssigneeResolver = object
    sys.modules["services.task_assignees"] = task_assignees_mod

    supabase_helpers_mod = types.ModuleType("services.supabase_helpers")
    supabase_helpers_mod.get_rag_read_client = lambda: None
    supabase_helpers_mod.get_rag_write_client = lambda: None
    supabase_helpers_mod.get_supabase_client = lambda: None
    sys.modules["services.supabase_helpers"] = supabase_helpers_mod

    inference_mod = types.ModuleType(
        "services.integrations.microsoft_graph.project_inference"
    )
    inference_mod.infer_project_id = lambda *args, **kwargs: (None, "unassigned", 0.0)
    sys.modules[
        "services.integrations.microsoft_graph.project_inference"
    ] = inference_mod

    db_guard_mod = types.ModuleType("services.ops.db_pressure_guard")
    db_guard_mod.enforce_app_db_pressure_guard = lambda *_args, **_kwargs: None
    sys.modules["services.ops.db_pressure_guard"] = db_guard_mod


def load_service_module(relative_path: str, module_name: str):
    if str(SRC_ROOT) not in sys.path:
        sys.path.insert(0, str(SRC_ROOT))

    _ensure_package("services", SERVICES_ROOT)
    _ensure_package("services.intelligence", INTELLIGENCE_ROOT)
    _ensure_package("services.integrations", SERVICES_ROOT / "integrations")
    _ensure_package(
        "services.integrations.microsoft_graph",
        SERVICES_ROOT / "integrations" / "microsoft_graph",
    )
    _ensure_package("services.ops", SERVICES_ROOT / "ops")
    _install_stub_modules()

    file_path = SRC_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not create import spec for {file_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module
