---
name: source-command-alleato-experience-system
description: Compatibility entrypoint for the Alleato Experience System slash command. Use when a request invokes /alleato-experience-system or asks to run that command from a skill-aware agent.
---

# Alleato Experience System command

Read and follow `.claude/skills/alleato-experience-system/SKILL.md` completely.

Treat the user's text following `/alleato-experience-system` as the target and mode. If the command has no explicit mode, infer `calibrate`, `plan`, `implement`, or `review`. Visual redesigns must calibrate against the current artifact and references, then render and iterate from screenshots. Apply the Impeccable Alleato product noise gate before closeout.
