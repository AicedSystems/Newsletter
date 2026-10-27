# Aiced Bot — Reusable Multi-Client Marketing Platform Architecture

**Status:** planning audit only, 2026-10-21. This document does not authorize a database migration, data move, sending change, or production integration.

## 1. Existing implementation

### Audit scope

This repository is a Flask application using SQLAlchemy, Flask-Migrate, PostgreSQL/Supabase, server-rendered Jinja pages, vanilla JavaScript, OpenAI, Resend, and Supabase Storage. No separate `agentarmijo.com` repository was found in the inspected workspace; only copies of this Newsletter Website repository were present. The current public-site integration is therefore assessed from the app's own public routes.

### Current frontend/page routes

| Area | Routes/pages | Status |
| --- | --- | --- |
| Public publication | `/`, `/blog/<post_id>`, legacy `/posts/<post_id>`, `/media/posts/<post_id>/cover` | Completed for this one application/site. Published articles are rendered as crawlable HTML. |
| Admin content CMS | `/dashboard`, `/posts/new`, `/posts/new/build`, `/posts/new/paste`, `/posts/archive` | Completed/active. Supports article creation, editing, archive, deletion, structured blocks, and cover images. |
| Aiced workspace | `/aiced` | Active and substantial. Generates/revises a draft marketing package, edits article/CTA/campaign/audience, generates/uploads a featured image, publishes explicitly, prepares recipients, and reviews delivery. |
| Subscriber management | `/subscribers` | Active. Add/edit/search/filter subscribers; controlled tags; active/unsubscribed/suppressed state protections. |
| Legacy/browser campaign builder | `/campaigns/new` | Partial/legacy alongside the Aiced campaign workflow. It supports preview/proposal/test-send behavior but should not become a second long-term campaign domain model. |

The common visual shell lives in `templates/_admin_sidebar.html`, with page-specific templates and CSS/JS under `templates/` and `static/`. It is currently a shared shell only within this one application, not a tenant-aware product shell.

### Current Flask API surface

| API group | Current endpoints/capability | Status |
| --- | --- | --- |
| Posts/media | image upload, post CRUD/list/admin-list, AI enhance/edit | Active. Posts are global to the database. |
| Subscribers/tags | `GET/POST /api/subscribers`, `PATCH /api/subscribers/<id>`, tag create/delete | Active. Case-insensitive email uniqueness and tag normalization exist. |
| Legacy campaign APIs | campaign preview, Aiced proposal, explicit test-send | Partial/legacy. |
| Aiced proposal/workflow | marketing-package generation/revision, draft handoff, workflow restore/PATCH, article publish, image generation, revision preview/acceptance | Active. Human review is built into the workflow. |
| Audience/campaign delivery | saved/proposed audience preview, campaign prepare, recipient removal, controlled send | Active for this app. Recipient snapshots are durable and active-only targeting is enforced. |

All editor APIs currently use one process-wide HTTP Basic credential via `EDITOR_USERNAME` and `EDITOR_PASSWORD`. There are no individual users, organizations, sessions, roles, OAuth/OIDC, or tenant checks.

### Current database and Supabase use

Alembic migrations define these application tables in the PostgreSQL `public` schema:

| Table | Current purpose |
| --- | --- |
| `posts` | Article content, status, publication time, structured blocks, featured image URL/path. |
| `subscribers` | Email, name, consent/delivery status. Active is the only delivery-eligible status. |
| `subscriber_tags` | Normalized reusable audience tags. |
| `subscriber_tag_assignments` | Subscriber/tag many-to-many association. |
| `aiced_article_campaign_handoffs` | Draft workflow token and Aiced article/campaign/audience context. |
| `campaigns` | Durable prepared campaign record. |
| `campaign_recipients` | Frozen recipient/email snapshot and delivery status. |

Supabase is used as PostgreSQL plus a public `article-images` Storage bucket. The Flask server uses a server-side Storage service-role key for upload. The browser does not receive that key. Supabase Auth is not used by the application. The repository does not contain RLS policies, so RLS status must be verified in the intended Supabase project before relying on it.

### Existing client configuration and integration points

Current client-specific settings are environment variables, including a public site base URL, email brand strings, sender identity, OpenAI key/model, Resend key, Storage project/bucket, and a single editor credential. `email_renderer.py` already centralizes newsletter branding and builds a public article URL from `PUBLIC_BASE_URL`.

This is a useful first extraction point, but environment variables are process-wide. They cannot safely represent multiple simultaneously active clients in one deployed application.

### What is complete, partial, and missing

**Complete enough to reuse:** structured publishing; public article rendering; media upload; subscriber status protections; normalized audience tags; active-only AND audience resolution; human-reviewed Aiced proposals/revisions; durable campaign/recipient snapshot records; basic branded email rendering.

**Partial or coupled:** a legacy campaign builder overlaps the newer Aiced workflow; campaign content is partly derived from published posts rather than a universal template/block model; configuration is environment-scoped; workflow tokens are global rather than organization-scoped; image storage has one fixed bucket; navigation and branding are static.

**Missing for a platform:** organizations, membership/roles, tenant scoping in every query, tenant-safe authentication, an audited configuration store, reusable templates, signup/widget APIs, domain verification, cross-origin controls, import/CRM connectors, audit logs, jobs/queues, tenant-aware analytics, retention policy, and a self-service installation model.

## 2. Product architecture recommendation

The current Flask stack can support a multi-client Aiced product without a wholesale rewrite. The important change is **data and authorization boundaries**, not a duplicate dashboard per customer.

Recommended shape:

```text
One Aiced Flask application
  ├── authenticated user + selected organization
  ├── shared Jinja/vanilla-JS dashboard and campaign builder
  ├── organization-scoped PostgreSQL data
  ├── organization configuration and integrations
  ├── public delivery routes by mapped domain or publication slug
  └── optional website widgets/API clients
```

The dashboard code remains one codebase. It reads the current organization’s branding, publishing settings, AI context, and integrations from server-provided configuration. A client should never require a fork of `templates/`, `static/`, or `app.py` merely to change a logo, sender, or voice.

### Recommended boundaries

1. **Control plane:** organizations, users, memberships, roles, domain configuration, integration records, and audit events.
2. **Tenant content plane:** posts, assets, subscribers, tags, workflows, campaigns, recipients, templates, and analytics, each associated with exactly one organization.
3. **Public delivery plane:** public article and widget endpoints resolve an organization from a verified host/domain or a stable public slug, never from a browser-supplied organization ID.
4. **Integration plane:** server-side connector adapters use tenant-specific encrypted credentials; provider code never becomes part of a client-specific UI fork.

## 3. Recommended data model

Names are illustrative; exact naming should be reviewed before a migration.

| Table | Core fields/purpose |
| --- | --- |
| `organizations` | `id`, `slug`, `name`, `status`, timestamps. Product tenant boundary. |
| `users` | Identity-provider subject, email, timestamps. Prefer Supabase Auth identity or an external OIDC subject; do not store reusable passwords here. |
| `organization_memberships` | `organization_id`, `user_id`, `role`, timestamps. Roles: `owner`, `admin`, `editor`, `viewer`; add narrowly scoped sender/integration roles only when needed. |
| `organization_settings` | One row per organization: brand name, logo asset reference, colors, public base URL, default locale/timezone, sender configuration reference, and feature flags. Keep secrets out of this table. |
| `organization_domains` | Verified custom/public domains, domain type, verification state, timestamps. |
| `organization_ai_profiles` | Business description, services, service areas, approved brand voice, compliance notes, editorial goals, timestamps/version. |
| `organization_integrations` | Provider, encrypted credential reference, nonsecret settings JSON, status, external account ID, sync cursor, timestamps. |
| `email_templates` / `email_template_versions` | Tenant-owned reusable templates/blocks and immutable version history. |
| `assets` | Tenant-owned storage object key, public URL if applicable, MIME type, dimensions, checksum, lifecycle state. |
| `audit_events` | Organization, actor, action, resource type/id, safe metadata, timestamp, request correlation ID. |

Add a non-null `organization_id` foreign key to every tenant-owned current table:

- `posts`
- `subscribers`, `subscriber_tags`, and assignments (assignments should be constrained to same-organization parents)
- `aiced_article_campaign_handoffs`
- `campaigns` and `campaign_recipients`
- future templates/assets/analytics rows

### Key constraints and indexes

- Tenant-local uniqueness: `unique(organization_id, lower(email))`, `unique(organization_id, normalized_name)`, `unique(organization_id, slug)`, and tenant-scoped public slugs.
- Composite foreign keys or server-side checks to prevent cross-organization assignment links.
- Every query index begins with `organization_id` where the common access pattern is tenant-scoped, for example `(organization_id, status, published_at)` and `(organization_id, created_at)`.
- Campaign recipient snapshot/email records remain immutable for campaign-history accuracy, even if a subscriber later changes.

Do not use an organization name or client hostname as the durable primary key. Use an internal ID plus a unique public slug/domain mapping.

## 4. Multi-tenant security design

### Authentication and authorization

Replace the single global Basic credential with individual authenticated users. A practical path is Supabase Auth or another managed OIDC provider, with Flask validating signed access tokens server-side. On every authenticated request:

1. Validate the token/session.
2. Resolve the organization from an explicit, validated organization context (subdomain, selected organization, or route), not client-provided JSON alone.
3. Load the caller’s membership.
4. Authorize the requested action by role and organization.
5. Apply `organization_id` to every ORM query and write.

Workflow tokens must be treated as opaque secondary identifiers only. They must still be checked against the authenticated organization and linked post/campaign before returning data or accepting a mutation.

### Database/RLS strategy

Use defense in depth:

- Flask application queries must always scope by `organization_id`; frontend filtering is never a security control.
- Enable Supabase Row Level Security on tenant tables accessed through Supabase client APIs, with policies requiring membership in the row’s organization.
- Prefer direct PostgreSQL access from Flask through a least-privilege server role. A Supabase service-role key bypasses RLS and must stay server-only; it is suitable for narrowly scoped Storage operations, not browser access.
- If Flask connects using a role that bypasses RLS, server-side organization authorization is mandatory and should be covered by cross-tenant regression tests.

### Secrets and integrations

- Store provider credentials in a managed secret store/KMS or encrypted envelope fields; store only a secret reference/key version in ordinary settings where possible.
- Never place Resend, OpenAI, CRM, Supabase service-role, or database credentials in browser JavaScript.
- Separate tenant-specific Resend sender/domain configuration from Aiced platform operational credentials.
- Log request IDs and integration status, but redact authorization headers, keys, raw provider payloads, subscriber email lists, and prompts containing private data.

### Mandatory isolation tests

- A user in Organization A cannot read, edit, upload, preview, publish, prepare, send, or delete Organization B resources, even with a valid B resource ID/token.
- Tenant-local uniqueness allows the same email/tag name in two organizations but not duplicates inside one.
- Public host/domain resolution cannot be spoofed with a query parameter or `Origin` header.
- No RLS policy permits anonymous listing of private subscriber/campaign rows.
- Connector callbacks/webhooks resolve and verify only the owning organization.

## 5. Reusable dashboard structure

Keep the existing sidebar/page layout, but make it configuration-driven:

```text
Shared shell
  ├── organization switcher (membership-aware)
  ├── Dashboard
  ├── Aiced workspace
  ├── Articles
  ├── Campaigns
  ├── Subscribers
  ├── Templates (future)
  ├── Integrations (future)
  └── Settings: Brand, domains, sender, AI profile, members
```

The server should inject a minimal safe organization presentation object (name, logo URL, permitted navigation/actions, public site status). Do not expose integration secrets or a cross-tenant organization list to ordinary editors.

Feature flags should be organization settings, not `if client_name == ...` branches. For example, CRM sync, custom sender domain, or branded signup widget can be enabled per tenant without changing dashboard code.

## 6. Universal campaign builder

Build one campaign domain model and UI, evolving the durable `Campaign` and `CampaignRecipient` foundation already present.

### Target workflow

1. Select/create a campaign draft from a published article or a reusable template.
2. Edit internal campaign name, subject, preview/preheader, body/template blocks, CTA, and cover asset.
3. Render deterministic desktop/mobile/browser previews using the same renderer used for delivery.
4. Select a tenant-scoped audience using explicit status/consent constraints and tags.
5. Show a live proposed count only; prepare freezes the validated audience and rendered content into a recipient/send snapshot.
6. Require a human review/approval action before a send becomes eligible.
7. Record campaign history, recipient outcome, provider message ID, and immutable content/template version.

### Required product behavior

- Drafts are editable and never send.
- A test-send workflow is distinct from a production send and is tenant-authorized.
- Sending should eventually run as an idempotent queued job with provider rate limits, retries, and stop-on-suppression behavior; do not broaden the current synchronous controlled-send implementation in the first platform release.
- Unsubscribed and suppressed contacts are never selected. A later external sync cannot silently reactivate them.
- Reusable templates are versioned; a campaign references the exact template/content version it was approved with.

## 7. Website integration strategy

### Public articles

Keep tenant public articles server-rendered and crawlable. Recommended public URL patterns are either:

- verified custom domain: `https://client.example/blog/<slug>`; or
- temporary hosted publication: `https://client.aiced.app/blog/<slug>`.

Resolve the organization only from the verified request host plus public article slug. Render canonical URLs, Open Graph metadata, sitemap/robots support, and a tenant-specific article layout/theme from safe configuration. Avoid rendering a client’s subscriber or campaign data on public endpoints.

### Signup widgets

Offer a small versioned embed script rather than copied dashboard code:

```html
<script async src="https://cdn.aiced.app/signup.js"
  data-aiced-public-key="pk_..."
  data-aiced-form="newsletter"></script>
```

The widget uses a public, tenant-scoped key restricted to verified origins. Its API should accept minimal signup fields, enforce rate limiting/bot protection, record source/consent text/version/time, and never accept status changes such as suppression overrides. Use double opt-in where required by a tenant’s compliance policy.

### Installation models

| Website type | Recommended integration |
| --- | --- |
| Static HTML/CSS/JavaScript | Embed signup widget; link to hosted/canonical Aiced articles or optionally use a build-time article feed. |
| React/Next.js | Widget or typed public REST/JSON feed for cards; article detail should be server-rendered/SSG from Aiced data or canonical-link to Aiced-hosted HTML. |
| CMS/other future platforms | Widget plus documented public content API/webhook. Add platform adapters only after generic API/hosted publication works. |

### CORS and abuse prevention

- Public widget APIs use strict per-tenant allowlisted origins, `POST` only, payload limits, rate limits, CAPTCHA/Turnstile or equivalent, and server-side public-key lookup.
- Do not use permissive `Access-Control-Allow-Origin: *` for signup writes.
- Admin APIs remain same-origin/authenticated and do not rely on CORS as authentication.
- Domain ownership must be verified with DNS or hosted-file challenge before a domain can be used for public content, sender identity, or widget origin.

## 8. Aiced Bot assistant integration

Each Aiced request must load context only from the current organization:

- organization business description and services;
- service areas and permitted claims/compliance notes;
- brand voice, reading level, and editorial preferences;
- approved website/article material selected for retrieval;
- stated campaign goals and existing tenant audience-tag vocabulary.

Do not put one tenant’s profile, articles, tags, subscribers, CRM data, or examples into another tenant’s prompt. Build a server-side `AicedContext` object from organization-scoped queries, pass only minimum necessary content to the model, and keep provider calls behind the existing validated structured-output boundary.

AI may propose content, CTA, campaign fields, or tenant-valid tags. It must not publish, prepare recipients, send email, create integrations, or override consent state. Existing human revision acceptance and explicit publish/send controls are the correct product direction and should remain mandatory.

Future retrieval should be tenant-partitioned (for example, a vector store namespace per organization), with document provenance and an operator-controlled inclusion policy. Do not index raw subscriber data for general model retrieval.

## 9. Future CRM, email, and analytics integrations

Implement connectors behind a provider-neutral interface, for example:

```text
IntegrationAdapter
  ├── validate_configuration()
  ├── pull_contacts(cursor)
  ├── push_consent_safe_update()
  ├── receive_verified_webhook()
  └── health_status()
```

### Follow Up Boss

Follow Up Boss is an optional CRM adapter, not a platform dependency. It should map external contact IDs to tenant subscriber records, track sync provenance, and use explicit field/tag mapping configured per organization. Rules:

- local unsubscribe/suppression wins over an inbound CRM `active` value;
- imports/syncs never automatically reactivate opt-outs;
- sync preview and reconciliation happen before writes;
- CRM API credentials are tenant-specific encrypted integration records;
- webhook signatures and replay protection are required.

### Email delivery

Use a provider adapter for Resend first, with tenant sender-domain verification and per-tenant sender identity. Provider webhooks update delivery states against immutable `CampaignRecipient` records only after signature verification and tenant/provider-account validation. Keep direct test sends explicitly controlled and separate from production campaign sends.

### Analytics

Start with delivery state and provider event ingestion. Add opens/clicks only with tenant privacy policy, consent, retention, and regional compliance settings. Analytics rows must be organization-scoped; aggregate dashboards should not expose cross-client data.

## 10. MVP implementation roadmap

### Phase 0 — platform decisions and safety inventory

1. Confirm whether this database contains only the first client or must be migrated in place.
2. Select managed user authentication (Supabase Auth is compatible with the current Supabase stack) and role model.
3. Define public-domain, sender-domain, retention, consent, and data-processing policies.
4. Freeze a migration/backfill plan and cross-tenant authorization test matrix before onboarding a second client.

### Phase 1 — tenant/auth foundation

1. Add organizations, users/memberships, organization settings, and audit-event schema.
2. Add organization IDs and tenant-local constraints/indexes to existing tenant data through reviewed migrations and an explicit first-client backfill.
3. Replace global Basic auth with authenticated-user/membership authorization.
4. Add organization scope helpers/repositories and convert every query/write route before enabling a second tenant.
5. Configure/verify RLS for any Supabase client-accessed tenant table.

### Phase 2 — tenant configuration and public publication

1. Move nonsecret brand/public-domain/AI-profile configuration from process environment into organization settings.
2. Add verified organization domain mapping and host-based public article rendering.
3. Move assets to tenant-prefixed Storage keys and tenant-scoped asset records.

### Phase 3 — reusable dashboard and campaign product

1. Convert sidebar/settings to the shared tenant-aware shell.
2. Consolidate legacy campaign creation and Aiced workflow around one durable Campaign draft model.
3. Add versioned reusable email templates and deterministic previews.
4. Preserve the explicit prepare/freeze/review/send sequence.

### Phase 4 — website integration and controlled onboarding

1. Add origin-restricted public signup API and versioned widget.
2. Add public article feed/webhook where needed.
3. Onboard a second non-production tenant to validate isolation, branding, and domain flows.

### Phase 5 — integrations and scale

1. Add Resend webhook/analytics adapter.
2. Add Follow Up Boss sync as an optional connector with consent-safe reconciliation.
3. Add queues, idempotency keys, rate limiting, observability, backups, retention, and incident controls.

## Smallest safe first implementation batch

Do **not** start by making the existing dashboard visually multi-tenant or adding an organization selector. That would create a false impression of isolation while the database and authorization remain global.

The smallest safe batch is a reviewed **tenant/auth foundation design slice**:

1. Write and approve the exact organization, membership, and organization-setting schema plus a per-table tenant-key migration/backfill plan.
2. Add no client data and enable no second client yet.
3. Implement managed user authentication and a server-side `current_organization`/membership authorization boundary in a feature branch.
4. Add cross-tenant denial tests before converting product routes.

The first database-backed implementation should then be one reviewed migration chain that creates control-plane tables and adds organization references, backfills the confirmed first-client organization atomically, and is followed immediately by tenant-scoping all relevant server queries. Only after that batch is verified should Aiced Bot onboard another client.

## Audit conclusion

The current application is a strong functional first-client vertical slice, particularly for human-reviewed Aiced content, subscriber protection, article publishing, and campaign recipient snapshots. It is **not yet safe to market as one shared multi-client platform** because data, credentials, storage configuration, and authorization are currently global. The recommended path is an incremental tenancy/auth foundation followed by configuration extraction—not duplicated client dashboards and not a major frontend rewrite.
