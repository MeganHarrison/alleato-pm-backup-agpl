"""Strategic reflection tool. Used by the orchestrator between investigation steps."""

from langchain_core.tools import tool


@tool
def think_tool(reflection: str) -> str:
    """Pause and reflect.

    Call this after gathering information to assess: what do I know? What's still missing?
    Was my assumption correct? What should I investigate next? Calling this tool does not
    fetch new data — it forces an explicit reasoning step.

    Args:
        reflection: Your reflection. State what you have, what's missing, and what's next.

    Returns:
        The reflection, acknowledged.
    """
    return f"Reflection noted: {reflection}"
