---
title: datauase issues
description: datauase issues documentation
---

# 🗄️ Database Error Patterns

## Pattern Index

- [Foreign Key Type Mismatch](#foreign-key-type-mismatch)
- [Case Sensitivity Issues](#case-sensitivity-issues)
- [Missing Database Types](#missing-database-types)
- [Null Constraint Violations](#null-constraint-violations)
- [Query Joining Wrong Tables](#query-joining-wrong-tables)

---

## Foreign Key Type Mismatch

### Classification

- **Category:** Database
- **Frequency:** Common
- **Severity:** P1

### Symptoms

- Queries return empty results silently (no errors thrown)
- Joins fail to match records that should match
- Foreign key relationships don't work as expected
- INSERT operations succeed but don't create proper relationships

### Root Causes

1. Foreign key column type doesn't match primary key type
2. UUID vs INTEGER type confusion
3. Migration scripts using wrong data types
4. Copy-paste errors when creating new tables

### Standard Solution

#### Diagnosis

```sql
-- Check column types for FK relationships
SELECT
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE c.column_name LIKE '%_id'
  AND t.table_schema = 'public'
ORDER BY t.table_name, c.column_name;

-- Specific check for project_id mismatches
SELECT
  'projects.id' as pk_column,
  pg_typeof(p.id) as pk_type,
  't.project_id' as fk_column,
  pg_typeof(t.project_id) as fk_type
FROM projects p, [table_name] t
LIMIT 1;
```sql
#### Fix
```sql
-- Example: Fix UUID project_id that should be INTEGER
ALTER TABLE [table_name]
ALTER COLUMN project_id TYPE INTEGER USING project_id::text::integer;

-- Example: Fix INTEGER person_id that should be UUID
ALTER TABLE [table_name]
ALTER COLUMN person_id TYPE UUID USING person_id::text::uuid;
```sql
#### Validation

```sql
-- Test join now works correctly
SELECT COUNT(*)
FROM [table_name] t
JOIN projects p ON p.id = t.project_id;
```sql
### Prevention
- **ALWAYS** check database.types.ts before creating new tables
- Verify FK column types match PK types exactly
- Use consistent naming: project_id=INTEGER, person_id=UUID, company_id=UUID
- Add type checking to migration review process

### Examples
- **Historical:** schedule_tasks.project_id created as UUID instead of INTEGER
- **Common:** New tables defaulting person_id to INTEGER instead of UUID

---

## Case Sensitivity Issues

### Classification
- **Category:** Database
- **Frequency:** Common
- **Severity:** P2

### Symptoms
- "Column does not exist" errors
- Queries work in SQL client but fail in application
- TypeScript compilation errors about unknown properties
- SELECT statements returning unexpected results

### Root Causes
1. JavaScript camelCase vs PostgreSQL snake_case mismatch
2. Manually typing column names instead of copying from schema
3. ORM/query builder case conversion issues
4. Copy-paste from documentation with wrong casing

### Standard Solution

#### Diagnosis
```sql
-- Check actual column names in table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = '[table_name]'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

#### Fix

```typescript
// WRONG: Guessing column names
const { data } = await supabase
  .from("people")
  .select("firstName, lastName, emailAddress");

// CORRECT: Using exact database column names
const { data } = await supabase
  .from("people")
  .select("first_name, last_name, email");
```sql
#### Validation
- Query executes without "column does not exist" errors
- TypeScript compilation succeeds with proper types

### Prevention
- **ALWAYS** copy column names from database.types.ts
- Use IDE autocomplete for column names
- Never manually type database column names
- Use snake_case consistently in all database schemas

### Examples
- firstName vs first_name confusion
- emailAddress vs email column name errors
- businessPhone vs business_phone mismatches

---

## Missing Database Types

### Classification
- **Category:** Database
- **Frequency:** Very Common
- **Severity:** P1

### Symptoms
- TypeScript errors about unknown table/column names
- Runtime errors about non-existent tables
- Query attempts on tables that don't exist
- Type safety violations in database operations

### Root Causes
1. Database types not generated after schema changes
2. Using outdated types file
3. Assuming table/column names without verification
4. Working with stale local database schema

### Standard Solution

#### Diagnosis
```bash
# Check when types were last generated
ls -la frontend/src/types/database.types.ts

# Check what tables actually exist
psql -h db.lgveqfnpkxvzbnnwuled.supabase.co -U postgres -d postgres \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```sql
#### Fix

```bash
# Generate fresh types (MANDATORY before any database work)
npx supabase gen types typescript \
  --project-id "lgveqfnpkxvzbnnwuled" \
  --schema public > frontend/src/types/database.types.ts
```sql
#### Validation
- TypeScript compilation succeeds
- All table and column references resolve correctly
- IDE provides accurate autocomplete for database operations

### Prevention
- **MANDATORY:** Run `npm run db:types` before ANY database work
- Add types generation to CI/CD pipeline
- Include types file check in code review process
- Never assume schema - always verify with fresh types

### Examples
- Every new feature development session
- After any migration or schema change
- When switching between branches with schema differences

---

## Null Constraint Violations

### Classification
- **Category:** Database
- **Frequency:** Occasional
- **Severity:** P2

### Symptoms
- "null value in column violates not-null constraint" errors
- INSERT/UPDATE operations failing unexpectedly
- Form submissions failing with database errors
- Migration rollback issues

### Root Causes
1. Required fields not handled in application logic
2. Database constraints added without considering existing data
3. Form validation not matching database constraints
4. API endpoints missing required field validation

### Standard Solution

#### Diagnosis
```sql
-- Check constraints on table
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = '[table_name]'
  AND tc.constraint_type = 'NOT NULL';

-- Check for existing null values
SELECT column_name
FROM information_schema.columns
WHERE table_name = '[table_name]'
  AND is_nullable = 'NO'
  AND table_schema = 'public';
```

#### Fix

```sql
-- Option 1: Provide default values for existing nulls
UPDATE [table_name]
SET [column_name] = '[default_value]'
WHERE [column_name] IS NULL;

-- Option 2: Make column nullable if business rules allow
ALTER TABLE [table_name]
ALTER COLUMN [column_name] DROP NOT NULL;
```sql
#### Validation
- INSERT/UPDATE operations work with expected data
- Form submissions complete successfully
- No constraint violation errors in application

### Prevention
- Match form validation to database constraints
- Add required field indicators in UI
- Test with empty/null values during development
- Consider nullable vs required fields in schema design

---

## Query Joining Wrong Tables

### Classification
- **Category:** Database
- **Frequency:** Occasional
- **Severity:** P2

### Symptoms
- Queries return wrong or incomplete data
- Performance issues with unnecessary table scans
- Logical errors in data relationships
- Complex queries that don't match business logic

### Root Causes
1. Misunderstanding table relationships
2. Using wrong foreign key columns in joins
3. Missing intermediate tables in many-to-many relationships
4. Incorrect understanding of data model

### Standard Solution

#### Diagnosis
```sql
-- Check foreign key relationships
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = '[table_name]';

-- Analyze query execution plan
EXPLAIN ANALYZE [your_query];
```sql
#### Fix

```sql
-- Example: Correct join through intermediate table
-- WRONG: Direct join that misses relationship
SELECT p.first_name, pr.name
FROM people p
JOIN projects pr ON p.id = pr.owner_id; -- This might not be right

-- CORRECT: Join through membership table
SELECT p.first_name, pr.name
FROM people p
JOIN project_directory_memberships pdm ON p.id = pdm.person_id
JOIN projects pr ON pr.id = pdm.project_id;
```

#### Validation

- Query returns logically correct data
- Performance is reasonable (check EXPLAIN ANALYZE)
- Results match business requirements and user expectations

### Prevention

- Study entity-relationship diagrams before writing queries
- Verify table relationships in database.types.ts
- Test queries with known data to validate logic
- Review query plans for performance optimization

---

## Quick Database Debugging Checklist

When encountering database issues:

1. **Generate fresh types:**

   ```bash
   npm run db:types
   ```sql
2. **Check table exists:**

   ```sql
   SELECT tablename FROM pg_tables
   WHERE tablename = '[table_name]' AND schemaname = 'public';
   ```sql
3. **Verify column names:**

   ```sql
   \d [table_name]
   ```sql
4. **Check foreign key relationships:**

   ```sql
   SELECT * FROM information_schema.table_constraints
   WHERE table_name = '[table_name]' AND constraint_type = 'FOREIGN KEY';
   ```

5. **Test query with EXPLAIN:**

   ```sql
   EXPLAIN ANALYZE [your_query];
   ```

---

**Last Updated:** 2026-01-31
**Pattern Count:** 5
**Next Review:** Weekly
