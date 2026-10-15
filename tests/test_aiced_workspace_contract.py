from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_TEMPLATE = (PROJECT_ROOT / "templates/aiced_workspace.html").read_text(encoding="utf-8")
WORKSPACE_SCRIPT = (PROJECT_ROOT / "static/js/aiced_workspace.js").read_text(encoding="utf-8")
WORKSPACE_CSS = (PROJECT_ROOT / "static/css/aiced_workspace.css").read_text(encoding="utf-8")


class AicedWorkspaceApprovalContractTests(unittest.TestCase):
    def test_edit_campaign_starts_disabled_without_a_proposal(self):
        self.assertIn('id="aiced-approve-button" type="button" disabled', WORKSPACE_TEMPLATE)
        self.assertIn("Save &amp; Edit Campaign", WORKSPACE_TEMPLATE)
        self.assertIn('let approvalState = "idle"', WORKSPACE_SCRIPT)

    def test_edit_campaign_onboarding_explains_the_draft_handoff(self):
        self.assertIn('id="aiced-draft-onboarding"', WORKSPACE_TEMPLATE)
        self.assertIn("Ready to customize?", WORKSPACE_TEMPLATE)
        self.assertIn("Save this proposal as a draft to edit the article, call to action, campaign details, and audience.", WORKSPACE_TEMPLATE)
        self.assertIn("Save &amp; Edit Campaign to unlock editing.", WORKSPACE_TEMPLATE)
        self.assertIn("This won't publish your article or send any emails.", WORKSPACE_TEMPLATE)
        self.assertIn('id="aiced-editing-disabled-explanation"', WORKSPACE_TEMPLATE)

    def test_generation_enables_edit_campaign_for_the_current_reviewed_proposal(self):
        self.assertIn("reviewedProposal = proposal", WORKSPACE_SCRIPT)
        self.assertIn('approvalState = "ready"', WORKSPACE_SCRIPT)
        self.assertIn("approveButton.disabled = false", WORKSPACE_SCRIPT)

    def test_pre_handoff_editing_controls_and_aiced_composer_stay_locked(self):
        self.assertIn('setRevisionComposerEnabled(false);', WORKSPACE_SCRIPT)
        self.assertIn('approvalState === "saved" && !hasPendingReviewEntries()', WORKSPACE_SCRIPT)
        self.assertIn('button.disabled = !revisionsEnabled;', WORKSPACE_SCRIPT)
        self.assertIn('generate.disabled = editingLocked', WORKSPACE_SCRIPT)
        self.assertIn('upload.disabled = editingLocked', WORKSPACE_SCRIPT)
        self.assertIn('Click Save & Edit Campaign first to unlock editing.', WORKSPACE_SCRIPT)

    def test_generation_composer_submits_with_enter_without_losing_shift_enter_newlines(self):
        self.assertIn('generationRequest.addEventListener("keydown"', WORKSPACE_SCRIPT)
        self.assertIn('event.key === "Enter" && !event.shiftKey', WORKSPACE_SCRIPT)
        self.assertIn("generationForm.requestSubmit()", WORKSPACE_SCRIPT)

    def test_edit_campaign_uses_existing_handoff_endpoint_and_blocks_duplicates(self):
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

    def test_revision_composer_revises_an_unapproved_proposal_without_saving_a_draft(self):
        self.assertIn('if (isRevising || !reviewedProposal || !["ready", "saved"].includes(approvalState)) return;', WORKSPACE_SCRIPT)
        self.assertIn('const isUnapprovedProposal = approvalState === "ready" && !savedWorkflow;', WORKSPACE_SCRIPT)
        self.assertIn('"/api/aiced/marketing-package/revisions"', WORKSPACE_SCRIPT)
        self.assertIn('? { instruction, proposal: reviewedProposal }', WORKSPACE_SCRIPT)
        self.assertIn(": { instruction, preview: true }", WORKSPACE_SCRIPT)
        self.assertIn("function syncRevisionComposer()", WORKSPACE_SCRIPT)

    def test_pending_preapproval_revision_blocks_final_article_approval(self):
        self.assertIn("function hasPendingReviewEntries()", WORKSPACE_SCRIPT)
        self.assertIn("function syncProposalApprovalState()", WORKSPACE_SCRIPT)
        self.assertIn("if (hasPendingReviewEntries())", WORKSPACE_SCRIPT)
        self.assertIn('"Accept Changes"', WORKSPACE_SCRIPT)
        self.assertIn('"Discard"', WORKSPACE_SCRIPT)

    def test_preapproval_review_entries_apply_or_reject_without_a_workflow_patch(self):
        self.assertIn("function applyReviewPayloadLocally(payload)", WORKSPACE_SCRIPT)
        self.assertIn("if (!savedWorkflow)", WORKSPACE_SCRIPT)
        self.assertIn('"Changes accepted. Your proposal has been updated."', WORKSPACE_SCRIPT)
        self.assertIn('"Changes discarded. Your current article remains unchanged."', WORKSPACE_SCRIPT)

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

    def test_publish_is_a_final_audience_review_action_not_article_navigation(self):
        self.assertIn('id="aiced-review-actions"', WORKSPACE_TEMPLATE)
        self.assertIn('aria-label="Final publishing actions"', WORKSPACE_TEMPLATE)
        self.assertIn('class="aiced-button aiced-button--quiet" id="aiced-proposal-next"', WORKSPACE_TEMPLATE)
        self.assertIn('const showDraftPublish = approvalState === "saved" && isDraftProposal() && activeProposalStep === 3;', WORKSPACE_SCRIPT)
        self.assertIn('publishButton.hidden = !showDraftPublish;', WORKSPACE_SCRIPT)
        self.assertIn('proposalNextButton.hidden = activeProposalStep === lastAvailableStep;', WORKSPACE_SCRIPT)

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

    def test_audience_summary_is_live_and_email_preview_is_a_separate_step(self):
        self.assertIn("Eligible recipients", WORKSPACE_TEMPLATE)
        self.assertIn("Currently matching active subscribers", WORKSPACE_TEMPLATE)
        self.assertIn("All active subscribers", WORKSPACE_SCRIPT)
        audience_index = WORKSPACE_TEMPLATE.index('id="aiced-card-audience"')
        email_index = WORKSPACE_TEMPLATE.index('class="aiced-review-card aiced-review-card--email"')
        draft_email_index = WORKSPACE_TEMPLATE.index('class="aiced-draft-email-preview"')
        self.assertLess(audience_index, email_index)
        self.assertGreater(draft_email_index, email_index)

    def test_audience_edit_uses_the_existing_tag_inputs_with_a_current_match_summary(self):
        self.assertIn('className = "aiced-audience-edit-form__layout"', WORKSPACE_SCRIPT)
        self.assertIn('input.name = "audience-tag"', WORKSPACE_SCRIPT)
        self.assertIn('"Proposed audience — not saved"', WORKSPACE_SCRIPT)
        self.assertIn('card.insertBefore(form, card.querySelector(".aiced-audience-overview"))', WORKSPACE_SCRIPT)
        self.assertIn('.aiced-audience-edit-form__layout', WORKSPACE_CSS)

    def test_audience_edit_previews_unsaved_tags_with_loading_and_stale_response_protection(self):
        self.assertIn("function queueProposedAudiencePreview", WORKSPACE_SCRIPT)
        self.assertIn('method: "POST"', WORKSPACE_SCRIPT)
        self.assertIn('body: JSON.stringify({ tags })', WORKSPACE_SCRIPT)
        self.assertIn("new AbortController()", WORKSPACE_SCRIPT)
        self.assertIn("sequence !== audiencePreviewRequestSequence", WORKSPACE_SCRIPT)
        self.assertIn("Updating matching recipients…", WORKSPACE_SCRIPT)
        self.assertIn("No active subscribers match every selected tag.", WORKSPACE_SCRIPT)
        self.assertIn('queueProposedAudiencePreview(form, { immediate: true })', WORKSPACE_SCRIPT)

    def test_closing_the_article_hides_its_browser_only_change_review(self):
        self.assertIn('const articleExpandedLayout = document.querySelector("#aiced-article-expanded-layout")', WORKSPACE_SCRIPT)
        self.assertIn("articleExpandedLayout.hidden = !isExpanded", WORKSPACE_SCRIPT)
        self.assertIn("setArticleExpanded(articleExpandedLayout.hidden)", WORKSPACE_SCRIPT)

    def test_expanded_article_can_mount_a_dedicated_adjacent_change_review_panel(self):
        self.assertIn('id="aiced-article-expanded-layout"', WORKSPACE_TEMPLATE)
        self.assertIn('articleExpandedLayout.append(panel)', WORKSPACE_SCRIPT)
        self.assertIn('grid-column: 2', WORKSPACE_CSS)
        self.assertIn('articleExpandedLayout.hidden = false;', WORKSPACE_SCRIPT)

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
        self.assertNotIn('id="aiced-article-full-editor-locked"', WORKSPACE_TEMPLATE)
        self.assertIn("Edit Article", WORKSPACE_TEMPLATE)

    def test_edit_campaign_onboarding_appears_before_navigation_and_article_preview(self):
        onboarding_index = WORKSPACE_TEMPLATE.index('id="aiced-draft-onboarding"')
        edit_campaign_index = WORKSPACE_TEMPLATE.index('id="aiced-approve-button"')
        navigation_index = WORKSPACE_TEMPLATE.index('id="aiced-proposal-nav"')
        preview_index = WORKSPACE_TEMPLATE.index('class="aiced-proposal-viewport"')
        self.assertLess(onboarding_index, edit_campaign_index)
        self.assertLess(edit_campaign_index, navigation_index)
        self.assertLess(navigation_index, preview_index)

    def test_edit_campaign_enables_one_cross_section_draft_editing_workflow(self):
        self.assertIn('"Draft · Editing"', WORKSPACE_SCRIPT)
        self.assertIn("Editing enabled across Article, CTA, Campaign, and Audience", WORKSPACE_SCRIPT)
        self.assertIn("setManualEditingEnabled(true)", WORKSPACE_SCRIPT)
        self.assertIn("approveButton.hidden = true", WORKSPACE_SCRIPT)

    def test_edit_campaign_uses_visible_loading_and_restored_workflow_hides_onboarding(self):
        self.assertIn('approveButton.textContent = "Preparing draft…"', WORKSPACE_SCRIPT)
        self.assertIn('draftOnboarding.hidden = true', WORKSPACE_SCRIPT)
        self.assertIn('draftOnboarding.hidden = Boolean(proposal.workflow)', WORKSPACE_SCRIPT)
        self.assertIn('`/posts/new/build?edit=${savedWorkflow.postId}&workflow=${encodeURIComponent(savedWorkflow.workflowToken)}`', WORKSPACE_SCRIPT)

    def test_cta_edit_uses_a_dedicated_form_and_existing_workflow_patch(self):
        self.assertIn("function beginCtaEdit(card)", WORKSPACE_SCRIPT)
        self.assertIn('"CTA headline"', WORKSPACE_SCRIPT)
        self.assertIn('"Supporting text"', WORKSPACE_SCRIPT)
        self.assertIn('"Button label"', WORKSPACE_SCRIPT)
        self.assertIn('if (kind === "cta") { beginCtaEdit(card); return; }', WORKSPACE_SCRIPT)
        self.assertIn('id="aiced-cta-preview"', WORKSPACE_TEMPLATE)

    def test_rerendering_clears_temporary_forms_and_restores_previews(self):
        self.assertIn("function clearManualEditingUi()", WORKSPACE_SCRIPT)
        self.assertIn('".aiced-card-edit-form"', WORKSPACE_SCRIPT)
        self.assertIn('document.querySelector("#aiced-cta-preview").hidden = false', WORKSPACE_SCRIPT)
        self.assertIn('document.querySelector("#aiced-campaign-summary").hidden = false', WORKSPACE_SCRIPT)
        self.assertIn("clearManualEditingUi();", WORKSPACE_SCRIPT)

    def test_campaign_edit_hides_its_summary_and_explains_recipient_visible_fields(self):
        self.assertIn('id="aiced-campaign-summary"', WORKSPACE_TEMPLATE)
        self.assertIn("Campaign name is for your internal workspace", WORKSPACE_SCRIPT)
        self.assertIn('addField(form, "Campaign name", reviewedProposal.campaign.name, "name")', WORKSPACE_SCRIPT)
        self.assertIn('addField(form, "Email subject", reviewedProposal.campaign.subject, "subject")', WORKSPACE_SCRIPT)
        self.assertIn('addField(form, "Preheader", reviewedProposal.campaign.preheader, "preheader", true)', WORKSPACE_SCRIPT)
        self.assertIn('preview.hidden = true', WORKSPACE_SCRIPT)
        self.assertIn('appendEditActions(form, card, preview)', WORKSPACE_SCRIPT)

    def test_campaign_summary_and_edit_form_are_mutually_exclusive(self):
        self.assertIn('.aiced-details[hidden] { display: none; }', WORKSPACE_CSS)
        self.assertIn('#aiced-card-campaign:has(.aiced-campaign-edit-form) [data-card-edit="campaign"]', WORKSPACE_CSS)
        self.assertIn('form.remove();\n    if (preview) preview.hidden = false;', WORKSPACE_SCRIPT)

    def test_campaign_preview_prioritizes_recipient_facing_copy(self):
        subject_index = WORKSPACE_TEMPLATE.index('class="aiced-details__subject"')
        preheader_index = WORKSPACE_TEMPLATE.index('class="aiced-details__preheader"')
        internal_name_index = WORKSPACE_TEMPLATE.index('class="aiced-details__secondary"')
        self.assertLess(subject_index, preheader_index)
        self.assertLess(preheader_index, internal_name_index)
        self.assertIn('Internal campaign name', WORKSPACE_TEMPLATE)

    def test_ai_revision_review_is_browser_only_until_each_change_is_approved(self):
        self.assertIn("let pendingReviewEntries = []", WORKSPACE_SCRIPT)
        self.assertIn("function makePendingReviewEntries(revision, proposal)", WORKSPACE_SCRIPT)
        self.assertIn("function renderPendingRevisionReview()", WORKSPACE_SCRIPT)
        self.assertIn("function applyPendingReviewEntry(entry)", WORKSPACE_SCRIPT)
        self.assertIn("function revertPendingReviewEntry(entry)", WORKSPACE_SCRIPT)
        self.assertIn(": { instruction, preview: true }", WORKSPACE_SCRIPT)

    def test_revision_review_uses_actual_article_blocks_in_a_side_by_side_comparison(self):
        self.assertIn('articleExpandedLayout.querySelector(":scope > .aiced-change-review")?.remove()', WORKSPACE_SCRIPT)
        self.assertIn("articleExpandedLayout.append(panel)", WORKSPACE_SCRIPT)
        self.assertIn("let pendingArticleRevision = null", WORKSPACE_SCRIPT)
        self.assertIn("function derivePendingArticleRevision()", WORKSPACE_SCRIPT)
        self.assertIn("function matchArticleBlocks(originalBlocks, proposedBlocks)", WORKSPACE_SCRIPT)
        self.assertIn('originalArticle, "Original", "Current", "original"', WORKSPACE_SCRIPT)
        self.assertIn('revisedArticle, "Revised by Aiced", "Proposed", "revised"', WORKSPACE_SCRIPT)
        self.assertIn("function acceptPendingRevision()", WORKSPACE_SCRIPT)
        self.assertIn("function discardPendingRevision()", WORKSPACE_SCRIPT)

    def test_pending_revision_keeps_the_article_comparison_open_after_a_rerender(self):
        self.assertIn("setArticleExpanded(hasPendingReviewEntries());", WORKSPACE_SCRIPT)

    def test_non_article_revisions_do_not_claim_that_the_article_changed(self):
        self.assertIn("function renderNonArticleRevisionNotice(entries)", WORKSPACE_SCRIPT)
        self.assertIn("The article itself is unchanged.", WORKSPACE_SCRIPT)
        self.assertIn('classList.toggle("has-nonarticle-review"', WORKSPACE_SCRIPT)

    def test_revision_review_uses_safe_word_level_diffs_for_matched_text_blocks(self):
        self.assertIn("function appendWordDiff(element, originalText, proposedText, side)", WORKSPACE_SCRIPT)
        self.assertIn('document.createElement("span")', WORKSPACE_SCRIPT)
        self.assertIn('span.textContent = part.text', WORKSPACE_SCRIPT)
        self.assertIn('aiced-word-diff--${part.kind}', WORKSPACE_SCRIPT)
        self.assertIn("if (similarity >= 0.35)", WORKSPACE_SCRIPT)
        self.assertIn('appendWordDiff(element, side === "original"', WORKSPACE_SCRIPT)

    def test_revision_review_uses_compact_changed_sections_before_an_optional_full_comparison(self):
        self.assertIn('let showFullRevisionComparison = null', WORKSPACE_SCRIPT)
        self.assertIn('const compactComparison = Math.max(originalChangedCount, proposedChangedCount) <= 1;', WORKSPACE_SCRIPT)
        self.assertIn('const showFull = showFullRevisionComparison === null ? !compactComparison : showFullRevisionComparison;', WORKSPACE_SCRIPT)
        self.assertIn('"View full comparison"', WORKSPACE_SCRIPT)
        self.assertIn('"Show changed sections only"', WORKSPACE_SCRIPT)
        self.assertIn('showFullRevisionComparison = !showFull; renderPendingRevisionReview();', WORKSPACE_SCRIPT)
