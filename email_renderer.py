from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

from flask import render_template


class EmailRenderingError(ValueError):
    """Raised when a campaign cannot safely be rendered for email delivery."""


class EmailConfigurationError(EmailRenderingError):
    """Raised when a server-only email setting is missing or unsafe."""


@dataclass(frozen=True)
class EmailBranding:
    name: str
    tagline: str
    footer_text: str
    public_base_url: str


def get_email_branding(environ):
    """Read reusable client branding while requiring a real public URL for email."""
    public_base_url = environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")
    parsed_url = urlparse(public_base_url)

    if parsed_url.scheme != "https" or not parsed_url.netloc:
        raise EmailConfigurationError(
            "Email delivery is not configured. Set PUBLIC_BASE_URL to your public HTTPS site URL."
        )

    return EmailBranding(
        name=environ.get("EMAIL_BRAND_NAME", "Inside the Market").strip() or "Inside the Market",
        tagline=environ.get("EMAIL_BRAND_TAGLINE", "Real Estate Network").strip(),
        footer_text=(
            environ.get("EMAIL_FOOTER_TEXT", "A test email from your publishing team.").strip()
            or "A test email from your publishing team."
        ),
        public_base_url=public_base_url,
    )


def is_public_https_url(value):
    parsed_url = urlparse(value or "")
    return parsed_url.scheme == "https" and bool(parsed_url.netloc)


def render_newsletter_email(post, subject, preheader, branding, headline=None, summary=None, cover_image_url=None):
    """Return the exact HTML and plain-text versions used for preview and delivery."""
    if not post or post.status != "published":
        raise EmailRenderingError("Choose a published article before rendering this campaign.")

    article_url = urljoin(f"{branding.public_base_url}/", f"blog/{post.id}")
    featured_image_url = cover_image_url or (
        post.featured_image if is_public_https_url(post.featured_image)
        else urljoin(f"{branding.public_base_url}/", f"media/posts/{post.id}/cover")
        if post.featured_image and post.featured_image.startswith("data:image/") else None
    )
    category = (post.category or "Article").replace("-", " ").title()
    headline = (headline or post.title).strip()
    summary = (summary or post.excerpt or post.content or "").strip()

    if not headline or not summary:
        raise EmailRenderingError("The selected published article is missing a title or summary.")

    html = render_template(
        "emails/newsletter.html",
        branding=branding,
        subject=subject,
        preheader=preheader,
        post=post,
        headline=headline,
        category=category,
        summary=summary,
        article_url=article_url,
        featured_image_url=featured_image_url,
    )
    plain_text = "\n".join(
        part
        for part in (
            branding.name,
            branding.tagline,
            subject,
            preheader,
            post.title.strip(),
            summary,
            f"Read full article: {article_url}",
            branding.footer_text,
        )
        if part
    )

    return {"html": html, "text": plain_text, "articleUrl": article_url}
