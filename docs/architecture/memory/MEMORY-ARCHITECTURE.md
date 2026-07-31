# Agent Memory

Typed long-term assistant memories in PM app ai_memories: facts, preferences, lessons, commitments, context.
Visibility-scoped memory: private memories are user-owned; team memories can be recalled by the team.
Project-scoped memory: memories can be tied to a project or global.
Vector recall split into AI Database: the searchable embedding lives in AI DB document_chunks with source_type='ai_memory'; PM app ai_memories owns text, visibility, lifecycle, and ownership.
Deep Agents runtime memory injection: backend Deep Agents load user/project memory through SQL filters so they only see caller-owned private memory plus team-visible project memory.
Post-response extraction: handler-v2 now schedules memory extraction after AI responses and persists memory_usage.