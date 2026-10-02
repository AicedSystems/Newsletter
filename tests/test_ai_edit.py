import base64
import importlib
import json
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "test-editor"
os.environ["EDITOR_PASSWORD"] = "test-password"

if "app" in sys.modules:
    app_module = importlib.reload(sys.modules["app"])
else:
    app_module = importlib.import_module("app")


def auth_header():
    credentials = base64.b64encode(b"test-editor:test-password").decode("ascii")
    return {"Authorization": f"Basic {credentials}"}


def article_payload(action="readability"):
    return {
        "action": action,
        "title": "A Clear Home Buying Guide",
        "excerpt": "Helpful guidance for preparing to buy your next home.",
        "category": "training",
        "tags": ["buyers"],
        "contentBlocks": [
            {"type": "heading", "text": "Start with a plan"},
            {"type": "image", "url": "https://example.com/home.jpg"},
            {"type": "paragraph", "text": "Speak with a lender before touring homes."},
            {"type": "youtube", "url": "https://youtu.be/example"},
            {"type": "cta", "text": "Contact us", "url": "https://example.com/contact"},
        ],
    }


def proposed_result(source):
    return {
        "title": source["title"],
        "excerpt": "Clear guidance to help you prepare for your next home purchase.",
        "category": source["category"],
        "tags": list(source["tags"]),
        "contentBlocks": [
            {"type": "heading", "text": "Begin with a clear plan"},
            {"type": "image", "url": "https://example.com/home.jpg"},
            {"type": "paragraph", "text": "Talk with a lender before you tour homes."},
            {"type": "youtube", "url": "https://youtu.be/example"},
            {"type": "cta", "text": "Contact us", "url": "https://example.com/contact"},
        ],
    }


class AiEditApiTests(unittest.TestCase):
    def setUp(self):
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def test_authentication_is_required(self):
        response = self.client.post("/api/posts/ai-edit", json=article_payload())
        self.assertEqual(response.status_code, 401)

    def test_supported_quick_actions_use_server_controlled_instructions(self):
        for action in ("shorter", "readability", "warmer_tone"):
            with self.subTest(action=action):
                payload = article_payload(action)
                with patch.object(
                    app_module,
                    "request_ai_enhancement",
                    return_value=(proposed_result(payload), None, 200),
                ) as request_ai:
                    response = self.client.post(
                        "/api/posts/ai-edit", json=payload, headers=auth_header()
                    )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(request_ai.call_args.args[0], app_module.AI_EDIT_ACTION_INSTRUCTIONS[action])
                self.assertEqual(request_ai.call_args.kwargs["action"], action)
                self.assertEqual(request_ai.call_args.kwargs["source_article"]["title"], payload["title"])

    def test_custom_request_is_required_and_bounded(self):
        payload = article_payload("custom")
        response = self.client.post(
            "/api/posts/ai-edit", json=payload, headers=auth_header()
        )
        self.assertEqual(response.status_code, 400)

        payload["instruction"] = "x" * 501
        response = self.client.post(
            "/api/posts/ai-edit", json=payload, headers=auth_header()
        )
        self.assertEqual(response.status_code, 400)

    def test_custom_request_is_sent_as_untrusted_article_input(self):
        payload = article_payload("custom")
        payload["instruction"] = "Make the introduction more welcoming."
        with patch.object(
            app_module,
            "request_ai_enhancement",
            return_value=(proposed_result(payload), None, 200),
        ) as request_ai:
            response = self.client.post(
                "/api/posts/ai-edit", json=payload, headers=auth_header()
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn(payload["instruction"], request_ai.call_args.args[1])
        self.assertEqual(request_ai.call_args.args[0], app_module.AI_CUSTOM_EDIT_INSTRUCTIONS)

    def test_unsupported_action_is_rejected(self):
        response = self.client.post(
            "/api/posts/ai-edit",
            json=article_payload("delete_everything"),
            headers=auth_header(),
        )
        self.assertEqual(response.status_code, 400)

    def test_provider_failure_returns_safe_error(self):
        with patch.object(
            app_module,
            "request_ai_enhancement",
            return_value=(None, "AI enhancement could not be completed.", 502),
        ):
            response = self.client.post(
                "/api/posts/ai-edit",
                json=article_payload(),
                headers=auth_header(),
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.get_json()["message"], "AI enhancement could not be completed.")

    def test_validation_preserves_non_text_blocks(self):
        source = article_payload()
        enhancement = {
            "title": source["title"],
            "excerpt": "Clear guidance to help you prepare for your next home purchase.",
            "category": source["category"],
            "tags": source["tags"],
            "contentBlocks": [
                {"type": "heading", "text": "Begin with a clear plan"},
                {"type": "paragraph", "text": "Talk with a lender before touring homes."},
            ],
        }

        result, error = app_module.validate_ai_enhancement(enhancement, source)

        self.assertIsNone(error)
        self.assertEqual(
            [block["type"] for block in result["contentBlocks"]],
            [block["type"] for block in source["contentBlocks"]],
        )
        self.assertEqual(result["contentBlocks"][1], source["contentBlocks"][1])
        self.assertEqual(result["contentBlocks"][3], source["contentBlocks"][3])
        self.assertEqual(result["contentBlocks"][4], source["contentBlocks"][4])

    def test_validation_rejects_changed_text_structure(self):
        source = article_payload()
        enhancement = {
            "title": source["title"],
            "excerpt": "Clear guidance to help you prepare for your next home purchase.",
            "category": source["category"],
            "tags": source["tags"],
            "contentBlocks": [{"type": "paragraph", "text": "Wrong block type."}],
        }

        result, error = app_module.validate_ai_enhancement(enhancement, source)

        self.assertIsNone(result)
        self.assertEqual(error, "AI changed the article structure.")

    def test_custom_no_op_response_is_rejected(self):
        source = article_payload("custom")
        unchanged_enhancement = {
            "title": source["title"],
            "excerpt": source["excerpt"],
            "category": source["category"],
            "tags": source["tags"],
            "contentBlocks": [
                block for block in source["contentBlocks"]
                if block["type"] in app_module.AI_SUPPORTED_BLOCK_TYPES
            ],
        }
        response = SimpleNamespace(output_text=json.dumps(unchanged_enhancement))
        client = SimpleNamespace(
            responses=SimpleNamespace(create=lambda **kwargs: response)
        )

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(
            app_module, "create_openai_client", return_value=client
        ):
            result, error, status = app_module.request_ai_enhancement(
                app_module.AI_CUSTOM_EDIT_INSTRUCTIONS,
                "test input",
                source_article=source,
                action="custom",
            )

        self.assertIsNone(result)
        self.assertEqual(status, 422)
        self.assertIn("did not produce a change", error)


if __name__ == "__main__":
    unittest.main()
