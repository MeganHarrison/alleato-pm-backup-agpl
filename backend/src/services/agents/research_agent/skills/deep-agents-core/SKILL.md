---
name: deep-agents-core
description: "Runtime guardrails for using Deep Agents planning, delegation, filesystem context, and skills in the Alleato backend."
---

# Deep Agents Core

## Instructions

1. Use the built-in planning tool for multi-step work.
2. Delegate focused public-web and Alleato-internal investigations to subagents when useful.
3. Use filesystem context only for transient research notes; do not mutate application files.
4. Treat all draft/action tools as preview-only. Do not claim that writes were performed.
5. Fail loudly when provider calls, tool calls, API keys, or source systems are unavailable.
6. Return a useful answer even when one source is unavailable, with a clear evidence gap.
