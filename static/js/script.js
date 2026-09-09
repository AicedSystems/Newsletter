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
        url: `/posts/${post.id}`
    };
}

const posts = [];
const postList = document.querySelector("#post-list");
const postTemplate = document.querySelector("#post-card-template");
const loadMoreButton = document.querySelector("#load-more-posts");
const postLoadStatus = document.querySelector("#post-load-status");

const postsPerPage = 3;
let visiblePostCount = 0;

function createPostCard(post) {
    const cardFragment = postTemplate.content.cloneNode(true);

    const link = cardFragment.querySelector(".post-card__link");
    const category = cardFragment.querySelector(".post-card__category");
    const title = cardFragment.querySelector(".post-card__title");
    const summary = cardFragment.querySelector(".post-card__summary");
    const author = cardFragment.querySelector(".post-card__author");
    const date = cardFragment.querySelector(".post-card__date");

    link.href = post.url;

    category.textContent = post.category;
    title.textContent = post.title;
    summary.textContent = post.summary;
    author.textContent = post.author;
    date.dateTime = post.publishedDate;
    date.textContent = post.displayDate;

    return cardFragment;
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

async function loadPublishedPosts() {
    try {
        const response = await fetch("/api/posts");

        if (!response.ok) {
            throw new Error(`Posts request failed with status ${response.status}`);
        }

        const apiPosts = await response.json();
        posts.push(...apiPosts.map(mapApiPostToFeedPost), ...demoPosts);
    } catch (error) {
        console.error("Unable to load published posts:", error);
        posts.push(...demoPosts);
        postLoadStatus.textContent = "Published posts could not be loaded.";
    }

    loadMorePosts();
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
