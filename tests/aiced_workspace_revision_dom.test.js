const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

class FakeNode {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.children = [];
        this.childNodes = this.children;
        this.className = "";
        this.textContent = "";
        this.hidden = false;
        this.attributes = {};
        this.listeners = {};
        this.classList = {
            values: new Set(),
            toggle: (name, enabled) => {
                if (enabled) this.classList.values.add(name);
                else this.classList.values.delete(name);
            },
            contains: (name) => this.classList.values.has(name),
        };
    }

    append(...nodes) { nodes.forEach((node) => { node.parentNode = this; }); this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children.splice(0, this.children.length); this.append(...nodes); }
    remove() {
        if (!this.parentNode) return;
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    click() { return this.listeners.click?.(); }
    querySelector(selector) {
        if (!selector.includes("aiced-change-review")) return null;
        return this.children.find((child) => child.className.includes("aiced-change-review")) || null;
    }
}

function textNode(text) { const node = new FakeNode("#text"); node.textContent = String(text); return node; }

function descendants(node) {
    return node.children.flatMap((child) => [child, ...descendants(child)]);
}

function findText(node, text) {
    return descendants(node).find((child) => child.textContent === text);
}

function fixtureArticle() {
    return {
        title: "Buying your first home in Palmdale",
        excerpt: "A practical guide for first-time buyers.",
        tags: ["Buyer"],
        contentBlocks: [
            { type: "heading", text: "Plan your budget" },
            { type: "paragraph", text: "Start with a monthly budget that works for you." },
            { type: "cta", headline: "Talk with us", body: "We can help.", buttonLabel: "Contact us", actionType: "contact", intent: "buyer" },
        ],
    };
}

function loadRenderer({ revision, article = fixtureArticle() }) {
    const script = fs.readFileSync(path.join(__dirname, "..", "static/js/aiced_workspace.js"), "utf8");
    const start = script.indexOf("function renderNormalArticleBlocks");
    const end = script.indexOf("async function savePendingReviewEntry");
    assert.ok(start >= 0 && end > start, "revision renderer slice must exist");

    const articleContent = new FakeNode();
    const articleExpandedLayout = new FakeNode();
    articleExpandedLayout.append(articleContent);
    const articleToggle = new FakeNode("button");
    const proposal = { article, campaign: {}, audience: {} };
    const entries = [];
    Object.entries(revision.article || {}).forEach(([field, proposed]) => entries.push({ section: "Article", field, proposed, status: "pending", payload: { article: { [field]: proposed } } }));
    Object.entries(revision.cta || {}).forEach(([field, proposed]) => entries.push({ section: "Call to action", field, proposed, status: "pending", payload: { cta: { [field]: proposed } } }));
    Object.entries(revision.campaign || {}).forEach(([field, proposed]) => entries.push({ section: "Campaign", field, proposed, status: "pending", payload: { campaign: { [field]: proposed } } }));
    Object.entries(revision.audience || {}).forEach(([field, proposed]) => entries.push({ section: "Audience", field, proposed, status: "pending", payload: { audience: { [field]: proposed } } }));

    const context = {
        document: { createElement: (tag) => new FakeNode(tag), createTextNode: textNode },
        articleContent,
        articleExpandedLayout,
        articleToggle,
        approveButton: new FakeNode("button"),
        draftOnboarding: new FakeNode("section"),
        refineRequest: new FakeNode("textarea"),
        refineSendButton: new FakeNode("button"),
        reviewedProposal: proposal,
        pendingReviewEntries: entries,
        pendingArticleRevision: null,
        pendingReviewSummary: "Aiced updated the article.",
        showFullRevisionComparison: null,
        isApplyingRevision: false,
        approvalState: "ready",
        reviewStatus: new FakeNode(),
        savedWorkflow: null,
        appendTextElement: (container, tag, text, className = "") => {
            const element = new FakeNode(tag); element.textContent = text; element.className = className; container.append(element); return element;
        },
        syncProposalApprovalState: () => {},
        syncRevisionComposer: () => {},
        setStatus: () => {},
        setActiveProposalStep: () => {},
        renderProposal: () => {},
        markWorkflowSaved: () => {},
        setRevisionComposerEnabled: () => {},
        titleCase: (value) => value,
    };
    vm.runInNewContext(script.slice(start, end), context);
    return { context, articleContent, articleExpandedLayout, article };
}

test("content-block revision renders Original and Revised by Aiced side by side", () => {
    const { context, articleContent, articleExpandedLayout, article } = loadRenderer({
        revision: { article: { contentBlocks: [...fixtureArticle().contentBlocks.slice(0, 2), { type: "paragraph", text: "Compare neighborhoods at your own pace." }, fixtureArticle().contentBlocks[2]] } },
    });
    context.renderArticleBlocks(article.contentBlocks);
    assert.equal(articleContent.children[0].className.includes("original"), true);
    assert.ok(findText(articleContent, "Original"));
    assert.ok(findText(articleExpandedLayout, "Revised by Aiced"));
    assert.ok(findText(articleExpandedLayout, "Accept Changes"));
    assert.equal(articleExpandedLayout.classList.contains("has-change-review"), true);
});

test("title-only revision still renders both article review columns", () => {
    const { context, articleExpandedLayout, article } = loadRenderer({ revision: { article: { title: "A clearer first-home guide" } } });
    context.renderArticleBlocks(article.contentBlocks);
    assert.ok(findText(articleExpandedLayout, "Original"));
    assert.ok(findText(articleExpandedLayout, "Revised by Aiced"));
    assert.ok(findText(articleExpandedLayout, "clearer"));
});

test("CTA-only revision shows a clear non-article review notice", () => {
    const { context, articleExpandedLayout, article } = loadRenderer({ revision: { cta: { headline: "Let’s plan your next move" } } });
    context.renderArticleBlocks(article.contentBlocks);
    assert.equal(articleExpandedLayout.classList.contains("has-change-review"), false);
    assert.equal(articleExpandedLayout.classList.contains("has-nonarticle-review"), true);
    assert.ok(findText(articleExpandedLayout, "Aiced proposed changes to Call to action. The article itself is unchanged."));
    assert.equal(findText(articleExpandedLayout, "Revised by Aiced"), undefined);
});

test("discard restores the normal article preview without a comparison panel", () => {
    const { context, articleExpandedLayout, article } = loadRenderer({ revision: { article: { title: "A clearer first-home guide" } } });
    context.renderArticleBlocks(article.contentBlocks);
    findText(articleExpandedLayout, "Discard").click();
    assert.equal(context.pendingReviewEntries.length, 0);
    assert.equal(articleExpandedLayout.querySelector(":scope > .aiced-change-review"), null);
    assert.equal(articleExpandedLayout.classList.contains("has-change-review"), false);
});

test("accept applies a browser-only proposal revision before handoff", async () => {
    const { context, articleExpandedLayout, article } = loadRenderer({ revision: { article: { title: "A clearer first-home guide" } } });
    context.renderArticleBlocks(article.contentBlocks);
    await findText(articleExpandedLayout, "Accept Changes").click();
    assert.equal(context.reviewedProposal.article.title, "A clearer first-home guide");
    assert.equal(context.pendingReviewEntries.length, 0);
});

test("rerendering while an article revision is pending keeps exactly one revised panel visible", () => {
    const { context, articleExpandedLayout, article } = loadRenderer({ revision: { article: { title: "A clearer first-home guide" } } });
    context.renderArticleBlocks(article.contentBlocks);
    context.renderArticleBlocks(article.contentBlocks);
    const panels = articleExpandedLayout.children.filter((child) => child.className.includes("aiced-change-review"));
    assert.equal(panels.length, 1);
    assert.ok(findText(articleExpandedLayout, "Revised by Aiced"));
});
