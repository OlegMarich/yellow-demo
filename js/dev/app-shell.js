import { n as locale, o as currentUser, v as healthApi } from "./ui.min.js";
import { n as cachedSite, r as loadSite, t as applySiteName } from "./site.min.js";
//#region src/js/common/functions.js
var bodyLockStatus = true;
var bodyLockToggle = (delay = 500) => {
	if (document.documentElement.hasAttribute("data-fls-scrolllock")) bodyUnlock(delay);
	else bodyLock(delay);
};
var bodyUnlock = (delay = 500) => {
	if (bodyLockStatus) {
		const lockPaddingElements = document.querySelectorAll("[data-fls-lp]");
		setTimeout(() => {
			lockPaddingElements.forEach((lockPaddingElement) => {
				lockPaddingElement.style.paddingRight = "";
			});
			document.body.style.paddingRight = "";
			document.documentElement.removeAttribute("data-fls-scrolllock");
		}, delay);
		bodyLockStatus = false;
		setTimeout(function() {
			bodyLockStatus = true;
		}, delay);
	}
};
var bodyLock = (delay = 500) => {
	if (bodyLockStatus) {
		const lockPaddingElements = document.querySelectorAll("[data-fls-lp]");
		const lockPaddingValue = window.innerWidth - document.body.offsetWidth + "px";
		lockPaddingElements.forEach((lockPaddingElement) => {
			lockPaddingElement.style.paddingRight = lockPaddingValue;
		});
		document.body.style.paddingRight = lockPaddingValue;
		document.documentElement.setAttribute("data-fls-scrolllock", "");
		bodyLockStatus = false;
		setTimeout(function() {
			bodyLockStatus = true;
		}, delay);
	}
};
//#endregion
//#region src/components/layout/menu/menu.js
function menuInit() {
	document.addEventListener("click", function(e) {
		if (bodyLockStatus && e.target.closest("[data-fls-menu]")) {
			bodyLockToggle();
			document.documentElement.toggleAttribute("data-fls-menu-open");
		}
	});
}
document.querySelector("[data-fls-menu]") && window.addEventListener("load", menuInit);
//#endregion
//#region src/components/custom/sidebar/sidebar.js
function showUser(user) {
	const box = document.querySelector("[data-sidebar-user]");
	if (!box) return;
	const avatar = box.querySelector("[data-slot=\"avatar\"]");
	avatar.textContent = user.initials;
	avatar.classList.add(`avatar--${user.role}`);
	box.querySelector("[data-slot=\"name\"]").textContent = user.name;
	box.querySelector("[data-slot=\"role\"]").textContent = user.roleLabel;
}
var dateEl = document.querySelector("[data-sidebar-date]");
function renderFacility(site) {
	applySiteName(site);
	if (!dateEl) return;
	const d = /* @__PURE__ */ new Date();
	const p2 = (n) => String(n).padStart(2, "0");
	const n = site?.chambers?.length || 30;
	dateEl.textContent = `${d.toLocaleDateString(locale(), { weekday: "short" })} ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} · ${n} chambers`;
}
renderFacility(cachedSite());
loadSite().then(renderFacility);
var versionEl = document.querySelector("[data-sidebar-version]");
if (versionEl) healthApi.get().then((h) => {
	if (!h?.version) return;
	versionEl.textContent = `Yellow WMS v${h.version}`;
	versionEl.hidden = false;
}).catch(() => {});
document.addEventListener("session:ready", (e) => showUser(e.detail.user));
if (currentUser()) showUser(currentUser());
var menuOpen = () => document.documentElement.hasAttribute("data-fls-menu-open");
function closeMenu() {
	if (!menuOpen()) return;
	document.documentElement.removeAttribute("data-fls-menu-open");
	bodyUnlock(0);
}
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeMenu();
});
matchMedia("(min-width: 992px)").addEventListener("change", (e) => {
	if (e.matches) closeMenu();
});
//#endregion
