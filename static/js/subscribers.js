const themeSelector = document.querySelector("#theme-selector");
const searchInput = document.querySelector("#subscriber-search");
const statusFilter = document.querySelector("#subscriber-status-filter");
const tagFilter = document.querySelector("#subscriber-tag-filter");
const subscriberList = document.querySelector("#subscriber-list");
const subscriberTable = document.querySelector("#subscriber-table");
const emptyState = document.querySelector("#subscriber-empty-state");
const emptyStateTitle = document.querySelector("#subscriber-empty-state-title");
const emptyStateDescription = document.querySelector("#subscriber-empty-state-description");
const statusMessage = document.querySelector("#subscriber-status-message");
const subscriberDialog = document.querySelector("#subscriber-dialog");
const subscriberForm = document.querySelector("#subscriber-form");
const dialogTitle = document.querySelector("#subscriber-dialog-title");
const dialogDescription = document.querySelector("#subscriber-dialog-description");
const formMessage = document.querySelector("#subscriber-form-message");
const statusActions = document.querySelector("#subscriber-status-actions");
const mailingStatus = document.querySelector("#subscriber-mailing-status");
const currentStatus = document.querySelector("#subscriber-current-status");
const currentStatusDescription = document.querySelector("#subscriber-current-status-description");
const unsubscribeButton = document.querySelector("#unsubscribe-subscriber-button");
const suppressButton = document.querySelector("#suppress-subscriber-button");
const restoreButton = document.querySelector("#restore-subscriber-button");
const tagChoices = document.querySelector("#subscriber-tag-choices");
const createTagControls = document.querySelector("#create-tag-controls");
const newTagInput = document.querySelector("#new-subscriber-tag");
const deleteSelectedTagButton = document.querySelector("#delete-selected-tag-button");

const supportedThemes = new Set(["midnight", "obsidian", "sage"]);
const statusLabels = {
    active: "Active",
    unsubscribed: "Removed from Mailing List",
    suppressed: "Blocked from Emails",
};
let searchTimer = null;
let subscribers = [];
let availableTags = [];
let selectedTagIds = new Set();

function applyTheme(themeName) {
    if (!supportedThemes.has(themeName)) return;
    document.documentElement.dataset.theme = themeName;
    themeSelector.value = themeName;
    localStorage.setItem("selectedTheme", themeName);
}

function setMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("subscriber-status-message--error", isError);
}

function setFormMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("subscriber-form__message--error", isError);
}

function displayName(subscriber) {
    return [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || "—";
}

function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function renderCounts(counts) {
    ["total", "active", "unsubscribed", "suppressed"].forEach((name) => {
        document.querySelector(`#subscriber-count-${name}`).textContent = counts[name] || 0;
    });
    document.querySelectorAll("[data-status-count-filter]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.statusCountFilter === statusFilter.value));
    });
}

function renderTagFilter(tags) {
    const selectedValue = tagFilter.value;
    tagFilter.replaceChildren(new Option("All tags", ""));
    tags.forEach((tag) => tagFilter.add(new Option(tag.name, tag.id)));
    tagFilter.value = tags.some((tag) => String(tag.id) === selectedValue) ? selectedValue : "";
}

function renderTagChoices() {
    tagChoices.replaceChildren();
    deleteSelectedTagButton.disabled = selectedTagIds.size !== 1;
    if (!availableTags.length) {
        tagChoices.textContent = "No tags yet. Create one to use it here.";
        return;
    }
    availableTags.forEach((tag) => {
        const button = document.createElement("button");
        button.className = "subscriber-tag-choice";
        button.type = "button";
        button.dataset.tagId = tag.id;
        button.setAttribute("aria-pressed", String(selectedTagIds.has(tag.id)));
        button.textContent = tag.name;
        tagChoices.append(button);
    });
}

function renderSubscribers(nextSubscribers) {
    subscribers = nextSubscribers;
    subscriberList.replaceChildren();
    subscriberTable.hidden = !subscribers.length;
    emptyState.hidden = subscribers.length > 0;
    if (!subscribers.length) {
        const emptyStateCopy = {
            active: [
                "No Active Subscribers",
                "There are no subscribers currently eligible to receive campaign emails.",
            ],
            unsubscribed: [
                "No Removed Subscribers",
                "No subscribers have been removed from the mailing list.",
            ],
            suppressed: [
                "No Blocked Subscribers",
                "No subscribers are currently blocked from emails.",
            ],
        };
        const [title, description] = emptyStateCopy[statusFilter.value] || [
            "No subscribers yet",
            "Add your first subscriber or import contacts to start building your audience.",
        ];
        emptyStateTitle.textContent = title;
        emptyStateDescription.textContent = description;
    }

    subscribers.forEach((subscriber) => {
        const row = document.createElement("tr");
        const tags = subscriber.tags.length
            ? subscriber.tags.map((tag) => `<span class="subscriber-tag">${escapeHtml(tag.name)}</span>`).join("")
            : "—";
        row.innerHTML = `
            <td>${escapeHtml(displayName(subscriber))}</td>
            <td>${escapeHtml(subscriber.email)}</td>
            <td>${tags}</td>
            <td><span class="subscriber-status subscriber-status--${escapeHtml(subscriber.status)}">${escapeHtml(statusLabels[subscriber.status])}</span></td>
            <td>${escapeHtml(formatDate(subscriber.createdAt))}</td>
            <td><button class="subscribers-button" type="button" data-edit-subscriber="${subscriber.id}">Edit</button></td>`;
        subscriberList.append(row);
    });
}

function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
}

function currentQuery() {
    const query = new URLSearchParams();
    if (searchInput.value.trim()) query.set("search", searchInput.value.trim());
    if (statusFilter.value) query.set("status", statusFilter.value);
    if (tagFilter.value) query.set("tag", tagFilter.value);
    return query;
}

async function loadSubscribers() {
    setMessage("Loading subscribers…");
    try {
        const response = await fetch(`/api/subscribers?${currentQuery()}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Subscribers could not be loaded.");
        availableTags = result.availableTags || [];
        renderCounts(result.counts);
        renderTagFilter(availableTags);
        renderTagChoices();
        renderSubscribers(result.subscribers || []);
        setMessage("");
    } catch (error) {
        renderSubscribers([]);
        setMessage(error.message || "Subscribers could not be loaded.", true);
    }
}

function openDialog(subscriber = null) {
    subscriberForm.reset();
    setFormMessage("");
    selectedTagIds = new Set(subscriber?.tags.map((tag) => tag.id) || []);
    createTagControls.hidden = true;
    document.querySelector("#subscriber-id").value = subscriber?.id || "";
    document.querySelector("#subscriber-first-name").value = subscriber?.firstName || "";
    document.querySelector("#subscriber-last-name").value = subscriber?.lastName || "";
    document.querySelector("#subscriber-email").value = subscriber?.email || "";
    dialogTitle.textContent = subscriber ? "Edit subscriber" : "Add subscriber";
    dialogDescription.textContent = subscriber
        ? "Update this contact’s details and audience tags."
        : "Add this contact and organize them with audience tags.";
    mailingStatus.hidden = !subscriber;
    statusActions.hidden = !subscriber;
    unsubscribeButton.hidden = !subscriber || subscriber.status === "unsubscribed";
    suppressButton.hidden = !subscriber || subscriber.status === "suppressed";
    restoreButton.hidden = !subscriber || subscriber.status === "active";
    if (subscriber?.status === "unsubscribed") {
        restoreButton.textContent = "Add Back to Mailing List";
    } else if (subscriber?.status === "suppressed") {
        restoreButton.textContent = "Unblock and Add Back to Mailing List";
    }
    currentStatus.textContent = subscriber ? statusLabels[subscriber.status] : "Active";
    currentStatusDescription.textContent = subscriber?.status === "unsubscribed"
        ? "This subscriber has been removed and will not receive campaign emails."
        : subscriber?.status === "suppressed"
            ? "This subscriber is blocked and will not be eligible for campaign delivery."
            : "This subscriber can receive email campaigns.";
    renderTagChoices();
    subscriberDialog.showModal();
    document.querySelector("#subscriber-first-name").focus();
}

function formPayload() {
    return {
        firstName: document.querySelector("#subscriber-first-name").value,
        lastName: document.querySelector("#subscriber-last-name").value,
        email: document.querySelector("#subscriber-email").value,
        tags: availableTags.filter((tag) => selectedTagIds.has(tag.id)).map((tag) => tag.name),
    };
}

async function saveSubscriber(event) {
    event.preventDefault();
    const subscriberId = document.querySelector("#subscriber-id").value;
    const submitButton = document.querySelector("#subscriber-form-submit");
    submitButton.disabled = true;
    setFormMessage("Saving…");
    try {
        const response = await fetch(subscriberId ? `/api/subscribers/${subscriberId}` : "/api/subscribers", {
            method: subscriberId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formPayload()),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Subscriber could not be saved.");
        subscriberDialog.close();
        await loadSubscribers();
        setMessage("Subscriber saved.");
    } catch (error) {
        setFormMessage(error.message || "Subscriber could not be saved.", true);
    } finally {
        submitButton.disabled = false;
    }
}

async function createTag() {
    const name = newTagInput.value.trim();
    if (!name) {
        setFormMessage("Enter a tag name to create it.", true);
        return;
    }
    const createButton = document.querySelector("#create-tag-button");
    createButton.disabled = true;
    setFormMessage("Creating tag…");
    try {
        const response = await fetch("/api/subscriber-tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Tag could not be created.");
        if (!availableTags.some((tag) => tag.id === result.id)) {
            availableTags.push(result);
            availableTags.sort((first, second) => first.name.localeCompare(second.name));
        }
        selectedTagIds.add(result.id);
        newTagInput.value = "";
        createTagControls.hidden = true;
        renderTagFilter(availableTags);
        renderTagChoices();
        setFormMessage(`Tag “${result.name}” is selected.`);
    } catch (error) {
        setFormMessage(error.message || "Tag could not be created.", true);
    } finally {
        createButton.disabled = false;
    }
}

async function deleteSelectedTag() {
    if (selectedTagIds.size !== 1) return;
    const tagId = [...selectedTagIds][0];
    const tag = availableTags.find((availableTag) => availableTag.id === tagId);
    if (!tag) return;
    const confirmed = window.confirm(
        `Delete “${tag.name}”? This removes the tag from every subscriber using it, but does not delete any subscribers.`
    );
    if (!confirmed) return;

    deleteSelectedTagButton.disabled = true;
    setFormMessage("Deleting tag…");
    try {
        const response = await fetch(`/api/subscriber-tags/${tag.id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Tag could not be deleted.");
        availableTags = availableTags.filter((availableTag) => availableTag.id !== tag.id);
        selectedTagIds.delete(tag.id);
        renderTagFilter(availableTags);
        renderTagChoices();
        setFormMessage(`Tag deleted. Removed from ${result.removedFromSubscribers} subscriber(s).`);
    } catch (error) {
        setFormMessage(error.message || "Tag could not be deleted.", true);
        renderTagChoices();
    }
}

async function setSubscriberStatus(status, reactivate = false) {
    const subscriberId = document.querySelector("#subscriber-id").value;
    if (!subscriberId) return;
    const action = reactivate && document.querySelector("#restore-subscriber-button").textContent.startsWith("Unblock")
        ? "unblock this subscriber and add them back to the mailing list?"
        : reactivate
            ? "add this subscriber back to the mailing list?"
            : status === "unsubscribed"
        ? "remove this subscriber from the mailing list? They will no longer receive campaign emails."
        : "block this subscriber from emails? They will not be eligible for campaign delivery.";
    if (!window.confirm(`Are you sure you want to ${action}`)) return;
    try {
        const response = await fetch(`/api/subscribers/${subscriberId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, ...(reactivate ? { reactivate: true } : {}) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Subscriber status could not be updated.");
        subscriberDialog.close();
        await loadSubscribers();
        setMessage(reactivate
            ? "Subscriber added back to the mailing list."
            : status === "unsubscribed"
                ? "Subscriber removed from mailing list."
                : "Subscriber blocked from emails.");
    } catch (error) {
        setFormMessage(error.message || "Subscriber status could not be updated.", true);
    }
}

const savedTheme = localStorage.getItem("selectedTheme");
if (savedTheme) applyTheme(savedTheme);
themeSelector.addEventListener("change", (event) => applyTheme(event.target.value));
document.querySelector("#add-subscriber-button").addEventListener("click", () => openDialog());
document.querySelector("#empty-add-subscriber-button").addEventListener("click", () => openDialog());
document.querySelector("#subscriber-dialog-close").addEventListener("click", () => subscriberDialog.close());
document.querySelector("#subscriber-dialog-cancel").addEventListener("click", () => subscriberDialog.close());
document.querySelector("#show-create-tag-button").addEventListener("click", () => {
    createTagControls.hidden = !createTagControls.hidden;
    if (!createTagControls.hidden) newTagInput.focus();
});
document.querySelector("#close-create-tag-button").addEventListener("click", () => {
    createTagControls.hidden = true;
    newTagInput.value = "";
});
document.querySelector("#create-tag-button").addEventListener("click", createTag);
deleteSelectedTagButton.addEventListener("click", deleteSelectedTag);
tagChoices.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag-id]");
    if (!button) return;
    const tagId = Number(button.dataset.tagId);
    if (selectedTagIds.has(tagId)) selectedTagIds.delete(tagId);
    else selectedTagIds.add(tagId);
    renderTagChoices();
});
subscriberForm.addEventListener("submit", saveSubscriber);
unsubscribeButton.addEventListener("click", () => setSubscriberStatus("unsubscribed"));
suppressButton.addEventListener("click", () => setSubscriberStatus("suppressed"));
restoreButton.addEventListener("click", () => setSubscriberStatus("active", true));
subscriberList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-subscriber]");
    if (!button) return;
    openDialog(subscribers.find((subscriber) => subscriber.id === Number(button.dataset.editSubscriber)));
});
searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadSubscribers, 250);
});
statusFilter.addEventListener("change", loadSubscribers);
document.querySelectorAll("[data-status-count-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        statusFilter.value = button.dataset.statusCountFilter;
        loadSubscribers();
    });
});
tagFilter.addEventListener("change", loadSubscribers);
loadSubscribers();
