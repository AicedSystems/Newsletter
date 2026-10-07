from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_TEMPLATE = (PROJECT_ROOT / "templates/aiced_workspace.html").read_text(encoding="utf-8")
WORKSPACE_SCRIPT = (PROJECT_ROOT / "static/js/aiced_workspace.js").read_text(encoding="utf-8")


class AicedWorkspaceApprovalContractTests(unittest.TestCase):
    def test_approval_starts_disabled_without_a_proposal(self):
        self.assertIn('id="aiced-approve-button" type="button" disabled', WORKSPACE_TEMPLATE)
        self.assertIn('let approvalState = "idle"', WORKSPACE_SCRIPT)

    def test_generation_enables_approval_for_the_current_reviewed_proposal(self):
        self.assertIn("reviewedProposal = proposal", WORKSPACE_SCRIPT)
        self.assertIn('approvalState = "ready"', WORKSPACE_SCRIPT)
        self.assertIn("approveButton.disabled = false", WORKSPACE_SCRIPT)

    def test_approval_uses_existing_handoff_endpoint_and_blocks_duplicates(self):
        self.assertIn('if (approvalState !== "ready" || !reviewedProposal) return false;', WORKSPACE_SCRIPT)
        self.assertIn('fetch("/api/aiced/article-campaign-handoff"', WORKSPACE_SCRIPT)
        self.assertIn("body: JSON.stringify(reviewedProposal)", WORKSPACE_SCRIPT)
        self.assertIn('approvalState = "saving"', WORKSPACE_SCRIPT)
        self.assertIn('approvalState = "saved"', WORKSPACE_SCRIPT)

    def test_failure_allows_retry_without_navigation_or_browser_persistence(self):
        self.assertIn('approvalState = "ready"', WORKSPACE_SCRIPT)
        self.assertNotIn("localStorage", WORKSPACE_SCRIPT)
        self.assertNotIn("window.location.href", WORKSPACE_SCRIPT)
        self.assertNotIn("window.location.assign", WORKSPACE_SCRIPT)

    def test_new_resets_only_workspace_state(self):
        self.assertIn("function resetWorkspace()", WORKSPACE_SCRIPT)
        self.assertIn("reviewedProposal = null", WORKSPACE_SCRIPT)
        self.assertIn('approvalState = "idle"', WORKSPACE_SCRIPT)

    def test_successful_approval_updates_the_url_without_navigation(self):
        self.assertIn("window.history.replaceState({}, \"\", `/aiced?workflow=${encodeURIComponent(result.workflowToken)}`)", WORKSPACE_SCRIPT)
        self.assertNotIn("window.location.href", WORKSPACE_SCRIPT)
        self.assertNotIn("window.location.assign", WORKSPACE_SCRIPT)

    def test_workflow_url_restores_via_the_dedicated_endpoint_without_ai_generation(self):
        self.assertIn('new URLSearchParams(window.location.search).get("workflow")', WORKSPACE_SCRIPT)
        self.assertIn('fetch(`/api/aiced/workflows/${encodeURIComponent(workflowToken)}`)', WORKSPACE_SCRIPT)
        self.assertIn('approvalState = "saved"', WORKSPACE_SCRIPT)
        self.assertIn("restoreWorkflowFromUrl();", WORKSPACE_SCRIPT)

    def test_new_clears_workflow_from_the_browser_url(self):
        self.assertIn('window.history.replaceState({}, "", "/aiced")', WORKSPACE_SCRIPT)

    def test_revision_composer_saves_a_ready_proposal_before_sending_the_instruction(self):
        self.assertIn('if (isRevising || !reviewedProposal || !["ready", "saved"].includes(approvalState)) return;', WORKSPACE_SCRIPT)
        self.assertIn('const saved = await approveReviewedProposal();', WORKSPACE_SCRIPT)
        self.assertIn('if (approvalState !== "saved" || !savedWorkflow)', WORKSPACE_SCRIPT)
        self.assertIn("body: JSON.stringify({ instruction })", WORKSPACE_SCRIPT)
        self.assertIn("/revisions`, {", WORKSPACE_SCRIPT)
        self.assertIn("setRevisionComposerEnabled(true)", WORKSPACE_SCRIPT)
