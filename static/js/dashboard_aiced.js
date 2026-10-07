const dashboardAicedLauncher = document.querySelector("#dashboard-aiced-launcher");
const dashboardAicedDialog = document.querySelector("#dashboard-aiced-dialog");
const dashboardAicedClose = document.querySelector("#dashboard-aiced-close");
const dashboardAicedPrompt = document.querySelector("#dashboard-aiced-prompt");
const dashboardAicedRequest = document.querySelector("#dashboard-aiced-request");
const dashboardAicedGenerate = document.querySelector("#dashboard-aiced-generate");
const dashboardAicedStatus = document.querySelector("#dashboard-aiced-status");
const dashboardAicedProposal = document.querySelector("#dashboard-aiced-proposal");
const dashboardAicedEditPrompt = document.querySelector("#dashboard-aiced-edit-prompt");
const dashboardAicedCreateDraft = document.querySelector("#dashboard-aiced-create-draft");
const dashboardAicedDraftSuccess = document.querySelector("#dashboard-aiced-draft-success");
const dashboardAicedDraftLink = document.querySelector("#dashboard-aiced-draft-link");

let dashboardMarketingPackage = null;
let dashboardDraftCreated = false;

function setDashboardAicedStatus(message, isError = false) {
    dashboardAicedStatus.textContent = message;
    dashboardAicedStatus.classList.toggle("dashboard-aiced-dialog__status--error", isError);
}

function setDashboardAicedMode(mode) {
    const reviewing = mode === "review";
    dashboardAicedPrompt.hidden = reviewing;
    dashboardAicedProposal.hidden = !reviewing;
}

function renderDashboardAicedProposal(proposal) {
    const { article, campaign, audience } = proposal;
    document.querySelector("#dashboard-aiced-article-title").textContent = article.title;
    document.querySelector("#dashboard-aiced-article-excerpt").textContent = article.excerpt;
    document.querySelector("#dashboard-aiced-campaign-summary").textContent = `Campaign: ${campaign.name} · ${campaign.subject}`;
    document.querySelector("#dashboard-aiced-audience-summary").textContent = audience.tags.length
        ? `Audience: ${audience.tags.join(" + ")} · ${audience.eligibleRecipientCount} eligible active subscribers`
        : `Audience: All active subscribers · ${audience.eligibleRecipientCount} eligible subscribers`;
    dashboardAicedCreateDraft.disabled = dashboardDraftCreated;
    setDashboardAicedMode("review");
}

async function generateDashboardAicedProposal() {
    const requestText = dashboardAicedRequest.value.trim();
    if (!requestText) {
        setDashboardAicedStatus("Describe what you would like Aiced Bot to create.", true);
        dashboardAicedRequest.focus();
        return;
    }

    dashboardAicedGenerate.disabled = true;
    setDashboardAicedStatus("Aiced Bot is preparing your article and campaign proposal…");
    try {
        const response = await fetch("/api/aiced/marketing-package", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request: requestText }),
        });
        const proposal = await response.json().catch(() => ({}));
        if (!response.ok || !proposal.article || !proposal.campaign || !proposal.audience) {
            throw new Error(proposal.message || "Aiced Bot could not create a proposal.");
        }
        dashboardMarketingPackage = proposal;
        renderDashboardAicedProposal(proposal);
        setDashboardAicedStatus("Proposal ready to review.");
    } catch (error) {
        console.error("Unable to generate an Aiced dashboard proposal:", error);
        setDashboardAicedStatus(error.message || "Aiced Bot could not create a proposal.", true);
    } finally {
        dashboardAicedGenerate.disabled = false;
    }
}

async function createDashboardAicedDraft() {
    if (!dashboardMarketingPackage || dashboardDraftCreated) return;

    dashboardAicedCreateDraft.disabled = true;
    setDashboardAicedStatus("Creating your draft article…");
    try {
        const response = await fetch("/api/aiced/article-campaign-handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dashboardMarketingPackage),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Number.isInteger(result.postId) || !result.workflowToken) {
            throw new Error(result.message || "Aiced Bot could not create the draft article.");
        }
        dashboardDraftCreated = true;
        dashboardAicedDraftLink.href = `/posts/new/build?edit=${encodeURIComponent(result.postId)}&workflow=${encodeURIComponent(result.workflowToken)}`;
        dashboardAicedDraftSuccess.hidden = false;
        dashboardAicedCreateDraft.textContent = "Draft created";
        setDashboardAicedStatus("Draft created. Open it to review and edit the article.");
    } catch (error) {
        dashboardAicedCreateDraft.disabled = false;
        console.error("Unable to create an Aiced dashboard draft:", error);
        setDashboardAicedStatus(error.message || "Aiced Bot could not create the draft article.", true);
    }
}

dashboardAicedLauncher.addEventListener("click", () => {
    dashboardAicedLauncher.setAttribute("aria-expanded", "true");
    if (dashboardMarketingPackage) renderDashboardAicedProposal(dashboardMarketingPackage);
    else setDashboardAicedMode("prompt");
    dashboardAicedDialog.showModal();
    if (!dashboardMarketingPackage) dashboardAicedRequest.focus();
});
dashboardAicedClose.addEventListener("click", () => dashboardAicedDialog.close());
dashboardAicedDialog.addEventListener("close", () => dashboardAicedLauncher.setAttribute("aria-expanded", "false"));
dashboardAicedDialog.addEventListener("click", (event) => {
    if (event.target === dashboardAicedDialog) dashboardAicedDialog.close();
});
dashboardAicedGenerate.addEventListener("click", generateDashboardAicedProposal);
dashboardAicedCreateDraft.addEventListener("click", createDashboardAicedDraft);
dashboardAicedEditPrompt.addEventListener("click", () => {
    setDashboardAicedMode("prompt");
    setDashboardAicedStatus("Edit your request, then generate a new proposal.");
    dashboardAicedRequest.focus();
});
