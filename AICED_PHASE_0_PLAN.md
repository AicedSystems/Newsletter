# Aiced Bot — Phase 0: Multi-Tenant Foundation Design

**Status:** implementation planning only — 2026-10-21. This document does not authorize code changes, migrations, environment changes, production sends, or data changes.

## Purpose and boundary

The current application is a capable **single-client** Flask product. Its content, subscribers, tags, Aiced workflows, campaigns, credentials, Storage configuration, and editor authorization are process-wide. Phase 0 establishes the design required to make those boundaries organization-aware before a second client is onboarded.

The aim is one shared Aiced Bot codebase and dashboard, not client-specific forks. This plan preserves the existing article, subscriber, Aiced, campaign preparation, and explicit sending safeguards.

## 1. Current database model and migration inventory

All application tables are currently in PostgreSQL's `public` schema. The model/migration schema convention is mixed only because `Post` has no ORM schema while its Alembic migration creates `public.posts`; its SQLAlchemy metadata key is `posts`. Other models explicitly use `schema="public"`.

| Current model/table | Relationships and constraints | Tenant risk today |
| --- | --- | --- |
| `Post` / `public.posts` | Primary key `id`; no uniqueness constraint. Has `campaigns` relationship. Contains article fields, status, published timestamp, featured image, and JSONB content blocks. | Every admin and public post query is global. |
| `AicedArticleCampaignHandoff` / `public.aiced_article_campaign_handoffs` | `post_id → posts.id` (`CASCADE`); globally unique `workflow_token`; one optional `Campaign`; indexes on post and expiry. Stores workflow/campaign/audience proposal state. | A bearer-like workflow token can locate a global workflow after shared Basic auth. |
| `Subscriber` / `public.subscribers` | `status` check: active/unsubscribed/suppressed; global expression unique index `lower(email)`; many-to-many tags; campaign-recipient relationship. | A contact cannot exist in two clients; all searches/counts are global. |
| `SubscriberTag` / `public.subscriber_tags` | Globally unique `normalized_name`; many-to-many subscribers. | One client's tag namespace affects every client. |
| `subscriber_tag_assignments` | Composite primary key `(subscriber_id, tag_id)`; cascade FKs to subscriber and tag. | Safe only if both parent IDs are rigorously tenant scoped. |
| `Campaign` / `public.campaigns` | `workflow_handoff_id → handoff` (`RESTRICT`), `post_id → posts` (`RESTRICT`); unique handoff ID; status check; recipient relationship. | Campaigns can be reached through globally selected handoffs/posts. |
| `CampaignRecipient` / `public.campaign_recipients` | `campaign_id → campaigns` (`CASCADE`), `subscriber_id → subscribers` (`RESTRICT`); unique `(campaign_id, subscriber_id)`; delivery status check. | Snapshot is safe only if campaign and subscriber have the same organization. |

### Current foreign-key graph

`Post ← AicedArticleCampaignHandoff ← Campaign ← CampaignRecipient → Subscriber ← subscriber_tag_assignments → SubscriberTag`; `Campaign → Post` also exists. Existing FK integrity is useful, but it does not prove that both referenced rows belong to the same client.

### Existing migrations

1. `3d38b783e80f_create_posts_table.py` creates `public.posts`.
2. `b9e266fbce0f_create_subscriber_foundation.py` creates subscribers, tags, assignments, status check, and the global email index.
3. `c4a2f9d87b11_create_aiced_article_campaign_handoffs.py` creates workflow handoffs.
4. `d71f9a2c4e63_create_campaign_persistence.py` creates campaigns and recipient snapshots.

No migration currently has users, organizations, memberships, RLS policies, tenant keys, or tenant-aware uniqueness constraints.

## 2. Proposed Phase 0 control-plane models

Use UUID primary keys for new identity/control-plane entities. Existing integer IDs may stay; tenant ownership is expressed with a non-null `organization_id` FK. UUIDs avoid exposing sequential organization IDs and ease external identity-provider mapping.

### `organizations`

| Column | Design |
| --- | --- |
| `id` | UUID primary key, server generated |
| `slug` | normalized unique identifier for internal URLs; globally unique |
| `name` | required display/business name |
| `status` | `active`, `suspended`, or `archived` check constraint |
| `created_at`, `updated_at` | server timestamps |

Do not use a mutable domain as the organization identifier.

### `users`

Use an identity-provider subject as the primary link rather than storing passwords.

| Column | Design |
| --- | --- |
| `id` | UUID primary key, normally equal to/linked with Supabase Auth `auth.users.id` |
| `auth_subject` | unique provider subject UUID/string |
| `email` | normalized informational copy; provider remains identity source |
| `display_name` | nullable profile display name |
| `created_at`, `updated_at`, `last_seen_at` | audit/lifecycle fields |

Never model application passwords or copy password hashes out of Supabase Auth.

### `organization_memberships`

| Column | Design |
| --- | --- |
| `organization_id` | FK to organizations, cascade delete only if organization lifecycle permits it |
| `user_id` | FK to users |
| `role` | constrained to `owner`, `admin`, `editor`, `viewer` |
| `created_at`, `updated_at`, `invited_by_user_id`, `revoked_at` | lifecycle/audit fields |

Unique active membership rule: one active `(organization_id, user_id)` membership. A partial unique index is preferable if revoked membership history is retained. At least one owner must be protected by application-level transaction checks; a simple check constraint cannot enforce this across rows.

Role baseline:

| Role | Baseline authority |
| --- | --- |
| Owner | memberships, organization settings/integrations, all editorial and campaign actions |
| Admin | editorial/subscriber/campaign settings, but not transfer/delete the last owner |
| Editor | posts, Aiced drafts, subscribers, draft campaigns; no integration credentials or member management |
| Viewer | read-only dashboard/history; no draft mutation, publish, prepare, or send |

Exact send authority should be an explicit policy decision (owner/admin only is recommended for the first multi-tenant release).

### `organization_settings`

One-to-one with organization (`organization_id` unique). Store nonsecret configuration: business name, logo asset reference, brand presentation tokens, email sender identity reference/approved sender metadata, timezone, public-site defaults, and feature flags. Put client-specific AI context in a dedicated table or versioned JSONB column, not UI conditionals.

Sensitive provider credentials must **not** be placed in ordinary settings JSON. Store encrypted secret references in an integration table and decrypt only server-side.

### `audit_events`

Append-only product audit trail:

| Column | Design |
| --- | --- |
| `id` | UUID or bigint primary key |
| `organization_id` | required FK/index |
| `actor_user_id` | nullable FK for system/public actions |
| `event_type` | controlled vocabulary, e.g. `post.published`, `campaign.prepared`, `campaign.send_requested` |
| `entity_type`, `entity_id` | target resource reference |
| `request_id`, `ip_hash`, `user_agent` | privacy-reviewed request correlation; avoid raw sensitive data where not needed |
| `metadata` | redacted structured metadata, never plaintext secrets or full email content |
| `created_at` | immutable server timestamp |

Indexes: `(organization_id, created_at DESC)`, `(organization_id, entity_type, entity_id)`, and optionally request ID.

### Tenant keys for existing tables

Add `organization_id UUID NOT NULL REFERENCES public.organizations(id)` to these tenant-owned records:

- `posts`
- `subscribers`
- `subscriber_tags`
- `aiced_article_campaign_handoffs`
- `campaigns`
- `campaign_recipients`

The assignment table need not duplicate the key when parent rows are protected, but adding `organization_id` to `subscriber_tag_assignments` is recommended for direct RLS and fast integrity checks. If it is added, the database should enforce that assignment, subscriber, and tag share an organization using composite foreign keys or triggers. This is a later migration design decision; do not add a redundant key without enforcing consistency.

`CampaignRecipient.organization_id` is intentionally recommended even though ownership derives from Campaign/Subscriber: it makes RLS, retention, incident investigation, and tenant-scoped history queries reliable. Its writes must verify it equals both parent organizations.

### Uniqueness and indexes that must become tenant-scoped

| Current global rule | Required tenant-safe replacement |
| --- | --- |
| `uq_subscribers_email_lower` on `lower(email)` | unique `(organization_id, lower(email))` expression index |
| `SubscriberTag.normalized_name` unique | unique `(organization_id, normalized_name)` |
| `AicedArticleCampaignHandoff.workflow_token` unique | Can remain globally unique for opaque lookup safety; also query by organization. Do not weaken to tenant-only uniqueness. |
| `Campaign.workflow_handoff_id` unique | Remains globally unique because handoff IDs are global; add `(organization_id, workflow_handoff_id)` index for scoped access. |
| `CampaignRecipient(campaign_id, subscriber_id)` | remains correct; add organization index and application/database same-tenant guarantee. |
| organization slug | global unique normalized slug |
| membership | unique active `(organization_id, user_id)` |

Add indexes starting with `organization_id` for every dominant query: posts by status/published date; subscriber status/search; tags normalized name; handoffs workflow token/expiry; campaigns status; recipients status. Query patterns must drive final index order after staging explain plans.

## 3. Authentication design for Flask/Jinja and Supabase Auth

### Recommended approach

Use **Supabase Auth for individual identity** and have Flask validate the signed access token against Supabase's JWKS/issuer/audience. Flask remains the authorization policy enforcement point and maintains a minimal server-side session after a validated login. This fits server-rendered Jinja pages while avoiding a custom password system.

Initial flow:

1. User visits `/login`; the browser uses a hosted or embedded Supabase Auth sign-in flow.
2. Callback supplies a short-lived, validated identity assertion to Flask over HTTPS.
3. Flask verifies signature, issuer, audience, expiry, nonce/state, and subject; it finds/creates the local `users` record only after verification.
4. Flask builds a server-side session containing a random session ID, authenticated user ID, active organization ID, membership revision, and expiry. Cookie contains only an opaque signed/session identifier, marked `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter after callback testing).
5. Each protected request loads session and membership fresh or against a short cache with revocation/version checking. `current_user` and `current_organization` are established before route execution.
6. `/logout` invalidates the server-side session and clears the cookie. It does not need to globally revoke Supabase refresh tokens unless product requirements call for that.

Avoid treating an unverified browser-provided organization ID, email, or JWT payload as authorization.

### Authorization interface

Replace global `require_editor_auth` with composable boundaries such as:

- `require_authenticated_user`
- `require_organization_role("viewer")`
- `require_organization_role("editor")`
- `require_organization_role("admin")`
- `load_tenant_resource_or_404(model, id)`

The route must still select the resource by both primary key and `organization_id == current_organization.id`; a decorator alone cannot repair global `db.session.get(...)` calls inside a route.

### Sessions, expiry, and CSRF

- Use short access/session lifetime and renewal with provider refresh rules; force reauthentication for sensitive integration changes and campaign send approval.
- Rotate session IDs at login and privilege/organization changes; invalidate on membership revocation.
- Cookie-authenticated writes require CSRF tokens checked for POST/PATCH/DELETE, including JSON endpoints. SameSite is defense-in-depth, not the sole CSRF control.
- For non-browser APIs, accept validated bearer tokens and use the same membership/tenant authorization helper. Do not use service-role credentials in the browser.
- Maintain the current dashboard appearance; auth can replace the existing Basic-auth challenge without a UI redesign.

### Transitional rule

Do not run Basic auth and user auth as two equally privileged production paths. During migration, Basic auth may be a tightly time-boxed operational fallback behind an explicit deployment feature flag, but it must map to a named initial-organization service/admin actor and be removed after migration verification.

## 4. First-client data migration design

This must be a reviewed, rehearsed maintenance deployment. It must not assume an empty Supabase project.

### Pre-migration checklist

1. Confirm the exact Supabase project, environment, current Alembic revision, and database owner. Never use a copied URL from another client.
2. Take a tested logical backup/snapshot and document restore ownership, encryption, location, retention, and recovery time. Validate restoration into an isolated nonproduction database.
3. Record row counts and referential-integrity baselines for all current application tables; record counts by post/campaign/recipient/subscriber status and tag assignment.
4. Check duplicates that will matter after tenant constraints (case-insensitive subscriber email and normalized tag names), invalid FKs, nulls, orphan snapshots, and migration locks/long transactions.
5. Rehearse the exact migration and verification scripts against a sanitized production-shaped restore. No real sending in rehearsal.

### Ordered migration strategy

1. Create `organizations`, `users`, `organization_memberships`, `organization_settings`, and `audit_events`; do not touch application records yet.
2. Insert the initial organization with an immutable recorded migration identifier. Add settings using the existing first-client branding values as data, not new environment values.
3. Add nullable `organization_id` columns and non-unique supporting indexes to each existing tenant-owned table. Avoid immediately adding `NOT NULL` on a large populated table.
4. In one controlled transaction or explicitly restartable/idempotent batches, backfill every existing row with the initial organization ID. Backfill parent records first, then dependent records. Do not derive tenant from mutable text fields.
5. Verify `COUNT(*) WHERE organization_id IS NULL = 0` for every table; verify all join chains retain the same organization ID; compare after counts to baseline counts.
6. Add `NOT NULL` and FKs; replace global uniqueness with the scoped indexes only after the backfill passes. Add required composite/indexed tenant query paths.
7. Deploy tenant-aware application code and authorization boundary as a coordinated release. Existing code must not be allowed to query unscoped global data after constraints are installed.
8. Enable RLS only after policies are tested from the intended database roles and server behavior is verified. Service-role/database-owner connections can bypass RLS; server authorization remains mandatory.

### Backfill verification queries (design only)

Verify at minimum:

- non-null organization ID count equals total count for each tenant table;
- every handoff has the same organization as its Post;
- every Campaign has the same organization as Handoff and Post;
- every CampaignRecipient has the same organization as Campaign and Subscriber;
- every tag assignment joins to same-organization subscriber and tag;
- baseline rows equal post-migration rows; no data or recipient snapshots disappear;
- scoped email/tag uniqueness has no unexpected collision.

### Rollback strategy

Before the destructive point of no return (dropping/replacing global unique indexes or enabling mandatory auth), rollback is an application deploy rollback plus removal of newly added **nullable** columns/tables only if no tenant writes were accepted. After live writes begin, schema downgrade is unsafe: restore from verified backup or roll forward with a corrective migration. Never attempt an ad hoc delete of tenant keys to “undo” the conversion.

Database migration must have a documented lock timeout, statement timeout, maintenance window, success/failure owner, and a go/no-go checkpoint before constraints are made non-null.

## 5. Tenant isolation and route authorization plan

### Mandatory server-side rule

Every read, update, delete, publish, prepare, and send must start from `current_organization`. Do not retrieve by an unscoped ID/token and check later. A missing/nonmatching record should generally be `404` to avoid cross-tenant resource enumeration; unauthenticated requests are `401`, authenticated insufficient roles are `403` where no target is exposed.

### Routes that currently use global data

| Area | Current global dependency | Required organization boundary |
| --- | --- | --- |
| Public `/`, `/blog/<id>`, `/posts/<id>`, cover media | global published posts and direct `Post` lookup | Resolve organization from verified request host/domain mapping first, then select that org's published post. Canonical URLs/domains must be tenant aware. |
| `/dashboard`, `/aiced`, post pages, campaign page, subscribers page | one shared Basic credential and no active tenant | authenticated membership plus active organization context; role-based page access. |
| Post APIs, upload, AI enhance/edit | global post ID/list and shared Storage bucket behavior | scope posts to organization; path prefix/asset record; editor role. |
| Subscriber/tag APIs | global lists, counts, email uniqueness, tag lookup and deletion | scope every query, tag resolution, duplicate rule, assignment, and count. |
| Legacy campaign preview/proposal/test send | global published posts/tags and global sender config | scope all source data/settings; restrict send/test role and log event. |
| Marketing package and unapproved revisions | global tags/context and shared AI configuration | scope tags and use only current org AI profile. |
| Handoff/workflow restore/PATCH/revisions/image/publish/email preview | lookup by globally unique workflow token then direct global post lookup | query `handoff` by both token and org; verify linked Post same org; editor/admin role. |
| Audience preview/prepare/remove/send | workflow → campaign/subscriber lookup is global | scope handoff, campaign, recipient and subscriber at each join; require elevated send role; audit. |
| `/api/posts` and `/api/admin/posts` operations | direct `Post` IDs/global status lists | scope query and all mutation targets. |

### Resource-specific protections

- **Workflow tokens:** remain opaque/global unique, but never confer access alone. Require authenticated membership and `handoff.organization_id == current_organization.id` at each endpoint.
- **Campaign recipients:** prepare only from same-organization active subscribers. At snapshot creation, assert campaign, handoff, post, subscriber, and recipient use the same organization. Recipient removal/send queries must use campaign organization too.
- **Media:** define object names as `organizations/<org_uuid>/article-images/<uuid>.<ext>`; persist a tenant-owned asset reference/path. Public images can be served by a public CDN/bucket only when object paths are unguessable is **not** treated as authorization. Draft/private assets need signed URLs or authenticated media proxy. Upload authorization must be server-side.
- **Public articles:** add an `organization_domains`/verified host configuration in a later batch. Reject unknown Host headers; do not infer organization from a query parameter supplied by the browser.

### Supabase RLS

RLS is defense-in-depth for direct Supabase Data API/client access, not a replacement for Flask authorization. If the application remains the sole database client, it can use a restricted database role with RLS enforced and a request-scoped `app.current_organization_id` setting; do not use an owner/service role that bypasses policies for ordinary requests. Policies should require an authenticated JWT subject with active membership for the requested organization, and must be exercised in integration tests. Storage policies should restrict object prefixes by organization and operation.

## 6. Test plan

Use isolated transactional databases or dedicated test schemas; never create test records in production Supabase. Add unit tests for scoped query helpers, endpoint tests for authorization, and one integration suite against a real Postgres/Supabase-compatible environment with RLS enabled.

| Test | Proof |
| --- | --- |
| Cross-tenant post/subscriber/tag read | User from org A receives 404/403 and no serialized data for org B resource IDs. |
| Cross-tenant write | Org A cannot PATCH/delete org B post/subscriber/tag or attach org B tag. |
| Duplicate emails | `same@example.com` can be active once in org A and once in org B; case variants conflict only inside the same organization. |
| Tag namespace | Same normalized tag may exist in two organizations and resolver selects only current org's tag. |
| Audience AND semantics | Campaign in org A cannot select org B subscriber; active-only and ALL-tag matching remain unchanged. |
| Workflow token | Valid org A token accessed by org B is denied, including restore, PATCH, revision, image, publish, audience preview, prepare, recipient removal, and send. |
| Campaign/snapshot isolation | Cross-organization post/handoff/subscriber combination fails before persistence; recipient snapshot only contains owning-org contacts. |
| AI isolation | Prompt/context assembly contains only current org settings/tags/posts and no organization B business description, names, content, or contacts. |
| Public host routing | Two verified hosts render only their own published article/home; unknown/mismatched host does not reveal another org article. |
| Authentication/roles | Anonymous calls fail; viewer cannot mutate/publish/prepare/send; editor cannot manage secrets/memberships; send policy is enforced server side. |
| CSRF/session | Cookie-authenticated state-changing call without CSRF fails; expired/revoked/rotated session fails. |
| Single-client regression | Existing initial organization can create/edit/publish article, manage subscribers, generate/revise Aiced drafts, preview audience, prepare snapshot, and retain current no-resend/inactive-recipient safeguards. |
| RLS/Storage | Direct role/API attempts cannot select/write another org or upload outside its prefix. |

Existing tests in `tests/test_ai_marketing_package.py`, `tests/test_ai_edit.py`, workspace DOM contracts, and subscriber page contracts should be retained and amended to establish an organization/session fixture; they currently largely mock global lookups and Basic auth.

## 7. Reviewable implementation batches

### Batch 0A — decision record and test harness

- **Files:** `docs/` architecture decision record, test fixtures/conftest, no runtime routes/models.
- **Database:** none.
- **Tests:** define organization fixture factory and prohibited-cross-tenant test matrix; existing tests remain unchanged unless fixture scaffolding is harmless.
- **Acceptance:** approved auth provider, session model, role/send policy, domain model, migration/backfill runbook, and exact tenant-owned table list.
- **Risk/rollback:** no production risk; delete/revert documentation/test-only changes normally.

### Batch 0B — control-plane schema, not yet enabled

- **Files:** `models.py`, new reviewed Alembic revision, migration test, admin-independent auth/config module skeleton only if separately approved.
- **Database:** create organizations/users/memberships/settings/audit tables and indexes. Do not add second client or turn on auth cutover.
- **Tests:** migration upgrade/downgrade against empty and production-shaped backup; constraints/role declarations.
- **Acceptance:** schema applies/reverts in rehearsal and does not change existing app query behavior.
- **Risk/rollback:** low if additive only; downgrade allowed only before live use of new tables.

### Batch 0C — ownership backfill and tenant columns

- **Files:** models, Alembic migration(s), migration verifier/runbook, test fixtures.
- **Database:** add nullable organization keys, initial organization, idempotent backfill, verification, indexes, then `NOT NULL`/FK/scoped uniqueness after proof.
- **Tests:** row-count/integrity verification and duplicate-email/tag rules across two test organizations.
- **Acceptance:** all existing data belongs to exactly the initial organization; zero unscoped rows; no content/recipient loss.
- **Risk/rollback:** highest data migration risk; require backup restore rehearsal and no second tenant before success.

### Batch 0D — authentication and request context

- **Files:** Flask app factory/auth module, templates for login/callback/logout only as needed, session/CSRF config, tests.
- **Database:** users/memberships populated only for approved first-client admins.
- **Tests:** token verification, callback state/nonce, session expiry, CSRF, roles, logout/revocation.
- **Acceptance:** no shared Basic-only admin access; every protected request resolves a user + organization safely.
- **Risk/rollback:** dashboard access outage. Keep a documented, time-limited break-glass procedure—not an unaudited permanent global credential.

### Batch 0E — scoped route conversion

- **Files:** `app.py` decomposed cautiously into scoped service/query helpers, models, tests; no frontend redesign.
- **Database:** tenant query indexes; RLS only after server code is fully scoped.
- **Tests:** endpoint-by-endpoint cross-tenant matrix plus all current functional tests.
- **Acceptance:** every listed route is organization scoped; IDs/tokens cannot cross tenants; existing initial-client workflows pass.
- **Risk/rollback:** broad behavior surface. Deploy behind a maintenance/read-only window or staged environment; roll forward unless no tenant writes occurred.

### Batch 0F — public domains, Storage, and RLS hardening

- **Files:** domain/asset/integration modules, public routing, Storage policy deployment/runbook, tests.
- **Database:** organization domain/asset records; RLS policies and tenant object-prefix rules.
- **Tests:** host resolution, public/private media, direct RLS denial, CORS/origin policy.
- **Acceptance:** verified domains serve only their content; assets and public content remain crawlable where intended.
- **Risk/rollback:** SEO/domain and media availability risk; preserve legacy canonical redirects and test each domain before DNS switch.

## Smallest safe implementation task for one Codex session

Create an **approved migration-readiness package only**: a testable Python/Alembic design specification that enumerates the exact initial-organization backfill checks (row counts, null checks, same-tenant join checks), plus isolated tests that assert the *proposed* scoped uniqueness requirements against a temporary PostgreSQL database. It must not run against Supabase, change models, or create production records.

Before that task begins, approve two unresolved product decisions: (1) the Supabase Auth login UX/provider configuration and (2) which role may authorize real campaign sends. Those choices determine the final session/role schema and cannot be safely guessed.
