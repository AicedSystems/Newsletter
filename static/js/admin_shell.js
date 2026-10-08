document.querySelectorAll(".admin-sidebar__toggle").forEach((button) => {
    const shell = button.closest(".admin-shell");
    if (!shell) return;
    const savedState = localStorage.getItem("aicedAdminSidebarCollapsed") === "true";
    shell.classList.toggle("is-sidebar-collapsed", savedState);
    button.setAttribute("aria-expanded", String(!savedState));
    button.textContent = savedState ? "›" : "‹";
    button.addEventListener("click", () => {
        const collapsed = shell.classList.toggle("is-sidebar-collapsed");
        button.setAttribute("aria-expanded", String(!collapsed));
        button.textContent = collapsed ? "›" : "‹";
        localStorage.setItem("aicedAdminSidebarCollapsed", String(collapsed));
    });
});
