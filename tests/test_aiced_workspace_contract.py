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

    def test_generation_composer_submits_with_enter_without_losing_shift_enter_newlines(self):
        self.assertIn('generationRequest.addEventListener("keydown"', WORKSPACE_SCRIPT)
        self.assertIn('event.key === "Enter" && !event.shiftKey', WORKSPACE_SCRIPT)
        self.assertIn("generationForm.requestSubmit()", WORKSPACE_SCRIPT)

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

    def test_workflow_url_uses_a_neutral_restore_presentation_until_it_resolves(self):
        self.assertIn('aiced-workflow-restoring', WORKSPACE_TEMPLATE)
        self.assertIn('document.documentElement.classList.remove("aiced-workflow-restoring")', WORKSPACE_SCRIPT)

    def test_new_clears_workflow_from_the_browser_url(self):
        self.assertIn('window.history.replaceState({}, "", "/aiced")', WORKSPACE_SCRIPT)

    def test_revision_composer_saves_a_ready_proposal_before_sending_the_instruction(self):
        self.assertIn('if (isRevising || !reviewedProposal || !["ready", "saved"].includes(approvalState)) return;', WORKSPACE_SCRIPT)
        self.assertIn('const saved = await approveReviewedProposal();', WORKSPACE_SCRIPT)
        self.assertIn('if (approvalState !== "saved" || !savedWorkflow)', WORKSPACE_SCRIPT)
        self.assertIn("body: JSON.stringify({ instruction, preview: true })", WORKSPACE_SCRIPT)
        self.assertIn("/revisions`, {", WORKSPACE_SCRIPT)
        self.assertIn("setRevisionComposerEnabled(true)", WORKSPACE_SCRIPT)

    def test_email_preview_uses_the_canonical_featured_image_when_present(self):
        self.assertIn('id="aiced-email-featured-image"', WORKSPACE_TEMPLATE)
        self.assertIn('article.featuredImage.startsWith("https://")', WORKSPACE_SCRIPT)
        self.assertIn("emailFeaturedImage.src = article.featuredImage", WORKSPACE_SCRIPT)
        self.assertIn('emailFeaturedImage.removeAttribute("src")', WORKSPACE_SCRIPT)

    def test_published_workflow_uses_two_explicit_campaign_send_steps(self):
        self.assertIn('id="aiced-send-campaign-button"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-send-confirmation"', WORKSPACE_TEMPLATE)
        self.assertIn('/campaign/prepare`, { method: "POST" }', WORKSPACE_SCRIPT)
        self.assertIn('/campaign/send`, { method: "POST" }', WORKSPACE_SCRIPT)
        self.assertIn('function renderSendConfirmation(delivery)', WORKSPACE_SCRIPT)
        self.assertIn('sendConfirmButton.textContent = "Sending…"', WORKSPACE_SCRIPT)

    def test_draft_workspace_has_four_browser_only_proposal_steps_before_publish(self):
        for index, label in enumerate(
            ("Article", "Call to Action", "Campaign Details", "Audience")
        ):
            self.assertIn(f'data-proposal-step="{index}"', WORKSPACE_TEMPLATE)
            self.assertIn(label, WORKSPACE_TEMPLATE)
        self.assertIn("let activeProposalStep = 0", WORKSPACE_SCRIPT)
        self.assertIn("function setActiveProposalStep", WORKSPACE_SCRIPT)
        self.assertIn('const lastAvailableStep = draft ? 3 : proposalSteps.length - 1;', WORKSPACE_SCRIPT)
        self.assertIn('id="aiced-draft-email-preview-title"', WORKSPACE_TEMPLATE)

    def test_published_workflow_uses_the_real_email_preview_in_campaign_review_layout(self):
        self.assertIn('id="aiced-campaign-ready-intro"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-email-rendered-preview"', WORKSPACE_TEMPLATE)
        self.assertIn("campaignReadyIntro.hidden = false", WORKSPACE_SCRIPT)
        self.assertIn("loadPublishedEmailPreview();", WORKSPACE_SCRIPT)

    def test_published_workflow_exposes_email_preview_then_recipient_review_steps(self):
        self.assertIn('data-proposal-step="4"', WORKSPACE_TEMPLATE)
        self.assertIn('data-proposal-step="5"', WORKSPACE_TEMPLATE)
        self.assertIn('>Email Preview<', WORKSPACE_TEMPLATE)
        self.assertIn('>Review Campaign<', WORKSPACE_TEMPLATE)
        self.assertIn('data-proposal-panel="5"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-campaign-review-recipient-list"', WORKSPACE_TEMPLATE)
        self.assertIn("function renderCampaignReview(delivery)", WORKSPACE_SCRIPT)
        self.assertIn("function renderPreparedCampaignReview(delivery)", WORKSPACE_SCRIPT)
        self.assertIn("setActiveProposalStep(5, { focus: true });", WORKSPACE_SCRIPT)

    def test_aiced_navigation_is_collapsible_without_changing_workflow_behavior(self):
        self.assertIn('id="aiced-sidebar-collapse"', WORKSPACE_TEMPLATE)
        self.assertIn("aicedWorkspaceSidebarCollapsed", WORKSPACE_SCRIPT)
        self.assertIn("sessionStorage", WORKSPACE_SCRIPT)
        self.assertIn("is-sidebar-collapsed", WORKSPACE_SCRIPT)

    def test_prepared_campaign_review_can_remove_selected_snapshot_recipients_before_send(self):
        self.assertIn('id="aiced-remove-recipients"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-campaign-review-recipient-list"', WORKSPACE_TEMPLATE)
        self.assertIn("function removeSelectedCampaignRecipients()", WORKSPACE_SCRIPT)
        self.assertIn("/campaign/recipients/remove", WORKSPACE_SCRIPT)
        self.assertIn('body: JSON.stringify({ recipientIds: [...selectedCampaignRecipientIds] })', WORKSPACE_SCRIPT)

    def test_audience_step_has_a_read_only_matching_subscriber_preview(self):
        self.assertIn('id="aiced-audience-preview-table"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-audience-preview-list"', WORKSPACE_TEMPLATE)
        self.assertIn('href="{{ url_for(\'subscribers\') }}"', WORKSPACE_TEMPLATE)
        self.assertIn("function loadAudiencePreview()", WORKSPACE_SCRIPT)
        self.assertIn("/audience-preview`", WORKSPACE_SCRIPT)
        self.assertGreaterEqual(WORKSPACE_SCRIPT.count("loadAudiencePreview();"), 3)
        self.assertNotIn('type = "checkbox"', WORKSPACE_SCRIPT[WORKSPACE_SCRIPT.index("function renderAudiencePreview"):WORKSPACE_SCRIPT.index("function renderSendConfirmation")])

    def test_closing_the_article_hides_its_browser_only_change_review(self):
        self.assertIn('const articleExpandedLayout = document.querySelector("#aiced-article-expanded-layout")', WORKSPACE_SCRIPT)
        self.assertIn("articleExpandedLayout.hidden = !isExpanded", WORKSPACE_SCRIPT)
        self.assertIn("setArticleExpanded(articleExpandedLayout.hidden)", WORKSPACE_SCRIPT)

    def test_expanded_article_has_a_dedicated_adjacent_change_review_slot(self):
        self.assertIn('id="aiced-article-expanded-layout"', WORKSPACE_TEMPLATE)
        self.assertIn('class="aiced-article-change-review-slot"', WORKSPACE_TEMPLATE)
        self.assertIn('const reviewSlot = document.querySelector(".aiced-article-change-review-slot")', WORKSPACE_SCRIPT)

    def test_draft_workspace_preserves_article_outline_and_global_revision_contract(self):
        self.assertIn('id="aiced-article-outline"', WORKSPACE_TEMPLATE)
        self.assertIn("function renderArticleOutline(blocks)", WORKSPACE_SCRIPT)
        self.assertIn('id="aiced-refine-suggestions"', WORKSPACE_TEMPLATE)
        self.assertIn("function renderRefineSuggestions()", WORKSPACE_SCRIPT)
        self.assertIn("refineRequest.value = prompt", WORKSPACE_SCRIPT)
        self.assertIn("renderProposal(proposal, { resetStep: false });", WORKSPACE_SCRIPT)

    def test_global_refinement_composer_uses_active_step_placeholder_guidance(self):
        self.assertIn('class="aiced-refine__toolbar"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-refine-send"', WORKSPACE_TEMPLATE)
        self.assertIn('placeholder: "Ask Aiced to rewrite, expand, or refine your article…"', WORKSPACE_SCRIPT)
        self.assertIn("refineRequest.placeholder = proposalSteps[activeProposalStep].placeholder", WORKSPACE_SCRIPT)

    def test_refinement_composer_expands_only_at_the_end_of_the_review(self):
        self.assertIn("function syncRefineComposerExpansion()", WORKSPACE_SCRIPT)
        self.assertIn("distanceFromBottom <= 40", WORKSPACE_SCRIPT)
        self.assertIn("distanceFromBottom > 220", WORKSPACE_SCRIPT)
        self.assertIn('classList.toggle("is-expanded", refineComposerExpanded)', WORKSPACE_SCRIPT)
        self.assertIn("refineSuggestions.hidden = !refineComposerExpanded", WORKSPACE_SCRIPT)

    def test_featured_image_actions_render_before_the_image(self):
        actions_index = WORKSPACE_SCRIPT.index("container.append(actions);")
        image_index = WORKSPACE_SCRIPT.index("image.src = article.featuredImage")
        self.assertLess(actions_index, image_index)

    def test_article_media_actions_remain_grouped_with_the_featured_image(self):
        self.assertIn('class="aiced-article-media-column"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-featured-image"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-article-toggle"', WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-article-full-editor"', WORKSPACE_TEMPLATE)

    def test_cta_edit_reuses_the_existing_workflow_patch_for_inline_fields(self):
        self.assertIn("function beginInlineCtaEdit(card)", WORKSPACE_SCRIPT)
        self.assertIn("function saveInlineCtaEdit(card)", WORKSPACE_SCRIPT)
        self.assertIn('card.querySelector("#aiced-cta-headline").textContent.trim()', WORKSPACE_SCRIPT)
        self.assertIn('card.querySelector("#aiced-cta-body").textContent.trim()', WORKSPACE_SCRIPT)
        self.assertIn('card.querySelector("#aiced-cta-button-label").textContent.trim()', WORKSPACE_SCRIPT)
        self.assertIn('if (kind === "cta") { beginInlineCtaEdit(card); return; }', WORKSPACE_SCRIPT)

    def test_rerendering_clears_temporary_cta_and_card_editing_controls(self):
        self.assertIn("function clearManualEditingUi()", WORKSPACE_SCRIPT)
        self.assertIn('".aiced-card-edit-form, .aiced-inline-edit-cancel, .aiced-inline-edit-error"', WORKSPACE_SCRIPT)
        self.assertIn("delete card.dataset.inlineEditing", WORKSPACE_SCRIPT)
        self.assertIn("clearManualEditingUi();", WORKSPACE_SCRIPT)

    def test_ai_revision_review_is_browser_only_until_each_change_is_approved(self):
        self.assertIn("let pendingReviewEntries = []", WORKSPACE_SCRIPT)
        self.assertIn("function makePendingReviewEntries(revision, proposal)", WORKSPACE_SCRIPT)
        self.assertIn("function renderPendingRevisionReview()", WORKSPACE_SCRIPT)
        self.assertIn("function applyPendingReviewEntry(entry)", WORKSPACE_SCRIPT)
        self.assertIn("function revertPendingReviewEntry(entry)", WORKSPACE_SCRIPT)
        self.assertIn('body: JSON.stringify({ instruction, preview: true })', WORKSPACE_SCRIPT)

    def test_revision_review_uses_an_adjacent_article_column_with_side_by_side_collapsible_comparisons(self):
        self.assertIn('const reviewSlot = document.querySelector(".aiced-article-change-review-slot")', WORKSPACE_SCRIPT)
        self.assertIn("reviewSlot.append(panel)", WORKSPACE_SCRIPT)
        self.assertIn('toggle.textContent = expanded ? "Show less" : "Show more"', WORKSPACE_SCRIPT)
        self.assertIn("function reviewHeadingForInstruction(instruction)", WORKSPACE_SCRIPT)
        self.assertIn('pendingReviewHeading = reviewHeadingForInstruction(instruction)', WORKSPACE_SCRIPT)
