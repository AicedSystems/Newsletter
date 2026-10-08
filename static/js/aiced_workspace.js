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
const articleContent = document.querySelector("#aiced-article-content");
const articleExpandedLayout = document.querySelector("#aiced-article-expanded-layout");
const articleToggle = document.querySelector("#aiced-article-toggle");
const approveButton = document.querySelector("#aiced-approve-button");
const restoreStartNewButton = document.querySelector("#aiced-restore-start-new");
const refineRequest = document.querySelector("#aiced-refine-request");
const refineSendButton = document.querySelector("#aiced-refine-send");
const publishButton = document.querySelector("#aiced-publish-button");
const liveArticleLink = document.querySelector("#aiced-live-article");
const sendCampaignButton = document.querySelector("#aiced-send-campaign-button");
const sendConfirmation = document.querySelector("#aiced-send-confirmation");
const sendConfirmationSummary = document.querySelector("#aiced-send-confirmation-summary");
const sendRecipientList = document.querySelector("#aiced-send-recipient-list");
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

let isGenerating = false;
let reviewedProposal = null;
let approvalState = "idle";
let savedWorkflow = null;
let isRevising = false;
let isManualSaving = false;
let isCampaignProcessing = false;
let campaignDelivery = null;
let activeProposalStep = 0;
let refineComposerExpanded = false;
let pendingReviewEntries = [];
let pendingReviewHeading = "Aiced proposed changes";
let pendingReviewSummary = "";

const proposalSteps = [
    { label: "Article", next: "Call to Action", placeholder: "Ask Aiced to rewrite, expand, or refine your article…", prompts: [["Make it shorter", "Make the article shorter while keeping the important details."], ["More conversational", "Make the article more conversational and approachable."], ["Improve the headline", "Improve the article headline for clarity and interest."], ["Add more detail", "Add more useful detail to the article."], ["Change the tone", "Make the article warmer and more welcoming."]] },
    { label: "Call to Action", next: "Campaign Details", placeholder: "Ask Aiced to improve your call to action…", prompts: [["Make it softer", "Make the call to action softer and less salesy."], ["Make it more direct", "Make the call to action more direct."], ["Change the button text", "Rewrite the call-to-action button text."], ["Less salesy", "Make the call to action feel less salesy."]] },
    { label: "Campaign Details", next: "Audience", placeholder: "Ask Aiced to improve your subject or preheader…", prompts: [["Shorter subject", "Make the campaign subject shorter."], ["More curiosity", "Make the campaign subject more curiosity-driven."], ["Warmer tone", "Make the campaign copy warmer."], ["Rewrite the preheader", "Rewrite the campaign preheader."]] },
    { label: "Audience", next: "Email Preview", placeholder: "Ask Aiced to refine your campaign audience…", prompts: [["Explain this audience", "Explain why this audience is a good fit."], ["Narrow the audience", "Narrow the campaign audience to the most relevant existing tags."], ["Change the audience", "Suggest a different audience using only existing tags."]] },
    { label: "Email Preview", next: null, placeholder: "Ask Aiced to improve your email campaign…", prompts: [["Improve the subject", "Improve the email subject line."], ["Make it warmer", "Make the email campaign warmer."], ["More concise", "Make the email campaign more concise."]] },
];

function isDraftProposal() {
    return !reviewedProposal?.workflow || reviewedProposal.workflow.status === "draft";
}

function renderRefineSuggestions() {
    refineSuggestions.replaceChildren();
    const step = proposalSteps[activeProposalStep];
    step.prompts.forEach(([label, prompt]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
            refineRequest.value = prompt;
            resizeRefineComposer();
            refineRequest.focus();
        });
        refineSuggestions.append(button);
    });
}

function setActiveProposalStep(nextStep, { focus = false } = {}) {
    activeProposalStep = Math.max(0, Math.min(proposalSteps.length - 1, Number(nextStep) || 0));
    const draft = isDraftProposal();
    proposalPanels.forEach((panel, index) => { panel.hidden = draft && index !== activeProposalStep; });
    proposalStepButtons.forEach((button, index) => {
        const active = index === activeProposalStep;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "step" : "false");
        if (active && focus) button.focus();
    });
    proposalPosition.textContent = `${String(activeProposalStep + 1).padStart(2, "0")} / 05`;
    proposalPreviousButtons.forEach((button) => { button.disabled = activeProposalStep === 0; });
    proposalNextButtons.forEach((button) => { button.disabled = activeProposalStep === proposalSteps.length - 1; });
    proposalNextButton.textContent = activeProposalStep === proposalSteps.length - 1 ? "Review complete" : `Next: ${proposalSteps[activeProposalStep].next} →`;
    refineRequest.placeholder = proposalSteps[activeProposalStep].placeholder;
    renderRefineSuggestions();
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
    document.querySelectorAll("[data-card-edit]").forEach((button) => { button.disabled = !enabled; });
    const fullEditor = document.querySelector("#aiced-article-full-editor");
    fullEditor.hidden = !enabled;
    fullEditor.href = enabled ? `/posts/new/build?edit=${savedWorkflow.postId}&workflow=${encodeURIComponent(savedWorkflow.workflowToken)}` : "";
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
    approveButton.hidden = true;
    publishButton.hidden = true;
    setRevisionComposerEnabled(false);
    setManualEditingEnabled(false);
    review.classList.remove("aiced-review--draft");
    review.classList.add("aiced-review--published");
    proposalNavigation.hidden = true;
    proposalPanels.forEach((panel) => { panel.hidden = false; });
    const path = reviewedProposal.article.publicArticlePath;
    liveArticleLink.hidden = !path; liveArticleLink.href = path || "";
    setStatus(reviewStatus, "Article published — campaign review is ready.");
    loadPublishedEmailPreview();
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
    sendRecipientList.replaceChildren();
    (delivery?.recipients || []).forEach((recipient) => {
        const item = document.createElement("li");
        item.textContent = `${recipient.name || "Subscriber"} — ${recipient.email || "hidden"}`;
        sendRecipientList.append(item);
    });
    sendConfirmButton.textContent = `Send to ${count} recipient${count === 1 ? "" : "s"}`;
    sendConfirmation.hidden = false;
}

function syncCampaignControls() {
    if (approvalState !== "published") return;
    sendCampaignButton.hidden = false;
    if (!campaignDelivery) {
        sendCampaignButton.disabled = false;
        sendCampaignButton.textContent = "Send Campaign";
        return;
    }
    if (campaignDelivery.status === "sent") {
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
    renderSendConfirmation(campaignDelivery);
}

async function prepareCampaign() {
    if (isCampaignProcessing || !savedWorkflow) return;
    if (campaignDelivery?.status === "draft") { renderSendConfirmation(campaignDelivery); return; }
    isCampaignProcessing = true;
    sendCampaignButton.disabled = true;
    sendCampaignButton.textContent = "Preparing…";
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/campaign/prepare`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.campaign) throw new Error(result.message || "Campaign could not be prepared.");
        campaignDelivery = { ...result.campaign, recipients: result.recipients || result.campaign.recipients || [] };
        reviewedProposal.campaign.delivery = campaignDelivery;
        renderSendConfirmation(campaignDelivery);
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
    const generate = document.createElement("button"); generate.type = "button"; generate.textContent = article.featuredImage ? "✨ Regenerate" : "✨ Generate with Aiced"; generate.disabled = approvalState !== "saved"; generate.addEventListener("click", generateFeaturedImage);
    const upload = document.createElement("button"); upload.type = "button"; upload.textContent = article.featuredImage ? "Upload" : "Upload Image"; upload.disabled = approvalState !== "saved"; upload.addEventListener("click", () => container.querySelector("input[type=file]").click());
    actions.append(generate, upload);
    if (article.featuredImage) { const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove"; remove.disabled = approvalState !== "saved"; remove.addEventListener("click", () => saveFeaturedImage(null)); actions.append(remove); }
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

function renderArticleBlocks(blocks) {
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
    renderPendingRevisionReview();
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

function renderPendingRevisionReview() {
    const reviewSlot = document.querySelector(".aiced-article-change-review-slot");
    if (!reviewSlot) return;
    reviewSlot.querySelector(".aiced-change-review")?.remove();
    articleExpandedLayout.classList.toggle("has-change-review", pendingReviewEntries.length > 0);
    if (!pendingReviewEntries.length) return;
    const panel = document.createElement("aside"); panel.className = "aiced-change-review"; panel.setAttribute("aria-label", "Aiced proposed changes");
    const headingRow = document.createElement("div"); headingRow.className = "aiced-change-review__heading";
    const heading = document.createElement("h3"); heading.textContent = pendingReviewHeading; headingRow.append(heading);
    if (pendingReviewSummary) appendTextElement(headingRow, "p", pendingReviewSummary);
    panel.append(headingRow);
    pendingReviewEntries.forEach((entry) => {
        const card = document.createElement("section"); card.className = `aiced-change-review__item is-${entry.status}`;
        appendTextElement(card, "strong", `${entry.section} · ${entry.label}`);
        const comparison = document.createElement("div"); comparison.className = "aiced-change-review__comparison";
        const before = document.createElement("p"); before.className = "aiced-change-review__before";
        appendTextElement(before, "span", "Before"); before.append(document.createTextNode(reviewValue(entry.original, entry.field)));
        const update = document.createElement("p"); update.className = "aiced-change-review__update";
        appendTextElement(update, "span", "Aiced update"); update.append(document.createTextNode(reviewValue(entry.proposed, entry.field)));
        comparison.append(before, update);
        card.append(comparison);
        const comparisonText = `${reviewValue(entry.original, entry.field)} ${reviewValue(entry.proposed, entry.field)}`;
        if (comparisonText.length > 150) {
            comparison.classList.add("is-collapsed");
            const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "aiced-change-review__toggle"; toggle.textContent = "Show more";
            toggle.addEventListener("click", () => {
                const expanded = comparison.classList.toggle("is-expanded");
                comparison.classList.toggle("is-collapsed", !expanded);
                toggle.textContent = expanded ? "Show less" : "Show more";
            });
            card.append(toggle);
        }
        const actions = document.createElement("div"); actions.className = "aiced-change-review__actions";
        if (entry.status === "pending") {
            const approve = document.createElement("button"); approve.type = "button"; approve.textContent = "Approve"; approve.className = "is-approve"; approve.addEventListener("click", () => applyPendingReviewEntry(entry));
            const decline = document.createElement("button"); decline.type = "button"; decline.textContent = "Decline"; decline.className = "is-decline"; decline.addEventListener("click", () => { entry.status = "declined"; renderPendingRevisionReview(); });
            actions.append(approve, decline);
        } else if (entry.status === "approved") {
            const revert = document.createElement("button"); revert.type = "button"; revert.textContent = "Revert"; revert.addEventListener("click", () => revertPendingReviewEntry(entry)); actions.append(revert);
        } else if (entry.status === "declined") {
            const reconsider = document.createElement("button"); reconsider.type = "button"; reconsider.textContent = "Reconsider"; reconsider.addEventListener("click", () => { entry.status = "pending"; renderPendingRevisionReview(); }); actions.append(reconsider);
        }
        card.append(actions); panel.append(card);
    });
    reviewSlot.append(panel);
}

async function savePendingReviewEntry(entry, payload, successStatus) {
    const workflowToken = savedWorkflow.workflowToken;
    const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(workflowToken)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const proposal = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not save that change.");
    entry.status = successStatus;
    renderProposal(proposal, { resetStep: false });
    markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, successStatus === "approved" ? "Approved change saved." : "Change reverted.");
    setActiveProposalStep(0);
    setArticleExpanded(true);
}

async function applyPendingReviewEntry(entry) {
    try { await savePendingReviewEntry(entry, entry.payload, "approved"); }
    catch (error) { setStatus(reviewStatus, error.message || "Aiced Bot could not save that change.", true); }
}

async function revertPendingReviewEntry(entry) {
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

function renderProposal(proposal, { resetStep = true } = {}) {
    const { article, campaign, audience } = proposal;
    const contentBlocks = Array.isArray(article.contentBlocks) ? article.contentBlocks : [];
    const cta = contentBlocks.find((block) => block.type === "cta") || {};
    reviewedProposal = proposal;
    campaignDelivery = campaign.delivery || null;
    review.classList.toggle("aiced-review--draft", !proposal.workflow || proposal.workflow.status === "draft");
    review.classList.toggle("aiced-review--published", proposal.workflow?.status === "published");
    proposalNavigation.hidden = !isDraftProposal();
    document.querySelector("#aiced-workflow-title").textContent = campaign.name || article.title || "Your new campaign";
    document.querySelector("#aiced-workflow-status").textContent = proposal.workflow?.status === "published" ? "Published" : "Draft";
    document.querySelector("#aiced-workflow-updated").textContent = proposal.workflow ? "Saved campaign workspace" : "Ready to review";
    approvalState = "ready";
    savedWorkflow = null;
    setRevisionComposerEnabled(true);

    document.querySelector("#aiced-article-category").textContent = titleCase(article.category);
    document.querySelector("#aiced-article-title").textContent = article.title;
    document.querySelector("#aiced-article-excerpt").textContent = article.excerpt;
    renderTags(document.querySelector("#aiced-article-tags"), article.tags, "No tags");
    renderFeaturedImage(article);
    renderArticleBlocks(contentBlocks);
    renderArticleOutline(contentBlocks);
    const textBlockCount = contentBlocks.filter((block) => block.type !== "cta").length;
    document.querySelector("#aiced-article-block-count").textContent = `${textBlockCount} article section${textBlockCount === 1 ? "" : "s"}`;
    setArticleExpanded(false);

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
    document.querySelector("#aiced-audience-count").textContent = `${count} eligible active recipient${count === 1 ? "" : "s"}`;

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
    setStatus(reviewStatus, "Proposal ready to review.");
    approveButton.disabled = false;
    approveButton.textContent = "Approve & Continue →";
    approveButton.hidden = false;
    publishButton.hidden = true;
    sendCampaignButton.hidden = true;
    sendConfirmation.hidden = true;
    liveArticleLink.hidden = true;
    setManualEditingEnabled(false);
    if (resetStep) activeProposalStep = 0;
    setActiveProposalStep(activeProposalStep);
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
    approveButton.disabled = true;
    approveButton.textContent = "Saved";
    publishButton.hidden = false;
    publishButton.disabled = false;
    publishButton.textContent = "Publish Article & Continue";
    setRevisionComposerEnabled(true);
    setManualEditingEnabled(true);
    renderFeaturedImage(reviewedProposal.article);
    setStatus(reviewStatus, summary || "Saved — your article draft and campaign setup are ready.");
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

function setInlineCtaFieldsEditable(card, editable) {
    ["#aiced-cta-headline", "#aiced-cta-body", "#aiced-cta-button-label"].forEach((selector) => {
        const field = card.querySelector(selector);
        field.contentEditable = String(editable);
        field.classList.toggle("is-inline-editable", editable);
        if (editable) {
            field.setAttribute("role", "textbox");
            field.setAttribute("aria-label", selector === "#aiced-cta-headline" ? "Call to action headline" : selector === "#aiced-cta-body" ? "Call to action body" : "Call to action button label");
        } else {
            field.removeAttribute("role");
            field.removeAttribute("aria-label");
        }
    });
}

function cancelInlineCtaEdit() {
    renderProposal(reviewedProposal, { resetStep: false });
    markWorkflowSaved(savedWorkflow);
}

async function saveInlineCtaEdit(card) {
    if (isManualSaving || !savedWorkflow || !reviewedProposal) return;
    const cta = (reviewedProposal.article.contentBlocks || []).find((block) => block.type === "cta") || {};
    const payload = {
        cta: {
            headline: card.querySelector("#aiced-cta-headline").textContent.trim(),
            body: card.querySelector("#aiced-cta-body").textContent.trim(),
            buttonLabel: card.querySelector("#aiced-cta-button-label").textContent.trim(),
        },
    };
    Object.keys(payload.cta).forEach((key) => { if (payload.cta[key] === (cta[key] || "")) delete payload.cta[key]; });
    const status = card.querySelector(".aiced-inline-edit-error");
    if (!Object.keys(payload.cta).length) { status.textContent = "No changes to save."; return; }

    isManualSaving = true;
    const editButton = card.querySelector('[data-card-edit="cta"]');
    editButton.disabled = true; editButton.textContent = "Saving…";
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not save those changes.");
        const workflowToken = savedWorkflow.workflowToken;
        renderProposal(proposal, { resetStep: false });
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Changes saved.");
    } catch (error) {
        status.textContent = error.message || "Aiced Bot could not save those changes.";
        editButton.disabled = false; editButton.textContent = "Save changes";
    } finally { isManualSaving = false; }
}

function beginInlineCtaEdit(card) {
    const editButton = card.querySelector('[data-card-edit="cta"]');
    if (card.dataset.inlineEditing === "true") { saveInlineCtaEdit(card); return; }
    card.dataset.inlineEditing = "true";
    setInlineCtaFieldsEditable(card, true);
    editButton.textContent = "Save changes";
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.className = "aiced-card-edit aiced-inline-edit-cancel"; cancel.textContent = "Cancel";
    cancel.addEventListener("click", cancelInlineCtaEdit);
    editButton.after(cancel);
    const status = document.createElement("p"); status.className = "aiced-inline-edit-error"; status.setAttribute("aria-live", "polite"); card.append(status);
    card.querySelector("#aiced-cta-headline").focus();
}

function beginManualEdit(kind) {
    if (approvalState !== "saved" || !savedWorkflow || !reviewedProposal) return;
    const card = document.querySelector(`#aiced-card-${kind}`);
    if (kind === "cta") { beginInlineCtaEdit(card); return; }
    if (card.querySelector(".aiced-card-edit-form")) return;
    const form = document.createElement("form"); form.className = "aiced-card-edit-form";
    const article = reviewedProposal.article;
    const blocks = article.contentBlocks || [];
    if (kind === "article") {
        addField(form, "Title", article.title, "title"); addField(form, "SEO summary", article.excerpt, "excerpt", true); addField(form, "Category", article.category, "category"); addField(form, "Tags (comma separated)", (article.tags || []).join(", "), "tags");
        blocks.filter((block) => ["heading", "paragraph", "quote"].includes(block.type)).forEach((block, index) => addField(form, `${titleCase(block.type)} ${index + 1}`, block.text, `block-${index}`, true));
    } else if (kind === "cta") {
        const cta = blocks.find((block) => block.type === "cta") || {}; addField(form, "Headline", cta.headline, "headline"); addField(form, "Body", cta.body, "body", true); addField(form, "Button label", cta.buttonLabel, "buttonLabel");
    } else if (kind === "campaign") {
        addField(form, "Campaign name", reviewedProposal.campaign.name, "name"); addField(form, "Subject", reviewedProposal.campaign.subject, "subject"); addField(form, "Preheader", reviewedProposal.campaign.preheader, "preheader", true);
    } else {
        const label = document.createElement("p"); label.textContent = "Choose existing audience tags. Every selected tag is required."; form.append(label);
        const choices = document.createElement("div"); choices.className = "aiced-edit-tags";
        (reviewedProposal.availableAudienceTags || reviewedProposal.audience.tags || []).forEach((tag) => { const choice = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.name = "audience-tag"; input.value = tag; input.checked = reviewedProposal.audience.tags.includes(tag); choice.append(input, document.createTextNode(tag)); choices.append(choice); }); form.append(choices);
    }
    const error = document.createElement("p"); error.className = "aiced-edit-error"; form.append(error);
    const actions = document.createElement("div"); actions.className = "aiced-edit-actions";
    const save = document.createElement("button"); save.type = "submit"; save.textContent = "Save"; save.className = "aiced-button aiced-button--primary";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Cancel"; cancel.className = "aiced-button aiced-button--quiet"; cancel.addEventListener("click", () => { renderProposal(reviewedProposal, { resetStep: false }); markWorkflowSaved(savedWorkflow); });
    actions.append(save, cancel); form.append(actions);
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
    card.append(form);
}

async function approveReviewedProposal() {
    if (approvalState !== "ready" || !reviewedProposal) return false;

    approvalState = "saving";
    approveButton.disabled = true;
    approveButton.textContent = "Saving…";
    setStatus(reviewStatus, "Saving your article draft and campaign setup…");

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
        approveButton.disabled = false;
        approveButton.textContent = "Approve & Continue →";
        setStatus(reviewStatus, error.message || "Aiced Bot could not save this work. Please try again.", true);
        return false;
    }
}

async function submitRevision() {
    if (isRevising || !reviewedProposal || !["ready", "saved"].includes(approvalState)) return;
    if (pendingReviewEntries.some((entry) => entry.status === "pending")) {
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
    if (approvalState === "ready") {
        setStatus(reviewStatus, "Saving your reviewed draft before Aiced updates it…");
        const saved = await approveReviewedProposal();
        if (!saved) {
            isRevising = false;
            setRevisionComposerEnabled(approvalState === "ready" || approvalState === "saved");
            refineSendButton.textContent = "↑";
            return;
        }
    }
    if (approvalState !== "saved" || !savedWorkflow) {
        isRevising = false;
        setRevisionComposerEnabled(false);
        refineSendButton.textContent = "↑";
        return;
    }
    setStatus(reviewStatus, "Aiced Bot is preparing changes for your review…");
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/revisions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instruction, preview: true }),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok || !proposal.workflow || !proposal.article || !proposal.campaign || !proposal.audience || !proposal.revision) {
            const reference = proposal.referenceId ? ` Reference: ${proposal.referenceId}` : "";
            throw new Error(`${proposal.message || "Aiced Bot could not complete that revision."}${reference}`);
        }
        const workflowToken = savedWorkflow.workflowToken;
        renderProposal(proposal, { resetStep: false });
        pendingReviewEntries = makePendingReviewEntries(proposal.revision, proposal);
        pendingReviewHeading = reviewHeadingForInstruction(instruction);
        pendingReviewSummary = proposal.summary || "";
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
        setRevisionComposerEnabled(approvalState === "saved");
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
    campaignDelivery = null;
    activeProposalStep = 0;
    refineComposerExpanded = false;
    pendingReviewEntries = [];
    pendingReviewHeading = "Aiced proposed changes";
    pendingReviewSummary = "";
    review.classList.remove("aiced-review--draft", "aiced-review--published");
    proposalNavigation.hidden = false;
    approveButton.disabled = true;
    approveButton.textContent = "Approve & Continue →";
    approveButton.hidden = false;
    publishButton.hidden = true;
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

restoreWorkflowFromUrl();
