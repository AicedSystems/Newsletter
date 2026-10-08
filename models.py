from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from extensions import db


subscriber_tag_assignments = db.Table(
    "subscriber_tag_assignments",
    db.Column(
        "subscriber_id",
        ForeignKey("public.subscribers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "tag_id",
        ForeignKey("public.subscriber_tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column("created_at", DateTime, nullable=False, server_default=func.now()),
    Index("ix_subscriber_tag_assignments_tag_id", "tag_id"),
    schema="public",
)


class Post(db.Model):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    tags: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str] = mapped_column(String(160), nullable=False)
    featured_image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    content_blocks: Mapped[Optional[list[dict]]] = mapped_column(JSONB, nullable=True)
    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="post")


class AicedArticleCampaignHandoff(db.Model):
    """Temporary, human-reviewed campaign context attached to an Aiced draft post."""

    __tablename__ = "aiced_article_campaign_handoffs"
    __table_args__ = (
        Index("ix_aiced_article_campaign_handoffs_post_id", "post_id"),
        Index("ix_aiced_article_campaign_handoffs_expires_at", "expires_at"),
        {"schema": "public"},
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workflow_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    campaign_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    preheader: Mapped[str] = mapped_column(String(120), nullable=False)
    audience_tag_names: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    audience_rationale: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    campaign: Mapped[Optional["Campaign"]] = relationship(
        back_populates="handoff", uselist=False
    )


class Subscriber(db.Model):
    __tablename__ = "subscribers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'unsubscribed', 'suppressed')",
            name="ck_subscribers_status",
        ),
        {"schema": "public"},
    )

    STATUS_ACTIVE = "active"
    STATUS_UNSUBSCRIBED = "unsubscribed"
    STATUS_SUPPRESSED = "suppressed"
    ALLOWED_STATUSES = {
        STATUS_ACTIVE,
        STATUS_UNSUBSCRIBED,
        STATUS_SUPPRESSED,
    }

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATUS_ACTIVE, server_default=STATUS_ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    unsubscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    tags: Mapped[list["SubscriberTag"]] = relationship(
        secondary=subscriber_tag_assignments,
        back_populates="subscribers",
    )
    campaign_recipients: Mapped[list["CampaignRecipient"]] = relationship(
        back_populates="subscriber"
    )

    @validates("email")
    def normalize_email(self, _key: str, value: str) -> str:
        return value.strip().lower()


Index("uq_subscribers_email_lower", func.lower(Subscriber.email), unique=True)


class SubscriberTag(db.Model):
    __tablename__ = "subscriber_tags"
    __table_args__ = {"schema": "public"}

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    normalized_name: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    subscribers: Mapped[list[Subscriber]] = relationship(
        secondary=subscriber_tag_assignments,
        back_populates="tags",
    )

    @validates("name")
    def normalize_name(self, _key: str, value: str) -> str:
        display_name = value.strip()
        self.normalized_name = display_name.lower()
        return display_name


class Campaign(db.Model):
    """Durable, human-controlled delivery record for one prepared campaign."""

    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'sending', 'sent', 'partial', 'failed')",
            name="ck_campaigns_status",
        ),
        UniqueConstraint("workflow_handoff_id", name="uq_campaigns_workflow_handoff_id"),
        Index("ix_campaigns_post_id", "post_id"),
        Index("ix_campaigns_status", "status"),
        {"schema": "public"},
    )

    STATUS_DRAFT = "draft"
    STATUS_SENDING = "sending"
    STATUS_SENT = "sent"
    STATUS_PARTIAL = "partial"
    STATUS_FAILED = "failed"
    ALLOWED_STATUSES = {
        STATUS_DRAFT,
        STATUS_SENDING,
        STATUS_SENT,
        STATUS_PARTIAL,
        STATUS_FAILED,
    }

    id: Mapped[int] = mapped_column(primary_key=True)
    workflow_handoff_id: Mapped[int] = mapped_column(
        ForeignKey("public.aiced_article_campaign_handoffs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    preheader: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATUS_DRAFT, server_default=STATUS_DRAFT
    )
    audience_tag_names: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    post: Mapped[Post] = relationship(back_populates="campaigns")
    handoff: Mapped[AicedArticleCampaignHandoff] = relationship(
        back_populates="campaign"
    )
    recipients: Mapped[list["CampaignRecipient"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignRecipient(db.Model):
    """Historical recipient snapshot and delivery state for a campaign."""

    __tablename__ = "campaign_recipients"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'sent', 'failed')",
            name="ck_campaign_recipients_status",
        ),
        UniqueConstraint(
            "campaign_id",
            "subscriber_id",
            name="uq_campaign_recipients_campaign_subscriber",
        ),
        Index("ix_campaign_recipients_subscriber_id", "subscriber_id"),
        Index("ix_campaign_recipients_status", "status"),
        {"schema": "public"},
    )

    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"
    ALLOWED_STATUSES = {STATUS_PENDING, STATUS_SENT, STATUS_FAILED}

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("public.campaigns.id", ondelete="CASCADE"), nullable=False
    )
    subscriber_id: Mapped[int] = mapped_column(
        ForeignKey("public.subscribers.id", ondelete="RESTRICT"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(201), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=STATUS_PENDING, server_default=STATUS_PENDING
    )
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    campaign: Mapped[Campaign] = relationship(back_populates="recipients")
    subscriber: Mapped[Subscriber] = relationship(back_populates="campaign_recipients")
