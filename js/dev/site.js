import { D as siteApi } from "./ui.min.js";
//#region src/components/services/site.js
var SITE_KEY = "yellow:site-profile";
function cachedSite() {
	try {
		return JSON.parse(localStorage.getItem("yellow:site-profile")) || null;
	} catch {
		return null;
	}
}
var pending = null;
function loadSite() {
	pending ??= siteApi.get().then((site) => {
		try {
			localStorage.setItem(SITE_KEY, JSON.stringify(site));
		} catch {}
		return site;
	}).catch(() => cachedSite());
	return pending;
}
function applySiteName(site = cachedSite()) {
	if (!site?.name) return;
	document.querySelectorAll("[data-site-name]").forEach((el) => el.textContent = site.name);
}
//#endregion
export { cachedSite as n, loadSite as r, applySiteName as t };
