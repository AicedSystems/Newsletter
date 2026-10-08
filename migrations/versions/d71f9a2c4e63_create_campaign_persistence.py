"""create campaign persistence

Revision ID: d71f9a2c4e63
Revises: c4a2f9d87b11
Create Date: 2026-10-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "d71f9a2c4e63"
down_revision = "c4a2f9d87b11"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_handoff_id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("preheader", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column(
            "audience_tag_names",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "status IN ('draft', 'sending', 'sent', 'partial', 'failed')",
            name="ck_campaigns_status",
        ),
        sa.ForeignKeyConstraint(
            ["workflow_handoff_id"],
            ["public.aiced_article_campaign_handoffs.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["post_id"], ["public.posts.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workflow_handoff_id", name="uq_campaigns_workflow_handoff_id"),
        schema="public",
    )
    op.create_index("ix_campaigns_post_id", "campaigns", ["post_id"], schema="public")
    op.create_index("ix_campaigns_status", "campaigns", ["status"], schema="public")

    op.create_table(
        "campaign_recipients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("subscriber_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=201), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'sent', 'failed')",
            name="ck_campaign_recipients_status",
        ),
        sa.ForeignKeyConstraint(["campaign_id"], ["public.campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscriber_id"], ["public.subscribers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "campaign_id",
            "subscriber_id",
            name="uq_campaign_recipients_campaign_subscriber",
        ),
        schema="public",
    )
    op.create_index(
        "ix_campaign_recipients_subscriber_id",
        "campaign_recipients",
        ["subscriber_id"],
        schema="public",
    )
    op.create_index(
        "ix_campaign_recipients_status",
        "campaign_recipients",
        ["status"],
        schema="public",
    )


def downgrade():
    op.drop_index(
        "ix_campaign_recipients_status",
        table_name="campaign_recipients",
        schema="public",
    )
    op.drop_index(
        "ix_campaign_recipients_subscriber_id",
        table_name="campaign_recipients",
        schema="public",
    )
    op.drop_table("campaign_recipients", schema="public")
    op.drop_index("ix_campaigns_status", table_name="campaigns", schema="public")
    op.drop_index("ix_campaigns_post_id", table_name="campaigns", schema="public")
    op.drop_table("campaigns", schema="public")
