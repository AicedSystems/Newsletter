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