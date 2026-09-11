// Create Post page behavior will be added after the layout is approved.
const themeSelector = document.querySelector("#theme-selector");

const supportedThemes = new Set([
    "midnight",
    "obsidian",
    "sage"
]);

function applyTheme(themeName) {
    if (!supportedThemes.has(themeName)) {
        return;
    }

    document.documentElement.dataset.theme = themeName;
    themeSelector.value = themeName;
    localStorage.setItem("selectedTheme", themeName);
}

const savedTheme = localStorage.getItem("selectedTheme");

if (savedTheme && supportedThemes.has(savedTheme)) {
    applyTheme(savedTheme);
}

themeSelector.addEventListener("change", (event) => {
    applyTheme(event.target.value);
});
// Post form data
const postForm = document.querySelector("[data-post-form]");
const isDemoMode = postForm.dataset.demoMode === "true";
const articleDetails = document.querySelector("#article-details");
const articleDetailsEditButton = document.querySelector("#edit-article-details-button");
const articleDetailsTitle = document.querySelector("#article-details-heading");
const articleDetailsSummary = document.querySelector("#article-details-summary");
const saveDraftButton = document.querySelector("#save-draft-button");
const previewButton = document.querySelector("#preview-button");
const publishPostButton = document.querySelector("#publish-post-button");
const featuredImageInput = document.querySelector("#post-featured-image");
const previewImage = document.querySelector("#preview-image");
const previewImageButton = document.querySelector("#view-thumbnail-button");
const previewNoImage = document.querySelector("#preview-no-image");
const previewCategory = document.querySelector("#preview-category");
const previewTitle = document.querySelector("#preview-title");
const previewExcerpt = document.querySelector("#preview-excerpt");
const previewContent = document.querySelector("#preview-content");
const publishingStatus = document.querySelector("#publishing-status");
const contentBlockList = document.querySelector("#content-block-list");
const blockBuilderFooter = document.querySelector(".block-builder__footer");
const addBlockMenu = document.querySelector(".block-builder__add-menu--bottom");
const addBlockButtons = document.querySelectorAll("[data-add-block]");
const featuredImageDropZone = document.querySelector("#featured-image-drop-zone");
const viewThumbnailButton = document.querySelector("#view-thumbnail-button");
const removeThumbnailButton = document.querySelector("#remove-thumbnail-button");
const thumbnailViewerDialog = document.querySelector("#thumbnail-viewer-dialog");
const thumbnailViewerImage = document.querySelector("#thumbnail-viewer-image");
const closeThumbnailViewerButton = document.querySelector("#close-thumbnail-viewer-button");
const thumbnailRemoveDialog = document.querySelector("#thumbnail-remove-dialog");
const cancelThumbnailRemoveButton = document.querySelector("#cancel-thumbnail-remove-button");
const confirmThumbnailRemoveButton = document.querySelector("#confirm-thumbnail-remove-button");
const fullPreviewDialog = document.querySelector("#full-preview-dialog");
const closeFullPreviewButton = document.querySelector("#close-full-preview-button");
const fullPreviewMockup = document.querySelector("#full-preview-mockup");
const aicedBotLauncher = document.querySelector("#aiced-bot-launcher");
const aicedBotPanelBackdrop = document.querySelector("#aiced-bot-panel-backdrop");
const aicedBotPanel = document.querySelector("#aiced-bot-panel");
const closeAicedBotPanelButton = document.querySelector("#aiced-bot-panel-close");
const aicedBotPanelBody = document.querySelector("#aiced-bot-panel-body");
const aicedBotIdleContent = document.querySelector("#aiced-bot-idle-content");
const aicedBotWorkflowContent = document.querySelector("#aiced-bot-workflow-content");
const aicedBotPanelComposer = document.querySelector("#aiced-bot-panel-composer");
const aiAssistantCardToggleButton = document.querySelector("#ai-assistant-card-toggle-button");
const aiAssistantCardContent = document.querySelector("#ai-assistant-card-content");
const improveSeoButton = document.querySelector("#improve-seo-button");
const aiAssistantStatus = document.querySelector("#ai-assistant-status");
const aiAssistantStatusMessage = document.querySelector("#ai-assistant-status-message");
const undoAiAssistantButton = document.querySelector("#undo-ai-assistant-button");

let featuredImageDataUrl = null;
let isPublishing = false;
let contentBlocks = [];
let draggedBlockIndex = null;
let draggedSectionBlockIndexes = null;
const editingSectionHeadingBlocks = new Set();
let sectionStartHeadings = new WeakSet();
let standaloneBetweenSectionBlocks = new WeakSet();
let lastContentBlocksSnapshot = [];
let aiUndoState = null;
let isAiEditProcessing = false;
let aiDrawerState = {mode: "idle", beforeState: null, afterState: null};

function setAicedBotPanelOpen(isOpen) {
    aicedBotLauncher.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
        aicedBotPanelBackdrop.hidden = false;
        window.requestAnimationFrame(() => {
            aicedBotPanelBackdrop.classList.add("is-open");
            aicedBotPanel.focus();
        });
        return;
    }

    aicedBotPanelBackdrop.classList.remove("is-open");
    window.setTimeout(() => {
        if (!aicedBotPanelBackdrop.classList.contains("is-open")) {
            aicedBotPanelBackdrop.hidden = true;
        }
    }, 180);
    aicedBotLauncher.focus();
}

const demoDraftStorageKey = "cmsDemoPostDraft";
const demoPublishedStorageKey = "cmsDemoPublishedPost";

const allowedImageTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);
const maximumImageSize = 5 * 1024 * 1024;

const blockDefaults = {
    heading: { type: "heading", text: "" },
    paragraph: { type: "paragraph", text: "" },
    image: { type: "image", url: "" },
    youtube: { type: "youtube", url: "" },
    quote: { type: "quote", text: "" },
    cta: { type: "cta", text: "", url: "" }
};

const blockPresentation = {
    heading: { label: "Heading", icon: "H" },
    paragraph: { label: "Paragraph", icon: "¶" },
    image: { label: "Image", icon: "▧" },
    youtube: { label: "YouTube", icon: "▶" },
    quote: { label: "Quote", icon: "❝" },
    cta: { label: "Call to action", icon: "↗" }
};

function renderArticleDetails() {
    const title = postForm.querySelector("#post-title").value.trim();
    const excerpt = postForm.querySelector("#post-excerpt").value.trim();

    articleDetailsTitle.textContent = title || "Add your article title";
    articleDetailsSummary.textContent = excerpt
        || "Add a concise SEO summary for search results and article previews.";
}

function toggleArticleDetailsEditor() {
    const isEditing = articleDetails.classList.toggle("is-editing");
    articleDetailsEditButton.textContent = isEditing ? "Done" : "Edit";

    if (isEditing) {
        postForm.querySelector("#post-title").focus();
    }
}

function createBlockField(block, field, labelText, multiline = false) {
    const fieldWrapper = document.createElement("label");
    fieldWrapper.className = "block-builder__field";

    const label = document.createElement("span");
    label.className = "block-builder__field-label";
    label.textContent = labelText;

    const control = document.createElement(multiline ? "textarea" : "input");
    control.className = "block-builder__input";
    control.type = field === "url" ? "url" : "text";
    control.value = block[field] || "";
    control.placeholder = field === "url" ? "Or input URL" : "";
    control.rows = multiline ? 2 : undefined;
    control.addEventListener("input", (event) => {
        block[field] = event.target.value;
        renderPostPreview(getPostData());
    });
    if (!["heading", "paragraph"].includes(block.type)) {
        control.addEventListener("change", () => {
            renderContentBlocks();
        });
    }

    fieldWrapper.append(label, control);
    return fieldWrapper;
}

function getBlockPreview(block) {
    if (block.type === "cta") {
        return block.text || "Add call to action text";
    }

    return block.text || block.url || `Add ${blockPresentation[block.type].label.toLowerCase()} content`;
}

function cloneContentBlocks(blocks = contentBlocks) {
    return blocks.map((block) => ({ ...block }));
}

function markExistingHeadingsAsSectionStarts() {
    sectionStartHeadings = new WeakSet();
    contentBlocks.forEach((block) => {
        if (block.type === "heading") {
            sectionStartHeadings.add(block);
        }
    });
}

function resetStandaloneBetweenSectionBlocks() {
    standaloneBetweenSectionBlocks = new WeakSet();
}

function applyContentMutation(mutator) {
    const snapshot = cloneContentBlocks();
    lastContentBlocksSnapshot = snapshot;

    try {
        mutator();
        renderContentBlocks();
    } catch (error) {
        contentBlocks = cloneContentBlocks(lastContentBlocksSnapshot);
        renderContentBlocks();
        showPublishingStatus("Your previous article content was restored after an editor error.");
        console.error("Unable to apply article block change:", error);
    }
}

function changeBlockType(block, nextType) {
    if (block.type === nextType) {
        return;
    }

    const text = block.text || "";
    const url = block.url || "";
    const nextTypeUsesText = ["heading", "paragraph", "quote", "cta"].includes(nextType);
    const nextTypeUsesUrl = ["image", "youtube", "cta"].includes(nextType);
    const willDiscardText = Boolean(text.trim()) && !nextTypeUsesText;
    const willDiscardUrl = Boolean(url.trim()) && !nextTypeUsesUrl;

    if ((willDiscardText || willDiscardUrl) && !window.confirm(
        "This conversion will replace the current block content. Continue?"
    )) {
        return;
    }

    applyContentMutation(() => {
        if (block.type === "heading" && nextType !== "heading") {
            sectionStartHeadings.delete(block);
        }

        if (["heading", "paragraph", "quote"].includes(nextType)) {
            Object.assign(block, { type: nextType, text });
            delete block.url;
        } else if (["image", "youtube"].includes(nextType)) {
            Object.assign(block, { type: nextType, url });
            delete block.text;
        } else {
            Object.assign(block, { type: "cta", text, url });
        }
    });
}

function createBlockTypePicker(block) {
    const picker = document.createElement("div");
    picker.className = "block-builder__type-picker";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `block-builder__icon block-builder__icon--${block.type}`;
    toggle.textContent = blockPresentation[block.type].icon;
    toggle.setAttribute("aria-label", `Change ${blockPresentation[block.type].label} element`);
    toggle.setAttribute("title", "Change element");
    toggle.setAttribute("aria-expanded", "false");

    const options = document.createElement("div");
    options.className = "block-builder__type-picker-options";
    options.hidden = true;

    Object.entries(blockPresentation).forEach(([type, presentation]) => {
        const option = document.createElement("button");
        option.type = "button";
        option.textContent = presentation.label;
        option.disabled = type === block.type;
        option.addEventListener("click", () => {
            changeBlockType(block, type);
        });
        options.append(option);
    });

    toggle.addEventListener("click", () => {
        const isOpen = !options.hidden;
        closeOpenTypePickers(picker);
        options.hidden = isOpen;
        toggle.setAttribute("aria-expanded", String(!isOpen));
    });

    picker.append(toggle, options);
    return picker;
}

function closeOpenTypePickers(exceptPicker = null) {
    document.querySelectorAll(".block-builder__type-picker-options").forEach((options) => {
        const picker = options.closest(".block-builder__type-picker");

        if (picker !== exceptPicker) {
            options.hidden = true;
            picker.querySelector(".block-builder__icon").setAttribute("aria-expanded", "false");
        }
    });
}

document.addEventListener("click", (event) => {
    const picker = event.target.closest(".block-builder__type-picker");

    if (!picker && !event.target.closest(".block-builder__settings")) {
        closeOpenTypePickers();
    }
});

function moveBlock(fromIndex, toIndex) {
    if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= contentBlocks.length ||
        toIndex >= contentBlocks.length
    ) {
        return;
    }

    applyContentMutation(() => {
        const [movedBlock] = contentBlocks.splice(fromIndex, 1);
        contentBlocks.splice(toIndex, 0, movedBlock);
    });
}

function setDropZoneState(element, placement = null) {
    element.classList.remove(
        "is-dragging-over",
        "is-dragging-above",
        "is-dragging-below"
    );

    if (typeof placement === "boolean") {
        element.classList.toggle("is-dragging-over", placement);
        return;
    }

    if (placement) {
        element.classList.add("is-dragging-over", `is-dragging-${placement}`);
    }
}

function getBlockDropPlacement(blockElement, clientY) {
    const targetIndex = Number(blockElement.dataset.blockIndex);
    const bounds = blockElement.getBoundingClientRect();
    const placement = clientY < bounds.top + bounds.height / 2 ? "above" : "below";
    let destinationIndex = targetIndex + (placement === "below" ? 1 : 0);

    if (draggedBlockIndex < destinationIndex) {
        destinationIndex -= 1;
    }

    return {
        destinationIndex,
        placement: destinationIndex === draggedBlockIndex ? null : placement
    };
}

function getArticleSectionDropTarget(event) {
    const section = event.target.closest(".article-section");

    if (!section) {
        return null;
    }

    const bounds = section.getBoundingClientRect();
    const edgeZone = Math.min(42, bounds.height * 0.22);
    const placement = event.clientY <= bounds.top + edgeZone
        ? "above"
        : event.clientY >= bounds.bottom - edgeZone
            ? "below"
            : null;

    return placement ? { section, placement } : null;
}

function getSectionDropPlacement(section, placement) {
    const sectionIndexes = [...section.querySelectorAll(".block-builder__block")]
        .map((blockElement) => Number(blockElement.dataset.blockIndex));

    const draggedIndexes = draggedSectionBlockIndexes || [draggedBlockIndex];

    if (!sectionIndexes.length || draggedIndexes.some((index) => sectionIndexes.includes(index))) {
        return { destinationIndex: null, placement: null };
    }

    const rawDestinationIndex = placement === "above"
        ? Math.min(...sectionIndexes)
        : Math.max(...sectionIndexes) + 1;

    if (draggedSectionBlockIndexes) {
        return { destinationIndex: rawDestinationIndex, placement };
    }

    const destinationIndex = draggedBlockIndex < rawDestinationIndex
        ? rawDestinationIndex - 1
        : rawDestinationIndex;

    return { destinationIndex, placement };
}

function moveSection(blockIndexes, rawDestinationIndex) {
    const sortedIndexes = [...blockIndexes].sort((first, second) => first - second);

    if (!sortedIndexes.length || rawDestinationIndex === null) {
        return;
    }

    applyContentMutation(() => {
        const blocksToMove = sortedIndexes.map((index) => contentBlocks[index]);
        const movingBlocks = new Set(blocksToMove);
        const adjustedDestinationIndex = rawDestinationIndex - sortedIndexes.filter(
            (index) => index < rawDestinationIndex
        ).length;

        contentBlocks = contentBlocks.filter((block) => !movingBlocks.has(block));
        contentBlocks.splice(adjustedDestinationIndex, 0, ...blocksToMove);
    });
}

function getDroppedImageFile(dataTransfer) {
    const [file] = dataTransfer.files;
    return file || null;
}

function validateImageFile(file) {
    if (!file || !allowedImageTypes.has(file.type)) {
        throw new Error("Choose a JPEG, PNG, or WebP image.");
    }

    if (file.size > maximumImageSize) {
        throw new Error("Images must be 5 MB or smaller.");
    }
}

async function setImageBlockFile(block, file) {
    try {
        validateImageFile(file);
        const imageUrl = await readImageFile(file);
        applyContentMutation(() => {
            block.url = imageUrl;
        });
        showPublishingStatus("Image block ready to publish.");
    } catch (error) {
        showPublishingStatus(error.message);
    }
}

function createImageDropZone(block) {
    const dropZone = document.createElement("label");
    dropZone.className = "block-builder__image-drop-zone";
    dropZone.textContent = "Drop an image here or click to choose one";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.className = "block-builder__image-file-input";
    input.addEventListener("change", () => {
        const [file] = input.files;
        if (file) {
            setImageBlockFile(block, file);
        }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            setDropZoneState(dropZone, true);
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, (event) => {
            event.preventDefault();
            setDropZoneState(dropZone, false);
        });
    });

    dropZone.addEventListener("drop", (event) => {
        const file = getDroppedImageFile(event.dataTransfer);
        if (file) {
            setImageBlockFile(block, file);
        }
    });

    dropZone.append(input);
    return dropZone;
}

function createInlineBlockInsertionMenu(anchorBlock) {
    const menu = document.createElement("details");
    menu.className = "block-builder__insert-menu block-builder__insert-menu--inline-block";

    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", "Insert content block here");
    summary.textContent = "+";
    menu.append(summary);

    const actions = document.createElement("div");
    actions.className = "block-builder__insert-actions";
    Object.entries(blockPresentation).forEach(([type, presentation]) => {
        const button = document.createElement("button");
        button.type = "button";
        const icon = document.createElement("span");
        icon.className = `block-builder__insert-icon block-builder__insert-icon--${type}`;
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = presentation.icon;
        const label = document.createElement("span");
        label.textContent = presentation.label;
        button.append(icon, label);
        button.addEventListener("click", () => {
            applyContentMutation(() => {
                const insertionIndex = contentBlocks.indexOf(anchorBlock) + 1;

                if (insertionIndex === 0) {
                    throw new Error("The block you tried to add content after no longer exists.");
                }

                contentBlocks.splice(insertionIndex, 0, { ...blockDefaults[type] });
            });
        });
        actions.append(button);
    });
    menu.append(actions);

    return menu;
}

function createSectionInsertionControl(insertionIndex) {
    const menu = document.createElement("details");
    menu.className = "article-section__new-section-menu";

    const toggle = document.createElement("summary");
    toggle.className = "article-section__new-section-button";
    toggle.setAttribute("title", "Add content between sections");
    toggle.setAttribute("aria-label", "Add content between sections");
    toggle.textContent = "+";
    menu.append(toggle);

    const actions = document.createElement("div");
    actions.className = "article-section__new-section-actions";
    const addAction = (label, iconText, iconClass, handler) => {
        const button = document.createElement("button");
        button.type = "button";
        const icon = document.createElement("span");
        icon.className = `block-builder__insert-icon ${iconClass}`;
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = iconText;
        const text = document.createElement("span");
        text.textContent = label;
        button.append(icon, text);
        button.addEventListener("click", () => {
            menu.open = false;
            handler();
        });
        actions.append(button);
    };

    addAction("Add new section", "+", "block-builder__insert-icon--heading", () => {
        const heading = { ...blockDefaults.heading };
        const paragraph = { ...blockDefaults.paragraph };

        applyContentMutation(() => {
            // A section always begins with a heading and includes a first paragraph
            // so it has its own editable area immediately after it is created.
            contentBlocks.splice(insertionIndex, 0, heading, paragraph);
            editingSectionHeadingBlocks.add(heading);
            sectionStartHeadings.add(heading);
        });
    });

    [
        ["Add image", "image"],
        ["Add quote", "quote"],
        ["Add video", "youtube"],
        ["Add call to action", "cta"]
    ].forEach(([label, type]) => {
        addAction(label, blockPresentation[type].icon, `block-builder__insert-icon--${type}`, () => {
            applyContentMutation(() => {
                const block = { ...blockDefaults[type] };
                contentBlocks.splice(insertionIndex, 0, block);
                standaloneBetweenSectionBlocks.add(block);
            });
        });
    });

    menu.append(actions);
    return menu;
}

function getYouTubeThumbnailUrl(value) {
    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");
        let videoId;

        if (host === "youtu.be") {
            videoId = url.pathname.slice(1);
        } else if (host === "youtube.com" || host === "m.youtube.com") {
            if (url.pathname === "/watch") {
                videoId = url.searchParams.get("v");
            } else {
                const [prefix, id] = url.pathname.split("/").filter(Boolean);
                if (["embed", "shorts", "live"].includes(prefix)) {
                    videoId = id;
                }
            }
        }

        return /^[A-Za-z0-9_-]{11}$/.test(videoId || "")
            ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            : null;
    } catch {
        return null;
    }
}

function createBlockShowcase(block) {
    if (block.type === "image" && block.url) {
        const image = document.createElement("img");
        image.className = "block-builder__asset block-builder__asset--image";
        image.src = block.url;
        image.alt = "Selected article image";
        return image;
    }

    if (block.type === "youtube") {
        const thumbnailUrl = getYouTubeThumbnailUrl(block.url);
        if (!thumbnailUrl) {
            return null;
        }

        const showcase = document.createElement("div");
        showcase.className = "block-builder__asset block-builder__asset--youtube";
        const thumbnail = document.createElement("img");
        thumbnail.className = "block-builder__youtube-thumbnail";
        thumbnail.src = thumbnailUrl;
        thumbnail.alt = "YouTube video thumbnail";
        thumbnail.addEventListener("error", () => showcase.remove());
        const playIcon = document.createElement("span");
        playIcon.className = "block-builder__youtube-play";
        playIcon.textContent = "▶";
        showcase.append(thumbnail, playIcon);
        return showcase;
    }

    if (block.type === "quote" && block.text) {
        const quote = document.createElement("blockquote");
        quote.className = "block-builder__asset block-builder__asset--quote";
        quote.textContent = `“${block.text}”`;
        return quote;
    }

    if (block.type === "cta" && block.text) {
        const cta = document.createElement("span");
        cta.className = "block-builder__asset block-builder__asset--cta";
        cta.textContent = block.text;
        return cta;
    }

    return null;
}

function chooseImageFileForBlock(block) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.addEventListener("change", () => {
        const [file] = input.files;
        input.remove();
        if (file) {
            setImageBlockFile(block, file);
        }
    }, { once: true });
    input.hidden = true;
    document.body.append(input);
    input.click();
}

function createBlockSettingsMenu(block, index, editor) {
    const menu = document.createElement("details");
    menu.className = "block-builder__settings";

    const summary = document.createElement("summary");
    summary.textContent = "⋮";
    summary.setAttribute("aria-label", "Open block settings");
    menu.append(summary);

    const actions = document.createElement("div");
    actions.className = "block-builder__settings-actions";
    const addAction = (label, handler, shouldClose = true) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
            if (shouldClose) {
                menu.open = false;
            }
            handler();
        });
        actions.append(button);
    };

    if (block.type === "image") {
        addAction("Change image", () => chooseImageFileForBlock(block));
    }

    const typeOptions = document.createElement("div");
    typeOptions.className = "block-builder__settings-type-options";
    typeOptions.hidden = true;
    Object.entries(blockPresentation).forEach(([type, presentation]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = presentation.label;
        button.disabled = type === block.type;
        button.addEventListener("click", () => changeBlockType(block, type));
        typeOptions.append(button);
    });

    addAction("Change element", () => {
        typeOptions.hidden = !typeOptions.hidden;
    }, false);
    actions.append(typeOptions);

    if (!["heading", "paragraph"].includes(block.type)) {
        addAction("Edit", () => {
            editor.open = true;
            editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
    }
    addAction("Remove", () => {
        applyContentMutation(() => {
            contentBlocks.splice(index, 1);
        });
    });

    menu.addEventListener("toggle", () => {
        if (!menu.open) {
            typeOptions.hidden = true;
        }
    });

    menu.append(actions);
    return menu;
}

function createEmptyBlockState() {
    const emptyState = document.createElement("section");
    emptyState.className = "block-builder__empty-state";

    const icon = document.createElement("span");
    icon.className = "block-builder__empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";

    const title = document.createElement("h3");
    title.textContent = "Add your first content block";

    const description = document.createElement("p");
    description.textContent = "Start building your article with text, images, videos, and more.";

    const addArticleButton = document.createElement("button");
    addArticleButton.className = "block-builder__add-article-main";
    addArticleButton.type = "button";
    addArticleButton.textContent = "Add article";
    addArticleButton.title = "Full article entry is coming soon.";
    addArticleButton.disabled = true;

    emptyState.append(icon, title, description, addArticleButton, addBlockMenu);
    return emptyState;
}

function setArticleSectionEditing(section, editButton, headingBlock, isEditing, shouldFocus = false) {
    section.classList.toggle("is-editing", isEditing);
    editButton.textContent = isEditing ? "Done editing" : "Edit section";

    if (!isEditing) {
        editingSectionHeadingBlocks.delete(headingBlock);
        return;
    }

    editingSectionHeadingBlocks.add(headingBlock);
    section.querySelectorAll(".block-builder__editor").forEach((editor) => {
        if (editor.matches("details")) {
            editor.open = true;
        }
    });

    if (shouldFocus) {
        const firstField = section.querySelector(".block-builder__input");
        firstField?.focus({ preventScroll: true });
    }
}

function toggleArticleSectionEditor(section, editButton, headingBlock) {
    setArticleSectionEditing(
        section,
        editButton,
        headingBlock,
        !section.classList.contains("is-editing"),
        true
    );
}

function groupHeadingSections() {
    let activeSection = null;

    const createArticleSection = (anchorBlock, firstBlockElement, beforeSectionControl = null) => {
        const section = document.createElement("section");
        section.className = "article-section";
        section.headingBlock = anchorBlock;

        const header = document.createElement("div");
        header.className = "article-section__header";
        const title = document.createElement("p");
        title.className = "article-section__label";
        title.textContent = "Article section";
        const headerActions = document.createElement("div");
        headerActions.className = "article-section__header-actions";
        const dragHandle = document.createElement("button");
        dragHandle.className = "article-section__drag-handle";
        dragHandle.type = "button";
        dragHandle.draggable = true;
        dragHandle.textContent = "⠿";
        dragHandle.setAttribute("title", "Drag entire article section");
        dragHandle.setAttribute("aria-label", "Drag entire article section");
        dragHandle.addEventListener("dragstart", (event) => {
            const blockIndexes = [...section.querySelectorAll(".block-builder__block")]
                .map((blockElement) => Number(blockElement.dataset.blockIndex));

            if (!blockIndexes.length) {
                event.preventDefault();
                return;
            }

            draggedSectionBlockIndexes = blockIndexes;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", "article-section");
            section.classList.add("is-dragging");
        });
        dragHandle.addEventListener("dragend", () => {
            draggedSectionBlockIndexes = null;
            section.classList.remove("is-dragging");
            contentBlockList.querySelectorAll(".is-dragging-over").forEach((element) => {
                setDropZoneState(element);
            });
        });
        const editButton = document.createElement("button");
        editButton.className = "article-section__edit-button";
        editButton.type = "button";
        editButton.textContent = "Edit section";
        editButton.addEventListener("click", () => {
            toggleArticleSectionEditor(section, editButton, anchorBlock);
        });
        headerActions.append(dragHandle, editButton);
        header.append(title, headerActions);

        contentBlockList.insertBefore(section, firstBlockElement);
        if (beforeSectionControl) {
            contentBlockList.insertBefore(beforeSectionControl, section);
        }
        section.append(header, firstBlockElement);

        if (editingSectionHeadingBlocks.has(anchorBlock)) {
            setArticleSectionEditing(section, editButton, anchorBlock, true);
        }

        return section;
    };

    [...contentBlockList.children].forEach((element) => {
        const isBlock = element.classList.contains("block-builder__block");
        const block = isBlock
            ? contentBlocks[Number(element.dataset.blockIndex)]
            : null;
        const isHeading = block?.type === "heading" && sectionStartHeadings.has(block);

        if (isHeading) {
            const headingBlock = block;
            let betweenSectionsControl = null;

            if (activeSection) {
                // This is deliberately not an inline block picker. It creates a
                // complete article section between the two existing sections.
                betweenSectionsControl = createSectionInsertionControl(
                    Number(element.dataset.blockIndex)
                );
            }

            activeSection = createArticleSection(
                headingBlock,
                element,
                betweenSectionsControl
            );
            return;
        }

        // An imported article can start with paragraphs after its title and SEO
        // summary. Keep those body blocks together in their own section instead
        // of leaving them as ungrouped legacy-style blocks.
        if (isBlock && !activeSection) {
            activeSection = createArticleSection(block, element);
            return;
        }

        // Content added from the between-section menu remains a standalone block
        // between cards. It is never absorbed by the preceding article section.
        if (isBlock && standaloneBetweenSectionBlocks.has(block)) {
            return;
        }

        if (activeSection && isBlock) {
            activeSection.append(element);
            return;
        }
    });

    contentBlockList.querySelectorAll(".article-section").forEach((section) => {
        section.querySelectorAll(".block-builder__block--inline-text").forEach((blockElement) => {
            const dragControl = blockElement.querySelector(".block-builder__drag-control");

            if (!dragControl) {
                return;
            }

            const addContentMenu = createInlineBlockInsertionMenu(
                contentBlocks[Number(blockElement.dataset.blockIndex)]
            );
            addContentMenu.classList.add("block-builder__input-add-content");
            const summary = addContentMenu.querySelector("summary");
            summary.setAttribute("aria-label", "Add content after this block");
            summary.setAttribute("title", "Add content after this block");
            dragControl.append(addContentMenu);
        });
    });
}

document.addEventListener("click", (event) => {
    const editingSection = document.querySelector(".article-section.is-editing");

    if (!editingSection || editingSection.contains(event.target)) {
        return;
    }

    const editButton = editingSection.querySelector(".article-section__edit-button");
    setArticleSectionEditing(
        editingSection,
        editButton,
        editingSection.headingBlock,
        false
    );
}, true);

function renderContentBlocks() {
    const isEmpty = contentBlocks.length === 0;
    postForm.classList.toggle("post-editor-layout--starter", isEmpty);

    if (isEmpty) {
        contentBlockList.replaceChildren(createEmptyBlockState());
        renderPostPreview(getPostData());
        return;
    }

    blockBuilderFooter.append(addBlockMenu);
    contentBlockList.replaceChildren(...contentBlocks.flatMap((block, index) => {
        const blockElement = document.createElement("section");
        blockElement.className = `block-builder__block block-builder__block--${block.type}`;
        blockElement.dataset.blockIndex = index;
        const isInlineTextBlock = ["heading", "paragraph"].includes(block.type);

        if (isInlineTextBlock) {
            blockElement.classList.add("block-builder__block--inline-text");
        }

        const header = document.createElement("div");
        header.className = "block-builder__block-header";

        const identity = document.createElement("div");
        identity.className = "block-builder__identity";
        const dragControl = document.createElement("div");
        dragControl.className = "block-builder__drag-control";
        const dragHandle = document.createElement("button");
        dragHandle.className = "block-builder__drag-handle";
        dragHandle.type = "button";
        dragHandle.textContent = "⠿";
        dragHandle.draggable = true;
        dragHandle.setAttribute("title", "Drag to reorder block");
        dragHandle.setAttribute("aria-label", "Drag to reorder block");
        dragHandle.addEventListener("dragstart", (event) => {
            draggedBlockIndex = index;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
            blockElement.classList.add("is-dragging");
        });
        dragHandle.addEventListener("dragend", () => {
            draggedBlockIndex = null;
            blockElement.classList.remove("is-dragging");
            contentBlockList.querySelectorAll(".is-dragging-over").forEach((element) => {
                setDropZoneState(element);
            });
        });
        const typePicker = createBlockTypePicker(block);
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = blockPresentation[block.type].label;
        const preview = document.createElement("p");
        preview.className = "block-builder__preview";
        preview.textContent = getBlockPreview(block);
        details.append(title, preview);
        dragControl.append(dragHandle);
        identity.append(dragControl, typePicker, details);
        header.append(identity);

        const controls = document.createElement("div");
        controls.className = "block-builder__controls";
        [
            ["↑", "Move block up", index === 0, () => {
                if (index > 0) {
                    applyContentMutation(() => {
                        [contentBlocks[index - 1], contentBlocks[index]] = [
                            contentBlocks[index], contentBlocks[index - 1]
                        ];
                    });
                }
            }],
            ["↓", "Move block down", index === contentBlocks.length - 1, () => {
                if (index < contentBlocks.length - 1) {
                    applyContentMutation(() => {
                        [contentBlocks[index], contentBlocks[index + 1]] = [
                            contentBlocks[index + 1], contentBlocks[index]
                        ];
                    });
                }
            }],
            ["🗑", "Delete block", false, () => {
                applyContentMutation(() => {
                    contentBlocks.splice(index, 1);
                });
            }]
        ].forEach(([label, ariaLabel, disabled, handler]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.setAttribute("aria-label", ariaLabel);
            button.classList.toggle(
                "block-builder__controls-button--delete",
                ariaLabel === "Delete block"
            );
            button.disabled = disabled;
            button.addEventListener("click", handler);
            controls.append(button);
        });
        header.append(controls);
        blockElement.append(header);

        const showcase = createBlockShowcase(block);
        if (showcase) {
            const blockBody = document.createElement("div");
            blockBody.className = "block-builder__block-body";
            blockBody.append(showcase);
            blockElement.append(blockBody);
        }

        const editor = document.createElement(isInlineTextBlock ? "div" : "details");
        editor.className = "block-builder__editor";
        if (!isInlineTextBlock) {
            editor.open = !block.text && !block.url;
            const editorSummary = document.createElement("summary");
            editorSummary.textContent = "Edit block";
            editor.append(editorSummary);
        }

        if (["heading", "paragraph", "quote"].includes(block.type)) {
            editor.append(createBlockField(
                block,
                "text",
                "Text",
                block.type !== "heading"
            ));
        } else if (block.type === "image") {
            editor.append(createBlockField(block, "url", "URL"));
            editor.append(createImageDropZone(block));
        } else if (block.type === "youtube") {
            editor.append(createBlockField(block, "url", "URL"));
        } else {
            editor.append(createBlockField(block, "text", "Button text"));
            editor.append(createBlockField(block, "url", "Destination URL"));
        }

        blockElement.append(editor);
        const settingsMenu = createBlockSettingsMenu(block, index, editor);
        controls.append(settingsMenu);

        if (isInlineTextBlock) {
            blockElement.addEventListener("click", (event) => {
                if (event.target.closest("input, textarea, button, summary, .block-builder__settings")) {
                    return;
                }

                settingsMenu.open = true;
            });
        }

        return [blockElement];
    }));
    groupHeadingSections();
    renderPostPreview(getPostData());
}

["dragenter", "dragover"].forEach((eventName) => {
    contentBlockList.addEventListener(eventName, (event) => {
        const sectionTarget = getArticleSectionDropTarget(event);
        const blockElement = event.target.closest(".block-builder__block");
        const isDraggingSection = Array.isArray(draggedSectionBlockIndexes);
        if (
            (!sectionTarget && !blockElement)
            || (!isDraggingSection && draggedBlockIndex === null)
            || (isDraggingSection && !sectionTarget)
        ) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (sectionTarget) {
            const { placement } = getSectionDropPlacement(
                sectionTarget.section,
                sectionTarget.placement
            );
            setDropZoneState(sectionTarget.section, placement);
            return;
        }

        const { placement } = getBlockDropPlacement(blockElement, event.clientY);
        setDropZoneState(blockElement, placement);
    });
});

contentBlockList.addEventListener("dragleave", (event) => {
    const section = event.target.closest(".article-section");
    if (section && !section.contains(event.relatedTarget)) {
        setDropZoneState(section);
    }

    const blockElement = event.target.closest(".block-builder__block");
    if (blockElement && !blockElement.contains(event.relatedTarget)) {
        setDropZoneState(blockElement);
    }
});

contentBlockList.addEventListener("drop", (event) => {
    const sectionTarget = getArticleSectionDropTarget(event);
    const blockElement = event.target.closest(".block-builder__block");
    const isDraggingSection = Array.isArray(draggedSectionBlockIndexes);
    if (
        (!sectionTarget && !blockElement)
        || (!isDraggingSection && draggedBlockIndex === null)
        || (isDraggingSection && !sectionTarget)
    ) {
        return;
    }

    event.preventDefault();
    const { destinationIndex } = sectionTarget
        ? getSectionDropPlacement(sectionTarget.section, sectionTarget.placement)
        : getBlockDropPlacement(blockElement, event.clientY);

    if (isDraggingSection) {
        moveSection(draggedSectionBlockIndexes, destinationIndex);
    } else {
        moveBlock(draggedBlockIndex, destinationIndex);
    }
    draggedBlockIndex = null;
    draggedSectionBlockIndexes = null;
});

addBlockButtons.forEach((button) => {
    button.addEventListener("click", () => {
        applyContentMutation(() => {
            const newBlock = { ...blockDefaults[button.dataset.addBlock] };
            contentBlocks.push(newBlock);

            if (
                newBlock.type === "heading"
                && !contentBlocks.some((block) => sectionStartHeadings.has(block))
            ) {
                sectionStartHeadings.add(newBlock);
            }
        });
        button.closest(".block-builder__add-menu").open = false;
    });
});

function parseTags(tagsValue) {
    return tagsValue
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function getPostData(status = "draft") {
    return {
        title: postForm.querySelector("#post-title").value.trim(),
        content: "",
        category: postForm.querySelector("#post-category").value,
        tags: parseTags(
            postForm.querySelector("#post-tags").value
        ),
        excerpt: postForm.querySelector("#post-excerpt").value.trim(),
        featuredImage: featuredImageDataUrl,
        contentBlocks: contentBlocks.map((block) => ({ ...block })),
        status,
        publishedDate:
            status === "published"
                ? new Date().toISOString()
                : null
    };
}

function getBlockIndexes(blockSet) {
    return contentBlocks.reduce((indexes, block, index) => {
        if (blockSet.has(block)) {
            indexes.push(index);
        }
        return indexes;
    }, []);
}

function captureAiEditorState() {
    return {
        post: getPostData(),
        sectionStartBlockIndexes: getBlockIndexes(sectionStartHeadings),
        standaloneBlockIndexes: getBlockIndexes(standaloneBetweenSectionBlocks),
        editingHeadingBlockIndexes: getBlockIndexes(editingSectionHeadingBlocks)
    };
}

function restoreAiEditorState(editorState) {
    populatePostForm(editorState.post);
    sectionStartHeadings = new WeakSet();
    standaloneBetweenSectionBlocks = new WeakSet();
    editingSectionHeadingBlocks.clear();

    editorState.sectionStartBlockIndexes.forEach((index) => {
        if (contentBlocks[index]) {
            sectionStartHeadings.add(contentBlocks[index]);
        }
    });
    editorState.standaloneBlockIndexes.forEach((index) => {
        if (contentBlocks[index]) {
            standaloneBetweenSectionBlocks.add(contentBlocks[index]);
        }
    });
    editorState.editingHeadingBlockIndexes.forEach((index) => {
        if (contentBlocks[index]) {
            editingSectionHeadingBlocks.add(contentBlocks[index]);
        }
    });

    renderContentBlocks();
    renderArticleDetails();
    renderPostPreview(getPostData());
}

function showAiAssistantStatus(message, canUndo = false) {
    aiAssistantStatus.hidden = false;
    aiAssistantStatusMessage.textContent = message;
    undoAiAssistantButton.hidden = !canUndo;
}

function createAiDrawerElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text) {
        element.textContent = text;
    }
    return element;
}

function createAiDrawerButton(label, action, accent = false) {
    const button = createAiDrawerElement("button", "aiced-bot-panel__workflow-button", label);
    button.type = "button";
    button.dataset.aicedBotDrawerAction = action;
    if (accent) {
        button.classList.add("aiced-bot-panel__workflow-button--accent");
    }
    return button;
}

function setAiDrawerScreen(mode, content) {
    aiDrawerState = {...aiDrawerState, mode};
    const isIdle = mode === "idle";

    aicedBotIdleContent.hidden = !isIdle;
    aicedBotWorkflowContent.hidden = isIdle;
    aicedBotPanelComposer.hidden = !isIdle;

    if (isIdle) {
        aicedBotWorkflowContent.replaceChildren();
        return;
    }

    aicedBotWorkflowContent.replaceChildren(...content);
}

function showAiIdle() {
    aiDrawerState = {mode: "idle", beforeState: null, afterState: null};
    setAiDrawerScreen("idle", []);
}

function getBlockText(block) {
    return block?.text || block?.url || "";
}

function getBlockLabel(block) {
    const label = block?.type || "content";
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function haveSameTextList(first, second) {
    return first.length === second.length && first.every((item, index) => item === second[index]);
}

function getAiChangeSummary(beforeState, afterState) {
    const before = beforeState.post;
    const after = afterState.post;
    const fieldChanges = [];

    [
        ["Title", before.title, after.title],
        ["SEO summary", before.excerpt, after.excerpt],
        ["Category", before.category, after.category]
    ].forEach(([label, beforeValue, afterValue]) => {
        if (beforeValue !== afterValue) {
            fieldChanges.push({label, before: beforeValue, after: afterValue});
        }
    });

    if (!haveSameTextList(before.tags, after.tags)) {
        fieldChanges.push({
            label: "Tags",
            before: before.tags.join(", "),
            after: after.tags.join(", ")
        });
    }

    const blockChanges = [];
    const changedBlockCounts = {heading: 0, paragraph: 0, quote: 0};
    const maximumBlockLength = Math.max(before.contentBlocks.length, after.contentBlocks.length);

    for (let index = 0; index < maximumBlockLength; index += 1) {
        const beforeBlock = before.contentBlocks[index];
        const afterBlock = after.contentBlocks[index];
        const isChanged = beforeBlock?.type !== afterBlock?.type
            || getBlockText(beforeBlock) !== getBlockText(afterBlock);

        if (!isChanged) {
            continue;
        }

        const blockType = afterBlock?.type || beforeBlock?.type;
        if (Object.hasOwn(changedBlockCounts, blockType)) {
            changedBlockCounts[blockType] += 1;
        }
        blockChanges.push({
            index,
            label: getBlockLabel(afterBlock || beforeBlock),
            before: getBlockText(beforeBlock),
            after: getBlockText(afterBlock)
        });
    }

    const blockCountChanges = ["heading", "paragraph", "quote"].flatMap((type) => {
        const beforeCount = before.contentBlocks.filter((block) => block.type === type).length;
        const afterCount = after.contentBlocks.filter((block) => block.type === type).length;
        return beforeCount === afterCount
            ? []
            : [{label: `${getBlockLabel({type})} blocks`, before: beforeCount, after: afterCount}];
    });

    return {fieldChanges, blockChanges, blockCountChanges, changedBlockCounts};
}

function showAiProcessing(beforeState) {
    const image = document.createElement("img");
    image.className = "aiced-bot-panel__workflow-bot";
    image.src = "/static/images/aicedbotrunning.png";
    image.alt = "Aiced Bot is working";

    const title = createAiDrawerElement("h2", "aiced-bot-panel__workflow-title", "Improving SEO...");
    const description = createAiDrawerElement(
        "p",
        "aiced-bot-panel__workflow-description",
        "Aiced Bot is reviewing your article for search clarity."
    );
    const label = createAiDrawerElement("p", "aiced-bot-panel__workflow-label", "Analyzing:");
    const list = createAiDrawerElement("ul", "aiced-bot-panel__workflow-list");
    ["Title", "SEO summary", "Headings", "Keyword clarity"].forEach((item) => {
        list.append(createAiDrawerElement("li", "", item));
    });

    aiDrawerState = {mode: "processing", beforeState, afterState: null};
    setAiDrawerScreen("processing", [image, title, description, label, list]);
}

function getSuccessSummaryItems(summary) {
    const items = [
        ...summary.fieldChanges.map((change) => change.label),
        ...summary.blockCountChanges.map((change) => `${change.label} (${change.before} → ${change.after})`),
        ...Object.entries(summary.changedBlockCounts)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => `${count} ${type} block${count === 1 ? "" : "s"} updated`)
    ];

    return items.length ? items : ["Search clarity refinements"];
}

function showAiSuccess(beforeState, afterState) {
    const summary = getAiChangeSummary(beforeState, afterState);
    const title = createAiDrawerElement("h2", "aiced-bot-panel__workflow-title", "SEO improved");
    const description = createAiDrawerElement(
        "p",
        "aiced-bot-panel__workflow-description",
        "Your editor has been updated. Review the changes before publishing."
    );
    const label = createAiDrawerElement("p", "aiced-bot-panel__workflow-label", "I updated:");
    const list = createAiDrawerElement("ul", "aiced-bot-panel__workflow-list");
    getSuccessSummaryItems(summary).forEach((item) => {
        list.append(createAiDrawerElement("li", "", item));
    });
    const actions = createAiDrawerElement("div", "aiced-bot-panel__workflow-actions");
    actions.append(
        createAiDrawerButton("Review changes", "review", true),
        createAiDrawerButton("Undo", "undo")
    );

    aiDrawerState = {mode: "success", beforeState, afterState, summary};
    setAiDrawerScreen("success", [title, description, label, list, actions]);
}

function createAiReviewItem(label, beforeValue, afterValue) {
    const item = createAiDrawerElement("section", "aiced-bot-panel__review-item");
    item.append(createAiDrawerElement("h3", "", label));

    const before = createAiDrawerElement("div", "aiced-bot-panel__review-value");
    before.append(createAiDrawerElement("strong", "", "Before"));
    before.append(createAiDrawerElement("p", "", beforeValue || "—"));

    const after = createAiDrawerElement("div", "aiced-bot-panel__review-value");
    after.append(createAiDrawerElement("strong", "", "After"));
    after.append(createAiDrawerElement("p", "", afterValue || "—"));
    item.append(before, after);
    return item;
}

function showAiReview() {
    const {beforeState, afterState, summary} = aiDrawerState;
    const title = createAiDrawerElement("h2", "aiced-bot-panel__workflow-title", "Review SEO changes");
    const description = createAiDrawerElement(
        "p",
        "aiced-bot-panel__workflow-description",
        "Only fields and content blocks that changed are shown."
    );
    const review = createAiDrawerElement("div", "aiced-bot-panel__review");

    summary.fieldChanges.forEach((change) => {
        review.append(createAiReviewItem(change.label, change.before, change.after));
    });
    summary.blockChanges.forEach((change) => {
        review.append(createAiReviewItem(`${change.label} ${change.index + 1}`, change.before, change.after));
    });

    if (!review.childElementCount) {
        review.append(createAiDrawerElement("p", "aiced-bot-panel__workflow-description", "No visible changes were returned."));
    }

    const actions = createAiDrawerElement("div", "aiced-bot-panel__workflow-actions");
    actions.append(
        createAiDrawerButton("Back", "success"),
        createAiDrawerButton("Undo", "undo")
    );
    setAiDrawerScreen("review", [title, description, review, actions]);
}

function showAiError() {
    const title = createAiDrawerElement("h2", "aiced-bot-panel__workflow-title", "Couldn't improve SEO");
    const description = createAiDrawerElement(
        "p",
        "aiced-bot-panel__workflow-description",
        "Your original article has not been changed."
    );
    const actions = createAiDrawerElement("div", "aiced-bot-panel__workflow-actions");
    actions.append(
        createAiDrawerButton("Try again", "retry", true),
        createAiDrawerButton("Back", "idle")
    );
    setAiDrawerScreen("error", [title, description, actions]);
}

function showAiUndoComplete() {
    const title = createAiDrawerElement("h2", "aiced-bot-panel__workflow-title", "Changes undone");
    const description = createAiDrawerElement(
        "p",
        "aiced-bot-panel__workflow-description",
        "Your original article has been restored."
    );
    const actions = createAiDrawerElement("div", "aiced-bot-panel__workflow-actions");
    actions.append(createAiDrawerButton("Back to actions", "idle", true));
    setAiDrawerScreen("undone", [title, description, actions]);
}

function undoAiChanges() {
    if (!aiUndoState) {
        return;
    }

    restoreAiEditorState(aiUndoState);
    aiUndoState = null;
    setAicedBotPanelOpen(true);
    showAiUndoComplete();
    showAiAssistantStatus("SEO changes undone");
    showPublishingStatus("SEO changes undone.");
}

async function improveSeo() {
    if (isAiEditProcessing) {
        return;
    }

    const editorState = captureAiEditorState();
    const { title, excerpt, category, tags, contentBlocks } = editorState.post;
    const requestBody = {
        action: "seo",
        title,
        excerpt,
        category,
        tags,
        contentBlocks
    };

    isAiEditProcessing = true;
    setAicedBotPanelOpen(true);
    showAiProcessing(editorState);
    improveSeoButton.disabled = true;
    improveSeoButton.classList.add("is-loading");
    showAiAssistantStatus("Aiced Bot is improving SEO...");
    showPublishingStatus("Aiced Bot is improving SEO...");

    try {
        const response = await fetch("/api/posts/ai-edit", {
            method: "POST",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(requestBody)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || "AI could not improve SEO right now.");
        }

        if (!Array.isArray(result.contentBlocks) || !result.title || !result.excerpt) {
            throw new Error("AI returned an unusable result.");
        }

        aiUndoState = editorState;
        populatePostForm({
            ...result,
            featuredImage: editorState.post.featuredImage
        });
        const afterState = captureAiEditorState();
        showAiSuccess(editorState, afterState);
        showAiAssistantStatus("SEO improved", true);
        showPublishingStatus("SEO improved. Review the changes before publishing.");
    } catch (error) {
        const message = error instanceof TypeError
            ? "Network error. Check your connection and try again."
            : "Aiced Bot could not improve SEO right now.";
        showAiError();
        showAiAssistantStatus(message);
        showPublishingStatus(message);
        console.error("Unable to improve SEO:", error);
    } finally {
        isAiEditProcessing = false;
        improveSeoButton.disabled = false;
        improveSeoButton.classList.remove("is-loading");
    }
}

function readImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener("load", () => {
            resolve(reader.result);
        });

        reader.addEventListener("error", () => {
            reject(new Error("The image could not be read."));
        });

        reader.readAsDataURL(file);
    });
}

function getCategoryLabel(categoryValue) {
    const categoryOption = Array.from(
        postForm.querySelector("#post-category").options
    ).find((option) => option.value === categoryValue);

    return categoryOption?.textContent || "Select a category";
}

function renderPostPreview(post) {
    previewTitle.textContent = post.title || "Your post title will pop up here";
    previewExcerpt.textContent =
        post.excerpt || "Add the description and info of the post";
    previewCategory.textContent = getCategoryLabel(post.category);
    previewImage.hidden = !post.featuredImage;
    previewImageButton.hidden = !post.featuredImage;
    previewNoImage.hidden = Boolean(post.featuredImage);
    removeThumbnailButton.hidden = !post.featuredImage;
    featuredImageDropZone.classList.toggle("is-empty", !post.featuredImage);
    if (post.featuredImage) {
        previewImage.src = post.featuredImage;
    } else {
        previewImage.removeAttribute("src");
    }
    renderContentPreview(post.contentBlocks);
}

function renderContentPreview(blocks) {
    previewContent.replaceChildren(...blocks.map((block) => {
        const element = document.createElement(
            block.type === "heading" ? "h4" : "p"
        );
        element.className = `editor-preview__block editor-preview__block--${block.type}`;

        if (block.type === "image") {
            const image = document.createElement("img");
            image.src = block.url;
            image.alt = "Article block preview";
            element.replaceWith(image);
            image.className = "editor-preview__block editor-preview__block--image";
            return image;
        }

        if (block.type === "youtube") {
            element.textContent = block.url
                ? "▶ YouTube video"
                : "▶ YouTube video block";
            return element;
        }

        if (block.type === "cta") {
            element.textContent = block.text || "Call to action";
            return element;
        }

        element.textContent = block.text || `${blockPresentation[block.type].label} block`;
        return element;
    }));
}

function renderFullPostPreview() {
    renderPostPreview(getPostData("draft"));

    const previewClone = document.querySelector("#post-preview").cloneNode(true);
    previewClone.removeAttribute("id");
    previewClone.classList.add("editor-preview--full");
    previewClone.querySelectorAll("[id]").forEach((element) => {
        element.removeAttribute("id");
    });
    fullPreviewMockup.replaceChildren(previewClone);
}

function showPublishingStatus(message) {
    publishingStatus.textContent = message;
}

function populatePostForm(post) {
    postForm.querySelector("#post-title").value = post.title || "";
    postForm.querySelector("#post-category").value = post.category || "";
    postForm.querySelector("#post-tags").value = (post.tags || []).join(", ");
    postForm.querySelector("#post-excerpt").value = post.excerpt || "";

    featuredImageDataUrl = post.featuredImage || null;
    editingSectionHeadingBlocks.clear();
    resetStandaloneBetweenSectionBlocks();
    contentBlocks = Array.isArray(post.contentBlocks)
        ? post.contentBlocks.map((block) => ({ ...block }))
        : [];
    markExistingHeadingsAsSectionStarts();
    renderContentBlocks();
    renderArticleDetails();
    renderPostPreview(post);
}

function saveDraft() {
    const draft = getPostData("draft");

    try {
        if (isDemoMode) {
            localStorage.setItem(demoDraftStorageKey, JSON.stringify(draft));
        } else {
            postStorage.saveDraft(draft);
        }
        renderPostPreview(draft);
        showPublishingStatus(
            isDemoMode
                ? "Demo draft saved in this browser only."
                : "Draft saved in this browser."
        );
        console.log("Saved draft:", draft);
    } catch (error) {
        showPublishingStatus("The draft could not be saved.");
        console.error("Unable to save draft:", error);
    }
}

async function publishPost() {
    if (isPublishing || !postForm.reportValidity()) {
        return;
    }

    if (!featuredImageDataUrl && !window.confirm(
        "Are you sure you want to publish without a cover photo?"
    )) {
        showPublishingStatus("Add a cover photo whenever you are ready, then publish.");
        return;
    }

    if (isDemoMode) {
        const demoPost = getPostData("published");
        try {
            localStorage.setItem(demoPublishedStorageKey, JSON.stringify(demoPost));
            renderPostPreview(demoPost);
            showPublishingStatus("Demo published in this browser only. No public post was created.");
        } catch (error) {
            showPublishingStatus("This demo post is too large to save in the browser, but you can keep previewing it.");
        }
        return;
    }

    const { publishedDate, ...postData } = getPostData("published");
    isPublishing = true;
    publishPostButton.disabled = true;
    showPublishingStatus("Publishing post...");

    try {
        const createdPost = await sendPost(postData);

        if (!createdPost?.id) {
            throw new Error("The server did not return a post ID.");
        }

        showPublishingStatus("Post published. Opening article...");
        window.setTimeout(() => {
            window.location.assign(`/posts/${createdPost.id}`);
        }, 250);
    } catch (error) {
        const message = error instanceof TypeError
            ? "Network error. Check your connection and try again."
            : error.message;

        showPublishingStatus(`The post could not be published: ${message}`);
        console.error("Unable to publish post:", error);
        isPublishing = false;
        publishPostButton.disabled = false;
    }
}

async function sendPost(postData) {
    const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(postData)
    });

    const contentType = response.headers.get("content-type") ?? "";
    const responseData = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        throw new Error(
            responseData?.message ||
            `Post request failed with status ${response.status}`
        );
    }

    return responseData;
}

async function setFeaturedImageFile(selectedFile) {
    try {
        validateImageFile(selectedFile);
        featuredImageDataUrl = await readImageFile(selectedFile);
        renderPostPreview(getPostData());
        showPublishingStatus("Featured image ready to publish.");
    } catch (error) {
        featuredImageDataUrl = null;
        showPublishingStatus(error.message);
        console.error(error);
    }
}

featuredImageInput.addEventListener("change", (event) => {
    const [selectedFile] = event.target.files;
    if (selectedFile) {
        setFeaturedImageFile(selectedFile);
    }
});

function openFeaturedImagePicker(event) {
    if (
        event.target === featuredImageInput
        || event.target.closest("#view-thumbnail-button, #remove-thumbnail-button")
    ) {
        return;
    }

    featuredImageInput.click();
}

featuredImageDropZone.addEventListener("click", openFeaturedImagePicker);
featuredImageDropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFeaturedImagePicker(event);
    }
});

["dragenter", "dragover"].forEach((eventName) => {
    featuredImageDropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        setDropZoneState(featuredImageDropZone, true);
    });
});

["dragleave", "drop"].forEach((eventName) => {
    featuredImageDropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        setDropZoneState(featuredImageDropZone, false);
    });
});

featuredImageDropZone.addEventListener("drop", (event) => {
    const file = getDroppedImageFile(event.dataTransfer);
    if (file) {
        setFeaturedImageFile(file);
    }
});

viewThumbnailButton.addEventListener("click", () => {
    if (!featuredImageDataUrl) {
        return;
    }

    thumbnailViewerImage.src = featuredImageDataUrl;
    thumbnailViewerDialog.showModal();
});

closeThumbnailViewerButton.addEventListener("click", () => {
    thumbnailViewerDialog.close();
});

removeThumbnailButton.addEventListener("click", () => {
    thumbnailRemoveDialog.showModal();
});

cancelThumbnailRemoveButton.addEventListener("click", () => {
    thumbnailRemoveDialog.close();
});

confirmThumbnailRemoveButton.addEventListener("click", () => {
    featuredImageDataUrl = null;
    featuredImageInput.value = "";
    thumbnailRemoveDialog.close();
    renderPostPreview(getPostData());
    showPublishingStatus("Post thumbnail removed.");
});

previewButton.addEventListener("click", () => {
    renderFullPostPreview();
    fullPreviewDialog.showModal();
});

closeFullPreviewButton.addEventListener("click", () => {
    fullPreviewDialog.close();
});

fullPreviewDialog.addEventListener("click", (event) => {
    if (event.target === fullPreviewDialog) {
        fullPreviewDialog.close();
    }
});

[
    "#post-title",
    "#post-excerpt",
    "#post-tags"
].forEach((selector) => {
    postForm.querySelector(selector).addEventListener("input", () => {
        renderArticleDetails();
        renderPostPreview(getPostData());
    });
});

postForm.querySelector("#post-category").addEventListener("change", () => {
    renderPostPreview(getPostData());
});

saveDraftButton.addEventListener("click", saveDraft);
publishPostButton.addEventListener("click", publishPost);
articleDetailsEditButton.addEventListener("click", toggleArticleDetailsEditor);
improveSeoButton.addEventListener("click", improveSeo);
undoAiAssistantButton.addEventListener("click", undoAiChanges);

aicedBotPanelBody.addEventListener("click", (event) => {
    const idleAction = event.target.closest('[data-aiced-bot-action="improve_seo"]');
    if (idleAction) {
        improveSeo();
        return;
    }

    const actionButton = event.target.closest("[data-aiced-bot-drawer-action]");
    if (!actionButton) {
        return;
    }

    switch (actionButton.dataset.aicedBotDrawerAction) {
        case "review":
            showAiReview();
            break;
        case "success":
            showAiSuccess(aiDrawerState.beforeState, aiDrawerState.afterState);
            break;
        case "undo":
            undoAiChanges();
            break;
        case "retry":
            improveSeo();
            break;
        case "idle":
            showAiIdle();
            break;
        default:
            break;
    }
});

aicedBotLauncher.addEventListener("click", () => {
    setAicedBotPanelOpen(aicedBotPanelBackdrop.hidden);
});

closeAicedBotPanelButton.addEventListener("click", () => {
    setAicedBotPanelOpen(false);
});

aiAssistantCardToggleButton.addEventListener("click", () => {
    const isExpanded = aiAssistantCardToggleButton.getAttribute("aria-expanded") === "true";

    aiAssistantCardToggleButton.setAttribute("aria-expanded", String(!isExpanded));
    aiAssistantCardToggleButton.setAttribute(
        "aria-label",
        isExpanded ? "Expand Aiced Bot panel" : "Collapse Aiced Bot panel"
    );
    aiAssistantCardToggleButton.title = isExpanded
        ? "Expand Aiced Bot panel"
        : "Collapse Aiced Bot panel";
    aiAssistantCardContent.hidden = isExpanded;
});

aicedBotPanelBackdrop.addEventListener("click", (event) => {
    if (event.target === aicedBotPanelBackdrop) {
        setAicedBotPanelOpen(false);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !aicedBotPanelBackdrop.hidden) {
        setAicedBotPanelOpen(false);
    }
});

renderContentBlocks();
renderArticleDetails();

const builderQuery = new URLSearchParams(window.location.search);

if (["pasted", "enhanced"].includes(builderQuery.get("import"))) {
    const storedPostImport = sessionStorage.getItem("cmsPastedPostImport");

    try {
        const postImport = JSON.parse(storedPostImport || "{}");
        editingSectionHeadingBlocks.clear();
        resetStandaloneBetweenSectionBlocks();
        contentBlocks = Array.isArray(postImport.contentBlocks)
            ? postImport.contentBlocks.filter((block) => (
                ["heading", "paragraph", "quote"].includes(block.type)
                && typeof block.text === "string"
                && block.text.trim()
            ))
            : [];
        markExistingHeadingsAsSectionStarts();

        postForm.querySelector("#post-title").value = typeof postImport.title === "string"
            ? postImport.title.slice(0, 100)
            : "";
        postForm.querySelector("#post-excerpt").value = typeof postImport.excerpt === "string"
            ? postImport.excerpt.slice(0, 160)
            : "";
        postForm.querySelector("#post-category").value = typeof postImport.category === "string"
            ? postImport.category
            : "";
        postForm.querySelector("#post-tags").value = Array.isArray(postImport.tags)
            ? postImport.tags.filter((tag) => typeof tag === "string").join(", ")
            : "";
        sessionStorage.removeItem("cmsPastedPostImport");

        renderContentBlocks();
        renderArticleDetails();
        renderPostPreview(getPostData());
        showPublishingStatus("Your title, SEO summary, post details, and article blocks are ready to edit.");
    } catch (error) {
        sessionStorage.removeItem("cmsPastedPostImport");
        console.error("Unable to import pasted article:", error);
    }
}

if (builderQuery.get("draft") === "continue") {
    const savedDraft = postStorage.getDraft();

    if (savedDraft) {
        populatePostForm(savedDraft);
        showPublishingStatus("Continued your saved browser draft.");
    }
}
