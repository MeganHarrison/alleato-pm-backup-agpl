"""Deep Agents middleware that injects durable DB-backed memory."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Annotated, Any, NotRequired, TypedDict

try:
    from langchain.agents.middleware.types import (
        AgentMiddleware,
        AgentState,
        ModelRequest,
        ModelResponse,
        PrivateStateAttr,
        ResponseT,
    )
except Exception:
    class AgentMiddleware:  # type: ignore[no-redef]
        def __class_getitem__(cls, _item: object) -> type["AgentMiddleware"]:
            return cls

    class AgentState(dict[str, Any]):  # type: ignore[no-redef]
        pass

    class ModelRequest:  # type: ignore[no-redef]
        def __class_getitem__(cls, _item: object) -> type["ModelRequest"]:
            return cls

    class ModelResponse:  # type: ignore[no-redef]
        def __class_getitem__(cls, _item: object) -> type["ModelResponse"]:
            return cls

    class PrivateStateAttr:  # type: ignore[no-redef]
        pass

    ResponseT = Any  # type: ignore[assignment]

from src.services.agents.memory.store import (
    build_memory_block,
    load_project_memory,
    load_user_memory,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from langchain_core.runnables import RunnableConfig
    from langgraph.runtime import Runtime

logger = logging.getLogger(__name__)

MEMORY_SYSTEM_PROMPT_TEMPLATE = """\
<durable_memory>
The following facts were learned in previous conversations and are provided
as durable context. Treat them as background knowledge. Do not quote this raw
list to the user, but use it to interpret questions, preferences, project
history, commitments, lessons, and known context.

{memory_block}
</durable_memory>"""


class _DbMemoryState(AgentState):
    _memory_loaded: NotRequired[Annotated[bool, PrivateStateAttr]]
    _memory_block: NotRequired[Annotated[str, PrivateStateAttr]]


class _DbMemoryStateUpdate(TypedDict):
    _memory_loaded: bool
    _memory_block: str


class DbMemoryMiddleware(AgentMiddleware[_DbMemoryState, Any, ResponseT]):
    """Load ai_memories once per thread and inject them into model calls."""

    state_schema = _DbMemoryState

    def before_agent(  # type: ignore[override]
        self,
        state: _DbMemoryState,
        runtime: Runtime,
        config: RunnableConfig,
    ) -> _DbMemoryStateUpdate | None:
        if state.get("_memory_loaded"):
            return None
        return _DbMemoryStateUpdate(
            _memory_loaded=True,
            _memory_block=_fetch_memory_block(config),
        )

    async def abefore_agent(  # type: ignore[override]
        self,
        state: _DbMemoryState,
        runtime: Runtime,
        config: RunnableConfig,
    ) -> _DbMemoryStateUpdate | None:
        if state.get("_memory_loaded"):
            return None
        return _DbMemoryStateUpdate(
            _memory_loaded=True,
            _memory_block=_fetch_memory_block(config),
        )

    def _inject(self, request: ModelRequest[Any]) -> ModelRequest[Any]:
        block: str = request.state.get("_memory_block", "")
        if not block:
            return request

        from deepagents.middleware._utils import append_to_system_message

        injection = MEMORY_SYSTEM_PROMPT_TEMPLATE.format(memory_block=block)
        new_system = append_to_system_message(request.system_message, injection)
        return request.override(system_message=new_system)

    def wrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], ModelResponse[ResponseT]],
    ) -> ModelResponse[ResponseT]:
        return handler(self._inject(request))

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[ResponseT]]],
    ) -> ModelResponse[ResponseT]:
        return await handler(self._inject(request))


def _fetch_memory_block(config: RunnableConfig) -> str:
    configurable: dict[str, Any] = (config or {}).get("configurable", {})
    user_id: str | None = configurable.get("user_id")
    project_id: int | str | None = configurable.get("project_id")

    user_memory = load_user_memory(user_id) if user_id else None
    project_memory = load_project_memory(project_id, user_id=user_id) if project_id is not None else None
    memory_block = build_memory_block(user_memory, project_memory)
    if memory_block:
        logger.info(
            "Loaded durable Deep Agents memory user_id=%s project_id=%s",
            user_id,
            project_id,
        )
    return memory_block
