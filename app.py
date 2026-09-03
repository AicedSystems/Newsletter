import os
from datetime import datetime

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


def serialize_post(post):
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

    required_fields = ("title", "content", "category", "excerpt", "status")
    missing_fields = [
        field for field in required_fields
        if not isinstance(data.get(field), str) or not data[field].strip()
    ]

    if missing_fields:
        return jsonify({"message": "Missing required fields.", "fields": missing_fields}), 400

    title = data["title"].strip()
    content = data["content"].strip()
    category = data["category"].strip()
    excerpt = data["excerpt"].strip()
    status = data["status"].strip()
    tags = data.get("tags", [])
    featured_image = data.get("featuredImage")

    if status not in {"draft", "published"}:
        return jsonify({"message": "Status must be 'draft' or 'published'."}), 400

    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        return jsonify({"message": "Tags must be an array of strings."}), 400

    if featured_image is not None and not isinstance(featured_image, str):
        return jsonify({"message": "featuredImage must be a string or null."}), 400

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
    )

    try:
        db.session.add(post)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"message": "Unable to save post."}), 500

    return jsonify({
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "category": post.category,
        "tags": tags,
        "excerpt": post.excerpt,
        "featuredImage": post.featured_image,
        "status": post.status,
        "publishedDate": (
            f"{post.published_at.isoformat()}Z" if post.published_at else None
        ),
    }), 201


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
