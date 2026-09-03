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
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(new Date(publishedDate));
}

function renderArticle(post) {
    articleCategory.textContent = categoryLabels[post.category] || post.category;
    articleTitle.textContent = post.title;
    articleExcerpt.textContent = post.excerpt;
    articleDate.dateTime = post.publishedDate;
    articleDate.textContent = formatPublishedDate(post.publishedDate);
    articleContent.textContent = post.content;
    document.title = `${post.title} | Rise Dashboard`;

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
