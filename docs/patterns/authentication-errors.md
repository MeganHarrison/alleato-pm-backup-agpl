---
title: authentication errors
description: authentication errors documentation
---

# 🔐 Authentication Error Patterns

## Pattern Index

- [Missing users_auth Link](#missing-users_auth-link)
- [Person Type Mismatch](#person-type-mismatch)
- [Permission Template Not Found](#permission-template-not-found)
- [Inactive Membership](#inactive-membership)

---

## Missing users_auth Link

### Classification

- **Category:** Authentication
- **Frequency:** Common
- **Severity:** P1

### Symptoms

- User gets "You do not have permission to view [resource]" despite being admin
- Permission checks fail for authenticated users
- User can login but can't access any project resources
- API returns 403 Forbidden for authorized requests

### Root Causes

1. User account created in Supabase Auth but no corresponding users_auth record
2. Signup/invite flow didn't complete the users_auth link creation
3. Manual user creation without proper linking
4. Database migration issues affecting users_auth table

### Standard Solution

#### Diagnosis

```sql
-- Check if auth user exists
SELECT id, email FROM auth.users WHERE email = '<user_email>';

-- Check if person record exists
SELECT id, first_name, last_name, email
FROM people
WHERE email = '<user_email>' OR first_name ILIKE '%<name>%';

-- Check if users_auth link exists
SELECT * FROM users_auth WHERE auth_user_id = '<auth_user_id>';

-- Check project membership
SELECT pdm.*, pt.name as template_name
FROM project_directory_memberships pdm
LEFT JOIN permission_templates pt ON pt.id = pdm.permission_template_id
WHERE pdm.person_id = '<person_id>' AND pdm.project_id = <project_id>;
```sql
#### Fix
```sql
-- Create missing users_auth link
INSERT INTO users_auth (auth_user_id, person_id)
VALUES ('<auth_user_id>', '<person_id>');
```sql
#### Validation

```javascript
// Test permission query works
const { data, error } = await supabase
  .from("project_directory_memberships")
  .select(`
    *,
    person:people!inner(
      *,
      users_auth!inner(auth_user_id)
    ),
    permission_template:permission_templates(*)
  `)
  .eq("project_id", projectId)
  .eq("person.users_auth.auth_user_id", authUserId)
  .eq("status", "active")
  .single();
```sql
### Prevention
- Always validate users_auth exists in permission checks
- Add database constraints to ensure referential integrity
- Monitor signup/invite flows for completion
- Include users_auth creation in all user onboarding processes

### Examples
- **2026-01-31:** Fixed missing link for megan@nutritionsolutionslifestyle.com - user had auth account and person record but no users_auth link

---

## Person Type Mismatch

### Classification
- **Category:** Authentication
- **Frequency:** Occasional
- **Severity:** P1

### Symptoms
- User can't login despite receiving and accepting invite
- "Invalid credentials" error for valid email/password
- User exists in directory but can't authenticate
- Invite acceptance appears successful but login fails

### Root Causes
1. Person created with `person_type = 'contact'` instead of `'user'`
2. Person type changed after invite was sent
3. Manual directory entry with wrong person type
4. Migration script incorrectly set person types

### Standard Solution

#### Diagnosis
```sql
-- Check person type for user
SELECT id, first_name, last_name, email, person_type
FROM people
WHERE email = '<user_email>';

-- Check if users_auth exists for contacts
SELECT p.person_type, ua.auth_user_id
FROM people p
LEFT JOIN users_auth ua ON p.id = ua.person_id
WHERE p.email = '<user_email>';
```

#### Fix

```sql
-- Update person type to allow login
UPDATE people
SET person_type = 'user'
WHERE id = '<person_id>' AND person_type = 'contact';
```sql
#### Validation
- Confirm user can now login successfully
- Verify person appears in correct user lists (not contact-only views)

### Prevention
- Validate person_type during invite creation
- Add UI warnings when creating contacts with email addresses
- Include person_type validation in user creation flows
- Review person_type settings during user onboarding

---

## Permission Template Not Found

### Classification
- **Category:** Authentication
- **Frequency:** Occasional
- **Severity:** P1

### Symptoms
- Permission checks return false despite user being admin
- "Template not found" errors in logs
- User has membership but no permissions show up
- API returns generic permission denied errors

### Root Causes
1. `permission_template_id` is NULL in membership record
2. Referenced permission template was deleted
3. Template ID references non-existent template
4. Migration issues affecting template assignments

### Standard Solution

#### Diagnosis
```sql
-- Check membership template assignment
SELECT
  pdm.id,
  pdm.permission_template_id,
  pt.name as template_name,
  pt.rules_json
FROM project_directory_memberships pdm
LEFT JOIN permission_templates pt ON pt.id = pdm.permission_template_id
WHERE pdm.person_id = '<person_id>' AND pdm.project_id = <project_id>;

-- Find available templates
SELECT id, name, is_system, rules_json
FROM permission_templates
WHERE is_system = true;
```sql
#### Fix

```sql
-- Assign default admin template (get ID from query above)
UPDATE project_directory_memberships
SET permission_template_id = '<admin_template_id>'
WHERE person_id = '<person_id>'
  AND project_id = <project_id>
  AND permission_template_id IS NULL;
```sql
#### Validation
- Test permission check returns expected permissions
- Confirm user can access previously blocked resources

### Prevention
- Add NOT NULL constraint on permission_template_id
- Validate template exists before assignment
- Create default template assignment in membership creation
- Monitor for orphaned template references

---

## Inactive Membership

### Classification
- **Category:** Authentication
- **Frequency:** Rare
- **Severity:** P2

### Symptoms
- User had access previously but now gets permission denied
- Membership exists but permission checks fail
- User shows in directory but can't access resources
- Former employee/contractor access issues

### Root Causes
1. Membership status set to 'inactive'
2. Project access revoked but not communicated
3. Batch deactivation scripts affecting active users
4. Status change without proper notification

### Standard Solution

#### Diagnosis
```sql
-- Check membership status
SELECT status, created_at, updated_at
FROM project_directory_memberships
WHERE person_id = '<person_id>' AND project_id = <project_id>;
```

#### Fix

```sql
-- Reactivate membership if appropriate
UPDATE project_directory_memberships
SET status = 'active'
WHERE person_id = '<person_id>'
  AND project_id = <project_id>
  AND status = 'inactive';
```

#### Validation

- Confirm user can now access project resources
- Verify membership shows as active in directory

### Prevention

- Add approval workflow for membership deactivation
- Log membership status changes with reason codes
- Include notifications for status changes
- Regular audit of inactive memberships for accuracy

---

## Quick Diagnosis Checklist

When user reports authentication/permission issues:

1. **Check auth user exists:**

   ```sql
   SELECT id, email FROM auth.users WHERE email = '<email>';
   ```sql
2. **Check person record exists:**

   ```sql
   SELECT id, first_name, last_name, person_type FROM people WHERE email = '<email>';
   ```sql
3. **Check users_auth link:**

   ```sql
   SELECT * FROM users_auth WHERE auth_user_id = '<auth_user_id>';
   ```sql
4. **Check membership and template:**

   ```sql
   SELECT pdm.status, pt.name, pt.rules_json
   FROM project_directory_memberships pdm
   LEFT JOIN permission_templates pt ON pt.id = pdm.permission_template_id
   WHERE pdm.person_id = '<person_id>' AND pdm.project_id = <project_id>;
   ```

5. **Test permission query:**
   Use PermissionService.hasPermission() to validate expected behavior

---

**Last Updated:** 2026-01-31
**Pattern Count:** 4
**Next Review:** Weekly
