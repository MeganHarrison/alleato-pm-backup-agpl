"""Microsoft Executive Assistant backend agent public API."""

from src.services.agents.microsoft_executive_assistant.agent import (
    run_microsoft_executive_assistant,
)
from src.services.agents.microsoft_executive_assistant.contracts import (
    MicrosoftExecutiveAssistantRequest,
    MicrosoftExecutiveAssistantResponse,
)

__all__ = [
    "MicrosoftExecutiveAssistantRequest",
    "MicrosoftExecutiveAssistantResponse",
    "run_microsoft_executive_assistant",
]
