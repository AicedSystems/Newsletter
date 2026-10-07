const archiveList = document.querySelector("#archive-list");
const archiveStatus = document.querySelector("#archive-status");

function formattedDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", {
        month: "long", day: "numeric", year: "numeric"
    }).format(date);
}

async function setPostStatus(postId, status) {
    const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({status})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "The post could not be updated.");
}

function renderArchivedPosts(posts) {
    archiveList.replaceChildren();
    if (!posts.length) {
        archiveStatus.textContent = "No archived articles.";
        return;
    }
    archiveStatus.textContent = `${posts.length} archived article${posts.length === 1 ? "" : "s"}.`;
    posts.forEach((post) => {
        const article = document.createElement("article");
        article.className = "archive-card";
        article.innerHTML = `
            <div><p class="post-feed__eyebrow"></p><h2></h2><p class="archive-card__excerpt"></p><time></time></div>
            <div class="archive-card__actions"><a class="post-feed__action">Edit</a><button class="post-feed__action">Restore</button><button class="post-feed__action post-feed__action--danger post-delete-icon" type="button" aria-label="Delete archived article" title="Delete archived article"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path></svg></button></div>`;
        article.querySelector(".post-feed__eyebrow").textContent = post.category;
        article.querySelector("h2").textContent = post.title;
        article.querySelector(".archive-card__excerpt").textContent = post.excerpt;
        const time = article.querySelector("time");
        time.dateTime = post.publishedDate || "";
        time.textContent = formattedDate(post.publishedDate);
        article.querySelector("a").href = `/posts/new/build?edit=${post.id}`;
        const [restoreButton, deleteButton] = article.querySelectorAll("button");
        restoreButton.addEventListener("click", async () => {
            restoreButton.disabled = true;
            try {
                await setPostStatus(post.id, "published");
                article.remove();
                archiveStatus.textContent = "Article restored to published posts.";
            } catch (error) {
                restoreButton.disabled = false;
                archiveStatus.textContent = error.message || "Article could not be restored.";
            }
        });
        deleteButton.addEventListener("click", async () => {
            if (!window.confirm(`Permanently delete “${post.title}”? This cannot be undone.`)) return;
            deleteButton.disabled = true;
            const response = await fetch(`/api/posts/${post.id}`, {method: "DELETE"});
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                deleteButton.disabled = false;
                archiveStatus.textContent = result.message || "Article could not be deleted.";
                return;
            }
            article.remove();
            archiveStatus.textContent = "Archived article deleted.";
        });
        archiveList.append(article);
    });
}

fetch("/api/admin/posts?status=archived")
    .then(async (response) => {
        const posts = await response.json().catch(() => []);
        if (!response.ok) throw new Error(posts.message || "Archived articles could not be loaded.");
        renderArchivedPosts(posts);
    })
    .catch((error) => { archiveStatus.textContent = error.message || "Archived articles could not be loaded."; });
