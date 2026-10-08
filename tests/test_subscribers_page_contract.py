import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = (ROOT / "templates" / "subscribers.html").read_text()
SCRIPT = (ROOT / "static" / "js" / "subscribers.js").read_text()


class SubscribersPageVisualContractTests(unittest.TestCase):
    def test_redesign_keeps_existing_controls_and_status_filters(self):
        for element_id in (
            "subscriber-search",
            "subscriber-status-filter",
            "subscriber-tag-filter",
            "add-subscriber-button",
            "subscriber-dialog",
        ):
            self.assertIn(f'id="{element_id}"', TEMPLATE)
        self.assertIn('value="active"', TEMPLATE)
        self.assertIn('value="unsubscribed"', TEMPLATE)
        self.assertIn('value="suppressed"', TEMPLATE)
        self.assertIn("currentQuery()", SCRIPT)
        self.assertIn("/api/subscribers?${currentQuery()}", SCRIPT)

    def test_table_remains_edit_only_without_speculative_bulk_controls(self):
        self.assertIn("<th>Name</th><th>Email</th><th>Tags</th><th>Status</th><th>Added</th><th>Actions</th>", TEMPLATE)
        self.assertIn('data-edit-subscriber="${subscriber.id}"', SCRIPT)
        self.assertNotIn('type="checkbox"', TEMPLATE[TEMPLATE.index('class="subscriber-table"'):])
        self.assertNotIn("bulk", SCRIPT.lower())

    def test_client_keeps_existing_status_protections_and_tag_workflow(self):
        self.assertIn('setSubscriberStatus("unsubscribed")', SCRIPT)
        self.assertIn('setSubscriberStatus("suppressed")', SCRIPT)
        self.assertIn('setSubscriberStatus("active", true)', SCRIPT)
        self.assertIn('fetch("/api/subscriber-tags"', SCRIPT)
        self.assertIn('fetch(`/api/subscriber-tags/${tag.id}`, { method: "DELETE" })', SCRIPT)

    def test_subscribers_uses_the_shared_admin_navigation_shell(self):
        self.assertIn("_admin_sidebar.html", TEMPLATE)
        self.assertIn("admin_shell.css", TEMPLATE)
        self.assertIn("admin_nav = 'subscribers'", TEMPLATE)
