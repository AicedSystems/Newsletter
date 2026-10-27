"""Opt-in PostgreSQL-only tests for the proposed multi-tenant constraints.

These tests deliberately do not import application models or `app`. They create
temporary tables in a random schema and refuse to connect unless an explicit,
disposable PostgreSQL URL and acknowledgement are provided. SQLite is not a
substitute because the tests exercise PostgreSQL expression indexes, partial
unique indexes, UUIDs, and composite foreign keys.
"""

from __future__ import annotations

import os
import re
import unittest
from pathlib import PurePosixPath
from urllib.parse import urlparse
from uuid import uuid4

from sqlalchemy import create_engine, text


TEST_DATABASE_URL_ENV = "AICED_TENANT_TEST_DATABASE_URL"
TEST_ACK_ENV = "AICED_ALLOW_DISPOSABLE_POSTGRES_TESTS"


def disposable_postgres_url() -> str | None:
    """Return a safe explicit test URL, or None without opening a connection."""

    value = os.environ.get(TEST_DATABASE_URL_ENV, "").strip()
    if os.environ.get(TEST_ACK_ENV) != "1" or not value:
        return None

    parsed = urlparse(value)
    database_name = PurePosixPath(parsed.path).name.lower()
    host = (parsed.hostname or "").lower()
    allowed_local_hosts = {"localhost", "127.0.0.1", "::1"}
    is_local = host in allowed_local_hosts
    is_named_test_database = bool(re.search(r"(^|[_-])(test|testing|ci)([_-]|$)", database_name))
    if parsed.scheme not in {"postgresql", "postgres", "postgresql+psycopg"}:
        raise RuntimeError("AICED_TENANT_TEST_DATABASE_URL must use a PostgreSQL URL.")
    if ".supabase.co" in host or not (is_local or is_named_test_database):
        raise RuntimeError(
            "Refusing the tenant constraint test database URL. Use localhost or an explicitly named test/ci database; Supabase hosts are never allowed."
        )
    return value


TEST_DATABASE_URL = disposable_postgres_url()


@unittest.skipUnless(
    TEST_DATABASE_URL,
    f"requires explicit disposable PostgreSQL via {TEST_DATABASE_URL_ENV} and {TEST_ACK_ENV}=1",
)
class TenantConstraintFoundationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(TEST_DATABASE_URL, future=True)
        cls.schema = f"aiced_phase1a_{uuid4().hex}"
        with cls.engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{cls.schema}"'))
            connection.execute(text(f''' 
                CREATE TABLE "{cls.schema}".organizations (
                    id uuid PRIMARY KEY,
                    slug text NOT NULL UNIQUE
                );
                CREATE TABLE "{cls.schema}".users (
                    id uuid PRIMARY KEY,
                    auth_subject uuid NOT NULL UNIQUE
                );
                CREATE TABLE "{cls.schema}".organization_memberships (
                    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    organization_id uuid NOT NULL REFERENCES "{cls.schema}".organizations(id),
                    user_id uuid NOT NULL REFERENCES "{cls.schema}".users(id),
                    role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
                    revoked_at timestamptz NULL
                );
                CREATE UNIQUE INDEX uq_active_membership
                    ON "{cls.schema}".organization_memberships (organization_id, user_id)
                    WHERE revoked_at IS NULL;
                CREATE TABLE "{cls.schema}".subscribers (
                    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    organization_id uuid NOT NULL REFERENCES "{cls.schema}".organizations(id),
                    email text NOT NULL,
                    UNIQUE (organization_id, id)
                );
                CREATE UNIQUE INDEX uq_subscriber_email_per_organization
                    ON "{cls.schema}".subscribers (organization_id, lower(email));
                CREATE TABLE "{cls.schema}".subscriber_tags (
                    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    organization_id uuid NOT NULL REFERENCES "{cls.schema}".organizations(id),
                    normalized_name text NOT NULL,
                    UNIQUE (organization_id, id),
                    UNIQUE (organization_id, normalized_name)
                );
                CREATE TABLE "{cls.schema}".subscriber_tag_assignments (
                    organization_id uuid NOT NULL REFERENCES "{cls.schema}".organizations(id),
                    subscriber_id bigint NOT NULL,
                    tag_id bigint NOT NULL,
                    PRIMARY KEY (organization_id, subscriber_id, tag_id),
                    FOREIGN KEY (organization_id, subscriber_id)
                        REFERENCES "{cls.schema}".subscribers (organization_id, id),
                    FOREIGN KEY (organization_id, tag_id)
                        REFERENCES "{cls.schema}".subscriber_tags (organization_id, id)
                );
                CREATE TABLE "{cls.schema}".campaigns (
                    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    organization_id uuid NOT NULL REFERENCES "{cls.schema}".organizations(id),
                    UNIQUE (organization_id, id)
                );
                CREATE TABLE "{cls.schema}".campaign_recipients (
                    organization_id uuid NOT NULL REFERENCES "{cls.schema}".organizations(id),
                    campaign_id bigint NOT NULL,
                    subscriber_id bigint NOT NULL,
                    PRIMARY KEY (organization_id, campaign_id, subscriber_id),
                    FOREIGN KEY (organization_id, campaign_id)
                        REFERENCES "{cls.schema}".campaigns (organization_id, id),
                    FOREIGN KEY (organization_id, subscriber_id)
                        REFERENCES "{cls.schema}".subscribers (organization_id, id)
                );
            '''))

    @classmethod
    def tearDownClass(cls):
        with cls.engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{cls.schema}" CASCADE'))
        cls.engine.dispose()

    def execute(self, statement: str, **parameters):
        with self.engine.begin() as connection:
            return connection.execute(text(statement), parameters)

    def scalar(self, statement: str, **parameters):
        with self.engine.begin() as connection:
            return connection.execute(text(statement), parameters).scalar_one()

    def add_organization(self, slug: str) -> str:
        organization_id = str(uuid4())
        self.execute(
            f'INSERT INTO "{self.schema}".organizations (id, slug) VALUES (:id, :slug)',
            id=organization_id,
            slug=slug,
        )
        return organization_id

    def add_user(self) -> str:
        user_id = str(uuid4())
        self.execute(
            f'INSERT INTO "{self.schema}".users (id, auth_subject) VALUES (:id, :subject)',
            id=user_id,
            subject=str(uuid4()),
        )
        return user_id

    def add_subscriber(self, organization_id: str, email: str) -> int:
        return self.scalar(
            f'''INSERT INTO "{self.schema}".subscribers (organization_id, email)
                VALUES (:organization_id, :email) RETURNING id''',
            organization_id=organization_id,
            email=email,
        )

    def add_tag(self, organization_id: str, normalized_name: str) -> int:
        return self.scalar(
            f'''INSERT INTO "{self.schema}".subscriber_tags (organization_id, normalized_name)
                VALUES (:organization_id, :normalized_name) RETURNING id''',
            organization_id=organization_id,
            normalized_name=normalized_name,
        )

    def test_same_email_is_allowed_in_two_organizations(self):
        first, second = self.add_organization("email-a"), self.add_organization("email-b")
        self.add_subscriber(first, "same@example.com")
        self.add_subscriber(second, "same@example.com")

    def test_email_is_case_insensitively_unique_within_an_organization(self):
        organization_id = self.add_organization("email-case")
        self.add_subscriber(organization_id, "Same@Example.com")
        with self.assertRaises(Exception):
            self.add_subscriber(organization_id, "same@example.com")

    def test_same_normalized_tag_is_allowed_in_two_organizations(self):
        first, second = self.add_organization("tag-a"), self.add_organization("tag-b")
        self.add_tag(first, "buyer")
        self.add_tag(second, "buyer")

    def test_duplicate_normalized_tag_fails_within_an_organization(self):
        organization_id = self.add_organization("tag-case")
        self.add_tag(organization_id, "buyer")
        with self.assertRaises(Exception):
            self.add_tag(organization_id, "buyer")

    def test_membership_role_is_restricted(self):
        organization_id, user_id = self.add_organization("roles"), self.add_user()
        with self.assertRaises(Exception):
            self.execute(
                f'''INSERT INTO "{self.schema}".organization_memberships
                    (organization_id, user_id, role) VALUES (:organization_id, :user_id, 'sender')''',
                organization_id=organization_id,
                user_id=user_id,
            )

    def test_user_can_belong_to_multiple_organizations(self):
        user_id = self.add_user()
        for slug in ("member-a", "member-b"):
            self.execute(
                f'''INSERT INTO "{self.schema}".organization_memberships
                    (organization_id, user_id, role) VALUES (:organization_id, :user_id, 'editor')''',
                organization_id=self.add_organization(slug),
                user_id=user_id,
            )

    def test_duplicate_active_membership_is_rejected(self):
        organization_id, user_id = self.add_organization("membership-duplicate"), self.add_user()
        self.execute(
            f'''INSERT INTO "{self.schema}".organization_memberships
                (organization_id, user_id, role) VALUES (:organization_id, :user_id, 'viewer')''',
            organization_id=organization_id,
            user_id=user_id,
        )
        with self.assertRaises(Exception):
            self.execute(
                f'''INSERT INTO "{self.schema}".organization_memberships
                    (organization_id, user_id, role) VALUES (:organization_id, :user_id, 'viewer')''',
                organization_id=organization_id,
                user_id=user_id,
            )

    def test_cross_organization_tag_assignment_and_campaign_recipient_are_rejected(self):
        first, second = self.add_organization("cross-a"), self.add_organization("cross-b")
        subscriber_id = self.add_subscriber(first, "subscriber@example.com")
        tag_id = self.add_tag(second, "buyer")
        with self.assertRaises(Exception):
            self.execute(
                f'''INSERT INTO "{self.schema}".subscriber_tag_assignments
                    (organization_id, subscriber_id, tag_id)
                    VALUES (:organization_id, :subscriber_id, :tag_id)''',
                organization_id=first,
                subscriber_id=subscriber_id,
                tag_id=tag_id,
            )
        campaign_id = self.scalar(
            f'''INSERT INTO "{self.schema}".campaigns (organization_id)
                VALUES (:organization_id) RETURNING id''',
            organization_id=second,
        )
        with self.assertRaises(Exception):
            self.execute(
                f'''INSERT INTO "{self.schema}".campaign_recipients
                    (organization_id, campaign_id, subscriber_id)
                    VALUES (:organization_id, :campaign_id, :subscriber_id)''',
                organization_id=second,
                campaign_id=campaign_id,
                subscriber_id=subscriber_id,
            )


if __name__ == "__main__":
    unittest.main()
