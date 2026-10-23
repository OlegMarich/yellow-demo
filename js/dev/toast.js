import { t as icon } from "./icon.min.js";
//#region src/components/services/toast.js
var HIDE_MS = 3600;
function host() {
	let el = document.querySelector(".page-toasts");
	if (!el) {
		el = Object.assign(document.createElement("div"), { className: "page-toasts" });
		el.setAttribute("aria-live", "polite");
		document.body.append(el);
	}
	return el;
}
function toast(type, title, text = "") {
	const node = document.createElement("div");
	node.className = `toast toast--${type}`;
	node.setAttribute("role", type === "error" ? "alert" : "status");
	node.innerHTML = `${icon(type === "error" ? "x-circle" : "check", "icon toast__icon")}<div class="toast__body"><span class="toast__title"></span><span class="toast__text"></span></div>`;
	node.querySelector(".toast__title").textContent = title;
	node.querySelector(".toast__text").textContent = text;
	host().append(node);
	setTimeout(() => node.remove(), HIDE_MS);
}
//#endregion
export { toast as t };
