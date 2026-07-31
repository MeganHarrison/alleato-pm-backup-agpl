---
description: Shared testing guidelines applied across all projects
---

# Testing

- Write tests for all new functions and bug fixes
- Use descriptive test names that explain the expected behavior
- Follow Arrange-Act-Assert pattern
- Prefer real implementations over mocks when practical
- Test edge cases: empty inputs, nulls, boundary values
- Keep tests independent — no shared mutable state between tests
