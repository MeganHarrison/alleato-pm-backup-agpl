"""Microsoft Graph: Teams and Outlook search.

Teams and email content is already embedded in the AI Database (document_chunks) by the
alleato-pm Graph sync. We search that corpus via pgvector rather than making live Graph
API calls — which keeps this service read-only and avoids credential duplication.

Live Graph calls (send email, post Teams message) go through actions.py.
"""

from langchain_core.tools import tool

from .rag import CorpusSearchDegradedError, _format_results, retrieve

# Distinct, machine-detectable marker so a degraded search backend can never be
# narrated as a clean "no matching passages". Callers/agents must surface this as a
# capability failure, not a content negative.
_SEARCH_DEGRADED_MARKER = "SEARCH_BACKEND_DEGRADED"

_TEAMS_SOURCE_TYPES = ["teams_dm", "teams_channel", "teams_message"]
_EMAIL_SOURCE_TYPES = ["email", "email_attachment"]


@tool
def search_teams_messages(
    query: str,
    channel: str | None = None,
    date_from: str | None = None,
    max_results: int = 10,
) -> str:
    """Search Teams messages (DMs and channel posts) embedded in the vector corpus.

    Args:
        query: Search text.
        channel: Optional — not filterable at index level; include it in the query
            string for best results (e.g. "general channel: budget update").
        date_from: Optional ISO date — restrict to messages on/after this date.
        max_results: Max passages to return.

    Returns:
        Ranked messages with author, channel, timestamp, and excerpt.
    """
    effective_query = f"{channel}: {query}" if channel else query
    try:
        rows = retrieve(
            query=effective_query,
            source_types=_TEAMS_SOURCE_TYPES,
            date_from=date_from,
            max_results=max_results,
        )
    except CorpusSearchDegradedError as exc:
        return f"{_SEARCH_DEGRADED_MARKER}: Teams search unavailable — {exc}"
    except ValueError as exc:
        return f"Error: {exc}."
    except Exception as exc:  # noqa: BLE001
        return f"Error searching Teams messages: {exc}"
    return _format_results(rows)


@tool
def search_emails(
    query: str,
    from_address: str | None = None,
    date_from: str | None = None,
    max_results: int = 10,
) -> str:
    """Search Outlook emails embedded in the vector corpus.

    Args:
        query: Search text.
        from_address: Optional — include in query string for best results
            (e.g. "from:bclymer@alleatogroup.com change order").
        date_from: Optional ISO date — restrict to emails on/after this date.
        max_results: Max passages to return.

    Returns:
        Ranked emails with sender, subject, date, and excerpt.
    """
    effective_query = f"from:{from_address} {query}" if from_address else query
    try:
        rows = retrieve(
            query=effective_query,
            source_types=_EMAIL_SOURCE_TYPES,
            date_from=date_from,
            max_results=max_results,
        )
    except CorpusSearchDegradedError as exc:
        return f"{_SEARCH_DEGRADED_MARKER}: email search unavailable — {exc}"
    except ValueError as exc:
        return f"Error: {exc}."
    except Exception as exc:  # noqa: BLE001
        return f"Error searching emails: {exc}"
    return _format_results(rows)
