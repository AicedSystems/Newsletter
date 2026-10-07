"""create Aiced article campaign handoffs

Revision ID: c4a2f9d87b11
Revises: b9e266fbce0f
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c4a2f9d87b11"
down_revision = "b9e266fbce0f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "aiced_article_campaign_handoffs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_token", sa.String(length=64), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("campaign_name", sa.String(length=100), nullable=False),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("preheader", sa.String(length=120), nullable=False),
        sa.Column(
            "audience_tag_names",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("audience_rationale", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["public.posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workflow_token"),
        schema="public",
    )
    op.create_index(
        "ix_aiced_article_campaign_handoffs_post_id",
        "aiced_article_campaign_handoffs",
        ["post_id"],
        schema="public",
    )
    op.create_index(
        "ix_aiced_article_campaign_handoffs_expires_at",
        "aiced_article_campaign_handoffs",
        ["expires_at"],
        schema="public",
    )


def downgrade():
    op.drop_index(
        "ix_aiced_article_campaign_handoffs_expires_at",
        table_name="aiced_article_campaign_handoffs",
        schema="public",
    )
    op.drop_index(
        "ix_aiced_article_campaign_handoffs_post_id",
        table_name="aiced_article_campaign_handoffs",
        schema="public",
    )
    op.drop_table("aiced_article_campaign_handoffs", schema="public")
