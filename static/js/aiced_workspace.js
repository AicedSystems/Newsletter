const generationForm = document.querySelector("#aiced-generation-form");
const generationRequest = document.querySelector("#aiced-generation-request");
const generateButton = document.querySelector("#aiced-generate-button");
const generationStatus = document.querySelector("#aiced-generation-status");
const intro = document.querySelector("#aiced-intro");
const review = document.querySelector("#aiced-review");
const reviewStatus = document.querySelector("#aiced-review-status");
const newButtons = [document.querySelector("#aiced-new-button"), document.querySelector("#aiced-review-new-button")];
const sidebar = document.querySelector("#aiced-sidebar");
const menuButton = document.querySelector("#aiced-menu-button");
const sidebarCollapseButton = document.querySelector("#aiced-sidebar-collapse");
const articleContent = document.querySelector("#aiced-article-content");
const articleExpandedLayout = document.querySelector("#aiced-article-expanded-layout");
const articleToggle = document.querySelector("#aiced-article-toggle");
const approveButton = document.querySelector("#aiced-approve-button");
const draftOnboarding = document.querySelector("#aiced-draft-onboarding");
const restoreStartNewButton = document.querySelector("#aiced-restore-start-new");
const refineRequest = document.querySelector("#aiced-refine-request");
const refineSendButton = document.querySelector("#aiced-refine-send");
const publishButton = document.querySelector("#aiced-publish-button");
const reviewActions = document.querySelector("#aiced-review-actions");
const liveArticleLink = document.querySelector("#aiced-live-article");
const sendCampaignButton = document.querySelector("#aiced-send-campaign-button");
const sendConfirmation = document.querySelector("#aiced-send-confirmation");
const sendConfirmationSummary = document.querySelector("#aiced-send-confirmation-summary");
const sendCancelButton = document.querySelector("#aiced-send-cancel");
const sendConfirmButton = document.querySelector("#aiced-send-confirm");
const proposalNavigation = document.querySelector("#aiced-proposal-nav");
const proposalPanels = [...document.querySelectorAll("[data-proposal-panel]")];
const proposalStepButtons = [...document.querySelectorAll("[data-proposal-step]")];
const proposalPosition = document.querySelector("#aiced-proposal-position");
const proposalPreviousButtons = [document.querySelector("#aiced-proposal-previous"), document.querySelector("#aiced-proposal-previous-top")];
const proposalNextButtons = [document.querySelector("#aiced-proposal-next"), document.querySelector("#aiced-proposal-next-top")];
const proposalNextButton = document.querySelector("#aiced-proposal-next");
const refineSuggestions = document.querySelector("#aiced-refine-suggestions");
const audiencePreviewTable = document.querySelector("#aiced-audience-preview-table");
const audiencePreviewList = document.querySelector("#aiced-audience-preview-list");
const audiencePreviewMessage = document.querySelector("#aiced-audience-preview-message");
const campaignReadyIntro = document.querySelector("#aiced-campaign-ready-intro");
const campaignReviewCount = document.querySelector("#aiced-campaign-review-count");
const campaignReviewSubject = document.querySelector("#aiced-campaign-review-subject");
const campaignReviewRecipients = document.querySelector("#aiced-campaign-review-recipient-list");
const campaignReviewEmpty = document.querySelector("#aiced-campaign-review-empty");
const removeRecipientsButton = document.querySelector("#aiced-remove-recipients");

let isGenerating = false;
let reviewedProposal = null;
let approvalState = "idle";
let savedWorkflow = null;
let isRevising = false;
let isManualSaving = false;
let isApplyingRevision = false;
let isCampaignProcessing = false;
let campaignDelivery = null;
let activeProposalStep = 0;
let refineComposerExpanded = false;
let pendingReviewEntries = [];
let pendingArticleRevision = null;
let pendingReviewHeading = "Aiced proposed changes";
let pendingReviewSummary = "";
let showFullRevisionComparison = null;
let selectedCampaignRecipientIds = new Set();
let audiencePreviewDebounce = null;
let audiencePreviewRequestController = null;
let audiencePreviewRequestSequence = 0;

const proposalSteps = [
    { label: "Article", next: "Call to Action", placeholder: "Ask Aiced to rewrite, expand, or refine your article…", prompts: [["Make it shorter", "Make the article shorter while keeping the important details."], ["More conversational", "Make the article more conversational and approachable."], ["Improve the headline", "Improve the article headline for clarity and interest."], ["Add more detail", "Add more useful detail to the article."], ["Change the tone", "Make the article warmer and more welcoming."]] },
    { label: "Call to Action", next: "Campaign Details", placeholder: "Ask Aiced to improve your call to action…", prompts: [["Make it softer", "Make the call to action softer and less salesy."], ["Make it more direct", "Make the call to action more direct."], ["Change the button text", "Rewrite the call-to-action button text."], ["Less salesy", "Make the call to action feel less salesy."]] },
    { label: "Campaign Details", next: "Audience", placeholder: "Ask Aiced to improve your subject or preheader…", prompts: [["Shorter subject", "Make the campaign subject shorter."], ["More curiosity", "Make the campaign subject more curiosity-driven."], ["Warmer tone", "Make the campaign copy warmer."], ["Rewrite the preheader", "Rewrite the campaign preheader."]] },
    { label: "Audience", next: null, placeholder: "Ask Aiced to refine your campaign audience…", prompts: [["Explain this audience", "Explain why this audience is a good fit."], ["Narrow the audience", "Narrow the campaign audience to the most relevant existing tags."], ["Change the audience", "Suggest a different audience using only existing tags."]] },
    { label: "Email Preview", next: "Review Campaign", placeholder: "Ask Aiced to improve your email campaign…", prompts: [["Improve the subject", "Improve the email subject line."], ["Make it warmer", "Make the email campaign warmer."], ["More concise", "Make the email campaign more concise."]], publishedOnly: true },
    { label: "Review Campaign", next: null, placeholder: "Ask Aiced to refine your campaign…", prompts: [], publishedOnly: true },
];

function isDraftProposal() {
    return !reviewedProposal?.workflow || reviewedProposal.workflow.status === "draft";
}

function renderRefineSuggestions() {
    refineSuggestions.replaceChildren();
    const step = proposalSteps[activeProposalStep];
    const revisionsEnabled = approvalState === "saved" && !hasPendingReviewEntries();
    step.prompts.forEach(([label, prompt]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = !revisionsEnabled;
        button.addEventListener("click", () => {
            refineRequest.value = prompt;
            resizeRefineComposer();
            refineRequest.focus();
        });
        refineSuggestions.append(button);
    });
}

function setActiveProposalStep(nextStep, { focus = false } = {}) {
    const draft = isDraftProposal();
    const lastAvailableStep = draft ? 3 : proposalSteps.length - 1;
    activeProposalStep = Math.max(0, Math.min(lastAvailableStep, Number(nextStep) || 0));
    proposalPanels.forEach((panel, index) => {
        const campaignPreviewPanel = !draft && activeProposalStep === 4 && [2, 3, 4].includes(index);
        panel.hidden = !campaignPreviewPanel && index !== activeProposalStep;
    });
    proposalStepButtons.forEach((button, index) => {
        const active = index === activeProposalStep;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "step" : "false");
        button.disabled = (draft && index > 3) || (!draft && (index < 4 || (index === 5 && !campaignDelivery)));
        if (active && focus) button.focus();
    });
    proposalPosition.textContent = `${String(activeProposalStep + 1).padStart(2, "0")} / ${String(lastAvailableStep + 1).padStart(2, "0")}`;
    proposalPreviousButtons.forEach((button) => { button.disabled = activeProposalStep === 0; });
    proposalNextButtons.forEach((button) => { button.disabled = activeProposalStep === lastAvailableStep; });
    proposalNextButton.hidden = activeProposalStep === lastAvailableStep;
    proposalNextButton.textContent = activeProposalStep === lastAvailableStep ? "Review complete" : `Next: ${proposalSteps[activeProposalStep].next} →`;
    campaignReadyIntro.hidden = draft || activeProposalStep === 5;
    refineRequest.placeholder = proposalSteps[activeProposalStep].placeholder;
    renderRefineSuggestions();
    syncBottomActions();
}

function syncBottomActions() {
    const showDraftPublish = approvalState === "saved" && isDraftProposal() && activeProposalStep === 3;
    publishButton.hidden = !showDraftPublish;

    if (isDraftProposal()) {
        reviewActions.hidden = !showDraftPublish;
    } else {
        reviewActions.hidden = false;
    }
}

function resizeRefineComposer() {
    refineRequest.style.height = "auto";
    refineRequest.style.height = `${Math.min(refineRequest.scrollHeight, 128)}px`;
}

function syncRefineComposerExpansion() {
    if (review.hidden) return;
    const distanceFromBottom = document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
    if (!refineComposerExpanded && distanceFromBottom <= 40) refineComposerExpanded = true;
    if (refineComposerExpanded && distanceFromBottom > 220) refineComposerExpanded = false;
    refineRequest.closest(".aiced-refine").classList.toggle("is-expanded", refineComposerExpanded);
    refineSuggestions.hidden = !refineComposerExpanded;
}

function setManualEditingEnabled(enabled) {
    document.querySelectorAll("[data-card-edit]").forEach((button) => {
        button.disabled = !enabled;
        const lockedControl = button.closest("[data-locked-control]");
        lockedControl?.classList.toggle("is-locked", !enabled);
        if (enabled) {
            button.removeAttribute("aria-describedby");
            button.removeAttribute("title");
        } else {
            button.setAttribute("aria-describedby", "aiced-editing-disabled-explanation");
            button.title = "Click Save & Edit Campaign first to unlock editing.";
        }
    });
    const fullEditor = document.querySelector("#aiced-article-full-editor");
    fullEditor.hidden = !enabled;
    fullEditor.href = enabled ? `/posts/new/build?edit=${savedWorkflow.postId}&workflow=${encodeURIComponent(savedWorkflow.workflowToken)}` : "";
}

function audiencePreviewStatusLabel(status, source) {
    if (source === "live") return "Active";
    return { pending: "Prepared", sent: "Sent", failed: "Failed" }[status] || "Prepared";
}

function renderAudiencePreview(preview) {
    audiencePreviewList.replaceChildren();
    audiencePreviewTable.hidden = true;
    if (!preview) {
        audiencePreviewMessage.textContent = "Save this proposal to preview matching active subscribers.";
        return;
    }
    const subscribers = Array.isArray(preview.subscribers) ? preview.subscribers : [];
    if (!subscribers.length) {
        audiencePreviewMessage.textContent = preview.source === "snapshot"
            ? "This campaign snapshot has no recipients."
            : "No active subscribers currently match every selected tag.";
        return;
    }
    audiencePreviewMessage.textContent = preview.source === "snapshot"
        ? `Showing the frozen ${preview.campaignStatus === "sent" ? "send" : "prepared"} recipient snapshot.`
        : `${preview.matchingCount} matching active subscriber${preview.matchingCount === 1 ? "" : "s"}.`;
    subscribers.forEach((subscriber) => {
        const row = document.createElement("tr");
        const name = document.createElement("td"); name.textContent = subscriber.name || "Subscriber";
        const email = document.createElement("td"); email.textContent = subscriber.email || "—";
        const tags = document.createElement("td");
        (subscriber.tags || []).forEach((tag) => { const chip = document.createElement("span"); chip.textContent = tag; tags.append(chip); });
        if (!tags.childNodes.length) tags.textContent = "—";
        const status = document.createElement("td"); status.className = "aiced-audience-preview__status";
        status.textContent = audiencePreviewStatusLabel(subscriber.status, preview.source);
        row.append(name, email, tags, status); audiencePreviewList.append(row);
    });
    audiencePreviewTable.hidden = false;
}

async function loadAudiencePreview() {
    if (!savedWorkflow) { renderAudiencePreview(null); return; }
    const workflowToken = savedWorkflow.workflowToken;
    audiencePreviewMessage.textContent = "Loading matching subscribers…";
    audiencePreviewTable.hidden = true;
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(workflowToken)}/audience-preview`);
        const preview = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(preview.message || "Matching subscribers are unavailable.");
        if (savedWorkflow?.workflowToken !== workflowToken) return;
        renderAudiencePreview(preview);
    } catch (error) {
        if (savedWorkflow?.workflowToken !== workflowToken) return;
        audiencePreviewMessage.textContent = error.message || "Matching subscribers are unavailable.";
        audiencePreviewTable.hidden = true;
    }
}

function renderProposedAudienceEditPreview(form, preview, { loading = false, error = "" } = {}) {
    const matches = form.querySelector(".aiced-audience-edit-form__matches");
    if (!matches) return;
    const count = matches.querySelector(".aiced-audience-edit-form__count");
    const message = matches.querySelector(".aiced-audience-edit-form__matches-message");
    const list = matches.querySelector(".aiced-audience-edit-form__preview-list");
    list.replaceChildren();
    if (loading) {
        count.textContent = "—";
        message.textContent = "Updating matching recipients…";
        return;
    }
    if (error) {
        count.textContent = "—";
        message.textContent = error;
        return;
    }
    const subscribers = Array.isArray(preview?.subscribers) ? preview.subscribers : [];
    const matchingCount = Number(preview?.matchingCount) || 0;
    count.textContent = String(matchingCount);
    if (!matchingCount) {
        message.textContent = "No active subscribers match every selected tag.";
        return;
    }
    message.textContent = `Showing ${subscribers.length} of ${matchingCount} proposed match${matchingCount === 1 ? "" : "es"}.`;
    subscribers.forEach((subscriber) => {
        const item = document.createElement("li");
        const name = document.createElement("strong"); name.textContent = subscriber.name || "Subscriber";
        const email = document.createElement("span"); email.textContent = subscriber.email || "—";
        item.append(name, email); list.append(item);
    });
}

function queueProposedAudiencePreview(form, { immediate = false } = {}) {
    clearTimeout(audiencePreviewDebounce);
    const requestPreview = async () => {
        if (!form.isConnected || !savedWorkflow) return;
        const sequence = ++audiencePreviewRequestSequence;
        audiencePreviewRequestController?.abort();
        audiencePreviewRequestController = new AbortController();
        const tags = [...form.querySelectorAll('input[name="audience-tag"]:checked')].map((input) => input.value);
        renderProposedAudienceEditPreview(form, null, { loading: true });
        try {
            const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/audience-preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tags }),
                signal: audiencePreviewRequestController.signal,
            });
            const preview = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(preview.message || "Matching recipients are unavailable.");
            if (!form.isConnected || sequence !== audiencePreviewRequestSequence || preview.source !== "proposed") return;
            renderProposedAudienceEditPreview(form, preview);
        } catch (error) {
            if (error.name === "AbortError" || !form.isConnected || sequence !== audiencePreviewRequestSequence) return;
            renderProposedAudienceEditPreview(form, null, { error: error.message || "Matching recipients are unavailable." });
        }
    };
    if (immediate) requestPreview();
    else audiencePreviewDebounce = window.setTimeout(requestPreview, 250);
}

async function loadPublishedEmailPreview() {
    if (!savedWorkflow) return;
    const frame = document.querySelector("#aiced-email-rendered-preview");
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/email-preview`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.html) throw new Error(result.message || "Email preview is unavailable.");
        frame.srcdoc = result.html; frame.hidden = false;
    } catch (error) { setStatus(reviewStatus, error.message || "Email preview is unavailable.", true); }
}

function setPublishedState() {
    approvalState = "published";
    draftOnboarding.hidden = true;
    approveButton.hidden = true;
    publishButton.hidden = true;
    reviewActions.hidden = false;
    setRevisionComposerEnabled(false);
    setManualEditingEnabled(false);
    review.classList.remove("aiced-review--draft");
    review.classList.add("aiced-review--published");
    proposalNavigation.hidden = false;
    campaignReadyIntro.hidden = false;
    const path = reviewedProposal.article.publicArticlePath;
    liveArticleLink.hidden = !path; liveArticleLink.href = path || "";
    setStatus(reviewStatus, "Article published — campaign review is ready.");
    loadAudiencePreview();
    loadPublishedEmailPreview();
    renderCampaignReview(campaignDelivery);
    setActiveProposalStep(4);
    syncCampaignControls();
}

function campaignResultMessage(delivery) {
    if (!delivery) return "";
    if (delivery.status === "sent") return `Campaign sent — ${delivery.sentCount} of ${delivery.recipientCount} submitted.`;
    if (delivery.status === "partial") return `Campaign partially sent — ${delivery.sentCount} submitted, ${delivery.failedCount} failed.`;
    if (delivery.status === "failed") return `Campaign could not be sent — ${delivery.failedCount} failed.`;
    return `Campaign prepared for ${delivery.recipientCount} recipient${delivery.recipientCount === 1 ? "" : "s"}.`;
}

function renderSendConfirmation(delivery) {
    campaignDelivery = delivery;
    const count = Number(delivery?.recipientCount) || 0;
    sendConfirmationSummary.textContent = `${count} prepared active recipient${count === 1 ? "" : "s"}.`;
    renderCampaignReview(delivery);
    sendConfirmButton.textContent = `Send campaign to ${count} recipient${count === 1 ? "" : "s"}`;
    sendConfirmation.hidden = false;
}

function renderCampaignReview(delivery) {
    const recipients = Array.isArray(delivery?.recipients) ? delivery.recipients : [];
    const canEditRecipients = delivery?.status === "draft";
    selectedCampaignRecipientIds = new Set([...selectedCampaignRecipientIds].filter((id) => recipients.some((recipient) => recipient.id === id)));
    campaignReviewCount.textContent = String(Number(delivery?.recipientCount) || recipients.length || 0);
    campaignReviewSubject.textContent = reviewedProposal?.campaign?.subject || "—";
    campaignReviewRecipients.replaceChildren();
    recipients.forEach((recipient) => {
        const item = document.createElement("li");
        item.classList.toggle("is-selectable", canEditRecipients);
        if (canEditRecipients) {
            const select = document.createElement("input");
            select.type = "checkbox";
            select.value = String(recipient.id);
            select.checked = selectedCampaignRecipientIds.has(recipient.id);
            select.setAttribute("aria-label", `Select ${recipient.name || "subscriber"}`);
            select.addEventListener("change", () => {
                if (select.checked) selectedCampaignRecipientIds.add(recipient.id);
                else selectedCampaignRecipientIds.delete(recipient.id);
                syncRemoveRecipientsButton();
            });
            item.append(select);
        }
        const initials = document.createElement("span");
        initials.className = "aiced-campaign-review__avatar";
        initials.textContent = (recipient.name || "Subscriber").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "S";
        const details = document.createElement("span");
        const name = document.createElement("strong"); name.textContent = recipient.name || "Subscriber";
        const email = document.createElement("small"); email.textContent = recipient.email || "hidden";
        details.append(name, email);
        const state = document.createElement("span");
        state.className = "aiced-campaign-review__recipient-state";
        const recipientState = recipient.status || delivery?.status;
        state.textContent = recipientState === "sent" ? "Sent" : recipientState === "failed" ? "Failed" : "Prepared";
        item.append(initials, details, state);
        campaignReviewRecipients.append(item);
    });
    campaignReviewEmpty.hidden = recipients.length > 0;
    syncRemoveRecipientsButton();
}

function syncRemoveRecipientsButton() {
    const canEditRecipients = campaignDelivery?.status === "draft";
    removeRecipientsButton.hidden = !canEditRecipients;
    removeRecipientsButton.disabled = !canEditRecipients || selectedCampaignRecipientIds.size === 0 || isCampaignProcessing;
    removeRecipientsButton.textContent = selectedCampaignRecipientIds.size
        ? `Remove selected (${selectedCampaignRecipientIds.size})`
        : "Remove selected";
}

async function removeSelectedCampaignRecipients() {
    if (isCampaignProcessing || !savedWorkflow || !selectedCampaignRecipientIds.size) return;
    isCampaignProcessing = true;
    syncRemoveRecipientsButton();
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/campaign/recipients/remove`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipientIds: [...selectedCampaignRecipientIds] }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.campaign) throw new Error(result.message || "Selected recipients could not be removed.");
        campaignDelivery = { ...result.campaign, recipients: result.recipients || result.campaign.recipients || [] };
        reviewedProposal.campaign.delivery = campaignDelivery;
        selectedCampaignRecipientIds = new Set();
        renderCampaignReview(campaignDelivery);
        loadAudiencePreview();
        setStatus(reviewStatus, "Selected recipients were removed from this prepared campaign.");
    } catch (error) {
        setStatus(reviewStatus, error.message || "Selected recipients could not be removed.", true);
    } finally {
        isCampaignProcessing = false;
        syncRemoveRecipientsButton();
    }
}

function renderPreparedCampaignReview(delivery) {
    selectedCampaignRecipientIds = new Set();
    renderSendConfirmation(delivery);
    setActiveProposalStep(5, { focus: true });
}

function syncCampaignControls() {
    if (approvalState !== "published") return;
    sendCampaignButton.hidden = false;
    if (!campaignDelivery) {
        sendCampaignButton.disabled = false;
        sendCampaignButton.textContent = "Prepare campaign";
        return;
    }
    if (campaignDelivery.status === "sent") {
        renderCampaignReview(campaignDelivery);
        sendCampaignButton.disabled = true;
        sendCampaignButton.textContent = "Campaign Sent";
        return;
    }
    if (["partial", "failed"].includes(campaignDelivery.status)) {
        sendCampaignButton.disabled = true;
        sendCampaignButton.textContent = "Campaign needs review";
        return;
    }
    sendCampaignButton.disabled = false;
    sendCampaignButton.textContent = "Review prepared campaign";
    renderCampaignReview(campaignDelivery);
}

async function prepareCampaign() {
    if (isCampaignProcessing || !savedWorkflow) return;
    if (campaignDelivery?.status === "draft") { renderPreparedCampaignReview(campaignDelivery); return; }
    isCampaignProcessing = true;
    sendCampaignButton.disabled = true;
    sendCampaignButton.textContent = "Preparing…";
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/campaign/prepare`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.campaign) throw new Error(result.message || "Campaign could not be prepared.");
        campaignDelivery = { ...result.campaign, recipients: result.recipients || result.campaign.recipients || [] };
        reviewedProposal.campaign.delivery = campaignDelivery;
        loadAudiencePreview();
        renderPreparedCampaignReview(campaignDelivery);
        setStatus(reviewStatus, campaignResultMessage(campaignDelivery));
    } catch (error) {
        setStatus(reviewStatus, error.message || "Campaign could not be prepared.", true);
    } finally {
        isCampaignProcessing = false;
        syncCampaignControls();
    }
}

async function sendPreparedCampaign() {
    if (isCampaignProcessing || !savedWorkflow || !campaignDelivery) return;
    isCampaignProcessing = true;
    sendConfirmButton.disabled = true;
    sendCancelButton.disabled = true;
    sendConfirmButton.textContent = "Sending…";
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/campaign/send`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.campaign) throw new Error(result.message || "Campaign could not be sent.");
        campaignDelivery = { ...result.campaign, recipients: campaignDelivery.recipients || [] };
        reviewedProposal.campaign.delivery = campaignDelivery;
        loadAudiencePreview();
        sendConfirmation.hidden = true;
        setStatus(reviewStatus, campaignResultMessage(campaignDelivery), campaignDelivery.status !== "sent");
    } catch (error) {
        setStatus(reviewStatus, error.message || "Campaign could not be sent.", true);
    } finally {
        isCampaignProcessing = false;
        sendConfirmButton.disabled = false;
        sendCancelButton.disabled = false;
        syncCampaignControls();
    }
}

function titleCase(value) {
    return String(value || "").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("aiced-status--error", isError);
}

function appendTextElement(parent, tagName, text, className = "") {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
}

function renderTags(container, tags, emptyLabel) {
    container.replaceChildren();
    const values = Array.isArray(tags) && tags.length ? tags : [emptyLabel];
    values.forEach((tag) => appendTextElement(container, "li", tag));
}

function renderFeaturedImage(article) {
    const container = document.querySelector("#aiced-featured-image");
    container.replaceChildren();
    const title = document.createElement("strong"); title.textContent = "Featured image"; container.append(title);
    const actions = document.createElement("div"); actions.className = "aiced-featured-image__actions";
    const editingLocked = approvalState !== "saved";
    const lockedHint = "Click Save & Edit Campaign first to unlock editing.";
    actions.classList.toggle("is-locked", editingLocked);
    actions.dataset.lockedHint = lockedHint;
    const generate = document.createElement("button"); generate.type = "button"; generate.textContent = article.featuredImage ? "✨ Regenerate" : "✨ Generate with Aiced"; generate.disabled = editingLocked; if (editingLocked) generate.title = lockedHint; generate.addEventListener("click", generateFeaturedImage);
    const upload = document.createElement("button"); upload.type = "button"; upload.textContent = article.featuredImage ? "Upload" : "Upload Image"; upload.disabled = editingLocked; if (editingLocked) upload.title = lockedHint; upload.addEventListener("click", () => container.querySelector("input[type=file]").click());
    actions.append(generate, upload);
    if (article.featuredImage) { const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove"; remove.disabled = editingLocked; if (editingLocked) remove.title = lockedHint; remove.addEventListener("click", () => saveFeaturedImage(null)); actions.append(remove); }
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp"; input.hidden = true; input.addEventListener("change", uploadFeaturedImage);
    container.append(actions);
    if (article.featuredImage) { const image = document.createElement("img"); image.src = article.featuredImage; image.alt = "Current featured image"; container.append(image); }
    else { const empty = document.createElement("p"); empty.textContent = "No featured image yet."; container.append(empty); }
    container.append(input);
}

async function saveFeaturedImage(featuredImage) {
    if (!savedWorkflow) return;
    const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ article: { featuredImage } }) });
    const proposal = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(proposal.message || "Could not save the featured image.");
    const workflowToken = savedWorkflow.workflowToken; renderProposal(proposal, { resetStep: false }); markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Featured image saved.");
}

async function generateFeaturedImage() {
    if (!savedWorkflow) return;
    const container = document.querySelector("#aiced-featured-image"); container.classList.add("is-generating");
    container.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try { const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/featured-image`, { method: "POST" }); const proposal = await response.json().catch(() => ({})); if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not create an image."); const workflowToken = savedWorkflow.workflowToken; renderProposal(proposal, { resetStep: false }); markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Featured image created."); }
    catch (error) { setStatus(reviewStatus, error.message || "Aiced Bot could not create an image.", true); }
    finally { container.classList.remove("is-generating"); }
}

async function uploadFeaturedImage(event) {
    const file = event.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append("image", file);
    try { const response = await fetch("/api/uploads/article-image", { method: "POST", body: formData }); const result = await response.json().catch(() => ({})); if (!response.ok || !result.url) throw new Error(result.message || "Image upload failed."); await saveFeaturedImage(result.url); }
    catch (error) { setStatus(reviewStatus, error.message || "Image upload failed.", true); }
}

function renderNormalArticleBlocks(blocks) {
    articleContent.replaceChildren();
    const source = document.createElement("div");
    source.className = "aiced-article-content__source";
    blocks.forEach((block) => {
        if (block.type === "heading") {
            appendTextElement(source, "h3", block.text || "");
        } else if (block.type === "paragraph" || block.type === "quote") {
            appendTextElement(source, block.type === "quote" ? "blockquote" : "p", block.text || "");
        }
    });
    articleContent.append(source);
}

function sameReviewValue(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function reviewValue(value, field) {
    if (field === "contentBlocks") {
        if (!Array.isArray(value)) return "—";
        const text = value
            .filter((block) => block.type !== "cta")
            .map((block) => block.text || block.caption || "")
            .filter(Boolean)
            .join(" ");
        return text || `${value.filter((block) => block.type !== "cta").length} article sections`;
    }
    if (Array.isArray(value)) return value.join(", ");
    return String(value || "—");
}

function reviewHeadingForInstruction(instruction) {
    const normalized = String(instruction || "").toLowerCase();
    if (/shorter|shorten|condense|trim/.test(normalized)) return "Aiced Shortened Suggestions";
    if (/longer|expand|more detail|add detail/.test(normalized)) return "Aiced Expansion Suggestions";
    if (/warmer|friendly|conversational|tone/.test(normalized)) return "Aiced Tone Suggestions";
    if (/headline|title/.test(normalized)) return "Aiced Headline Suggestions";
    return "Aiced proposed changes";
}

function makePendingReviewEntries(revision, proposal) {
    const entries = [];
    const add = (section, field, label, original, proposed, payload) => {
        if (proposed === undefined || sameReviewValue(original, proposed)) return;
        entries.push({ id: `${section}-${field}-${entries.length}`, section, field, label, original, proposed, payload, status: "pending" });
    };
    const sourceArticle = proposal.article;
    Object.entries(revision.article || {}).forEach(([field, value]) => add("Article", field, field === "contentBlocks" ? "Article structure" : titleCase(field), sourceArticle[field], value, { article: { [field]: value } }));
    const sourceCta = sourceArticle.contentBlocks.find((block) => block.type === "cta") || {};
    Object.entries(revision.cta || {}).forEach(([field, value]) => add("Call to action", field, titleCase(field), sourceCta[field], value, { cta: { [field]: value } }));
    Object.entries(revision.campaign || {}).forEach(([field, value]) => add("Campaign", field, titleCase(field), proposal.campaign[field], value, { campaign: { [field]: value } }));
    Object.entries(revision.audience || {}).forEach(([field, value]) => add("Audience", field, titleCase(field), proposal.audience[field], value, { audience: { [field]: value } }));
    return entries;
}

function revisionPayload(entries) {
    return entries.reduce((payload, entry) => {
        Object.entries(entry.payload).forEach(([section, updates]) => {
            payload[section] = { ...(payload[section] || {}), ...updates };
        });
        return payload;
    }, {});
}

function workflowPatchPayload(payload) {
    if (!payload?.article?.contentBlocks) return payload;
    const editableBlockTypes = new Set(["heading", "paragraph", "quote"]);
    return {
        ...payload,
        article: {
            ...payload.article,
            // Review comparisons need the complete article. The PATCH endpoint
            // intentionally accepts only Aiced-owned text blocks and restores
            // media plus the unchanged final CTA from the saved article.
            contentBlocks: payload.article.contentBlocks.filter(
                (block) => editableBlockTypes.has(block?.type)
            ),
        },
    };
}

function cloneArticleForRevision(article) {
    return {
        ...article,
        tags: [...(article.tags || [])],
        contentBlocks: (article.contentBlocks || []).map((block) => ({ ...block })),
    };
}

function derivePendingArticleRevision() {
    if (!reviewedProposal?.article) return null;
    const entries = pendingReviewEntries.filter((entry) => entry.status === "pending" && entry.section === "Article");
    if (!entries.length) return null;
    const currentArticle = cloneArticleForRevision(reviewedProposal.article);
    const proposedArticle = cloneArticleForRevision(currentArticle);
    entries.forEach((entry) => { proposedArticle[entry.field] = entry.proposed; });
    return { currentArticle, proposedArticle, changedFields: entries.map((entry) => entry.field), entries };
}

function blockKey(block) { return `${block.type}:${block.text || block.url || ""}`; }

function textTokens(text) {
    return String(text || "").match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
}

function lcsTable(left, right) {
    const table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
        for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
            table[leftIndex][rightIndex] = left[leftIndex] === right[rightIndex]
                ? table[leftIndex + 1][rightIndex + 1] + 1
                : Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
        }
    }
    return table;
}

function wordSimilarity(leftText, rightText) {
    const left = textTokens(leftText).filter((token) => /[\p{L}\p{N}_]/u.test(token)).map((token) => token.toLowerCase());
    const right = textTokens(rightText).filter((token) => /[\p{L}\p{N}_]/u.test(token)).map((token) => token.toLowerCase());
    if (!left.length || !right.length) return 0;
    return lcsTable(left, right)[0][0] / Math.max(left.length, right.length);
}

function matchArticleBlocks(originalBlocks, proposedBlocks) {
    const originalKeys = originalBlocks.map(blockKey);
    const proposedKeys = proposedBlocks.map(blockKey);
    const table = lcsTable(originalKeys, proposedKeys);
    const originalToProposed = new Map();
    const proposedToOriginal = new Map();
    let originalIndex = 0;
    let proposedIndex = 0;
    while (originalIndex < originalKeys.length && proposedIndex < proposedKeys.length) {
        if (originalKeys[originalIndex] === proposedKeys[proposedIndex]) {
            originalToProposed.set(originalIndex, proposedIndex); proposedToOriginal.set(proposedIndex, originalIndex); originalIndex += 1; proposedIndex += 1;
        } else if (table[originalIndex + 1][proposedIndex] >= table[originalIndex][proposedIndex + 1]) originalIndex += 1;
        else proposedIndex += 1;
    }
    const candidates = [];
    originalBlocks.forEach((originalBlock, originalBlockIndex) => {
        if (originalToProposed.has(originalBlockIndex) || !originalBlock.text) return;
        proposedBlocks.forEach((proposedBlock, proposedBlockIndex) => {
            if (proposedToOriginal.has(proposedBlockIndex) || originalBlock.type !== proposedBlock.type || !proposedBlock.text) return;
            const similarity = wordSimilarity(originalBlock.text, proposedBlock.text);
            if (similarity >= 0.35) candidates.push({ originalBlockIndex, proposedBlockIndex, similarity });
        });
    });
    candidates.sort((left, right) => right.similarity - left.similarity);
    candidates.forEach(({ originalBlockIndex, proposedBlockIndex }) => {
        if (!originalToProposed.has(originalBlockIndex) && !proposedToOriginal.has(proposedBlockIndex)) {
            originalToProposed.set(originalBlockIndex, proposedBlockIndex);
            proposedToOriginal.set(proposedBlockIndex, originalBlockIndex);
        }
    });
    return { originalToProposed, proposedToOriginal };
}

function appendWordDiff(element, originalText, proposedText, side) {
    const originalTokens = textTokens(originalText);
    const proposedTokens = textTokens(proposedText);
    const table = lcsTable(originalTokens, proposedTokens);
    const parts = [];
    let originalIndex = 0;
    let proposedIndex = 0;
    while (originalIndex < originalTokens.length || proposedIndex < proposedTokens.length) {
        if (originalIndex < originalTokens.length && proposedIndex < proposedTokens.length && originalTokens[originalIndex] === proposedTokens[proposedIndex]) {
            parts.push({ kind: "unchanged", text: originalTokens[originalIndex] }); originalIndex += 1; proposedIndex += 1;
        } else if (originalIndex < originalTokens.length && (proposedIndex === proposedTokens.length || table[originalIndex + 1][proposedIndex] >= table[originalIndex][proposedIndex + 1])) {
            parts.push({ kind: "removed", text: originalTokens[originalIndex] }); originalIndex += 1;
        } else {
            parts.push({ kind: "added", text: proposedTokens[proposedIndex] }); proposedIndex += 1;
        }
    }
    parts.forEach((part) => {
        if ((side === "original" && part.kind !== "removed") || (side === "revised" && part.kind !== "added")) {
            if (part.kind === "unchanged") element.append(document.createTextNode(part.text));
            return;
        }
        const span = document.createElement("span"); span.className = `aiced-word-diff aiced-word-diff--${part.kind}`; span.textContent = part.text; element.append(span);
    });
}

function appendRevisionBlock(container, block, match, side) {
    const blockType = block.type;
    const element = document.createElement(blockType === "heading" ? "h4" : blockType === "quote" ? "blockquote" : "p");
    const changed = !match;
    element.className = `aiced-revision-article__block${changed ? " is-block-change" : ""}`;
    if (blockType === "image") element.textContent = "Image retained";
    else if (blockType === "youtube") element.textContent = "Video retained";
    else if (blockType === "cta") element.textContent = "Call to action retained";
    else if (match && match.block.text !== block.text) appendWordDiff(element, side === "original" ? block.text : match.block.text, side === "original" ? match.block.text : block.text, side);
    else element.textContent = block.text || "";
    container.append(element);
}

function renderRevisionArticleColumn(container, article, label, statusLabel, changedClass, matches, { showFull, titleChanged, excerptChanged, otherArticle } = {}) {
    const column = document.createElement("section");
    column.className = `aiced-revision-article aiced-revision-article--${changedClass}`;
    const header = document.createElement("header");
    appendTextElement(header, "h3", label);
    appendTextElement(header, "span", statusLabel);
    column.append(header);
    if (showFull || titleChanged) {
        const title = document.createElement("h2"); title.className = `aiced-revision-article__title${titleChanged ? " is-inline-diff" : ""}`;
        if (titleChanged) appendWordDiff(title, changedClass === "original" ? article.title : otherArticle.title, changedClass === "original" ? otherArticle.title : article.title, changedClass);
        else title.textContent = article.title || "Untitled article";
        column.append(title);
    }
    if (article.excerpt && (showFull || excerptChanged)) {
        const excerpt = document.createElement("p"); excerpt.className = `aiced-revision-article__excerpt${excerptChanged ? " is-inline-diff" : ""}`;
        if (excerptChanged) appendWordDiff(excerpt, changedClass === "original" ? article.excerpt : otherArticle.excerpt, changedClass === "original" ? otherArticle.excerpt : article.excerpt, changedClass);
        else excerpt.textContent = article.excerpt;
        column.append(excerpt);
    }
    const content = document.createElement("div"); content.className = "aiced-revision-article__content";
    (article.contentBlocks || []).forEach((block, index) => {
        const matchIndex = matches.get(index);
        const match = Number.isInteger(matchIndex) ? { block: otherArticle.contentBlocks[matchIndex] } : null;
        if (showFull || !match || match.block.text !== block.text) appendRevisionBlock(content, block, match, changedClass);
    });
    if (!content.childNodes.length) {
        appendTextElement(
            content,
            "p",
            changedClass === "revised" ? "No article-body changes were proposed." : "Article body unchanged.",
            "aiced-revision-article__unchanged-note"
        );
    }
    column.append(content);
    container.append(column);
}

function discardPendingRevision() {
    if (isApplyingRevision) return;
    pendingReviewEntries = [];
    pendingArticleRevision = null;
    showFullRevisionComparison = null;
    renderArticleBlocks(reviewedProposal.article.contentBlocks || []);
    syncProposalApprovalState();
    syncRevisionComposer();
    setStatus(reviewStatus, "Changes discarded. Your current article remains unchanged.");
}

async function acceptPendingRevision() {
    if (isApplyingRevision || !pendingReviewEntries.length) return;
    isApplyingRevision = true;
    const entries = pendingReviewEntries.filter((entry) => entry.status === "pending");
    const payload = revisionPayload(entries);
    setStatus(reviewStatus, "Applying Aiced’s proposed changes…");
    try {
        if (!savedWorkflow) {
            applyReviewPayloadLocally(payload);
            pendingReviewEntries = [];
            pendingArticleRevision = null;
            showFullRevisionComparison = null;
            renderLocalRevisionResult("Changes accepted. Your proposal has been updated.");
            return;
        }
        const workflowToken = savedWorkflow.workflowToken;
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(workflowToken)}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workflowPatchPayload(payload)),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not save those changes.");
        pendingReviewEntries = [];
        pendingArticleRevision = null;
        showFullRevisionComparison = null;
        renderProposal(proposal, { resetStep: false });
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Changes accepted and saved.");
        setActiveProposalStep(0);
        setArticleExpanded(true);
    } catch (error) {
        setStatus(reviewStatus, error.message || "Aiced Bot could not apply those changes.", true);
    } finally {
        isApplyingRevision = false;
        renderPendingRevisionReview();
    }
}

function renderPendingRevisionReview() {
    renderArticleBlocks(reviewedProposal?.article?.contentBlocks || []);
}

function appendPendingRevisionActions(panel, { showComparisonToggle = true, showFull = false } = {}) {
    const actions = document.createElement("div"); actions.className = "aiced-change-review__actions";
    if (showComparisonToggle) {
        const comparisonToggle = document.createElement("button"); comparisonToggle.type = "button"; comparisonToggle.className = "aiced-change-review__view-full";
        comparisonToggle.textContent = showFull ? "Show changed sections only" : "View full comparison";
        comparisonToggle.disabled = isApplyingRevision;
        comparisonToggle.addEventListener("click", () => { showFullRevisionComparison = !showFull; renderPendingRevisionReview(); });
        actions.append(comparisonToggle);
    }
    const discard = document.createElement("button"); discard.type = "button"; discard.textContent = "Discard"; discard.className = "is-decline"; discard.disabled = isApplyingRevision; discard.addEventListener("click", discardPendingRevision);
    const accept = document.createElement("button"); accept.type = "button"; accept.textContent = isApplyingRevision ? "Applying…" : "Accept Changes"; accept.className = "is-approve"; accept.disabled = isApplyingRevision; accept.addEventListener("click", acceptPendingRevision);
    actions.append(discard, accept); panel.append(actions);
}

function renderNonArticleRevisionNotice(entries) {
    const panel = document.createElement("aside"); panel.className = "aiced-change-review aiced-change-review--non-article"; panel.setAttribute("aria-label", "Aiced proposed non-article changes");
    const heading = document.createElement("h3"); heading.textContent = "Review changes"; panel.append(heading);
    const sections = [...new Set(entries.map((entry) => entry.section))];
    appendTextElement(panel, "p", `Aiced proposed changes to ${sections.join(", ")}. The article itself is unchanged.`);
    appendPendingRevisionActions(panel, { showComparisonToggle: false });
    articleExpandedLayout.append(panel);
}

function renderArticleBlocks(blocks) {
    articleExpandedLayout.querySelector(":scope > .aiced-change-review")?.remove();
    pendingArticleRevision = derivePendingArticleRevision();
    const pendingEntries = pendingReviewEntries.filter((entry) => entry.status === "pending");
    articleExpandedLayout.classList.toggle("has-change-review", Boolean(pendingArticleRevision));
    articleExpandedLayout.classList.toggle("has-nonarticle-review", !pendingArticleRevision && pendingEntries.length > 0);

    if (pendingEntries.length) {
        articleExpandedLayout.hidden = false;
        articleToggle.setAttribute("aria-expanded", "true");
    }

    if (!pendingArticleRevision) {
        renderNormalArticleBlocks(blocks);
        if (pendingEntries.length) renderNonArticleRevisionNotice(pendingEntries);
        return;
    }

    const { currentArticle: originalArticle, proposedArticle: revisedArticle } = pendingArticleRevision;
    const originalBlocks = originalArticle.contentBlocks || [];
    const revisedBlocks = revisedArticle.contentBlocks || [];
    const { originalToProposed, proposedToOriginal } = matchArticleBlocks(originalBlocks, revisedBlocks);
    const originalChangedCount = originalBlocks.filter((block, index) => {
        const proposedIndex = originalToProposed.get(index);
        return !Number.isInteger(proposedIndex) || revisedBlocks[proposedIndex].text !== block.text;
    }).length;
    const proposedChangedCount = revisedBlocks.filter((block, index) => {
        const originalIndex = proposedToOriginal.get(index);
        return !Number.isInteger(originalIndex) || originalBlocks[originalIndex].text !== block.text;
    }).length;
    const titleChanged = originalArticle.title !== revisedArticle.title;
    const excerptChanged = originalArticle.excerpt !== revisedArticle.excerpt;
    const compactComparison = Math.max(originalChangedCount, proposedChangedCount) <= 1;
    const showFull = showFullRevisionComparison === null ? !compactComparison : showFullRevisionComparison;
    articleContent.replaceChildren();
    renderRevisionArticleColumn(
        articleContent, originalArticle, "Original", "Current", "original", originalToProposed,
        { showFull, titleChanged, excerptChanged, otherArticle: revisedArticle }
    );
    const panel = document.createElement("aside"); panel.className = "aiced-change-review aiced-change-review--side-by-side"; panel.setAttribute("aria-label", "Aiced proposed changes");
    const headingRow = document.createElement("div"); headingRow.className = "aiced-change-review__heading";
    const heading = document.createElement("h3"); heading.textContent = "Review changes"; headingRow.append(heading);
    if (pendingReviewSummary) appendTextElement(headingRow, "p", pendingReviewSummary);
    const pending = document.createElement("span"); pending.className = "aiced-change-review__pending"; pending.textContent = "Pending review"; headingRow.append(pending);
    panel.append(headingRow);
    renderRevisionArticleColumn(
        panel, revisedArticle, "Revised by Aiced", "Proposed", "revised", proposedToOriginal,
        { showFull, titleChanged, excerptChanged, otherArticle: originalArticle }
    );
    appendPendingRevisionActions(panel, { showFull });
    articleExpandedLayout.append(panel);
}

function hasPendingReviewEntries() {
    return pendingReviewEntries.some((entry) => entry.status === "pending");
}

function syncProposalApprovalState() {
    if (approvalState !== "ready") return;
    const hasPendingChanges = hasPendingReviewEntries();
    const isPersistedWorkflow = Boolean(reviewedProposal?.workflow);
    draftOnboarding.hidden = isPersistedWorkflow;
    approveButton.disabled = hasPendingChanges;
    approveButton.textContent = hasPendingChanges ? "Review pending changes" : "Save & Edit Campaign →";
}

function syncRevisionComposer() {
    setRevisionComposerEnabled(
        approvalState === "saved" && !hasPendingReviewEntries()
    );
}

function applyReviewPayloadLocally(payload) {
    if (!reviewedProposal || !payload || typeof payload !== "object") return;
    if (payload.article) Object.assign(reviewedProposal.article, payload.article);
    if (payload.cta) {
        const blocks = reviewedProposal.article.contentBlocks || [];
        const ctaIndex = blocks.findIndex((block) => block.type === "cta");
        if (ctaIndex >= 0) blocks[ctaIndex] = { ...blocks[ctaIndex], ...payload.cta };
    }
    if (payload.campaign) Object.assign(reviewedProposal.campaign, payload.campaign);
    if (payload.audience) Object.assign(reviewedProposal.audience, payload.audience);
}

function renderLocalRevisionResult(status) {
    renderProposal(reviewedProposal, { resetStep: false });
    setActiveProposalStep(0);
    setArticleExpanded(true);
    syncProposalApprovalState();
    syncRevisionComposer();
    renderPendingRevisionReview();
    setStatus(reviewStatus, status);
}

async function savePendingReviewEntry(entry, payload, successStatus) {
    const workflowToken = savedWorkflow.workflowToken;
    const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(workflowToken)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workflowPatchPayload(payload)) });
    const proposal = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not save that change.");
    entry.status = successStatus;
    renderProposal(proposal, { resetStep: false });
    markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, successStatus === "approved" ? "Approved change saved." : "Change reverted.");
    setActiveProposalStep(0);
    setArticleExpanded(true);
}

async function applyPendingReviewEntry(entry) {
    if (!savedWorkflow) {
        applyReviewPayloadLocally(entry.payload);
        entry.status = "approved";
        renderLocalRevisionResult("Accepted change applied to this proposal.");
        return;
    }
    try { await savePendingReviewEntry(entry, entry.payload, "approved"); }
    catch (error) { setStatus(reviewStatus, error.message || "Aiced Bot could not save that change.", true); }
}

async function revertPendingReviewEntry(entry) {
    if (!savedWorkflow) {
        const section = entry.section === "Call to action" ? "cta" : entry.section.toLowerCase();
        applyReviewPayloadLocally({ [section]: { [entry.field]: entry.original } });
        entry.status = "reverted";
        renderLocalRevisionResult("Accepted change reverted from this proposal.");
        return;
    }
    try { await savePendingReviewEntry(entry, { [entry.section === "Call to action" ? "cta" : entry.section.toLowerCase()]: { [entry.field]: entry.original } }, "reverted"); }
    catch (error) { setStatus(reviewStatus, error.message || "Aiced Bot could not revert that change.", true); }
}

function renderArticleOutline(blocks) {
    const container = document.querySelector("#aiced-article-outline");
    container.replaceChildren();
    const headings = blocks.filter((block) => block.type === "heading" && block.text).map((block) => block.text);
    const title = document.createElement("strong");
    title.textContent = "Article sections";
    container.append(title);
    if (!headings.length) {
        const note = document.createElement("p");
        note.textContent = "Review the article content in the full editor.";
        container.append(note);
        return;
    }
    const list = document.createElement("ol");
    headings.forEach((heading) => appendTextElement(list, "li", heading));
    container.append(list);
}

function setArticleExpanded(isExpanded) {
    articleExpandedLayout.hidden = !isExpanded;
    articleToggle.setAttribute("aria-expanded", String(isExpanded));
    articleToggle.replaceChildren(document.createTextNode(isExpanded ? "Close article " : "Read article "));
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = isExpanded ? "↑" : "↓";
    articleToggle.append(arrow);
}

function clearManualEditingUi() {
    document.querySelectorAll(".aiced-card-edit-form").forEach((element) => element.remove());
    document.querySelector("#aiced-cta-preview").hidden = false;
    document.querySelector("#aiced-campaign-summary").hidden = false;
}

function renderProposal(proposal, { resetStep = true } = {}) {
    clearManualEditingUi();
    const { article, campaign, audience } = proposal;
    const contentBlocks = Array.isArray(article.contentBlocks) ? article.contentBlocks : [];
    const cta = contentBlocks.find((block) => block.type === "cta") || {};
    reviewedProposal = proposal;
    campaignDelivery = campaign.delivery || null;
    selectedCampaignRecipientIds = new Set();
    review.classList.toggle("aiced-review--draft", !proposal.workflow || proposal.workflow.status === "draft");
    review.classList.toggle("aiced-review--published", proposal.workflow?.status === "published");
    proposalNavigation.hidden = !isDraftProposal();
    campaignReadyIntro.hidden = true;
    document.querySelector("#aiced-workflow-title").textContent = campaign.name || article.title || "Your new campaign";
    document.querySelector("#aiced-workflow-status").textContent = proposal.workflow?.status === "published" ? "Published" : "Draft · Ready to customize";
    document.querySelector("#aiced-workflow-updated").textContent = proposal.workflow ? "Saved campaign workspace" : "Save & Edit Campaign to unlock editing";
    approvalState = "ready";
    savedWorkflow = null;
    draftOnboarding.hidden = Boolean(proposal.workflow);
    setRevisionComposerEnabled(false);

    document.querySelector("#aiced-article-category").textContent = titleCase(article.category);
    document.querySelector("#aiced-article-title").textContent = article.title;
    document.querySelector("#aiced-article-excerpt").textContent = article.excerpt;
    renderTags(document.querySelector("#aiced-article-tags"), article.tags, "No tags");
    renderFeaturedImage(article);
    renderArticleBlocks(contentBlocks);
    renderArticleOutline(contentBlocks);
    const textBlockCount = contentBlocks.filter((block) => block.type !== "cta").length;
    document.querySelector("#aiced-article-block-count").textContent = `${textBlockCount} article section${textBlockCount === 1 ? "" : "s"}`;
    // A revision review owns the expanded article area.  Do not rebuild its
    // comparison and then immediately hide the containing layout while a
    // saved workflow response is being rendered.
    setArticleExpanded(hasPendingReviewEntries());

    document.querySelector("#aiced-cta-headline").textContent = cta.headline || "Call to action";
    document.querySelector("#aiced-cta-body").textContent = cta.body || "";
    document.querySelector("#aiced-cta-button-label").textContent = cta.buttonLabel || "Learn more";
    document.querySelector("#aiced-cta-action").textContent = titleCase(cta.actionType || "contact");
    document.querySelector("#aiced-cta-intent").textContent = titleCase(cta.intent || "general");

    document.querySelector("#aiced-campaign-name").textContent = campaign.name;
    document.querySelector("#aiced-campaign-subject").textContent = campaign.subject;
    document.querySelector("#aiced-campaign-preheader").textContent = campaign.preheader;
    renderTags(document.querySelector("#aiced-audience-tags"), audience.tags, "All active subscribers");
    document.querySelector("#aiced-audience-rationale").textContent = audience.rationale;
    const count = Number(audience.eligibleRecipientCount) || 0;
    document.querySelector("#aiced-audience-count").textContent = String(count);
    renderAudiencePreview(null);

    document.querySelector("#aiced-email-headline").textContent = article.title;
    document.querySelector("#aiced-email-summary").textContent = article.excerpt;
    document.querySelector("#aiced-email-cta").textContent = cta.buttonLabel || "Learn more";
    const emailFeaturedImage = document.querySelector("#aiced-email-featured-image");
    if (typeof article.featuredImage === "string" && article.featuredImage.startsWith("https://")) {
        emailFeaturedImage.src = article.featuredImage;
        emailFeaturedImage.alt = `${article.title} featured image`;
        emailFeaturedImage.hidden = false;
    } else {
        emailFeaturedImage.removeAttribute("src");
        emailFeaturedImage.alt = "";
        emailFeaturedImage.hidden = true;
    }
    intro.hidden = true;
    review.hidden = false;
    setStatus(reviewStatus, "Draft ready to review. Save & Edit Campaign to unlock editing.");
    approveButton.disabled = false;
    approveButton.textContent = "Save & Edit Campaign →";
    approveButton.hidden = false;
    publishButton.hidden = true;
    sendCampaignButton.hidden = true;
    sendConfirmation.hidden = true;
    liveArticleLink.hidden = true;
    setManualEditingEnabled(false);
    if (resetStep) activeProposalStep = 0;
    setActiveProposalStep(activeProposalStep);
    syncProposalApprovalState();
    syncRevisionComposer();
    requestAnimationFrame(syncRefineComposerExpansion);
    review.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setRevisionComposerEnabled(enabled) {
    refineRequest.disabled = !enabled;
    refineSendButton.disabled = !enabled;
}

function markWorkflowSaved(workflow, summary) {
    savedWorkflow = workflow;
    if (reviewedProposal?.workflow?.status === "published") { setPublishedState(); return; }
    approvalState = "saved";
    draftOnboarding.hidden = true;
    approveButton.hidden = true;
    document.querySelector("#aiced-workflow-status").textContent = "Draft · Editing";
    document.querySelector("#aiced-workflow-updated").textContent = "Editing enabled across Article, CTA, Campaign, and Audience";
    publishButton.disabled = false;
    publishButton.textContent = "Publish Article & Continue";
    setRevisionComposerEnabled(true);
    renderRefineSuggestions();
    setManualEditingEnabled(true);
    renderFeaturedImage(reviewedProposal.article);
    loadAudiencePreview();
    setStatus(reviewStatus, summary || "Draft editing is enabled across the campaign. Publishing remains a separate action.");
    syncBottomActions();
}

function addField(form, label, value, key, multiline = false) {
    const field = document.createElement("label");
    field.className = "aiced-edit-field";
    field.append(document.createTextNode(label));
    const input = document.createElement(multiline ? "textarea" : "input");
    input.name = key;
    input.value = value || "";
    if (!multiline) input.type = "text";
    field.append(input); form.append(field);
}

async function saveManualCard(card, payload, form) {
    if (isManualSaving || !savedWorkflow) return;
    isManualSaving = true;
    form.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not save those changes.");
        const workflowToken = savedWorkflow.workflowToken;
        renderProposal(proposal, { resetStep: false });
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Changes saved.");
    } catch (error) {
        const status = form.querySelector(".aiced-edit-error");
        status.textContent = error.message || "Aiced Bot could not save those changes.";
    } finally { isManualSaving = false; form.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
}

function cancelManualEdit(card, form, preview) {
    form.remove();
    if (preview) preview.hidden = false;
}

function appendEditActions(form, card, preview, submitLabel = "Save Changes") {
    const error = document.createElement("p"); error.className = "aiced-edit-error"; error.setAttribute("aria-live", "polite"); form.append(error);
    const actions = document.createElement("div"); actions.className = "aiced-edit-actions";
    const save = document.createElement("button"); save.type = "submit"; save.textContent = submitLabel; save.className = "aiced-button aiced-button--primary";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Cancel"; cancel.className = "aiced-button aiced-button--quiet";
    cancel.addEventListener("click", () => cancelManualEdit(card, form, preview));
    actions.append(save, cancel); form.append(actions);
}

function beginCtaEdit(card) {
    if (card.querySelector(".aiced-card-edit-form")) return;
    const preview = document.querySelector("#aiced-cta-preview");
    const cta = (reviewedProposal.article.contentBlocks || []).find((block) => block.type === "cta") || {};
    const form = document.createElement("form"); form.className = "aiced-card-edit-form aiced-cta-edit-form";
    addField(form, "CTA headline", cta.headline, "headline");
    addField(form, "Supporting text", cta.body, "body", true);
    addField(form, "Button label", cta.buttonLabel, "buttonLabel");
    appendEditActions(form, card, preview);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const payload = { cta: { headline: values.get("headline"), body: values.get("body"), buttonLabel: values.get("buttonLabel") } };
        Object.keys(payload.cta).forEach((key) => { if (payload.cta[key] === (cta[key] || "")) delete payload.cta[key]; });
        if (!Object.keys(payload.cta).length) { form.querySelector(".aiced-edit-error").textContent = "No changes to save."; return; }
        saveManualCard(card, payload, form);
    });
    preview.hidden = true;
    card.append(form);
    form.querySelector("input").focus();
}

function beginManualEdit(kind) {
    if (approvalState !== "saved" || !savedWorkflow || !reviewedProposal) return;
    const card = document.querySelector(`#aiced-card-${kind}`);
    if (kind === "cta") { beginCtaEdit(card); return; }
    if (card.querySelector(".aiced-card-edit-form")) return;
    const form = document.createElement("form"); form.className = `aiced-card-edit-form aiced-${kind}-edit-form`;
    const article = reviewedProposal.article;
    const blocks = article.contentBlocks || [];
    if (kind === "article") {
        addField(form, "Title", article.title, "title"); addField(form, "SEO summary", article.excerpt, "excerpt", true); addField(form, "Category", article.category, "category"); addField(form, "Tags (comma separated)", (article.tags || []).join(", "), "tags");
        blocks.filter((block) => ["heading", "paragraph", "quote"].includes(block.type)).forEach((block, index) => addField(form, `${titleCase(block.type)} ${index + 1}`, block.text, `block-${index}`, true));
    } else if (kind === "campaign") {
        const helper = document.createElement("p"); helper.className = "aiced-edit-helper"; helper.textContent = "Campaign name is for your internal workspace. Subject and preheader are shown to recipients."; form.append(helper);
        addField(form, "Campaign name", reviewedProposal.campaign.name, "name"); addField(form, "Email subject", reviewedProposal.campaign.subject, "subject"); addField(form, "Preheader", reviewedProposal.campaign.preheader, "preheader", true);
    } else {
        const heading = document.createElement("div"); heading.className = "aiced-audience-edit-form__heading";
        const eyebrow = document.createElement("p"); eyebrow.textContent = "04 / Audience";
        const title = document.createElement("h2"); title.textContent = "Edit Audience";
        const intro = document.createElement("p"); intro.textContent = "Choose tags to narrow your recipients.";
        heading.append(eyebrow, title, intro);
        const layout = document.createElement("div"); layout.className = "aiced-audience-edit-form__layout";
        const filters = document.createElement("section"); filters.className = "aiced-audience-edit-form__filters";
        const filterTitle = document.createElement("h3"); filterTitle.textContent = "Filter by tags";
        const label = document.createElement("p"); label.textContent = "Recipients must match every selected tag.";
        const choices = document.createElement("div"); choices.className = "aiced-edit-tags";
        (reviewedProposal.availableAudienceTags || reviewedProposal.audience.tags || []).forEach((tag) => { const choice = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.name = "audience-tag"; input.value = tag; input.checked = reviewedProposal.audience.tags.includes(tag); choice.append(input, document.createTextNode(tag)); choices.append(choice); });
        const selectedTags = reviewedProposal.audience.tags || [];
        const rule = document.createElement("div"); rule.className = "aiced-audience-edit-form__rule";
        const ruleLabel = document.createElement("span"); ruleLabel.textContent = "Audience rule";
        const ruleTitle = document.createElement("strong"); ruleTitle.textContent = selectedTags.length ? `Match all ${selectedTags.length} tag${selectedTags.length === 1 ? "" : "s"}` : "All active subscribers";
        const ruleText = document.createElement("p"); ruleText.textContent = selectedTags.length ? selectedTags.join(" AND ") : "No tag filters are selected.";
        rule.append(ruleLabel, ruleTitle, ruleText); filters.append(filterTitle, label, choices, rule);
        const matches = document.createElement("section"); matches.className = "aiced-audience-edit-form__matches";
        const matchesLabel = document.createElement("span"); matchesLabel.textContent = "Proposed audience — not saved";
        const matchesCount = document.createElement("strong"); matchesCount.className = "aiced-audience-edit-form__count"; matchesCount.textContent = "—";
        const matchesText = document.createElement("p"); matchesText.className = "aiced-audience-edit-form__matches-message"; matchesText.setAttribute("aria-live", "polite"); matchesText.textContent = "Updating matching recipients…";
        const matchesList = document.createElement("ul"); matchesList.className = "aiced-audience-edit-form__preview-list";
        matches.append(matchesLabel, matchesCount, matchesText, matchesList); layout.append(filters, matches); form.append(heading, layout);
    }
    const preview = kind === "campaign" ? document.querySelector("#aiced-campaign-summary") : null;
    if (preview) preview.hidden = true;
    appendEditActions(form, card, preview);
    form.addEventListener("submit", (event) => { event.preventDefault(); const values = new FormData(form); let payload;
        if (kind === "article") { const editable = blocks.filter((block) => ["heading", "paragraph", "quote"].includes(block.type)); payload = { article: { title: values.get("title"), excerpt: values.get("excerpt"), category: values.get("category"), tags: String(values.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean), contentBlocks: editable.map((block, index) => ({ type: block.type, text: values.get(`block-${index}`) })) } }; }
        else if (kind === "cta") payload = { cta: { headline: values.get("headline"), body: values.get("body"), buttonLabel: values.get("buttonLabel") } };
        else if (kind === "campaign") payload = { campaign: { name: values.get("name"), subject: values.get("subject"), preheader: values.get("preheader") } };
        else payload = { audience: { tags: values.getAll("audience-tag") } };
        const canonical = kind === "article" ? article : kind === "cta" ? (blocks.find((block) => block.type === "cta") || {}) : reviewedProposal[kind];
        const section = payload[kind];
        Object.keys(section).forEach((key) => {
            const previous = key === "contentBlocks"
                ? blocks.filter((block) => ["heading", "paragraph", "quote"].includes(block.type))
                : canonical[key];
            if (JSON.stringify(section[key]) === JSON.stringify(previous)) delete section[key];
        });
        if (!Object.keys(section).length) { form.querySelector(".aiced-edit-error").textContent = "No changes to save."; return; }
        saveManualCard(card, payload, form);
    });
    if (kind === "audience") {
        card.insertBefore(form, card.querySelector(".aiced-audience-overview"));
        form.querySelectorAll('input[name="audience-tag"]').forEach((input) => {
            input.addEventListener("change", () => queueProposedAudiencePreview(form));
        });
        queueProposedAudiencePreview(form, { immediate: true });
    } else card.append(form);
}

async function approveReviewedProposal() {
    if (approvalState !== "ready" || !reviewedProposal) return false;
    if (hasPendingReviewEntries()) {
        setStatus(reviewStatus, "Accept or reject the pending Aiced changes before entering campaign editing.", true);
        syncProposalApprovalState();
        return false;
    }

    approvalState = "saving";
    approveButton.disabled = true;
    approveButton.textContent = "Preparing draft…";
    setStatus(reviewStatus, "Preparing draft…");

    try {
        const response = await fetch("/api/aiced/article-campaign-handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reviewedProposal),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Number.isInteger(result.postId) || !result.workflowToken) {
            throw new Error(result.message || "Aiced Bot could not save this work. Please try again.");
        }

        if (Array.isArray(result.availableAudienceTags)) reviewedProposal.availableAudienceTags = result.availableAudienceTags;
        markWorkflowSaved({ postId: result.postId, workflowToken: result.workflowToken });
        window.history.replaceState({}, "", `/aiced?workflow=${encodeURIComponent(result.workflowToken)}`);
        return true;
    } catch (error) {
        approvalState = "ready";
        syncProposalApprovalState();
        setStatus(reviewStatus, error.message || "Aiced Bot could not save this work. Please try again.", true);
        return false;
    }
}

async function submitRevision() {
    if (isRevising || !reviewedProposal || !["ready", "saved"].includes(approvalState)) return;
    if (hasPendingReviewEntries()) {
        setStatus(reviewStatus, "Review or decline the current Aiced changes before requesting another revision.", true);
        return;
    }
    const instruction = refineRequest.value.trim();
    if (!instruction) {
        setStatus(reviewStatus, "Tell Aiced what you would like to change.", true);
        refineRequest.focus();
        return;
    }
    isRevising = true;
    refineRequest.disabled = true;
    refineSendButton.disabled = true;
    refineSendButton.textContent = "…";
    setStatus(reviewStatus, "Aiced Bot is preparing changes for your review…");
    try {
        const isUnapprovedProposal = approvalState === "ready" && !savedWorkflow;
        const response = await fetch(
            isUnapprovedProposal
                ? "/api/aiced/marketing-package/revisions"
                : `/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/revisions`,
            {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
                isUnapprovedProposal
                    ? { instruction, proposal: reviewedProposal }
                    : { instruction, preview: true }
            ),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok || !proposal.article || !proposal.campaign || !proposal.audience || !proposal.revision) {
            const reference = proposal.referenceId ? ` Reference: ${proposal.referenceId}` : "";
            throw new Error(`${proposal.message || "Aiced Bot could not complete that revision."}${reference}`);
        }
        pendingReviewEntries = makePendingReviewEntries(proposal.revision, proposal);
        pendingArticleRevision = null;
        showFullRevisionComparison = null;
        pendingReviewHeading = reviewHeadingForInstruction(instruction);
        pendingReviewSummary = proposal.summary || "";
        if (!pendingReviewEntries.length) throw new Error("Aiced Bot did not produce a visible change. Try a more specific request.");
        if (isUnapprovedProposal) {
            pendingReviewEntries.forEach((entry) => { entry.status = "pending"; });
            setActiveProposalStep(0);
            setArticleExpanded(true);
            syncProposalApprovalState();
            renderPendingRevisionReview();
            refineRequest.value = "";
            setStatus(reviewStatus, "Revision ready. Accept or reject each proposed change before approving the article.");
            return;
        }
        const workflowToken = savedWorkflow.workflowToken;
        renderProposal(proposal, { resetStep: false });
        setActiveProposalStep(0);
        setArticleExpanded(true);
        renderPendingRevisionReview();
        refineRequest.value = "";
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, proposal.summary || "Aiced proposed changes for your review.");
    } catch (error) {
        setStatus(reviewStatus, error.message || "Aiced Bot could not complete that revision.", true);
    } finally {
        isRevising = false;
        refineSendButton.textContent = "↑";
        syncRevisionComposer();
    }
}

async function publishArticleAndContinue() {
    if (approvalState !== "saved" || !savedWorkflow) return;
    publishButton.disabled = true; publishButton.textContent = "Publishing…";
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/publish`, { method: "POST" });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not publish this article.");
        const workflowToken = savedWorkflow.workflowToken;
        renderProposal(proposal); markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken });
    } catch (error) { publishButton.disabled = false; publishButton.textContent = "Publish Article & Continue"; setStatus(reviewStatus, error.message || "Aiced Bot could not publish this article.", true); }
}

async function generatePackage() {
    if (isGenerating) return;
    const prompt = generationRequest.value.trim();
    if (!prompt) {
        setStatus(generationStatus, "Tell Aiced what you would like to create.", true);
        generationRequest.focus();
        return;
    }

    isGenerating = true;
    generateButton.disabled = true;
    generateButton.textContent = "Aiced is creating…";
    setStatus(generationStatus, "Aiced Bot is preparing your article, campaign, and audience recommendation.");
    try {
        const response = await fetch("/api/aiced/marketing-package", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request: prompt }),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok || !proposal.article || !proposal.campaign || !proposal.audience || !Array.isArray(proposal.article.contentBlocks)) {
            const reference = proposal.referenceId ? ` Reference: ${proposal.referenceId}` : "";
            throw new Error(`${proposal.message || "Aiced Bot could not create a package. Please try again."}${reference}`);
        }
        pendingReviewEntries = [];
        pendingArticleRevision = null;
        pendingReviewHeading = "Aiced proposed changes";
        pendingReviewSummary = "";
        renderProposal(proposal);
    } catch (error) {
        setStatus(generationStatus, error.message || "Aiced Bot could not create a package. Please try again.", true);
    } finally {
        isGenerating = false;
        generateButton.disabled = false;
        generateButton.textContent = "Create →";
    }
}

function setGenerationControlsDisabled(disabled) {
    generationRequest.disabled = disabled;
    generateButton.disabled = disabled;
    document.querySelectorAll("[data-prompt-suggestion]").forEach((button) => {
        button.disabled = disabled;
    });
}

async function restoreWorkflowFromUrl() {
    const workflowToken = new URLSearchParams(window.location.search).get("workflow");
    if (!workflowToken) return;

    review.hidden = true;
    intro.hidden = false;
    restoreStartNewButton.hidden = true;
    setGenerationControlsDisabled(true);
    setStatus(generationStatus, "Restoring your saved Aiced work…");

    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(workflowToken)}`);
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok || !proposal.workflow || !proposal.article || !proposal.campaign || !proposal.audience) {
            throw new Error(proposal.message || "This Aiced workflow is unavailable.");
        }

        renderProposal(proposal);
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken });
    } catch (error) {
        setStatus(generationStatus, error.message || "This Aiced workflow is unavailable.", true);
        restoreStartNewButton.hidden = false;
    } finally {
        document.documentElement.classList.remove("aiced-workflow-restoring");
        setGenerationControlsDisabled(false);
    }
}

function resetWorkspace() {
    review.hidden = true;
    intro.hidden = false;
    generationRequest.value = "";
    reviewedProposal = null;
    approvalState = "idle";
    savedWorkflow = null;
    isRevising = false;
    isApplyingRevision = false;
    campaignDelivery = null;
    selectedCampaignRecipientIds = new Set();
    activeProposalStep = 0;
    refineComposerExpanded = false;
    pendingReviewEntries = [];
    pendingArticleRevision = null;
    pendingReviewHeading = "Aiced proposed changes";
    pendingReviewSummary = "";
    showFullRevisionComparison = null;
    review.classList.remove("aiced-review--draft", "aiced-review--published");
    proposalNavigation.hidden = false;
    campaignReadyIntro.hidden = true;
    draftOnboarding.hidden = true;
    approveButton.disabled = true;
    approveButton.textContent = "Save & Edit Campaign →";
    approveButton.hidden = false;
    publishButton.hidden = true;
    reviewActions.hidden = true;
    sendCampaignButton.hidden = true;
    sendConfirmation.hidden = true;
    liveArticleLink.hidden = true;
    setRevisionComposerEnabled(false);
    setManualEditingEnabled(false);
    restoreStartNewButton.hidden = true;
    setStatus(generationStatus, "");
    setStatus(reviewStatus, "");
    generationRequest.focus();
    sidebar.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    window.history.replaceState({}, "", "/aiced");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

generationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    generatePackage();
});

generationRequest.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        generationForm.requestSubmit();
    }
});

document.querySelectorAll("[data-prompt-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
        generationRequest.value = button.dataset.promptSuggestion;
        generationRequest.focus();
    });
});

newButtons.forEach((button) => button.addEventListener("click", resetWorkspace));
articleToggle.addEventListener("click", () => {
    setArticleExpanded(articleExpandedLayout.hidden);
});
approveButton.addEventListener("click", approveReviewedProposal);
publishButton.addEventListener("click", publishArticleAndContinue);
sendCampaignButton.addEventListener("click", prepareCampaign);
removeRecipientsButton.addEventListener("click", removeSelectedCampaignRecipients);
sendCancelButton.addEventListener("click", () => { sendConfirmation.hidden = true; });
sendConfirmButton.addEventListener("click", sendPreparedCampaign);
document.querySelectorAll("[data-card-edit]").forEach((button) => {
    button.addEventListener("click", () => beginManualEdit(button.dataset.cardEdit));
});
proposalStepButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveProposalStep(button.dataset.proposalStep, { focus: true }));
});
proposalPreviousButtons.forEach((button) => button.addEventListener("click", () => setActiveProposalStep(activeProposalStep - 1, { focus: true })));
proposalNextButtons.forEach((button) => button.addEventListener("click", () => setActiveProposalStep(activeProposalStep + 1, { focus: true })));
refineSendButton.addEventListener("click", submitRevision);
refineRequest.addEventListener("input", resizeRefineComposer);
refineRequest.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitRevision();
    }
});
window.addEventListener("scroll", syncRefineComposerExpansion, { passive: true });
window.addEventListener("resize", syncRefineComposerExpansion);
restoreStartNewButton.addEventListener("click", resetWorkspace);
menuButton.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
});
if (sidebarCollapseButton) {
    const collapsed = sessionStorage.getItem("aicedWorkspaceSidebarCollapsed") === "true";
    document.querySelector(".aiced-shell").classList.toggle("is-sidebar-collapsed", collapsed);
    sidebarCollapseButton.setAttribute("aria-expanded", String(!collapsed));
    sidebarCollapseButton.textContent = collapsed ? "›" : "‹";
    sidebarCollapseButton.addEventListener("click", () => {
        const shell = document.querySelector(".aiced-shell");
        const isCollapsed = shell.classList.toggle("is-sidebar-collapsed");
        sidebarCollapseButton.setAttribute("aria-expanded", String(!isCollapsed));
        sidebarCollapseButton.textContent = isCollapsed ? "›" : "‹";
        sessionStorage.setItem("aicedWorkspaceSidebarCollapsed", String(isCollapsed));
    });
}

restoreWorkflowFromUrl();
