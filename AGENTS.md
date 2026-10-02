# Newsletter / Aiced Project Instructions

## Product and stack

Custom publishing and newsletter platform for a real estate team leader.

- Flask, SQLAlchemy, Flask-Migrate, PostgreSQL/Supabase
- HTML, CSS, and vanilla JavaScript
- Resend for explicitly requested single-recipient test emails
- OpenAI for human-reviewed Aiced editorial assistance

## Current architecture

- `Post` is currently the only application model and `public.posts` is the only application table.
- Posts support structured content blocks, publishing, public article pages, cover images, and previews.
- Campaigns currently select a published post, render shared email HTML/text, allow browser-only campaign edits, and can send one explicit test email.
- Aiced returns validated structured article suggestions. It never publishes or sends on its own.
- `localStorage` remains only for UI preferences and legacy demo/draft behavior; published posts use the Flask API and Supabase.

## V1 direction

The approved V1 plan is in `docs/v1-roadmap.md`:

1. Subscriber Foundation
2. Campaign Persistence
3. Audience Selection
4. Production Sending
5. Aiced Assistant
6. Analytics and Reliability

## Safety rules

- Never print, commit, or expose secrets, credentials, full database URLs, or API keys.
- Supabase is persistent. Confirm the intended project before database work; never access another client's database.
- Review migrations before applying them. Do not use `db.create_all()` or destructive schema commands on Supabase.
- Do not bulk-send, auto-send, or auto-publish without an explicitly approved vertical slice.
- Resend is not the system of record. Do not add provider syncing or webhook behavior unless requested.
- Aiced output requires human review and approval before publishing or sending.
- Unsubscribed or suppressed subscribers must never be selected for sending.

## Working method

- Work in small, reviewed vertical slices and preserve the existing UI unless a change is requested.
- Reuse existing helpers and modules; avoid unnecessary rewrites or dependencies.
- Run proportionate checks after code changes and report every file changed.
