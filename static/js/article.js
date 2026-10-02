const articlePage = document.querySelector("[data-post-id]");
const articleStatus = document.querySelector("#article-status");
const articleDetail = document.querySelector("#article-detail");
const articleCategory = document.querySelector("#article-category");
const articleTitle = document.querySelector("#article-title");
const articleExcerpt = document.querySelector("#article-excerpt");
const articleDate = document.querySelector("#article-date");
const articleMedia = document.querySelector("#article-media");
const articleImage = document.querySelector("#article-image");
const articleContent = document.querySelector("#article-content");
const articleTags = document.querySelector("#article-tags");

const categoryLabels = {
    "market-updates": "Market Updates",
    recruiting: "Recruiting",
    "success-stories": "Success Stories",
    training: "Training"
};

function formatPublishedDate(publishedDate) {
    if (!publishedDate) return "";
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(new Date(publishedDate));
}

function isSafeImageSource(value) {
    return isSafeWebUrl(value) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value || "");
}

function getYouTubeEmbedUrl(value) {
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
            ? `https://www.youtube-nocookie.com/embed/${videoId}`
            : null;
    } catch {
        return null;
    }
}

function isSafeWebUrl(value) {
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
}

function createArticleBlock(block) {
    if (block.type === "heading") {
        const heading = document.createElement("h2");
        heading.className = "article-block__heading";
        heading.textContent = block.text;
        return heading;
    }

    if (block.type === "paragraph") {
        const paragraph = document.createElement("p");
        paragraph.className = "article-block__paragraph";
        paragraph.textContent = block.text;
        return paragraph;
    }

    if (block.type === "quote") {
        const quote = document.createElement("blockquote");
        quote.className = "article-block__quote";
        quote.textContent = block.text;
        return quote;
    }

    if (block.type === "image" && isSafeImageSource(block.url)) {
        const image = document.createElement("img");
        image.className = "article-block__image";
        image.src = block.url;
        image.alt = "Article image";
        return image;
    }

    if (block.type === "youtube") {
        const embedUrl = getYouTubeEmbedUrl(block.url);
        if (!embedUrl) {
            return null;
        }
        const video = document.createElement("iframe");
        video.className = "article-block__youtube";
        video.src = embedUrl;
        video.title = "YouTube video";
        video.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        video.allowFullscreen = true;
        return video;
    }

    if (block.type === "cta" && isSafeWebUrl(block.url)) {
        const link = document.createElement("a");
        link.className = "article-block__cta";
        link.href = block.url;
        link.textContent = block.text;
        return link;
    }

    return null;
}

function renderContentBlocks(post) {
    const blocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length
        ? post.contentBlocks
        : [{ type: "paragraph", text: post.content }];

    articleContent.replaceChildren(...blocks.map(createArticleBlock).filter(Boolean));
}

function renderArticle(post) {
    articleCategory.textContent = categoryLabels[post.category] || post.category;
    articleTitle.textContent = post.title;
    articleExcerpt.textContent = post.excerpt;
    articleDate.dateTime = post.publishedDate || "";
    articleDate.textContent = formatPublishedDate(post.publishedDate);
    articleDate.hidden = !post.publishedDate;
    renderContentBlocks(post);
    document.title = `${post.title} | Inside the Market`;

    articleTags.replaceChildren(...post.tags.map((tag) => {
        const tagItem = document.createElement("li");
        tagItem.textContent = tag;
        return tagItem;
    }));
    articleTags.hidden = post.tags.length === 0;

    if (post.featuredImage) {
        articleImage.src = post.featuredImage;
        articleImage.alt = `Featured image for ${post.title}`;
        articleMedia.hidden = false;
    }

    articleStatus.hidden = true;
    articleDetail.hidden = false;
}

async function loadArticle() {
    try {
        const response = await fetch(`/api/posts/${articlePage.dataset.postId}`);

        if (response.status === 404) {
            articleStatus.textContent = "This article could not be found.";
            return;
        }

        if (!response.ok) {
            articleStatus.textContent = "This article could not be loaded.";
            return;
        }

        renderArticle(await response.json());
    } catch (error) {
        console.error("Unable to load article:", error);
        articleStatus.textContent = "This article could not be loaded.";
    }
}

loadArticle();
