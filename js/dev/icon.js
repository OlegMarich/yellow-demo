//#region src/components/services/icon.js
var base = null;
function spriteBase() {
	if (base) return base;
	const href = document.querySelector("use[href*=\"#sprite-\"]")?.getAttribute("href");
	base = href ? href.split("#")[0] : "__spritemap";
	return base;
}
var icon = (name, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="${spriteBase()}#sprite-${name}"></use></svg>`;
//#endregion
export { icon as t };
