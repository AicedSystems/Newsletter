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
const saveDraftButton = document.querySelector("#save-draft-button");
const previewButton = document.querySelector("#preview-button");
const publishPostButton = document.querySelector("#publish-post-button");
const featuredImageInput = document.querySelector("#post-featured-image");
const previewImage = document.querySelector("#preview-image");
const previewNoImage = document.querySelector("#preview-no-image");
const previewCategory = document.querySelector("#preview-category");
const previewTitle = document.querySelector("#preview-title");
const previewExcerpt = document.querySelector("#preview-excerpt");
const previewContent = document.querySelector("#preview-content");
const publishingStatus = document.querySelector("#publishing-status");
const contentBlockList = document.querySelector("#content-block-list");
const addBlockButtons = document.querySelectorAll("[data-add-block]");
const featuredImageDropZone = document.querySelector("#featured-image-drop-zone");
const thumbnailPreview = document.querySelector("#thumbnail-preview");
const thumbnailPreviewImage = document.querySelector("#thumbnail-preview-image");
const viewThumbnailButton = document.querySelector("#view-thumbnail-button");
const removeThumbnailButton = document.querySelector("#remove-thumbnail-button");
const thumbnailViewerDialog = document.querySelector("#thumbnail-viewer-dialog");
const thumbnailViewerImage = document.querySelector("#thumbnail-viewer-image");
const closeThumbnailViewerButton = document.querySelector("#close-thumbnail-viewer-button");
const thumbnailRemoveDialog = document.querySelector("#thumbnail-remove-dialog");
const cancelThumbnailRemoveButton = document.querySelector("#cancel-thumbnail-remove-button");
const confirmThumbnailRemoveButton = document.querySelector("#confirm-thumbnail-remove-button");

let featuredImageDataUrl = null;
let isPublishing = false;
let contentBlocks = [];
let draggedBlockIndex = null;

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

function createBlockField(block, field, labelText, multiline = false) {
    const fieldWrapper = document.createElement("label");
    fieldWrapper.className = "block-builder__field";
    fieldWrapper.textContent = labelText;

    const control = document.createElement(multiline ? "textarea" : "input");
    control.className = "block-builder__input";
    control.type = field === "url" ? "url" : "text";
    control.value = block[field] || "";
    control.rows = multiline ? 4 : undefined;
    control.addEventListener("input", (event) => {
        block[field] = event.target.value;
        renderPostPreview(getPostData());
    });
    control.addEventListener("change", () => {
        renderContentBlocks();
    });

    fieldWrapper.append(control);
    return fieldWrapper;
}

function getBlockPreview(block) {
    if (block.type === "cta") {
        return block.text || "Add call to action text";
    }

    return block.text || block.url || `Add ${blockPresentation[block.type].label.toLowerCase()} content`;
}

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

    const [movedBlock] = contentBlocks.splice(fromIndex, 1);
    contentBlocks.splice(toIndex, 0, movedBlock);
    renderContentBlocks();
}

function setDropZoneState(element, isActive) {
    element.classList.toggle("is-dragging-over", isActive);
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
        block.url = await readImageFile(file);
        renderContentBlocks();
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

function createInsertionMenu(insertionIndex) {
    const menu = document.createElement("details");
    menu.className = "block-builder__insert-menu";

    const summary = document.createElement("summary");
    summary.setAttribute("aria-label", "Insert content block here");
    summary.textContent = "+";
    menu.append(summary);

    const actions = document.createElement("div");
    actions.className = "block-builder__insert-actions";
    Object.entries(blockPresentation).forEach(([type, presentation]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = presentation.label;
        button.addEventListener("click", () => {
            contentBlocks.splice(insertionIndex, 0, { ...blockDefaults[type] });
            renderContentBlocks();
        });
        actions.append(button);
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
    const addAction = (label, handler) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
            menu.open = false;
            handler();
        });
        actions.append(button);
    };

    if (block.type === "image") {
        addAction("Change image", () => chooseImageFileForBlock(block));
    }

    addAction("Edit", () => {
        editor.open = true;
        editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    addAction("Remove", () => {
        contentBlocks.splice(index, 1);
        renderContentBlocks();
    });

    menu.append(actions);
    return menu;
}

function renderContentBlocks() {
    contentBlockList.replaceChildren(...contentBlocks.flatMap((block, index) => {
        const blockElement = document.createElement("section");
        blockElement.className = `block-builder__block block-builder__block--${block.type}`;
        blockElement.dataset.blockIndex = index;

        const header = document.createElement("div");
        header.className = "block-builder__block-header";

        const identity = document.createElement("div");
        identity.className = "block-builder__identity";
        const dragHandle = document.createElement("span");
        dragHandle.className = "block-builder__drag-handle";
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
                element.classList.remove("is-dragging-over");
            });
        });
        const icon = document.createElement("span");
        icon.className = `block-builder__icon block-builder__icon--${block.type}`;
        icon.textContent = blockPresentation[block.type].icon;
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = blockPresentation[block.type].label;
        const preview = document.createElement("p");
        preview.className = "block-builder__preview";
        preview.textContent = getBlockPreview(block);
        details.append(title, preview);
        identity.append(dragHandle, icon, details);
        header.append(identity);

        const controls = document.createElement("div");
        controls.className = "block-builder__controls";
        [
            ["↑", "Move block up", index === 0, () => {
                if (index > 0) {
                    [contentBlocks[index - 1], contentBlocks[index]] = [
                        contentBlocks[index], contentBlocks[index - 1]
                    ];
                    renderContentBlocks();
                }
            }],
            ["↓", "Move block down", index === contentBlocks.length - 1, () => {
                if (index < contentBlocks.length - 1) {
                    [contentBlocks[index], contentBlocks[index + 1]] = [
                        contentBlocks[index + 1], contentBlocks[index]
                    ];
                    renderContentBlocks();
                }
            }],
            ["🗑", "Delete block", false, () => {
                contentBlocks.splice(index, 1);
                renderContentBlocks();
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

        const editor = document.createElement("details");
        editor.className = "block-builder__editor";
        editor.open = !block.text && !block.url;
        const editorSummary = document.createElement("summary");
        editorSummary.textContent = "Edit block";
        editor.append(editorSummary);

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
        controls.append(createBlockSettingsMenu(block, index, editor));

        return index === contentBlocks.length - 1
            ? [blockElement]
            : [blockElement, createInsertionMenu(index + 1)];
    }));
    renderPostPreview(getPostData());
}

["dragenter", "dragover"].forEach((eventName) => {
    contentBlockList.addEventListener(eventName, (event) => {
        const blockElement = event.target.closest(".block-builder__block");
        if (!blockElement || draggedBlockIndex === null) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropZoneState(blockElement, true);
    });
});

contentBlockList.addEventListener("dragleave", (event) => {
    const blockElement = event.target.closest(".block-builder__block");
    if (blockElement && !blockElement.contains(event.relatedTarget)) {
        setDropZoneState(blockElement, false);
    }
});

contentBlockList.addEventListener("drop", (event) => {
    const blockElement = event.target.closest(".block-builder__block");
    if (!blockElement || draggedBlockIndex === null) {
        return;
    }

    event.preventDefault();
    const targetIndex = Number(blockElement.dataset.blockIndex);
    const insertAfter = event.clientY > (
        blockElement.getBoundingClientRect().top + blockElement.offsetHeight / 2
    );
    let destinationIndex = targetIndex + (insertAfter ? 1 : 0);

    if (draggedBlockIndex < destinationIndex) {
        destinationIndex -= 1;
    }

    moveBlock(draggedBlockIndex, destinationIndex);
    draggedBlockIndex = null;
});

addBlockButtons.forEach((button) => {
    button.addEventListener("click", () => {
        contentBlocks.push({ ...blockDefaults[button.dataset.addBlock] });
        button.closest(".block-builder__add-menu").open = false;
        renderContentBlocks();
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
    previewNoImage.hidden = Boolean(post.featuredImage);
    if (post.featuredImage) {
        previewImage.src = post.featuredImage;
    } else {
        previewImage.removeAttribute("src");
    }
    renderThumbnailPreview(post.featuredImage);
    renderContentPreview(post.contentBlocks);
}

function renderThumbnailPreview(imageSource) {
    const hasThumbnail = Boolean(imageSource);
    thumbnailPreview.hidden = !hasThumbnail;

    if (!hasThumbnail) {
        thumbnailPreviewImage.removeAttribute("src");
        return;
    }

    thumbnailPreviewImage.src = imageSource;
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

function showPublishingStatus(message) {
    publishingStatus.textContent = message;
}

function populatePostForm(post) {
    postForm.querySelector("#post-title").value = post.title || "";
    postForm.querySelector("#post-category").value = post.category || "";
    postForm.querySelector("#post-tags").value = (post.tags || []).join(", ");
    postForm.querySelector("#post-excerpt").value = post.excerpt || "";

    featuredImageDataUrl = post.featuredImage || null;
    contentBlocks = Array.isArray(post.contentBlocks)
        ? post.contentBlocks.map((block) => ({ ...block }))
        : [];
    renderContentBlocks();
    renderPostPreview(post);
}

function saveDraft() {
    const draft = getPostData("draft");

    try {
        postStorage.saveDraft(draft);
        renderPostPreview(draft);
        showPublishingStatus("Draft saved in this browser.");
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
    const post = getPostData("draft");
    renderPostPreview(post);
    document.querySelector("#post-preview").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

[
    "#post-title",
    "#post-excerpt",
    "#post-tags"
].forEach((selector) => {
    postForm.querySelector(selector).addEventListener("input", () => {
        renderPostPreview(getPostData());
    });
});

postForm.querySelector("#post-category").addEventListener("change", () => {
    renderPostPreview(getPostData());
});

saveDraftButton.addEventListener("click", saveDraft);
publishPostButton.addEventListener("click", publishPost);

const savedDraft = postStorage.getDraft();

if (savedDraft) {
    populatePostForm(savedDraft);
    showPublishingStatus("Saved draft restored from this browser.");
}

renderPostPreview(getPostData());
