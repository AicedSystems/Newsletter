import os
import base64
import binascii
import re
from datetime import datetime
from urllib.parse import urlparse

from flask import Flask, jsonify, render_template, request
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import Post

app = Flask(__name__)
database_url = os.environ.get("DATABASE_URL")

if not database_url:
    raise RuntimeError("DATABASE_URL must be set to a PostgreSQL connection URL.")

app.config["SQLALCHEMY_DATABASE_URI"] = database_url

db.init_app(app)

SUPPORTED_BLOCK_TYPES = {"heading", "paragraph", "image", "youtube", "quote", "cta"}
EMBEDDED_IMAGE_PATTERN = re.compile(
    r"^data:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$",
    re.IGNORECASE,
)
MAXIMUM_EMBEDDED_IMAGE_BYTES = 5 * 1024 * 1024


def is_web_url(value):
    parsed_url = urlparse(value)
    return parsed_url.scheme in {"http", "https"} and bool(parsed_url.netloc)


def is_embedded_image(value):
    match = EMBEDDED_IMAGE_PATTERN.fullmatch(value)

    if not match:
        return False

    try:
        image_bytes = base64.b64decode(match.group(1), validate=True)
    except (ValueError, binascii.Error):
        return False

    return len(image_bytes) <= MAXIMUM_EMBEDDED_IMAGE_BYTES


def is_image_source(value):
    return is_web_url(value) or is_embedded_image(value)


def is_youtube_url(value):
    parsed_url = urlparse(value)
    host = parsed_url.netloc.lower().removeprefix("www.")
    return host in {"youtube.com", "m.youtube.com", "youtu.be"}


def validate_content_blocks(content_blocks):
    if not isinstance(content_blocks, list):
        return None, "contentBlocks must be an array."

    validated_blocks = []

    for block in content_blocks:
        if not isinstance(block, dict):
            return None, "Each content block must be an object."

        block_type = block.get("type")
        if block_type not in SUPPORTED_BLOCK_TYPES:
            return None, "A content block has an unsupported type."

        if block_type in {"heading", "paragraph", "quote"}:
            text = block.get("text")
            if not isinstance(text, str) or not text.strip():
                return None, f"{block_type} blocks require text."
            validated_blocks.append({"type": block_type, "text": text.strip()})
            continue

        if block_type in {"image", "youtube"}:
            url = block.get("url")
            is_valid_url = (
                is_image_source(url)
                if block_type == "image" and isinstance(url, str)
                else is_web_url(url) if isinstance(url, str) else False
            )
            if not is_valid_url:
                if block_type == "image":
                    return None, "image blocks require an http(s) URL or a JPEG, PNG, or WebP image up to 5 MB."
                return None, "youtube blocks require an http or https URL."
            if block_type == "youtube" and not is_youtube_url(url):
                return None, "youtube blocks require a standard YouTube URL."
            validated_blocks.append({"type": block_type, "url": url})
            continue

        text = block.get("text")
        url = block.get("url")
        if not isinstance(text, str) or not text.strip() or not isinstance(url, str) or not is_web_url(url):
            return None, "cta blocks require text and an http or https URL."
        validated_blocks.append({"type": "cta", "text": text.strip(), "url": url})

    return validated_blocks, None


def serialize_post(post):
    content_blocks = post.content_blocks
    if content_blocks is None:
        content_blocks = [{"type": "paragraph", "text": post.content}] if post.content else []

    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "category": post.category,
        "tags": [tag.strip() for tag in post.tags.split(",") if tag.strip()],
        "excerpt": post.excerpt,
        "featuredImage": post.featured_image,
        "status": post.status,
        "publishedDate": (
            f"{post.published_at.isoformat()}Z" if post.published_at else None
        ),
        "contentBlocks": content_blocks,
    }


@app.get("/")
def dashboard():
    return render_template("dashboard.html")


@app.get("/posts/new")
def new_post():
    return render_template("create_post.html")


@app.get("/posts/<int:post_id>")
def article(post_id):
    return render_template("article.html", post_id=post_id)


@app.get("/campaigns/new")
def new_campaign():
    return render_template("create_campaign.html")


@app.post("/api/posts")
def create_post():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"message": "Request body must be valid JSON."}), 400

    required_fields = ("title", "category", "excerpt", "status")
    missing_fields = [
        field for field in required_fields
        if not isinstance(data.get(field), str) or not data[field].strip()
    ]

    if missing_fields:
        return jsonify({"message": "Missing required fields.", "fields": missing_fields}), 400

    title = data["title"].strip()
    content = data.get("content", "")
    category = data["category"].strip()
    excerpt = data["excerpt"].strip()
    status = data["status"].strip()
    tags = data.get("tags", [])
    featured_image = data.get("featuredImage")

    if not isinstance(content, str):
        return jsonify({"message": "Content must be a string."}), 400
    content = content.strip()

    if "contentBlocks" in data:
        content_blocks, block_error = validate_content_blocks(data["contentBlocks"])
        if block_error:
            return jsonify({"message": block_error}), 400
    else:
        content_blocks = None

    if not content and not content_blocks:
        return jsonify({"message": "Content or contentBlocks is required."}), 400

    if status not in {"draft", "published"}:
        return jsonify({"message": "Status must be 'draft' or 'published'."}), 400

    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        return jsonify({"message": "Tags must be an array of strings."}), 400

    if featured_image is not None and (
        not isinstance(featured_image, str) or not is_image_source(featured_image)
    ):
        return jsonify({"message": "featuredImage must be an http(s) URL or a JPEG, PNG, or WebP image up to 5 MB."}), 400

    if len(title) > 100 or len(category) > 50 or len(excerpt) > 160:
        return jsonify({"message": "One or more fields exceed their maximum length."}), 400

    post = Post(
        title=title,
        content=content,
        category=category,
        tags=", ".join(tag.strip() for tag in tags if tag.strip()),
        excerpt=excerpt,
        featured_image=featured_image,
        status=status,
        published_at=datetime.utcnow() if status == "published" else None,
        content_blocks=content_blocks,
    )

    try:
        db.session.add(post)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to save post."}), 500

    return jsonify(serialize_post(post)), 201


@app.get("/api/posts")
def list_posts():
    statement = (
        db.select(Post)
        .where(Post.status == "published")
        .order_by(Post.published_at.desc(), Post.id.desc())
    )
    posts = db.session.execute(statement).scalars().all()

    return jsonify([serialize_post(post) for post in posts])


@app.get("/api/posts/<int:post_id>")
def get_post(post_id):
    post = db.session.get(Post, post_id)

    if post is None or post.status != "published":
        return jsonify({"message": "Post not found."}), 404

    return jsonify(serialize_post(post))


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
