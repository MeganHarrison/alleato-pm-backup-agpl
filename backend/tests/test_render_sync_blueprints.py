from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"


def _render_blueprint_paths() -> tuple[Path, ...]:
    return tuple(
        path
        for path in (
            REPO_ROOT / "render.yaml",
            BACKEND_ROOT / "render.yaml",
        )
        if path.exists()
    )


def _services_by_name(path: Path) -> dict:
    data = yaml.safe_load(path.read_text())
    return {service["name"]: service for service in data["services"]}


def test_backend_render_blueprint_keeps_high_risk_sync_crons_in_parity():
    expected_schedules = {
        "alleato-source-sync-health": "*/30 * * * *",
        "alleato-teams-channel-sync": "10 * * * *",
        "alleato-teams-dm-sync": "40 * * * *",
        "alleato-graph-sync": "20 */2 * * *",
    }

    for path in _render_blueprint_paths():
        services = _services_by_name(path)
        for name, schedule in expected_schedules.items():
            assert services[name]["schedule"] == schedule


def test_graph_sync_blueprints_and_runner_share_the_budget_guarded_embed_limit():
    for path in _render_blueprint_paths():
        graph_sync = _services_by_name(path)["alleato-graph-sync"]

        assert "--embed-limit" not in graph_sync["dockerCommand"]
        assert graph_sync["dockerCommand"].endswith("scripts/run_graph_sync.py")
        assert graph_sync["dockerCommand"].startswith("timeout 55m")
        assert graph_sync["schedule"] == "20 */2 * * *"
        env = {item["key"]: item.get("value") for item in graph_sync["envVars"]}
        assert env["GRAPH_SYNC_TEAMS"] == "false"
        assert env["GRAPH_SYNC_TEAMS_DM"] == "false"
        assert env["GRAPH_EMBEDDING_LIMIT"] == "100"
        assert env["GRAPH_SYNC_RUN_EMBEDDING"] == "true"
        assert env["GRAPH_SYNC_PHASE_TIMEOUT_SECONDS"] == "480"

    runner_source = (BACKEND_ROOT / "scripts" / "run_graph_sync.py").read_text()
    assert 'bounded_int_env("GRAPH_EMBEDDING_LIMIT", 100, 1, 100)' in runner_source


def test_high_risk_sync_crons_are_not_disabled_echoes():
    for path in _render_blueprint_paths():
        services = _services_by_name(path)
        for name in (
            "alleato-source-sync-health",
            "alleato-teams-channel-sync",
            "alleato-teams-dm-sync",
            "alleato-graph-sync",
        ):
            assert (
                "disabled while DB incident guard is active"
                not in services[name]["dockerCommand"]
            )


def test_acumatica_automatic_sync_is_absent_and_web_fallback_is_disabled():
    for path in _render_blueprint_paths():
        services = _services_by_name(path)

        assert "alleato-acumatica-financial-sync" not in services
        backend = services["alleato-backend"]
        env = {item["key"]: item.get("value") for item in backend["envVars"]}
        assert env["ACUMATICA_FINANCIAL_SYNC_ENABLED"] == "false"


def test_source_sync_health_cron_uses_direct_entrypoint():
    for path in _render_blueprint_paths():
        source_sync = _services_by_name(path)["alleato-source-sync-health"]

        assert source_sync["schedule"] == "*/30 * * * *"
        assert (
            source_sync["dockerCommand"]
            == "python3 scripts/run_source_sync_health_recompute.py"
        )


def test_fireflies_cron_uses_direct_entrypoint():
    for path in _render_blueprint_paths():
        fireflies = _services_by_name(path)["alleato-fireflies-sync"]

        assert fireflies["schedule"] == "15 * * * *"
        assert fireflies["dockerCommand"] == (
            "timeout 20m python3 scripts/run_fireflies_sync.py"
        )


def test_alleato_crons_require_app_db_pressure_guard():
    for path in _render_blueprint_paths():
        services = _services_by_name(path)
        for name, service in services.items():
            if service.get("type") != "cron" or not name.startswith("alleato-"):
                continue
            env = {item["key"]: item for item in service["envVars"]}
            assert env["APP_DB_PRESSURE_GUARD_REQUIRED"]["value"] == "true"
            assert env["DATABASE_URL"]["sync"] is False


def test_root_blueprint_covers_all_db_pressure_suspend_targets():
    services = _services_by_name(REPO_ROOT / "render.yaml")
    expected = {
        "alleato-ai-provider-health",
        "alleato-domain-packet-compiler",
        "alleato-email-digest",
        "alleato-fireflies-sync",
        "alleato-graph-subscription-reconcile",
        "alleato-graph-sync",
        "alleato-microsoft-executive-assistant-check",
        "alleato-pipeline-alert",
        "alleato-project-synthesis-sweep",
        "alleato-rag-health",
        "alleato-rfi-email-ingest",
        "alleato-source-rag-health",
        "alleato-source-sync-health",
        "alleato-teams-channel-sync",
        "alleato-teams-dm-sync",
    }

    for name in expected:
        service = services[name]
        assert service["type"] == "cron"
        env = {item["key"]: item for item in service["envVars"]}
        assert env["APP_DB_PRESSURE_GUARD_REQUIRED"]["value"] == "true"
        assert env["DATABASE_URL"]["sync"] is False


def test_project_intelligence_crons_share_the_canonical_runner():
    services = _services_by_name(REPO_ROOT / "render.yaml")
    domain = services["alleato-domain-packet-compiler"]
    project = services["alleato-project-synthesis-sweep"]
    domain_command = domain["dockerCommand"]
    project_command = project["dockerCommand"]

    canonical = "python3 -m src.services.project_intelligence.runner"
    assert domain_command.startswith(canonical)
    assert domain_command.endswith("domain-packets --lookback-days 60 --doc-limit 150")
    assert project_command == f"{canonical} project-sweep"

    for service in (domain, project):
        env = {item["key"]: item.get("value") for item in service["envVars"]}
        assert env["APP_DB_PRESSURE_GUARD_REQUIRED"] == "true"
        assert env["ALLOW_PM_APP_FINAL_PROJECTIONS"] == "true"
    assert {item["key"]: item.get("value") for item in domain["envVars"]}[
        "PM_APP_PROJECTION_MAX_TOTAL_ROWS"
    ] == "200"
    assert {item["key"]: item.get("value") for item in domain["envVars"]}[
        "DOMAIN_PACKET_MAX_STALE_UPDATES_PER_TARGET"
    ] == "10"


def test_teams_dm_cron_is_tightly_bounded():
    for path in _render_blueprint_paths():
        teams_dm = _services_by_name(path)["alleato-teams-dm-sync"]
        env = {item["key"]: item.get("value") for item in teams_dm["envVars"]}

        assert "timeout 10m" in teams_dm["dockerCommand"]
        assert teams_dm["dockerCommand"].endswith("scripts/run_graph_teams_dm_sync.py")
        assert env["TEAMS_DM_SYNC_MAX_USERS"] == "1"
        assert env["TEAMS_DM_EXPORT_PAGE_SIZE"] == "25"
        assert env["TEAMS_DM_EXPORT_MAX_PAGES"] == "2"


def test_teams_channel_cron_uses_direct_entrypoint():
    for path in _render_blueprint_paths():
        teams = _services_by_name(path)["alleato-teams-channel-sync"]

        assert "timeout 25m" in teams["dockerCommand"]
        assert teams["dockerCommand"].endswith(
            "scripts/run_graph_teams_channel_sync.py"
        )


def test_services_calling_get_supabase_client_declare_the_service_role_key():
    """Guardrail for the 2026-07-24 incident: `get_supabase_client()` hard-requires
    `SUPABASE_SERVICE_ROLE_KEY` (no legacy-key fallback since #98/36472fc45), but
    `alleato-source-sync-health`, `alleato-rfi-email-ingest`,
    `alleato-project-intelligence-staleness-check`, and `alleato-email-digest`
    called it without the blueprint ever declaring the env var — every scheduled
    run raised an uncaught RuntimeError and Render alerted "server failure" on
    every single cron tick.
    """
    services_requiring_the_key = (
        "alleato-source-sync-health",
        "alleato-rfi-email-ingest",
        "alleato-project-intelligence-staleness-check",
        "alleato-email-digest",
        "alleato-source-rag-health",
        "alleato-backend",
    )

    for path in _render_blueprint_paths():
        services = _services_by_name(path)
        for name in services_requiring_the_key:
            env = {item["key"] for item in services[name]["envVars"]}
            assert "SUPABASE_SERVICE_ROLE_KEY" in env, (
                f"{name} calls get_supabase_client() but does not declare "
                "SUPABASE_SERVICE_ROLE_KEY in render.yaml"
            )


def test_rag_runtime_owners_declare_the_dedicated_database_contract():
    for path in _render_blueprint_paths():
        services = _services_by_name(path)
        for name in ("alleato-backend", "alleato-graph-sync"):
            env = {item["key"] for item in services[name]["envVars"]}
            assert "RAG_SUPABASE_URL" in env
            assert "RAG_SUPABASE_SERVICE_ROLE_KEY" in env
            assert "RAG_DATABASE_READS_ENABLED" in env
            assert "RAG_DATABASE_WRITES_ENABLED" in env
