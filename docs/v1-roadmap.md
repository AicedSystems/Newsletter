# Newsletter V1 Roadmap

## V1 outcome

Let a real estate team create a post, turn it into a campaign, select a consented audience, send safely, and measure the result. Human review remains required for publishing, AI edits, and sending.

## Phase 1 — Subscriber Foundation

Add a small, durable audience model before building campaign persistence or bulk delivery.

### Proposed schema (for review only)

| Table | Purpose | Core fields |
| --- | --- | --- |
| `subscribers` | One person who can receive newsletters | `id`, `email`, `first_name`, `last_name`, `status`, `created_at`, `updated_at`, `unsubscribed_at` |
| `subscriber_tags` | Reusable audience labels | `id`, `name`, `normalized_name`, `created_at` |
| `subscriber_tag_assignments` | Many-to-many subscriber/tag membership | `subscriber_id`, `tag_id`, `created_at` |

Recommended model details:

- `Subscriber.email`: required, max 320 characters, unique case-insensitively; normalize/trim before storage.
- `Subscriber.first_name` and `last_name`: optional, max 100 characters.
- `Subscriber.status`: required string, initially `active` or `unsubscribed`; reserve `suppressed` for future delivery safety.
- `Subscriber.unsubscribed_at`: nullable timestamp, set when status becomes `unsubscribed`.
- `SubscriberTag.name`: required display name; `normalized_name` is required and unique so equivalent tags do not split the audience.
- `subscriber_tag_assignments`: composite primary key (`subscriber_id`, `tag_id`) prevents duplicate tag assignments; both foreign keys use `ON DELETE CASCADE`.

`subscriber_tag_assignments` is recommended instead of naming the association table `subscriber_tags`, because `subscriber_tags` is clearer as the table behind the `SubscriberTag` model.

### Indexes and constraints

- Unique functional index on `lower(subscribers.email)` to prevent case-only duplicate emails.
- Unique constraint/index on `subscriber_tags.normalized_name`.
- Composite primary key on `subscriber_tag_assignments`.
- Reverse index on `subscriber_tag_assignments.tag_id` for tag filtering.

At the initial ~2,000-subscriber scale, additional search indexes are unnecessary. Email lookup is covered by the unique index; name search can remain a simple case-insensitive query until real usage demonstrates a need.

### Subscriber experience

- Subscriber list with email, name, status, tags, and created date.
- Add and edit one subscriber at a time.
- Search by email or name; filter by status and tag.
- Create, attach, and remove tags without deleting the subscriber.
- Unsubscribe changes status rather than deleting history. Future campaign queries must include only `active` subscribers.

### Safe CSV import

1. Upload and parse the CSV without writing anything.
2. Validate headers, email format, duplicate rows, duplicate existing emails, and tag formatting.
3. Show counts and row-level reasons: ready to import, skipped, and invalid.
4. Require an explicit confirmation before writing.
5. In one transaction, create only valid new subscribers and their tags/assignments.
6. Never overwrite an existing subscriber or re-activate an unsubscribed/suppressed subscriber through CSV import.
7. Present a final import summary; CSV import does not send email.

## Phase 2 — Campaign Persistence

Add a `Campaign` model and migration after the Subscriber schema is reviewed. Persist campaign settings, selected post, editable email subject/preheader/body, status, and timestamps. Keep the existing renderer reusable and do not change post publishing behavior.

## Phase 3 — Audience Selection

Attach campaign audience criteria using subscriber status and tags. Show an eligible-recipient count and clear exclusions. Do not create recipient records or deliver email yet.

## Phase 4 — Production Sending

Introduce `CampaignRecipient` and a background delivery job. Snapshot recipient email/content at send time, prevent duplicate sends, handle provider failures safely, and preserve unsubscribe/suppression rules. Keep the current single-recipient test-send flow separate.

## Phase 5 — Aiced Assistant

Extend the existing structured, server-side AI patterns to approved campaign editing tasks. AI proposes changes only; the editor displays them for human acceptance. No automatic sending, subscriber targeting, or factual invention.

## Phase 6 — Analytics and Reliability

Add provider webhook handling, delivery/open/click events, campaign metrics, retries, observability, and data-retention rules. This phase follows stable campaign persistence and production delivery.

## Recommended implementation sequence for Phase 1

1. Approve the proposed model fields, naming, status values, and CSV duplicate policy.
2. Add SQLAlchemy models and a reviewed Flask-Migrate migration only.
3. Apply the migration only after explicit approval and verify the schema read-only.
4. Add subscriber CRUD API/routes and a minimal subscriber-management UI.
5. Add search, status filtering, and tag management.
6. Add CSV preview/validation, then explicit confirmation/import.
7. Add focused tests for normalization, duplicate prevention, tag assignments, unsubscribe exclusion, and CSV validation.

No migration, database connection, data write, sending behavior, or Resend/OpenAI integration is included in this planning document.
