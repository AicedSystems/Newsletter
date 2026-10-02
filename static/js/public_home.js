const articleFilters = [...document.querySelectorAll("[data-category-filter]")];
const articleCards = [...document.querySelectorAll("[data-post-category]")];
const articleFilterStatus = document.querySelector("#article-filter-status");

articleFilters.forEach((filter) => {
    filter.addEventListener("click", () => {
        const category = filter.dataset.categoryFilter;
        let visibleCount = 0;

        articleFilters.forEach((button) => {
            const isActive = button === filter;
            button.classList.toggle("article-filter--active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
        articleCards.forEach((card) => {
            const isVisible = category === "all" || card.dataset.postCategory === category;
            card.hidden = !isVisible;
            if (isVisible) visibleCount += 1;
        });
        articleFilterStatus.textContent = `${visibleCount} article${visibleCount === 1 ? "" : "s"} shown.`;
    });
});
