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
const publishingActionSelector = document.querySelector(
    "#publishing-action-selector"
);

const publishingActionLabel = document.querySelector(
    "#publishing-action-label"
);

const publishingActionLabels = {
    publish: "Publish post",
    campaign: "Send campaign",
    both: "Publish and send"
};

publishingActionSelector.addEventListener("change", (event) => {
    const selectedAction = event.target.value;

    publishingActionLabel.textContent =
        publishingActionLabels[selectedAction];
});
// Post form data
const postForm = document.querySelector("[data-post-form]");
const saveDraftButton = document.querySelector("#save-draft-button");
const previewButton = document.querySelector("#preview-button");
const publishPostButton = document.querySelector("#publish-post-button");
const featuredImageInput = document.querySelector("#post-featured-image");
const previewImage = document.querySelector("#preview-image");
const previewCategory = document.querySelector("#preview-category");
const previewTitle = document.querySelector("#preview-title");
const previewExcerpt = document.querySelector("#preview-excerpt");
const publishingStatus = document.querySelector("#publishing-status");

const defaultPreviewImage = previewImage.src;
let featuredImageDataUrl = null;
let isPublishing = false;

function parseTags(tagsValue) {
    return tagsValue
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function getPostData(status = "draft") {
    return {
        title: postForm.querySelector("#post-title").value.trim(),
        content: postForm.querySelector("#post-content").value.trim(),
        category: postForm.querySelector("#post-category").value,
        tags: parseTags(
            postForm.querySelector("#post-tags").value
        ),
        excerpt: postForm.querySelector("#post-excerpt").value.trim(),
        featuredImage: featuredImageDataUrl,
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
            reject(new Error("The featured image could not be read."));
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
    previewImage.src = post.featuredImage || defaultPreviewImage;
}

function showPublishingStatus(message) {
    publishingStatus.textContent = message;
}

function populatePostForm(post) {
    postForm.querySelector("#post-title").value = post.title || "";
    postForm.querySelector("#post-content").value = post.content || "";
    postForm.querySelector("#post-category").value = post.category || "";
    postForm.querySelector("#post-tags").value = (post.tags || []).join(", ");
    postForm.querySelector("#post-excerpt").value = post.excerpt || "";

    featuredImageDataUrl = post.featuredImage || null;
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

featuredImageInput.addEventListener("change", async (event) => {
    const [selectedFile] = event.target.files;

    if (!selectedFile) {
        featuredImageDataUrl = null;
        renderPostPreview(getPostData());
        return;
    }

    try {
        featuredImageDataUrl = await readImageFile(selectedFile);
        renderPostPreview(getPostData());
        showPublishingStatus("Featured image ready for local preview.");
    } catch (error) {
        featuredImageDataUrl = null;
        showPublishingStatus(error.message);
        console.error(error);
    }
});

previewButton.addEventListener("click", () => {
    const post = getPostData("draft");
    renderPostPreview(post);
    document.querySelector("#post-preview").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

saveDraftButton.addEventListener("click", saveDraft);
publishPostButton.addEventListener("click", publishPost);

const savedDraft = postStorage.getDraft();

if (savedDraft) {
    populatePostForm(savedDraft);
    showPublishingStatus("Saved draft restored from this browser.");
}
