//#region src/components/custom/drawer/_drawer.js
var closeHandlers = /* @__PURE__ */ new Set();
var lastFocus = null;
function openDrawer(drawer) {
	if (!drawer.classList.contains("is-open")) lastFocus = document.activeElement;
	drawer.hidden = false;
	requestAnimationFrame(() => drawer.classList.add("is-open"));
	drawer.querySelector("[data-drawer-close]")?.focus({ preventScroll: true });
}
function closeDrawer(drawer) {
	if (!drawer || drawer.hidden) return;
	drawer.classList.remove("is-open");
	drawer.hidden = true;
	closeHandlers.forEach((fn) => fn(drawer));
	lastFocus?.focus?.({ preventScroll: true });
}
function onDrawerClose(fn) {
	closeHandlers.add(fn);
}
document.addEventListener("click", (e) => {
	const btn = e.target.closest("[data-drawer-close]");
	if (btn) closeDrawer(btn.closest(".drawer"));
});
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeDrawer(document.querySelector(".drawer.is-open"));
});
//#endregion
export { onDrawerClose as n, openDrawer as r, closeDrawer as t };
