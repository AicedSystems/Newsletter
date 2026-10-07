const searchForm = document.querySelector(".search-form");
const searchInput = document.querySelector("#global-search");

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
        searchInput.focus();
        return;
    }

    // The future Flask search route will receive `searchTerm` here.
    console.info(`Searching for: ${searchTerm}`);
});
////post data
const demoPosts = [
    {
        category: "Market Updates",
        title: "What Luxury Buyers Are Looking for in 2026",
        summary:
            "A closer look at the amenities, locations, and design choices shaping today’s luxury market.",
        author: "Steven Armijo",
        publishedDate: "2026-08-05",
        displayDate: "August 5, 2026",
        url: "/posts/luxury-buyer-trends-2026"
    },
    {
        category: "Recruiting",
        title: "How to Attract High-Performing Real Estate Agents",
        summary:
            "Build a brokerage culture and value proposition that experienced agents want to join.",
        author: "Steven Armijo",
        publishedDate: "2026-07-28",
        displayDate: "July 28, 2026",
        url: "/posts/attract-high-performing-agents"
    },
    {
        category: "Success Stories",
        title: "From First Showing to Record-Breaking Close",
        summary:
            "Inside the strategy that helped position a distinctive property for a successful sale.",
        author: "Steven Armijo",
        publishedDate: "2026-07-19",
        displayDate: "July 19, 2026",
        url: "/posts/record-breaking-close"
    },
    {
        category: "Training",
        title: "A Better Framework for Luxury Listing Presentations",
        summary:
            "Learn how preparation, storytelling, and market evidence create a stronger presentation.",
        author: "Steven Armijo",
        publishedDate: "2026-07-10",
        displayDate: "July 10, 2026",
        url: "/posts/luxury-listing-presentations"
    },
    {
        category: "Market Updates",
        title: "Understanding the Current Inventory Shift",
        summary:
            "What changing inventory levels mean for sellers, buyers, and real estate professionals.",
        author: "Steven Armijo",
        publishedDate: "2026-07-02",
        displayDate: "July 2, 2026",
        url: "/posts/current-inventory-shift"
    },
    {
        category: "Recruiting",
        title: "Building a Brokerage Agents Never Want to Leave",
        summary:
            "Retention starts with leadership, useful systems, and a clear path for professional growth.",
        author: "Steven Armijo",
        publishedDate: "2026-06-24",
        displayDate: "June 24, 2026",
        url: "/posts/building-a-lasting-brokerage"
    }
];

const categoryLabels = {
    "market-updates": "Market Updates",
    recruiting: "Recruiting",
    "success-stories": "Success Stories",
    training: "Training"
};

function formatPublishedDate(publishedDate) {
    const date = new Date(publishedDate);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

function mapApiPostToFeedPost(post) {
    return {
        id: post.id,
        category: categoryLabels[post.category] || post.category,
        title: post.title,
        summary: post.excerpt,
        author: "Eric Cuss",
        publishedDate: post.publishedDate,
        displayDate: formatPublishedDate(post.publishedDate),
        featuredImage: post.featuredImage,
        rawPost: post,
        url: `/blog/${post.id}`
    };
}

const posts = [];
const postList = document.querySelector("#post-list");
const postTemplate = document.querySelector("#post-card-template");
const loadMoreButton = document.querySelector("#load-more-posts");
const postLoadStatus = document.querySelector("#post-load-status");
const featuredPost = document.querySelector("#featured-post");
const featuredPostLink = document.querySelector("#featured-post-link");
const featuredPostMedia = featuredPost.querySelector(".featured-post__media");
const featuredPostImage = document.querySelector("#featured-post-image");
const featuredPostCategory = document.querySelector("#featured-post-category");
const featuredPostTitle = document.querySelector("#featured-post-title");
const featuredPostSummary = document.querySelector("#featured-post-summary");
const featuredPostDate = document.querySelector("#featured-post-date");
const deleteFeaturedPostButton = document.querySelector("#delete-featured-post");
const selectAllPostsButton = document.querySelector("#select-all-posts");
const editSelectedPostButton = document.querySelector("#edit-selected-post");
const archiveSelectedPostsButton = document.querySelector("#archive-selected-posts");
const deleteSelectedPostsButton = document.querySelector("#delete-selected-posts");

const postsPerPage = 3;
let visiblePostCount = 0;
const selectedPostIds = new Set();

function updatePostActions() {
    const selectedCount = selectedPostIds.size;
    const selectableCount = Math.max(posts.length - 1, 0);
    selectAllPostsButton.disabled = selectableCount === 0;
    selectAllPostsButton.textContent = selectedCount === selectableCount && selectableCount
        ? "Clear selection"
        : "Select all";
    editSelectedPostButton.disabled = selectedCount !== 1;
    archiveSelectedPostsButton.disabled = selectedCount === 0;
    deleteSelectedPostsButton.disabled = selectedCount === 0;
}

function createPostCard(post) {
    const cardFragment = postTemplate.content.cloneNode(true);

    const link = cardFragment.querySelector(".post-card__link");
    const category = cardFragment.querySelector(".post-card__category");
    const title = cardFragment.querySelector(".post-card__title");
    const summary = cardFragment.querySelector(".post-card__summary");
    const author = cardFragment.querySelector(".post-card__author");
    const date = cardFragment.querySelector(".post-card__date");
    const checkbox = cardFragment.querySelector(".post-card__select input");

    link.href = post.url;

    category.textContent = post.category;
    title.textContent = post.title;
    summary.textContent = post.summary;
    author.textContent = post.author;
    date.dateTime = post.publishedDate;
    date.textContent = post.displayDate;
    checkbox.checked = selectedPostIds.has(post.id);
    checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedPostIds.add(post.id);
        else selectedPostIds.delete(post.id);
        updatePostActions();
    });

    return cardFragment;
}

function renderFeaturedPost(post) {
    if (!post) {
        featuredPost.hidden = true;
        return;
    }

    featuredPost.hidden = false;
    featuredPostLink.href = post.url;
    featuredPostCategory.textContent = post.category;
    featuredPostTitle.textContent = post.title;
    featuredPostSummary.textContent = post.summary || "";
    featuredPostDate.dateTime = post.publishedDate || "";
    featuredPostDate.textContent = post.displayDate;
    featuredPostMedia.hidden = !post.featuredImage;
    featuredPostImage.hidden = !post.featuredImage;
    if (post.featuredImage) {
        featuredPostImage.src = post.featuredImage;
        featuredPostImage.alt = `Featured image for ${post.title}`;
    } else {
        featuredPostImage.removeAttribute("src");
    }
    deleteFeaturedPostButton.hidden = false;
    deleteFeaturedPostButton.onclick = () => deleteDashboardPost(post.id, deleteFeaturedPostButton);
}

function renderDashboardPosts() {
    postList.replaceChildren();
    [...selectedPostIds].forEach((id) => {
        if (!posts.some((post) => post.id === id)) selectedPostIds.delete(id);
    });
    visiblePostCount = posts.length ? 1 : 0;
    renderFeaturedPost(posts[0]);
    loadMoreButton.hidden = posts.length <= 1;
    if (posts.length > 1) loadMorePosts();
    if (!posts.length) postLoadStatus.textContent = "No published posts yet.";
    updatePostActions();
}

async function deleteDashboardPost(postId, button) {
    const post = posts.find((item) => item.id === postId);
    if (!post || !window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;

    button.disabled = true;
    try {
        const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Post could not be deleted.");
        posts.splice(posts.findIndex((item) => item.id === postId), 1);
        selectedPostIds.delete(postId);
        postLoadStatus.textContent = "Post deleted.";
        renderDashboardPosts();
    } catch (error) {
        button.disabled = false;
        postLoadStatus.textContent = error.message || "Post could not be deleted.";
        console.error("Unable to delete post:", error);
    }
}

async function archiveSelectedPosts() {
    const selectedPosts = posts.filter((post) => selectedPostIds.has(post.id));
    if (!selectedPosts.length || !window.confirm(`Archive ${selectedPosts.length} selected post${selectedPosts.length === 1 ? "" : "s"}?`)) return;

    archiveSelectedPostsButton.disabled = true;
    try {
        for (const post of selectedPosts) {
            const response = await fetch(`/api/posts/${post.id}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({status: "archived"})
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "A selected post could not be archived.");
        }
        selectedPosts.forEach((post) => posts.splice(posts.indexOf(post), 1));
        selectedPostIds.clear();
        postLoadStatus.textContent = "Selected posts archived.";
        renderDashboardPosts();
    } catch (error) {
        postLoadStatus.textContent = error.message || "Posts could not be archived.";
    } finally {
        updatePostActions();
    }
}

async function deleteSelectedPosts() {
    const selectedPosts = posts.filter((post) => selectedPostIds.has(post.id));
    if (!selectedPosts.length || !window.confirm(`Permanently delete ${selectedPosts.length} selected post${selectedPosts.length === 1 ? "" : "s"}? This cannot be undone.`)) return;

    deleteSelectedPostsButton.disabled = true;
    try {
        for (const post of selectedPosts) {
            const response = await fetch(`/api/posts/${post.id}`, {method: "DELETE"});
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "A selected post could not be deleted.");
        }
        selectedPosts.forEach((post) => posts.splice(posts.indexOf(post), 1));
        selectedPostIds.clear();
        postLoadStatus.textContent = "Selected posts deleted.";
        renderDashboardPosts();
    } catch (error) {
        postLoadStatus.textContent = error.message || "Posts could not be deleted.";
    } finally {
        updatePostActions();
    }
}

function loadMorePosts() {
    const nextPosts = posts.slice(
        visiblePostCount,
        visiblePostCount + postsPerPage
    );

    nextPosts.forEach((post) => {
        const postCard = createPostCard(post);
        postList.append(postCard);
    });

    visiblePostCount += nextPosts.length;

    postLoadStatus.textContent =
        `${nextPosts.length} additional posts loaded.`;

    if (visiblePostCount >= posts.length) {
        loadMoreButton.hidden = true;
        postLoadStatus.textContent += " All posts are now visible.";
    }
}

loadMoreButton.addEventListener("click", loadMorePosts);
selectAllPostsButton.addEventListener("click", () => {
    const selectablePosts = posts.slice(1);
    const shouldClear = selectablePosts.length && selectedPostIds.size === selectablePosts.length;
    selectedPostIds.clear();
    if (!shouldClear) selectablePosts.forEach((post) => selectedPostIds.add(post.id));
    renderDashboardPosts();
});
editSelectedPostButton.addEventListener("click", () => {
    const [postId] = selectedPostIds;
    if (postId) window.location.assign(`/posts/new/build?edit=${postId}`);
});
archiveSelectedPostsButton.addEventListener("click", archiveSelectedPosts);
deleteSelectedPostsButton.addEventListener("click", deleteSelectedPosts);

async function loadPublishedPosts() {
    try {
        const response = await fetch("/api/posts");

        if (!response.ok) {
            throw new Error(`Posts request failed with status ${response.status}`);
        }

        const apiPosts = await response.json();
        posts.push(...apiPosts.map(mapApiPostToFeedPost));
    } catch (error) {
        console.error("Unable to load published posts:", error);
        postLoadStatus.textContent = "Published posts could not be loaded.";
    }

    renderDashboardPosts();
}

loadPublishedPosts();

//////color change
const themeSelector = document.querySelector("#theme-selector");
const supportedThemes = new Set(["midnight", "obsidian", "sage"]);

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
