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
const articleToggle = document.querySelector("#aiced-article-toggle");
const approveButton = document.querySelector("#aiced-approve-button");
const restoreStartNewButton = document.querySelector("#aiced-restore-start-new");
const refineRequest = document.querySelector("#aiced-refine-request");
const refineSendButton = document.querySelector("#aiced-refine-send");

let isGenerating = false;
let reviewedProposal = null;
let approvalState = "idle";
let savedWorkflow = null;
let isRevising = false;
let isManualSaving = false;

function setManualEditingEnabled(enabled) {
    document.querySelectorAll("[data-card-edit]").forEach((button) => { button.disabled = !enabled; });
    const fullEditor = document.querySelector("#aiced-article-full-editor");
    fullEditor.hidden = !enabled;
    fullEditor.href = enabled ? `/posts/new/build?edit=${savedWorkflow.postId}&workflow=${encodeURIComponent(savedWorkflow.workflowToken)}` : "";
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
    if (article.featuredImage) { const image = document.createElement("img"); image.src = article.featuredImage; image.alt = "Current featured image"; container.append(image); }
    else { const empty = document.createElement("p"); empty.textContent = "No featured image yet."; container.append(empty); }
    const actions = document.createElement("div"); actions.className = "aiced-featured-image__actions";
    const generate = document.createElement("button"); generate.type = "button"; generate.textContent = article.featuredImage ? "✨ Regenerate" : "✨ Generate with Aiced"; generate.disabled = approvalState !== "saved"; generate.addEventListener("click", generateFeaturedImage);
    const upload = document.createElement("button"); upload.type = "button"; upload.textContent = article.featuredImage ? "Upload" : "Upload Image"; upload.disabled = approvalState !== "saved"; upload.addEventListener("click", () => container.querySelector("input[type=file]").click());
    actions.append(generate, upload);
    if (article.featuredImage) { const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove"; remove.disabled = approvalState !== "saved"; remove.addEventListener("click", () => saveFeaturedImage(null)); actions.append(remove); }
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp"; input.hidden = true; input.addEventListener("change", uploadFeaturedImage);
    container.append(actions, input);
}

async function saveFeaturedImage(featuredImage) {
    if (!savedWorkflow) return;
    const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ article: { featuredImage } }) });
    const proposal = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(proposal.message || "Could not save the featured image.");
    const workflowToken = savedWorkflow.workflowToken; renderProposal(proposal); markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Featured image saved.");
}

async function generateFeaturedImage() {
    if (!savedWorkflow) return;
    const container = document.querySelector("#aiced-featured-image"); container.classList.add("is-generating");
    container.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try { const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/featured-image`, { method: "POST" }); const proposal = await response.json().catch(() => ({})); if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not create an image."); const workflowToken = savedWorkflow.workflowToken; renderProposal(proposal); markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Featured image created."); }
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
    blocks.forEach((block) => {
        if (block.type === "heading") {
            appendTextElement(articleContent, "h3", block.text || "");
        } else if (block.type === "paragraph" || block.type === "quote") {
            appendTextElement(articleContent, block.type === "quote" ? "blockquote" : "p", block.text || "");
        }
    });
}

function setArticleExpanded(isExpanded) {
    articleContent.hidden = !isExpanded;
    articleToggle.setAttribute("aria-expanded", String(isExpanded));
    articleToggle.replaceChildren(document.createTextNode(isExpanded ? "Close article " : "Read article "));
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = isExpanded ? "↑" : "↓";
    articleToggle.append(arrow);
}

function renderProposal(proposal) {
    const { article, campaign, audience } = proposal;
    const contentBlocks = Array.isArray(article.contentBlocks) ? article.contentBlocks : [];
    const cta = contentBlocks.find((block) => block.type === "cta") || {};
    reviewedProposal = proposal;
    approvalState = "ready";
    savedWorkflow = null;
    setRevisionComposerEnabled(true);

    document.querySelector("#aiced-article-category").textContent = titleCase(article.category);
    document.querySelector("#aiced-article-title").textContent = article.title;
    document.querySelector("#aiced-article-excerpt").textContent = article.excerpt;
    renderTags(document.querySelector("#aiced-article-tags"), article.tags, "No tags");
    renderFeaturedImage(article);
    renderArticleBlocks(contentBlocks);
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
    intro.hidden = true;
    review.hidden = false;
    setStatus(reviewStatus, "Proposal ready to review.");
    approveButton.disabled = false;
    approveButton.textContent = "Approve & Continue →";
    setManualEditingEnabled(false);
    review.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setRevisionComposerEnabled(enabled) {
    refineRequest.disabled = !enabled;
    refineSendButton.disabled = !enabled;
}

function markWorkflowSaved(workflow, summary) {
    savedWorkflow = workflow;
    approvalState = "saved";
    approveButton.disabled = true;
    approveButton.textContent = "Saved";
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
        renderProposal(proposal);
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, "Changes saved.");
    } catch (error) {
        const status = form.querySelector(".aiced-edit-error");
        status.textContent = error.message || "Aiced Bot could not save those changes.";
    } finally { isManualSaving = false; form.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
}

function beginManualEdit(kind) {
    if (approvalState !== "saved" || !savedWorkflow || !reviewedProposal) return;
    const card = document.querySelector(`#aiced-card-${kind}`);
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
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Cancel"; cancel.className = "aiced-button aiced-button--quiet"; cancel.addEventListener("click", () => { renderProposal(reviewedProposal); markWorkflowSaved(savedWorkflow); });
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
    setStatus(reviewStatus, "Aiced Bot is updating your saved work…");
    try {
        const response = await fetch(`/api/aiced/workflows/${encodeURIComponent(savedWorkflow.workflowToken)}/revisions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instruction }),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok || !proposal.workflow || !proposal.article || !proposal.campaign || !proposal.audience) {
            const reference = proposal.referenceId ? ` Reference: ${proposal.referenceId}` : "";
            throw new Error(`${proposal.message || "Aiced Bot could not complete that revision."}${reference}`);
        }
        const workflowToken = savedWorkflow.workflowToken;
        renderProposal(proposal);
        refineRequest.value = "";
        markWorkflowSaved({ postId: proposal.workflow.postId, workflowToken }, proposal.summary);
    } catch (error) {
        setStatus(reviewStatus, error.message || "Aiced Bot could not complete that revision.", true);
    } finally {
        isRevising = false;
        refineSendButton.textContent = "↑";
        setRevisionComposerEnabled(approvalState === "saved");
    }
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
        renderProposal(proposal);
    } catch (error) {
        setStatus(generationStatus, error.message || "Aiced Bot could not create a package. Please try again.", true);
    } finally {
        isGenerating = false;
        generateButton.disabled = false;
        generateButton.textContent = "Create package →";
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
    approveButton.disabled = true;
    approveButton.textContent = "Approve & Continue →";
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

document.querySelectorAll("[data-prompt-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
        generationRequest.value = button.dataset.promptSuggestion;
        generationRequest.focus();
    });
});

newButtons.forEach((button) => button.addEventListener("click", resetWorkspace));
articleToggle.addEventListener("click", () => {
    setArticleExpanded(articleContent.hidden);
});
approveButton.addEventListener("click", approveReviewedProposal);
document.querySelectorAll("[data-card-edit]").forEach((button) => {
    button.addEventListener("click", () => beginManualEdit(button.dataset.cardEdit));
});
refineSendButton.addEventListener("click", submitRevision);
refineRequest.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitRevision();
    }
});
restoreStartNewButton.addEventListener("click", resetWorkspace);
menuButton.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
});

restoreWorkflowFromUrl();
