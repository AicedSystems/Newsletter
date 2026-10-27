# Aiced Newsletter / Aiced Bot Interview Prep Bundle

This bundle is intentionally limited to the files that explain how the browser, Flask backend, PostgreSQL/Supabase data model, email rendering, and Aiced workflow connect. It excludes `.env`, API keys, database URLs, uploaded media, and unrelated assets.

## Best reading order

1. `app.py` — Flask routes, request validation, authentication guard, Aiced generation/revision/handoff, publishing, audience resolution, campaign preparation, and controlled sending.
2. `models.py` — the Post, Subscriber, tag, Aiced workflow, Campaign, and CampaignRecipient relationships.
3. `templates/aiced_workspace.html` + `static/js/aiced_workspace.js` + `static/css/aiced_workspace.css` — the Aiced Bot UI and how it calls the workflow endpoints.
4. `templates/create_post.html` + `static/js/create_post.js` + `static/js/article_blocks.js` + `static/js/post_storage.js` — the article editor and structured content-block client behavior.
5. `email_renderer.py` — shared email HTML/text rendering from a published article and campaign details.
6. `templates/subscribers.html` — subscriber UI; pair it with the subscriber endpoints and audience resolver in `app.py`.
7. `migrations/versions/` — progression from posts to subscriber foundations, Aiced handoff persistence, and campaign/recipient snapshots.
8. `tests/` — examples of API, safety, and workspace contract coverage.

## A concise system explanation

The browser renders Jinja templates and uses vanilla JavaScript to call authenticated Flask APIs. Flask validates requests, reads/writes SQLAlchemy models in PostgreSQL/Supabase, uses Supabase Storage for durable article-image URLs, and returns serialized JSON for UI updates. Aiced requests are generated server-side through OpenAI, validated into a structured article/campaign proposal, and require human review before a draft is persisted, an article is published, or a campaign is sent. Campaign preparation resolves only eligible active subscribers and freezes recipient snapshots before the separate send action.

## Included files by responsibility

| Area | Files |
| --- | --- |
| Flask/backend | `app.py`, `models.py`, `extensions.py`, `email_renderer.py` |
| Aiced frontend | `templates/aiced_workspace.html`, `static/js/aiced_workspace.js`, `static/css/aiced_workspace.css` |
| Article editor | `templates/create_post.html`, `static/js/create_post.js`, `static/js/article_blocks.js`, `static/js/post_storage.js`, `static/css/create_post.css` |
| Campaign/subscriber/public UI | `templates/create_campaign.html`, `templates/subscribers.html`, `templates/article.html`, `templates/public_home.html`, `templates/_admin_sidebar.html`, `static/css/styles.css` |
| Database history | four Alembic files under `migrations/versions/` |
| Safety/testing | selected Aiced, article, subscriber, and UI contract tests |
| Architecture context | product roadmap and the two multi-tenant architecture documents |

## Excluded intentionally

- `.env` and any secret/configuration values
- Supabase credentials, OpenAI keys, Resend keys, and database URLs
- Uploaded images and generated user content
- Git history and editor configuration
