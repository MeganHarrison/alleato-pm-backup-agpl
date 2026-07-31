"""PostHog OpenTelemetry log bridge for the FastAPI backend."""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def init_posthog() -> bool:
    """Initialize PostHog OTLP log exporter if POSTHOG_API_KEY is set."""
    api_key = os.getenv("POSTHOG_API_KEY")
    if not api_key:
        return False
    host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")

    try:
        from opentelemetry._logs import set_logger_provider
        from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
        from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
        from opentelemetry.sdk.resources import Resource
    except ImportError as exc:
        raise RuntimeError(
            "POSTHOG_API_KEY is set but opentelemetry packages are not installed. "
            "Run: pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http"
        ) from exc

    environment = (
        os.getenv("SENTRY_ENVIRONMENT")
        or os.getenv("ENVIRONMENT")
        or "production"
    )

    resource = Resource(attributes={
        "service.name": "alleato-backend",
        "deployment.environment": environment,
    })

    provider = LoggerProvider(resource=resource)
    set_logger_provider(provider)

    exporter = OTLPLogExporter(
        endpoint=f"{host}/i/v1/logs",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    provider.add_log_record_processor(BatchLogRecordProcessor(exporter))

    handler = LoggingHandler(logger_provider=provider)
    logging.getLogger().addHandler(handler)

    logger.info("[PostHog] Backend log bridge initialized environment=%s", environment)
    return True
