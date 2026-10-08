import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AdminShellContractTests(unittest.TestCase):
    def test_admin_workflow_pages_use_the_shared_sidebar(self):
        pages = {
            "dashboard.html": "dashboard",
            "create_campaign.html": "campaigns",
            "create_post.html": "articles",
            "start_post.html": "articles",
            "paste_post.html": "articles",
            "archived_posts.html": "articles",
            "subscribers.html": "subscribers",
        }
        for filename, active_page in pages.items():
            template = (ROOT / "templates" / filename).read_text()
            self.assertIn("admin_shell.css", template)
            self.assertIn("_admin_sidebar.html", template)
            self.assertIn(f"admin_nav = '{active_page}'", template)

        sidebar = (ROOT / "templates" / "_admin_sidebar.html").read_text()
        self.assertIn("admin-sidebar__toggle", sidebar)
        self.assertIn("admin_shell.js", sidebar)

    def test_shared_navigation_has_only_real_admin_destinations(self):
        sidebar = (ROOT / "templates" / "_admin_sidebar.html").read_text()
        for label in ("Dashboard", "Aiced", "Campaigns", "Articles", "Subscribers"):
            self.assertIn(f">{label}<", sidebar)
        self.assertNotIn('type="checkbox"', sidebar)
