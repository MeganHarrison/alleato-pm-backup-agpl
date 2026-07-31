# Check Patterns Command

Search and review documented error patterns before taking action.

## Usage

```bash
/check-patterns [category] [keywords]
```
## Categories

- `auth` - Authentication and permission errors
- `database` - Schema, query, and type issues
- `api` - Route and endpoint problems
- `frontend` - UI and component issues
- `all` - Search all patterns

## Examples

```bash
/check-patterns auth permission denied
/check-patterns database foreign key
/check-patterns api route conflicts
/check-patterns all users_auth
```

## What This Does

1. Searches pattern documentation for relevant issues
2. Shows known solutions and prevention measures
3. Provides quick validation steps
4. Links to full pattern documentation

## Required Before

- Any debugging or problem-solving
- Creating new features that might hit known issues
- Making changes to authentication, database, or API systems

## Output Format

- Matching patterns found
- Quick solution summary
- Prevention checklist items
- Links to full documentation
