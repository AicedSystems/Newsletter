const themeSelector = document.querySelector("#theme-selector");
const selectedPostElement = document.querySelector("#selected-post");
const changeSelectedPostButton = document.querySelector("#change-selected-post");
const postPicker = document.querySelector("#post-picker");
const closePostPickerButton = document.querySelector("#close-post-picker");
const postPickerList = document.querySelector("#post-picker-list");
const postPickerStatus = document.querySelector("#post-picker-status");
const campaignNameInput = document.querySelector("#campaign-name");
const subjectInput = document.querySelector("#campaign-subject");
const preheaderInput = document.querySelector("#campaign-preheader");
const subjectCharacterCount = document.querySelector("#subject-character-count");
const preheaderCharacterCount = document.querySelector("#preheader-character-count");
const emailPreview = document.querySelector("#email-preview");
const emailPreviewEmpty = document.querySelector("#email-preview-empty");
const editEmailPreviewButton = document.querySelector("#edit-email-preview");
const desktopPreviewButton = document.querySelector("#desktop-preview-button");
const mobilePreviewButton = document.querySelector("#mobile-preview-button");
const testRecipientInput = document.querySelector("#test-recipient");
const sendTestEmailButton = document.querySelector("#send-test-email-button");
const campaignSendStatus = document.querySelector("#campaign-send-status");
const campaignStepButtons = [...document.querySelectorAll("[data-campaign-step]")];
const nextCampaignStepButton = document.querySelector("#next-campaign-step");
const recipientsStep = document.querySelector("#campaign-recipients-step");
const reviewStep = document.querySelector("#campaign-review-step");
const recipientSearchInput = document.querySelector("#campaign-recipient-search");
const recipientTagFilter = document.querySelector("#campaign-recipient-tag-filter");
const recipientList = document.querySelector("#campaign-recipient-list");
const recipientStatus = document.querySelector("#campaign-recipient-status");
const selectedRecipientCount = document.querySelector("#selected-recipient-count");
const selectVisibleRecipientsButton = document.querySelector("#select-visible-recipients");
const audienceCount = document.querySelector("#campaign-audience-count");
const audienceContext = document.querySelector("#campaign-audience-context");
const createWithAicedButton = document.querySelector("#create-with-aiced-button");
const campaignAicedDialog = document.querySelector("#campaign-aiced-dialog");
const closeCampaignAicedDialogButton = document.querySelector("#close-campaign-aiced-dialog");
const campaignAicedRequest = document.querySelector("#campaign-aiced-request");
const generateCampaignProposalButton = document.querySelector("#generate-campaign-proposal");
const campaignAicedStatus = document.querySelector("#campaign-aiced-status");
const campaignAicedPrompt = document.querySelector("#campaign-aiced-prompt");
const campaignAicedProposal = document.querySelector("#campaign-aiced-proposal");
const editAicedPromptButton = document.querySelector("#edit-aiced-prompt");
const regenerateAicedProposalButton = document.querySelector("#regenerate-aiced-proposal");
const createAicedArticleButton = document.querySelector("#create-article-review-campaign");
const aicedDraftStatus = document.querySelector("#aiced-draft-status");
const editAicedDraftLink = document.querySelector("#edit-aiced-draft-link");

const supportedThemes = new Set(["midnight", "obsidian", "sage"]);
const allowedCampaignImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumCampaignImageSize = 5 * 1024 * 1024;
let selectedPost = null;
let previewTimer = null;
let isEditingPreview = false;
let campaignEdits = { headline: "", summary: "", coverImageUrl: "" };
let activeCampaignStep = "content";
let recipientSearchTimer = null;
let visibleRecipients = [];
let availableRecipientTags = [];
const selectedRecipients = new Map();
let pendingMarketingPackage = null;
let isGeneratingMarketingPackage = false;
let isCreatingAicedDraft = false;
let createdAicedDraft = null;

function applyTheme(themeName) {
    if (!supportedThemes.has(themeName)) return;
    document.documentElement.dataset.theme = themeName;
    themeSelector.value = themeName;
    localStorage.setItem("selectedTheme", themeName);
}

function updateCharacterCount(input, counter) {
    counter.textContent = `${input.value.length}/${input.maxLength}`;
}

function campaignPayload(includeRecipient = false) {
    const payload = { postId: selectedPost?.id, campaignName: campaignNameInput.value, subject: subjectInput.value, preheader: preheaderInput.value, ...campaignEdits };
    if (includeRecipient) payload.recipient = testRecipientInput.value;
    return payload;
}

function showStatus(message, isError = false) {
    campaignSendStatus.textContent = message;
    campaignSendStatus.classList.toggle("campaign-send-status--error", isError);
}

function recipientName(subscriber) {
    return [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || subscriber.email;
}

function updateAudienceSummary() {
    const count = selectedRecipients.size;
    const selectedTag = recipientTagFilter.options[recipientTagFilter.selectedIndex]?.text;
    audienceCount.textContent = `${count} recipient${count === 1 ? "" : "s"}`;
    audienceContext.textContent = selectedTag && recipientTagFilter.value
        ? `${selectedTag} filter · Only active subscribers are eligible.`
        : "Only active subscribers are eligible.";
    selectedRecipientCount.textContent = `${count} selected`;
}

function setAicedCampaignStatus(message, isError = false) {
    campaignAicedStatus.textContent = message;
    campaignAicedStatus.classList.toggle("campaign-aiced-dialog__status--error", isError);
}

function setAicedProposalMode(mode) {
    const isReview = mode === "review";
    campaignAicedPrompt.hidden = isReview;
    campaignAicedProposal.hidden = !isReview;
}

function titleCase(value) {
    return String(value || "").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderAicedMarketingPackage(proposal) {
    const { article, campaign, audience } = proposal;
    document.querySelector("#aiced-article-category").textContent = titleCase(article.category);
    document.querySelector("#aiced-article-title").textContent = article.title;
    document.querySelector("#aiced-article-excerpt").textContent = article.excerpt;
    const articleTags = document.querySelector("#aiced-article-tags");
    articleTags.replaceChildren(...article.tags.map((tag) => {
        const item = document.createElement("li");
        item.textContent = tag;
        return item;
    }));
    const articlePreview = document.querySelector("#aiced-article-preview");
    articlePreview.replaceChildren(...article.contentBlocks
        .filter((block) => block.type !== "cta")
        .map((block) => {
            const element = document.createElement(block.type === "heading" ? "strong" : "p");
            element.textContent = block.text;
            return element;
        }));
    const cta = article.contentBlocks.find((block) => block.type === "cta");
    document.querySelector("#aiced-cta-headline").textContent = cta.headline;
    document.querySelector("#aiced-cta-body").textContent = cta.body;
    document.querySelector("#aiced-cta-button-label").textContent = cta.buttonLabel;
    document.querySelector("#aiced-cta-action-type").textContent = titleCase(cta.actionType);
    document.querySelector("#aiced-cta-intent").textContent = titleCase(cta.intent);
    document.querySelector("#aiced-campaign-name").textContent = campaign.name;
    document.querySelector("#aiced-campaign-subject").textContent = campaign.subject;
    document.querySelector("#aiced-campaign-preheader").textContent = campaign.preheader;
    document.querySelector("#aiced-audience-tags").textContent = audience.tags.length
        ? audience.tags.join(" + ")
        : "All active subscribers";
    document.querySelector("#aiced-audience-rationale").textContent = audience.rationale;
    document.querySelector("#aiced-audience-count").textContent = `${audience.eligibleRecipientCount} eligible recipient${audience.eligibleRecipientCount === 1 ? "" : "s"}`;
    createAicedArticleButton.disabled = Boolean(createdAicedDraft);
    setAicedProposalMode("review");
}

async function createAicedArticleDraft() {
    if (isCreatingAicedDraft || createdAicedDraft) return;
    if (!pendingMarketingPackage) {
        setAicedCampaignStatus("Generate and review an Aiced proposal before creating a draft.", true);
        return;
    }

    isCreatingAicedDraft = true;
    createAicedArticleButton.disabled = true;
    setAicedCampaignStatus("Creating your draft article…");
    try {
        const response = await fetch("/api/aiced/article-campaign-handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingMarketingPackage),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Number.isInteger(result.postId) || !result.workflowToken) {
            throw new Error(result.message || "Aiced Bot could not create the draft article.");
        }

        createdAicedDraft = result;
        const destination = `/posts/new/build?edit=${encodeURIComponent(result.postId)}&workflow=${encodeURIComponent(result.workflowToken)}`;
        editAicedDraftLink.href = destination;
        aicedDraftStatus.hidden = false;
        createAicedArticleButton.textContent = "Draft created";
        setAicedCampaignStatus("Draft created. Open it to review and edit the article.");
    } catch (error) {
        createAicedArticleButton.disabled = false;
        console.error("Unable to create an Aiced campaign draft:", error);
        setAicedCampaignStatus(error.message || "Aiced Bot could not create the draft article.", true);
    } finally {
        isCreatingAicedDraft = false;
    }
}

async function generateAicedMarketingPackage() {
    if (isGeneratingMarketingPackage) return;
    const campaignRequest = campaignAicedRequest.value.trim();
    if (!campaignRequest) {
        setAicedCampaignStatus("Describe what you would like Aiced Bot to create.", true);
        campaignAicedRequest.focus();
        return;
    }

    isGeneratingMarketingPackage = true;
    generateCampaignProposalButton.disabled = true;
    regenerateAicedProposalButton.disabled = true;
    setAicedCampaignStatus("Aiced Bot is preparing your article and campaign proposal…");
    try {
        const response = await fetch("/api/aiced/marketing-package", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request: campaignRequest }),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(proposal.message || "Aiced Bot could not create a proposal.");
        if (!proposal.article || !proposal.campaign || !proposal.audience || !Array.isArray(proposal.article.contentBlocks)) {
            throw new Error("Aiced Bot returned an incomplete proposal. Please try again.");
        }
        pendingMarketingPackage = proposal;
        renderAicedMarketingPackage(proposal);
        setAicedCampaignStatus("Proposal ready to review.");
    } catch (error) {
        setAicedCampaignStatus(error.message || "Aiced Bot could not create a proposal.", true);
    } finally {
        isGeneratingMarketingPackage = false;
        generateCampaignProposalButton.disabled = false;
        regenerateAicedProposalButton.disabled = false;
    }
}

function renderReview() {
    document.querySelector("#review-post-title").textContent = selectedPost?.title || "No post selected";
    document.querySelector("#review-subject").textContent = subjectInput.value ? `Subject: ${subjectInput.value}` : "No subject line";
    document.querySelector("#review-preheader").textContent = preheaderInput.value ? `Preheader: ${preheaderInput.value}` : "No preheader text";
    document.querySelector("#review-recipient-count").textContent = `${selectedRecipients.size} recipient${selectedRecipients.size === 1 ? "" : "s"} selected`;
    const reviewRecipientList = document.querySelector("#review-recipient-list");
    reviewRecipientList.replaceChildren();
    [...selectedRecipients.values()].slice(0, 5).forEach((subscriber) => {
        const item = document.createElement("li");
        item.textContent = `${recipientName(subscriber)} · ${subscriber.email}`;
        reviewRecipientList.append(item);
    });
    if (selectedRecipients.size > 5) {
        const item = document.createElement("li");
        item.textContent = `+ ${selectedRecipients.size - 5} more selected`;
        reviewRecipientList.append(item);
    }
}

function setCampaignStep(step) {
    activeCampaignStep = step;
    recipientsStep.hidden = step !== "recipients";
    reviewStep.hidden = step !== "review";
    campaignStepButtons.forEach((button) => {
        const isActive = button.dataset.campaignStep === step;
        button.classList.toggle("campaign-steps__button--active", isActive);
        button.toggleAttribute("aria-current", isActive);
    });
    if (step === "content") {
        nextCampaignStepButton.innerHTML = 'Next: Recipients <span aria-hidden="true">→</span>';
    } else if (step === "recipients") {
        nextCampaignStepButton.innerHTML = 'Next: Review &amp; send <span aria-hidden="true">→</span>';
        loadRecipients();
        recipientsStep.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
        nextCampaignStepButton.innerHTML = 'Back: Recipients <span aria-hidden="true">←</span>';
        renderReview();
        reviewStep.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    updateAudienceSummary();
}

function renderRecipientTagFilter() {
    const selectedValue = recipientTagFilter.value;
    recipientTagFilter.replaceChildren(new Option("All tags", ""));
    availableRecipientTags.forEach((tag) => recipientTagFilter.add(new Option(tag.name, tag.id)));
    recipientTagFilter.value = availableRecipientTags.some((tag) => String(tag.id) === selectedValue) ? selectedValue : "";
}

function renderRecipients() {
    recipientList.replaceChildren();
    selectVisibleRecipientsButton.disabled = !visibleRecipients.length;
    if (!visibleRecipients.length) return;

    visibleRecipients.forEach((subscriber) => {
        const label = document.createElement("label");
        label.className = "campaign-recipient-row";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedRecipients.has(subscriber.id);
        checkbox.disabled = subscriber.status !== "active";
        checkbox.dataset.recipientId = subscriber.id;
        const details = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = recipientName(subscriber);
        const email = document.createElement("small");
        email.textContent = subscriber.email;
        const tags = document.createElement("em");
        tags.textContent = subscriber.tags.map((tag) => tag.name).join(" · ") || "No tags";
        details.append(name, email, tags);
        label.append(checkbox, details);
        recipientList.append(label);
    });
}

async function loadRecipients() {
    recipientStatus.textContent = "Loading active subscribers…";
    const query = new URLSearchParams({ status: "active" });
    if (recipientSearchInput.value.trim()) query.set("search", recipientSearchInput.value.trim());
    if (recipientTagFilter.value) query.set("tag", recipientTagFilter.value);
    try {
        const response = await fetch(`/api/subscribers?${query}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Subscribers could not be loaded.");
        visibleRecipients = result.subscribers || [];
        availableRecipientTags = result.availableTags || [];
        renderRecipientTagFilter();
        renderRecipients();
        if (!visibleRecipients.length) {
            recipientStatus.innerHTML = (result.counts?.active || 0) === 0
                ? 'No active subscribers available. <a href="/subscribers">Manage subscribers</a>'
                : "No subscribers match these filters.";
        } else {
            recipientStatus.textContent = "Only active subscribers can be selected.";
        }
        updateAudienceSummary();
    } catch (error) {
        recipientStatus.textContent = error.message || "Subscribers could not be loaded.";
    }
}

function renderSelectedPost() {
    selectedPostElement.replaceChildren();
    if (!selectedPost) {
        selectedPostElement.classList.add("selected-post--empty");
        selectedPostElement.innerHTML = '<div class="selected-post__content"><p class="selected-post__empty-message">Choose a published article to build the email preview.</p></div>';
        return;
    }

    selectedPostElement.classList.remove("selected-post--empty");
    if (selectedPost.featuredImage?.startsWith("https://")) {
        const media = document.createElement("div");
        media.className = "selected-post__media";
        const image = document.createElement("img");
        image.className = "selected-post__image";
        image.src = selectedPost.featuredImage;
        image.alt = "";
        media.append(image);
        selectedPostElement.append(media);
    }
    const content = document.createElement("div");
    content.className = "selected-post__content";
    const category = document.createElement("p");
    category.className = "selected-post__category";
    category.textContent = selectedPost.category.replaceAll("-", " ");
    const title = document.createElement("h3");
    title.className = "selected-post__title";
    title.textContent = selectedPost.title;
    content.append(category, title);
    selectedPostElement.append(content);
}

async function renderPreview() {
    if (!selectedPost) {
        emailPreview.removeAttribute("srcdoc");
        emailPreview.hidden = true;
        emailPreviewEmpty.hidden = false;
        editEmailPreviewButton.disabled = true;
        return;
    }
    const response = await fetch("/api/campaigns/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaignPayload()) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        emailPreview.removeAttribute("srcdoc");
        emailPreview.hidden = true;
        emailPreviewEmpty.textContent = result.message || "Unable to render this email preview.";
        emailPreviewEmpty.hidden = false;
        return;
    }
    editEmailPreviewButton.disabled = true;
    emailPreview.onload = () => { editEmailPreviewButton.disabled = false; };
    emailPreview.srcdoc = result.html;
    emailPreview.hidden = false;
    emailPreviewEmpty.hidden = true;
}

function finishPreviewEditing() {
    isEditingPreview = false;
    editEmailPreviewButton.textContent = "Edit email";
    emailPreview.classList.remove("email-preview--editing");
    schedulePreviewRender();
}

function validateCampaignImageFile(file) {
    if (!file || !allowedCampaignImageTypes.has(file.type)) {
        throw new Error("Choose a JPEG, PNG, or WebP image.");
    }
    if (file.size > maximumCampaignImageSize) {
        throw new Error("Images must be 5 MB or smaller.");
    }
}

async function uploadCampaignCoverImage(file, coverImage) {
    validateCampaignImageFile(file);
    showStatus("Uploading campaign cover image…");
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch("/api/uploads/article-image", { method: "POST", body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.url !== "string" || !result.url.startsWith("https://")) {
        throw new Error(result.message || "The campaign cover image could not be uploaded.");
    }
    campaignEdits.coverImageUrl = result.url;
    coverImage.src = result.url;
    showStatus("Campaign cover image uploaded.");
}

function chooseCampaignCoverImage(coverImage) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.hidden = true;
    input.addEventListener("change", async () => {
        const [file] = input.files;
        input.remove();
        if (!file) return;
        try {
            await uploadCampaignCoverImage(file, coverImage);
        } catch (error) {
            showStatus(error.message || "The campaign cover image could not be uploaded.", true);
        }
    }, { once: true });
    document.body.append(input);
    input.click();
}

function enablePreviewEditing() {
    const previewDocument = emailPreview.contentDocument;
    if (!previewDocument) return;

    isEditingPreview = true;
    editEmailPreviewButton.textContent = "Done editing";
    emailPreview.classList.add("email-preview--editing");
    const headline = previewDocument.querySelector('[data-email-editable="headline"]');
    const summary = previewDocument.querySelector('[data-email-editable="summary"]');
    const coverImage = previewDocument.querySelector('[data-email-editable="cover-image"]');

    [headline, summary].forEach((element) => {
        if (!element) return;
        element.contentEditable = "true";
        element.style.outline = "2px solid #3b82f6";
        element.style.outlineOffset = "5px";
        element.style.cursor = "text";
    });
    headline?.addEventListener("input", () => { campaignEdits.headline = headline.textContent.trim(); });
    summary?.addEventListener("input", () => { campaignEdits.summary = summary.textContent.trim(); });
    if (coverImage) {
        coverImage.style.outline = "2px solid #3b82f6";
        coverImage.style.outlineOffset = "-4px";
        coverImage.style.cursor = "pointer";
        coverImage.title = "Click to upload a replacement cover image";
        coverImage.addEventListener("click", () => {
            chooseCampaignCoverImage(coverImage);
        });
    }
    headline?.focus();
}

function schedulePreviewRender() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => renderPreview().catch(() => {
        emailPreview.hidden = true;
        emailPreviewEmpty.textContent = "Unable to render this email preview.";
        emailPreviewEmpty.hidden = false;
    }), 300);
}

function renderPostPicker(posts) {
    postPickerList.replaceChildren();
    if (!posts.length) {
        postPickerStatus.textContent = "No published articles are available yet.";
        return;
    }
    postPickerStatus.textContent = "";
    posts.forEach((post) => {
        const button = document.createElement("button");
        button.className = "post-picker__option";
        button.type = "button";
        const title = document.createElement("strong");
        title.textContent = post.title;
        const details = document.createElement("span");
        details.textContent = `${post.category.replaceAll("-", " ")} · ${post.excerpt}`;
        button.append(title, details);
        button.addEventListener("click", () => {
            selectedPost = post;
            campaignEdits = { headline: post.title, summary: post.excerpt, coverImageUrl: post.featuredImage?.startsWith("https://") ? post.featuredImage : "" };
            isEditingPreview = false;
            editEmailPreviewButton.textContent = "Edit email";
            renderSelectedPost();
            postPicker.close();
            schedulePreviewRender();
        });
        postPickerList.append(button);
    });
}

async function openPostPicker() {
    postPickerStatus.textContent = "Loading published articles…";
    postPickerList.replaceChildren();
    postPicker.showModal();
    try {
        const response = await fetch("/api/posts");
        const posts = await response.json();
        if (!response.ok || !Array.isArray(posts)) throw new Error();
        renderPostPicker(posts);
    } catch {
        postPickerStatus.textContent = "Published articles could not be loaded. Please try again.";
    }
}

async function sendTestEmail() {
    if (!selectedPost) {
        showStatus("Choose a published article before sending a test.", true);
        return;
    }
    sendTestEmailButton.disabled = true;
    showStatus("Sending test email…");
    try {
        const response = await fetch("/api/campaigns/send-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaignPayload(true)) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Test email could not be sent.");
        showStatus(`Test email sent. Message ID: ${result.messageId}`);
    } catch (error) {
        showStatus(error.message || "Test email could not be sent.", true);
    } finally {
        sendTestEmailButton.disabled = false;
    }
}

const savedTheme = localStorage.getItem("selectedTheme");
if (savedTheme && supportedThemes.has(savedTheme)) applyTheme(savedTheme);
themeSelector.addEventListener("change", (event) => applyTheme(event.target.value));
changeSelectedPostButton.addEventListener("click", openPostPicker);
createWithAicedButton.addEventListener("click", () => {
    setAicedCampaignStatus("");
    if (pendingMarketingPackage) renderAicedMarketingPackage(pendingMarketingPackage);
    else setAicedProposalMode("prompt");
    campaignAicedDialog.showModal();
    if (!pendingMarketingPackage) campaignAicedRequest.focus();
});
closeCampaignAicedDialogButton.addEventListener("click", () => campaignAicedDialog.close());
campaignAicedDialog.addEventListener("click", (event) => {
    if (event.target === campaignAicedDialog) campaignAicedDialog.close();
});
generateCampaignProposalButton.addEventListener("click", generateAicedMarketingPackage);
regenerateAicedProposalButton.addEventListener("click", generateAicedMarketingPackage);
createAicedArticleButton.addEventListener("click", createAicedArticleDraft);
editAicedPromptButton.addEventListener("click", () => {
    setAicedProposalMode("prompt");
    setAicedCampaignStatus("Edit your request, then generate a new proposal.");
    campaignAicedRequest.focus();
});
closePostPickerButton.addEventListener("click", () => postPicker.close());
postPicker.addEventListener("click", (event) => { if (event.target === postPicker) postPicker.close(); });
[campaignNameInput, subjectInput, preheaderInput].forEach((input) => input.addEventListener("input", () => {
    updateCharacterCount(subjectInput, subjectCharacterCount);
    updateCharacterCount(preheaderInput, preheaderCharacterCount);
    schedulePreviewRender();
}));
desktopPreviewButton.addEventListener("click", () => {
    emailPreview.classList.remove("email-preview--mobile");
    desktopPreviewButton.classList.add("preview-devices__button--active");
    mobilePreviewButton.classList.remove("preview-devices__button--active");
    desktopPreviewButton.setAttribute("aria-pressed", "true");
    mobilePreviewButton.setAttribute("aria-pressed", "false");
});
editEmailPreviewButton.addEventListener("click", () => {
    if (isEditingPreview) finishPreviewEditing();
    else enablePreviewEditing();
});
mobilePreviewButton.addEventListener("click", () => {
    emailPreview.classList.add("email-preview--mobile");
    mobilePreviewButton.classList.add("preview-devices__button--active");
    desktopPreviewButton.classList.remove("preview-devices__button--active");
    mobilePreviewButton.setAttribute("aria-pressed", "true");
    desktopPreviewButton.setAttribute("aria-pressed", "false");
});
sendTestEmailButton.addEventListener("click", sendTestEmail);
campaignStepButtons.forEach((button) => {
    button.addEventListener("click", () => setCampaignStep(button.dataset.campaignStep));
});
nextCampaignStepButton.addEventListener("click", () => {
    if (activeCampaignStep === "content") setCampaignStep("recipients");
    else if (activeCampaignStep === "recipients") setCampaignStep("review");
    else setCampaignStep("recipients");
});
document.querySelector("#recipients-back-button").addEventListener("click", () => setCampaignStep("content"));
document.querySelector("#recipients-next-button").addEventListener("click", () => setCampaignStep("review"));
document.querySelector("#review-back-button").addEventListener("click", () => setCampaignStep("recipients"));
recipientSearchInput.addEventListener("input", () => {
    window.clearTimeout(recipientSearchTimer);
    recipientSearchTimer = window.setTimeout(loadRecipients, 250);
});
recipientTagFilter.addEventListener("change", loadRecipients);
recipientList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-recipient-id]");
    if (!checkbox) return;
    const subscriber = visibleRecipients.find((item) => item.id === Number(checkbox.dataset.recipientId));
    if (!subscriber || subscriber.status !== "active") return;
    if (checkbox.checked) selectedRecipients.set(subscriber.id, subscriber);
    else selectedRecipients.delete(subscriber.id);
    updateAudienceSummary();
    if (activeCampaignStep === "review") renderReview();
});
selectVisibleRecipientsButton.addEventListener("click", () => {
    visibleRecipients.filter((subscriber) => subscriber.status === "active").forEach((subscriber) => {
        selectedRecipients.set(subscriber.id, subscriber);
    });
    renderRecipients();
    updateAudienceSummary();
});
updateCharacterCount(subjectInput, subjectCharacterCount);
updateCharacterCount(preheaderInput, preheaderCharacterCount);
renderSelectedPost();
renderPreview();
