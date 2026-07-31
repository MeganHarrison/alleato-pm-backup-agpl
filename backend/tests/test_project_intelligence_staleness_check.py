"""Regression tests for the project-intelligence staleness monitor.

Guards two hardening rules added after the AAI-1196 recurrence (the
``project_current_state narratives are stale`` page):

1. Weekend awareness — the only writer of ``project_current_state`` runs on
   weekdays, so the monotonic weekend gap must not fire a false page (it did,
   every Monday). A genuine multi-weekday stall must still page.
2. Self-locating diagnosis — a real page must name the failing layer (brief
   generation vs. the consumer projection) and carry the exact recovery command.
"""

from datetime import datetime, timedelta, timezone

from src.services.health import project_intelligence_staleness_check as check


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return type("R", (), {"data": self._rows})()


class _FakeClient:
    """Supabase-shaped fake keyed by table name."""

    def __init__(self, tables):
        self._tables = tables

    def table(self, name):
        return _FakeQuery(self._tables.get(name, []))


def _iso(dt):
    return dt.isoformat()


def _fresh_brief_packet(generated_at, *, status="completed", packet_id="pkt-1"):
    return {
        "id": packet_id,
        "generated_at": _iso(generated_at),
        "packet_json": {"runContract": {"status": status}},
    }


def _client_with(*, current_state_update, brief_packet=None):
    return _FakeClient(
        {
            "project_current_state": [{"updated_at": _iso(current_state_update)}],
            "intelligence_targets": [{"id": "target-daily"}],
            "intelligence_packets": [brief_packet] if brief_packet else [],
            # The synthesis-sweep signal is out of scope for these tests; keep it fresh.
        }
    )


def test_weekend_gap_does_not_false_page(monkeypatch):
    # Friday 10:00 UTC write, checked the following Monday 08:30 UTC (before that
    # day's weekday run). Wall-clock is ~2.9 days, but two of those are weekend
    # days on which the writer never runs → must stay healthy.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    friday = datetime(2026, 7, 17, 10, 0, tzinfo=timezone.utc)  # Friday write
    monday = datetime(2026, 7, 20, 8, 30, tzinfo=timezone.utc)  # Monday check
    # Keep both upstream packet signals fresh so only the weekend rule is exercised.
    client = _client_with(
        current_state_update=friday, brief_packet=_fresh_brief_packet(monday)
    )

    res = check.check_project_intelligence_staleness(now=monday, client=client)

    pcs_alerts = [a for a in res["alerts"] if a.get("table") == "project_current_state"]
    assert pcs_alerts == []
    assert res["healthy"] is True
    assert res["project_current_state_weekend_days_excluded"] == 2
    assert res["project_current_state_business_days_stale"] == 0


def test_two_weekday_stall_pages(monkeypatch):
    # Tuesday 10:00 UTC write, checked Friday 08:30 UTC: Wed + Thu weekday runs
    # were missed, no weekend in between → must page.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    tuesday = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)  # Tuesday
    friday = datetime(2026, 7, 24, 8, 30, tzinfo=timezone.utc)  # Friday
    client = _client_with(
        current_state_update=tuesday, brief_packet=_fresh_brief_packet(friday)
    )

    res = check.check_project_intelligence_staleness(now=friday, client=client)

    pcs_alerts = [a for a in res["alerts"] if a.get("table") == "project_current_state"]
    assert res["healthy"] is False
    assert len(pcs_alerts) == 1
    assert res["project_current_state_weekend_days_excluded"] == 0
    assert "business days old" in pcs_alerts[0]["message"]


def test_diagnosis_points_at_consumer_when_brief_is_fresh(monkeypatch):
    # Brief packet is fresh + completed but project_current_state is stale → the
    # consumer projection failed; the page must name that layer and hand over the
    # replay command for the exact packet.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    tuesday = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    friday = datetime(2026, 7, 24, 8, 30, tzinfo=timezone.utc)
    client = _client_with(
        current_state_update=tuesday,
        brief_packet=_fresh_brief_packet(friday, packet_id="pkt-42"),
    )

    res = check.check_project_intelligence_staleness(now=friday, client=client)

    diagnosis = res["project_current_state_diagnosis"]
    assert diagnosis["layer"] == "consumer_projection"
    assert "--packetId pkt-42" in diagnosis["recovery_hint"]


def test_diagnosis_reads_fresh_staged_packet_not_stale_current(monkeypatch):
    # Codex P2: when the brief compiled fine but the consumer failed before
    # promotion, the fresh packet is 'staged'/'snapshot' while the stale prior
    # packet is still 'current'. The diagnosis must read the newest packet
    # regardless of type, attribute the consumer layer, and hand back the STAGED
    # packet's id (the one the consumer replay must target) — not the stale one.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    tuesday = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    friday = datetime(2026, 7, 24, 8, 30, tzinfo=timezone.utc)
    fresh_staged = {
        "id": "pkt-staged",
        "generated_at": _iso(friday),  # newest
        "packet_json": {"runContract": {"status": "staged"}},
    }
    stale_current = {
        "id": "pkt-current-old",
        "generated_at": _iso(tuesday),
        "packet_json": {"runContract": {"status": "completed"}},
    }
    client = _FakeClient(
        {
            "project_current_state": [{"updated_at": _iso(tuesday)}],
            "intelligence_targets": [{"id": "target-daily"}],
            # newest-first: a real .order(desc).limit(1) returns the staged row.
            "intelligence_packets": [fresh_staged, stale_current],
        }
    )

    res = check.check_project_intelligence_staleness(now=friday, client=client)

    diagnosis = res["project_current_state_diagnosis"]
    assert diagnosis["layer"] == "consumer_projection"
    assert "--packetId pkt-staged" in diagnosis["recovery_hint"]
    assert "pkt-current-old" not in diagnosis["recovery_hint"]


def test_diagnosis_points_at_brief_when_upstream_is_also_stale(monkeypatch):
    # The newest brief packet is itself stale → brief generation stopped; the
    # recovery hint points at regenerating the brief, not replaying a consumer.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    old = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    friday = datetime(2026, 7, 24, 8, 30, tzinfo=timezone.utc)
    client = _client_with(
        current_state_update=old,
        brief_packet=_fresh_brief_packet(old, packet_id="pkt-old"),
    )

    res = check.check_project_intelligence_staleness(now=friday, client=client)

    diagnosis = res["project_current_state_diagnosis"]
    assert diagnosis["layer"] == "brief_generation"
    assert "--packetId" not in diagnosis["recovery_hint"]


def test_diagnosis_uses_weekend_aware_age_for_upstream_brief(monkeypatch):
    # A Friday packet checked Tuesday morning is still within the two-business-
    # day threshold. The project_current_state row is independently stale, so
    # diagnosis must attribute the failure to the consumer rather than falsely
    # claiming that brief generation stalled over the weekend.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    thursday = datetime(2026, 7, 23, 10, 0, tzinfo=timezone.utc)
    friday = datetime(2026, 7, 24, 10, 0, tzinfo=timezone.utc)
    tuesday = datetime(2026, 7, 28, 10, 0, tzinfo=timezone.utc)
    client = _client_with(
        current_state_update=thursday,
        brief_packet=_fresh_brief_packet(friday, packet_id="pkt-friday"),
    )

    res = check.check_project_intelligence_staleness(now=tuesday, client=client)

    diagnosis = res["project_current_state_diagnosis"]
    assert diagnosis["layer"] == "consumer_projection"
    assert "--packetId pkt-friday" in diagnosis["recovery_hint"]


def test_diagnosis_never_raises_on_broken_client(monkeypatch):
    # A diagnosis failure must never suppress the core staleness signal.
    monkeypatch.setenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", "2")
    tuesday = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)
    friday = datetime(2026, 7, 24, 8, 30, tzinfo=timezone.utc)

    class _HalfBrokenClient(_FakeClient):
        def table(self, name):
            if name == "project_current_state":
                return _FakeQuery([{"updated_at": _iso(tuesday)}])
            raise RuntimeError("intelligence_targets unavailable")

    res = check.check_project_intelligence_staleness(
        now=friday, client=_HalfBrokenClient({})
    )

    assert res["healthy"] is False
    pcs_alerts = [a for a in res["alerts"] if a.get("table") == "project_current_state"]
    assert len(pcs_alerts) == 1
    # No diagnosis attached, but the core page still fires.
    assert "diagnosis" not in pcs_alerts[0]
