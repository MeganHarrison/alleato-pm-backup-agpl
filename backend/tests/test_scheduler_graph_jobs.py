import sys
import types

try:
    import apscheduler  # noqa: F401
except ModuleNotFoundError:
    apscheduler_module = types.ModuleType("apscheduler")
    schedulers_module = types.ModuleType("apscheduler.schedulers")
    schedulers_asyncio_module = types.ModuleType("apscheduler.schedulers.asyncio")
    triggers_module = types.ModuleType("apscheduler.triggers")
    triggers_cron_module = types.ModuleType("apscheduler.triggers.cron")
    triggers_interval_module = types.ModuleType("apscheduler.triggers.interval")

    class _FakeAsyncIOScheduler:
        pass

    class _FakeCronTrigger:
        def __init__(self, *_args, **_kwargs):
            pass

        @classmethod
        def from_crontab(cls, *_args, **_kwargs):
            return cls()

    class _FakeIntervalTrigger:
        def __init__(self, *_args, **_kwargs):
            pass

    schedulers_asyncio_module.AsyncIOScheduler = _FakeAsyncIOScheduler
    triggers_cron_module.CronTrigger = _FakeCronTrigger
    triggers_interval_module.IntervalTrigger = _FakeIntervalTrigger
    sys.modules.setdefault("apscheduler", apscheduler_module)
    sys.modules.setdefault("apscheduler.schedulers", schedulers_module)
    sys.modules.setdefault("apscheduler.schedulers.asyncio", schedulers_asyncio_module)
    sys.modules.setdefault("apscheduler.triggers", triggers_module)
    sys.modules.setdefault("apscheduler.triggers.cron", triggers_cron_module)
    sys.modules.setdefault("apscheduler.triggers.interval", triggers_interval_module)

from src.services import scheduler


class _RecordingScheduler:
    def __init__(self):
        self.jobs = []
        self.running = False

    def add_job(self, func, trigger, id=None, name=None, replace_existing=None, max_instances=None, kwargs=None):
        self.jobs.append(
            {
                "func": func,
                "trigger": trigger,
                "id": id,
                "name": name,
                "replace_existing": replace_existing,
                "max_instances": max_instances,
                "kwargs": kwargs or {},
            }
        )

    def start(self):
        self.running = True


def test_init_scheduler_never_registers_acumatica_job_from_legacy_env(monkeypatch):
    recording_scheduler = _RecordingScheduler()

    monkeypatch.setattr(scheduler, "AsyncIOScheduler", lambda: recording_scheduler)
    monkeypatch.delenv("DISABLE_SCHEDULER", raising=False)
    monkeypatch.setenv("ACUMATICA_FINANCIAL_SYNC_ENABLED", "true")
    monkeypatch.setenv("ACUMATICA_BASE_URL", "https://example.acumatica.com")
    monkeypatch.setenv("ACCOUNTING_USER", "sync-user")
    monkeypatch.setenv("ACCOUNTING_PASSWORD", "secret")
    monkeypatch.delenv("ACUMATICA_SERVICE_URL", raising=False)
    monkeypatch.setenv("SOURCE_SYNC_HEALTH_RECOMPUTE_ENABLED", "false")
    monkeypatch.setenv("INTELLIGENCE_COMPILER_ENABLED", "false")
    monkeypatch.setenv("TASK_EXTRACTION_ENABLED", "false")

    scheduler.init_scheduler()

    job_ids = {job["id"] for job in recording_scheduler.jobs}
    assert "acumatica_financial_sync" not in job_ids
    assert recording_scheduler.jobs == []
    assert recording_scheduler.running is True


def test_run_source_sync_health_recompute_persists_snapshots_and_alerts(monkeypatch):
    calls = {"snapshots": [], "alerts": []}
    client = object()

    monkeypatch.setattr(
        "src.services.supabase_helpers.get_supabase_client",
        lambda: client,
    )
    monkeypatch.setattr(
        "src.services.health.source_sync_health.get_source_sync_health",
        lambda supabase_client: {
            "status": "warning",
            "sources": [
                {"source": "fireflies", "resourceId": "recent_transcripts"},
                {"source": "microsoft_graph", "resourceId": "graph_embed"},
            ],
            "alerts": [
                {"code": "source_sync_stale", "source": "fireflies", "resourceId": "recent_transcripts"},
            ],
        },
    )
    monkeypatch.setattr(
        "src.services.health.source_sync_health.update_source_health_snapshot",
        lambda supabase_client, source: calls["snapshots"].append((supabase_client, source)),
    )
    monkeypatch.setattr(
        "src.services.health.source_sync_health.persist_source_sync_alerts",
        lambda supabase_client, alerts, resolve_missing: calls["alerts"].append(
            (supabase_client, alerts, resolve_missing)
        ) or {"upserted": len(alerts), "resolved": 0},
    )

    from src.services.health.source_sync_health_recompute import (
        run_source_sync_health_recompute,
    )

    result = run_source_sync_health_recompute()

    assert result["status"] == "completed"
    assert result["updatedSnapshots"] == 2
    assert calls["snapshots"] == [
        (client, {"source": "fireflies", "resourceId": "recent_transcripts"}),
        (client, {"source": "microsoft_graph", "resourceId": "graph_embed"}),
    ]
    assert calls["alerts"] == [
        (
            client,
            [{"code": "source_sync_stale", "source": "fireflies", "resourceId": "recent_transcripts"}],
            False,
        )
    ]
