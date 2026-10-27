# Aiced Bot Migration Readiness Specification

**Status:** planning and verification reference only. The SQL below is illustrative PostgreSQL verification SQL; it is not executed automatically by this repository.

## Current tenant-owned tables and relationships

| Table | Existing foreign keys | Existing unique constraints/indexes | Required ownership |
| --- | --- | --- | --- |
| `public.posts` | none | primary key `id` | `organization_id` |
| `public.subscribers` | none | global unique expression index `lower(email)` | `organization_id` |
| `public.subscriber_tags` | none | global unique `normalized_name` | `organization_id` |
| `public.subscriber_tag_assignments` | `subscriber_id → public.subscribers.id` CASCADE; `tag_id → public.subscriber_tags.id` CASCADE | primary key `(subscriber_id, tag_id)` | enforce same organization as subscriber/tag; add a direct key only with composite FK/trigger enforcement |
| `public.aiced_article_campaign_handoffs` | `post_id → public.posts.id` CASCADE | unique `workflow_token`; indexes on `post_id`, `expires_at` | `organization_id` |
| `public.campaigns` | `workflow_handoff_id → public.aiced_article_campaign_handoffs.id` RESTRICT; `post_id → public.posts.id` RESTRICT | unique `workflow_handoff_id`; indexes on post/status | `organization_id` |
| `public.campaign_recipients` | `campaign_id → public.campaigns.id` CASCADE; `subscriber_id → public.subscribers.id` RESTRICT | unique `(campaign_id, subscriber_id)`; indexes on subscriber/status | `organization_id` |

The migration must add the `organizations` control-plane table before assigning ownership keys. Future users, memberships, settings, and audit events are new control-plane tables and do not replace existing integer IDs.

## Parent-to-child backfill order

1. Insert the one confirmed initial organization.
2. Backfill independent parents: `posts`, `subscribers`, `subscriber_tags`.
3. Backfill `subscriber_tag_assignments` only if it receives a direct ownership key; validate it against the already backfilled parents.
4. Backfill `aiced_article_campaign_handoffs` from their linked posts.
5. Backfill `campaigns` from linked handoffs/posts, requiring both values to agree.
6. Backfill `campaign_recipients` from linked campaigns/subscribers, requiring both values to agree.
7. Add non-null constraints, FKs, same-tenant integrity protections, tenant indexes, then replace global uniqueness only after all checks pass.

Never infer organization from a post title, sender address, domain text, or mutable tag. Backfill uses the recorded initial organization ID.

## Pre-migration baseline queries

Run these manually against the *confirmed target database* only during the approved maintenance procedure. Record results with timestamp and current Alembic revision.

```sql
SELECT 'posts' AS table_name, count(*) FROM public.posts
UNION ALL SELECT 'subscribers', count(*) FROM public.subscribers
UNION ALL SELECT 'subscriber_tags', count(*) FROM public.subscriber_tags
UNION ALL SELECT 'subscriber_tag_assignments', count(*) FROM public.subscriber_tag_assignments
UNION ALL SELECT 'aiced_article_campaign_handoffs', count(*) FROM public.aiced_article_campaign_handoffs
UNION ALL SELECT 'campaigns', count(*) FROM public.campaigns
UNION ALL SELECT 'campaign_recipients', count(*) FROM public.campaign_recipients;

SELECT status, count(*) FROM public.subscribers GROUP BY status ORDER BY status;
SELECT status, count(*) FROM public.campaigns GROUP BY status ORDER BY status;
SELECT status, count(*) FROM public.campaign_recipients GROUP BY status ORDER BY status;
```

Preflight integrity checks:

```sql
SELECT c.id
FROM public.campaigns AS c
LEFT JOIN public.aiced_article_campaign_handoffs AS h ON h.id = c.workflow_handoff_id
LEFT JOIN public.posts AS p ON p.id = c.post_id
WHERE h.id IS NULL OR p.id IS NULL;

SELECT cr.id
FROM public.campaign_recipients AS cr
LEFT JOIN public.campaigns AS c ON c.id = cr.campaign_id
LEFT JOIN public.subscribers AS s ON s.id = cr.subscriber_id
WHERE c.id IS NULL OR s.id IS NULL;

SELECT lower(email), count(*)
FROM public.subscribers
GROUP BY lower(email)
HAVING count(*) > 1;

SELECT normalized_name, count(*)
FROM public.subscriber_tags
GROUP BY normalized_name
HAVING count(*) > 1;
```

## Post-backfill verification queries

Replace `:initial_organization_id` with a bound migration parameter, never string interpolation.

```sql
SELECT 'posts' AS table_name, count(*) AS missing
FROM public.posts WHERE organization_id IS NULL
UNION ALL SELECT 'subscribers', count(*) FROM public.subscribers WHERE organization_id IS NULL
UNION ALL SELECT 'subscriber_tags', count(*) FROM public.subscriber_tags WHERE organization_id IS NULL
UNION ALL SELECT 'aiced_article_campaign_handoffs', count(*) FROM public.aiced_article_campaign_handoffs WHERE organization_id IS NULL
UNION ALL SELECT 'campaigns', count(*) FROM public.campaigns WHERE organization_id IS NULL
UNION ALL SELECT 'campaign_recipients', count(*) FROM public.campaign_recipients WHERE organization_id IS NULL;

SELECT 'posts' AS table_name, count(*) AS unexpected_org
FROM public.posts WHERE organization_id <> :initial_organization_id
UNION ALL SELECT 'subscribers', count(*) FROM public.subscribers WHERE organization_id <> :initial_organization_id
UNION ALL SELECT 'subscriber_tags', count(*) FROM public.subscriber_tags WHERE organization_id <> :initial_organization_id
UNION ALL SELECT 'aiced_article_campaign_handoffs', count(*) FROM public.aiced_article_campaign_handoffs WHERE organization_id <> :initial_organization_id
UNION ALL SELECT 'campaigns', count(*) FROM public.campaigns WHERE organization_id <> :initial_organization_id
UNION ALL SELECT 'campaign_recipients', count(*) FROM public.campaign_recipients WHERE organization_id <> :initial_organization_id;
```

Same-organization checks (each query must return zero rows):

```sql
SELECT h.id
FROM public.aiced_article_campaign_handoffs AS h
JOIN public.posts AS p ON p.id = h.post_id
WHERE h.organization_id <> p.organization_id;

SELECT c.id
FROM public.campaigns AS c
JOIN public.aiced_article_campaign_handoffs AS h ON h.id = c.workflow_handoff_id
JOIN public.posts AS p ON p.id = c.post_id
WHERE c.organization_id <> h.organization_id
   OR c.organization_id <> p.organization_id;

SELECT cr.id
FROM public.campaign_recipients AS cr
JOIN public.campaigns AS c ON c.id = cr.campaign_id
JOIN public.subscribers AS s ON s.id = cr.subscriber_id
WHERE cr.organization_id <> c.organization_id
   OR cr.organization_id <> s.organization_id;

SELECT sta.subscriber_id, sta.tag_id
FROM public.subscriber_tag_assignments AS sta
JOIN public.subscribers AS s ON s.id = sta.subscriber_id
JOIN public.subscriber_tags AS t ON t.id = sta.tag_id
WHERE s.organization_id <> t.organization_id;
```

Repeat baseline row counts after migration and compare exactly. Verify the currently frozen campaign recipient snapshots retain their email/name/status/provider fields and all count/status distributions match baseline.

## Future tenant-scoped constraints

| Current global constraint | Replacement |
| --- | --- |
| unique `lower(subscribers.email)` | unique expression index `(organization_id, lower(email))` |
| unique `subscriber_tags.normalized_name` | unique `(organization_id, normalized_name)` |
| unique `handoffs.workflow_token` | retain globally unique opaque token; additionally enforce organization-scoped retrieval |
| unique `campaigns.workflow_handoff_id` | retain; add organization-scoped query index |
| unique `(campaign_recipients.campaign_id, subscriber_id)` | retain; prevent cross-organization parent links |

All tenant query indexes should begin with `organization_id` where matching the deployed query pattern.

## Backup, restore, and rollback requirements

1. Confirm the target Supabase project and Alembic revision; take an encrypted, access-controlled logical backup/snapshot.
2. Restore it into an isolated nonproduction PostgreSQL environment and rehearse the exact migration, verification SQL, and application smoke tests with sends disabled.
3. Define statement/lock timeouts, a maintenance window, operator, success owner, and go/no-go point before adding `NOT NULL` and replacing global indexes.
4. Before live tenant writes and irreversible index changes, an additive migration can be rolled back only after verifying no new tenant data used the new schema.
5. After live writes, do not attempt an ad hoc downgrade or delete tenant keys. Restore the verified backup or use a reviewed forward corrective migration.

## Campaign recipient snapshot risk

Campaign recipients are historical delivery snapshots, not a live audience join. Do not recreate, deduplicate, or re-resolve them during the tenant backfill. A bad campaign/subscriber organization assignment could otherwise expose recipient email/name/delivery history across clients. Migration verification must prove campaign and subscriber ownership agree before recipient constraints are made mandatory.
