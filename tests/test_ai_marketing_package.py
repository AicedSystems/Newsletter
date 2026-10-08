import base64
import importlib
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import ANY, Mock, patch


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "test-editor"
os.environ["EDITOR_PASSWORD"] = "test-password"

if "app" in sys.modules:
    app_module = importlib.reload(sys.modules["app"])
else:
    app_module = importlib.import_module("app")

from models import Campaign, CampaignRecipient


def auth_header():
    credentials = base64.b64encode(b"test-editor:test-password").decode("ascii")
    return {"Authorization": f"Basic {credentials}"}


def tags():
    return [
        SimpleNamespace(id=1, name="First-Time Buyer", normalized_name="first-time buyer"),
        SimpleNamespace(id=2, name="Palmdale", normalized_name="palmdale"),
    ]


def package(action_type="contact", intent="buyer", audience_tags=None):
    return {
        "article": {
            "title": "Planning Your First Home Purchase",
            "category": "training",
            "excerpt": "Practical guidance for first-time buyers preparing for a home purchase.",
            "tags": ["First-Time Buyer", "Palmdale"],
            "contentBlocks": [
                {"type": "heading", "text": "Start with a realistic plan"},
                {"type": "paragraph", "text": "A clear budget can help you prepare for the next step."},
                {
                    "type": "cta",
                    "headline": "Ready to explore your options?",
                    "body": "Share what you are looking for and we can discuss your next steps.",
                    "buttonLabel": "Explore My Options",
                    "actionType": action_type,
                    "intent": intent,
                },
            ],
        },
        "campaign": {
            "name": "First-Time Buyer Planning Guide",
            "subject": "Start your home-buying plan with confidence",
            "preheader": "A practical guide for preparing for your next move.",
        },
        "audience": {
            "tags": audience_tags if audience_tags is not None else ["First-Time Buyer", "Palmdale"],
            "rationale": "This content is relevant to first-time buyers in Palmdale.",
        },
    }


def revision_template():
    return {
        "summary": "Updated the requested section.",
        "article": {"title": None, "excerpt": None, "category": None, "tags": None, "contentBlocks": None},
        "cta": {"headline": None, "body": None, "buttonLabel": None, "actionType": None, "intent": None},
        "campaign": {"name": None, "subject": None, "preheader": None},
        "audience": {"tags": None, "rationale": None},
    }


def editable_blocks(count):
    return [
        {
            "type": "heading" if index % 3 == 0 else "paragraph" if index % 3 == 1 else "quote",
            "text": f"Useful revised article section {index + 1}.",
        }
        for index in range(count)
    ]


class ScalarResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return self

    def all(self):
        return self.values

    def __iter__(self):
        return iter(self.values)


class SingleResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


def persisted_draft_post(post_id=42):
    article = package()["article"]
    return app_module.Post(
        id=post_id,
        title=article["title"],
        content="",
        category=article["category"],
        tags=", ".join(article["tags"]),
        excerpt=article["excerpt"],
        featured_image=None,
        status="draft",
        published_at=None,
        content_blocks=article["contentBlocks"],
    )


def persisted_handoff(post_id=42, expires_at=None, handoff_id=7):
    proposal = package()
    return SimpleNamespace(
        id=handoff_id,
        post_id=post_id,
        expires_at=expires_at or app_module.datetime.utcnow() + app_module.timedelta(days=14),
        campaign_name=proposal["campaign"]["name"],
        subject=proposal["campaign"]["subject"],
        preheader=proposal["campaign"]["preheader"],
        audience_tag_names=proposal["audience"]["tags"],
        audience_rationale=proposal["audience"]["rationale"],
    )


class AiMarketingPackageTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def test_authentication_is_required(self):
        response = self.client.post("/api/aiced/marketing-package", json={"request": "Create a buyer campaign."})
        self.assertEqual(response.status_code, 401)

    def test_handoff_authentication_is_required(self):
        response = self.client.post("/api/aiced/article-campaign-handoff", json=package())
        self.assertEqual(response.status_code, 401)

    def test_publish_workflow_authentication_is_required(self):
        response = self.client.post(f"/api/aiced/workflows/{'P' * 43}/publish")
        self.assertEqual(response.status_code, 401)

    def test_handoff_foreign_key_resolves_to_post_metadata(self):
        foreign_key = next(iter(app_module.AicedArticleCampaignHandoff.__table__.c.post_id.foreign_keys))

        self.assertEqual(app_module.Post.__table__.key, "posts")
        self.assertIsNone(app_module.Post.__table__.schema)
        self.assertEqual(foreign_key.target_fullname, "posts.id")
        self.assertIs(foreign_key.column.table, app_module.Post.__table__)

    def test_metadata_tables_sort_with_handoff_foreign_key(self):
        table_keys = {table.key for table in app_module.db.metadata.sorted_tables}

        self.assertIn("posts", table_keys)
        self.assertIn("public.aiced_article_campaign_handoffs", table_keys)

    def test_unapplied_handoff_migration_targets_physical_public_posts_table(self):
        migration_path = (
            Path(__file__).resolve().parents[1]
            / "migrations/versions/c4a2f9d87b11_create_aiced_article_campaign_handoffs.py"
        )
        migration_source = migration_path.read_text(encoding="utf-8")

        self.assertIn('sa.ForeignKeyConstraint(["post_id"], ["public.posts.id"], ondelete="CASCADE")', migration_source)

    def test_campaign_metadata_uses_resolvable_orm_foreign_keys_and_snapshots(self):
        campaign = Campaign.__table__
        recipient = CampaignRecipient.__table__

        self.assertEqual(campaign.key, "public.campaigns")
        self.assertEqual(
            next(iter(campaign.c.post_id.foreign_keys)).target_fullname, "posts.id"
        )
        self.assertEqual(
            next(iter(campaign.c.workflow_handoff_id.foreign_keys)).target_fullname,
            "public.aiced_article_campaign_handoffs.id",
        )
        self.assertEqual(
            next(iter(recipient.c.campaign_id.foreign_keys)).target_fullname,
            "public.campaigns.id",
        )
        self.assertEqual(
            next(iter(recipient.c.subscriber_id.foreign_keys)).target_fullname,
            "public.subscribers.id",
        )
        self.assertEqual(
            next(iter(recipient.c.campaign_id.foreign_keys)).ondelete, "CASCADE"
        )
        self.assertEqual(
            next(iter(campaign.c.workflow_handoff_id.foreign_keys)).ondelete, "RESTRICT"
        )
        self.assertTrue(
            {"name", "subject", "preheader", "audience_tag_names"}.issubset(campaign.c.keys())
        )
        self.assertTrue({"email", "name"}.issubset(recipient.c.keys()))

    def test_campaign_status_constraints_and_duplicate_protections_are_declared(self):
        campaign_constraints = {
            constraint.name: str(constraint.sqltext)
            for constraint in Campaign.__table__.constraints
            if constraint.__class__.__name__ == "CheckConstraint"
        }
        recipient_constraints = {
            constraint.name: str(constraint.sqltext)
            for constraint in CampaignRecipient.__table__.constraints
            if constraint.__class__.__name__ == "CheckConstraint"
        }
        campaign_unique_columns = {
            tuple(column.name for column in constraint.columns)
            for constraint in Campaign.__table__.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        }
        recipient_unique_columns = {
            tuple(column.name for column in constraint.columns)
            for constraint in CampaignRecipient.__table__.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        }

        self.assertIn("'draft', 'sending', 'sent', 'partial', 'failed'", campaign_constraints["ck_campaigns_status"])
        self.assertIn("'pending', 'sent', 'failed'", recipient_constraints["ck_campaign_recipients_status"])
        self.assertIn(("workflow_handoff_id",), campaign_unique_columns)
        self.assertIn(("campaign_id", "subscriber_id"), recipient_unique_columns)

    def test_campaign_relationships_preserve_post_handoff_and_subscriber_links(self):
        self.assertEqual(Campaign.post.property.mapper.class_, app_module.Post)
        self.assertEqual(Campaign.handoff.property.mapper.class_, app_module.AicedArticleCampaignHandoff)
        self.assertEqual(Campaign.recipients.property.mapper.class_, CampaignRecipient)
        self.assertEqual(CampaignRecipient.subscriber.property.mapper.class_, app_module.Subscriber)
        self.assertIn("delete-orphan", Campaign.recipients.property.cascade)

    def test_campaign_migration_creates_only_campaign_persistence_tables(self):
        migration_path = (
            Path(__file__).resolve().parents[1]
            / "migrations/versions/d71f9a2c4e63_create_campaign_persistence.py"
        )
        migration_source = migration_path.read_text(encoding="utf-8")

        self.assertIn('down_revision = "c4a2f9d87b11"', migration_source)
        self.assertIn('"campaigns"', migration_source)
        self.assertIn('"campaign_recipients"', migration_source)
        self.assertIn('"public.aiced_article_campaign_handoffs.id"', migration_source)
        self.assertIn('"public.posts.id"', migration_source)
        self.assertIn('"public.subscribers.id"', migration_source)
        self.assertIn('"uq_campaigns_workflow_handoff_id"', migration_source)
        self.assertIn('"uq_campaign_recipients_campaign_subscriber"', migration_source)
        self.assertIn('op.drop_table("campaign_recipients", schema="public")', migration_source)
        self.assertIn('op.drop_table("campaigns", schema="public")', migration_source)

    def test_missing_request_is_rejected(self):
        response = self.client.post("/api/aiced/marketing-package", json={}, headers=auth_header())
        self.assertEqual(response.status_code, 400)

    def test_malformed_ai_response_is_rejected(self):
        response = SimpleNamespace(output_text="not json")
        client = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: response))
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(
            app_module, "create_openai_client", return_value=client
        ), patch.object(app_module.app.logger, "warning"):
            result, error, status, reference_id = app_module.request_ai_marketing_package("Create a buyer campaign.", tags())
        self.assertIsNone(result)
        self.assertEqual(status, 502)
        self.assertIn("unusable", error)
        self.assertIsNotNone(reference_id)

    def test_provider_failure_logs_sanitized_details_and_returns_reference(self):
        class ProviderError(Exception):
            status_code = 401
            message = "Authorization: Bearer sk_test_secret rejected private marketing request"

        client = SimpleNamespace(
            responses=SimpleNamespace(create=Mock(side_effect=ProviderError()))
        )
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(
            app_module, "create_openai_client", return_value=client
        ), patch.object(app_module.app.logger, "warning") as warning:
            result, error, status, reference_id = app_module.request_ai_marketing_package(
                "private marketing request", tags()
            )

        self.assertIsNone(result)
        self.assertEqual(error, "Aiced Bot could not create a marketing package.")
        self.assertEqual(status, 502)
        self.assertRegex(reference_id, r"^[A-F0-9]{10}$")
        logged_values = warning.call_args.args
        self.assertIn("ProviderError", logged_values)
        self.assertIn(401, logged_values)
        self.assertNotIn("sk_test_secret", " ".join(map(str, logged_values)))
        self.assertNotIn("private marketing request", " ".join(map(str, logged_values)))

    def test_validation_failure_logs_only_validation_reason(self):
        response = SimpleNamespace(output_text=json.dumps(package(action_type="invalid")))
        client = SimpleNamespace(responses=SimpleNamespace(create=Mock(return_value=response)))
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(
            app_module, "create_openai_client", return_value=client
        ), patch.object(app_module.app.logger, "warning") as warning:
            result, error, status, reference_id = app_module.request_ai_marketing_package(
                "private marketing request", tags()
            )

        self.assertIsNone(result)
        self.assertIn("unusable", error)
        self.assertEqual(status, 502)
        self.assertRegex(reference_id, r"^[A-F0-9]{10}$")
        logged_values = " ".join(map(str, warning.call_args.args))
        self.assertIn("validation failure", logged_values)
        self.assertNotIn("private marketing request", logged_values)

    def test_unsupported_cta_action_is_rejected(self):
        result, error = app_module.validate_ai_marketing_package(package(action_type="email"), {tag.normalized_name: tag for tag in tags()})
        self.assertIsNone(result)
        self.assertEqual(error, "AI returned an unsupported CTA action.")

    def test_unsupported_cta_intent_is_rejected(self):
        result, error = app_module.validate_ai_marketing_package(package(intent="investor"), {tag.normalized_name: tag for tag in tags()})
        self.assertIsNone(result)
        self.assertEqual(error, "AI returned an unsupported CTA intent.")

    def test_recruiting_cta_intent_is_supported(self):
        result, error = app_module.validate_ai_marketing_package(
            package(intent="recruiting"),
            {tag.normalized_name: tag for tag in tags()},
        )
        self.assertIsNone(error)
        self.assertEqual(result["article"]["contentBlocks"][-1]["intent"], "recruiting")

    def test_content_block_schema_uses_a_single_nullable_object_not_one_of(self):
        block_schema = app_module.AI_MARKETING_PACKAGE_SCHEMA["properties"]["article"]["properties"]["contentBlocks"]["items"]
        self.assertNotIn("oneOf", block_schema)
        self.assertEqual(block_schema["type"], "object")
        self.assertEqual(
            set(block_schema["required"]),
            {"type", "text", "headline", "body", "buttonLabel", "actionType", "intent"},
        )
        self.assertEqual(
            set(block_schema["properties"]["actionType"]["enum"]),
            {"contact", "schedule", None},
        )
        self.assertEqual(
            set(block_schema["properties"]["intent"]["enum"]),
            {
                "buyer",
                "seller",
                "valuation",
                "consultation",
                "recruiting",
                "general",
                None,
            },
        )

    def test_marketing_instructions_define_null_fields_and_general_intent(self):
        instructions = app_module.AI_MARKETING_PACKAGE_INSTRUCTIONS
        self.assertIn('set headline, body, buttonLabel, actionType, and intent to null', instructions)
        self.assertIn('set text to null', instructions)
        self.assertIn('must be exactly "contact" or "schedule"', instructions)
        self.assertIn('When uncertain, use general.', instructions)
        self.assertIn('intent "recruiting"', instructions)

    def test_nullable_provider_blocks_normalize_to_existing_public_shape(self):
        provider_package = package()
        for block in provider_package["article"]["contentBlocks"]:
            if block["type"] in {"heading", "paragraph"}:
                block.update(
                    {
                        "headline": None,
                        "body": None,
                        "buttonLabel": None,
                        "actionType": None,
                        "intent": None,
                    }
                )
            else:
                block["text"] = None

        result, error = app_module.validate_ai_marketing_package(
            provider_package,
            {tag.normalized_name: tag for tag in tags()},
        )
        self.assertIsNone(error)
        self.assertEqual(
            result["article"]["contentBlocks"],
            package()["article"]["contentBlocks"],
        )

    def test_malformed_cta_is_rejected(self):
        proposal = package()
        del proposal["article"]["contentBlocks"][-1]["body"]
        result, error = app_module.validate_ai_marketing_package(
            proposal, {tag.normalized_name: tag for tag in tags()}
        )
        self.assertIsNone(result)
        self.assertEqual(error, "AI returned an unsupported article content block.")

    def test_missing_cta_is_rejected(self):
        proposal = package()
        proposal["article"]["contentBlocks"] = proposal["article"]["contentBlocks"][:-1]
        result, error = app_module.validate_ai_marketing_package(
            proposal, {tag.normalized_name: tag for tag in tags()}
        )
        self.assertIsNone(result)
        self.assertEqual(error, "AI must return one CTA as the final article block.")

    def test_multiple_ctas_are_rejected(self):
        proposal = package()
        proposal["article"]["contentBlocks"].insert(1, dict(proposal["article"]["contentBlocks"][-1]))
        result, error = app_module.validate_ai_marketing_package(
            proposal, {tag.normalized_name: tag for tag in tags()}
        )
        self.assertIsNone(result)
        self.assertEqual(error, "AI must return one CTA as the final article block.")

    def test_cta_must_be_final(self):
        proposal = package()
        cta = proposal["article"]["contentBlocks"].pop()
        proposal["article"]["contentBlocks"].insert(1, cta)
        result, error = app_module.validate_ai_marketing_package(
            proposal, {tag.normalized_name: tag for tag in tags()}
        )
        self.assertIsNone(result)
        self.assertEqual(error, "AI must return one CTA as the final article block.")

    def test_unknown_audience_tag_is_rejected(self):
        result, error = app_module.validate_ai_marketing_package(package(audience_tags=["Unknown tag"]), {tag.normalized_name: tag for tag in tags()})
        self.assertIsNone(result)
        self.assertEqual(error, "AI returned an unavailable audience tag.")

    def test_html_in_ai_output_is_rejected(self):
        proposal = package()
        proposal["article"]["contentBlocks"][1]["text"] = "<strong>Do not render HTML</strong>"
        result, error = app_module.validate_ai_marketing_package(proposal, {tag.normalized_name: tag for tag in tags()})
        self.assertIsNone(result)
        self.assertEqual(error, "AI returned an invalid article content block.")

    def test_openai_input_contains_only_request_and_tag_names(self):
        response = SimpleNamespace(output_text=json.dumps(package()))
        client = SimpleNamespace(responses=SimpleNamespace(create=Mock(return_value=response)))
        private_tag = SimpleNamespace(
            id=1,
            name="First-Time Buyer",
            normalized_name="first-time buyer",
            email="private@example.com",
            first_name="Private",
        )
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(app_module, "create_openai_client", return_value=client):
            app_module.request_ai_marketing_package("Create a buyer campaign.", [private_tag, tags()[1]])
        input_payload = client.responses.create.call_args.kwargs["input"]
        self.assertIn("Create a buyer campaign.", input_payload)
        self.assertIn("First-Time Buyer", input_payload)
        self.assertNotIn("private@example.com", input_payload)
        self.assertNotIn("Private", input_payload)
        self.assertEqual(set(json.loads(input_payload)), {"marketingRequest", "existingAudienceTags"})

    def test_existing_campaign_proposal_helper_remains_usable(self):
        proposal = {
            "campaignName": "Buyer Guide",
            "postId": 1,
            "subject": "A practical buyer guide",
            "preheader": "Helpful next steps for buyers.",
            "audience": {"tags": ["First-Time Buyer"]},
            "audienceRationale": "The article is intended for first-time buyers.",
        }
        response = SimpleNamespace(output_text=json.dumps(proposal))
        client = SimpleNamespace(responses=SimpleNamespace(create=Mock(return_value=response)))
        post = SimpleNamespace(id=1, title="Buyer guide", category="training")
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(app_module, "create_openai_client", return_value=client):
            result, error, status = app_module.request_ai_campaign_proposal("Create a buyer campaign.", [post], tags())
        self.assertEqual(status, 200)
        self.assertIsNone(error)
        self.assertEqual(result["postId"], 1)
        self.assertEqual(result["audience"]["tags"][0].name, "First-Time Buyer")

    def test_endpoint_counts_recipients_without_persisting_or_sending(self):
        available_tags = tags()
        proposal = package()
        with patch.object(app_module.db.session, "execute", return_value=ScalarResult(available_tags)), patch.object(
            app_module, "request_ai_marketing_package", return_value=(
                app_module.validate_ai_marketing_package(proposal, {tag.normalized_name: tag for tag in available_tags})[0], None, 200, None
            )
        ), patch.object(app_module, "resolve_active_aiced_audience", return_value=[10, 11]) as resolve, patch.object(
            app_module.db.session, "add"
        ) as add, patch.object(app_module.db.session, "commit") as commit, patch.object(
            app_module, "send_test_campaign_email"
        ) as send:
            response = self.client.post(
                "/api/aiced/marketing-package",
                json={"request": "Create a buyer campaign."},
                headers=auth_header(),
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["audience"]["eligibleRecipientCount"], 2)
        self.assertEqual([tag.name for tag in resolve.call_args.args[0]], ["First-Time Buyer", "Palmdale"])
        add.assert_not_called()
        commit.assert_not_called()
        send.assert_not_called()

    def test_active_audience_query_uses_active_status_and_and_semantics(self):
        execute = Mock(return_value=ScalarResult([1]))
        with patch.object(app_module.db.session, "execute", execute):
            recipient_ids = app_module.resolve_active_aiced_audience(tags())
        statement_text = str(execute.call_args.args[0])
        self.assertEqual(recipient_ids, [1])
        self.assertIn("subscribers.status", statement_text)
        self.assertIn("HAVING", statement_text)
        self.assertIn("count(distinct", statement_text.lower())

    def test_reviewed_package_creates_one_draft_and_handoff_atomically(self):
        added = []

        def add(instance):
            added.append(instance)

        def flush():
            next(item for item in added if isinstance(item, app_module.Post)).id = 42

        with patch.object(app_module.db.session, "execute", return_value=ScalarResult(tags())), patch.object(
            app_module.db.session, "add", side_effect=add
        ), patch.object(app_module.db.session, "flush", side_effect=flush), patch.object(
            app_module.db.session, "commit"
        ) as commit, patch.object(app_module, "send_test_campaign_email") as send:
            response = self.client.post(
                "/api/aiced/article-campaign-handoff",
                json=package(),
                headers=auth_header(),
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(set(response.get_json()), {"postId", "workflowToken", "availableAudienceTags"})
        self.assertEqual(response.get_json()["postId"], 42)
        self.assertGreaterEqual(len(response.get_json()["workflowToken"]), 32)
        self.assertEqual(len(added), 2)
        draft, handoff = added
        self.assertEqual(draft.status, "draft")
        self.assertIsNone(draft.published_at)
        self.assertEqual(draft.content_blocks[-1]["type"], "cta")
        self.assertEqual(handoff.post_id, 42)
        self.assertEqual(handoff.campaign_name, "First-Time Buyer Planning Guide")
        self.assertEqual(handoff.subject, "Start your home-buying plan with confidence")
        self.assertEqual(handoff.preheader, "A practical guide for preparing for your next move.")
        self.assertEqual(handoff.audience_tag_names, ["First-Time Buyer", "Palmdale"])
        commit.assert_called_once()
        send.assert_not_called()

    def test_invalid_reviewed_package_never_creates_a_draft(self):
        invalid = package()
        invalid["article"]["contentBlocks"][-1]["actionType"] = "invalid"
        with patch.object(app_module.db.session, "execute", return_value=ScalarResult(tags())), patch.object(
            app_module.db.session, "add"
        ) as add, patch.object(app_module.db.session, "commit") as commit:
            response = self.client.post(
                "/api/aiced/article-campaign-handoff",
                json=invalid,
                headers=auth_header(),
            )
        self.assertEqual(response.status_code, 400)
        add.assert_not_called()
        commit.assert_not_called()

    def test_handoff_failure_rolls_back_the_draft_and_handoff(self):
        with patch.object(app_module.db.session, "execute", return_value=ScalarResult(tags())), patch.object(
            app_module.db.session, "add"
        ), patch.object(app_module.db.session, "flush", side_effect=app_module.SQLAlchemyError()), patch.object(
            app_module.db.session, "rollback"
        ) as rollback, patch.object(app_module.db.session, "commit") as commit, patch.object(
            app_module.app.logger, "exception"
        ) as log_exception:
            response = self.client.post(
                "/api/aiced/article-campaign-handoff",
                json=package(),
                headers=auth_header(),
            )
        self.assertEqual(response.status_code, 500)
        self.assertIn("Reference:", response.get_json()["message"])
        rollback.assert_called_once()
        commit.assert_not_called()
        log_exception.assert_called_once()

    def test_valid_handoff_link_returns_only_validity(self):
        handoff = SimpleNamespace(post_id=42, expires_at=app_module.datetime.utcnow() + app_module.timedelta(days=1))
        with patch.object(app_module.db.session, "execute", return_value=SingleResult(handoff)):
            response = self.client.get(
                "/api/aiced/article-campaign-handoff/opaque-token/posts/42",
                headers=auth_header(),
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"valid": True})

    def test_invalid_handoff_link_does_not_expose_proposal_data(self):
        with patch.object(app_module.db.session, "execute", return_value=SingleResult(None)):
            response = self.client.get(
                "/api/aiced/article-campaign-handoff/not-a-token/posts/42",
                headers=auth_header(),
            )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"message": "This Aiced workflow link is unavailable."})

    def test_workflow_restore_requires_authentication(self):
        response = self.client.get(f"/api/aiced/workflows/{'A' * 43}")
        self.assertEqual(response.status_code, 401)

    def test_workflow_restore_returns_only_its_linked_draft_and_campaign_context(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), ScalarResult(tags()), SingleResult(None)],
        ), patch.object(app_module.db.session, "get", return_value=post) as get_post, patch.object(
            app_module, "resolve_active_aiced_audience", return_value=[10, 11]
        ) as resolve_audience, patch.object(app_module.db.session, "add") as add, patch.object(
            app_module.db.session, "commit"
        ) as commit, patch.object(app_module, "request_ai_marketing_package") as request_ai:
            response = self.client.get(
                f"/api/aiced/workflows/{'A' * 43}", headers=auth_header()
            )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(set(body), {"workflow", "article", "campaign", "audience", "availableAudienceTags"})
        self.assertEqual(body["workflow"], {"postId": 42, "status": "draft"})
        self.assertEqual(body["article"]["title"], post.title)
        self.assertEqual(body["article"]["contentBlocks"], post.content_blocks)
        self.assertEqual(body["campaign"]["subject"], handoff.subject)
        self.assertIsNone(body["campaign"]["delivery"])
        self.assertEqual(body["audience"]["tags"], handoff.audience_tag_names)
        self.assertEqual(body["audience"]["eligibleRecipientCount"], 2)
        self.assertNotIn("email", str(body).lower())
        self.assertNotIn("recipientIds", body["audience"])
        get_post.assert_called_once_with(app_module.Post, 42)
        self.assertEqual([tag.name for tag in resolve_audience.call_args.args[0]], ["First-Time Buyer", "Palmdale"])
        add.assert_not_called()
        commit.assert_not_called()
        request_ai.assert_not_called()

    def test_workflow_restore_returns_not_found_for_unknown_or_expired_workflow(self):
        with patch.object(app_module.db.session, "execute", return_value=SingleResult(None)):
            unknown = self.client.get(
                f"/api/aiced/workflows/{'B' * 43}", headers=auth_header()
            )

        expired_handoff = persisted_handoff(
            expires_at=app_module.datetime.utcnow() - app_module.timedelta(seconds=1)
        )
        with patch.object(
            app_module.db.session, "execute", return_value=SingleResult(expired_handoff)
        ), patch.object(app_module.db.session, "get") as get_post:
            expired = self.client.get(
                f"/api/aiced/workflows/{'C' * 43}", headers=auth_header()
            )

        self.assertEqual(unknown.status_code, 404)
        self.assertEqual(expired.status_code, 404)
        self.assertEqual(unknown.get_json(), {"message": "This Aiced workflow is unavailable."})
        get_post.assert_not_called()

    def test_workflow_restore_rejects_malformed_token_without_lookup(self):
        with patch.object(app_module.db.session, "execute") as execute:
            response = self.client.get("/api/aiced/workflows/not%20a%20token", headers=auth_header())

        self.assertEqual(response.status_code, 404)
        execute.assert_not_called()

    def test_workflow_restore_rejects_linked_post_that_is_not_reviewable(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "archived"
        with patch.object(
            app_module.db.session, "execute", return_value=SingleResult(handoff)
        ), patch.object(app_module.db.session, "get", return_value=post):
            response = self.client.get(
                f"/api/aiced/workflows/{'D' * 43}", headers=auth_header()
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json(),
            {"message": "This Aiced workflow is no longer available for review."},
        )

    def test_publish_marks_the_same_draft_post_published_once(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        with patch.object(app_module.db.session, "execute", side_effect=[SingleResult(handoff), ScalarResult(tags())]), patch.object(
            app_module.db.session, "get", return_value=post
        ), patch.object(app_module.db.session, "commit") as commit, patch.object(
            app_module, "resolve_active_aiced_audience", return_value=[]
        ):
            response = self.client.post(
                f"/api/aiced/workflows/{'H' * 43}/publish", headers=auth_header()
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.status, "published")
        self.assertIsNotNone(post.published_at)
        self.assertIsNotNone(handoff.published_at)
        self.assertEqual(response.get_json()["workflow"]["postId"], post.id)
        commit.assert_called_once()

    def test_campaign_prepare_requires_authentication(self):
        response = self.client.post(f"/api/aiced/workflows/{'S' * 43}/campaign/prepare")
        self.assertEqual(response.status_code, 401)

    def test_draft_audience_preview_uses_the_existing_fail_closed_resolver_without_persistence(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        subscriber = SimpleNamespace(
            email="james@example.com",
            first_name="James",
            last_name="Smith",
            status="active",
            tags=[tags()[0], tags()[1]],
        )
        with patch.object(
            app_module.db.session, "execute", side_effect=[SingleResult(handoff), SingleResult(None)]
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module, "resolve_aiced_handoff_subscribers", return_value=[subscriber]
        ) as resolve, patch.object(app_module.db.session, "add") as add, patch.object(
            app_module.db.session, "commit"
        ) as commit:
            response = self.client.get(
                f"/api/aiced/workflows/{'V' * 43}/audience-preview", headers=auth_header()
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["source"], "live")
        self.assertEqual(response.get_json()["subscribers"][0]["tags"], ["First-Time Buyer", "Palmdale"])
        resolve.assert_called_once_with(handoff)
        add.assert_not_called()
        commit.assert_not_called()

    def test_audience_preview_uses_existing_campaign_recipients_as_the_frozen_snapshot(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        post.status = "published"
        campaign = SimpleNamespace(id=99, status="sent")
        recipients = [SimpleNamespace(name="James Smith", email="james@example.com", status="sent")]
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult(recipients)],
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module, "resolve_aiced_handoff_subscribers"
        ) as resolve, patch.object(app_module.db.session, "add") as add, patch.object(
            app_module.db.session, "commit"
        ) as commit:
            response = self.client.get(
                f"/api/aiced/workflows/{'W' * 43}/audience-preview", headers=auth_header()
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["source"], "snapshot")
        self.assertEqual(response.get_json()["subscribers"][0]["status"], "sent")
        resolve.assert_not_called()
        add.assert_not_called()
        commit.assert_not_called()

    def test_campaign_prepare_creates_one_frozen_campaign_and_recipient_snapshots(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        subscribers = [
            SimpleNamespace(id=10, email="steven@example.com", first_name="Steven", last_name="Armijo", status="active"),
            SimpleNamespace(id=11, email="eric@example.com", first_name="Eric", last_name=None, status="active"),
        ]
        added = []

        def flush():
            next(item for item in added if isinstance(item, Campaign)).id = 99

        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[
                SingleResult(handoff),
                SingleResult(None),
                ScalarResult(tags()),
                ScalarResult(subscribers),
            ],
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module, "resolve_active_aiced_audience", return_value=[10, 11]
        ) as resolve, patch.object(app_module.db.session, "add", side_effect=added.append), patch.object(
            app_module.db.session, "flush", side_effect=flush
        ), patch.object(app_module.db.session, "add_all") as add_all, patch.object(
            app_module.db.session, "commit"
        ) as commit, patch.object(app_module, "send_campaign_recipient_email") as send:
            response = self.client.post(
                f"/api/aiced/workflows/{'S' * 43}/campaign/prepare", headers=auth_header()
            )

        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(body["campaign"]["recipientCount"], 2)
        self.assertEqual(body["campaign"]["status"], "draft")
        self.assertEqual(
            body["recipients"][0],
            {"id": None, "name": "Steven Armijo", "email": "s***@example.com", "status": "pending"},
        )
        campaign = added[0]
        self.assertEqual(campaign.workflow_handoff_id, handoff.id)
        self.assertEqual(campaign.post_id, post.id)
        self.assertEqual(campaign.audience_tag_names, handoff.audience_tag_names)
        snapshots = add_all.call_args.args[0]
        self.assertEqual([(item.subscriber_id, item.email, item.name) for item in snapshots], [(10, "steven@example.com", "Steven Armijo"), (11, "eric@example.com", "Eric")])
        resolve.assert_called_once()
        commit.assert_called_once()
        send.assert_not_called()

    def test_campaign_prepare_returns_zero_audience_without_creating_a_campaign(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(None)],
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module, "resolve_aiced_handoff_subscribers", return_value=[]
        ), patch.object(app_module.db.session, "add") as add, patch.object(
            app_module.db.session, "commit"
        ) as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'T' * 43}/campaign/prepare", headers=auth_header()
            )
        self.assertEqual(response.status_code, 422)
        self.assertIn("No active recipients", response.get_json()["message"])
        add.assert_not_called()
        commit.assert_not_called()

    def test_campaign_prepare_reuses_existing_snapshot_without_recalculating_audience(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        campaign = Campaign(id=99, workflow_handoff_id=handoff.id, post_id=post.id, name="Campaign", subject="Subject", preheader="Preheader", audience_tag_names=[], status="draft")
        recipients = [CampaignRecipient(id=1, campaign_id=99, subscriber_id=10, email="steven@example.com", name="Steven", status="pending")]
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult(recipients)],
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module, "resolve_aiced_handoff_subscribers"
        ) as resolve, patch.object(app_module.db.session, "add") as add, patch.object(
            app_module.db.session, "commit"
        ) as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'X' * 43}/campaign/prepare", headers=auth_header()
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["campaign"]["recipientCount"], 1)
        resolve.assert_not_called()
        add.assert_not_called()
        commit.assert_not_called()

    def test_campaign_recipient_removal_updates_only_the_prepared_snapshot(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        campaign = Campaign(id=99, workflow_handoff_id=handoff.id, post_id=post.id, name="Campaign", subject="Subject", preheader="Preheader", audience_tag_names=[], status="draft")
        first = CampaignRecipient(id=1, campaign_id=99, subscriber_id=10, email="one@example.com", name="One", status="pending")
        second = CampaignRecipient(id=2, campaign_id=99, subscriber_id=11, email="two@example.com", name="Two", status="pending")
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult([first, second])],
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module.db.session, "delete"
        ) as delete, patch.object(app_module.db.session, "commit") as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'R' * 43}/campaign/recipients/remove",
                headers=auth_header(),
                json={"recipientIds": [1]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["campaign"]["recipientCount"], 1)
        self.assertEqual(response.get_json()["recipients"][0]["id"], 2)
        delete.assert_called_once_with(first)
        commit.assert_called_once()

    def test_campaign_recipient_removal_refuses_to_empty_or_change_sent_campaigns(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        campaign = Campaign(id=99, workflow_handoff_id=handoff.id, post_id=post.id, name="Campaign", subject="Subject", preheader="Preheader", audience_tag_names=[], status="draft")
        recipient = CampaignRecipient(id=1, campaign_id=99, subscriber_id=10, email="one@example.com", name="One", status="pending")
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult([recipient])],
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module.db.session, "delete"
        ) as delete, patch.object(app_module.db.session, "commit") as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'Q' * 43}/campaign/recipients/remove",
                headers=auth_header(),
                json={"recipientIds": [1]},
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("Keep at least one recipient", response.get_json()["message"])
        delete.assert_not_called()
        commit.assert_not_called()

    def test_campaign_send_submits_each_pending_snapshot_once_and_records_result(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        campaign = Campaign(
            id=99,
            workflow_handoff_id=handoff.id,
            post_id=post.id,
            name=handoff.campaign_name,
            subject=handoff.subject,
            preheader=handoff.preheader,
            audience_tag_names=handoff.audience_tag_names,
            status=Campaign.STATUS_DRAFT,
        )
        recipients = [
            CampaignRecipient(id=1, campaign_id=99, subscriber_id=10, email="steven@example.com", name="Steven", status="pending"),
            CampaignRecipient(id=2, campaign_id=99, subscriber_id=11, email="eric@example.com", name="Eric", status="pending"),
        ]
        active_subscriber = SimpleNamespace(status="active")
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult(recipients)],
        ), patch.object(app_module.db.session, "get", side_effect=[post, active_subscriber, active_subscriber]), patch.object(
            app_module, "get_email_branding", return_value=SimpleNamespace(public_base_url="https://example.com")
        ), patch.object(app_module, "render_newsletter_email", return_value={"html": "<p>email</p>", "text": "email"}) as render, patch.object(
            app_module, "send_campaign_recipient_email", side_effect=[("msg-1", None, 200), ("msg-2", None, 200)]
        ) as send, patch.object(app_module.db.session, "commit") as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'U' * 43}/campaign/send", headers=auth_header()
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(campaign.status, "sent")
        self.assertIsNotNone(campaign.sent_at)
        self.assertEqual([recipient.status for recipient in recipients], ["sent", "sent"])
        self.assertEqual([recipient.provider_message_id for recipient in recipients], ["msg-1", "msg-2"])
        self.assertEqual(send.call_count, 2)
        self.assertTrue(all(call.args[0] in {"steven@example.com", "eric@example.com"} for call in send.call_args_list))
        render.assert_called_once_with(post, campaign.subject, campaign.preheader, ANY)
        self.assertEqual(commit.call_count, 4)

    def test_campaign_send_never_resends_sent_recipients_or_inactive_subscribers(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        campaign = Campaign(id=99, workflow_handoff_id=handoff.id, post_id=post.id, name="Campaign", subject="Subject", preheader="Preheader", audience_tag_names=[], status="partial")
        sent = CampaignRecipient(id=1, campaign_id=99, subscriber_id=10, email="sent@example.com", name="Sent", status="sent")
        opted_out = CampaignRecipient(id=2, campaign_id=99, subscriber_id=11, email="opted@example.com", name="Opted", status="pending")
        with patch.object(
            app_module.db.session,
            "execute",
            side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult([sent, opted_out])],
        ), patch.object(app_module.db.session, "get", side_effect=[post, SimpleNamespace(status="unsubscribed")]), patch.object(
            app_module, "get_email_branding", return_value=SimpleNamespace(public_base_url="https://example.com")
        ), patch.object(app_module, "render_newsletter_email", return_value={"html": "<p>email</p>", "text": "email"}), patch.object(
            app_module, "send_campaign_recipient_email"
        ) as send, patch.object(app_module.db.session, "commit"):
            response = self.client.post(
                f"/api/aiced/workflows/{'V' * 43}/campaign/send", headers=auth_header()
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sent.status, "sent")
        self.assertEqual(opted_out.status, "failed")
        self.assertEqual(opted_out.error_message, "Recipient is no longer active.")
        self.assertEqual(campaign.status, "partial")
        send.assert_not_called()

    def test_campaign_send_enforces_server_side_limit_before_provider_calls(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        campaign = Campaign(id=99, workflow_handoff_id=handoff.id, post_id=post.id, name="Campaign", subject="Subject", preheader="Preheader", audience_tag_names=[], status="draft")
        recipients = [
            CampaignRecipient(id=1, campaign_id=99, subscriber_id=10, email="one@example.com", name="One", status="pending"),
            CampaignRecipient(id=2, campaign_id=99, subscriber_id=11, email="two@example.com", name="Two", status="pending"),
        ]
        with patch.object(app_module.db.session, "execute", side_effect=[SingleResult(handoff), SingleResult(campaign), ScalarResult(recipients)]), patch.object(
            app_module.db.session, "get", return_value=post
        ), patch.object(app_module, "send_campaign_recipient_email") as send, patch.dict(
            app_module.app.config, {"AICED_SYNC_SEND_MAX_RECIPIENTS": 1}
        ):
            response = self.client.post(
                f"/api/aiced/workflows/{'Y' * 43}/campaign/send", headers=auth_header()
            )
        self.assertEqual(response.status_code, 422)
        self.assertIn("synchronous demo send limit", response.get_json()["message"])
        send.assert_not_called()

    def test_campaign_send_rejects_sent_or_sending_campaign_before_provider_calls(self):
        handoff = persisted_handoff()
        post = persisted_draft_post()
        post.status = "published"
        for status, expected_message in (("sent", "already been sent"), ("sending", "already in progress")):
            campaign = Campaign(id=99, workflow_handoff_id=handoff.id, post_id=post.id, name="Campaign", subject="Subject", preheader="Preheader", audience_tag_names=[], status=status)
            with patch.object(
                app_module.db.session,
                "execute",
                side_effect=[SingleResult(handoff), SingleResult(campaign)],
            ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
                app_module, "send_campaign_recipient_email"
            ) as send:
                response = self.client.post(
                    f"/api/aiced/workflows/{'W' * 43}/campaign/send", headers=auth_header()
                )
            self.assertEqual(response.status_code, 409)
            self.assertIn(expected_message, response.get_json()["message"])
            send.assert_not_called()

    def test_article_revision_preserves_existing_cta(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["article"] = {
            "title": None,
            "excerpt": None,
            "category": None,
            "tags": None,
            "contentBlocks": [
                {"type": "heading", "text": "Plan your next step"},
                {"type": "paragraph", "text": "Start with a simple budget and timeline."},
            ],
        }
        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )
        self.assertIsNone(error)
        self.assertEqual(validated["article"]["contentBlocks"][-1], source["contentBlocks"][-1])
        self.assertIsNone(validated["cta"])

    def test_text_only_revision_does_not_require_an_excerpt(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["article"]["contentBlocks"] = [
            {"type": "heading", "text": "Start with a comfortable plan"},
            {"type": "paragraph", "text": "Take your time and build a budget that feels right for you."},
        ]

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertNotIn("excerpt", validated["article"])
        self.assertEqual(validated["article"]["contentBlocks"][-1], source["contentBlocks"][-1])

    def test_structure_revision_allows_a_longer_article_and_preserves_metadata(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        source["contentBlocks"] = [*editable_blocks(5), source["contentBlocks"][-1]]
        revision = revision_template()
        revision["article"]["contentBlocks"] = editable_blocks(15)

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertEqual(validated["article"]["contentBlocks"][:-1], editable_blocks(15))
        self.assertEqual(validated["article"]["contentBlocks"][-1], source["contentBlocks"][-1])
        self.assertEqual(set(validated["article"]), {"contentBlocks"})

    def test_structure_revision_allows_a_shorter_article(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        source["contentBlocks"] = [*editable_blocks(15), source["contentBlocks"][-1]]
        revision = revision_template()
        revision["article"]["contentBlocks"] = editable_blocks(4)

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertEqual(validated["article"]["contentBlocks"][:-1], editable_blocks(4))
        self.assertEqual(validated["article"]["contentBlocks"].count(source["contentBlocks"][-1]), 1)

    def test_structure_revision_preserves_special_blocks_before_the_final_cta(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        cta = source["contentBlocks"][-1]
        image = {"type": "image", "url": "https://example.com/market.jpg"}
        video = {"type": "youtube", "url": "https://www.youtube.com/watch?v=abc123"}
        source["contentBlocks"] = [*editable_blocks(2), image, video, cta]
        revision = revision_template()
        revision["article"]["contentBlocks"] = editable_blocks(6)

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertEqual(validated["article"]["contentBlocks"][-3:], [image, video, cta])

    def test_structure_revision_rejects_an_unsupported_generated_block(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["article"]["contentBlocks"] = [{"type": "image", "text": "Not allowed."}]

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(validated)
        self.assertIn("unsupported block type", error)

    def test_structure_and_cta_revision_keep_exactly_one_revised_cta(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["article"]["contentBlocks"] = editable_blocks(8)
        revision["cta"]["buttonLabel"] = "Talk Through Your Plan"

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertEqual(sum(block["type"] == "cta" for block in validated["article"]["contentBlocks"]), 1)
        self.assertEqual(validated["cta"]["buttonLabel"], "Talk Through Your Plan")
        self.assertEqual(validated["article"]["contentBlocks"][-1], source["contentBlocks"][-1])

    def test_structure_revision_rejects_a_malformed_text_block(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["article"]["contentBlocks"] = [{"type": "paragraph", "text": "   "}]

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(validated)
        self.assertIn("paragraph blocks require text", error)

    def test_title_and_excerpt_revisions_validate_only_the_returned_fields(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["article"]["title"] = "A Clear First Home Planning Guide"
        revision["article"]["excerpt"] = "Practical first-home planning guidance for buyers preparing their next steps."

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertEqual(validated["article"]["title"], revision["article"]["title"])
        self.assertEqual(validated["article"]["excerpt"], revision["article"]["excerpt"])
        self.assertNotIn("contentBlocks", validated["article"])

    def test_revision_rejects_a_noop_without_mutation_data(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        validated, error = app_module.validate_ai_workflow_revision(
            revision_template(), source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(validated)
        self.assertIn("did not identify", error)

    def test_revision_schema_uses_nullable_fields_not_changed_flags_or_one_of(self):
        schema = app_module.AI_WORKFLOW_REVISION_SCHEMA

        self.assertNotIn("changed", schema["properties"]["article"]["required"])
        self.assertNotIn("changed", schema["properties"]["cta"]["required"])
        self.assertNotIn("oneOf", json.dumps(schema))

    def test_cta_revision_preserves_non_cta_blocks(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["cta"] = {"headline": "Want to talk it through?", "body": None, "buttonLabel": None, "actionType": None, "intent": None}
        validated, error = app_module.validate_ai_workflow_revision(revision, source, {tag.normalized_name: tag for tag in tags()})
        self.assertIsNone(error)
        self.assertEqual(validated["cta"]["headline"], "Want to talk it through?")
        self.assertEqual(source["contentBlocks"][:-1], package()["article"]["contentBlocks"][:-1])

    def test_unknown_audience_revision_tag_is_rejected_without_a_change(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["audience"] = {"tags": ["Unknown"], "rationale": None}
        validated, error = app_module.validate_ai_workflow_revision(revision, source, {tag.normalized_name: tag for tag in tags()})
        self.assertIsNone(validated)
        self.assertIn("unavailable audience tag", error)

    def test_audience_revision_keeps_and_selected_existing_tags_only(self):
        source = {key: package()["article"][key] for key in ("title", "excerpt", "category", "tags", "contentBlocks")}
        revision = revision_template()
        revision["audience"] = {"tags": ["Palmdale", "First-Time Buyer"], "rationale": None}

        validated, error = app_module.validate_ai_workflow_revision(
            revision, source, {tag.normalized_name: tag for tag in tags()}
        )

        self.assertIsNone(error)
        self.assertEqual([tag.name for tag in validated["audience"]["tags"]], ["Palmdale", "First-Time Buyer"])

    def test_campaign_revision_updates_only_handoff_and_commits_once(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        revision = revision_template()
        revision["campaign"] = {"name": None, "subject": "A shorter buyer subject", "preheader": None}
        before_article = post.content_blocks
        with patch.object(app_module.db.session, "execute", side_effect=[SingleResult(handoff), ScalarResult(tags())]), patch.object(
            app_module.db.session, "get", return_value=post
        ), patch.object(app_module, "request_ai_workflow_revision", return_value=(
            {"summary": revision["summary"], "article": None, "cta": None, "campaign": {"subject": "A shorter buyer subject"}, "audience": None}, None, 200, None
        )) as request_revision, patch.object(app_module, "resolve_active_aiced_audience", return_value=[1]) as resolve, patch.object(
            app_module.db.session, "commit"
        ) as commit, patch.object(app_module, "send_test_campaign_email") as send:
            response = self.client.post(f"/api/aiced/workflows/{'E' * 43}/revisions", json={"instruction": "Make the subject shorter."}, headers=auth_header())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(handoff.subject, "A shorter buyer subject")
        self.assertEqual(post.content_blocks, before_article)
        self.assertEqual(response.get_json()["summary"], revision["summary"])
        request_revision.assert_called_once()
        commit.assert_called_once()
        send.assert_not_called()
        self.assertEqual([tag.name for tag in resolve.call_args.args[0]], ["First-Time Buyer", "Palmdale"])

    def test_preview_revision_returns_a_change_set_without_committing_or_mutating_the_draft(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        original_subject = handoff.subject
        revision = revision_template()
        revision["campaign"] = {"name": None, "subject": "A shorter buyer subject", "preheader": None}
        with patch.object(app_module.db.session, "execute", side_effect=[SingleResult(handoff), ScalarResult(tags())]), patch.object(
            app_module.db.session, "get", return_value=post
        ), patch.object(app_module, "request_ai_workflow_revision", return_value=(
            {"summary": revision["summary"], "article": None, "cta": None, "campaign": {"subject": "A shorter buyer subject"}, "audience": None}, None, 200, None
        )), patch.object(app_module, "resolve_active_aiced_audience", return_value=[1]), patch.object(
            app_module.db.session, "commit"
        ) as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'Q' * 43}/revisions",
                json={"instruction": "Make the subject shorter.", "preview": True},
                headers=auth_header(),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["revision"]["campaign"], {"subject": "A shorter buyer subject"})
        self.assertEqual(handoff.subject, original_subject)
        commit.assert_not_called()

    def test_invalid_structure_revision_does_not_mutate_or_commit(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        original_blocks = list(post.content_blocks)
        with patch.object(
            app_module.db.session, "execute", side_effect=[SingleResult(handoff), ScalarResult(tags())]
        ), patch.object(app_module.db.session, "get", return_value=post), patch.object(
            app_module, "request_ai_workflow_revision", return_value=(
                None, "AI returned an unsupported block type.", 502, None
            )
        ), patch.object(app_module.db.session, "commit") as commit:
            response = self.client.post(
                f"/api/aiced/workflows/{'G' * 43}/revisions",
                json={"instruction": "Add an unsupported block."},
                headers=auth_header(),
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(post.content_blocks, original_blocks)
        commit.assert_not_called()

    def test_manual_workflow_update_validates_partial_post_and_handoff_changes(self):
        post, handoff = persisted_draft_post(), persisted_handoff()
        updates, error = app_module.validate_aiced_manual_workflow_update(
            {
                "article": {"title": "A Warmer First Home Guide"},
                "campaign": {"subject": "A more welcoming buyer guide"},
                "audience": {"tags": ["Palmdale"]},
            }, post, handoff, tags()
        )

        self.assertIsNone(error)
        self.assertEqual(updates["article"], {"title": "A Warmer First Home Guide"})
        self.assertEqual(updates["campaign"], {"subject": "A more welcoming buyer guide"})
        self.assertEqual([tag.name for tag in updates["audience"]["tags"]], ["Palmdale"])

    def test_manual_workflow_update_rejects_invalid_excerpt_and_unknown_audience(self):
        post, handoff = persisted_draft_post(), persisted_handoff()
        updates, error = app_module.validate_aiced_manual_workflow_update(
            {"article": {"excerpt": "missing punctuation"}}, post, handoff, tags()
        )
        self.assertIsNone(updates)
        self.assertIn("SEO summary", error)
        updates, error = app_module.validate_aiced_manual_workflow_update(
            {"audience": {"tags": ["Unknown"]}}, post, handoff, tags()
        )
        self.assertIsNone(updates)
        self.assertIn("existing audience tags", error)

    def test_featured_image_generation_uses_canonical_post_context_without_audience_data(self):
        post = persisted_draft_post()
        image_bytes = b"\x89PNG\r\n\x1a\nimage-data"
        client = SimpleNamespace(images=SimpleNamespace(generate=Mock(return_value=SimpleNamespace(
            data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode("ascii"))]
        ))))
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(
            app_module, "create_openai_client", return_value=client
        ):
            result, error, status = app_module.request_aiced_featured_image(post)

        self.assertIsNone(error)
        self.assertEqual(status, 200)
        self.assertEqual(result[0], image_bytes)
        prompt = client.images.generate.call_args.kwargs["prompt"]
        self.assertIn(post.title, prompt)
        self.assertNotIn("First-Time Buyer", prompt)
        self.assertNotIn("subscriber", prompt.lower())

    def test_revision_rejects_non_draft_before_openai(self):
        handoff, post = persisted_handoff(), persisted_draft_post()
        post.status = "published"
        with patch.object(app_module.db.session, "execute", return_value=SingleResult(handoff)), patch.object(
            app_module.db.session, "get", return_value=post
        ), patch.object(app_module, "request_ai_workflow_revision") as request_revision:
            response = self.client.post(f"/api/aiced/workflows/{'F' * 43}/revisions", json={"instruction": "Change the subject."}, headers=auth_header())
        self.assertEqual(response.status_code, 409)
        request_revision.assert_not_called()

    def test_existing_draft_can_save_without_changing_its_publish_state(self):
        draft = app_module.Post(
            id=42,
            title="Old title",
            content="",
            category="training",
            tags="First-Time Buyer",
            excerpt="Old excerpt",
            featured_image=None,
            status="draft",
            published_at=None,
            content_blocks=[],
        )
        article = package()["article"]
        payload = {
            "title": article["title"],
            "content": "",
            "category": article["category"],
            "tags": article["tags"],
            "excerpt": article["excerpt"],
            "featuredImage": None,
            "contentBlocks": article["contentBlocks"],
            "status": "draft",
        }
        with patch.object(app_module.db.session, "get", return_value=draft), patch.object(
            app_module.db.session, "commit"
        ) as commit:
            response = self.client.patch("/api/posts/42", json=payload, headers=auth_header())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(draft.status, "draft")
        self.assertIsNone(draft.published_at)
        self.assertEqual(draft.title, article["title"])
        commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
