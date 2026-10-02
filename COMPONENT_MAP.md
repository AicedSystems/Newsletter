# Newsletter Platform Component Map

Use this file as the starting point when locating a visual component or feature. It is intended for future development conversations so they can navigate the project without reading every file first.

## Quick selector lookup

From the project root, search a CSS class or ID across templates, styles, and browser code:

```sh
rg -n -C 3 "article-section__header" templates static app.py
```

If a selector is not in `templates/`, it may be created dynamically by JavaScript with `document.createElement()` and `className`.

## Current example: `article-section__header`

| Concern | Location | Notes |
| --- | --- | --- |
| HTML creation | `static/js/create_post.js` | Created dynamically in `groupHeadingSections()` as an `article-section__header`. |
| Styling | `static/css/create_post.css` | Search for `.article-section__header`. |
| Parent feature | `static/js/create_post.js` | Part of the section grouping and block-builder editor. |

There is no static `article-section__header` element in a template.

## Main page entry points

| Feature/page | Template | CSS | JavaScript |
| --- | --- | --- | --- |
| Dashboard and published post cards | `templates/dashboard.html` | `static/css/styles.css` | `static/js/script.js` |
| Dedicated published article | `templates/article.html` | `static/css/styles.css` | `static/js/article.js` |
| Start a post | `templates/start_post.html` | `static/css/styles.css`, `static/css/create_post.css` | `static/js/start_post.js`, `static/js/post_storage.js` |
| Paste article | `templates/paste_post.html` | `static/css/styles.css`, `static/css/create_post.css` | `static/js/paste_post.js`, `static/js/article_blocks.js` |
| Post editor / CMS builder | `templates/create_post.html` | `static/css/styles.css`, `static/css/create_post.css` | `static/js/create_post.js`, `static/js/article_blocks.js`, `static/js/post_storage.js` |
| Campaign creator | `templates/create_campaign.html` | `static/css/styles.css`, `static/css/create_campaign.css` | `static/js/create_campaign.js` |

## Editor component index

| Component / selector | HTML source | CSS | JavaScript behavior |
| --- | --- | --- | --- |
| `.block-builder` | `templates/create_post.html` | `static/css/create_post.css` | `static/js/create_post.js` |
| `.block-builder__block` | Dynamically created | `static/css/create_post.css` | `renderContentBlocks()` in `static/js/create_post.js` |
| `.block-builder__drag-handle` | Dynamically created | `static/css/create_post.css` | Drag/drop logic in `static/js/create_post.js` |
| `.article-section` | Dynamically created | `static/css/create_post.css` | `groupHeadingSections()` in `static/js/create_post.js` |
| `.article-section__header` | Dynamically created | `static/css/create_post.css` | `groupHeadingSections()` in `static/js/create_post.js` |
| `.article-details` | `templates/create_post.html` | `static/css/create_post.css` | `renderArticleDetails()` in `static/js/create_post.js` |
| `.editor-preview` | `templates/create_post.html` | `static/css/create_post.css` | `renderPostPreview()` in `static/js/create_post.js` |
| `.publishing-card` | `templates/create_post.html` | `static/css/create_post.css` | `static/js/create_post.js` |

## Aiced Bot component index

| Component / selector | HTML source | CSS | JavaScript behavior |
| --- | --- | --- | --- |
| `.ai-assistant-card` | `templates/create_post.html` | `static/css/create_post.css` | Sidebar SEO action and Undo in `static/js/create_post.js` |
| `.aiced-bot-sticky` | `templates/create_post.html` | `static/css/create_post.css` | Opens/closes drawer in `static/js/create_post.js` |
| `.aiced-bot-panel` | `templates/create_post.html` | `static/css/create_post.css` | Drawer state rendering in `static/js/create_post.js` |
| `#aiced-bot-workflow-content` | `templates/create_post.html` | `static/css/create_post.css` | Reused idle/processing/success/review/error drawer states |
| `#improve-seo-button` | `templates/create_post.html` | `static/css/create_post.css` | Calls `improveSeo()` in `static/js/create_post.js` |

## Backend and data map

| Purpose | Location |
| --- | --- |
| Flask page routes and API endpoints | `app.py` |
| `POST /api/posts` and post retrieval | `app.py` |
| AI endpoints (`/api/posts/enhance`, `/api/posts/ai-edit`) | `app.py` |
| SQLAlchemy extension | `extensions.py` |
| `Post` database model | `models.py` |
| Python dependencies | `requirements.txt` |
| Aiced Bot and article image assets | `static/images/` |

## Environment configuration

Create a separate local `.env` for each client. Never copy another client’s credentials.

```env
DATABASE_URL=
EDITOR_USERNAME=
EDITOR_PASSWORD=
OPENAI_API_KEY=
OPENAI_ENHANCEMENT_MODEL=
```
