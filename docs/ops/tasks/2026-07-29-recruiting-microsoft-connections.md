# Recruiting Microsoft 365 self-service connections

## Outcome

Applicant Tracker users can connect their own Alleato Microsoft 365 account from
Recruiting > Settings. Mail and calendar consent are requested independently,
and users can reconnect or disconnect without sharing a password.

## Security contract

- Authorization code flow uses PKCE and a signed, ten-minute, HttpOnly,
  SameSite=Lax state cookie.
- The callback binds the state to the authenticated recruiting person and the
  Alleato tenant.
- Delegated permissions are least privilege:
  - Outlook email: `Mail.Send`
  - Calendar and Teams scheduling: `Calendars.ReadWrite`
  - Identity/session: `offline_access User.Read`
- Access and refresh tokens are encrypted with AES-256-GCM before database
  storage. The encryption key is server-only.
- Token-bearing tables have RLS enabled and no direct authenticated grants.
  Security-definer functions bind reads and writes to the current recruiting
  person.
- Connect, reconnect, and disconnect actions create token-free audit events.
- OAuth errors are reduced to a generic recruiting redirect; provider responses
  and tokens are not logged.

## Production configuration

1. Add the exact web redirect URI to the Microsoft app registration:
   `https://projects.alleatogroup.com/api/recruiting/integrations/microsoft/callback`
2. Add delegated Microsoft Graph permissions `User.Read`, `Mail.Send`, and
   `Calendars.ReadWrite`.
3. Grant tenant admin consent so users are not blocked by tenant consent policy.
4. Configure Vercel Production:
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_TENANT_ID`
   - `RECRUITING_MICROSOFT_REDIRECT_URI`
   - `RECRUITING_MICROSOFT_TOKEN_ENCRYPTION_KEY`
5. Apply the `20260730030000`, `20260730031000`, and `20260730032000`
   recruiting Microsoft connection migrations in order.
6. Set recruiting settings `provider_delivery_enabled`,
   `outlook_mail_verified`, and `outlook_calendar_verified` to true only after
   the provider configuration is verified.

## Verification

- Unit: capability scope separation, PKCE state signature/person/expiry,
  authenticated token encryption, tenant validation, and Graph profile mapping.
- Component: Recruiting Settings exposes both connection actions and retains the
  guarded readiness list.
- Database: token tables are inaccessible directly to authenticated users;
  status and disconnect operate only for the current recruiting person, while
  token-bearing functions are service-role-only.
- Production: sign in as a recruiting user, connect mail, connect calendar,
  verify the connected email and both availability rows, then disconnect and
  verify both return to guarded.

## Rollback

Disable the three recruiting provider settings first. Remove the five Vercel
Microsoft connection variables, then deploy a forward migration that revokes
the connection functions and drops the connection/event tables after
confirming no active users remain. Existing migration files are immutable.
