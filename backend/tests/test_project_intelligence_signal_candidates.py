import inspect

from src.services.project_intelligence.projections import signal_candidates


def test_signal_projection_has_no_ingestion_or_packet_queue_callback():
    source = inspect.getsource(signal_candidates)
    assert "source_intelligence_jobs" not in source
    assert "packet_refresh_jobs" not in source
    assert "enqueue_packet_refresh" not in source


def test_candidate_confidence_is_bounded():
    assert signal_candidates._confidence_label(1.0) == "high"
    assert signal_candidates._confidence_label(0.7) == "medium"
    assert signal_candidates._confidence_label(0.2) == "low"
