# ADR-001: Multi-Tenant Foundation

**Status:** Accepted for implementation planning  
**Date:** 2026-10-21

## Context

Aiced Bot currently operates as one Flask application with one global editor credential and globally scoped content, subscriber, workflow, and campaign tables. It must become one shared product that safely serves multiple client organizations without dashboard forks or cross-client data access.

## Decision

1. **Identity:** use Supabase Auth with email/password. The application will not store or manage reusable user passwords.
2. **Authorization:** Flask is responsible for validating authenticated identity, loading the current organization membership, enforcing roles, and applying organization scope to every server-side query and write. UI visibility is not authorization.
3. **Sessions:** after validated Supabase Auth login, Flask will use secure server-side sessions with opaque `Secure`, `HttpOnly`, appropriately `SameSite` cookies. State-changing cookie-authenticated requests require CSRF protection. Session IDs rotate at login and privilege/organization changes and expire/revoke with membership changes.
4. **Roles:** membership roles are `owner`, `admin`, `editor`, and `viewer`. Owner and Admin may authorize production campaign sends. Editors may create/edit authorized content and campaign drafts but may not execute production sends. Viewers are read-only.
5. **Control-plane identifiers:** new control-plane records (`organizations`, `users`, memberships, settings, audit events) use UUID primary keys. Existing application integer primary keys remain unchanged.
6. **Ownership:** every existing tenant-owned record gains an `organization_id` foreign key through a reviewed migration/backfill sequence. This includes posts, subscribers, tags, Aiced handoffs, campaigns, and campaign recipients; assignment-table ownership is enforced with parent consistency controls.
7. **Uniqueness:** subscriber email uniqueness becomes case-insensitive per organization; normalized tag uniqueness becomes per organization. Opaque workflow tokens remain globally unique and are additionally organization-authorized.
8. **First-client preservation:** all existing records will be assigned to one confirmed initial organization only after backup, row-count baseline, rehearsal, backfill verification, and a coordinated release of tenant-scoped application queries.

## Consequences

- Supabase Auth replaces the global Basic-auth model in a later, separately reviewed batch; this ADR does not change authentication today.
- Flask routes must no longer use global `db.session.get(...)` or unscoped selects for tenant-owned resources.
- Row Level Security may provide defense in depth for direct Supabase access, but it does not replace Flask authorization, particularly for service-role/database-owner connections.
- Existing article publishing, Aiced review, recipient snapshots, and explicit sending safeguards remain intact while ownership is introduced.

## Non-goals in this decision

- No login implementation, migration, RLS policy deployment, domain onboarding, second-client onboarding, or production send change.
- No client-specific dashboard fork, per-client application deployment, or frontend-only isolation.
