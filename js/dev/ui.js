//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region src/components/services/config.js
var KEY$1 = "yellow:api";
function pick$1() {
	try {
		const fromUrl = new URLSearchParams(location.search).get("api");
		if (fromUrl === "mock" || fromUrl === "live") localStorage.setItem(KEY$1, fromUrl);
		const saved = localStorage.getItem(KEY$1);
		if (saved === "mock" || saved === "live") return saved;
	} catch {}
	return "mock";
}
var API_MODE = pick$1();
var IS_APP = Boolean(window.Capacitor);
var TOKEN_KEY = "yellow:token";
var DEVICE_KEY = "yellow:device";
var SERVER_KEY = "serverUrl";
var SITE_KEY = "yellow:site";
var SERVERS_KEY = "yellow:servers";
var ROUTE_KEY = "yellow:route";
var DEV_KEY = "yellow:dev";
var clean = (url) => String(url || "").trim().replace(/\/+$/, "");
var hostOf = (url) => {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
};
var read = (key) => {
	try {
		return localStorage.getItem(key) || "";
	} catch {
		return "";
	}
};
var write = (key, value) => {
	try {
		value ? localStorage.setItem(key, value) : localStorage.removeItem(key);
	} catch {}
};
var serverUrl = () => clean(read(SERVER_KEY));
var apiBase = () => IS_APP ? `${serverUrl()}/api` : "/api";
var devMode = () => read(DEV_KEY) === "1";
var setDevMode = (on) => write(DEV_KEY, on ? "1" : "");
function savedServers() {
	let list = [];
	try {
		list = JSON.parse(read(SERVERS_KEY) || "[]");
	} catch {}
	list = list.filter((s) => s && s.url).map((s) => ({
		...s,
		urls: s.urls?.length ? s.urls : [s.url]
	}));
	const current = serverUrl();
	if (current && !list.some((s) => s.urls.includes(current))) list.unshift({
		name: hostOf(current),
		url: current,
		urls: [current]
	});
	return list;
}
var saveServers = (list) => write(SERVERS_KEY, JSON.stringify(list));
function currentSite() {
	const list = savedServers();
	return list.find((s) => s.url === read(SITE_KEY)) || list.find((s) => s.urls.includes(serverUrl())) || null;
}
var perServer = (key) => {
	const site = IS_APP ? currentSite()?.url || serverUrl() : "";
	return site ? `${key}@${site}` : key;
};
function setServerUrl(url, name, urls) {
	url = clean(url);
	const list = savedServers();
	if (!url) {
		write(SERVER_KEY, "");
		write(SITE_KEY, "");
		return;
	}
	const all = [...new Set((urls?.length ? urls : [url]).map(clean))];
	let site = list.find((s) => s.url === url || s.urls.includes(url));
	if (site) {
		site.name = (name || "").trim() || site.name;
		if (urls?.length) site.urls = all;
	} else {
		site = {
			name: (name || "").trim() || hostOf(url),
			url: all[0],
			urls: all
		};
		list.push(site);
	}
	saveServers(list);
	write(SITE_KEY, site.url);
	write(SERVER_KEY, site.urls[0]);
	sessionStorage.removeItem(ROUTE_KEY);
}
function forgetServer(url) {
	const site = savedServers().find((s) => s.url === clean(url) || s.urls.includes(clean(url)));
	saveServers(savedServers().filter((s) => s !== site && s.url !== site?.url));
	const next = savedServers()[0];
	next ? setServerUrl(next.url) : setServerUrl("");
}
if (read(SITE_KEY).startsWith("{")) write(SITE_KEY, "");
if (IS_APP && serverUrl()) {
	for (const key of [
		"yellow:token",
		"yellow:device",
		"yellow:me",
		"yellow:ops",
		"yellow:lastUser"
	]) try {
		const old = localStorage.getItem(key);
		if (old !== null && localStorage.getItem(perServer(key)) === null) localStorage.setItem(perServer(key), old);
		if (old !== null) localStorage.removeItem(key);
	} catch {}
	saveServers(savedServers());
	if (!read(SITE_KEY)) write(SITE_KEY, currentSite()?.url || serverUrl());
}
var isLan = (url) => /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(url);
async function answers(url, ms) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		const body = await (await fetch(`${url}/api/health`, {
			signal: ctrl.signal,
			cache: "no-store",
			headers: { "ngrok-skip-browser-warning": "1" }
		})).json().catch(() => null);
		return Boolean(body && (body.status || body.error));
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
async function bundledServers() {
	try {
		const res = await fetch("servers.json", { cache: "no-store" });
		return res.ok ? await res.json() : [];
	} catch {
		return [];
	}
}
async function pickRoute(force = false) {
	if (!IS_APP) return;
	if (!serverUrl()) {
		const bundled = (await bundledServers()).filter((s) => s?.urls?.length);
		bundled.forEach((s) => setServerUrl(s.urls[0], s.name, s.urls));
		if (bundled.length) setServerUrl(bundled[0].urls[0]);
	}
	const site = currentSite();
	if (!site || site.urls.length < 2) return;
	try {
		const cached = JSON.parse(sessionStorage.getItem(ROUTE_KEY) || "null");
		if (!force && cached && cached.site === site.url && Date.now() - cached.at < 6e5) return write(SERVER_KEY, cached.url);
	} catch {}
	const lan = site.urls.filter(isLan);
	const other = site.urls.filter((u) => !isLan(u));
	const otherCheck = other.length ? Promise.any(other.map((u) => answers(u, 6e3).then((ok) => ok ? u : Promise.reject()))).catch(() => null) : Promise.resolve(null);
	let chosen = null;
	for (const u of lan) if (!chosen && await answers(u, 1500)) chosen = u;
	chosen ||= await otherCheck;
	if (chosen) {
		write(SERVER_KEY, chosen);
		sessionStorage.setItem(ROUTE_KEY, JSON.stringify({
			site: site.url,
			url: chosen,
			at: Date.now()
		}));
	}
}
var routeReady = pickRoute();
var repick = () => routeReady = pickRoute(true);
var hasOtherRoute = () => (currentSite()?.urls.length || 0) > 1;
//#endregion
//#region \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep, importerUrl) {
	return new URL(dep, importerUrl).href;
};
var seen = {};
var isCssPreloadUrl = function isCssPreloadUrl(url) {
	return url.pathname.endsWith(".css");
};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		let preloadedHrefs;
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return new URL(import.meta.resolve(specifier));
			return new URL(
				specifier,
				/** #__KEEP__ */
				import.meta.url
			);
		}
		promise = allSettled(deps.map((depString) => {
			depString = assetsURL(depString, importerUrl);
			const dep = importMetaResolve(depString);
			if (dep.href in seen) return;
			seen[dep.href] = true;
			const isCss = isCssPreloadUrl(dep);
			if (preloadedHrefs === void 0) {
				preloadedHrefs = {
					all: /* @__PURE__ */ new Set(),
					styles: /* @__PURE__ */ new Set()
				};
				const links = document.getElementsByTagName("link");
				for (let i = links.length - 1; i >= 0; i--) {
					const link = links[i];
					preloadedHrefs.all.add(link.href);
					if (link.rel === "stylesheet") preloadedHrefs.styles.add(link.href);
				}
			}
			if ((isCss ? preloadedHrefs.styles : preloadedHrefs.all).has(dep.href)) return;
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep.href;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}).filter((p) => p !== void 0));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
//#endregion
//#region src/components/services/api.js
var ApiError = class extends Error {
	constructor(status, body) {
		super(body?.message || body?.error || `HTTP ${status}`);
		this.status = status;
		this.code = body?.error || body?.status || null;
		this.body = body;
	}
};
var MOCK_LATENCY = [250, 600];
var mock = null;
function appToken() {
	try {
		return localStorage.getItem(perServer("yellow:token")) || "";
	} catch {
		return "";
	}
}
function deviceKey() {
	try {
		return localStorage.getItem(perServer("yellow:device")) || "";
	} catch {
		return "";
	}
}
function setDeviceKey(key) {
	try {
		if (IS_APP && key) localStorage.setItem(perServer(DEVICE_KEY), key);
	} catch {}
}
function setAppToken(token) {
	try {
		token ? localStorage.setItem(perServer(TOKEN_KEY), token) : localStorage.removeItem(perServer(TOKEN_KEY));
	} catch {}
}
async function request(method, path, body, retried = false) {
	if (API_MODE === "mock") {
		mock ??= await __vitePreload(() => import("./_mock-server.min.js"), [], import.meta.url);
		await new Promise((r) => setTimeout(r, MOCK_LATENCY[0] + Math.random() * (MOCK_LATENCY[1] - MOCK_LATENCY[0])));
		const plain = body instanceof FormData ? Object.fromEntries([...body].map(([k, v]) => [k, v instanceof File ? v.name : v])) : body;
		const res = mock.handle(method, path.split("?")[0], plain ? structuredClone(plain) : void 0, new URLSearchParams(path.split("?")[1]));
		if (res.status >= 400) throw new ApiError(res.status, res.body);
		return res.body;
	}
	let res;
	try {
		const headers = {};
		if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
		if (IS_APP && appToken()) headers.Authorization = `Bearer ${appToken()}`;
		if (IS_APP && deviceKey()) headers["X-Device-Key"] = deviceKey();
		if (IS_APP) headers["ngrok-skip-browser-warning"] = "1";
		await routeReady;
		const ctrl = new AbortController();
		const timer = IS_APP && !retried && method === "GET" && hasOtherRoute() ? setTimeout(() => ctrl.abort(), 6e3) : 0;
		res = await fetch(apiBase() + path, {
			method,
			credentials: IS_APP ? "omit" : "same-origin",
			headers,
			body: body instanceof FormData ? body : body ? JSON.stringify(body) : void 0,
			signal: ctrl.signal
		}).finally(() => clearTimeout(timer));
	} catch {
		if (IS_APP && !retried && hasOtherRoute()) {
			await repick();
			return request(method, path, body, true);
		}
		throw new ApiError(0, {
			error: "offline",
			message: "No connection to the server"
		});
	}
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new ApiError(res.status, data);
	return data;
}
async function imageUrl(path) {
	if (API_MODE === "mock") return "data:image/svg+xml," + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 4 3\"><rect width=\"4\" height=\"3\" fill=\"#d9d9e0\"/></svg>");
	await routeReady;
	const headers = {};
	if (IS_APP && appToken()) headers.Authorization = `Bearer ${appToken()}`;
	if (IS_APP && deviceKey()) headers["X-Device-Key"] = deviceKey();
	if (IS_APP) headers["ngrok-skip-browser-warning"] = "1";
	const res = await fetch(apiBase() + path, {
		credentials: IS_APP ? "omit" : "same-origin",
		headers
	});
	if (!res.ok) throw new ApiError(res.status, null);
	return URL.createObjectURL(await res.blob());
}
var defectsApi = {
	catalog: () => request("GET", "/defects"),
	container: (code) => request("GET", `/defects/container/${encodeURIComponent(code)}`),
	photos: ({ container = "", defect = "" } = {}) => request("GET", `/defects/photos?container=${encodeURIComponent(container)}&defect=${encodeURIComponent(defect)}`),
	upload: ({ file, containerNumber, defect = "", category = "", note = "" }) => {
		const form = new FormData();
		form.append("containerNumber", containerNumber);
		form.append("defect", defect);
		form.append("category", category);
		form.append("note", note);
		form.append("photo", file);
		return request("POST", "/defects/photos", form);
	},
	photoUrl: (id) => imageUrl(`/defects/photos/${encodeURIComponent(id)}`)
};
var authApi = {
	users: () => request("GET", "/auth/users"),
	login: (userId, pin) => request("POST", "/auth/login", {
		userId,
		pin
	}).then((r) => {
		if (IS_APP && r?.token) setAppToken(r.token);
		setDeviceKey(r?.deviceKey);
		return r;
	}),
	logout: () => request("POST", "/auth/logout").finally(() => IS_APP && setAppToken("")),
	me: () => request("GET", "/auth/me").then((r) => r.user)
};
var usersApi = {
	list: () => request("GET", "/users"),
	create: (data) => request("POST", "/users", data),
	update: (id, patch) => request("PATCH", `/users/${encodeURIComponent(id)}`, patch),
	resetPin: (id) => request("POST", `/users/${encodeURIComponent(id)}/reset-pin`),
	unlock: (id) => request("POST", `/users/${encodeURIComponent(id)}/unlock`),
	roles: () => request("GET", "/users/roles"),
	saveRoles: (roles) => request("PUT", "/users/roles", roles)
};
var devicesApi = {
	pair: (code, name) => request("POST", "/devices/pair", {
		code,
		name
	}).then((r) => {
		setDeviceKey(r?.deviceKey);
		return r;
	}),
	list: () => request("GET", "/devices"),
	createCode: (name) => request("POST", "/devices/codes", { name }),
	rename: (id, name) => request("PATCH", `/devices/${encodeURIComponent(id)}`, { name }),
	revoke: (id) => request("DELETE", `/devices/${encodeURIComponent(id)}`),
	endSession: (id) => request("DELETE", `/devices/sessions/${encodeURIComponent(id)}`)
};
var healthApi = { get: () => request("GET", "/health") };
var roundsApi = {
	day: (date) => request("GET", `/rounds${date ? `?date=${encodeURIComponent(date)}` : ""}`),
	latest: () => request("GET", "/rounds/latest"),
	history: (n, days = 14) => request("GET", `/rounds/chamber/${encodeURIComponent(n)}?days=${days}`),
	save: (reading) => request("POST", "/rounds", reading)
};
var siteApi = { get: () => request("GET", "/site") };
var backupApi = {
	status: () => request("GET", "/backup"),
	run: () => request("POST", "/backup")
};
var fileForm = (file) => {
	const form = new FormData();
	form.append("file", file);
	return form;
};
var plansApi = { uploadSales: (week, file) => request("POST", `/upload-plan?week=${encodeURIComponent(week)}`, fileForm(file)) };
var planWeekApi = { view: (week) => request("GET", `/ui/plan-week${week ? `?week=${encodeURIComponent(week)}` : ""}`) };
var ripeningViewApi = { view: () => request("GET", "/ui/ripening") };
var reportsViewApi = { view: (date) => request("GET", `/ui/reports${date ? `?date=${encodeURIComponent(date)}` : ""}`) };
var reportsApi = { runDay: (date, file) => request("POST", `/run-all?date=${encodeURIComponent(date)}&filename=${encodeURIComponent(file.name)}`, fileForm(file)).then((r) => {
	if (r?.success === false) throw new ApiError(500, r);
	return r;
}) };
var ripeningApi = {
	generate: (week) => request("POST", `/chambers/ripening-plan?week=${encodeURIComponent(week)}`),
	uploadGgn: async (file) => {
		await request("POST", "/upload-ggn", fileForm(file));
		return request("POST", "/chambers/parse-ggn");
	}
};
var chambersApi = {
	view: () => request("GET", "/ui/chambers"),
	setGasDay: (chamberNum, planDate, clientTag) => request("POST", "/placements/plan-date", {
		chamberNum,
		planDate: planDate || null,
		clientTag
	})
};
var q = (date) => date ? `?date=${encodeURIComponent(date)}` : "";
var todayApi = { view: (date) => request("GET", `/ui/today${q(date)}`) };
var stockApi = {
	view: (date) => request("GET", `/ui/stock${q(date)}`),
	fill: (date) => request("POST", "/stock/book/fill", { date }),
	reconcile: (date, file) => {
		const form = fileForm(file);
		form.append("date", date);
		return request("POST", "/stock/book/reconcile", form);
	},
	bookUrl: (year) => `${apiBase()}/stock/book/download?year=${encodeURIComponent(year)}`,
	totalUrl: (date) => `${apiBase()}/stock/total${q(date)}`
};
var ordersApi = {
	list: (date) => request("GET", `/orders?date=${encodeURIComponent(date)}`),
	status: (date) => request("GET", `/scan-status?date=${encodeURIComponent(date)}`),
	updateQty: ({ orderKey, date, qty, pal }) => request("POST", "/orders/update-qty", {
		orderKey,
		date,
		qty,
		pal
	}),
	clientReport: (date) => request("POST", "/generate-client-report", { date })
};
var stickersApi = {
	preview: (body) => request("POST", "/stickers/preview", body),
	print: (body) => request("POST", "/stickers/print", body),
	saveGln: ({ gln, supplier, plantationCode }) => request("POST", "/stickers/gln", {
		gln,
		supplier,
		plantationCode
	}),
	log: ({ date, orderKey = "" }) => request("GET", `/stickers/log?date=${encodeURIComponent(date)}&orderKey=${encodeURIComponent(orderKey)}`)
};
var warehouseApi = {
	lookup: (code) => request("GET", `/warehouse/lookup/${encodeURIComponent(code)}`),
	match: ({ code = "", chamberNum = "", orderKey, date }) => request("GET", `/warehouse/match?code=${encodeURIComponent(code)}&chamberNum=${encodeURIComponent(chamberNum || "")}&orderKey=${encodeURIComponent(orderKey)}&date=${encodeURIComponent(date)}`),
	ggn: (q) => request("GET", `/warehouse/ggn?q=${encodeURIComponent(q)}`),
	balance: (date) => request("GET", `/warehouse/daily-balance?date=${encodeURIComponent(date)}`),
	send: (op, body) => request("POST", `/warehouse/${op}`, body)
};
var filesApi = {
	view: (path) => request("GET", `/files/view?path=${encodeURIComponent(path)}`),
	saveField: (path, key, value) => request("PUT", "/files/override", {
		path,
		key,
		value
	}),
	resetField: (path, key) => request("DELETE", `/files/override?path=${encodeURIComponent(path)}&key=${encodeURIComponent(key)}`),
	downloadUrl: (path) => `${apiBase()}/files/download?path=${encodeURIComponent(path)}`,
	printers: () => request("GET", "/files/printers"),
	print: (path, printer) => request("POST", "/files/print", {
		path,
		printer: printer || void 0
	})
};
//#endregion
//#region src/components/services/session.js
var user = null;
var resolveReady;
var ready = new Promise((r) => resolveReady = r);
var currentUser = () => user;
var can = (...perms) => Boolean(user) && perms.some((p) => user.perms.includes(p));
function applyPermissions(root = document) {
	root.querySelectorAll("[data-perm]").forEach((el) => {
		if (!can(...el.dataset.perm.split(/\s+/))) el.remove();
	});
}
function toLogin() {
	const next = location.pathname.split("/").pop() + location.search;
	location.replace(`login.html?next=${encodeURIComponent(next)}`);
}
var ME_KEY = perServer("yellow:me");
var ME_TTL = 432e5;
function rememberMe(u) {
	try {
		localStorage.setItem(ME_KEY, JSON.stringify({
			user: u,
			at: Date.now()
		}));
	} catch {}
}
function rememberedMe() {
	try {
		const v = JSON.parse(localStorage.getItem(ME_KEY));
		return v && Date.now() - v.at < ME_TTL ? v.user : null;
	} catch {
		return null;
	}
}
async function guard({ perm } = {}) {
	try {
		user = await authApi.me();
		rememberMe(user);
	} catch (err) {
		if (err instanceof ApiError && (err.status === 401 || err.code === "device_not_trusted")) {
			try {
				localStorage.removeItem(ME_KEY);
			} catch {}
			resolveReady(null);
			toLogin();
			return null;
		}
		const offlineOk = document.querySelector("[data-offline-ok]") && err instanceof ApiError && err.status === 0 && rememberedMe();
		if (!offlineOk) throw err;
		user = offlineOk;
	}
	applyPermissions();
	document.dispatchEvent(new CustomEvent("session:ready", { detail: { user } }));
	if (perm && !can(...[perm].flat())) {
		resolveReady(null);
		const home = homeFor(user);
		if (location.pathname.endsWith(`/${home}`)) showNoAccess();
		else location.replace(home);
		return null;
	}
	resolveReady(user);
	return user;
}
async function logout() {
	try {
		localStorage.removeItem(ME_KEY);
	} catch {}
	try {
		await authApi.logout();
	} finally {
		user = null;
		location.replace("login.html");
	}
}
function homeFor(u) {
	if (u.perms.includes("dashboard.view")) return "index.html";
	if (u.perms.includes("chambers.view")) return "chambers.html";
	return "scanner.html";
}
function showUnavailable(err) {
	const main = document.querySelector(".page, .mobile__app") || document.body;
	const offline = err?.status === 0;
	main.innerHTML = `
		<div class="empty-state">
			<p class="empty-state__title">${offline ? "No connection to the server" : "Server problem"}</p>
			<p class="empty-state__text">${offline ? "Check the Wi-Fi and try again." : `The server answered ${err?.status ?? ""}. Try again in a minute.`}</p>
			<button type="button" class="btn btn--primary" onclick="location.reload()">Try again</button>
		</div>`;
	document.documentElement.classList.remove("is-auth-pending");
}
function showNoAccess() {
	const main = document.querySelector(".page, .mobile__app") || document.body;
	main.innerHTML = `
		<div class="empty-state">
			<p class="empty-state__title">No access</p>
			<p class="empty-state__text">Your role (${user.roleLabel}) has no page in this app yet. Ask the administrator.</p>
			<button type="button" class="btn btn--secondary" data-logout>Sign out</button>
		</div>`;
	document.documentElement.classList.remove("is-auth-pending");
}
document.addEventListener("click", (e) => {
	if (e.target.closest("[data-logout]")) logout();
});
function idleLogout(minutes = 15) {
	let timer;
	const arm = () => {
		clearTimeout(timer);
		timer = setTimeout(logout, minutes * 60 * 1e3);
	};
	[
		"pointerdown",
		"keydown",
		"visibilitychange"
	].forEach((ev) => document.addEventListener(ev, arm, { passive: true }));
	arm();
}
//#endregion
//#region src/components/services/i18n/dict-shell.js
var dict_shell_default = [
	[
		"Today",
		null,
		"Сьогодні",
		"Dziś",
		"Astăzi",
		"Ma",
		"Aujourd’hui"
	],
	[
		"Chambers",
		null,
		"Комори",
		"Komory",
		"Camere",
		"Kamrák",
		"Chambres"
	],
	[
		"Plan Week",
		null,
		"План тижня",
		"Plan tygodnia",
		"Planul săptămânii",
		"Heti terv",
		"Plan de la semaine"
	],
	[
		"Ripening Plan",
		null,
		"План дозрівання",
		"Plan dojrzewania",
		"Plan de coacere",
		"Érlelési terv",
		"Plan de mûrissage"
	],
	[
		"Stock",
		null,
		"Залишки",
		"Stan magazynu",
		"Stoc",
		"Készlet",
		"Stock"
	],
	[
		"Reports",
		null,
		"Звіти",
		"Raporty",
		"Rapoarte",
		"Jelentések",
		"Rapports"
	],
	[
		"Scanner",
		null,
		"Сканер",
		"Skaner",
		"Scaner",
		"Szkenner",
		"Scanner"
	],
	[
		"Receiving",
		null,
		"Приймання",
		"Przyjęcie",
		"Recepție",
		"Áruátvétel",
		"Réception"
	],
	[
		"Outbound",
		null,
		"Відвантаження",
		"Wydanie",
		"Livrare",
		"Kiszállítás",
		"Expédition"
	],
	[
		"Rounds",
		null,
		"Обхід",
		"Obchód",
		"Tura de control",
		"Ellenőrző kör",
		"Tournée"
	],
	[
		"Settings",
		null,
		"Налаштування",
		"Ustawienia",
		"Setări",
		"Beállítások",
		"Paramètres"
	],
	[
		"Main",
		null,
		"Головне меню",
		"Menu główne",
		"Meniu principal",
		"Főmenü",
		"Menu principal"
	],
	[
		"Menu",
		null,
		"Меню",
		"Menu",
		"Meniu",
		"Menü",
		"Menu"
	],
	[
		"Close menu",
		null,
		"Закрити меню",
		"Zamknij menu",
		"Închide meniul",
		"Menü bezárása",
		"Fermer le menu"
	],
	[
		"Sign out",
		null,
		"Вийти",
		"Wyloguj",
		"Deconectare",
		"Kijelentkezés",
		"Se déconnecter"
	],
	[
		"Language",
		null,
		"Мова",
		"Język",
		"Limba",
		"Nyelv",
		"Langue"
	],
	[
		"{n} chambers",
		null,
		"комор: {n}",
		"komory: {n}",
		"camere: {n}",
		"{n} kamra",
		"{n} chambres"
	],
	[
		"{s} · {n} chambers",
		null,
		"{s} · комор: {n}",
		"{s} · komory: {n}",
		"{s} · camere: {n}",
		"{s} · {n} kamra",
		"{s} · {n} chambres"
	],
	[
		"Admin",
		null,
		"Адміністратор",
		"Administrator",
		"Administrator",
		"Adminisztrátor",
		"Administrateur"
	],
	[
		"Logistics",
		null,
		"Логістика",
		"Logistyka",
		"Logistică",
		"Logisztika",
		"Logistique"
	],
	[
		"Ripener",
		null,
		"Дозрівальник",
		"Operator dojrzewalni",
		"Operator coacere",
		"Érlelő",
		"Mûrisseur"
	],
	[
		"Quality",
		null,
		"Якість",
		"Kontrola jakości",
		"Calitate",
		"Minőség",
		"Qualité"
	],
	[
		"you",
		null,
		"ви",
		"ty",
		"tu",
		"te",
		"vous"
	],
	[
		"Example data.",
		null,
		"Приклад даних.",
		"Przykładowe dane.",
		"Date de exemplu.",
		"Példaadatok.",
		"Données d’exemple."
	],
	[
		"This page is not connected to the server yet — the numbers below are not real.",
		null,
		"Ця сторінка ще не підключена до сервера — числа нижче не справжні.",
		"Ta strona nie jest jeszcze połączona z serwerem — liczby poniżej nie są prawdziwe.",
		"Această pagină nu este încă conectată la server — cifrele de mai jos nu sunt reale.",
		"Ez az oldal még nincs a szerverhez kötve — az alábbi számok nem valósak.",
		"Cette page n’est pas encore reliée au serveur — les chiffres ci-dessous ne sont pas réels."
	],
	[
		"Loading…",
		null,
		"Завантаження…",
		"Ładowanie…",
		"Se încarcă…",
		"Betöltés…",
		"Chargement…"
	],
	[
		"Close",
		null,
		"Закрити",
		"Zamknij",
		"Închide",
		"Bezárás",
		"Fermer"
	],
	[
		"Save",
		null,
		"Зберегти",
		"Zapisz",
		"Salvează",
		"Mentés",
		"Enregistrer"
	],
	[
		"Saved",
		null,
		"Збережено",
		"Zapisano",
		"Salvat",
		"Mentve",
		"Enregistré"
	],
	[
		"Cancel",
		null,
		"Скасувати",
		"Anuluj",
		"Anulează",
		"Mégse",
		"Annuler"
	],
	[
		"Done",
		null,
		"Готово",
		"Gotowe",
		"Gata",
		"Kész",
		"Terminé"
	],
	[
		"Edit",
		null,
		"Змінити",
		"Edytuj",
		"Editează",
		"Szerkesztés",
		"Modifier"
	],
	[
		"Open",
		null,
		"Відкрити",
		"Otwórz",
		"Deschide",
		"Megnyitás",
		"Ouvrir"
	],
	[
		"View",
		null,
		"Переглянути",
		"Pokaż",
		"Vezi",
		"Megtekintés",
		"Voir"
	],
	[
		"Review",
		null,
		"Перевірити",
		"Sprawdź",
		"Verifică",
		"Ellenőrzés",
		"Vérifier"
	],
	[
		"All",
		null,
		"Усі",
		"Wszystkie",
		"Toate",
		"Mind",
		"Tous"
	],
	[
		"Date",
		null,
		"Дата",
		"Data",
		"Data",
		"Dátum",
		"Date"
	],
	[
		"Day",
		null,
		"День",
		"Dzień",
		"Ziua",
		"Nap",
		"Jour"
	],
	[
		"Week",
		null,
		"Тиждень",
		"Tydzień",
		"Săptămâna",
		"Hét",
		"Semaine"
	],
	[
		"Total",
		null,
		"Разом",
		"Razem",
		"Total",
		"Összesen",
		"Total"
	],
	[
		"Product",
		null,
		"Продукт",
		"Produkt",
		"Produs",
		"Termék",
		"Produit"
	],
	[
		"Boxes",
		null,
		"Ящики",
		"Kartony",
		"Cutii",
		"Doboz",
		"Cartons"
	],
	[
		"boxes",
		null,
		"ящ.",
		"kart.",
		"cutii",
		"doboz",
		"cartons"
	],
	[
		"Containers",
		null,
		"Контейнери",
		"Kontenery",
		"Containere",
		"Konténerek",
		"Conteneurs"
	],
	[
		"Choose file",
		null,
		"Обрати файл",
		"Wybierz plik",
		"Alege fișierul",
		"Fájl kiválasztása",
		"Choisir un fichier"
	],
	[
		"Drop",
		null,
		"Перетягни",
		"Upuść",
		"Trage",
		"Húzd ide:",
		"Déposez"
	],
	[
		"here",
		null,
		"сюди",
		"tutaj",
		"aici",
		"",
		"ici"
	],
	[
		"{n} KB · ready",
		null,
		"{n} KB · готово",
		"{n} KB · gotowe",
		"{n} KB · gata",
		"{n} KB · kész",
		"{n} Ko · prêt"
	],
	[
		"Wrong file. Expected {s}",
		null,
		"Не той файл. Очікується {s}",
		"Zły plik. Oczekiwano {s}",
		"Fișier greșit. Se aștepta {s}",
		"Rossz fájl. Várt fájl: {s}",
		"Mauvais fichier. Attendu : {s}"
	],
	[
		"Banana",
		null,
		"Банан",
		"Banan",
		"Banane",
		"Banán",
		"Banane"
	],
	[
		"Pineapple",
		null,
		"Ананас",
		"Ananas",
		"Ananas",
		"Ananász",
		"Ananas"
	],
	[
		"Market",
		null,
		"Маркет",
		"Market",
		"Market",
		"Market",
		"Market"
	],
	[
		"BIO market",
		null,
		"BIO маркет",
		"BIO market",
		"BIO market",
		"BIO market",
		"BIO market"
	],
	[
		"Empty",
		null,
		"Порожня",
		"Pusta",
		"Goală",
		"Üres",
		"Vide"
	],
	[
		"Mon",
		null,
		"Пн",
		"Pn",
		"Lu",
		"H",
		"Lun"
	],
	[
		"Tue",
		null,
		"Вт",
		"Wt",
		"Ma",
		"K",
		"Mar"
	],
	[
		"Wed",
		null,
		"Ср",
		"Śr",
		"Mi",
		"Sze",
		"Mer"
	],
	[
		"Thu",
		null,
		"Чт",
		"Cz",
		"Jo",
		"Cs",
		"Jeu"
	],
	[
		"Fri",
		null,
		"Пт",
		"Pt",
		"Vi",
		"P",
		"Ven"
	],
	[
		"Sat",
		null,
		"Сб",
		"Sb",
		"Sâ",
		"Szo",
		"Sam"
	],
	[
		"Sun",
		null,
		"Нд",
		"Nd",
		"Du",
		"V",
		"Dim"
	],
	[
		"Mon {s}",
		null,
		"Пн {s}",
		"Pn {s}",
		"Lu {s}",
		"H {s}",
		"Lun {s}"
	],
	[
		"Tue {s}",
		null,
		"Вт {s}",
		"Wt {s}",
		"Ma {s}",
		"K {s}",
		"Mar {s}"
	],
	[
		"Wed {s}",
		null,
		"Ср {s}",
		"Śr {s}",
		"Mi {s}",
		"Sze {s}",
		"Mer {s}"
	],
	[
		"Thu {s}",
		null,
		"Чт {s}",
		"Cz {s}",
		"Jo {s}",
		"Cs {s}",
		"Jeu {s}"
	],
	[
		"Fri {s}",
		null,
		"Пт {s}",
		"Pt {s}",
		"Vi {s}",
		"P {s}",
		"Ven {s}"
	],
	[
		"Sat {s}",
		null,
		"Сб {s}",
		"Sb {s}",
		"Sâ {s}",
		"Szo {s}",
		"Sam {s}"
	],
	[
		"Sun {s}",
		null,
		"Нд {s}",
		"Nd {s}",
		"Du {s}",
		"V {s}",
		"Dim {s}"
	],
	[
		"Not in the demo",
		null,
		"Немає в демо",
		"Niedostępne w demo",
		"Nu e disponibil în demo",
		"A demóban nem érhető el",
		"Indisponible dans la démo"
	],
	[
		"Files are made by the Banana Report server.",
		null,
		"Файли створює сервер Banana Report.",
		"Pliki tworzy serwer Banana Report.",
		"Fișierele sunt create de serverul Banana Report.",
		"A fájlokat a Banana Report szerver készíti.",
		"Les fichiers sont créés par le serveur Banana Report."
	],
	[
		"Open the file in the app instead — downloads come from the server.",
		null,
		"Відкрий файл у програмі — завантаження йдуть із сервера.",
		"Otwórz plik w aplikacji — pobieranie jest z serwera.",
		"Deschide fișierul în aplicație — descărcările vin de la server.",
		"Nyisd meg a fájlt az alkalmazásban — a letöltés a szerverről jön.",
		"Ouvrez le fichier dans l’application — les téléchargements viennent du serveur."
	],
	[
		"No connection to the server",
		null,
		"Немає зв’язку з сервером",
		"Brak połączenia z serwerem",
		"Nu există conexiune cu serverul",
		"Nincs kapcsolat a szerverrel",
		"Pas de connexion au serveur"
	],
	[
		"Server problem",
		null,
		"Проблема на сервері",
		"Problem z serwerem",
		"Problemă la server",
		"Szerverhiba",
		"Problème de serveur"
	],
	[
		"Check the Wi-Fi and try again.",
		null,
		"Перевір Wi-Fi і спробуй ще раз.",
		"Sprawdź Wi-Fi i spróbuj ponownie.",
		"Verifică Wi-Fi-ul și încearcă din nou.",
		"Ellenőrizd a Wi-Fi-t, és próbáld újra.",
		"Vérifiez le Wi-Fi et réessayez."
	],
	[
		"The server answered {n}. Try again in a minute.",
		null,
		"Сервер відповів {n}. Спробуй за хвилину.",
		"Serwer odpowiedział {n}. Spróbuj za minutę.",
		"Serverul a răspuns {n}. Încearcă peste un minut.",
		"A szerver válasza: {n}. Próbáld újra egy perc múlva.",
		"Le serveur a répondu {n}. Réessayez dans une minute."
	],
	[
		"Try again",
		null,
		"Спробувати ще",
		"Spróbuj ponownie",
		"Încearcă din nou",
		"Újra",
		"Réessayer"
	],
	[
		"No access",
		null,
		"Немає доступу",
		"Brak dostępu",
		"Fără acces",
		"Nincs hozzáférés",
		"Pas d’accès"
	],
	[
		"Your role ({s}) has no page in this app yet. Ask the administrator.",
		null,
		"Твоя роль ({s}) ще не має сторінки в програмі. Звернись до адміністратора.",
		"Twoja rola ({s}) nie ma jeszcze strony w aplikacji. Zapytaj administratora.",
		"Rolul tău ({s}) nu are încă o pagină în aplicație. Întreabă administratorul.",
		"A szerepkörödnek ({s}) még nincs oldala az alkalmazásban. Kérdezd az adminisztrátort.",
		"Votre rôle ({s}) n’a pas encore de page dans l’application. Demandez à l’administrateur."
	],
	[
		"Sent to the printer",
		null,
		"Надіслано на принтер",
		"Wysłano do drukarki",
		"Trimis la imprimantă",
		"Nyomtatóra küldve",
		"Envoyé à l’imprimante"
	],
	[
		"Not printed",
		null,
		"Не надруковано",
		"Nie wydrukowano",
		"Nu s-a tipărit",
		"Nem lett kinyomtatva",
		"Non imprimé"
	],
	[
		"Printer",
		null,
		"Принтер",
		"Drukarka",
		"Imprimantă",
		"Nyomtató",
		"Imprimante"
	],
	[
		"Not saved",
		null,
		"Не збережено",
		"Nie zapisano",
		"Nesalvat",
		"Nincs mentve",
		"Non enregistré"
	],
	[
		"Хто на зміні?",
		"Who is on shift?",
		null,
		"Kto jest na zmianie?",
		"Cine e în tură?",
		"Ki van műszakban?",
		"Qui est de service ?"
	],
	[
		"Обери себе, щоб увійти",
		"Pick yourself to sign in",
		null,
		"Wybierz siebie, aby się zalogować",
		"Alege-te pentru a intra",
		"Válaszd ki magad a belépéshez",
		"Choisissez votre nom pour vous connecter"
	],
	[
		"останній",
		"last",
		null,
		"ostatni",
		"ultimul",
		"utolsó",
		"dernier"
	],
	[
		"Введи PIN",
		"Enter PIN",
		null,
		"Wpisz PIN",
		"Introdu PIN-ul",
		"Add meg a PIN-kódot",
		"Saisissez le PIN"
	],
	[
		"Введи PIN · {n} цифри",
		"Enter PIN · {n} digits",
		null,
		"Wpisz PIN · {n} cyfry",
		"Introdu PIN-ul · {n} cifre",
		"Add meg a PIN-kódot · {n} számjegy",
		"Saisissez le PIN · {n} chiffres"
	],
	[
		"Введи PIN · {n} цифр",
		"Enter PIN · {n} digits",
		null,
		"Wpisz PIN · {n} cyfr",
		"Introdu PIN-ul · {n} cifre",
		"Add meg a PIN-kódot · {n} számjegy",
		"Saisissez le PIN · {n} chiffres"
	],
	[
		"Доступ надано",
		"Access granted",
		null,
		"Dostęp przyznany",
		"Acces permis",
		"Hozzáférés megadva",
		"Accès autorisé"
	],
	[
		"Очистити",
		"Clear",
		null,
		"Wyczyść",
		"Șterge",
		"Törlés",
		"Effacer"
	],
	[
		"Забув PIN? Його скидає адміністратор.",
		"Forgot the PIN? The administrator resets it.",
		null,
		"Zapomniałeś PIN-u? Resetuje go administrator.",
		"Ai uitat PIN-ul? Administratorul îl resetează.",
		"Elfelejtetted a PIN-kódot? Az adminisztrátor visszaállítja.",
		"PIN oublié ? L’administrateur le réinitialise."
	],
	[
		"Обрати іншого користувача",
		"Pick another user",
		null,
		"Wybierz innego użytkownika",
		"Alege alt utilizator",
		"Másik felhasználó",
		"Choisir un autre utilisateur"
	],
	[
		"PIN-код",
		"PIN code",
		null,
		"Kod PIN",
		"Cod PIN",
		"PIN-kód",
		"Code PIN"
	],
	[
		"PIN-код, введено {n} з {n}",
		"PIN code, {n} of {n} entered",
		null,
		"Kod PIN, wpisano {n} z {n}",
		"Cod PIN, {n} din {n} introduse",
		"PIN-kód, {n}/{n} megadva",
		"Code PIN, {n} sur {n} saisis"
	],
	[
		"Стерти цифру",
		"Delete digit",
		null,
		"Usuń cyfrę",
		"Șterge cifra",
		"Számjegy törlése",
		"Effacer le chiffre"
	],
	[
		"Вхід",
		"Sign in",
		null,
		"Logowanie",
		"Autentificare",
		"Belépés",
		"Connexion"
	],
	[
		"Перевірка…",
		"Checking…",
		null,
		"Sprawdzanie…",
		"Se verifică…",
		"Ellenőrzés…",
		"Vérification…"
	],
	[
		"Вітаємо, {s}!",
		"Welcome, {s}!",
		null,
		"Witaj, {s}!",
		"Bun venit, {s}!",
		"Üdv, {s}!",
		"Bienvenue, {s} !"
	],
	[
		"Невірний PIN",
		"Wrong PIN",
		null,
		"Błędny PIN",
		"PIN greșit",
		"Hibás PIN-kód",
		"PIN incorrect"
	],
	[
		"Невірний PIN. Залишилось {n} спроба",
		"Wrong PIN. Attempts left: {n}",
		null,
		"Błędny PIN. Pozostało prób: {n}",
		"PIN greșit. Încercări rămase: {n}",
		"Hibás PIN-kód. Hátralévő próbálkozások: {n}",
		"PIN incorrect. Essais restants : {n}"
	],
	[
		"Невірний PIN. Залишилось {n} спроби",
		"Wrong PIN. Attempts left: {n}",
		null,
		"Błędny PIN. Pozostało prób: {n}",
		"PIN greșit. Încercări rămase: {n}",
		"Hibás PIN-kód. Hátralévő próbálkozások: {n}",
		"PIN incorrect. Essais restants : {n}"
	],
	[
		"Невірний PIN. Залишилось {n} спроб",
		"Wrong PIN. Attempts left: {n}",
		null,
		"Błędny PIN. Pozostało prób: {n}",
		"PIN greșit. Încercări rămase: {n}",
		"Hibás PIN-kód. Hátralévő próbálkozások: {n}",
		"PIN incorrect. Essais restants : {n}"
	],
	[
		"Немає зв’язку з сервером. Спробуй ще раз.",
		"No connection to the server. Try again.",
		null,
		"Brak połączenia z serwerem. Spróbuj ponownie.",
		"Nu există conexiune cu serverul. Încearcă din nou.",
		"Nincs kapcsolat a szerverrel. Próbáld újra.",
		"Pas de connexion au serveur. Réessayez."
	],
	[
		"Немає зв’язку з сервером. Перевір Wi-Fi і онови сторінку.",
		"No connection to the server. Check the Wi-Fi and reload the page.",
		null,
		"Brak połączenia z serwerem. Sprawdź Wi-Fi i odśwież stronę.",
		"Nu există conexiune cu serverul. Verifică Wi-Fi-ul și reîncarcă pagina.",
		"Nincs kapcsolat a szerverrel. Ellenőrizd a Wi-Fi-t, és töltsd újra az oldalt.",
		"Pas de connexion au serveur. Vérifiez le Wi-Fi et rechargez la page."
	],
	[
		"Ще немає жодного користувача. На комп’ютері із сервером виконай: npm run create-admin -- \"Ім’я\" — і онови сторінку.",
		"There are no users yet. On the server computer run: npm run create-admin -- \"Name\" — then reload the page.",
		null,
		"Nie ma jeszcze żadnego użytkownika. Na komputerze z serwerem uruchom: npm run create-admin -- \"Imię\" — i odśwież stronę.",
		"Nu există încă niciun utilizator. Pe calculatorul cu serverul rulează: npm run create-admin -- \"Nume\" — apoi reîncarcă pagina.",
		"Még nincs felhasználó. A szervergépen futtasd: npm run create-admin -- \"Név\" — majd töltsd újra az oldalt.",
		"Aucun utilisateur pour l’instant. Sur l’ordinateur du serveur, lancez : npm run create-admin -- \"Nom\" — puis rechargez la page."
	],
	[
		"Не вдалося завантажити користувачів.",
		"Could not load the users.",
		null,
		"Nie udało się wczytać użytkowników.",
		"Utilizatorii nu au putut fi încărcați.",
		"Nem sikerült betölteni a felhasználókat.",
		"Impossible de charger les utilisateurs."
	],
	[
		"Забагато спроб з цього телефона. Зачекай 15 хвилин.",
		"Too many attempts from this phone. Wait 15 minutes.",
		null,
		"Za dużo prób z tego telefonu. Odczekaj 15 minut.",
		"Prea multe încercări de pe acest telefon. Așteaptă 15 minute.",
		"Túl sok próbálkozás erről a telefonról. Várj 15 percet.",
		"Trop d’essais depuis ce téléphone. Attendez 15 minutes."
	],
	[
		"Забагато спроб. Спробуй через {s} або звернись до адміністратора",
		"Too many attempts. Try again in {s} or ask the administrator",
		null,
		"Za dużo prób. Spróbuj za {s} lub zapytaj administratora",
		"Prea multe încercări. Încearcă peste {s} sau întreabă administratorul",
		"Túl sok próbálkozás. Próbáld újra {s} múlva, vagy kérdezd az adminisztrátort",
		"Trop d’essais. Réessayez dans {s} ou demandez à l’administrateur"
	],
	[
		"Users & roles",
		null,
		"Користувачі та ролі",
		"Użytkownicy i role",
		"Utilizatori și roluri",
		"Felhasználók és szerepkörök",
		"Utilisateurs et rôles"
	],
	[
		"Users and roles",
		null,
		"Користувачі та ролі",
		"Użytkownicy i role",
		"Utilizatori și roluri",
		"Felhasználók és szerepkörök",
		"Utilisateurs et rôles"
	],
	[
		"Who can sign in, with which PIN, and what each role is allowed to do.",
		null,
		"Хто може входити, з яким PIN і що дозволено кожній ролі.",
		"Kto może się logować, jakim PIN-em i co wolno każdej roli.",
		"Cine se poate autentifica, cu ce PIN și ce are voie să facă fiecare rol.",
		"Ki léphet be, milyen PIN-kóddal, és mit tehet az egyes szerepkör.",
		"Qui peut se connecter, avec quel PIN, et ce que chaque rôle peut faire."
	],
	[
		"Add user",
		null,
		"Додати користувача",
		"Dodaj użytkownika",
		"Adaugă utilizator",
		"Felhasználó hozzáadása",
		"Ajouter un utilisateur"
	],
	[
		"Edit user",
		null,
		"Змінити користувача",
		"Edytuj użytkownika",
		"Editează utilizatorul",
		"Felhasználó szerkesztése",
		"Modifier l’utilisateur"
	],
	[
		"Users",
		null,
		"Користувачі",
		"Użytkownicy",
		"Utilizatori",
		"Felhasználók",
		"Utilisateurs"
	],
	[
		"Roles",
		null,
		"Ролі",
		"Role",
		"Roluri",
		"Szerepkörök",
		"Rôles"
	],
	[
		"User",
		null,
		"Користувач",
		"Użytkownik",
		"Utilizator",
		"Felhasználó",
		"Utilisateur"
	],
	[
		"Role",
		null,
		"Роль",
		"Rola",
		"Rol",
		"Szerepkör",
		"Rôle"
	],
	[
		"PIN",
		null,
		"PIN",
		"PIN",
		"PIN",
		"PIN",
		"PIN"
	],
	[
		"Last sign-in",
		null,
		"Останній вхід",
		"Ostatnie logowanie",
		"Ultima autentificare",
		"Utolsó belépés",
		"Dernière connexion"
	],
	[
		"Actions",
		null,
		"Дії",
		"Akcje",
		"Acțiuni",
		"Műveletek",
		"Actions"
	],
	[
		"{n} digits",
		null,
		"{n} цифр",
		"{n} cyfr",
		"{n} cifre",
		"{n} számjegy",
		"{n} chiffres"
	],
	[
		"Yesterday {s}",
		null,
		"Учора {s}",
		"Wczoraj {s}",
		"Ieri {s}",
		"Tegnap {s}",
		"Hier {s}"
	],
	[
		"Today {s}",
		null,
		"Сьогодні {s}",
		"Dziś {s}",
		"Astăzi {s}",
		"Ma {s}",
		"Aujourd’hui {s}"
	],
	[
		"Never",
		null,
		"Ніколи",
		"Nigdy",
		"Niciodată",
		"Soha",
		"Jamais"
	],
	[
		"Active",
		null,
		"Активний",
		"Aktywny",
		"Activ",
		"Aktív",
		"Actif"
	],
	[
		"Disabled",
		null,
		"Вимкнений",
		"Wyłączony",
		"Dezactivat",
		"Letiltva",
		"Désactivé"
	],
	[
		"Locked · {s}",
		null,
		"Заблоковано · {s}",
		"Zablokowany · {s}",
		"Blocat · {s}",
		"Zárolva · {s}",
		"Bloqué · {s}"
	],
	[
		"Unlock",
		null,
		"Розблокувати",
		"Odblokuj",
		"Deblochează",
		"Feloldás",
		"Débloquer"
	],
	[
		"What each role can do",
		null,
		"Що може кожна роль",
		"Co może każda rola",
		"Ce poate face fiecare rol",
		"Mit tehet az egyes szerepkör",
		"Ce que chaque rôle peut faire"
	],
	[
		"The server checks these permissions on every action. Hiding a button is not enough.",
		null,
		"Сервер перевіряє ці дозволи при кожній дії. Сховати кнопку недостатньо.",
		"Serwer sprawdza te uprawnienia przy każdej akcji. Ukrycie przycisku nie wystarcza.",
		"Serverul verifică aceste permisiuni la fiecare acțiune. Nu ajunge să ascunzi un buton.",
		"A szerver minden műveletnél ellenőrzi ezeket a jogosultságokat. Egy gomb elrejtése nem elég.",
		"Le serveur vérifie ces droits à chaque action. Masquer un bouton ne suffit pas."
	],
	[
		"New role",
		null,
		"Нова роль",
		"Nowa rola",
		"Rol nou",
		"Új szerepkör",
		"Nouveau rôle"
	],
	[
		"Permission",
		null,
		"Дозвіл",
		"Uprawnienie",
		"Permisiune",
		"Jogosultság",
		"Droit"
	],
	[
		"1 user",
		null,
		"1 користувач",
		"1 użytkownik",
		"1 utilizator",
		"1 felhasználó",
		"1 utilisateur"
	],
	[
		"{n} users",
		null,
		"користувачів: {n}",
		"użytkownicy: {n}",
		"{n} utilizatori",
		"{n} felhasználó",
		"{n} utilisateurs"
	],
	[
		"Overview",
		null,
		"Огляд",
		"Przegląd",
		"Prezentare",
		"Áttekintés",
		"Vue d’ensemble"
	],
	[
		"Planning",
		null,
		"Планування",
		"Planowanie",
		"Planificare",
		"Tervezés",
		"Planification"
	],
	[
		"Stock & reports",
		null,
		"Залишки і звіти",
		"Magazyn i raporty",
		"Stoc și rapoarte",
		"Készlet és jelentések",
		"Stock et rapports"
	],
	[
		"Administration",
		null,
		"Адміністрування",
		"Administracja",
		"Administrare",
		"Adminisztráció",
		"Administration"
	],
	[
		"See Today dashboard",
		null,
		"Бачити панель «Сьогодні»",
		"Widzieć pulpit „Dziś”",
		"Vede panoul „Astăzi”",
		"A „Ma” irányítópult megtekintése",
		"Voir le tableau « Aujourd’hui »"
	],
	[
		"See chamber map",
		null,
		"Бачити карту комор",
		"Widzieć mapę komór",
		"Vede harta camerelor",
		"Kamratérkép megtekintése",
		"Voir le plan des chambres"
	],
	[
		"Set gas day",
		null,
		"Встановити день газування",
		"Ustaw dzień gazowania",
		"Setează ziua de gazare",
		"Gázosítási nap beállítása",
		"Fixer le jour de gazage"
	],
	[
		"Move or write off boxes",
		null,
		"Переміщувати або списувати ящики",
		"Przenosić lub odpisywać kartony",
		"Mută sau scoate cutii din stoc",
		"Dobozok áthelyezése vagy leírása",
		"Déplacer ou sortir des cartons"
	],
	[
		"Upload transport & sales plan",
		null,
		"Завантажувати транспортний і Sales Plan",
		"Wgrywać plan transportu i sprzedaży",
		"Încarcă planul de transport și de vânzări",
		"Szállítási és értékesítési terv feltöltése",
		"Charger le plan de transport et de ventes"
	],
	[
		"Generate ripening plan",
		null,
		"Створювати план дозрівання",
		"Tworzyć plan dojrzewania",
		"Generează planul de coacere",
		"Érlelési terv készítése",
		"Générer le plan de mûrissage"
	],
	[
		"Fill stock day",
		null,
		"Заповнити день у залишках",
		"Uzupełnij dzień magazynu",
		"Completează ziua în stoc",
		"Készletnap kitöltése",
		"Remplir la journée de stock"
	],
	[
		"Reconcile stock file",
		null,
		"Звіряти файл залишків",
		"Uzgadniać plik magazynu",
		"Reconciliază fișierul de stoc",
		"Készletfájl egyeztetése",
		"Rapprocher le fichier de stock"
	],
	[
		"Download reports",
		null,
		"Завантажувати звіти",
		"Pobierać raporty",
		"Descarcă rapoarte",
		"Jelentések letöltése",
		"Télécharger les rapports"
	],
	[
		"Receive containers",
		null,
		"Приймати контейнери",
		"Przyjmować kontenery",
		"Recepționează containere",
		"Konténerek átvétele",
		"Réceptionner les conteneurs"
	],
	[
		"Scan shipments",
		null,
		"Сканувати відвантаження",
		"Skanować wysyłki",
		"Scanează expedierile",
		"Kiszállítások szkennelése",
		"Scanner les expéditions"
	],
	[
		"Market & garbage pallets",
		null,
		"Маркет- і утиль-палети",
		"Palety market i odpady",
		"Paleți market și deșeuri",
		"Market- és hulladékraklapok",
		"Palettes market et déchets"
	],
	[
		"Manage users & roles",
		null,
		"Керувати користувачами й ролями",
		"Zarządzać użytkownikami i rolami",
		"Gestionează utilizatori și roluri",
		"Felhasználók és szerepkörök kezelése",
		"Gérer les utilisateurs et les rôles"
	],
	[
		"Edit settings",
		null,
		"Змінювати налаштування",
		"Zmieniać ustawienia",
		"Modifică setările",
		"Beállítások módosítása",
		"Modifier les paramètres"
	],
	[
		"Admin always has every permission, so the system can't lose its administrator.",
		null,
		"Адміністратор завжди має всі дозволи, тож система не залишиться без адміністратора.",
		"Administrator zawsze ma wszystkie uprawnienia, więc system nie straci administratora.",
		"Administratorul are mereu toate permisiunile, ca sistemul să nu rămână fără administrator.",
		"Az adminisztrátornak mindig minden joga megvan, így a rendszer nem marad adminisztrátor nélkül.",
		"L’administrateur a toujours tous les droits : le système ne peut pas perdre son administrateur."
	],
	[
		"Name on the sign-in screen",
		null,
		"Ім’я на екрані входу",
		"Nazwa na ekranie logowania",
		"Numele pe ecranul de autentificare",
		"Név a belépési képernyőn",
		"Nom sur l’écran de connexion"
	],
	[
		"First name + initial is enough. Shown on the login tiles.",
		null,
		"Достатньо імені та ініціала. Показується на плитках входу.",
		"Wystarczy imię i inicjał. Widoczne na kafelkach logowania.",
		"Ajunge prenumele și inițiala. Apare pe dalele de autentificare.",
		"Elég a keresztnév és egy kezdőbetű. A belépési csempéken látszik.",
		"Le prénom et une initiale suffisent. Affiché sur les tuiles de connexion."
	],
	[
		"Roles that can manage users get a 6-digit PIN, everyone else 4 digits.",
		null,
		"Ролі, що керують користувачами, мають 6-значний PIN, решта — 4-значний.",
		"Role zarządzające użytkownikami mają PIN 6-cyfrowy, pozostali 4-cyfrowy.",
		"Rolurile care gestionează utilizatori au PIN de 6 cifre, restul de 4.",
		"A felhasználókat kezelő szerepkörök 6 jegyű, a többiek 4 jegyű PIN-kódot kapnak.",
		"Les rôles qui gèrent les utilisateurs ont un PIN à 6 chiffres, les autres à 4."
	],
	[
		"Reset PIN",
		null,
		"Скинути PIN",
		"Resetuj PIN",
		"Resetează PIN-ul",
		"PIN-kód visszaállítása",
		"Réinitialiser le PIN"
	],
	[
		"Click again to reset",
		null,
		"Натисни ще раз, щоб скинути",
		"Kliknij ponownie, aby zresetować",
		"Apasă din nou pentru resetare",
		"Kattints újra a visszaállításhoz",
		"Cliquez à nouveau pour réinitialiser"
	],
	[
		"The PIN is created when you save and shown here once.",
		null,
		"PIN створюється під час збереження і показується тут один раз.",
		"PIN powstaje przy zapisie i jest pokazany tu raz.",
		"PIN-ul se creează la salvare și apare aici o singură dată.",
		"A PIN-kód mentéskor jön létre, és itt egyszer látszik.",
		"Le PIN est créé à l’enregistrement et affiché ici une seule fois."
	],
	[
		"Write it down now and give it to the person. After closing, nobody can see this PIN again, only reset it.",
		null,
		"Запиши його зараз і передай людині. Після закриття цей PIN ніхто не побачить — лише скинути.",
		"Zapisz go teraz i przekaż tej osobie. Po zamknięciu nikt go już nie zobaczy — można go tylko zresetować.",
		"Notează-l acum și dă-l persoanei. După închidere nimeni nu-l mai poate vedea, doar reseta.",
		"Írd fel most, és add át az illetőnek. Bezárás után senki sem látja többé, csak visszaállítható.",
		"Notez-le maintenant et donnez-le à la personne. Après fermeture, personne ne peut le revoir, seulement le réinitialiser."
	],
	[
		"Access",
		null,
		"Доступ",
		"Dostęp",
		"Acces",
		"Hozzáférés",
		"Accès"
	],
	[
		"Disabled users can't sign in. Their history stays, so we never delete people.",
		null,
		"Вимкнені користувачі не можуть увійти. Їхня історія лишається, тому людей не видаляємо.",
		"Wyłączeni użytkownicy nie mogą się logować. Ich historia zostaje, więc nikogo nie usuwamy.",
		"Utilizatorii dezactivați nu se pot autentifica. Istoricul rămâne, de aceea nu ștergem pe nimeni.",
		"A letiltott felhasználók nem léphetnek be. Az előzményeik megmaradnak, ezért senkit sem törlünk.",
		"Les utilisateurs désactivés ne peuvent pas se connecter. Leur historique reste : on ne supprime personne."
	],
	[
		"Disable user",
		null,
		"Вимкнути користувача",
		"Wyłącz użytkownika",
		"Dezactivează utilizatorul",
		"Felhasználó letiltása",
		"Désactiver l’utilisateur"
	],
	[
		"Enable user",
		null,
		"Увімкнути користувача",
		"Włącz użytkownika",
		"Activează utilizatorul",
		"Felhasználó engedélyezése",
		"Activer l’utilisateur"
	],
	[
		"Create user",
		null,
		"Створити користувача",
		"Utwórz użytkownika",
		"Creează utilizatorul",
		"Felhasználó létrehozása",
		"Créer l’utilisateur"
	],
	[
		"Save changes",
		null,
		"Зберегти зміни",
		"Zapisz zmiany",
		"Salvează modificările",
		"Változások mentése",
		"Enregistrer les modifications"
	],
	[
		"Save roles",
		null,
		"Зберегти ролі",
		"Zapisz role",
		"Salvează rolurile",
		"Szerepkörök mentése",
		"Enregistrer les rôles"
	],
	[
		"1 unsaved change",
		null,
		"1 незбережена зміна",
		"1 niezapisana zmiana",
		"1 modificare nesalvată",
		"1 nem mentett változás",
		"1 modification non enregistrée"
	],
	[
		"{n} unsaved changes",
		null,
		"незбережених змін: {n}",
		"niezapisane zmiany: {n}",
		"{n} modificări nesalvate",
		"{n} nem mentett változás",
		"{n} modifications non enregistrées"
	],
	[
		"e.g. Олег М.",
		null,
		"напр. Олег М.",
		"np. Олег М.",
		"ex. Олег М.",
		"pl. Олег М.",
		"p. ex. Олег М."
	],
	[
		"No connection to the server. Check the network and reload.",
		null,
		"Немає зв’язку з сервером. Перевір мережу й онови сторінку.",
		"Brak połączenia z serwerem. Sprawdź sieć i odśwież.",
		"Nu există conexiune cu serverul. Verifică rețeaua și reîncarcă.",
		"Nincs kapcsolat a szerverrel. Ellenőrizd a hálózatot, és töltsd újra.",
		"Pas de connexion au serveur. Vérifiez le réseau et rechargez."
	],
	[
		"Could not load users ({s}).",
		null,
		"Не вдалося завантажити користувачів ({s}).",
		"Nie udało się wczytać użytkowników ({s}).",
		"Utilizatorii nu au putut fi încărcați ({s}).",
		"Nem sikerült betölteni a felhasználókat ({s}).",
		"Impossible de charger les utilisateurs ({s})."
	],
	[
		"{s} unlocked",
		null,
		"{s} розблоковано",
		"{s} odblokowany",
		"{s} deblocat",
		"{s} feloldva",
		"{s} débloqué"
	],
	[
		"{s} added",
		null,
		"{s} додано",
		"Dodano: {s}",
		"{s} a fost adăugat",
		"{s} hozzáadva",
		"{s} ajouté"
	],
	[
		"Give them the PIN shown in the panel.",
		null,
		"Передай PIN, показаний на панелі.",
		"Przekaż PIN pokazany w panelu.",
		"Dă-i PIN-ul afișat în panou.",
		"Add át a panelen látható PIN-kódot.",
		"Donnez-lui le PIN affiché dans le panneau."
	],
	[
		"Saved · {s}",
		null,
		"Збережено · {s}",
		"Zapisano · {s}",
		"Salvat · {s}",
		"Mentve · {s}",
		"Enregistré · {s}"
	],
	[
		"{s} has a new {n}-digit PIN",
		null,
		"{s} отримує новий {n}-значний PIN",
		"{s} ma nowy {n}-cyfrowy PIN",
		"{s} are un PIN nou de {n} cifre",
		"{s} új, {n} jegyű PIN-kódot kapott",
		"{s} a un nouveau PIN à {n} chiffres"
	],
	[
		"Their role needs a longer PIN.",
		null,
		"Їхній ролі потрібен довший PIN.",
		"Ta rola wymaga dłuższego PIN-u.",
		"Rolul cere un PIN mai lung.",
		"A szerepköréhez hosszabb PIN kell.",
		"Ce rôle exige un PIN plus long."
	],
	[
		"New PIN for {s}",
		null,
		"Новий PIN для {s}",
		"Nowy PIN dla {s}",
		"PIN nou pentru {s}",
		"Új PIN-kód: {s}",
		"Nouveau PIN pour {s}"
	],
	[
		"The old PIN no longer works.",
		null,
		"Старий PIN більше не діє.",
		"Stary PIN już nie działa.",
		"Vechiul PIN nu mai funcționează.",
		"A régi PIN-kód már nem működik.",
		"L’ancien PIN ne fonctionne plus."
	],
	[
		"{s} can no longer sign in",
		null,
		"{s} більше не може входити",
		"{s} nie może się już logować",
		"{s} nu se mai poate autentifica",
		"{s} többé nem léphet be",
		"{s} ne peut plus se connecter"
	],
	[
		"{s} can sign in again",
		null,
		"{s} знову може входити",
		"{s} znowu może się logować",
		"{s} se poate autentifica din nou",
		"{s} újra beléphet",
		"{s} peut à nouveau se connecter"
	],
	[
		"This is the last administrator",
		null,
		"Це останній адміністратор",
		"To ostatni administrator",
		"Acesta e ultimul administrator",
		"Ez az utolsó adminisztrátor",
		"C’est le dernier administrateur"
	],
	[
		"Roles saved",
		null,
		"Ролі збережено",
		"Role zapisane",
		"Roluri salvate",
		"Szerepkörök mentve",
		"Rôles enregistrés"
	],
	[
		"People with changed roles sign in again to get them.",
		null,
		"Люди зі зміненими ролями мають увійти знову, щоб їх отримати.",
		"Osoby ze zmienionymi rolami muszą zalogować się ponownie.",
		"Persoanele cu roluri schimbate trebuie să se autentifice din nou.",
		"A módosított szerepkörű felhasználóknak újra be kell lépniük.",
		"Les personnes dont le rôle a changé doivent se reconnecter."
	],
	[
		"Chamber {n}: {n} + {n} > {n}",
		null,
		"Комора {n}: {n} + {n} > {n}",
		"Komora {n}: {n} + {n} > {n}",
		"Camera {n}: {n} + {n} > {n}",
		"{n}. kamra: {n} + {n} > {n}",
		"Chambre {n} : {n} + {n} > {n}"
	],
	[
		"chamber must be 1–29",
		null,
		"комора має бути 1–29",
		"komora musi być 1–29",
		"camera trebuie să fie 1–29",
		"a kamra 1–29 lehet",
		"la chambre doit être 1–29"
	],
	[
		"target chamber must be 1–29",
		null,
		"комора призначення має бути 1–29",
		"komora docelowa musi być 1–29",
		"camera de destinație trebuie să fie 1–29",
		"a célkamra 1–29 lehet",
		"la chambre de destination doit être 1–29"
	],
	[
		"side must be LS or RS",
		null,
		"сторона має бути LS або RS",
		"strona musi być LS lub RS",
		"latura trebuie să fie LS sau RS",
		"az oldal LS vagy RS lehet",
		"le côté doit être LS ou RS"
	],
	[
		"boxes must be a positive whole number",
		null,
		"кількість ящиків — ціле додатне число",
		"liczba kartonów musi być dodatnią liczbą całkowitą",
		"numărul de cutii trebuie să fie un întreg pozitiv",
		"a dobozszám pozitív egész szám legyen",
		"le nombre de cartons doit être un entier positif"
	],
	[
		"qty must be a positive whole number",
		null,
		"кількість — ціле додатне число",
		"ilość musi być dodatnią liczbą całkowitą",
		"cantitatea trebuie să fie un întreg pozitiv",
		"a mennyiség pozitív egész szám legyen",
		"la quantité doit être un entier positif"
	],
	[
		"Only {n} boxes of {s} in chamber {n}",
		null,
		"Лише {n} ящ. {s} у коморі {n}",
		"Tylko {n} kart. {s} w komorze {n}",
		"Doar {n} cutii din {s} în camera {n}",
		"Csak {n} doboz {s} a(z) {n}. kamrában",
		"Seulement {n} cartons de {s} en chambre {n}"
	],
	[
		"Container {s} not received",
		null,
		"Контейнер {s} не прийнято",
		"Kontener {s} nie został przyjęty",
		"Containerul {s} nu a fost recepționat",
		"A(z) {s} konténer nincs átvéve",
		"Conteneur {s} non réceptionné"
	],
	[
		"boxCounts is empty",
		null,
		"палета порожня",
		"paleta jest pusta",
		"paletul este gol",
		"a raklap üres",
		"la palette est vide"
	],
	[
		"planDate must be YYYY-MM-DD or null",
		null,
		"дата має бути у форматі РРРР-ММ-ДД",
		"data musi mieć format RRRR-MM-DD",
		"data trebuie să fie AAAA-LL-ZZ",
		"a dátum formátuma ÉÉÉÉ-HH-NN",
		"la date doit être au format AAAA-MM-JJ"
	],
	[
		"Expected the Sales Plan (sales…xlsx)",
		null,
		"Очікується Sales Plan (sales…xlsx)",
		"Oczekiwano Sales Plan (sales…xlsx)",
		"Se aștepta Sales Plan (sales…xlsx)",
		"Sales Plan fájlt vártunk (sales…xlsx)",
		"Sales Plan attendu (sales…xlsx)"
	],
	[
		"File name must be PLAN_week_N.xlsx",
		null,
		"Ім’я файлу має бути PLAN_week_N.xlsx",
		"Nazwa pliku musi być PLAN_week_N.xlsx",
		"Numele fișierului trebuie să fie PLAN_week_N.xlsx",
		"A fájlnév PLAN_week_N.xlsx legyen",
		"Le nom du fichier doit être PLAN_week_N.xlsx"
	],
	[
		"Підключення до сервера",
		"Connect to the server",
		null,
		"Połączenie z serwerem",
		"Conectare la server",
		"Csatlakozás a szerverhez",
		"Connexion au serveur"
	],
	[
		"Відскануй QR-код на комп’ютері із сервером — той самий, з якого завантажував аплікацію.",
		"Scan the QR code on the server computer — the same one you downloaded the app from.",
		null,
		"Zeskanuj kod QR na komputerze z serwerem — ten sam, z którego pobrano aplikację.",
		"Scanează codul QR de pe calculatorul cu serverul — același de pe care ai descărcat aplicația.",
		"Olvasd be a QR-kódot a szervergép képernyőjéről — ugyanazt, amelyről az alkalmazást letöltötted.",
		"Scannez le code QR sur l’ordinateur du serveur — le même que pour télécharger l’application."
	],
	[
		"Сканувати QR-код",
		"Scan the QR code",
		null,
		"Zeskanuj kod QR",
		"Scanează codul QR",
		"QR-kód beolvasása",
		"Scanner le code QR"
	],
	[
		"або введи адресу вручну",
		"or enter the address by hand",
		null,
		"lub wpisz adres ręcznie",
		"sau introdu adresa manual",
		"vagy írd be a címet kézzel",
		"ou saisissez l’adresse à la main"
	],
	[
		"Наведи камеру на QR-код на екрані комп’ютера",
		"Point the camera at the QR code on the computer screen",
		null,
		"Skieruj aparat na kod QR na ekranie komputera",
		"Îndreaptă camera spre codul QR de pe ecranul calculatorului",
		"Irányítsd a kamerát a számítógép képernyőjén lévő QR-kódra",
		"Visez le code QR sur l’écran de l’ordinateur"
	],
	[
		"Це не QR-код сервера Yellow WMS",
		"This is not a Yellow WMS server QR code",
		null,
		"To nie jest kod QR serwera Yellow WMS",
		"Acesta nu este un cod QR al serverului Yellow WMS",
		"Ez nem a Yellow WMS szerver QR-kódja",
		"Ce n’est pas un code QR de serveur Yellow WMS"
	],
	[
		"На цьому телефоні сканування недоступне. Введи адресу вручну.",
		"Scanning is not available on this phone. Enter the address by hand.",
		null,
		"Skanowanie nie jest dostępne na tym telefonie. Wpisz adres ręcznie.",
		"Scanarea nu este disponibilă pe acest telefon. Introdu adresa manual.",
		"Ezen a telefonon nem érhető el a beolvasás. Írd be a címet kézzel.",
		"Le scan n’est pas disponible sur ce téléphone. Saisissez l’adresse à la main."
	],
	[
		"Камера недоступна. Введи адресу вручну.",
		"The camera is not available. Enter the address by hand.",
		null,
		"Aparat niedostępny. Wpisz adres ręcznie.",
		"Camera nu e disponibilă. Introdu adresa manual.",
		"A kamera nem érhető el. Írd be a címet kézzel.",
		"Caméra indisponible. Saisissez l’adresse à la main."
	],
	[
		"Адреса сервера",
		"Server address",
		null,
		"Adres serwera",
		"Adresa serverului",
		"Szerver címe",
		"Adresse du serveur"
	],
	[
		"Підключити",
		"Connect",
		null,
		"Połącz",
		"Conectează",
		"Csatlakozás",
		"Connecter"
	],
	[
		"Сервер:",
		"Server:",
		null,
		"Serwer:",
		"Server:",
		"Szerver:",
		"Serveur :"
	],
	[
		"змінити",
		"change",
		null,
		"zmień",
		"schimbă",
		"módosítás",
		"modifier"
	],
	[
		"Сервер {s} не відповідає. Перевір адресу і що телефон у тій самій Wi-Fi мережі.",
		"Server {s} is not responding. Check the address and that the phone is on the same Wi-Fi network.",
		null,
		"Serwer {s} nie odpowiada. Sprawdź adres i czy telefon jest w tej samej sieci Wi-Fi.",
		"Serverul {s} nu răspunde. Verifică adresa și dacă telefonul este în aceeași rețea Wi-Fi.",
		"A(z) {s} szerver nem válaszol. Ellenőrizd a címet, és hogy a telefon ugyanazon a Wi-Fi-hálózaton van-e.",
		"Le serveur {s} ne répond pas. Vérifiez l’adresse et que le téléphone est sur le même réseau Wi-Fi."
	],
	[
		"Пристрій ще не підключений",
		"This device is not connected yet",
		null,
		"To urządzenie nie jest jeszcze podłączone",
		"Dispozitivul nu este încă conectat",
		"Ez az eszköz még nincs csatlakoztatva",
		"Cet appareil n’est pas encore connecté"
	],
	[
		"Ти зараз поза мережею складу. Введи код підключення від адміністратора (Користувачі → Пристрої) або один раз увійди через Wi-Fi складу.",
		"You are outside the warehouse network. Enter a pairing code from an administrator (Users → Devices) or sign in once on the warehouse Wi-Fi.",
		null,
		"Jesteś poza siecią magazynu. Wpisz kod parowania od administratora (Użytkownicy → Urządzenia) albo zaloguj się raz przez Wi-Fi magazynu.",
		"Ești în afara rețelei depozitului. Introdu codul de asociere de la administrator (Utilizatori → Dispozitive) sau conectează-te o dată prin Wi-Fi-ul depozitului.",
		"A raktár hálózatán kívül vagy. Írd be az adminisztrátortól kapott párosítási kódot (Felhasználók → Eszközök), vagy jelentkezz be egyszer a raktári Wi-Fi-n.",
		"Vous êtes hors du réseau de l’entrepôt. Saisissez un code d’appairage de l’administrateur (Utilisateurs → Appareils) ou connectez-vous une fois sur le Wi-Fi de l’entrepôt."
	],
	[
		"Код підключення",
		"Pairing code",
		null,
		"Kod parowania",
		"Cod de asociere",
		"Párosítási kód",
		"Code d’appairage"
	],
	[
		"Назва пристрою (необов’язково)",
		"Device name (optional)",
		null,
		"Nazwa urządzenia (opcjonalnie)",
		"Numele dispozitivului (opțional)",
		"Eszköz neve (nem kötelező)",
		"Nom de l’appareil (facultatif)"
	],
	[
		"Підключити пристрій",
		"Connect device",
		null,
		"Podłącz urządzenie",
		"Conectează dispozitivul",
		"Eszköz csatlakoztatása",
		"Connecter l’appareil"
	],
	[
		"Забагато спроб. Зачекай 15 хвилин.",
		"Too many attempts. Wait 15 minutes.",
		null,
		"Za dużo prób. Poczekaj 15 minut.",
		"Prea multe încercări. Așteaptă 15 minute.",
		"Túl sok próbálkozás. Várj 15 percet.",
		"Trop de tentatives. Attendez 15 minutes."
	],
	[
		"Немає зв’язку з сервером. Перевір інтернет.",
		"No connection to the server. Check the internet.",
		null,
		"Brak połączenia z serwerem. Sprawdź internet.",
		"Nu există conexiune la server. Verifică internetul.",
		"Nincs kapcsolat a szerverrel. Ellenőrizd az internetet.",
		"Pas de connexion au serveur. Vérifiez internet."
	],
	[
		"Код неправильний, уже використаний або прострочений.",
		"The code is wrong, already used or expired.",
		null,
		"Kod jest błędny, już użyty lub wygasł.",
		"Codul este greșit, deja folosit sau expirat.",
		"A kód hibás, már felhasználták vagy lejárt.",
		"Le code est erroné, déjà utilisé ou expiré."
	],
	[
		"Телефон Петра",
		"Peter’s phone",
		null,
		"Telefon Piotra",
		"Telefonul lui Petru",
		"Péter telefonja",
		"Téléphone de Pierre"
	],
	[
		"Devices",
		null,
		"Пристрої",
		"Urządzenia",
		"Dispozitive",
		"Eszközök",
		"Appareils"
	],
	[
		"Trusted devices",
		null,
		"Довірені пристрої",
		"Zaufane urządzenia",
		"Dispozitive de încredere",
		"Megbízható eszközök",
		"Appareils de confiance"
	],
	[
		"Outside the warehouse network (mobile data, ngrok) only these devices can open the app, and still with a PIN. A phone becomes trusted after one sign-in on the warehouse Wi-Fi, or with a one-time code.",
		null,
		"Поза мережею складу (мобільний інтернет, ngrok) застосунок відкривається лише на цих пристроях, і все одно з PIN. Телефон стає довіреним після одного входу через Wi-Fi складу або за одноразовим кодом.",
		"Poza siecią magazynu (dane mobilne, ngrok) aplikację mogą otworzyć tylko te urządzenia, i to nadal z PIN-em. Telefon staje się zaufany po jednym logowaniu przez Wi-Fi magazynu albo jednorazowym kodem.",
		"În afara rețelei depozitului (date mobile, ngrok) aplicația se deschide doar pe aceste dispozitive, și tot cu PIN. Un telefon devine de încredere după o autentificare pe Wi-Fi-ul depozitului sau cu un cod unic.",
		"A raktár hálózatán kívül (mobilnet, ngrok) csak ezek az eszközök nyithatják meg az alkalmazást, és csak PIN-kóddal. Egy telefon egy raktári Wi-Fi-s bejelentkezés vagy egyszeri kód után válik megbízhatóvá.",
		"Hors du réseau de l’entrepôt (données mobiles, ngrok), seuls ces appareils peuvent ouvrir l’application, et toujours avec un PIN. Un téléphone devient de confiance après une connexion sur le Wi-Fi de l’entrepôt, ou avec un code à usage unique."
	],
	[
		"Pairing code",
		null,
		"Код підключення",
		"Kod parowania",
		"Cod de asociere",
		"Párosítási kód",
		"Code d’appairage"
	],
	[
		"Enter this code on the phone (sign-in screen → «Код підключення»). Works once, for 10 minutes.",
		null,
		"Введи цей код на телефоні (екран входу → «Код підключення»). Діє один раз, 10 хвилин.",
		"Wpisz ten kod na telefonie (ekran logowania → «Kod parowania»). Działa raz, przez 10 minut.",
		"Introdu acest cod pe telefon (ecranul de autentificare → «Cod de asociere»). Funcționează o dată, 10 minute.",
		"Írd be ezt a kódot a telefonon (bejelentkezési képernyő → «Párosítási kód»). Egyszer használható, 10 percig.",
		"Saisissez ce code sur le téléphone (écran de connexion → « Code d’appairage »). Valable une fois, 10 minutes."
	],
	[
		"Valid for {s}",
		null,
		"Діє ще {s}",
		"Ważny jeszcze {s}",
		"Valabil încă {s}",
		"Még {s}-ig érvényes",
		"Valable encore {s}"
	],
	[
		"Expired — make a new one",
		null,
		"Прострочений — створи новий",
		"Wygasł — utwórz nowy",
		"Expirat — creează altul",
		"Lejárt — készíts újat",
		"Expiré — créez-en un nouveau"
	],
	[
		"From outside: trusted device + PIN. On the warehouse network: as before.",
		null,
		"Ззовні: довірений пристрій + PIN. У мережі складу: як і раніше.",
		"Z zewnątrz: zaufane urządzenie + PIN. W sieci magazynu: jak dotąd.",
		"Din exterior: dispozitiv de încredere + PIN. În rețeaua depozitului: ca înainte.",
		"Kívülről: megbízható eszköz + PIN. A raktár hálózatán: mint eddig.",
		"De l’extérieur : appareil de confiance + PIN. Sur le réseau de l’entrepôt : comme avant."
	],
	[
		"From outside: PIN only (REMOTE_ACCESS=login). Trusted devices are not required.",
		null,
		"Ззовні: лише PIN (REMOTE_ACCESS=login). Довірені пристрої не потрібні.",
		"Z zewnątrz: tylko PIN (REMOTE_ACCESS=login). Zaufane urządzenia nie są wymagane.",
		"Din exterior: doar PIN (REMOTE_ACCESS=login). Dispozitivele de încredere nu sunt necesare.",
		"Kívülről: csak PIN (REMOTE_ACCESS=login). Megbízható eszköz nem kell.",
		"De l’extérieur : PIN seulement (REMOTE_ACCESS=login). Appareils de confiance non requis."
	],
	[
		"Device",
		null,
		"Пристрій",
		"Urządzenie",
		"Dispozitiv",
		"Eszköz",
		"Appareil"
	],
	[
		"Added",
		null,
		"Додано",
		"Dodano",
		"Adăugat",
		"Hozzáadva",
		"Ajouté"
	],
	[
		"Last seen",
		null,
		"Востаннє",
		"Ostatnio",
		"Ultima dată",
		"Utoljára",
		"Vu pour la dernière fois"
	],
	[
		"Remove",
		null,
		"Видалити",
		"Usuń",
		"Elimină",
		"Eltávolítás",
		"Retirer"
	],
	[
		"{s} · code",
		null,
		"{s} · за кодом",
		"{s} · kodem",
		"{s} · cu cod",
		"{s} · kóddal",
		"{s} · par code"
	],
	[
		"{s} · warehouse Wi-Fi",
		null,
		"{s} · Wi-Fi складу",
		"{s} · Wi-Fi magazynu",
		"{s} · Wi-Fi depozit",
		"{s} · raktári Wi-Fi",
		"{s} · Wi-Fi entrepôt"
	],
	[
		"No trusted devices yet.",
		null,
		"Ще немає довірених пристроїв.",
		"Brak zaufanych urządzeń.",
		"Încă nu există dispozitive de încredere.",
		"Még nincs megbízható eszköz.",
		"Aucun appareil de confiance pour l’instant."
	],
	[
		"Open sessions",
		null,
		"Відкриті сесії",
		"Otwarte sesje",
		"Sesiuni deschise",
		"Nyitott munkamenetek",
		"Sessions ouvertes"
	],
	[
		"Who is signed in right now and from where. Signing a session out ends it at once.",
		null,
		"Хто зараз увійшов і звідки. Завершення сесії діє одразу.",
		"Kto jest teraz zalogowany i skąd. Wylogowanie sesji działa od razu.",
		"Cine este conectat acum și de unde. Închiderea sesiunii are efect imediat.",
		"Ki van most bejelentkezve és honnan. A kijelentkeztetés azonnal érvényes.",
		"Qui est connecté en ce moment et d’où. Fermer une session agit immédiatement."
	],
	[
		"Signed in",
		null,
		"Увійшов",
		"Zalogowano",
		"Conectat",
		"Bejelentkezett",
		"Connecté"
	],
	[
		"Expires",
		null,
		"Діє до",
		"Wygasa",
		"Expiră",
		"Lejár",
		"Expire"
	],
	[
		"Outside · {s}",
		null,
		"Ззовні · {s}",
		"Z zewnątrz · {s}",
		"Din exterior · {s}",
		"Kívülről · {s}",
		"Extérieur · {s}"
	],
	[
		"Warehouse network · {s}",
		null,
		"Мережа складу · {s}",
		"Sieć magazynu · {s}",
		"Rețeaua depozitului · {s}",
		"Raktári hálózat · {s}",
		"Réseau de l’entrepôt · {s}"
	],
	[
		"Outside",
		null,
		"Ззовні",
		"Z zewnątrz",
		"Din exterior",
		"Kívülről",
		"Extérieur"
	],
	[
		"Warehouse network",
		null,
		"Мережа складу",
		"Sieć magazynu",
		"Rețeaua depozitului",
		"Raktári hálózat",
		"Réseau de l’entrepôt"
	],
	[
		"Nobody is signed in.",
		null,
		"Ніхто не увійшов.",
		"Nikt nie jest zalogowany.",
		"Nimeni nu este conectat.",
		"Senki nincs bejelentkezve.",
		"Personne n’est connecté."
	],
	[
		"Device removed",
		null,
		"Пристрій видалено",
		"Urządzenie usunięte",
		"Dispozitiv eliminat",
		"Eszköz eltávolítva",
		"Appareil retiré"
	],
	[
		"It needs a new code or the warehouse Wi-Fi to come back.",
		null,
		"Щоб повернутися, йому потрібен новий код або Wi-Fi складу.",
		"Aby wrócić, potrzebuje nowego kodu albo Wi-Fi magazynu.",
		"Pentru a reveni are nevoie de un cod nou sau de Wi-Fi-ul depozitului.",
		"Visszatéréshez új kód vagy a raktári Wi-Fi kell.",
		"Pour revenir, il lui faut un nouveau code ou le Wi-Fi de l’entrepôt."
	],
	[
		"Session ended",
		null,
		"Сесію завершено",
		"Sesja zakończona",
		"Sesiune închisă",
		"Munkamenet lezárva",
		"Session fermée"
	],
	[
		"Backups",
		null,
		"Резервні копії",
		"Kopie zapasowe",
		"Copii de rezervă",
		"Biztonsági mentések",
		"Sauvegardes"
	],
	[
		"Back up now",
		null,
		"Зробити копію зараз",
		"Utwórz kopię teraz",
		"Fă o copie acum",
		"Mentés most",
		"Sauvegarder maintenant"
	],
	[
		"Backup made",
		null,
		"Копію зроблено",
		"Kopia utworzona",
		"Copie realizată",
		"Mentés kész",
		"Sauvegarde effectuée"
	],
	[
		"No backups yet.",
		null,
		"Ще немає резервних копій.",
		"Brak kopii zapasowych.",
		"Încă nu există copii de rezervă.",
		"Még nincs mentés.",
		"Aucune sauvegarde pour l’instant."
	],
	[
		"Last: {s} · {s} · {n} kept ({n} days) in the backups folder",
		null,
		"Остання: {s} · {s} · зберігається {n} ({n} днів) у папці backups",
		"Ostatnia: {s} · {s} · przechowywane {n} ({n} dni) w folderze backups",
		"Ultima: {s} · {s} · păstrate {n} ({n} zile) în dosarul backups",
		"Utolsó: {s} · {s} · {n} megőrizve ({n} nap) a backups mappában",
		"Dernière : {s} · {s} · {n} conservées ({n} jours) dans le dossier backups"
	],
	[
		"Назва (необов’язково)",
		"Name (optional)",
		null,
		"Nazwa (opcjonalnie)",
		"Nume (opțional)",
		"Név (nem kötelező)",
		"Nom (facultatif)"
	],
	[
		"Робота",
		"Work",
		null,
		"Praca",
		"Serviciu",
		"Munkahely",
		"Travail"
	],
	[
		"Скасувати",
		"Cancel",
		null,
		"Anuluj",
		"Anulează",
		"Mégse",
		"Annuler"
	],
	[
		"Сервер",
		"Server",
		null,
		"Serwer",
		"Server",
		"Szerver",
		"Serveur"
	],
	[
		"додати",
		"add",
		null,
		"dodaj",
		"adaugă",
		"hozzáadás",
		"ajouter"
	],
	[
		"прибрати",
		"remove",
		null,
		"usuń",
		"elimină",
		"eltávolítás",
		"retirer"
	],
	[
		"Є нова версія аплікації — встановити",
		"A new app version is available — install",
		null,
		"Jest nowa wersja aplikacji — zainstaluj",
		"Există o versiune nouă a aplicației — instalează",
		"Új alkalmazásverzió érhető el — telepítés",
		"Une nouvelle version de l’application est disponible — installer"
	]
];
//#endregion
//#region src/components/services/i18n/dict-pages.js
var dict_pages_default = [
	[
		"{s} · data as of {s}",
		null,
		"{s} · дані на {s}",
		"{s} · dane z {s}",
		"{s} · date la {s}",
		"{s} · adatok: {s}",
		"{s} · données de {s}"
	],
	[
		"Download Total",
		null,
		"Завантажити Total",
		"Pobierz Total",
		"Descarcă Total",
		"Total letöltése",
		"Télécharger le Total"
	],
	[
		"Generate Ripening Plan",
		null,
		"Створити план дозрівання",
		"Utwórz plan dojrzewania",
		"Generează planul de coacere",
		"Érlelési terv készítése",
		"Générer le plan de mûrissage"
	],
	[
		"Needed",
		null,
		"Потрібно",
		"Potrzebne",
		"Necesar",
		"Szükséges",
		"Besoin"
	],
	[
		"Sales Plan · boxes",
		null,
		"Sales Plan · ящики",
		"Sales Plan · kartony",
		"Sales Plan · cutii",
		"Sales Plan · doboz",
		"Sales Plan · cartons"
	],
	[
		"no Sales Plan for this week",
		null,
		"немає Sales Plan на цей тиждень",
		"brak Sales Plan na ten tydzień",
		"nu există Sales Plan pentru această săptămână",
		"erre a hétre nincs Sales Plan",
		"pas de Sales Plan pour cette semaine"
	],
	[
		"Ordered",
		null,
		"Замовлено",
		"Zamówione",
		"Comandat",
		"Megrendelve",
		"Commandé"
	],
	[
		"{n} vs plan",
		null,
		"{n} до плану",
		"{n} względem planu",
		"{n} față de plan",
		"{n} a tervhez képest",
		"{n} par rapport au plan"
	],
	[
		"{n} orders",
		null,
		"замовлень: {n}",
		"zamówienia: {n}",
		"{n} comenzi",
		"{n} rendelés",
		"{n} commandes"
	],
	[
		"Shipped",
		null,
		"Відвантажено",
		"Wysłane",
		"Expediat",
		"Kiszállítva",
		"Expédié"
	],
	[
		"{n}% of ordered",
		null,
		"{n}% від замовленого",
		"{n}% zamówionych",
		"{n}% din comandat",
		"a rendelés {n}%-a",
		"{n} % du commandé"
	],
	[
		"nothing ordered",
		null,
		"нічого не замовлено",
		"nic nie zamówiono",
		"nimic comandat",
		"nincs rendelés",
		"rien de commandé"
	],
	[
		"Still to ship",
		null,
		"Ще відвантажити",
		"Do wysłania",
		"De expediat",
		"Még kiszállítandó",
		"Reste à expédier"
	],
	[
		"boxes · {n} orders",
		null,
		"ящ. · замовлень: {n}",
		"kart. · zamówienia: {n}",
		"cutii · {n} comenzi",
		"doboz · {n} rendelés",
		"cartons · {n} commandes"
	],
	[
		"boxes · {n} order",
		null,
		"ящ. · замовлень: {n}",
		"kart. · zamówienia: {n}",
		"cutii · {n} comandă",
		"doboz · {n} rendelés",
		"cartons · {n} commande"
	],
	[
		"Stock in chambers",
		null,
		"Запас у коморах",
		"Zapas w komorach",
		"Stoc în camere",
		"Készlet a kamrákban",
		"Stock en chambres"
	],
	[
		"{n}% of capacity",
		null,
		"{n}% місткості",
		"{n}% pojemności",
		"{n}% din capacitate",
		"a kapacitás {n}%-a",
		"{n} % de la capacité"
	],
	[
		"Market / Garbage",
		null,
		"Маркет / Утилізація",
		"Market / Odpady",
		"Market / Deșeuri",
		"Market / Hulladék",
		"Market / Déchets"
	],
	[
		"Needs attention",
		null,
		"Потребує уваги",
		"Wymaga uwagi",
		"Necesită atenție",
		"Figyelmet igényel",
		"À traiter"
	],
	[
		"{n} open",
		null,
		"відкрито: {n}",
		"otwarte: {n}",
		"{n} deschise",
		"{n} nyitott",
		"{n} ouverts"
	],
	[
		"Nothing needs attention right now.",
		null,
		"Зараз усе гаразд.",
		"Teraz nic nie wymaga uwagi.",
		"Momentan nimic nu necesită atenție.",
		"Most semmi sem igényel figyelmet.",
		"Rien à traiter pour le moment."
	],
	[
		"Alerts clear themselves when the underlying data is fixed.",
		null,
		"Сповіщення зникають самі, щойно дані виправлено.",
		"Alerty znikają same, gdy dane zostaną poprawione.",
		"Alertele dispar singure când datele sunt corectate.",
		"A riasztások maguktól eltűnnek, ha az adatokat javítják.",
		"Les alertes disparaissent d’elles-mêmes une fois les données corrigées."
	],
	[
		"{n} orders in the transport plan not scanned",
		null,
		"Не відскановано замовлень із транспортного плану: {n}",
		"Niezeskanowane zamówienia z planu transportu: {n}",
		"{n} comenzi din planul de transport nescanate",
		"{n} rendelés a szállítási tervből nincs beszkennelve",
		"{n} commandes du plan de transport non scannées"
	],
	[
		"{n} order in the transport plan not scanned",
		null,
		"Не відскановано замовлень із транспортного плану: {n}",
		"Niezeskanowane zamówienia z planu transportu: {n}",
		"{n} comandă din planul de transport nescanată",
		"{n} rendelés a szállítási tervből nincs beszkennelve",
		"{n} commande du plan de transport non scannée"
	],
	[
		"{n} scans without a transport-plan row",
		null,
		"Сканів без рядка в транспортному плані: {n}",
		"Skany bez wiersza w planie transportu: {n}",
		"{n} scanări fără rând în planul de transport",
		"{n} szkennelés szállítási terv sor nélkül",
		"{n} scans sans ligne au plan de transport"
	],
	[
		"{n} scan without a transport-plan row",
		null,
		"Сканів без рядка в транспортному плані: {n}",
		"Skany bez wiersza w planie transportu: {n}",
		"{n} scanare fără rând în planul de transport",
		"{n} szkennelés szállítási terv sor nélkül",
		"{n} scan sans ligne au plan de transport"
	],
	[
		"Chambers {s} have no gas day",
		null,
		"Комори {s} без дня газування",
		"Komory {s} bez dnia gazowania",
		"Camerele {s} nu au zi de gazare",
		"A(z) {s} kamráknak nincs gázosítási napja",
		"Les chambres {s} n’ont pas de jour de gazage"
	],
	[
		"Chamber {n} has no gas day",
		null,
		"Комора {n} без дня газування",
		"Komora {n} bez dnia gazowania",
		"Camera {n} nu are zi de gazare",
		"A(z) {n}. kamrának nincs gázosítási napja",
		"La chambre {n} n’a pas de jour de gazage"
	],
	[
		"{n} boxes will be planned by container delivery date",
		null,
		"{n} ящ. буде сплановано за датою доставки контейнера",
		"{n} kart. zostanie zaplanowanych wg daty dostawy kontenera",
		"{n} cutii vor fi planificate după data livrării containerului",
		"{n} doboz a konténer szállítási dátuma szerint lesz tervezve",
		"{n} cartons seront planifiés selon la date de livraison du conteneur"
	],
	[
		"PLAC: {n} containers picked up, not received",
		null,
		"PLAC: контейнерів забрано, не прийнято: {n}",
		"PLAC: kontenery odebrane, nieprzyjęte: {n}",
		"PLAC: {n} containere ridicate, nerecepționate",
		"PLAC: {n} konténer elhozva, nincs átvéve",
		"PLAC : {n} conteneurs enlevés, non réceptionnés"
	],
	[
		"PLAC: {n} container picked up, not received",
		null,
		"PLAC: контейнерів забрано, не прийнято: {n}",
		"PLAC: kontenery odebrane, nieprzyjęte: {n}",
		"PLAC: {n} container ridicat, nerecepționat",
		"PLAC: {n} konténer elhozva, nincs átvéve",
		"PLAC : {n} conteneur enlevé, non réceptionné"
	],
	[
		"Container {s}: {n} boxes unexplained at receiving",
		null,
		"Контейнер {s}: {n} ящ. не пояснено при прийманні",
		"Kontener {s}: {n} kart. niewyjaśnionych przy przyjęciu",
		"Containerul {s}: {n} cutii neexplicate la recepție",
		"{s} konténer: {n} doboz megmagyarázatlan az átvételnél",
		"Conteneur {s} : {n} cartons inexpliqués à la réception"
	],
	[
		"Open map →",
		null,
		"Відкрити карту →",
		"Otwórz mapę →",
		"Deschide harta →",
		"Térkép megnyitása →",
		"Ouvrir le plan →"
	],
	[
		"Today in numbers",
		null,
		"Сьогодні в цифрах",
		"Dziś w liczbach",
		"Astăzi în cifre",
		"A mai nap számokban",
		"Aujourd’hui en chiffres"
	],
	[
		"aisle",
		null,
		"прохід",
		"korytarz",
		"culoar",
		"folyosó",
		"allée"
	],
	[
		"central aisle",
		null,
		"центральний прохід",
		"korytarz główny",
		"culoar central",
		"középső folyosó",
		"allée centrale"
	],
	[
		"Stock day filled",
		null,
		"День у залишках заповнено",
		"Dzień magazynu uzupełniony",
		"Ziua de stoc completată",
		"Készletnap kitöltve",
		"Journée de stock remplie"
	],
	[
		"Stock day not filled",
		null,
		"День у залишках не заповнено",
		"Dzień magazynu nieuzupełniony",
		"Ziua de stoc necompletată",
		"Készletnap nincs kitöltve",
		"Journée de stock non remplie"
	],
	[
		"{s} written to the stock book",
		null,
		"{s} записано в книгу залишків",
		"{s} zapisano w księdze magazynu",
		"{s} scris în registrul de stoc",
		"{s} beírva a készletkönyvbe",
		"{s} inscrit au registre de stock"
	],
	[
		"Today could not be loaded",
		null,
		"Не вдалося завантажити «Сьогодні»",
		"Nie udało się wczytać „Dziś”",
		"„Astăzi” nu a putut fi încărcat",
		"A „Ma” oldal nem tölthető be",
		"Impossible de charger « Aujourd’hui »"
	],
	[
		"{n} loaded · {n} empty · {n} without gas day · capacity {s} per chamber",
		null,
		"заповнено: {1} · порожніх: {2} · без дня газування: {3} · місткість {4} на комору",
		"zapełnione: {1} · puste: {2} · bez dnia gazowania: {3} · pojemność {4} na komorę",
		"{1} ocupate · {2} goale · {3} fără zi de gazare · capacitate {4} pe cameră",
		"{1} feltöltve · {2} üres · {3} gázosítási nap nélkül · kapacitás {4}/kamra",
		"{1} chargées · {2} vides · {3} sans jour de gazage · capacité {4} par chambre"
	],
	[
		"Regular",
		null,
		"Звичайні",
		"Zwykłe",
		"Obișnuite",
		"Normál",
		"Normales"
	],
	[
		"No gas day",
		null,
		"Без дня газування",
		"Bez dnia gazowania",
		"Fără zi de gazare",
		"Gázosítási nap nélkül",
		"Sans jour de gazage"
	],
	[
		"no gas day",
		null,
		"без дня газування",
		"bez dnia gazowania",
		"fără zi de gazare",
		"nincs gázosítási nap",
		"sans jour de gazage"
	],
	[
		"Filter chambers",
		null,
		"Фільтр комор",
		"Filtr komór",
		"Filtrează camerele",
		"Kamrák szűrése",
		"Filtrer les chambres"
	],
	[
		"Chambers map",
		null,
		"Карта комор",
		"Mapa komór",
		"Harta camerelor",
		"Kamratérkép",
		"Plan des chambres"
	],
	[
		"non-conforming",
		null,
		"невідповідний товар",
		"niezgodny towar",
		"neconform",
		"nem megfelelő áru",
		"non conforme"
	],
	[
		"Chamber {n}",
		null,
		"Комора {n}",
		"Komora {n}",
		"Camera {n}",
		"{n}. kamra",
		"Chambre {n}"
	],
	[
		"Chamber {n}, empty",
		null,
		"Комора {n}, порожня",
		"Komora {n}, pusta",
		"Camera {n}, goală",
		"{n}. kamra, üres",
		"Chambre {n}, vide"
	],
	[
		"Chamber {n}, {s} of {s} boxes",
		null,
		"Комора {n}, {s} з {s} ящ.",
		"Komora {n}, {s} z {s} kart.",
		"Camera {n}, {s} din {s} cutii",
		"{n}. kamra, {s} / {s} doboz",
		"Chambre {n}, {s} sur {s} cartons"
	],
	[
		"Chamber {n} · CITRO",
		null,
		"Комора {n} · CITRO",
		"Komora {n} · CITRO",
		"Camera {n} · CITRO",
		"{n}. kamra · CITRO",
		"Chambre {n} · CITRO"
	],
	[
		"Chamber {n} · {s}",
		null,
		"Комора {n} · {s}",
		"Komora {n} · {s}",
		"Camera {n} · {s}",
		"{n}. kamra · {s}",
		"Chambre {n} · {s}"
	],
	[
		"Gas days",
		null,
		"Дні газування",
		"Dni gazowania",
		"Zile de gazare",
		"Gázosítási napok",
		"Jours de gazage"
	],
	[
		"The ripening plan reads the day from here. Chambers without a day are planned by container delivery date.",
		null,
		"План дозрівання бере день звідси. Комори без дня плануються за датою доставки контейнера.",
		"Plan dojrzewania bierze dzień stąd. Komory bez dnia planowane są wg daty dostawy kontenera.",
		"Planul de coacere ia ziua de aici. Camerele fără zi sunt planificate după data livrării containerului.",
		"Az érlelési terv innen veszi a napot. A nap nélküli kamrák a konténer szállítási dátuma szerint tervezettek.",
		"Le plan de mûrissage prend le jour ici. Les chambres sans jour sont planifiées selon la date de livraison du conteneur."
	],
	[
		"All changes saved",
		null,
		"Усі зміни збережено",
		"Wszystkie zmiany zapisane",
		"Toate modificările salvate",
		"Minden változás mentve",
		"Toutes les modifications sont enregistrées"
	],
	[
		"Saving…",
		null,
		"Збереження…",
		"Zapisywanie…",
		"Se salvează…",
		"Mentés…",
		"Enregistrement…"
	],
	[
		"1 unsaved change",
		null,
		"1 незбережена зміна",
		"1 niezapisana zmiana",
		"1 modificare nesalvată",
		"1 nem mentett változás",
		"1 modification non enregistrée"
	],
	[
		"Ch.",
		null,
		"Ком.",
		"Kom.",
		"Cam.",
		"Kamra",
		"Ch."
	],
	[
		"Gas day",
		null,
		"День газування",
		"Dzień gazowania",
		"Zi de gazare",
		"Gázosítási nap",
		"Jour de gazage"
	],
	[
		"Client tag",
		null,
		"Мітка клієнта",
		"Etykieta klienta",
		"Etichetă client",
		"Ügyfélcímke",
		"Étiquette client"
	],
	[
		"Client tag (BIO)",
		null,
		"Мітка клієнта (BIO)",
		"Etykieta klienta (BIO)",
		"Etichetă client (BIO)",
		"Ügyfélcímke (BIO)",
		"Étiquette client (BIO)"
	],
	[
		"Gas day for chamber {n}",
		null,
		"День газування для комори {n}",
		"Dzień gazowania komory {n}",
		"Zi de gazare pentru camera {n}",
		"A(z) {n}. kamra gázosítási napja",
		"Jour de gazage de la chambre {n}"
	],
	[
		"Client tag for chamber {n}",
		null,
		"Мітка клієнта для комори {n}",
		"Etykieta klienta komory {n}",
		"Etichetă client pentru camera {n}",
		"A(z) {n}. kamra ügyfélcímkéje",
		"Étiquette client de la chambre {n}"
	],
	[
		"No loaded chambers.",
		null,
		"Немає заповнених комор.",
		"Brak zapełnionych komór.",
		"Nu există camere ocupate.",
		"Nincs feltöltött kamra.",
		"Aucune chambre chargée."
	],
	[
		"Non-conforming goods held in CITRO.",
		null,
		"Невідповідний товар у CITRO.",
		"Niezgodny towar przechowywany w CITRO.",
		"Marfă neconformă păstrată în CITRO.",
		"A CITRO-ban tárolt nem megfelelő áru.",
		"Marchandise non conforme stockée en CITRO."
	],
	[
		"/ {s} boxes",
		null,
		"/ {s} ящ.",
		"/ {s} kart.",
		"/ {s} cutii",
		"/ {s} doboz",
		"/ {s} cartons"
	],
	[
		"Gas day for whole chamber",
		null,
		"День газування для всієї комори",
		"Dzień gazowania dla całej komory",
		"Zi de gazare pentru toată camera",
		"Gázosítási nap az egész kamrára",
		"Jour de gazage pour toute la chambre"
	],
	[
		"No gas day set. This chamber will be planned by container delivery date.",
		null,
		"День газування не встановлено. Комору буде сплановано за датою доставки контейнера.",
		"Brak dnia gazowania. Komora zostanie zaplanowana wg daty dostawy kontenera.",
		"Nu e setată ziua de gazare. Camera va fi planificată după data livrării containerului.",
		"Nincs gázosítási nap. A kamra a konténer szállítási dátuma szerint lesz tervezve.",
		"Aucun jour de gazage. La chambre sera planifiée selon la date de livraison du conteneur."
	],
	[
		"e.g. LABAS BIO",
		null,
		"напр. LABAS BIO",
		"np. LABAS BIO",
		"ex. LABAS BIO",
		"pl. LABAS BIO",
		"p. ex. LABAS BIO"
	],
	[
		"Placements",
		null,
		"Закладки",
		"Rozmieszczenie",
		"Amplasări",
		"Elhelyezések",
		"Emplacements"
	],
	[
		"{n} container sides",
		null,
		"сторін контейнерів: {n}",
		"strony kontenerów: {n}",
		"{n} laturi de container",
		"{n} konténeroldal",
		"{n} côtés de conteneur"
	],
	[
		"{n} container side",
		null,
		"сторін контейнерів: {n}",
		"strony kontenerów: {n}",
		"{n} latură de container",
		"{n} konténeroldal",
		"{n} côté de conteneur"
	],
	[
		"none",
		null,
		"немає",
		"brak",
		"niciuna",
		"nincs",
		"aucun"
	],
	[
		"Move boxes",
		null,
		"Перемістити ящики",
		"Przenieś kartony",
		"Mută cutii",
		"Dobozok áthelyezése",
		"Déplacer des cartons"
	],
	[
		"Write off",
		null,
		"Списати",
		"Odpisz",
		"Scoate din stoc",
		"Leírás",
		"Sortir du stock"
	],
	[
		"Empty · ready for a container",
		null,
		"Порожня · готова до контейнера",
		"Pusta · gotowa na kontener",
		"Goală · pregătită pentru container",
		"Üres · konténerre kész",
		"Vide · prête pour un conteneur"
	],
	[
		"{n}% full · {s} free · {s}",
		null,
		"заповнено {n}% · вільно {s} · {s}",
		"zapełnienie {n}% · wolne {s} · {s}",
		"{n}% ocupat · {s} liber · {s}",
		"{n}% tele · {s} szabad · {s}",
		"remplie à {n} % · {s} libres · {s}"
	],
	[
		"Gas day saved",
		null,
		"День газування збережено",
		"Dzień gazowania zapisany",
		"Zi de gazare salvată",
		"Gázosítási nap mentve",
		"Jour de gazage enregistré"
	],
	[
		"Gas day cleared",
		null,
		"День газування прибрано",
		"Dzień gazowania usunięty",
		"Zi de gazare ștearsă",
		"Gázosítási nap törölve",
		"Jour de gazage supprimé"
	],
	[
		"Chamber {n}: not saved",
		null,
		"Комора {n}: не збережено",
		"Komora {n}: nie zapisano",
		"Camera {n}: nesalvat",
		"{n}. kamra: nincs mentve",
		"Chambre {n} : non enregistré"
	],
	[
		"Chambers could not be loaded: {s}",
		null,
		"Не вдалося завантажити комори: {s}",
		"Nie udało się wczytać komór: {s}",
		"Camerele nu au putut fi încărcate: {s}",
		"A kamrák nem tölthetők be: {s}",
		"Impossible de charger les chambres : {s}"
	],
	[
		"No active placements in chamber {n}",
		null,
		"У коморі {n} немає активних закладок",
		"Brak aktywnego rozmieszczenia w komorze {n}",
		"Nicio amplasare activă în camera {n}",
		"A(z) {n}. kamrában nincs aktív elhelyezés",
		"Aucun emplacement actif dans la chambre {n}"
	],
	[
		"Plan Week ·",
		null,
		"План тижня ·",
		"Plan tygodnia ·",
		"Planul săptămânii ·",
		"Heti terv ·",
		"Plan de la semaine ·"
	],
	[
		"the Sales Plan drives ripening, orders and the loading list.",
		null,
		"Sales Plan визначає дозрівання, замовлення і список завантаження.",
		"Sales Plan steruje dojrzewaniem, zamówieniami i listą załadunku.",
		"Sales Plan stabilește coacerea, comenzile și lista de încărcare.",
		"A Sales Plan határozza meg az érlelést, a rendeléseket és a rakodási listát.",
		"Le Sales Plan pilote le mûrissage, les commandes et la liste de chargement."
	],
	[
		"done",
		null,
		"готово",
		"gotowe",
		"gata",
		"kész",
		"fait"
	],
	[
		"now",
		null,
		"зараз",
		"teraz",
		"acum",
		"most",
		"maintenant"
	],
	[
		"next",
		null,
		"далі",
		"następny",
		"următoarea",
		"következő",
		"suivante"
	],
	[
		"Upload Sales Plan",
		null,
		"Завантажити Sales Plan",
		"Wgraj Sales Plan",
		"Încarcă Sales Plan",
		"Sales Plan feltöltése",
		"Charger le Sales Plan"
	],
	[
		"One file per week. Uploading again replaces the week's plan.",
		null,
		"Один файл на тиждень. Нове завантаження замінює план тижня.",
		"Jeden plik na tydzień. Ponowne wgranie zastępuje plan tygodnia.",
		"Un fișier pe săptămână. O nouă încărcare înlocuiește planul săptămânii.",
		"Hetente egy fájl. Az újabb feltöltés lecseréli a heti tervet.",
		"Un fichier par semaine. Un nouvel envoi remplace le plan de la semaine."
	],
	[
		"Sales Plan export, one week",
		null,
		"Експорт Sales Plan, один тиждень",
		"Eksport Sales Plan, jeden tydzień",
		"Export Sales Plan, o săptămână",
		"Sales Plan export, egy hét",
		"Export du Sales Plan, une semaine"
	],
	[
		"Generate week plan",
		null,
		"Створити план тижня",
		"Utwórz plan tygodnia",
		"Generează planul săptămânii",
		"Heti terv készítése",
		"Générer le plan de la semaine"
	],
	[
		"Week W{n} is ready",
		null,
		"Тиждень W{n} готовий",
		"Tydzień W{n} gotowy",
		"Săptămâna W{n} este gata",
		"A W{n}. hét kész",
		"La semaine W{n} est prête"
	],
	[
		"Week W{n}",
		null,
		"Тиждень W{n}",
		"Tydzień W{n}",
		"Săptămâna W{n}",
		"W{n}. hét",
		"Semaine W{n}"
	],
	[
		"Week W{n} · nothing uploaded",
		null,
		"Тиждень W{n} · нічого не завантажено",
		"Tydzień W{n} · nic nie wgrano",
		"Săptămâna W{n} · nimic încărcat",
		"W{n}. hét · nincs feltöltés",
		"Semaine W{n} · rien de chargé"
	],
	[
		"{n} of {n}",
		null,
		"{n} з {n}",
		"{n} z {n}",
		"{n} din {n}",
		"{n}/{n}",
		"{n} sur {n}"
	],
	[
		"Sales Plan parsed",
		null,
		"Sales Plan розібрано",
		"Sales Plan wczytany",
		"Sales Plan procesat",
		"Sales Plan feldolgozva",
		"Sales Plan analysé"
	],
	[
		"Transport plan",
		null,
		"Транспортний план",
		"Plan transportu",
		"Plan de transport",
		"Szállítási terv",
		"Plan de transport"
	],
	[
		"Containers plan",
		null,
		"План контейнерів",
		"Plan kontenerów",
		"Planul containerelor",
		"Konténerterv",
		"Plan des conteneurs"
	],
	[
		"Ripening input",
		null,
		"Дані для дозрівання",
		"Dane do dojrzewania",
		"Date pentru coacere",
		"Érlelési bemenet",
		"Données de mûrissage"
	],
	[
		"Transport plan draft",
		null,
		"Чернетка транспортного плану",
		"Szkic planu transportu",
		"Ciornă plan de transport",
		"Szállítási terv vázlat",
		"Brouillon du plan de transport"
	],
	[
		"{n} trips · {s}",
		null,
		"рейсів: {n} · {s}",
		"kursy: {n} · {s}",
		"{n} curse · {s}",
		"{n} fuvar · {s}",
		"{n} trajets · {s}"
	],
	[
		"{s} · expected {n} · counted {n} · explained {n}",
		null,
		"{s} · очікувано {n} · пораховано {n} · пояснено {n}",
		"{s} · oczekiwano {n} · policzono {n} · wyjaśniono {n}",
		"{s} · așteptat {n} · numărat {n} · explicat {n}",
		"{s} · várt {n} · megszámolt {n} · megmagyarázva {n}",
		"{s} · attendu {n} · compté {n} · expliqué {n}"
	],
	[
		"OUTBOUND (banana)",
		null,
		"OUTBOUND (банан)",
		"OUTBOUND (banany)",
		"OUTBOUND (banane)",
		"OUTBOUND (banán)",
		"OUTBOUND (bananes)"
	],
	[
		"INBOUND (containers)",
		null,
		"INBOUND (контейнери)",
		"INBOUND (kontenery)",
		"INBOUND (containere)",
		"INBOUND (konténerek)",
		"INBOUND (conteneurs)"
	],
	[
		"· {n} KB · just now",
		null,
		"· {n} KB · щойно",
		"· {n} KB · przed chwilą",
		"· {n} KB · chiar acum",
		"· {n} KB · épp most",
		"· {n} Ko · à l’instant"
	],
	[
		"{n} lines",
		null,
		"рядків: {n}",
		"wiersze: {n}",
		"{n} rânduri",
		"{n} sor",
		"{n} lignes"
	],
	[
		"{n} lines · {s}",
		null,
		"рядків: {n} · {s}",
		"wiersze: {n} · {s}",
		"{n} rânduri · {s}",
		"{n} sor · {s}",
		"{n} lignes · {s}"
	],
	[
		"{n} days · {s}",
		null,
		"днів: {n} · {s}",
		"dni: {n} · {s}",
		"{n} zile · {s}",
		"{n} nap · {s}",
		"{n} jours · {s}"
	],
	[
		"{n} day · {s}",
		null,
		"днів: {n} · {s}",
		"dni: {n} · {s}",
		"{n} zi · {s}",
		"{n} nap · {s}",
		"{n} jour · {s}"
	],
	[
		"{n} containers",
		null,
		"контейнерів: {n}",
		"kontenery: {n}",
		"{n} containere",
		"{n} konténer",
		"{n} conteneurs"
	],
	[
		"{n} containers · {s}",
		null,
		"контейнерів: {n} · {s}",
		"kontenery: {n} · {s}",
		"{n} containere · {s}",
		"{n} konténer · {s}",
		"{n} conteneurs · {s}"
	],
	[
		"not uploaded",
		null,
		"не завантажено",
		"nie wgrano",
		"neîncărcat",
		"nincs feltöltve",
		"non chargé"
	],
	[
		"no days yet",
		null,
		"ще немає днів",
		"jeszcze brak dni",
		"încă nicio zi",
		"még nincs nap",
		"aucun jour pour l’instant"
	],
	[
		"Next:",
		null,
		"Далі:",
		"Dalej:",
		"Următorul pas:",
		"Következő:",
		"Ensuite :"
	],
	[
		"Ripening Plan →",
		null,
		"План дозрівання →",
		"Plan dojrzewania →",
		"Plan de coacere →",
		"Érlelési terv →",
		"Plan de mûrissage →"
	],
	[
		"Sales Plan by client",
		null,
		"Sales Plan за клієнтами",
		"Sales Plan wg klientów",
		"Sales Plan pe clienți",
		"Sales Plan ügyfelenként",
		"Sales Plan par client"
	],
	[
		"Boxes per delivery day. Totals count the rows you see.",
		null,
		"Ящики на день доставки. Підсумки рахують видимі рядки.",
		"Kartony na dzień dostawy. Sumy liczą widoczne wiersze.",
		"Cutii pe zi de livrare. Totalurile numără rândurile vizibile.",
		"Doboz szállítási naponként. Az összesítés a látható sorokat számolja.",
		"Cartons par jour de livraison. Les totaux comptent les lignes visibles."
	],
	[
		"Client · location",
		null,
		"Клієнт · локація",
		"Klient · lokalizacja",
		"Client · locație",
		"Ügyfél · telephely",
		"Client · site"
	],
	[
		"· all products",
		null,
		"· усі продукти",
		"· wszystkie produkty",
		"· toate produsele",
		"· minden termék",
		"· tous les produits"
	],
	[
		"No clients match",
		null,
		"Клієнтів не знайдено",
		"Brak pasujących klientów",
		"Niciun client găsit",
		"Nincs találat",
		"Aucun client trouvé"
	],
	[
		"Clear the search or pick another product.",
		null,
		"Очисти пошук або обери інший продукт.",
		"Wyczyść wyszukiwanie lub wybierz inny produkt.",
		"Golește căutarea sau alege alt produs.",
		"Töröld a keresést, vagy válassz másik terméket.",
		"Effacez la recherche ou choisissez un autre produit."
	],
	[
		"No Sales Plan for W{n}",
		null,
		"Немає Sales Plan для W{n}",
		"Brak Sales Plan dla W{n}",
		"Nu există Sales Plan pentru W{n}",
		"Nincs Sales Plan a W{n}. hétre",
		"Pas de Sales Plan pour W{n}"
	],
	[
		"Upload sales.xlsx for this week above.",
		null,
		"Завантаж sales.xlsx для цього тижня вище.",
		"Wgraj powyżej sales.xlsx dla tego tygodnia.",
		"Încarcă mai sus sales.xlsx pentru această săptămână.",
		"Töltsd fel fent a sales.xlsx fájlt erre a hétre.",
		"Chargez ci-dessus sales.xlsx pour cette semaine."
	],
	[
		"Client or location",
		null,
		"Клієнт або локація",
		"Klient lub lokalizacja",
		"Client sau locație",
		"Ügyfél vagy telephely",
		"Client ou site"
	],
	[
		"Filter clients",
		null,
		"Фільтр клієнтів",
		"Filtr klientów",
		"Filtrează clienții",
		"Ügyfelek szűrése",
		"Filtrer les clients"
	],
	[
		"Choose the Sales Plan first",
		null,
		"Спершу обери Sales Plan",
		"Najpierw wybierz Sales Plan",
		"Alege mai întâi Sales Plan",
		"Előbb válaszd ki a Sales Plant",
		"Choisissez d’abord le Sales Plan"
	],
	[
		"sales.xlsx for one week",
		null,
		"sales.xlsx на один тиждень",
		"sales.xlsx na jeden tydzień",
		"sales.xlsx pentru o săptămână",
		"sales.xlsx egy hétre",
		"sales.xlsx pour une semaine"
	],
	[
		"Week W{n} plan generated",
		null,
		"План тижня W{n} створено",
		"Plan tygodnia W{n} utworzony",
		"Planul săptămânii W{n} generat",
		"A W{n}. heti terv elkészült",
		"Plan de la semaine W{n} généré"
	],
	[
		"Sales Plan parsed — ripening and orders use it now.",
		null,
		"Sales Plan розібрано — дозрівання і замовлення вже його використовують.",
		"Sales Plan wczytany — dojrzewanie i zamówienia już z niego korzystają.",
		"Sales Plan procesat — coacerea și comenzile îl folosesc acum.",
		"Sales Plan feldolgozva — az érlelés és a rendelések már ezt használják.",
		"Sales Plan analysé — le mûrissage et les commandes l’utilisent maintenant."
	],
	[
		"Plan not generated",
		null,
		"План не створено",
		"Plan nie został utworzony",
		"Planul nu a fost generat",
		"A terv nem készült el",
		"Plan non généré"
	],
	[
		"Week could not be loaded",
		null,
		"Не вдалося завантажити тиждень",
		"Nie udało się wczytać tygodnia",
		"Săptămâna nu a putut fi încărcată",
		"A hét nem tölthető be",
		"Impossible de charger la semaine"
	],
	[
		"8 days from today. Rows come from chamber placements and their gas days.",
		null,
		"8 днів від сьогодні. Рядки беруться із закладок у коморах і їхніх днів газування.",
		"8 dni od dziś. Wiersze pochodzą z rozmieszczenia w komorach i dni gazowania.",
		"8 zile de azi. Rândurile vin din amplasările în camere și zilele lor de gazare.",
		"8 nap mától. A sorok a kamrák elhelyezéseiből és gázosítási napjaiból jönnek.",
		"8 jours à partir d’aujourd’hui. Les lignes viennent des emplacements en chambre et de leurs jours de gazage."
	],
	[
		"Last generated {s}.",
		null,
		"Востаннє створено {s}.",
		"Ostatnio utworzono {s}.",
		"Generat ultima dată {s}.",
		"Utoljára elkészült: {s}.",
		"Dernière génération {s}."
	],
	[
		"Not generated yet.",
		null,
		"Ще не створено.",
		"Jeszcze nie utworzono.",
		"Încă negenerat.",
		"Még nem készült el.",
		"Pas encore généré."
	],
	[
		"Upload GGN",
		null,
		"Завантажити GGN",
		"Wgraj GGN",
		"Încarcă GGN",
		"GGN feltöltése",
		"Charger le GGN"
	],
	[
		"Open file",
		null,
		"Відкрити файл",
		"Otwórz plik",
		"Deschide fișierul",
		"Fájl megnyitása",
		"Ouvrir le fichier"
	],
	[
		"Generate plan",
		null,
		"Створити план",
		"Utwórz plan",
		"Generează planul",
		"Terv készítése",
		"Générer le plan"
	],
	[
		"Plan inputs",
		null,
		"Вхідні дані плану",
		"Dane wejściowe planu",
		"Datele planului",
		"A terv bemenetei",
		"Données du plan"
	],
	[
		"Sales Plan",
		null,
		"Sales Plan",
		"Sales Plan",
		"Sales Plan",
		"Sales Plan",
		"Sales Plan"
	],
	[
		"{s} and {s} loaded",
		null,
		"{s} і {s} завантажено",
		"{s} i {s} wgrane",
		"{s} și {s} încărcate",
		"{s} és {s} betöltve",
		"{s} et {s} chargés"
	],
	[
		"{s} loaded",
		null,
		"{s} завантажено",
		"{s} wgrane",
		"{s} încărcat",
		"{s} betöltve",
		"{s} chargé"
	],
	[
		"{s} not uploaded — plan will be 0",
		null,
		"{s} не завантажено — план буде 0",
		"{s} nie wgrano — plan wyniesie 0",
		"{s} neîncărcat — planul va fi 0",
		"{s} nincs feltöltve — a terv 0 lesz",
		"{s} non chargé — le plan sera 0"
	],
	[
		"Plan Week →",
		null,
		"План тижня →",
		"Plan tygodnia →",
		"Planul săptămânii →",
		"Heti terv →",
		"Plan de la semaine →"
	],
	[
		"{n} chambers placed · {n} boxes",
		null,
		"заповнених комор: {n} · {n} ящ.",
		"zapełnione komory: {n} · {n} kart.",
		"{n} camere ocupate · {n} cutii",
		"{n} kamra feltöltve · {n} doboz",
		"{n} chambres chargées · {n} cartons"
	],
	[
		"No placements — the generator falls back to chambers.json",
		null,
		"Немає закладок — генератор бере chambers.json",
		"Brak rozmieszczenia — generator użyje chambers.json",
		"Nicio amplasare — generatorul folosește chambers.json",
		"Nincs elhelyezés — a generátor a chambers.json-t használja",
		"Aucun emplacement — le générateur utilise chambers.json"
	],
	[
		"Map →",
		null,
		"Карта →",
		"Mapa →",
		"Hartă →",
		"Térkép →",
		"Plan →"
	],
	[
		"Gas day missing",
		null,
		"Немає дня газування",
		"Brak dnia gazowania",
		"Lipsește ziua de gazare",
		"Hiányzó gázosítási nap",
		"Jour de gazage manquant"
	],
	[
		"Chambers {s} placed by delivery date",
		null,
		"Комори {s} сплановано за датою доставки",
		"Komory {s} zaplanowane wg daty dostawy",
		"Camerele {s} planificate după data livrării",
		"A(z) {s} kamrák a szállítási dátum szerint tervezettek",
		"Chambres {s} planifiées selon la date de livraison"
	],
	[
		"Set gas day →",
		null,
		"Встановити день газування →",
		"Ustaw dzień gazowania →",
		"Setează ziua de gazare →",
		"Gázosítási nap beállítása →",
		"Fixer le jour de gazage →"
	],
	[
		"GGN data",
		null,
		"Дані GGN",
		"Dane GGN",
		"Date GGN",
		"GGN adatok",
		"Données GGN"
	],
	[
		"{n} plantations · updated {s}",
		null,
		"плантацій: {n} · оновлено {s}",
		"plantacje: {n} · aktualizacja {s}",
		"{n} plantații · actualizat {s}",
		"{n} ültetvény · frissítve: {s}",
		"{n} plantations · mis à jour {s}"
	],
	[
		"Updated {s} · {n} plantations",
		null,
		"Оновлено {s} · плантацій: {n}",
		"Aktualizacja {s} · plantacje: {n}",
		"Actualizat {s} · {n} plantații",
		"Frissítve: {s} · {n} ültetvény",
		"Mis à jour {s} · {n} plantations"
	],
	[
		"No GGN data uploaded",
		null,
		"Дані GGN не завантажено",
		"Nie wgrano danych GGN",
		"Nu s-au încărcat date GGN",
		"Nincs feltöltött GGN adat",
		"Aucune donnée GGN chargée"
	],
	[
		"Show",
		null,
		"Показати",
		"Pokaż",
		"Afișează",
		"Megjelenítés",
		"Afficher"
	],
	[
		"All rows",
		null,
		"Усі рядки",
		"Wszystkie wiersze",
		"Toate rândurile",
		"Minden sor",
		"Toutes les lignes"
	],
	[
		"in rooms ≈ plan (±50)",
		null,
		"у коморах ≈ план (±50)",
		"w komorach ≈ plan (±50)",
		"în camere ≈ plan (±50)",
		"kamrákban ≈ terv (±50)",
		"en chambres ≈ plan (±50)"
	],
	[
		"more than planned",
		null,
		"більше за план",
		"więcej niż plan",
		"mai mult decât planul",
		"több a tervezettnél",
		"plus que prévu"
	],
	[
		"less than planned",
		null,
		"менше за план",
		"mniej niż plan",
		"mai puțin decât planul",
		"kevesebb a tervezettnél",
		"moins que prévu"
	],
	[
		"today",
		null,
		"сьогодні",
		"dziś",
		"azi",
		"ma",
		"aujourd’hui"
	],
	[
		"Plan",
		null,
		"План",
		"Plan",
		"Plan",
		"Terv",
		"Plan"
	],
	[
		"In rooms",
		null,
		"У коморах",
		"W komorach",
		"În camere",
		"Kamrákban",
		"En chambres"
	],
	[
		"Diff",
		null,
		"Різниця",
		"Różnica",
		"Diferență",
		"Eltérés",
		"Écart"
	],
	[
		"Comment",
		null,
		"Коментар",
		"Komentarz",
		"Comentariu",
		"Megjegyzés",
		"Commentaire"
	],
	[
		"No chambers for this day",
		null,
		"На цей день комор немає",
		"Brak komór na ten dzień",
		"Nicio cameră pentru această zi",
		"Erre a napra nincs kamra",
		"Aucune chambre ce jour-là"
	],
	[
		"Ripening plan generated",
		null,
		"План дозрівання створено",
		"Plan dojrzewania utworzony",
		"Planul de coacere generat",
		"Az érlelési terv elkészült",
		"Plan de mûrissage généré"
	],
	[
		"Some chambers have no gas day — they are placed by delivery date.",
		null,
		"Деякі комори без дня газування — їх сплановано за датою доставки.",
		"Niektóre komory nie mają dnia gazowania — zaplanowano je wg daty dostawy.",
		"Unele camere nu au zi de gazare — sunt planificate după data livrării.",
		"Néhány kamrának nincs gázosítási napja — a szállítási dátum szerint tervezettek.",
		"Certaines chambres n’ont pas de jour de gazage — elles sont planifiées selon la date de livraison."
	],
	[
		"Open the file to print it.",
		null,
		"Відкрий файл, щоб надрукувати.",
		"Otwórz plik, aby go wydrukować.",
		"Deschide fișierul pentru a-l tipări.",
		"Nyisd meg a fájlt a nyomtatáshoz.",
		"Ouvrez le fichier pour l’imprimer."
	],
	[
		"Ripening plan could not be loaded",
		null,
		"Не вдалося завантажити план дозрівання",
		"Nie udało się wczytać planu dojrzewania",
		"Planul de coacere nu a putut fi încărcat",
		"Az érlelési terv nem tölthető be",
		"Impossible de charger le plan de mûrissage"
	],
	[
		"GGN data updated",
		null,
		"Дані GGN оновлено",
		"Dane GGN zaktualizowane",
		"Date GGN actualizate",
		"GGN adatok frissítve",
		"Données GGN mises à jour"
	],
	[
		"GGN not updated",
		null,
		"GGN не оновлено",
		"GGN nie zaktualizowano",
		"GGN neactualizat",
		"GGN nincs frissítve",
		"GGN non mis à jour"
	],
	[
		"{s} · {n} plantations",
		null,
		"{s} · плантацій: {n}",
		"{s} · plantacje: {n}",
		"{s} · {n} plantații",
		"{s} · {n} ültetvény",
		"{s} · {n} plantations"
	],
	[
		"Fill the day's stock file from scanner work, then reconcile it with the responsible person's file.",
		null,
		"Заповни файл залишків за день зі сканера, потім звір із файлом відповідальної особи.",
		"Uzupełnij plik magazynu za dzień ze skanera, potem uzgodnij go z plikiem osoby odpowiedzialnej.",
		"Completează fișierul de stoc al zilei din scanări, apoi reconciliază-l cu fișierul persoanei responsabile.",
		"Töltsd ki a napi készletfájlt a szkennelésekből, majd egyeztesd a felelős fájljával.",
		"Remplissez le fichier de stock du jour à partir des scans, puis rapprochez-le du fichier du responsable."
	],
	[
		"Stock day",
		null,
		"День залишків",
		"Dzień magazynu",
		"Ziua de stoc",
		"Készletnap",
		"Journée de stock"
	],
	[
		"Fill day",
		null,
		"Заповнити день",
		"Uzupełnij dzień",
		"Completează ziua",
		"Nap kitöltése",
		"Remplir la journée"
	],
	[
		"Stock file",
		null,
		"Файл залишків",
		"Plik magazynu",
		"Fișier de stoc",
		"Készletfájl",
		"Fichier de stock"
	],
	[
		"Responsible person's file",
		null,
		"Файл відповідальної особи",
		"Plik osoby odpowiedzialnej",
		"Fișierul persoanei responsabile",
		"A felelős fájlja",
		"Fichier du responsable"
	],
	[
		"Pick their stock .xlsx to compare it with the system for this day",
		null,
		"Обери їхній .xlsx залишків, щоб порівняти із системою за цей день",
		"Wybierz ich plik .xlsx, aby porównać z systemem za ten dzień",
		"Alege .xlsx-ul lor de stoc pentru a-l compara cu sistemul pentru această zi",
		"Válaszd ki a .xlsx készletfájljukat az aznapi rendszeradatokkal való összevetéshez",
		"Choisissez leur fichier de stock .xlsx pour le comparer au système ce jour-là"
	],
	[
		"Reconcile day",
		null,
		"Звірити день",
		"Uzgodnij dzień",
		"Reconciliază ziua",
		"Nap egyeztetése",
		"Rapprocher la journée"
	],
	[
		"Totals by sheet ·",
		null,
		"Підсумки за аркушами ·",
		"Sumy wg arkuszy ·",
		"Totaluri pe foi ·",
		"Összesítés lapok szerint ·",
		"Totaux par feuille ·"
	],
	[
		"System = scans and container register. File = responsible person's stock for this date.",
		null,
		"Система = скани і реєстр контейнерів. Файл = залишки відповідальної особи на цю дату.",
		"System = skany i rejestr kontenerów. Plik = stan osoby odpowiedzialnej na ten dzień.",
		"Sistem = scanări și registrul containerelor. Fișier = stocul persoanei responsabile la această dată.",
		"Rendszer = szkennelések és konténernyilvántartás. Fájl = a felelős készlete erre a napra.",
		"Système = scans et registre des conteneurs. Fichier = stock du responsable à cette date."
	],
	[
		"All sheets match",
		null,
		"Усі аркуші збігаються",
		"Wszystkie arkusze się zgadzają",
		"Toate foile se potrivesc",
		"Minden lap egyezik",
		"Toutes les feuilles concordent"
	],
	[
		"{n} of {n} sheets differs",
		null,
		"розбіжність в аркушах: {n} з {n}",
		"różnice w arkuszach: {n} z {n}",
		"{n} din {n} foi diferă",
		"{n}/{n} lap eltér",
		"{n} feuille sur {n} diffère"
	],
	[
		"{n} of {n} sheets differ",
		null,
		"розбіжність в аркушах: {n} з {n}",
		"różnice w arkuszach: {n} z {n}",
		"{n} din {n} foi diferă",
		"{n}/{n} lap eltér",
		"{n} feuilles sur {n} diffèrent"
	],
	[
		"Sheet",
		null,
		"Аркуш",
		"Arkusz",
		"Foaie",
		"Lap",
		"Feuille"
	],
	[
		"System",
		null,
		"Система",
		"System",
		"Sistem",
		"Rendszer",
		"Système"
	],
	[
		"File",
		null,
		"Файл",
		"Plik",
		"Fișier",
		"Fájl",
		"Fichier"
	],
	[
		"Differences ·",
		null,
		"Розбіжності ·",
		"Różnice ·",
		"Diferențe ·",
		"Eltérések ·",
		"Écarts ·"
	],
	[
		"{n} issues",
		null,
		"розбіжностей: {n}",
		"rozbieżności: {n}",
		"{n} probleme",
		"{n} eltérés",
		"{n} écarts"
	],
	[
		"{n} issue",
		null,
		"розбіжностей: {n}",
		"rozbieżności: {n}",
		"{n} problemă",
		"{n} eltérés",
		"{n} écart"
	],
	[
		"Status",
		null,
		"Статус",
		"Status",
		"Stare",
		"Állapot",
		"Statut"
	],
	[
		"Client · order",
		null,
		"Клієнт · замовлення",
		"Klient · zamówienie",
		"Client · comandă",
		"Ügyfél · rendelés",
		"Client · commande"
	],
	[
		"Field",
		null,
		"Поле",
		"Pole",
		"Câmp",
		"Mező",
		"Champ"
	],
	[
		"diff",
		null,
		"різниця",
		"różnica",
		"diferență",
		"eltérés",
		"écart"
	],
	[
		"diff {n}",
		null,
		"різниця {n}",
		"różnica {n}",
		"diferență {n}",
		"eltérés {n}",
		"écart {n}"
	],
	[
		"missing in file",
		null,
		"немає у файлі",
		"brak w pliku",
		"lipsă din fișier",
		"hiányzik a fájlból",
		"absent du fichier"
	],
	[
		"missing in file {n}",
		null,
		"немає у файлі {n}",
		"brak w pliku {n}",
		"lipsă din fișier {n}",
		"hiányzik a fájlból {n}",
		"absent du fichier {n}"
	],
	[
		"not in system",
		null,
		"немає в системі",
		"brak w systemie",
		"nu e în sistem",
		"nincs a rendszerben",
		"absent du système"
	],
	[
		"not in system {n}",
		null,
		"немає в системі {n}",
		"brak w systemie {n}",
		"nu e în sistem {n}",
		"nincs a rendszerben {n}",
		"absent du système {n}"
	],
	[
		"The file matches the system for this day.",
		null,
		"Файл збігається із системою за цей день.",
		"Plik zgadza się z systemem za ten dzień.",
		"Fișierul se potrivește cu sistemul pentru această zi.",
		"A fájl egyezik a rendszerrel erre a napra.",
		"Le fichier concorde avec le système pour ce jour."
	],
	[
		"In transport plan, not scanned",
		null,
		"У транспортному плані, не відскановано",
		"W planie transportu, niezeskanowane",
		"În planul de transport, nescanate",
		"A szállítási tervben, nincs beszkennelve",
		"Au plan de transport, non scanné"
	],
	[
		"Orders planned for {s} with no outbound scans yet.",
		null,
		"Замовлення на {s}, ще без сканів відвантаження.",
		"Zamówienia na {s} bez skanów wysyłki.",
		"Comenzi planificate pentru {s} fără scanări de expediere.",
		"{s} napra tervezett rendelések kiszállítási szkennelés nélkül.",
		"Commandes prévues le {s} sans scan d’expédition."
	],
	[
		"Everything planned for this day is scanned.",
		null,
		"Усе заплановане на цей день відскановано.",
		"Wszystko zaplanowane na ten dzień jest zeskanowane.",
		"Tot ce era planificat pentru această zi este scanat.",
		"Minden aznapra tervezett tétel be van szkennelve.",
		"Tout ce qui était prévu ce jour est scanné."
	],
	[
		"Truck {s}",
		null,
		"Машина {s}",
		"Auto {s}",
		"Camion {s}",
		"Kamion {s}",
		"Camion {s}"
	],
	[
		"Truck {s} · {s}",
		null,
		"Машина {s} · {s}",
		"Auto {s} · {s}",
		"Camion {s} · {s}",
		"Kamion {s} · {s}",
		"Camion {s} · {s}"
	],
	[
		"Total not scanned",
		null,
		"Разом не відскановано",
		"Razem niezeskanowane",
		"Total nescanat",
		"Összesen nincs beszkennelve",
		"Total non scanné"
	],
	[
		"File matches the system",
		null,
		"Файл збігається із системою",
		"Plik zgadza się z systemem",
		"Fișierul se potrivește cu sistemul",
		"A fájl egyezik a rendszerrel",
		"Le fichier concorde avec le système"
	],
	[
		"Differences found",
		null,
		"Знайдено розбіжності",
		"Znaleziono różnice",
		"S-au găsit diferențe",
		"Eltérések találhatók",
		"Écarts trouvés"
	],
	[
		"Reconcile failed",
		null,
		"Звірка не вдалася",
		"Uzgodnienie nie powiodło się",
		"Reconcilierea a eșuat",
		"Az egyeztetés nem sikerült",
		"Échec du rapprochement"
	],
	[
		"Stock could not be loaded",
		null,
		"Не вдалося завантажити залишки",
		"Nie udało się wczytać magazynu",
		"Stocul nu a putut fi încărcat",
		"A készlet nem tölthető be",
		"Impossible de charger le stock"
	],
	[
		"Client reports, shipping cards and day files, made from the transport plan.",
		null,
		"Звіти для клієнтів, картки відвантаження і файли дня з транспортного плану.",
		"Raporty dla klientów, karty wysyłki i pliki dnia z planu transportu.",
		"Rapoarte pentru clienți, fișe de expediere și fișierele zilei, din planul de transport.",
		"Ügyféljelentések, szállítási kártyák és napi fájlok a szállítási tervből.",
		"Rapports clients, fiches d’expédition et fichiers du jour, issus du plan de transport."
	],
	[
		"Generate day documents",
		null,
		"Створити документи дня",
		"Utwórz dokumenty dnia",
		"Generează documentele zilei",
		"Napi dokumentumok készítése",
		"Générer les documents du jour"
	],
	[
		"Upload the transport plan for this day. Everything below is rebuilt.",
		null,
		"Завантаж транспортний план на цей день. Усе нижче буде перестворено.",
		"Wgraj plan transportu na ten dzień. Wszystko poniżej zostanie odtworzone.",
		"Încarcă planul de transport pentru această zi. Tot ce e mai jos se reface.",
		"Töltsd fel az aznapi szállítási tervet. Minden alább újra elkészül.",
		"Chargez le plan de transport du jour. Tout ce qui suit est régénéré."
	],
	[
		"Transport plan, file name like PLAN_week_41.xlsx",
		null,
		"Транспортний план, ім’я файлу як PLAN_week_41.xlsx",
		"Plan transportu, nazwa pliku jak PLAN_week_41.xlsx",
		"Plan de transport, nume de fișier ca PLAN_week_41.xlsx",
		"Szállítási terv, fájlnév pl. PLAN_week_41.xlsx",
		"Plan de transport, nom de fichier du type PLAN_week_41.xlsx"
	],
	[
		"Generate documents",
		null,
		"Створити документи",
		"Utwórz dokumenty",
		"Generează documentele",
		"Dokumentumok készítése",
		"Générer les documents"
	],
	[
		"Last run ·",
		null,
		"Останній запуск ·",
		"Ostatnie uruchomienie ·",
		"Ultima rulare ·",
		"Utolsó futtatás ·",
		"Dernière exécution ·"
	],
	[
		"not run",
		null,
		"не запускали",
		"nie uruchomiono",
		"nerulat",
		"nem futott",
		"non exécuté"
	],
	[
		"Generated",
		null,
		"Створено",
		"Utworzono",
		"Generat",
		"Elkészült",
		"Généré"
	],
	[
		"By",
		null,
		"Ким",
		"Przez",
		"De",
		"Készítette",
		"Par"
	],
	[
		"Trips",
		null,
		"Рейси",
		"Kursy",
		"Curse",
		"Fuvarok",
		"Trajets"
	],
	[
		"Files",
		null,
		"Файли",
		"Pliki",
		"Fișiere",
		"Fájlok",
		"Fichiers"
	],
	[
		"From",
		null,
		"З файлу",
		"Z pliku",
		"Din",
		"Forrás",
		"Depuis"
	],
	[
		"Documents",
		null,
		"Документи",
		"Dokumenty",
		"Documente",
		"Dokumentumok",
		"Documents"
	],
	[
		"Client reports",
		null,
		"Звіти для клієнтів",
		"Raporty dla klientów",
		"Rapoarte clienți",
		"Ügyféljelentések",
		"Rapports clients"
	],
	[
		"Shipping cards",
		null,
		"Картки відвантаження",
		"Karty wysyłki",
		"Fișe de expediere",
		"Szállítási kártyák",
		"Fiches d’expédition"
	],
	[
		"Day files",
		null,
		"Файли дня",
		"Pliki dnia",
		"Fișierele zilei",
		"Napi fájlok",
		"Fichiers du jour"
	],
	[
		"Client report",
		null,
		"Звіт для клієнта",
		"Raport dla klienta",
		"Raport client",
		"Ügyféljelentés",
		"Rapport client"
	],
	[
		"Shipping card",
		null,
		"Картка відвантаження",
		"Karta wysyłki",
		"Fișă de expediere",
		"Szállítási kártya",
		"Fiche d’expédition"
	],
	[
		"Loading list",
		null,
		"Список завантаження",
		"Lista załadunku",
		"Listă de încărcare",
		"Rakodási lista",
		"Liste de chargement"
	],
	[
		"Transport plan (clean)",
		null,
		"Транспортний план (очищений)",
		"Plan transportu (czysty)",
		"Plan de transport (curățat)",
		"Szállítási terv (tisztított)",
		"Plan de transport (nettoyé)"
	],
	[
		"Transport report",
		null,
		"Транспортний звіт",
		"Raport transportowy",
		"Raport de transport",
		"Szállítási jelentés",
		"Rapport de transport"
	],
	[
		"Box counter",
		null,
		"Лічильник ящиків",
		"Licznik kartonów",
		"Contor cutii",
		"Dobozszámláló",
		"Compteur de cartons"
	],
	[
		"Stock book",
		null,
		"Книга залишків",
		"Księga magazynu",
		"Registru de stoc",
		"Készletkönyv",
		"Registre de stock"
	],
	[
		"Ripening plan",
		null,
		"План дозрівання",
		"Plan dojrzewania",
		"Plan de coacere",
		"Érlelési terv",
		"Plan de mûrissage"
	],
	[
		"Page",
		null,
		"Сторінка",
		"Strona",
		"Pagina",
		"Oldal",
		"Page"
	],
	[
		"Open in the app",
		null,
		"Відкрити в програмі",
		"Otwórz w aplikacji",
		"Deschide în aplicație",
		"Megnyitás az alkalmazásban",
		"Ouvrir dans l’application"
	],
	[
		"Download {s}",
		null,
		"Завантажити {s}",
		"Pobierz {s}",
		"Descarcă {s}",
		"{s} letöltése",
		"Télécharger {s}"
	],
	[
		"Nothing matches",
		null,
		"Нічого не знайдено",
		"Brak wyników",
		"Niciun rezultat",
		"Nincs találat",
		"Aucun résultat"
	],
	[
		"Clear the search or pick another type.",
		null,
		"Очисти пошук або обери інший тип.",
		"Wyczyść wyszukiwanie lub wybierz inny typ.",
		"Golește căutarea sau alege alt tip.",
		"Töröld a keresést, vagy válassz másik típust.",
		"Effacez la recherche ou choisissez un autre type."
	],
	[
		"No documents for {s}",
		null,
		"Немає документів на {s}",
		"Brak dokumentów na {s}",
		"Niciun document pentru {s}",
		"Nincs dokumentum: {s}",
		"Aucun document pour le {s}"
	],
	[
		"Upload the transport plan above to generate them.",
		null,
		"Завантаж транспортний план вище, щоб їх створити.",
		"Wgraj powyżej plan transportu, aby je utworzyć.",
		"Încarcă mai sus planul de transport pentru a le genera.",
		"Töltsd fel fent a szállítási tervet a létrehozásukhoz.",
		"Chargez le plan de transport ci-dessus pour les générer."
	],
	[
		"Client, truck or file",
		null,
		"Клієнт, машина або файл",
		"Klient, auto lub plik",
		"Client, camion sau fișier",
		"Ügyfél, kamion vagy fájl",
		"Client, camion ou fichier"
	],
	[
		"Filter documents",
		null,
		"Фільтр документів",
		"Filtr dokumentów",
		"Filtrează documentele",
		"Dokumentumok szűrése",
		"Filtrer les documents"
	],
	[
		"Type",
		null,
		"Тип",
		"Typ",
		"Tip",
		"Típus",
		"Type"
	],
	[
		"Documents generated",
		null,
		"Документи створено",
		"Dokumenty utworzone",
		"Documente generate",
		"A dokumentumok elkészültek",
		"Documents générés"
	],
	[
		"Documents not generated",
		null,
		"Документи не створено",
		"Dokumenty nie zostały utworzone",
		"Documentele nu au fost generate",
		"A dokumentumok nem készültek el",
		"Documents non générés"
	],
	[
		"Documents could not be loaded",
		null,
		"Не вдалося завантажити документи",
		"Nie udało się wczytać dokumentów",
		"Documentele nu au putut fi încărcate",
		"A dokumentumok nem tölthetők be",
		"Impossible de charger les documents"
	],
	[
		"{s} · from {s}",
		null,
		"{s} · з {s}",
		"{s} · z {s}",
		"{s} · din {s}",
		"{s} · forrás: {s}",
		"{s} · depuis {s}"
	],
	[
		"Print",
		null,
		"Друк",
		"Drukuj",
		"Tipărește",
		"Nyomtatás",
		"Imprimer"
	],
	[
		"Download .xlsx",
		null,
		"Завантажити .xlsx",
		"Pobierz .xlsx",
		"Descarcă .xlsx",
		".xlsx letöltése",
		"Télécharger le .xlsx"
	],
	[
		"Loading file…",
		null,
		"Завантаження файлу…",
		"Ładowanie pliku…",
		"Se încarcă fișierul…",
		"Fájl betöltése…",
		"Chargement du fichier…"
	],
	[
		"Fit",
		null,
		"Вмістити",
		"Dopasuj",
		"Potrivește",
		"Illesztés",
		"Ajuster"
	],
	[
		"Zoom",
		null,
		"Масштаб",
		"Powiększenie",
		"Zoom",
		"Nagyítás",
		"Zoom"
	],
	[
		"Sheets",
		null,
		"Аркуші",
		"Arkusze",
		"Foi",
		"Lapok",
		"Feuilles"
	],
	[
		"Find in sheet",
		null,
		"Пошук в аркуші",
		"Szukaj w arkuszu",
		"Caută în foaie",
		"Keresés a lapon",
		"Rechercher dans la feuille"
	],
	[
		"Previous match",
		null,
		"Попередній збіг",
		"Poprzedni wynik",
		"Rezultatul anterior",
		"Előző találat",
		"Résultat précédent"
	],
	[
		"Next match",
		null,
		"Наступний збіг",
		"Następny wynik",
		"Rezultatul următor",
		"Következő találat",
		"Résultat suivant"
	],
	[
		"Manual fields",
		null,
		"Ручні поля",
		"Pola ręczne",
		"Câmpuri manuale",
		"Kézi mezők",
		"Champs manuels"
	],
	[
		"Numbers come from the system. Fix them in the data and the file is rebuilt. These fields are filled by hand and are put back every time the file is rebuilt.",
		null,
		"Числа беруться із системи — виправ дані, і файл перестворюється. Ці поля заповнюються вручну й повертаються щоразу, коли файл перестворюється.",
		"Liczby pochodzą z systemu — popraw dane, a plik zostanie odtworzony. Te pola wypełnia się ręcznie i wracają przy każdym odtworzeniu pliku.",
		"Cifrele vin din sistem — corectează datele și fișierul se reface. Aceste câmpuri se completează manual și sunt puse la loc la fiecare refacere.",
		"A számok a rendszerből jönnek — javítsd az adatokat, és a fájl újra elkészül. Ezeket a mezőket kézzel töltik ki, és minden újrakészítéskor visszakerülnek.",
		"Les chiffres viennent du système — corrigez les données et le fichier est régénéré. Ces champs sont remplis à la main et réappliqués à chaque régénération."
	],
	[
		"as generated",
		null,
		"як згенеровано",
		"jak wygenerowano",
		"ca la generare",
		"ahogy generálták",
		"tel que généré"
	],
	[
		"(empty)",
		null,
		"(порожньо)",
		"(puste)",
		"(gol)",
		"(üres)",
		"(vide)"
	],
	[
		"Back to generated",
		null,
		"Повернути згенероване",
		"Przywróć wygenerowane",
		"Revino la generat",
		"Vissza a generálthoz",
		"Revenir au généré"
	],
	[
		"This file has no manual fields.",
		null,
		"У цьому файлі немає ручних полів.",
		"Ten plik nie ma pól ręcznych.",
		"Acest fișier nu are câmpuri manuale.",
		"Ennek a fájlnak nincsenek kézi mezői.",
		"Ce fichier n’a pas de champs manuels."
	],
	[
		"Pick one, or type your own",
		null,
		"Обери або впиши своє",
		"Wybierz lub wpisz własne",
		"Alege sau scrie propriul text",
		"Válassz, vagy írd be a sajátodat",
		"Choisissez ou saisissez le vôtre"
	],
	[
		"Kept when the file is rebuilt",
		null,
		"Зберігається, коли файл перестворюється",
		"Zachowane przy odtworzeniu pliku",
		"Se păstrează la refacerea fișierului",
		"Megmarad a fájl újrakészítésekor",
		"Conservé à la régénération du fichier"
	],
	[
		"Saved · kept on rebuild",
		null,
		"Збережено · залишиться після перестворення",
		"Zapisano · zostanie po odtworzeniu",
		"Salvat · se păstrează la refacere",
		"Mentve · újrakészítéskor megmarad",
		"Enregistré · conservé à la régénération"
	],
	[
		"Back to the generated value",
		null,
		"Повернуто згенероване значення",
		"Przywrócono wygenerowaną wartość",
		"Valoarea generată a fost restabilită",
		"Visszaállítva a generált érték",
		"Valeur générée rétablie"
	],
	[
		"Read only",
		null,
		"Лише перегляд",
		"Tylko odczyt",
		"Doar citire",
		"Csak olvasható",
		"Lecture seule"
	],
	[
		"Your role can view this file but not change it.",
		null,
		"Твоя роль може переглядати цей файл, але не змінювати.",
		"Twoja rola może oglądać ten plik, ale nie zmieniać.",
		"Rolul tău poate vedea acest fișier, dar nu îl poate modifica.",
		"A szerepköröd megtekintheti, de nem módosíthatja ezt a fájlt.",
		"Votre rôle peut voir ce fichier mais pas le modifier."
	],
	[
		"File not found",
		null,
		"Файл не знайдено",
		"Nie znaleziono pliku",
		"Fișierul nu a fost găsit",
		"A fájl nem található",
		"Fichier introuvable"
	],
	[
		"Could not open the file",
		null,
		"Не вдалося відкрити файл",
		"Nie udało się otworzyć pliku",
		"Fișierul nu a putut fi deschis",
		"A fájl nem nyitható meg",
		"Impossible d’ouvrir le fichier"
	],
	[
		"Back to Reports",
		null,
		"Назад до звітів",
		"Wróć do raportów",
		"Înapoi la rapoarte",
		"Vissza a jelentésekhez",
		"Retour aux rapports"
	],
	[
		"{s} · generated {s} · {n} of {n} manual fields filled",
		null,
		"{s} · створено {s} · заповнено ручних полів: {n} з {n}",
		"{s} · utworzono {s} · wypełnione pola ręczne: {n} z {n}",
		"{s} · generat {s} · {n} din {n} câmpuri manuale completate",
		"{s} · elkészült: {s} · {n}/{n} kézi mező kitöltve",
		"{s} · généré le {s} · {n} champs manuels sur {n} remplis"
	],
	[
		"{s} · generated {s}",
		null,
		"{s} · створено {s}",
		"{s} · utworzono {s}",
		"{s} · generat {s}",
		"{s} · elkészült: {s}",
		"{s} · généré le {s}"
	],
	[
		"{s} · click to edit",
		null,
		"{s} · натисни, щоб змінити",
		"{s} · kliknij, aby edytować",
		"{s} · apasă pentru a edita",
		"{s} · kattints a szerkesztéshez",
		"{s} · cliquez pour modifier"
	],
	[
		"Last round",
		null,
		"Останній обхід",
		"Ostatni obchód",
		"Ultima tură de control",
		"Utolsó ellenőrző kör",
		"Dernière tournée"
	],
	[
		"No round yet",
		null,
		"Ще не було обходу",
		"Jeszcze nie było obchodu",
		"Încă nicio tură de control",
		"Még nem volt ellenőrző kör",
		"Pas encore de tournée"
	],
	[
		"Open rounds",
		null,
		"Відкрити обхід",
		"Otwórz obchód",
		"Deschide tura de control",
		"Ellenőrző kör megnyitása",
		"Ouvrir la tournée"
	],
	[
		"morning",
		null,
		"ранок",
		"rano",
		"dimineața",
		"reggel",
		"matin"
	],
	[
		"evening",
		null,
		"вечір",
		"wieczór",
		"seara",
		"este",
		"soir"
	],
	[
		"Damage of this container",
		null,
		"Пошкодження цього контейнера",
		"Uszkodzenia tego kontenera",
		"Deteriorările acestui container",
		"A konténer sérülései",
		"Dommages de ce conteneur"
	]
];
//#endregion
//#region src/components/services/i18n/dict-scanner.js
var dict_scanner_default = [
	[
		"Склад",
		"Warehouse",
		null,
		"Magazyn",
		"Depozit",
		"Raktár",
		"Entrepôt"
	],
	[
		"Приймання",
		"Receiving",
		null,
		"Przyjęcie",
		"Recepție",
		"Átvétel",
		"Réception"
	],
	[
		"Завершення",
		"Completion",
		null,
		"Zakończenie",
		"Finalizare",
		"Lezárás",
		"Clôture"
	],
	[
		"Контейнер",
		"Container",
		null,
		"Kontener",
		"Container",
		"Konténer",
		"Conteneur"
	],
	[
		"Перемістити",
		"Move",
		null,
		"Przenieś",
		"Mută",
		"Áthelyezés",
		"Déplacer"
	],
	[
		"Списати",
		"Write off",
		null,
		"Odpisz",
		"Scoate din stoc",
		"Leírás",
		"Sortir du stock"
	],
	[
		"Маркет-палета",
		"Market pallet",
		null,
		"Paleta market",
		"Palet market",
		"Market raklap",
		"Palette market"
	],
	[
		"Баланс дня",
		"Day balance",
		null,
		"Bilans dnia",
		"Bilanțul zilei",
		"Napi egyenleg",
		"Bilan du jour"
	],
	[
		"Черга синхронізації",
		"Sync queue",
		null,
		"Kolejka synchronizacji",
		"Coadă de sincronizare",
		"Szinkronizálási sor",
		"File de synchronisation"
	],
	[
		"онлайн",
		"online",
		null,
		"online",
		"online",
		"online",
		"en ligne"
	],
	[
		"офлайн · {n}",
		"offline · {n}",
		null,
		"offline · {n}",
		"offline · {n}",
		"offline · {n}",
		"hors ligne · {n}"
	],
	[
		"черга {n}",
		"queue {n}",
		null,
		"kolejka {n}",
		"coadă {n}",
		"sor {n}",
		"file {n}"
	],
	[
		"відхилено {n}",
		"rejected {n}",
		null,
		"odrzucone {n}",
		"respinse {n}",
		"elutasítva {n}",
		"rejetées {n}"
	],
	[
		"Назад",
		"Back",
		null,
		"Wstecz",
		"Înapoi",
		"Vissza",
		"Retour"
	],
	[
		"Немає зв'язку",
		"No connection",
		null,
		"Brak połączenia",
		"Fără conexiune",
		"Nincs kapcsolat",
		"Pas de connexion"
	],
	[
		"Працюй далі. Операцій на телефоні:",
		"Keep working. Operations on the phone:",
		null,
		"Pracuj dalej. Operacje w telefonie:",
		"Lucrează în continuare. Operații pe telefon:",
		"Dolgozz tovább. Műveletek a telefonon:",
		"Continuez. Opérations sur le téléphone :"
	],
	[
		"— відправляться автоматично.",
		"— they will be sent automatically.",
		null,
		"— zostaną wysłane automatycznie.",
		"— vor fi trimise automat.",
		"— automatikusan elküldjük őket.",
		"— elles seront envoyées automatiquement."
	],
	[
		"Змінити користувача",
		"Switch user",
		null,
		"Zmień użytkownika",
		"Schimbă utilizatorul",
		"Felhasználóváltás",
		"Changer d’utilisateur"
	],
	[
		"Скануй контейнер",
		"Scan a container",
		null,
		"Zeskanuj kontener",
		"Scanează un container",
		"Szkenneld be a konténert",
		"Scannez un conteneur"
	],
	[
		"Обхід",
		"Round",
		null,
		"Obchód",
		"Tura de control",
		"Ellenőrző kör",
		"Tournée"
	],
	[
		"Ранок",
		"Morning",
		null,
		"Rano",
		"Dimineață",
		"Reggel",
		"Matin"
	],
	[
		"Вечір",
		"Evening",
		null,
		"Wieczór",
		"Seară",
		"Este",
		"Soir"
	],
	[
		"Усі камери",
		"All chambers",
		null,
		"Wszystkie komory",
		"Toate camerele",
		"Minden kamra",
		"Toutes les chambres"
	],
	[
		"Температура",
		"Temperature",
		null,
		"Temperatura",
		"Temperatură",
		"Hőmérséklet",
		"Température"
	],
	[
		"Зберегти",
		"Save",
		null,
		"Zapisz",
		"Salvează",
		"Mentés",
		"Enregistrer"
	],
	[
		"порожня",
		"empty",
		null,
		"pusta",
		"goală",
		"üres",
		"vide"
	],
	[
		"Ще не було обходу",
		"No round yet",
		null,
		"Jeszcze nie było obchodu",
		"Încă nicio tură",
		"Még nem volt kör",
		"Pas encore de tournée"
	],
	[
		"Немає камер з товаром",
		"No chambers with stock",
		null,
		"Brak komór z towarem",
		"Nicio cameră cu marfă",
		"Nincs kamra áruval",
		"Aucune chambre avec stock"
	],
	[
		"Записано {n} з {n}",
		"{n} of {n} recorded",
		null,
		"Zapisano {n} z {n}",
		"Înregistrate {n} din {n}",
		"{n} / {n} rögzítve",
		"{n} sur {n} enregistrées"
	],
	[
		"Камера {n} збережена",
		"Chamber {n} saved",
		null,
		"Komora {n} zapisana",
		"Camera {n} salvată",
		"{n}. kamra mentve",
		"Chambre {n} enregistrée"
	],
	[
		"Невірний колір",
		"Wrong colour",
		null,
		"Błędny kolor",
		"Culoare greșită",
		"Hibás szín",
		"Couleur incorrecte"
	],
	[
		"Нічого зберігати",
		"Nothing to save",
		null,
		"Nic do zapisania",
		"Nimic de salvat",
		"Nincs mit menteni",
		"Rien à enregistrer"
	],
	[
		"Розпочати підрахунок",
		"Start counting",
		null,
		"Rozpocznij liczenie",
		"Începe numărarea",
		"Számlálás indítása",
		"Commencer le comptage"
	],
	[
		"Знайти контейнер",
		"Find a container",
		null,
		"Znajdź kontener",
		"Găsește un container",
		"Konténer keresése",
		"Trouver un conteneur"
	],
	[
		"Код контейнера",
		"Container code",
		null,
		"Kod kontenera",
		"Codul containerului",
		"Konténerkód",
		"Code du conteneur"
	],
	[
		"Сканером, камерою або вручну",
		"With the scanner, the camera or by hand",
		null,
		"Skanerem, aparatem lub ręcznie",
		"Cu scanerul, camera sau manual",
		"Szkennerrel, kamerával vagy kézzel",
		"Au scanner, à la caméra ou à la main"
	],
	[
		"Формат коду: 4 літери + 7 цифр, напр. MNBU3318616",
		"Code format: 4 letters + 7 digits, e.g. MNBU3318616",
		null,
		"Format kodu: 4 litery + 7 cyfr, np. MNBU3318616",
		"Format cod: 4 litere + 7 cifre, ex. MNBU3318616",
		"Kódformátum: 4 betű + 7 számjegy, pl. MNBU3318616",
		"Format du code : 4 lettres + 7 chiffres, p. ex. MNBU3318616"
	],
	[
		"Сканувати камерою",
		"Scan with the camera",
		null,
		"Skanuj aparatem",
		"Scanează cu camera",
		"Szkennelés kamerával",
		"Scanner avec la caméra"
	],
	[
		"Готово до роботи",
		"Ready",
		null,
		"Gotowe do pracy",
		"Gata de lucru",
		"Munkára kész",
		"Prêt"
	],
	[
		"Синхронізовано · {s}",
		"Synced · {s}",
		null,
		"Zsynchronizowano · {s}",
		"Sincronizat · {s}",
		"Szinkronizálva · {s}",
		"Synchronisé · {s}"
	],
	[
		"У черзі: {n}",
		"In the queue: {n}",
		null,
		"W kolejce: {n}",
		"În coadă: {n}",
		"Sorban: {n}",
		"En file : {n}"
	],
	[
		"Далі",
		"Next",
		null,
		"Dalej",
		"Continuă",
		"Tovább",
		"Suivant"
	],
	[
		"ящ. · палета",
		"boxes · pallet",
		null,
		"kart. · paleta",
		"cutii · palet",
		"doboz · raklap",
		"cartons · palette"
	],
	[
		"з {n}",
		"of {n}",
		null,
		"z {n}",
		"din {n}",
		"/ {n}",
		"sur {n}"
	],
	[
		"немає в плані контейнерів",
		"not in the containers plan",
		null,
		"brak w planie kontenerów",
		"nu e în planul containerelor",
		"nincs a konténertervben",
		"absent du plan des conteneurs"
	],
	[
		"pickup {s}",
		"pickup {s}",
		"забір {s}",
		"odbiór {s}",
		"ridicare {s}",
		"felvétel: {s}",
		"enlèvement {s}"
	],
	[
		"Комора (1–29)",
		"Chamber (1–29)",
		null,
		"Komora (1–29)",
		"Camera (1–29)",
		"Kamra (1–29)",
		"Chambre (1–29)"
	],
	[
		"Сторона",
		"Side",
		null,
		"Strona",
		"Latura",
		"Oldal",
		"Côté"
	],
	[
		"Комори 1–29",
		"Chambers 1–29",
		null,
		"Komory 1–29",
		"Camerele 1–29",
		"1–29. kamra",
		"Chambres 1–29"
	],
	[
		"Комори 1–29 (30 — CITRO, туди лише списання)",
		"Chambers 1–29 (30 is CITRO, write-offs only)",
		null,
		"Komory 1–29 (30 to CITRO, tylko odpisy)",
		"Camerele 1–29 (30 e CITRO, doar scoateri din stoc)",
		"1–29. kamra (a 30. a CITRO, csak leíráshoz)",
		"Chambres 1–29 (la 30 est CITRO, sorties seulement)"
	],
	[
		"Комора {n}",
		"Chamber {n}",
		null,
		"Komora {n}",
		"Camera {n}",
		"{n}. kamra",
		"Chambre {n}"
	],
	[
		"Комора {n}: {s} / {s} · вільно {s}",
		"Chamber {n}: {s} / {s} · {s} free",
		null,
		"Komora {n}: {s} / {s} · wolne {s}",
		"Camera {n}: {s} / {s} · liber {s}",
		"{n}. kamra: {s} / {s} · szabad: {s}",
		"Chambre {n} : {s} / {s} · {s} libres"
	],
	[
		"Комора {n} заповнена: {s} / {s}",
		"Chamber {n} is full: {s} / {s}",
		null,
		"Komora {n} pełna: {s} / {s}",
		"Camera {n} e plină: {s} / {s}",
		"A(z) {n}. kamra tele: {s} / {s}",
		"Chambre {n} pleine : {s} / {s}"
	],
	[
		"Код плантації",
		"Plantation code",
		null,
		"Kod plantacji",
		"Codul plantației",
		"Ültetvénykód",
		"Code de plantation"
	],
	[
		"Необов’язково для BIO",
		"Optional for BIO",
		null,
		"Opcjonalne dla BIO",
		"Opțional pentru BIO",
		"BIO-nál nem kötelező",
		"Facultatif pour BIO"
	],
	[
		"Перевіряю…",
		"Checking…",
		null,
		"Sprawdzam…",
		"Se verifică…",
		"Ellenőrzés…",
		"Vérification…"
	],
	[
		"Не знайдено.",
		"Not found.",
		null,
		"Nie znaleziono.",
		"Nu a fost găsit.",
		"Nem található.",
		"Introuvable."
	],
	[
		"Не знайдено. Формат: {s}",
		"Not found. Format: {s}",
		null,
		"Nie znaleziono. Format: {s}",
		"Nu a fost găsit. Format: {s}",
		"Nem található. Formátum: {s}",
		"Introuvable. Format : {s}"
	],
	[
		"Без мережі — код перевірить сервер пізніше",
		"No network — the server checks the code later",
		null,
		"Bez sieci — serwer sprawdzi kod później",
		"Fără rețea — serverul verifică codul mai târziu",
		"Nincs hálózat — a szerver később ellenőrzi a kódot",
		"Pas de réseau — le serveur vérifiera le code plus tard"
	],
	[
		"Ящиків на палеті",
		"Boxes on the pallet",
		null,
		"Kartonów na palecie",
		"Cutii pe palet",
		"Doboz a raklapon",
		"Cartons sur la palette"
	],
	[
		"повна",
		"full",
		null,
		"pełna",
		"plin",
		"teljes",
		"pleine"
	],
	[
		"Інша кількість",
		"Other quantity",
		null,
		"Inna ilość",
		"Altă cantitate",
		"Más mennyiség",
		"Autre quantité"
	],
	[
		"інша кількість",
		"other quantity",
		null,
		"inna ilość",
		"altă cantitate",
		"más mennyiség",
		"autre quantité"
	],
	[
		"+ Палета ·",
		"+ Pallet ·",
		null,
		"+ Paleta ·",
		"+ Palet ·",
		"+ Raklap ·",
		"+ Palette ·"
	],
	[
		"ящ.",
		"boxes",
		null,
		"kart.",
		"cutii",
		"doboz",
		"cartons"
	],
	[
		"Завершити контейнер",
		"Finish the container",
		null,
		"Zakończ kontener",
		"Finalizează containerul",
		"Konténer lezárása",
		"Terminer le conteneur"
	],
	[
		"Очікувано",
		"Expected",
		null,
		"Oczekiwano",
		"Așteptat",
		"Várt",
		"Attendu"
	],
	[
		"Пораховано",
		"Counted",
		null,
		"Policzono",
		"Numărat",
		"Megszámolt",
		"Compté"
	],
	[
		"Різниця",
		"Difference",
		null,
		"Różnica",
		"Diferență",
		"Eltérés",
		"Écart"
	],
	[
		"Поясни різницю",
		"Explain the difference",
		null,
		"Wyjaśnij różnicę",
		"Explică diferența",
		"Magyarázd meg az eltérést",
		"Expliquez l’écart"
	],
	[
		"Все пояснено",
		"Everything explained",
		null,
		"Wszystko wyjaśnione",
		"Totul este explicat",
		"Minden megmagyarázva",
		"Tout est expliqué"
	],
	[
		"Не пояснено: {n} ящ.",
		"Not explained: {n} boxes",
		null,
		"Niewyjaśnione: {n} kart.",
		"Neexplicate: {n} cutii",
		"Megmagyarázatlan: {n} doboz",
		"Non expliqué : {n} cartons"
	],
	[
		"Забагато на {n} ящ.",
		"Too many by {n} boxes",
		null,
		"Za dużo o {n} kart.",
		"Prea multe cu {n} cutii",
		"{n} dobozzal több",
		"Trop de {n} cartons"
	],
	[
		"Більше, ніж очікувано, на {n} ящ.",
		"More than expected by {n} boxes",
		null,
		"Więcej niż oczekiwano o {n} kart.",
		"Mai mult decât se aștepta cu {n} cutii",
		"{n} dobozzal több a vártnál",
		"{n} cartons de plus que prévu"
	],
	[
		"Без очікуваної кількості — запиши лише невідповідний товар",
		"No expected quantity — record only the non-conforming goods",
		null,
		"Brak oczekiwanej ilości — wpisz tylko niezgodny towar",
		"Fără cantitate așteptată — notează doar marfa neconformă",
		"Nincs várt mennyiség — csak a nem megfelelő árut rögzítsd",
		"Pas de quantité attendue — notez seulement la marchandise non conforme"
	],
	[
		"Зберегти і завершити",
		"Save and finish",
		null,
		"Zapisz i zakończ",
		"Salvează și finalizează",
		"Mentés és lezárás",
		"Enregistrer et terminer"
	],
	[
		"Назад до приймання",
		"Back to receiving",
		null,
		"Wróć do przyjęcia",
		"Înapoi la recepție",
		"Vissza az átvételhez",
		"Retour à la réception"
	],
	[
		"У коморах",
		"In chambers",
		null,
		"W komorach",
		"În camere",
		"Kamrákban",
		"En chambres"
	],
	[
		"У коморах більше немає ящиків цього контейнера.",
		"No boxes of this container left in the chambers.",
		null,
		"W komorach nie ma już kartonów z tego kontenera.",
		"Nu mai sunt cutii din acest container în camere.",
		"A kamrákban már nincs doboz ebből a konténerből.",
		"Plus aucun carton de ce conteneur en chambre."
	],
	[
		"{s} · газування {s}",
		"{s} · gas day {s}",
		null,
		"{s} · gazowanie {s}",
		"{s} · gazare {s}",
		"{s} · gázosítás: {s}",
		"{s} · gazage {s}"
	],
	[
		"{s} · без дня газування",
		"{s} · no gas day",
		null,
		"{s} · bez dnia gazowania",
		"{s} · fără zi de gazare",
		"{s} · nincs gázosítási nap",
		"{s} · sans jour de gazage"
	],
	[
		"≈ {n} палета",
		"≈ {n} pallet",
		null,
		"≈ {n} paleta",
		"≈ {n} palet",
		"≈ {n} raklap",
		"≈ {n} palette"
	],
	[
		"≈ {n} палети",
		"≈ {n} pallets",
		null,
		"≈ {n} palety",
		"≈ {n} paleți",
		"≈ {n} raklap",
		"≈ {n} palettes"
	],
	[
		"≈ {n} палет",
		"≈ {n} pallets",
		null,
		"≈ {n} palet",
		"≈ {n} paleți",
		"≈ {n} raklap",
		"≈ {n} palettes"
	],
	[
		"+ Додати палету",
		"+ Add a pallet",
		null,
		"+ Dodaj paletę",
		"+ Adaugă un palet",
		"+ Raklap hozzáadása",
		"+ Ajouter une palette"
	],
	[
		"Звідки",
		"From",
		null,
		"Skąd",
		"De unde",
		"Honnan",
		"D’où"
	],
	[
		"Комора {n} · {s}",
		"Chamber {n} · {s}",
		null,
		"Komora {n} · {s}",
		"Camera {n} · {s}",
		"{n}. kamra · {s}",
		"Chambre {n} · {s}"
	],
	[
		"Куди · комора",
		"To · chamber",
		null,
		"Dokąd · komora",
		"Unde · camera",
		"Hova · kamra",
		"Vers · chambre"
	],
	[
		"Кількість ящиків",
		"Number of boxes",
		null,
		"Liczba kartonów",
		"Număr de cutii",
		"Dobozok száma",
		"Nombre de cartons"
	],
	[
		"Усе",
		"All",
		null,
		"Wszystko",
		"Tot",
		"Mind",
		"Tout"
	],
	[
		"Перемістити {n} ящ. · {s} → {s}",
		"Move {n} boxes · {s} → {s}",
		null,
		"Przenieś {n} kart. · {s} → {s}",
		"Mută {n} cutii · {s} → {s}",
		"{n} doboz áthelyezése · {s} → {s}",
		"Déplacer {n} cartons · {s} → {s}"
	],
	[
		"Категорія",
		"Category",
		null,
		"Kategoria",
		"Categorie",
		"Kategória",
		"Catégorie"
	],
	[
		"Категорія палети",
		"Pallet category",
		null,
		"Kategoria palety",
		"Categoria paletului",
		"Raklap kategória",
		"Catégorie de la palette"
	],
	[
		"маркет",
		"market",
		null,
		"market",
		"market",
		"market",
		"market"
	],
	[
		"зелені",
		"green",
		null,
		"zielone",
		"verzi",
		"zöld",
		"vertes"
	],
	[
		"утилізація",
		"disposal",
		null,
		"utylizacja",
		"casare",
		"megsemmisítés",
		"destruction"
	],
	[
		"Ящики підуть у комору 30 (CITRO).",
		"The boxes go to chamber 30 (CITRO).",
		null,
		"Kartony trafią do komory 30 (CITRO).",
		"Cutiile merg în camera 30 (CITRO).",
		"A dobozok a 30. kamrába (CITRO) kerülnek.",
		"Les cartons vont en chambre 30 (CITRO)."
	],
	[
		"Списати {n} ящ. у {s}",
		"Write off {n} boxes to {s}",
		null,
		"Odpisz {n} kart. do {s}",
		"Scoate {n} cutii în {s}",
		"{n} doboz leírása ide: {s}",
		"Sortir {n} cartons en {s}"
	],
	[
		"Скануй коробку · кожен скан = +1",
		"Scan a box · each scan = +1",
		null,
		"Skanuj karton · każdy skan = +1",
		"Scanează o cutie · fiecare scanare = +1",
		"Szkennelj dobozt · minden szkennelés = +1",
		"Scannez un carton · chaque scan = +1"
	],
	[
		"Код контейнера на коробці",
		"Container code on the box",
		null,
		"Kod kontenera na kartonie",
		"Codul containerului de pe cutie",
		"Konténerkód a dobozon",
		"Code du conteneur sur le carton"
	],
	[
		"код коробки",
		"box code",
		null,
		"kod kartonu",
		"cod cutie",
		"dobozkód",
		"code du carton"
	],
	[
		"Коробок з {s}",
		"Boxes from {s}",
		null,
		"Kartony z {s}",
		"Cutii din {s}",
		"Doboz innen: {s}",
		"Cartons de {s}"
	],
	[
		"Прибрати {s}",
		"Remove {s}",
		null,
		"Usuń {s}",
		"Elimină {s}",
		"{s} eltávolítása",
		"Retirer {s}"
	],
	[
		"Разом",
		"Total",
		null,
		"Razem",
		"Total",
		"Összesen",
		"Total"
	],
	[
		"Зберегти палету",
		"Save the pallet",
		null,
		"Zapisz paletę",
		"Salvează paletul",
		"Raklap mentése",
		"Enregistrer la palette"
	],
	[
		"День",
		"Day",
		null,
		"Dzień",
		"Ziua",
		"Nap",
		"Jour"
	],
	[
		"План і замовлення",
		"Plan and orders",
		null,
		"Plan i zamówienia",
		"Plan și comenzi",
		"Terv és rendelések",
		"Plan et commandes"
	],
	[
		"Потрібно (Sales Plan, банан)",
		"Needed (Sales Plan, banana)",
		null,
		"Potrzebne (Sales Plan, banan)",
		"Necesar (Sales Plan, banane)",
		"Szükséges (Sales Plan, banán)",
		"Besoin (Sales Plan, banane)"
	],
	[
		"Замовлено: банан",
		"Ordered: banana",
		null,
		"Zamówione: banan",
		"Comandat: banane",
		"Rendelve: banán",
		"Commandé : banane"
	],
	[
		"Замовлено: BIO",
		"Ordered: BIO",
		null,
		"Zamówione: BIO",
		"Comandat: BIO",
		"Rendelve: BIO",
		"Commandé : BIO"
	],
	[
		"Замовлено: маркет / смітник",
		"Ordered: market / garbage",
		null,
		"Zamówione: market / odpady",
		"Comandat: market / deșeuri",
		"Rendelve: market / hulladék",
		"Commandé : market / déchets"
	],
	[
		"Замовлено: ананас",
		"Ordered: pineapple",
		null,
		"Zamówione: ananas",
		"Comandat: ananas",
		"Rendelve: ananász",
		"Commandé : ananas"
	],
	[
		"Замовлено − план",
		"Ordered − plan",
		null,
		"Zamówione − plan",
		"Comandat − plan",
		"Rendelve − terv",
		"Commandé − plan"
	],
	[
		"Рух",
		"Movement",
		null,
		"Ruch",
		"Mișcare",
		"Mozgás",
		"Mouvements"
	],
	[
		"Прийнято",
		"Received",
		null,
		"Przyjęto",
		"Recepționat",
		"Átvéve",
		"Réceptionné"
	],
	[
		"Відвантажено (скани)",
		"Shipped (scans)",
		null,
		"Wysłane (skany)",
		"Expediat (scanări)",
		"Kiszállítva (szkennelés)",
		"Expédié (scans)"
	],
	[
		"Ще не відвантажено",
		"Not shipped yet",
		null,
		"Jeszcze nie wysłane",
		"Încă neexpediat",
		"Még nincs kiszállítva",
		"Pas encore expédié"
	],
	[
		"Переміщено між коморами",
		"Moved between chambers",
		null,
		"Przeniesione między komorami",
		"Mutat între camere",
		"Kamrák között áthelyezve",
		"Déplacé entre chambres"
	],
	[
		"Невідповідний товар",
		"Non-conforming goods",
		null,
		"Niezgodny towar",
		"Marfă neconformă",
		"Nem megfelelő áru",
		"Marchandise non conforme"
	],
	[
		"Приймання R+T / GS / DEC",
		"Receiving R+T / GS / DEC",
		null,
		"Przyjęcie R+T / GS / DEC",
		"Recepție R+T / GS / DEC",
		"Átvétel R+T / GS / DEC",
		"Réception R+T / GS / DEC"
	],
	[
		"Після дозрівання R+T / GS / DEC",
		"After ripening R+T / GS / DEC",
		null,
		"Po dojrzewaniu R+T / GS / DEC",
		"După coacere R+T / GS / DEC",
		"Érlelés után R+T / GS / DEC",
		"Après mûrissage R+T / GS / DEC"
	],
	[
		"Залишок зараз",
		"Stock now",
		null,
		"Stan teraz",
		"Stoc acum",
		"Készlet most",
		"Stock actuel"
	],
	[
		"Банан у коморах",
		"Banana in chambers",
		null,
		"Banan w komorach",
		"Banane în camere",
		"Banán a kamrákban",
		"Banane en chambres"
	],
	[
		"BIO у коморах",
		"BIO in chambers",
		null,
		"BIO w komorach",
		"BIO în camere",
		"BIO a kamrákban",
		"BIO en chambres"
	],
	[
		"{n} розбіжність за день. Позначено червоним.",
		"{n} discrepancy for the day. Marked in red.",
		null,
		"Rozbieżności za dzień: {n}. Oznaczono na czerwono.",
		"{n} diferență pentru ziua aceasta. Marcată cu roșu.",
		"{n} eltérés a napra. Pirossal jelölve.",
		"{n} écart pour la journée. Marqué en rouge."
	],
	[
		"{n} розбіжності за день. Позначено червоним.",
		"{n} discrepancies for the day. Marked in red.",
		null,
		"Rozbieżności za dzień: {n}. Oznaczono na czerwono.",
		"{n} diferențe pentru ziua aceasta. Marcate cu roșu.",
		"{n} eltérés a napra. Pirossal jelölve.",
		"{n} écarts pour la journée. Marqués en rouge."
	],
	[
		"{n} розбіжностей за день. Позначено червоним.",
		"{n} discrepancies for the day. Marked in red.",
		null,
		"Rozbieżności za dzień: {n}. Oznaczono na czerwono.",
		"{n} diferențe pentru ziua aceasta. Marcate cu roșu.",
		"{n} eltérés a napra. Pirossal jelölve.",
		"{n} écarts pour la journée. Marqués en rouge."
	],
	[
		"Немає мережі — баланс недоступний",
		"No network — the balance is unavailable",
		null,
		"Brak sieci — bilans niedostępny",
		"Fără rețea — bilanțul nu e disponibil",
		"Nincs hálózat — az egyenleg nem érhető el",
		"Pas de réseau — bilan indisponible"
	],
	[
		"Відхилено · {n}",
		"Rejected · {n}",
		null,
		"Odrzucone · {n}",
		"Respinse · {n}",
		"Elutasítva · {n}",
		"Rejetées · {n}"
	],
	[
		"Очікують · {n}",
		"Waiting · {n}",
		null,
		"Oczekują · {n}",
		"În așteptare · {n}",
		"Várakozik · {n}",
		"En attente · {n}"
	],
	[
		"Усе відправлено.",
		"Everything sent.",
		null,
		"Wszystko wysłane.",
		"Totul a fost trimis.",
		"Minden elküldve.",
		"Tout est envoyé."
	],
	[
		"Операції відправляються по черзі, щойно є мережа.",
		"Operations are sent one by one as soon as there is a network.",
		null,
		"Operacje są wysyłane po kolei, gdy jest sieć.",
		"Operațiile se trimit pe rând, imediat ce există rețea.",
		"A műveletek sorban mennek el, amint van hálózat.",
		"Les opérations sont envoyées une par une dès qu’il y a du réseau."
	],
	[
		"Операції відправляються по черзі. Остання спроба {s}.",
		"Operations are sent one by one. Last attempt {s}.",
		null,
		"Operacje są wysyłane po kolei. Ostatnia próba {s}.",
		"Operațiile se trimit pe rând. Ultima încercare {s}.",
		"A műveletek sorban mennek el. Utolsó próbálkozás: {s}.",
		"Les opérations sont envoyées une par une. Dernier essai {s}."
	],
	[
		"Сервер відхилив операцію",
		"The server rejected the operation",
		null,
		"Serwer odrzucił operację",
		"Serverul a respins operația",
		"A szerver elutasította a műveletet",
		"Le serveur a rejeté l’opération"
	],
	[
		"Повторити",
		"Retry",
		null,
		"Ponów",
		"Reîncearcă",
		"Újra",
		"Réessayer"
	],
	[
		"Видалити",
		"Delete",
		null,
		"Usuń",
		"Șterge",
		"Törlés",
		"Supprimer"
	],
	[
		"Надіслати зараз",
		"Send now",
		null,
		"Wyślij teraz",
		"Trimite acum",
		"Küldés most",
		"Envoyer maintenant"
	],
	[
		"Сканування",
		"Scanning",
		null,
		"Skanowanie",
		"Scanare",
		"Szkennelés",
		"Scan"
	],
	[
		"Сканування камерою",
		"Camera scanning",
		null,
		"Skanowanie aparatem",
		"Scanare cu camera",
		"Szkennelés kamerával",
		"Scan par caméra"
	],
	[
		"Наведи на код контейнера",
		"Point at the container code",
		null,
		"Skieruj na kod kontenera",
		"Îndreaptă spre codul containerului",
		"Irányítsd a konténerkódra",
		"Visez le code du conteneur"
	],
	[
		"Ввести вручну",
		"Enter by hand",
		null,
		"Wpisz ręcznie",
		"Introdu manual",
		"Kézi bevitel",
		"Saisir à la main"
	],
	[
		"Закрити камеру",
		"Close the camera",
		null,
		"Zamknij aparat",
		"Închide camera",
		"Kamera bezárása",
		"Fermer la caméra"
	],
	[
		"Камера недоступна. Введи код вручну.",
		"The camera is not available. Enter the code by hand.",
		null,
		"Aparat niedostępny. Wpisz kod ręcznie.",
		"Camera nu e disponibilă. Introdu codul manual.",
		"A kamera nem érhető el. Írd be a kódot kézzel.",
		"Caméra indisponible. Saisissez le code à la main."
	],
	[
		"Збережено на телефоні",
		"Saved on the phone",
		null,
		"Zapisano w telefonie",
		"Salvat pe telefon",
		"Mentve a telefonon",
		"Enregistré sur le téléphone"
	],
	[
		"Відправиться, щойно з’явиться мережа",
		"It will be sent as soon as there is a network",
		null,
		"Zostanie wysłane, gdy pojawi się sieć",
		"Va fi trimis imediat ce apare rețeaua",
		"Elküldjük, amint lesz hálózat",
		"Sera envoyé dès qu’il y aura du réseau"
	],
	[
		"Невірний код",
		"Wrong code",
		null,
		"Błędny kod",
		"Cod greșit",
		"Hibás kód",
		"Code incorrect"
	],
	[
		"порожньо",
		"empty",
		null,
		"puste",
		"gol",
		"üres",
		"vide"
	],
	[
		"Помилка сервера",
		"Server error",
		null,
		"Błąd serwera",
		"Eroare de server",
		"Szerverhiba",
		"Erreur du serveur"
	],
	[
		"{s} уже відвантажено",
		"{s} is already shipped",
		null,
		"{s} już wysłany",
		"{s} a fost deja expediat",
		"{s} már ki van szállítva",
		"{s} est déjà expédié"
	],
	[
		"Залишку в коморах немає",
		"Nothing left in the chambers",
		null,
		"W komorach nic nie zostało",
		"Nu a mai rămas nimic în camere",
		"A kamrákban nem maradt semmi",
		"Plus rien en chambre"
	],
	[
		"Немає в плані контейнерів",
		"Not in the containers plan",
		null,
		"Brak w planie kontenerów",
		"Nu e în planul containerelor",
		"Nincs a konténertervben",
		"Absent du plan des conteneurs"
	],
	[
		"Можна прийняти — перевір код",
		"It can be received — check the code",
		null,
		"Można przyjąć — sprawdź kod",
		"Se poate recepționa — verifică codul",
		"Átvehető — ellenőrizd a kódot",
		"Réception possible — vérifiez le code"
	],
	[
		"Немає мережі",
		"No network",
		null,
		"Brak sieci",
		"Fără rețea",
		"Nincs hálózat",
		"Pas de réseau"
	],
	[
		"Приймання збережеться на телефоні",
		"Receiving is saved on the phone",
		null,
		"Przyjęcie zostanie zapisane w telefonie",
		"Recepția se salvează pe telefon",
		"Az átvétel a telefonon mentődik",
		"La réception est enregistrée sur le téléphone"
	],
	[
		"Операції залишаються в черзі",
		"The operations stay in the queue",
		null,
		"Operacje zostają w kolejce",
		"Operațiile rămân în coadă",
		"A műveletek a sorban maradnak",
		"Les opérations restent en file"
	],
	[
		"Вкажи кількість ящиків",
		"Enter the number of boxes",
		null,
		"Podaj liczbę kartonów",
		"Introdu numărul de cutii",
		"Add meg a dobozok számát",
		"Indiquez le nombre de cartons"
	],
	[
		"Невірна комора",
		"Wrong chamber",
		null,
		"Błędna komora",
		"Cameră greșită",
		"Hibás kamra",
		"Chambre incorrecte"
	],
	[
		"Приймання лише в комори 1–29",
		"Receiving only into chambers 1–29",
		null,
		"Przyjęcie tylko do komór 1–29",
		"Recepție doar în camerele 1–29",
		"Átvétel csak az 1–29. kamrába",
		"Réception seulement en chambres 1–29"
	],
	[
		"Не вміщується в комору {n}",
		"Does not fit into chamber {n}",
		null,
		"Nie mieści się w komorze {n}",
		"Nu încape în camera {n}",
		"Nem fér el a(z) {n}. kamrában",
		"Ne tient pas dans la chambre {n}"
	],
	[
		"Вільно {s}. Обери іншу комору.",
		"{s} free. Pick another chamber.",
		null,
		"Wolne {s}. Wybierz inną komorę.",
		"Liber {s}. Alege altă cameră.",
		"Szabad: {s}. Válassz másik kamrát.",
		"{s} libres. Choisissez une autre chambre."
	],
	[
		"Вільно {s}",
		"{s} free",
		null,
		"Wolne {s}",
		"Liber {s}",
		"Szabad: {s}",
		"{s} libres"
	],
	[
		"Код плантації не знайдено",
		"Plantation code not found",
		null,
		"Nie znaleziono kodu plantacji",
		"Codul plantației nu a fost găsit",
		"Az ültetvénykód nem található",
		"Code de plantation introuvable"
	],
	[
		"Виправ код або очисти поле",
		"Fix the code or clear the field",
		null,
		"Popraw kod lub wyczyść pole",
		"Corectează codul sau golește câmpul",
		"Javítsd a kódot, vagy ürítsd a mezőt",
		"Corrigez le code ou videz le champ"
	],
	[
		"+{n} ящ. → комора {n} {s}",
		"+{n} boxes → chamber {n} {s}",
		null,
		"+{n} kart. → komora {n} {s}",
		"+{n} cutii → camera {n} {s}",
		"+{n} doboz → {n}. kamra {s}",
		"+{n} cartons → chambre {n} {s}"
	],
	[
		"{s} · палета {n}",
		"{s} · pallet {n}",
		null,
		"{s} · paleta {n}",
		"{s} · palet {n}",
		"{s} · {n}. raklap",
		"{s} · palette {n}"
	],
	[
		"Різниця не пояснена",
		"The difference is not explained",
		null,
		"Różnica nie jest wyjaśniona",
		"Diferența nu este explicată",
		"Az eltérés nincs megmagyarázva",
		"L’écart n’est pas expliqué"
	],
	[
		"Розклади ящики по DEC / GS / R+T",
		"Split the boxes into DEC / GS / R+T",
		null,
		"Rozdziel kartony na DEC / GS / R+T",
		"Împarte cutiile pe DEC / GS / R+T",
		"Oszd szét a dobozokat: DEC / GS / R+T",
		"Répartissez les cartons en DEC / GS / R+T"
	],
	[
		"Контейнер {s} завершено",
		"Container {s} finished",
		null,
		"Kontener {s} zakończony",
		"Containerul {s} finalizat",
		"A(z) {s} konténer lezárva",
		"Conteneur {s} terminé"
	],
	[
		"Немає звідки переміщати",
		"Nothing to move from",
		null,
		"Nie ma skąd przenosić",
		"Nu există de unde muta",
		"Nincs honnan áthelyezni",
		"Rien à déplacer"
	],
	[
		"Немає звідки списувати",
		"Nothing to write off from",
		null,
		"Nie ma skąd odpisać",
		"Nu există de unde scoate din stoc",
		"Nincs honnan leírni",
		"Rien à sortir"
	],
	[
		"Невірна кількість",
		"Wrong quantity",
		null,
		"Błędna ilość",
		"Cantitate greșită",
		"Hibás mennyiség",
		"Quantité incorrecte"
	],
	[
		"Доступно {s} ящ.",
		"{s} boxes available",
		null,
		"Dostępne {s} kart.",
		"Disponibil {s} cutii",
		"Elérhető: {s} doboz",
		"{s} cartons disponibles"
	],
	[
		"Те саме місце",
		"The same place",
		null,
		"To samo miejsce",
		"Același loc",
		"Ugyanaz a hely",
		"Même emplacement"
	],
	[
		"Обери іншу комору або сторону",
		"Pick another chamber or side",
		null,
		"Wybierz inną komorę lub stronę",
		"Alege altă cameră sau latură",
		"Válassz másik kamrát vagy oldalt",
		"Choisissez une autre chambre ou un autre côté"
	],
	[
		"Переміщено {n} ящ. · {s} → {s}",
		"Moved {n} boxes · {s} → {s}",
		null,
		"Przeniesiono {n} kart. · {s} → {s}",
		"Mutat {n} cutii · {s} → {s}",
		"{n} doboz áthelyezve · {s} → {s}",
		"{n} cartons déplacés · {s} → {s}"
	],
	[
		"Списано {n} ящ. у {s}",
		"Written off {n} boxes to {s}",
		null,
		"Odpisano {n} kart. do {s}",
		"Scoase {n} cutii în {s}",
		"{n} doboz leírva ide: {s}",
		"{n} cartons sortis en {s}"
	],
	[
		"{s} · комора {n}",
		"{s} · chamber {n}",
		null,
		"{s} · komora {n}",
		"{s} · camera {n}",
		"{s} · {n}. kamra",
		"{s} · chambre {n}"
	],
	[
		"Палета порожня",
		"The pallet is empty",
		null,
		"Paleta jest pusta",
		"Paletul este gol",
		"A raklap üres",
		"La palette est vide"
	],
	[
		"Відскануй хоча б одну коробку",
		"Scan at least one box",
		null,
		"Zeskanuj co najmniej jeden karton",
		"Scanează cel puțin o cutie",
		"Szkennelj be legalább egy dobozt",
		"Scannez au moins un carton"
	],
	[
		"Палета {s} · {n} ящ.",
		"Pallet {s} · {n} boxes",
		null,
		"Paleta {s} · {n} kart.",
		"Palet {s} · {n} cutii",
		"Raklap {s} · {n} doboz",
		"Palette {s} · {n} cartons"
	],
	[
		"{n} контейнер",
		"{n} container",
		null,
		"kontenery: {n}",
		"{n} container",
		"{n} konténer",
		"{n} conteneur"
	],
	[
		"{n} контейнери",
		"{n} containers",
		null,
		"kontenery: {n}",
		"{n} containere",
		"{n} konténer",
		"{n} conteneurs"
	],
	[
		"{n} контейнерів",
		"{n} containers",
		null,
		"kontenery: {n}",
		"{n} containere",
		"{n} konténer",
		"{n} conteneurs"
	],
	[
		"Не все відправлено",
		"Not everything was sent",
		null,
		"Nie wszystko wysłano",
		"Nu s-a trimis tot",
		"Nem minden ment el",
		"Tout n’a pas été envoyé"
	],
	[
		"Спробую ще раз автоматично",
		"I will try again automatically",
		null,
		"Spróbuję ponownie automatycznie",
		"Voi reîncerca automat",
		"Automatikusan újrapróbálom",
		"Je réessaierai automatiquement"
	],
	[
		"Усе відправлено",
		"Everything sent",
		null,
		"Wszystko wysłane",
		"Totul a fost trimis",
		"Minden elküldve",
		"Tout est envoyé"
	],
	[
		"Видача за замовленням",
		"Issue by order",
		null,
		"Wydanie wg zamówienia",
		"Livrare pe comandă",
		"Kiadás rendelés szerint",
		"Sortie par commande"
	],
	[
		"Сьогодні",
		"Today",
		null,
		"Dziś",
		"Astăzi",
		"Ma",
		"Aujourd’hui"
	],
	[
		"Завтра",
		"Tomorrow",
		null,
		"Jutro",
		"Mâine",
		"Holnap",
		"Demain"
	],
	[
		"Підготовка",
		"Preparation",
		null,
		"Przygotowanie",
		"Pregătire",
		"Előkészítés",
		"Préparation"
	],
	[
		"У замовленні 0 ящиків. Підтвердь кількість, щоб почати.",
		"The order has 0 boxes. Confirm the quantity to start.",
		null,
		"Zamówienie ma 0 kartonów. Potwierdź ilość, aby zacząć.",
		"Comanda are 0 cutii. Confirmă cantitatea pentru a începe.",
		"A rendelésben 0 doboz van. Erősítsd meg a mennyiséget a kezdéshez.",
		"La commande a 0 carton. Confirmez la quantité pour commencer."
	],
	[
		"Підтвердити кількість",
		"Confirm quantity",
		null,
		"Potwierdź ilość",
		"Confirmă cantitatea",
		"Mennyiség megerősítése",
		"Confirmer la quantité"
	],
	[
		"Лінії в машині",
		"Lines in the truck",
		null,
		"Linie w ciężarówce",
		"Linii în camion",
		"Sorok a kamionban",
		"Lignes dans le camion"
	],
	[
		"Менше ліній",
		"Fewer lines",
		null,
		"Mniej linii",
		"Mai puține linii",
		"Kevesebb sor",
		"Moins de lignes"
	],
	[
		"Більше ліній",
		"More lines",
		null,
		"Więcej linii",
		"Mai multe linii",
		"Több sor",
		"Plus de lignes"
	],
	[
		"Сторони",
		"Sides",
		null,
		"Strony",
		"Laturi",
		"Oldalak",
		"Côtés"
	],
	[
		"Одна сторона",
		"One side",
		null,
		"Jedna strona",
		"O latură",
		"Egy oldal",
		"Un côté"
	],
	[
		"Дві сторони",
		"Two sides",
		null,
		"Dwie strony",
		"Două laturi",
		"Két oldal",
		"Deux côtés"
	],
	[
		"Почати сканування",
		"Start scanning",
		null,
		"Rozpocznij skanowanie",
		"Începe scanarea",
		"Szkennelés indítása",
		"Commencer le scan"
	],
	[
		"Скануй коробку · код контейнера",
		"Scan a box · container code",
		null,
		"Skanuj karton · kod kontenera",
		"Scanează cutia · codul containerului",
		"Szkenneld a dobozt · konténerkód",
		"Scannez un carton · code du conteneur"
	],
	[
		"Ящиків за скан",
		"Boxes per scan",
		null,
		"Kartonów na skan",
		"Cutii per scanare",
		"Doboz szkennelésenként",
		"Cartons par scan"
	],
	[
		"Без наклейки",
		"No sticker",
		null,
		"Bez naklejki",
		"Fără etichetă",
		"Matrica nélkül",
		"Sans étiquette"
	],
	[
		"без наклейки",
		"no sticker",
		null,
		"bez naklejki",
		"fără etichetă",
		"matrica nélkül",
		"sans étiquette"
	],
	[
		"Скасувати останній",
		"Undo last",
		null,
		"Cofnij ostatni",
		"Anulează ultima",
		"Utolsó visszavonása",
		"Annuler le dernier"
	],
	[
		"Підсумок",
		"Summary",
		null,
		"Podsumowanie",
		"Rezumat",
		"Összesítés",
		"Récapitulatif"
	],
	[
		"Скасувати видачу",
		"Cancel the issue",
		null,
		"Anuluj wydanie",
		"Anulează livrarea",
		"Kiadás megszakítása",
		"Annuler la sortie"
	],
	[
		"Ящики за контейнерами",
		"Boxes by container",
		null,
		"Kartony wg kontenerów",
		"Cutii pe containere",
		"Dobozok konténerenként",
		"Cartons par conteneur"
	],
	[
		"Замовлено",
		"Ordered",
		null,
		"Zamówione",
		"Comandat",
		"Megrendelve",
		"Commandé"
	],
	[
		"Відскановано",
		"Scanned",
		null,
		"Zeskanowano",
		"Scanat",
		"Beszkennelve",
		"Scanné"
	],
	[
		"Зберегти видачу",
		"Save the issue",
		null,
		"Zapisz wydanie",
		"Salvează livrarea",
		"Kiadás mentése",
		"Enregistrer la sortie"
	],
	[
		"Звіт клієнту",
		"Client report",
		null,
		"Raport dla klienta",
		"Raport client",
		"Ügyféljelentés",
		"Rapport client"
	],
	[
		"Звіт клієнту створено",
		"Client report created",
		null,
		"Raport dla klienta utworzony",
		"Raportul client a fost creat",
		"Ügyféljelentés elkészült",
		"Rapport client créé"
	],
	[
		"Звіт не створено",
		"Report not created",
		null,
		"Raport nie został utworzony",
		"Raportul nu a fost creat",
		"A jelentés nem készült el",
		"Rapport non créé"
	],
	[
		"Завантаження…",
		"Loading…",
		null,
		"Ładowanie…",
		"Se încarcă…",
		"Betöltés…",
		"Chargement…"
	],
	[
		"Немає мережі — список замовлень недоступний",
		"No network — the order list is unavailable",
		null,
		"Brak sieci — lista zamówień niedostępna",
		"Fără rețea — lista comenzilor nu este disponibilă",
		"Nincs hálózat — a rendelések listája nem elérhető",
		"Pas de réseau — liste des commandes indisponible"
	],
	[
		"Список замовлень з телефона",
		"Order list from the phone",
		null,
		"Lista zamówień z telefonu",
		"Lista comenzilor din telefon",
		"Rendelések listája a telefonról",
		"Liste des commandes du téléphone"
	],
	[
		"Продовжити видачу",
		"Continue the issue",
		null,
		"Kontynuuj wydanie",
		"Continuă livrarea",
		"Kiadás folytatása",
		"Continuer la sortie"
	],
	[
		"{s} · {n} з {n} ящ.",
		"{s} · {n} of {n} boxes",
		null,
		"{s} · {n} z {n} kart.",
		"{s} · {n} din {n} cutii",
		"{s} · {n}/{n} doboz",
		"{s} · {n} sur {n} cartons"
	],
	[
		"{n} з {n} ящ.",
		"{n} of {n} boxes",
		null,
		"{n} z {n} kart.",
		"{n} din {n} cutii",
		"{n}/{n} doboz",
		"{n} sur {n} cartons"
	],
	[
		"{n} пал.",
		"{n} pal.",
		null,
		"{n} pal.",
		"{n} pal.",
		"{n} raklap",
		"{n} pal."
	],
	[
		"{n} ящ. · {n} пал.",
		"{n} boxes · {n} pal.",
		null,
		"{n} kart. · {n} pal.",
		"{n} cutii · {n} pal.",
		"{n} doboz · {n} raklap",
		"{n} cartons · {n} pal."
	],
	[
		"{n} ящ.",
		"{n} boxes",
		null,
		"{n} kart.",
		"{n} cutii",
		"{n} doboz",
		"{n} cartons"
	],
	[
		"готово",
		"done",
		null,
		"gotowe",
		"gata",
		"kész",
		"terminé"
	],
	[
		"Немає замовлень на цей день",
		"No orders for this day",
		null,
		"Brak zamówień na ten dzień",
		"Nicio comandă pentru această zi",
		"Nincs rendelés erre a napra",
		"Aucune commande ce jour"
	],
	[
		"Є незавершена видача",
		"An issue is not finished",
		null,
		"Jest niezakończone wydanie",
		"Există o livrare nefinalizată",
		"Van befejezetlen kiadás",
		"Une sortie n’est pas terminée"
	],
	[
		"Збережи або скасуй її спочатку",
		"Save or cancel it first",
		null,
		"Najpierw zapisz lub anuluj",
		"Salveaz-o sau anuleaz-o mai întâi",
		"Előbb mentsd vagy szakítsd meg",
		"Enregistrez-la ou annulez-la d’abord"
	],
	[
		"Лінія {n}",
		"Line {n}",
		null,
		"Linia {n}",
		"Linia {n}",
		"{n}. sor",
		"Ligne {n}"
	],
	[
		"Кількість підтверджено",
		"Quantity confirmed",
		null,
		"Ilość potwierdzona",
		"Cantitate confirmată",
		"Mennyiség megerősítve",
		"Quantité confirmée"
	],
	[
		"Не збережено",
		"Not saved",
		null,
		"Nie zapisano",
		"Nesalvat",
		"Nincs mentve",
		"Non enregistré"
	],
	[
		"права",
		"right",
		null,
		"prawa",
		"dreapta",
		"jobb",
		"droite"
	],
	[
		"ліва",
		"left",
		null,
		"lewa",
		"stânga",
		"bal",
		"gauche"
	],
	[
		"Усе вже відскановано",
		"Everything is scanned already",
		null,
		"Wszystko już zeskanowane",
		"Totul este deja scanat",
		"Már minden be van szkennelve",
		"Tout est déjà scanné"
	],
	[
		"Замовлено {n} ящ.",
		"Ordered {n} boxes",
		null,
		"Zamówiono {n} kart.",
		"Comandate {n} cutii",
		"Megrendelve {n} doboz",
		"Commandé {n} cartons"
	],
	[
		"+{n} без наклейки",
		"+{n} no sticker",
		null,
		"+{n} bez naklejki",
		"+{n} fără etichetă",
		"+{n} matrica nélkül",
		"+{n} sans étiquette"
	],
	[
		"−{n} без наклейки",
		"−{n} no sticker",
		null,
		"−{n} bez naklejki",
		"−{n} fără etichetă",
		"−{n} matrica nélkül",
		"−{n} sans étiquette"
	],
	[
		"Більше, ніж замовлено, на {n} ящ.",
		"More than ordered by {n} boxes",
		null,
		"Więcej niż zamówiono o {n} kart.",
		"Cu {n} cutii mai mult decât comandat",
		"{n} dobozzal több a rendeltnél",
		"{n} cartons de plus que commandé"
	],
	[
		"Зайве не записано",
		"The extra was not recorded",
		null,
		"Nadwyżka nie została zapisana",
		"Surplusul nu a fost înregistrat",
		"A többlet nincs rögzítve",
		"L’excédent n’a pas été enregistré"
	],
	[
		"Замовлення відскановано",
		"Order scanned",
		null,
		"Zamówienie zeskanowane",
		"Comandă scanată",
		"Rendelés beszkennelve",
		"Commande scannée"
	],
	[
		"Перевір підсумок",
		"Check the summary",
		null,
		"Sprawdź podsumowanie",
		"Verifică rezumatul",
		"Ellenőrizd az összesítést",
		"Vérifiez le récapitulatif"
	],
	[
		"Ця лінія вже повна",
		"This line is already full",
		null,
		"Ta linia jest już pełna",
		"Această linie este deja plină",
		"Ez a sor már tele van",
		"Cette ligne est déjà pleine"
	],
	[
		"Натисни ще раз",
		"Tap again",
		null,
		"Naciśnij jeszcze raz",
		"Apasă din nou",
		"Koppints újra",
		"Appuyez encore"
	],
	[
		"Ще нічого не відскановано",
		"Nothing scanned yet",
		null,
		"Nic jeszcze nie zeskanowano",
		"Nimic scanat încă",
		"Még semmi nincs beszkennelve",
		"Rien n’est encore scanné"
	],
	[
		"Видача · {s}",
		"Issue · {s}",
		null,
		"Wydanie · {s}",
		"Livrare · {s}",
		"Kiadás · {s}",
		"Sortie · {s}"
	],
	[
		"{n} ящ. · {n} контейнер",
		"{n} boxes · {n} container",
		null,
		"{n} kart. · {n} kontener",
		"{n} cutii · {n} container",
		"{n} doboz · {n} konténer",
		"{n} cartons · {n} conteneur"
	],
	[
		"{n} ящ. · {n} контейнери",
		"{n} boxes · {n} containers",
		null,
		"{n} kart. · {n} kontenery",
		"{n} cutii · {n} containere",
		"{n} doboz · {n} konténer",
		"{n} cartons · {n} conteneurs"
	],
	[
		"{n} ящ. · {n} контейнерів",
		"{n} boxes · {n} containers",
		null,
		"{n} kart. · {n} kontenerów",
		"{n} cutii · {n} containere",
		"{n} doboz · {n} konténer",
		"{n} cartons · {n} conteneurs"
	],
	[
		"Кількість ліній для сканування",
		"Number of lines to scan",
		null,
		"Liczba linii do skanowania",
		"Numărul de linii de scanat",
		"Szkennelendő sorok száma",
		"Nombre de lignes à scanner"
	],
	[
		"Як сканувати",
		"How to scan",
		null,
		"Jak skanować",
		"Cum se scanează",
		"Hogyan szkennelj",
		"Comment scanner"
	],
	[
		"Серійне сканування",
		"Serial scanning",
		null,
		"Skanowanie seryjne",
		"Scanare în serie",
		"Sorozatszkennelés",
		"Scan en série"
	],
	[
		"камера · +1 за код",
		"camera · +1 per code",
		null,
		"kamera · +1 za kod",
		"cameră · +1 per cod",
		"kamera · kódonként +1",
		"caméra · +1 par code"
	],
	[
		"Введення кількості",
		"Enter quantity",
		null,
		"Wpisywanie ilości",
		"Introducere cantitate",
		"Mennyiség megadása",
		"Saisie de la quantité"
	],
	[
		"код, потім кількість",
		"code, then quantity",
		null,
		"kod, potem ilość",
		"cod, apoi cantitate",
		"kód, majd mennyiség",
		"code, puis quantité"
	],
	[
		"Серійне сканування · кожен код = +1 ящ.",
		"Serial scanning · each code = +1 box",
		null,
		"Skanowanie seryjne · każdy kod = +1 kart.",
		"Scanare în serie · fiecare cod = +1 cutie",
		"Sorozatszkennelés · minden kód = +1 doboz",
		"Scan en série · chaque code = +1 carton"
	],
	[
		"Скануй код, потім вкажи кількість",
		"Scan a code, then enter the quantity",
		null,
		"Zeskanuj kod, potem podaj ilość",
		"Scanează codul, apoi introdu cantitatea",
		"Szkenneld a kódot, majd add meg a mennyiséget",
		"Scannez un code, puis saisissez la quantité"
	],
	[
		"Код",
		"Code",
		null,
		"Kod",
		"Cod",
		"Kód",
		"Code"
	],
	[
		"Додати ·",
		"Add ·",
		null,
		"Dodaj ·",
		"Adaugă ·",
		"Hozzáad ·",
		"Ajouter ·"
	],
	[
		"палета",
		"pallet",
		null,
		"paleta",
		"palet",
		"raklap",
		"palette"
	],
	[
		"решта лінії",
		"rest of line",
		null,
		"reszta linii",
		"restul liniei",
		"sor maradéka",
		"reste de la ligne"
	],
	[
		"решта",
		"rest",
		null,
		"reszta",
		"restul",
		"maradék",
		"reste"
	],
	[
		"{n} з {n} ящ. · Лінія {n}",
		"{n} of {n} boxes · Line {n}",
		null,
		"{n} z {n} kart. · Linia {n}",
		"{n} din {n} cutii · Linia {n}",
		"{n}/{n} doboz · {n}. sor",
		"{n} sur {n} cartons · Ligne {n}"
	],
	[
		"{n} з {n} ящ. · Лінія {n} · ліва",
		"{n} of {n} boxes · Line {n} · left",
		null,
		"{n} z {n} kart. · Linia {n} · lewa",
		"{n} din {n} cutii · Linia {n} · stânga",
		"{n}/{n} doboz · {n}. sor · bal",
		"{n} sur {n} cartons · Ligne {n} · gauche"
	],
	[
		"{n} з {n} ящ. · Лінія {n} · права",
		"{n} of {n} boxes · Line {n} · right",
		null,
		"{n} z {n} kart. · Linia {n} · prawa",
		"{n} din {n} cutii · Linia {n} · dreapta",
		"{n}/{n} doboz · {n}. sor · jobb",
		"{n} sur {n} cartons · Ligne {n} · droite"
	],
	[
		"Ввести кількість",
		"Enter quantity",
		null,
		"Wpisz ilość",
		"Introdu cantitatea",
		"Mennyiség megadása",
		"Saisir la quantité"
	],
	[
		"Кількість",
		"Quantity",
		null,
		"Ilość",
		"Cantitate",
		"Mennyiség",
		"Quantité"
	],
	[
		"Спершу відскануй код",
		"Scan a code first",
		null,
		"Najpierw zeskanuj kod",
		"Scanează mai întâi un cod",
		"Előbb szkennelj be egy kódot",
		"Scannez d’abord un code"
	],
	[
		"{s} · залишок у коморах невідомий",
		"{s} · stock in chambers unknown",
		null,
		"{s} · stan w komorach nieznany",
		"{s} · stoc în camere necunoscut",
		"{s} · kamrakészlet ismeretlen",
		"{s} · stock en chambres inconnu"
	],
	[
		"{s} · більше, ніж є в коморах, на",
		"{s} · more than in the chambers by",
		null,
		"{s} · więcej niż w komorach o",
		"{s} · mai mult decât în camere cu",
		"{s} · több, mint a kamrákban, ennyivel:",
		"{s} · plus qu’en chambres de"
	],
	[
		"{s} · у коморах залишиться",
		"{s} · left in the chambers:",
		null,
		"{s} · w komorach zostanie",
		"{s} · în camere rămân",
		"{s} · a kamrákban marad",
		"{s} · restera en chambres"
	],
	[
		"{s} · перевіряю залишок…",
		"{s} · checking stock…",
		null,
		"{s} · sprawdzam stan…",
		"{s} · verific stocul…",
		"{s} · készlet ellenőrzése…",
		"{s} · vérification du stock…"
	],
	[
		"Більше, ніж залишок у контейнері",
		"More than left in the container",
		null,
		"Więcej niż zostało w kontenerze",
		"Mai mult decât a rămas în container",
		"Több, mint ami a konténerben maradt",
		"Plus que le reste du conteneur"
	],
	[
		"{s}: у коморах {n} ящ.",
		"{s}: {n} boxes in the chambers",
		null,
		"{s}: w komorach {n} kart.",
		"{s}: {n} cutii în camere",
		"{s}: {n} doboz a kamrákban",
		"{s} : {n} cartons en chambres"
	],
	[
		"залишиться {n}",
		"{n} will remain",
		null,
		"zostanie {n}",
		"rămân {n}",
		"marad {n}",
		"reste {n}"
	],
	[
		"Не все списано з комор",
		"Not everything taken out of the chambers",
		null,
		"Nie wszystko zdjęto z komór",
		"Nu totul a fost scos din camere",
		"Nem minden lett levonva a kamrákból",
		"Tout n’a pas été retiré des chambres"
	],
	[
		"{s}: контейнер не підібрати",
		"{s}: cannot pick the container",
		null,
		"{s}: nie można dobrać kontenera",
		"{s}: containerul nu poate fi ales",
		"{s}: a konténer nem választható",
		"{s} : conteneur introuvable"
	],
	[
		"Немає контейнера з кольором клієнта",
		"No container in the client’s colour",
		null,
		"Brak kontenera w kolorze klienta",
		"Niciun container în culoarea clientului",
		"Nincs konténer az ügyfél színében",
		"Aucun conteneur à la couleur du client"
	],
	[
		"Не знайдено в залишку",
		"Not found in stock",
		null,
		"Nie znaleziono w stanie",
		"Nu a fost găsit în stoc",
		"Nem található a készletben",
		"Introuvable dans le stock"
	],
	[
		"комора {n} {s}",
		"chamber {n} {s}",
		null,
		"komora {n} {s}",
		"camera {n} {s}",
		"{n}. kamra {s}",
		"chambre {n} {s}"
	],
	[
		"Ящики без номера контейнера",
		"Boxes without a container number",
		null,
		"Kartony bez numeru kontenera",
		"Cutii fără număr de container",
		"Konténerszám nélküli dobozok",
		"Cartons sans numéro de conteneur"
	],
	[
		"З якої комори",
		"From which chamber",
		null,
		"Z której komory",
		"Din ce cameră",
		"Melyik kamrából",
		"De quelle chambre"
	],
	[
		"Код плантації (якщо видно)",
		"Plantation code (if readable)",
		null,
		"Kod plantacji (jeśli widoczny)",
		"Codul plantației (dacă se vede)",
		"Ültetvénykód (ha olvasható)",
		"Code de plantation (si lisible)"
	],
	[
		"напр. BAN215",
		"e.g. BAN215",
		null,
		"np. BAN215",
		"ex. BAN215",
		"pl. BAN215",
		"ex. BAN215"
	],
	[
		"Підібрати контейнер",
		"Find the container",
		null,
		"Dobierz kontener",
		"Găsește containerul",
		"Konténer keresése",
		"Trouver le conteneur"
	],
	[
		"Додати без номера",
		"Add without a number",
		null,
		"Dodaj bez numeru",
		"Adaugă fără număr",
		"Hozzáadás szám nélkül",
		"Ajouter sans numéro"
	],
	[
		"Вкажи комору або код плантації",
		"Enter the chamber or the plantation code",
		null,
		"Podaj komorę lub kod plantacji",
		"Introdu camera sau codul plantației",
		"Add meg a kamrát vagy az ültetvénykódot",
		"Indiquez la chambre ou le code de plantation"
	],
	[
		"Додай без номера — підбір пізніше неможливий",
		"Add without a number — no matching offline",
		null,
		"Dodaj bez numeru — dobór offline niemożliwy",
		"Adaugă fără număr — potrivirea offline nu e posibilă",
		"Add hozzá szám nélkül — offline nincs keresés",
		"Ajoutez sans numéro — pas de recherche hors ligne"
	],
	[
		"Колір клієнта",
		"Client colour",
		null,
		"Kolor klienta",
		"Culoarea clientului",
		"Ügyfél színe",
		"Couleur du client"
	],
	[
		"колір {s}",
		"colour {s}",
		null,
		"kolor {s}",
		"culoare {s}",
		"szín {s}",
		"couleur {s}"
	],
	[
		"залишок {n}",
		"left {n}",
		null,
		"zostało {n}",
		"rămas {n}",
		"maradt {n}",
		"reste {n}"
	],
	[
		"колір не підходить",
		"colour does not fit",
		null,
		"kolor nie pasuje",
		"culoarea nu se potrivește",
		"a szín nem megfelelő",
		"la couleur ne convient pas"
	],
	[
		"Стікери",
		"Stickers",
		null,
		"Etykiety",
		"Etichete",
		"Matricák",
		"Étiquettes"
	],
	[
		"Комора",
		"Chamber",
		null,
		"Komora",
		"Cameră",
		"Kamra",
		"Chambre"
	],
	[
		"Шаблон",
		"Template",
		null,
		"Szablon",
		"Șablon",
		"Sablon",
		"Modèle"
	],
	[
		"(автоматично)",
		"(automatic)",
		null,
		"(automatycznie)",
		"(automat)",
		"(automatikus)",
		"(automatique)"
	],
	[
		"Кількість стікерів",
		"Number of stickers",
		null,
		"Liczba etykiet",
		"Număr de etichete",
		"Matricák száma",
		"Nombre d’étiquettes"
	],
	[
		"Друкувати",
		"Print",
		null,
		"Drukuj",
		"Tipărește",
		"Nyomtatás",
		"Imprimer"
	],
	[
		"У коморі немає товару",
		"No stock in this chamber",
		null,
		"Brak towaru w komorze",
		"Nu e marfă în cameră",
		"Nincs áru a kamrában",
		"Pas de stock dans la chambre"
	],
	[
		"Колір у коморі не підходить клієнту — перевір",
		"The colour in the chamber does not fit the client — check",
		null,
		"Kolor w komorze nie pasuje klientowi — sprawdź",
		"Culoarea din cameră nu se potrivește clientului — verifică",
		"A kamra színe nem felel meg az ügyfélnek — ellenőrizd",
		"La couleur de la chambre ne convient pas au client — vérifiez"
	],
	[
		"Код плантації невідомий — введи його",
		"Plantation code unknown — enter it",
		null,
		"Kod plantacji nieznany — wpisz go",
		"Codul plantației necunoscut — introdu-l",
		"Ismeretlen ültetvénykód — add meg",
		"Code de plantation inconnu — saisissez-le"
	],
	[
		"Плантації немає в даних GGN",
		"The plantation is not in the GGN data",
		null,
		"Plantacji nie ma w danych GGN",
		"Plantația nu e în datele GGN",
		"Az ültetvény nincs a GGN-adatokban",
		"La plantation n’est pas dans les données GGN"
	],
	[
		"Немає шаблону для цього клієнта — вибери",
		"No template for this client — pick one",
		null,
		"Brak szablonu dla klienta — wybierz",
		"Niciun șablon pentru client — alege unul",
		"Nincs sablon ehhez az ügyfélhez — válassz",
		"Aucun modèle pour ce client — choisissez"
	],
	[
		"Бракує: {s}",
		"Missing: {s}",
		null,
		"Brakuje: {s}",
		"Lipsește: {s}",
		"Hiányzik: {s}",
		"Manque : {s}"
	],
	[
		"Надруковано {n} стікерів",
		"{n} stickers printed",
		null,
		"Wydrukowano {n} etykiet",
		"{n} etichete tipărite",
		"{n} matrica kinyomtatva",
		"{n} étiquettes imprimées"
	],
	[
		"Стікери не надруковано",
		"Stickers not printed",
		null,
		"Etykiety nie wydrukowane",
		"Etichetele nu au fost tipărite",
		"A matricák nincsenek kinyomtatva",
		"Étiquettes non imprimées"
	],
	[
		"плантація {s}",
		"plantation {s}",
		null,
		"plantacja {s}",
		"plantația {s}",
		"ültetvény {s}",
		"plantation {s}"
	],
	[
		"Зберегти GLN",
		"Save GLN",
		null,
		"Zapisz GLN",
		"Salvează GLN",
		"GLN mentése",
		"Enregistrer le GLN"
	],
	[
		"GLN з файлу GGN",
		"GLN from the GGN file",
		null,
		"GLN z pliku GGN",
		"GLN din fișierul GGN",
		"GLN a GGN-fájlból",
		"GLN du fichier GGN"
	],
	[
		"GLN, збережений раніше",
		"GLN saved earlier",
		null,
		"GLN zapisany wcześniej",
		"GLN salvat anterior",
		"Korábban mentett GLN",
		"GLN enregistré auparavant"
	],
	[
		"GLN з налаштувань",
		"GLN from the settings",
		null,
		"GLN z ustawień",
		"GLN din setări",
		"GLN a beállításokból",
		"GLN des paramètres"
	],
	[
		"Стандартний GLN шаблону — перевір постачальника",
		"Template default GLN — check the supplier",
		null,
		"Domyślny GLN szablonu — sprawdź dostawcę",
		"GLN implicit al șablonului — verifică furnizorul",
		"A sablon alapértelmezett GLN-je — ellenőrizd a szállítót",
		"GLN par défaut du modèle — vérifiez le fournisseur"
	],
	[
		"GLN немає — введи його",
		"No GLN — enter it",
		null,
		"Brak GLN — wpisz go",
		"Lipsește GLN — introdu-l",
		"Nincs GLN — add meg",
		"Pas de GLN — saisissez-le"
	],
	[
		"GLN — 13 цифр",
		"GLN — 13 digits",
		null,
		"GLN — 13 cyfr",
		"GLN — 13 cifre",
		"GLN — 13 számjegy",
		"GLN — 13 chiffres"
	],
	[
		"GLN збережено",
		"GLN saved",
		null,
		"GLN zapisany",
		"GLN salvat",
		"GLN mentve",
		"GLN enregistré"
	],
	[
		"GLN не збережено",
		"GLN not saved",
		null,
		"GLN nie zapisany",
		"GLN nesalvat",
		"GLN nincs mentve",
		"GLN non enregistré"
	],
	[
		"Надруковано для цього замовлення",
		"Printed for this order",
		null,
		"Wydrukowano dla tego zamówienia",
		"Tipărit pentru această comandă",
		"Ehhez a rendeléshez nyomtatva",
		"Imprimé pour cette commande"
	],
	[
		"Пошкодження",
		"Damage",
		null,
		"Uszkodzenia",
		"Deteriorări",
		"Sérülések",
		"Dommages"
	],
	[
		"Не вибрано",
		"Nothing chosen",
		null,
		"Nie wybrano",
		"Nimic ales",
		"Nincs kiválasztva",
		"Rien de choisi"
	],
	[
		"Вибрати дефекти",
		"Choose defects",
		null,
		"Wybierz wady",
		"Alege defectele",
		"Hibák kiválasztása",
		"Choisir les défauts"
	],
	[
		"Фото",
		"Photo",
		null,
		"Zdjęcie",
		"Fotografie",
		"Fotó",
		"Photo"
	],
	[
		"Фото до дефекту",
		"Photo for defect",
		null,
		"Zdjęcie do wady",
		"Fotografie pentru defect",
		"Fotó a hibához",
		"Photo pour le défaut"
	],
	[
		"Загальне фото",
		"General photo",
		null,
		"Zdjęcie ogólne",
		"Fotografie generală",
		"Általános fotó",
		"Photo générale"
	],
	[
		"Довідник недоступний",
		"Reference not available",
		null,
		"Katalog niedostępny",
		"Ghidul nu este disponibil",
		"A katalógus nem érhető el",
		"Référentiel indisponible"
	],
	[
		"Фото збережено",
		"Photo saved",
		null,
		"Zdjęcie zapisane",
		"Fotografie salvată",
		"Fotó mentve",
		"Photo enregistrée"
	],
	[
		"Фото не збережено",
		"Photo not saved",
		null,
		"Zdjęcie nie zapisane",
		"Fotografia nu a fost salvată",
		"A fotó nincs mentve",
		"Photo non enregistrée"
	],
	[
		"Немає мережі — спробуй ще раз",
		"No network — try again",
		null,
		"Brak sieci — spróbuj ponownie",
		"Fără rețea — încearcă din nou",
		"Nincs hálózat — próbáld újra",
		"Pas de réseau — réessayez"
	],
	[
		"Межа",
		"Limit",
		null,
		"Granica",
		"Limită",
		"Határ",
		"Limite"
	],
	[
		"Закрити",
		"Close",
		null,
		"Zamknij",
		"Închide",
		"Bezárás",
		"Fermer"
	],
	[
		"Пораховано при прийомі",
		"Counted at receiving",
		null,
		"Policzone przy przyjęciu",
		"Numărate la recepție",
		"Átvételkor megszámolva",
		"Comptés à la réception"
	],
	[
		"невідповідних",
		"non-conforming",
		null,
		"niezgodnych",
		"neconforme",
		"nem megfelelő",
		"non conformes"
	],
	[
		"Контейнер не знайдено в реєстрі",
		"Container not found in the register",
		null,
		"Nie znaleziono kontenera w rejestrze",
		"Containerul nu a fost găsit în registru",
		"A konténer nincs a nyilvántartásban",
		"Conteneur introuvable dans le registre"
	],
	[
		"Пошкоджень при прийомі не записано",
		"No damage recorded at receiving",
		null,
		"Nie zapisano uszkodzeń przy przyjęciu",
		"Nicio deteriorare înregistrată la recepție",
		"Átvételkor nem rögzítettek sérülést",
		"Aucun dommage enregistré à la réception"
	],
	[
		"Знайдені дефекти",
		"Defects found",
		null,
		"Znalezione wady",
		"Defecte găsite",
		"Talált hibák",
		"Défauts trouvés"
	],
	[
		"Які пошкодження?",
		"What damage?",
		null,
		"Jakie uszkodzenia?",
		"Ce deteriorări?",
		"Milyen sérülések?",
		"Quels dommages ?"
	],
	[
		"Довідник",
		"Reference",
		null,
		"Katalog",
		"Ghid",
		"Katalógus",
		"Référentiel"
	],
	[
		"Довідник дефектів",
		"Defect reference",
		null,
		"Katalog wad",
		"Ghidul defectelor",
		"Hibakatalógus",
		"Référentiel des défauts"
	],
	[
		"Усі",
		"All",
		null,
		"Wszystkie",
		"Toate",
		"Mind",
		"Tous"
	],
	[
		"Пошук дефекту",
		"Search a defect",
		null,
		"Szukaj wady",
		"Caută un defect",
		"Hiba keresése",
		"Rechercher un défaut"
	],
	[
		"Фото ще немає — їх додають при прийомі",
		"No photos yet — they are added at receiving",
		null,
		"Brak zdjęć — dodaje się je przy przyjęciu",
		"Încă nu există fotografii — se adaugă la recepție",
		"Még nincs fotó — átvételkor adják hozzá",
		"Pas encore de photos — elles sont ajoutées à la réception"
	],
	[
		"Нічого не знайдено",
		"Nothing found",
		null,
		"Nic nie znaleziono",
		"Nimic găsit",
		"Nincs találat",
		"Rien trouvé"
	],
	[
		"газування {s}",
		"gas day {s}",
		null,
		"gazowanie {s}",
		"gazare {s}",
		"gázosítás: {s}",
		"gazage {s}"
	],
	[
		"без дня газування",
		"no gas day",
		null,
		"bez dnia gazowania",
		"fără zi de gazare",
		"gázosítási nap nélkül",
		"sans jour de gazage"
	],
	[
		"Останній: {s}",
		"Last: {s}",
		null,
		"Ostatni: {s}",
		"Ultima: {s}",
		"Utolsó: {s}",
		"Dernière : {s}"
	],
	[
		"ранок",
		"morning",
		null,
		"rano",
		"dimineața",
		"reggel",
		"matin"
	],
	[
		"вечір",
		"evening",
		null,
		"wieczór",
		"seara",
		"este",
		"soir"
	],
	[
		"Скануй контейнер, щоб перемістити або списати.",
		"Scan a container to move or write it off.",
		null,
		"Zeskanuj kontener, aby przenieść lub odpisać.",
		"Scanează un container pentru a-l muta sau scoate din stoc.",
		"Szkenneld a konténert az áthelyezéshez vagy leíráshoz.",
		"Scannez un conteneur pour le déplacer ou le sortir."
	],
	[
		"Відвантаження",
		"Outbound",
		null,
		"Wydanie",
		"Livrare",
		"Kiszállítás",
		"Expédition"
	]
];
//#endregion
//#region src/components/services/i18n/dict.js
var dict_default = [
	...dict_shell_default,
	...dict_pages_default,
	...dict_scanner_default
];
//#endregion
//#region src/components/services/i18n.js
var PACKS = [{
	code: "de",
	label: "Deutsch",
	locale: "de-DE",
	dict: {
		"Today": "Heute",
		"Chambers": "Kammern",
		"Plan Week": "Wochenplan",
		"Ripening Plan": "Reifeplan",
		"Stock": "Bestand",
		"Reports": "Berichte",
		"Scanner": "Scanner",
		"Receiving": "Wareneingang",
		"Outbound": "Warenausgang",
		"Rounds": "Rundgang",
		"Settings": "Einstellungen",
		"Main": "Hauptmenü",
		"Menu": "Menü",
		"Close menu": "Menü schließen",
		"Sign out": "Abmelden",
		"Language": "Sprache",
		"{n} chambers": "{n} Kammern",
		"{s} · {n} chambers": "{s} · {n} Kammern",
		"Admin": "Admin",
		"Logistics": "Logistik",
		"Ripener": "Reifer",
		"Quality": "Qualität",
		"you": "du",
		"Example data.": "Beispieldaten.",
		"This page is not connected to the server yet — the numbers below are not real.": "Diese Seite ist noch nicht mit dem Server verbunden — die Zahlen unten sind nicht echt.",
		"Loading…": "Wird geladen…",
		"Close": "Schließen",
		"Save": "Speichern",
		"Saved": "Gespeichert",
		"Cancel": "Abbrechen",
		"Done": "Fertig",
		"Edit": "Bearbeiten",
		"Open": "Öffnen",
		"View": "Ansehen",
		"Review": "Prüfen",
		"All": "Alle",
		"Date": "Datum",
		"Day": "Tag",
		"Week": "Woche",
		"Total": "Gesamt",
		"Product": "Produkt",
		"Boxes": "Kartons",
		"boxes": "Kartons",
		"Containers": "Container",
		"Choose file": "Datei wählen",
		"Drop": "Ablegen",
		"here": "hier",
		"{n} KB · ready": "{n} KB · bereit",
		"Wrong file. Expected {s}": "Falsche Datei. Erwartet: {s}",
		"Banana": "Banane",
		"Pineapple": "Ananas",
		"Market": "Markt",
		"BIO market": "BIO-Markt",
		"Empty": "Leer",
		"Mon": "Mo",
		"Tue": "Di",
		"Wed": "Mi",
		"Thu": "Do",
		"Fri": "Fr",
		"Sat": "Sa",
		"Sun": "So",
		"Mon {s}": "Mo {s}",
		"Tue {s}": "Di {s}",
		"Wed {s}": "Mi {s}",
		"Thu {s}": "Do {s}",
		"Fri {s}": "Fr {s}",
		"Sat {s}": "Sa {s}",
		"Sun {s}": "So {s}",
		"Not in the demo": "Nicht in der Demo",
		"Files are made by the Banana Report server.": "Die Dateien erstellt der Banana-Report-Server.",
		"Open the file in the app instead — downloads come from the server.": "Öffne die Datei stattdessen in der App — Downloads kommen vom Server.",
		"No connection to the server": "Keine Verbindung zum Server",
		"Server problem": "Serverproblem",
		"Check the Wi-Fi and try again.": "Prüfe das WLAN und versuche es erneut.",
		"The server answered {n}. Try again in a minute.": "Der Server antwortete {n}. Versuche es in einer Minute erneut.",
		"Try again": "Erneut versuchen",
		"No access": "Kein Zugriff",
		"Your role ({s}) has no page in this app yet. Ask the administrator.": "Deine Rolle ({s}) hat in dieser App noch keine Seite. Frag den Administrator.",
		"Sent to the printer": "An den Drucker gesendet",
		"Not printed": "Nicht gedruckt",
		"Printer": "Drucker",
		"Not saved": "Nicht gespeichert",
		"Хто на зміні?": "Wer hat Schicht?",
		"Обери себе, щоб увійти": "Wähle dich aus, um dich anzumelden",
		"останній": "zuletzt",
		"Введи PIN": "PIN eingeben",
		"Введи PIN · {n} цифри": "PIN eingeben · {n} Ziffern",
		"Введи PIN · {n} цифр": "PIN eingeben · {n} Ziffern",
		"Доступ надано": "Zugriff gewährt",
		"Очистити": "Löschen",
		"Забув PIN? Його скидає адміністратор.": "PIN vergessen? Der Administrator setzt sie zurück.",
		"Обрати іншого користувача": "Anderen Benutzer wählen",
		"PIN-код": "PIN-Code",
		"PIN-код, введено {n} з {n}": "PIN-Code, {n} von {n} eingegeben",
		"Стерти цифру": "Ziffer löschen",
		"Вхід": "Anmelden",
		"Перевірка…": "Wird geprüft…",
		"Вітаємо, {s}!": "Willkommen, {s}!",
		"Невірний PIN": "Falsche PIN",
		"Невірний PIN. Залишилось {n} спроба": "Falsche PIN. Verbleibende Versuche: {n}",
		"Невірний PIN. Залишилось {n} спроби": "Falsche PIN. Verbleibende Versuche: {n}",
		"Невірний PIN. Залишилось {n} спроб": "Falsche PIN. Verbleibende Versuche: {n}",
		"Немає зв’язку з сервером. Спробуй ще раз.": "Keine Verbindung zum Server. Versuche es erneut.",
		"Немає зв’язку з сервером. Перевір Wi-Fi і онови сторінку.": "Keine Verbindung zum Server. Prüfe das WLAN und lade die Seite neu.",
		"Ще немає жодного користувача. На комп’ютері із сервером виконай: npm run create-admin -- \"Ім’я\" — і онови сторінку.": "Es gibt noch keine Benutzer. Führe auf dem Server-Computer aus: npm run create-admin -- \"Name\" — und lade die Seite neu.",
		"Не вдалося завантажити користувачів.": "Die Benutzer konnten nicht geladen werden.",
		"Забагато спроб з цього телефона. Зачекай 15 хвилин.": "Zu viele Versuche von diesem Telefon. Warte 15 Minuten.",
		"Забагато спроб. Спробуй через {s} або звернись до адміністратора": "Zu viele Versuche. Versuche es in {s} erneut oder wende dich an den Administrator",
		"Users & roles": "Benutzer & Rollen",
		"Users and roles": "Benutzer und Rollen",
		"Who can sign in, with which PIN, and what each role is allowed to do.": "Wer sich mit welcher PIN anmelden kann und was jede Rolle darf.",
		"Add user": "Benutzer hinzufügen",
		"Edit user": "Benutzer bearbeiten",
		"Users": "Benutzer",
		"Roles": "Rollen",
		"User": "Benutzer",
		"Role": "Rolle",
		"PIN": "PIN",
		"Last sign-in": "Letzte Anmeldung",
		"Actions": "Aktionen",
		"{n} digits": "{n} Ziffern",
		"Yesterday {s}": "Gestern {s}",
		"Today {s}": "Heute {s}",
		"Never": "Nie",
		"Active": "Aktiv",
		"Disabled": "Deaktiviert",
		"Locked · {s}": "Gesperrt · {s}",
		"Unlock": "Entsperren",
		"What each role can do": "Was jede Rolle darf",
		"The server checks these permissions on every action. Hiding a button is not enough.": "Der Server prüft diese Rechte bei jeder Aktion. Einen Button auszublenden reicht nicht.",
		"New role": "Neue Rolle",
		"Permission": "Berechtigung",
		"1 user": "1 Benutzer",
		"{n} users": "{n} Benutzer",
		"Overview": "Übersicht",
		"Planning": "Planung",
		"Stock & reports": "Bestand & Berichte",
		"Administration": "Verwaltung",
		"See Today dashboard": "Heute-Übersicht sehen",
		"See chamber map": "Kammerplan sehen",
		"Set gas day": "Begasungstag setzen",
		"Move or write off boxes": "Kartons umlagern oder abschreiben",
		"Upload transport & sales plan": "Transport- & Verkaufsplan hochladen",
		"Generate ripening plan": "Reifeplan erstellen",
		"Fill stock day": "Bestandstag füllen",
		"Reconcile stock file": "Bestandsdatei abgleichen",
		"Download reports": "Berichte herunterladen",
		"Receive containers": "Container annehmen",
		"Scan shipments": "Sendungen scannen",
		"Market & garbage pallets": "Markt- & Abfallpaletten",
		"Manage users & roles": "Benutzer & Rollen verwalten",
		"Edit settings": "Einstellungen bearbeiten",
		"Admin always has every permission, so the system can't lose its administrator.": "Admin hat immer alle Rechte, damit das System seinen Administrator nicht verliert.",
		"Name on the sign-in screen": "Name auf dem Anmeldebildschirm",
		"First name + initial is enough. Shown on the login tiles.": "Vorname + Initiale reicht. Wird auf den Anmeldekacheln angezeigt.",
		"Roles that can manage users get a 6-digit PIN, everyone else 4 digits.": "Rollen, die Benutzer verwalten, bekommen eine 6-stellige PIN, alle anderen 4 Ziffern.",
		"Reset PIN": "PIN zurücksetzen",
		"Click again to reset": "Zum Zurücksetzen erneut klicken",
		"The PIN is created when you save and shown here once.": "Die PIN wird beim Speichern erstellt und hier einmal angezeigt.",
		"Write it down now and give it to the person. After closing, nobody can see this PIN again, only reset it.": "Schreib sie jetzt auf und gib sie der Person. Nach dem Schließen kann niemand diese PIN mehr sehen, nur zurücksetzen.",
		"Access": "Zugriff",
		"Disabled users can't sign in. Their history stays, so we never delete people.": "Deaktivierte Benutzer können sich nicht anmelden. Ihre Historie bleibt, deshalb löschen wir nie Personen.",
		"Disable user": "Benutzer deaktivieren",
		"Enable user": "Benutzer aktivieren",
		"Create user": "Benutzer anlegen",
		"Save changes": "Änderungen speichern",
		"Save roles": "Rollen speichern",
		"1 unsaved change": "1 ungespeicherte Änderung",
		"{n} unsaved changes": "{n} ungespeicherte Änderungen",
		"e.g. Олег М.": "z. B. Olaf M.",
		"No connection to the server. Check the network and reload.": "Keine Verbindung zum Server. Prüfe das Netzwerk und lade neu.",
		"Could not load users ({s}).": "Benutzer konnten nicht geladen werden ({s}).",
		"{s} unlocked": "{s} entsperrt",
		"{s} added": "{s} hinzugefügt",
		"Give them the PIN shown in the panel.": "Gib ihnen die im Panel angezeigte PIN.",
		"Saved · {s}": "Gespeichert · {s}",
		"{s} has a new {n}-digit PIN": "{s} hat eine neue {n}-stellige PIN",
		"Their role needs a longer PIN.": "Ihre Rolle braucht eine längere PIN.",
		"New PIN for {s}": "Neue PIN für {s}",
		"The old PIN no longer works.": "Die alte PIN funktioniert nicht mehr.",
		"{s} can no longer sign in": "{s} kann sich nicht mehr anmelden",
		"{s} can sign in again": "{s} kann sich wieder anmelden",
		"This is the last administrator": "Das ist der letzte Administrator",
		"Roles saved": "Rollen gespeichert",
		"People with changed roles sign in again to get them.": "Personen mit geänderten Rollen melden sich neu an, um sie zu erhalten.",
		"Chamber {n}: {n} + {n} > {n}": "Kammer {n}: {n} + {n} > {n}",
		"chamber must be 1–29": "Kammer muss 1–29 sein",
		"target chamber must be 1–29": "Zielkammer muss 1–29 sein",
		"side must be LS or RS": "Seite muss LS oder RS sein",
		"boxes must be a positive whole number": "Kartons müssen eine positive ganze Zahl sein",
		"qty must be a positive whole number": "Menge muss eine positive ganze Zahl sein",
		"Only {n} boxes of {s} in chamber {n}": "Nur {n} Kartons von {s} in Kammer {n}",
		"Container {s} not received": "Container {s} nicht angenommen",
		"boxCounts is empty": "boxCounts ist leer",
		"planDate must be YYYY-MM-DD or null": "planDate muss JJJJ-MM-TT oder null sein",
		"Expected the Sales Plan (sales…xlsx)": "Erwartet wird der Verkaufsplan (sales…xlsx)",
		"File name must be PLAN_week_N.xlsx": "Dateiname muss PLAN_week_N.xlsx sein",
		"Підключення до сервера": "Verbindung zum Server",
		"Відскануй QR-код на комп’ютері із сервером — той самий, з якого завантажував аплікацію.": "Scanne den QR-Code am Server-Computer — denselben, über den du die App heruntergeladen hast.",
		"Сканувати QR-код": "QR-Code scannen",
		"або введи адресу вручну": "oder gib die Adresse von Hand ein",
		"Наведи камеру на QR-код на екрані комп’ютера": "Richte die Kamera auf den QR-Code am Bildschirm des Computers",
		"Це не QR-код сервера Yellow WMS": "Das ist kein QR-Code eines Yellow-WMS-Servers",
		"На цьому телефоні сканування недоступне. Введи адресу вручну.": "Scannen ist auf diesem Telefon nicht verfügbar. Gib die Adresse von Hand ein.",
		"Камера недоступна. Введи адресу вручну.": "Die Kamera ist nicht verfügbar. Gib die Adresse von Hand ein.",
		"Адреса сервера": "Serveradresse",
		"Підключити": "Verbinden",
		"Сервер:": "Server:",
		"змінити": "ändern",
		"Сервер {s} не відповідає. Перевір адресу і що телефон у тій самій Wi-Fi мережі.": "Server {s} antwortet nicht. Prüfe die Adresse und ob das Telefon im selben WLAN ist.",
		"Пристрій ще не підключений": "Dieses Gerät ist noch nicht verbunden",
		"Ти зараз поза мережею складу. Введи код підключення від адміністратора (Користувачі → Пристрої) або один раз увійди через Wi-Fi складу.": "Du bist außerhalb des Lagernetzes. Gib einen Kopplungscode vom Administrator ein (Benutzer → Geräte) oder melde dich einmal im Lager-WLAN an.",
		"Код підключення": "Kopplungscode",
		"Назва пристрою (необов’язково)": "Gerätename (optional)",
		"Підключити пристрій": "Gerät verbinden",
		"Забагато спроб. Зачекай 15 хвилин.": "Zu viele Versuche. Warte 15 Minuten.",
		"Немає зв’язку з сервером. Перевір інтернет.": "Keine Verbindung zum Server. Prüfe das Internet.",
		"Код неправильний, уже використаний або прострочений.": "Der Code ist falsch, bereits benutzt oder abgelaufen.",
		"Телефон Петра": "Peters Telefon",
		"Devices": "Geräte",
		"Trusted devices": "Vertrauenswürdige Geräte",
		"Outside the warehouse network (mobile data, ngrok) only these devices can open the app, and still with a PIN. A phone becomes trusted after one sign-in on the warehouse Wi-Fi, or with a one-time code.": "Außerhalb des Lagernetzes (mobile Daten, ngrok) können nur diese Geräte die App öffnen, und auch dann mit PIN. Ein Telefon wird nach einer Anmeldung im Lager-WLAN oder mit einem Einmalcode vertrauenswürdig.",
		"Pairing code": "Kopplungscode",
		"Enter this code on the phone (sign-in screen → «Код підключення»). Works once, for 10 minutes.": "Gib diesen Code auf dem Telefon ein (Anmeldebildschirm → «Код підключення»). Funktioniert einmal, 10 Minuten lang.",
		"Valid for {s}": "Gültig für {s}",
		"Expired — make a new one": "Abgelaufen — erstelle einen neuen",
		"From outside: trusted device + PIN. On the warehouse network: as before.": "Von außen: vertrauenswürdiges Gerät + PIN. Im Lagernetz: wie bisher.",
		"From outside: PIN only (REMOTE_ACCESS=login). Trusted devices are not required.": "Von außen: nur PIN (REMOTE_ACCESS=login). Vertrauenswürdige Geräte sind nicht nötig.",
		"Device": "Gerät",
		"Added": "Hinzugefügt",
		"Last seen": "Zuletzt gesehen",
		"Remove": "Entfernen",
		"{s} · code": "{s} · Code",
		"{s} · warehouse Wi-Fi": "{s} · Lager-WLAN",
		"No trusted devices yet.": "Noch keine vertrauenswürdigen Geräte.",
		"Open sessions": "Offene Sitzungen",
		"Who is signed in right now and from where. Signing a session out ends it at once.": "Wer gerade angemeldet ist und von wo. Eine Sitzung abzumelden beendet sie sofort.",
		"Signed in": "Angemeldet",
		"Expires": "Läuft ab",
		"Outside · {s}": "Außen · {s}",
		"Warehouse network · {s}": "Lagernetz · {s}",
		"Outside": "Außen",
		"Warehouse network": "Lagernetz",
		"Nobody is signed in.": "Niemand ist angemeldet.",
		"Device removed": "Gerät entfernt",
		"It needs a new code or the warehouse Wi-Fi to come back.": "Es braucht einen neuen Code oder das Lager-WLAN, um zurückzukommen.",
		"Session ended": "Sitzung beendet",
		"Backups": "Sicherungen",
		"Back up now": "Jetzt sichern",
		"Backup made": "Sicherung erstellt",
		"No backups yet.": "Noch keine Sicherungen.",
		"Last: {s} · {s} · {n} kept ({n} days) in the backups folder": "Zuletzt: {s} · {s} · {n} aufbewahrt ({n} Tage) im Sicherungsordner",
		"Назва (необов’язково)": "Name (optional)",
		"Робота": "Arbeit",
		"Скасувати": "Abbrechen",
		"Сервер": "Server",
		"додати": "hinzufügen",
		"прибрати": "entfernen",
		"Є нова версія аплікації — встановити": "Neue App-Version verfügbar — installieren",
		"{s} · data as of {s}": "{s} · Daten vom {s}",
		"Download Total": "Gesamt herunterladen",
		"Generate Ripening Plan": "Reifeplan erstellen",
		"Needed": "Benötigt",
		"Sales Plan · boxes": "Verkaufsplan · Kartons",
		"no Sales Plan for this week": "kein Verkaufsplan für diese Woche",
		"Ordered": "Bestellt",
		"{n} vs plan": "{n} ggü. Plan",
		"{n} orders": "{n} Bestellungen",
		"Shipped": "Versendet",
		"{n}% of ordered": "{n}% des Bestellten",
		"nothing ordered": "nichts bestellt",
		"Still to ship": "Noch zu versenden",
		"boxes · {n} orders": "Kartons · {n} Bestellungen",
		"boxes · {n} order": "Kartons · {n} Bestellung",
		"Stock in chambers": "Bestand in Kammern",
		"{n}% of capacity": "{n}% der Kapazität",
		"Market / Garbage": "Markt / Abfall",
		"Needs attention": "Braucht Aufmerksamkeit",
		"{n} open": "{n} offen",
		"Nothing needs attention right now.": "Gerade braucht nichts Aufmerksamkeit.",
		"Alerts clear themselves when the underlying data is fixed.": "Hinweise verschwinden von selbst, wenn die Daten korrigiert sind.",
		"{n} orders in the transport plan not scanned": "{n} Bestellungen im Transportplan nicht gescannt",
		"{n} order in the transport plan not scanned": "{n} Bestellung im Transportplan nicht gescannt",
		"{n} scans without a transport-plan row": "{n} Scans ohne Zeile im Transportplan",
		"{n} scan without a transport-plan row": "{n} Scan ohne Zeile im Transportplan",
		"Chambers {s} have no gas day": "Kammern {s} haben keinen Begasungstag",
		"Chamber {n} has no gas day": "Kammer {n} hat keinen Begasungstag",
		"{n} boxes will be planned by container delivery date": "{n} Kartons werden nach Container-Lieferdatum geplant",
		"PLAC: {n} containers picked up, not received": "PLAC: {n} Container abgeholt, nicht angenommen",
		"PLAC: {n} container picked up, not received": "PLAC: {n} Container abgeholt, nicht angenommen",
		"Container {s}: {n} boxes unexplained at receiving": "Container {s}: {n} Kartons beim Eingang ungeklärt",
		"Open map →": "Plan öffnen →",
		"Today in numbers": "Heute in Zahlen",
		"aisle": "Gang",
		"central aisle": "Mittelgang",
		"Stock day filled": "Bestandstag gefüllt",
		"Stock day not filled": "Bestandstag nicht gefüllt",
		"{s} written to the stock book": "{s} ins Bestandsbuch geschrieben",
		"Today could not be loaded": "Heute konnte nicht geladen werden",
		"{n} loaded · {n} empty · {n} without gas day · capacity {s} per chamber": "{n} belegt · {n} leer · {n} ohne Begasungstag · Kapazität {s} pro Kammer",
		"Regular": "Normal",
		"No gas day": "Kein Begasungstag",
		"no gas day": "kein Begasungstag",
		"Filter chambers": "Kammern filtern",
		"Chambers map": "Kammerplan",
		"non-conforming": "nicht konform",
		"Chamber {n}": "Kammer {n}",
		"Chamber {n}, empty": "Kammer {n}, leer",
		"Chamber {n}, {s} of {s} boxes": "Kammer {n}, {s} von {s} Kartons",
		"Chamber {n} · CITRO": "Kammer {n} · CITRO",
		"Chamber {n} · {s}": "Kammer {n} · {s}",
		"Gas days": "Begasungstage",
		"The ripening plan reads the day from here. Chambers without a day are planned by container delivery date.": "Der Reifeplan liest den Tag von hier. Kammern ohne Tag werden nach Container-Lieferdatum geplant.",
		"All changes saved": "Alle Änderungen gespeichert",
		"Saving…": "Wird gespeichert…",
		"Ch.": "K.",
		"Gas day": "Begasungstag",
		"Client tag": "Kunden-Tag",
		"Client tag (BIO)": "Kunden-Tag (BIO)",
		"Gas day for chamber {n}": "Begasungstag für Kammer {n}",
		"Client tag for chamber {n}": "Kunden-Tag für Kammer {n}",
		"No loaded chambers.": "Keine belegten Kammern.",
		"Non-conforming goods held in CITRO.": "Nicht konforme Ware in CITRO.",
		"/ {s} boxes": "/ {s} Kartons",
		"Gas day for whole chamber": "Begasungstag für die ganze Kammer",
		"No gas day set. This chamber will be planned by container delivery date.": "Kein Begasungstag gesetzt. Diese Kammer wird nach Container-Lieferdatum geplant.",
		"e.g. LABAS BIO": "z. B. LABAS BIO",
		"Placements": "Belegungen",
		"{n} container sides": "{n} Containerseiten",
		"{n} container side": "{n} Containerseite",
		"none": "keine",
		"Move boxes": "Kartons umlagern",
		"Write off": "Abschreiben",
		"Empty · ready for a container": "Leer · bereit für einen Container",
		"{n}% full · {s} free · {s}": "{n}% voll · {s} frei · {s}",
		"Gas day saved": "Begasungstag gespeichert",
		"Gas day cleared": "Begasungstag entfernt",
		"Chamber {n}: not saved": "Kammer {n}: nicht gespeichert",
		"Chambers could not be loaded: {s}": "Kammern konnten nicht geladen werden: {s}",
		"No active placements in chamber {n}": "Keine aktiven Belegungen in Kammer {n}",
		"Plan Week ·": "Wochenplan ·",
		"the Sales Plan drives ripening, orders and the loading list.": "der Verkaufsplan steuert Reifung, Bestellungen und die Ladeliste.",
		"done": "erledigt",
		"now": "jetzt",
		"next": "als Nächstes",
		"Upload Sales Plan": "Verkaufsplan hochladen",
		"One file per week. Uploading again replaces the week's plan.": "Eine Datei pro Woche. Erneutes Hochladen ersetzt den Wochenplan.",
		"Sales Plan export, one week": "Verkaufsplan-Export, eine Woche",
		"Generate week plan": "Wochenplan erstellen",
		"Week W{n} is ready": "Woche KW{n} ist fertig",
		"Week W{n}": "Woche KW{n}",
		"Week W{n} · nothing uploaded": "Woche KW{n} · nichts hochgeladen",
		"{n} of {n}": "{n} von {n}",
		"Sales Plan parsed": "Verkaufsplan eingelesen",
		"Transport plan": "Transportplan",
		"Containers plan": "Containerplan",
		"Ripening input": "Reife-Eingabe",
		"Transport plan draft": "Transportplan-Entwurf",
		"{n} trips · {s}": "{n} Fahrten · {s}",
		"{s} · expected {n} · counted {n} · explained {n}": "{s} · erwartet {n} · gezählt {n} · geklärt {n}",
		"OUTBOUND (banana)": "AUSGANG (Banane)",
		"INBOUND (containers)": "EINGANG (Container)",
		"· {n} KB · just now": "· {n} KB · gerade eben",
		"{n} lines": "{n} Zeilen",
		"{n} lines · {s}": "{n} Zeilen · {s}",
		"{n} days · {s}": "{n} Tage · {s}",
		"{n} day · {s}": "{n} Tag · {s}",
		"{n} containers": "{n} Container",
		"{n} containers · {s}": "{n} Container · {s}",
		"not uploaded": "nicht hochgeladen",
		"no days yet": "noch keine Tage",
		"Next:": "Weiter:",
		"Ripening Plan →": "Reifeplan →",
		"Sales Plan by client": "Verkaufsplan nach Kunde",
		"Boxes per delivery day. Totals count the rows you see.": "Kartons pro Liefertag. Die Summen zählen die sichtbaren Zeilen.",
		"Client · location": "Kunde · Ort",
		"· all products": "· alle Produkte",
		"No clients match": "Keine passenden Kunden",
		"Clear the search or pick another product.": "Leere die Suche oder wähle ein anderes Produkt.",
		"No Sales Plan for W{n}": "Kein Verkaufsplan für KW{n}",
		"Upload sales.xlsx for this week above.": "Lade oben sales.xlsx für diese Woche hoch.",
		"Client or location": "Kunde oder Ort",
		"Filter clients": "Kunden filtern",
		"Choose the Sales Plan first": "Wähle zuerst den Verkaufsplan",
		"sales.xlsx for one week": "sales.xlsx für eine Woche",
		"Week W{n} plan generated": "Plan für Woche KW{n} erstellt",
		"Sales Plan parsed — ripening and orders use it now.": "Verkaufsplan eingelesen — Reifung und Bestellungen nutzen ihn jetzt.",
		"Plan not generated": "Plan nicht erstellt",
		"Week could not be loaded": "Woche konnte nicht geladen werden",
		"8 days from today. Rows come from chamber placements and their gas days.": "8 Tage ab heute. Die Zeilen kommen aus den Kammerbelegungen und ihren Begasungstagen.",
		"Last generated {s}.": "Zuletzt erstellt {s}.",
		"Not generated yet.": "Noch nicht erstellt.",
		"Upload GGN": "GGN hochladen",
		"Open file": "Datei öffnen",
		"Generate plan": "Plan erstellen",
		"Plan inputs": "Plan-Eingaben",
		"Sales Plan": "Verkaufsplan",
		"{s} and {s} loaded": "{s} und {s} geladen",
		"{s} loaded": "{s} geladen",
		"{s} not uploaded — plan will be 0": "{s} nicht hochgeladen — der Plan wird 0",
		"Plan Week →": "Wochenplan →",
		"{n} chambers placed · {n} boxes": "{n} Kammern belegt · {n} Kartons",
		"No placements — the generator falls back to chambers.json": "Keine Belegungen — der Generator nutzt chambers.json",
		"Map →": "Plan →",
		"Gas day missing": "Begasungstag fehlt",
		"Chambers {s} placed by delivery date": "Kammern {s} nach Lieferdatum eingeplant",
		"Set gas day →": "Begasungstag setzen →",
		"GGN data": "GGN-Daten",
		"{n} plantations · updated {s}": "{n} Plantagen · aktualisiert {s}",
		"Updated {s} · {n} plantations": "Aktualisiert {s} · {n} Plantagen",
		"No GGN data uploaded": "Keine GGN-Daten hochgeladen",
		"Show": "Anzeigen",
		"All rows": "Alle Zeilen",
		"in rooms ≈ plan (±50)": "in Kammern ≈ Plan (±50)",
		"more than planned": "mehr als geplant",
		"less than planned": "weniger als geplant",
		"today": "heute",
		"Plan": "Plan",
		"In rooms": "In Kammern",
		"Diff": "Diff.",
		"Comment": "Kommentar",
		"No chambers for this day": "Keine Kammern für diesen Tag",
		"Ripening plan generated": "Reifeplan erstellt",
		"Some chambers have no gas day — they are placed by delivery date.": "Einige Kammern haben keinen Begasungstag — sie werden nach Lieferdatum eingeplant.",
		"Open the file to print it.": "Öffne die Datei, um sie zu drucken.",
		"Ripening plan could not be loaded": "Reifeplan konnte nicht geladen werden",
		"GGN data updated": "GGN-Daten aktualisiert",
		"GGN not updated": "GGN nicht aktualisiert",
		"{s} · {n} plantations": "{s} · {n} Plantagen",
		"Fill the day's stock file from scanner work, then reconcile it with the responsible person's file.": "Fülle die Bestandsdatei des Tages aus der Scannerarbeit und gleiche sie dann mit der Datei der verantwortlichen Person ab.",
		"Stock day": "Bestandstag",
		"Fill day": "Tag füllen",
		"Stock file": "Bestandsdatei",
		"Responsible person's file": "Datei der verantwortlichen Person",
		"Pick their stock .xlsx to compare it with the system for this day": "Wähle ihre Bestands-.xlsx, um sie für diesen Tag mit dem System zu vergleichen",
		"Reconcile day": "Tag abgleichen",
		"Totals by sheet ·": "Summen nach Blatt ·",
		"System = scans and container register. File = responsible person's stock for this date.": "System = Scans und Containerregister. Datei = Bestand der verantwortlichen Person für dieses Datum.",
		"All sheets match": "Alle Blätter stimmen",
		"{n} of {n} sheets differs": "{n} von {n} Blättern weicht ab",
		"{n} of {n} sheets differ": "{n} von {n} Blättern weichen ab",
		"Sheet": "Blatt",
		"System": "System",
		"File": "Datei",
		"Differences ·": "Abweichungen ·",
		"{n} issues": "{n} Abweichungen",
		"{n} issue": "{n} Abweichung",
		"Status": "Status",
		"Client · order": "Kunde · Bestellung",
		"Field": "Feld",
		"diff": "Diff.",
		"diff {n}": "Diff. {n}",
		"missing in file": "fehlt in Datei",
		"missing in file {n}": "fehlt in Datei {n}",
		"not in system": "nicht im System",
		"not in system {n}": "nicht im System {n}",
		"The file matches the system for this day.": "Die Datei stimmt für diesen Tag mit dem System überein.",
		"In transport plan, not scanned": "Im Transportplan, nicht gescannt",
		"Orders planned for {s} with no outbound scans yet.": "Für {s} geplante Bestellungen ohne Ausgangsscans.",
		"Everything planned for this day is scanned.": "Alles für diesen Tag Geplante ist gescannt.",
		"Truck {s}": "LKW {s}",
		"Truck {s} · {s}": "LKW {s} · {s}",
		"Total not scanned": "Gesamt nicht gescannt",
		"File matches the system": "Datei stimmt mit dem System überein",
		"Differences found": "Abweichungen gefunden",
		"Reconcile failed": "Abgleich fehlgeschlagen",
		"Stock could not be loaded": "Bestand konnte nicht geladen werden",
		"Client reports, shipping cards and day files, made from the transport plan.": "Kundenberichte, Versandkarten und Tagesdateien, erstellt aus dem Transportplan.",
		"Generate day documents": "Tagesdokumente erstellen",
		"Upload the transport plan for this day. Everything below is rebuilt.": "Lade den Transportplan für diesen Tag hoch. Alles unten wird neu erstellt.",
		"Transport plan, file name like PLAN_week_41.xlsx": "Transportplan, Dateiname wie PLAN_week_41.xlsx",
		"Generate documents": "Dokumente erstellen",
		"Last run ·": "Letzter Lauf ·",
		"not run": "nicht gelaufen",
		"Generated": "Erstellt",
		"By": "Von",
		"Trips": "Fahrten",
		"Files": "Dateien",
		"From": "Aus",
		"Documents": "Dokumente",
		"Client reports": "Kundenberichte",
		"Shipping cards": "Versandkarten",
		"Day files": "Tagesdateien",
		"Client report": "Kundenbericht",
		"Shipping card": "Versandkarte",
		"Loading list": "Ladeliste",
		"Transport plan (clean)": "Transportplan (bereinigt)",
		"Transport report": "Transportbericht",
		"Box counter": "Kartonzähler",
		"Stock book": "Bestandsbuch",
		"Ripening plan": "Reifeplan",
		"Page": "Seite",
		"Open in the app": "In der App öffnen",
		"Download {s}": "{s} herunterladen",
		"Nothing matches": "Keine Treffer",
		"Clear the search or pick another type.": "Leere die Suche oder wähle einen anderen Typ.",
		"No documents for {s}": "Keine Dokumente für {s}",
		"Upload the transport plan above to generate them.": "Lade oben den Transportplan hoch, um sie zu erstellen.",
		"Client, truck or file": "Kunde, LKW oder Datei",
		"Filter documents": "Dokumente filtern",
		"Type": "Typ",
		"Documents generated": "Dokumente erstellt",
		"Documents not generated": "Dokumente nicht erstellt",
		"Documents could not be loaded": "Dokumente konnten nicht geladen werden",
		"{s} · from {s}": "{s} · aus {s}",
		"Print": "Drucken",
		"Download .xlsx": ".xlsx herunterladen",
		"Loading file…": "Datei wird geladen…",
		"Fit": "Einpassen",
		"Zoom": "Zoom",
		"Sheets": "Blätter",
		"Find in sheet": "Im Blatt suchen",
		"Previous match": "Vorheriger Treffer",
		"Next match": "Nächster Treffer",
		"Manual fields": "Manuelle Felder",
		"Numbers come from the system. Fix them in the data and the file is rebuilt. These fields are filled by hand and are put back every time the file is rebuilt.": "Zahlen kommen aus dem System. Korrigiere sie in den Daten, dann wird die Datei neu erstellt. Diese Felder werden von Hand gefüllt und bei jedem Neuerstellen wieder eingesetzt.",
		"as generated": "wie erstellt",
		"(empty)": "(leer)",
		"Back to generated": "Zurück zum Erstellten",
		"This file has no manual fields.": "Diese Datei hat keine manuellen Felder.",
		"Pick one, or type your own": "Wähle eins oder gib dein eigenes ein",
		"Kept when the file is rebuilt": "Bleibt beim Neuerstellen erhalten",
		"Saved · kept on rebuild": "Gespeichert · bleibt beim Neuerstellen",
		"Back to the generated value": "Zurück zum erstellten Wert",
		"Read only": "Nur lesen",
		"Your role can view this file but not change it.": "Deine Rolle kann diese Datei ansehen, aber nicht ändern.",
		"File not found": "Datei nicht gefunden",
		"Could not open the file": "Datei konnte nicht geöffnet werden",
		"Back to Reports": "Zurück zu Berichten",
		"{s} · generated {s} · {n} of {n} manual fields filled": "{s} · erstellt {s} · {n} von {n} manuellen Feldern gefüllt",
		"{s} · generated {s}": "{s} · erstellt {s}",
		"{s} · click to edit": "{s} · zum Bearbeiten klicken",
		"Склад": "Lager",
		"Приймання": "Wareneingang",
		"Завершення": "Abschluss",
		"Контейнер": "Container",
		"Перемістити": "Umlagern",
		"Списати": "Abschreiben",
		"Маркет-палета": "Marktpalette",
		"Баланс дня": "Tagesbilanz",
		"Черга синхронізації": "Sync-Warteschlange",
		"онлайн": "online",
		"офлайн · {n}": "offline · {n}",
		"черга {n}": "Warteschlange {n}",
		"відхилено {n}": "abgelehnt {n}",
		"Назад": "Zurück",
		"Немає зв'язку": "Keine Verbindung",
		"Працюй далі. Операцій на телефоні:": "Arbeite weiter. Vorgänge auf dem Telefon:",
		"— відправляться автоматично.": "— werden automatisch gesendet.",
		"Змінити користувача": "Benutzer wechseln",
		"Скануй контейнер": "Container scannen",
		"Обхід": "Rundgang",
		"Ранок": "Morgen",
		"Вечір": "Abend",
		"Усі камери": "Alle Kammern",
		"Температура": "Temperatur",
		"Зберегти": "Speichern",
		"порожня": "leer",
		"Ще не було обходу": "Noch kein Rundgang",
		"Немає камер з товаром": "Keine Kammern mit Ware",
		"Записано {n} з {n}": "{n} von {n} erfasst",
		"Камера {n} збережена": "Kammer {n} gespeichert",
		"Невірний колір": "Falsche Farbe",
		"Нічого зберігати": "Nichts zu speichern",
		"Розпочати підрахунок": "Zählung starten",
		"Знайти контейнер": "Container finden",
		"Код контейнера": "Containernummer",
		"Сканером, камерою або вручну": "Mit Scanner, Kamera oder von Hand",
		"Формат коду: 4 літери + 7 цифр, напр. MNBU3318616": "Codeformat: 4 Buchstaben + 7 Ziffern, z. B. MNBU3318616",
		"Сканувати камерою": "Mit Kamera scannen",
		"Готово до роботи": "Bereit",
		"Синхронізовано · {s}": "Synchronisiert · {s}",
		"У черзі: {n}": "In der Warteschlange: {n}",
		"Далі": "Weiter",
		"ящ. · палета": "Kart. · Palette",
		"з {n}": "von {n}",
		"немає в плані контейнерів": "nicht im Containerplan",
		"pickup {s}": "Abholung {s}",
		"Комора (1–29)": "Kammer (1–29)",
		"Сторона": "Seite",
		"Комори 1–29": "Kammern 1–29",
		"Комори 1–29 (30 — CITRO, туди лише списання)": "Kammern 1–29 (30 ist CITRO, nur Abschreibungen)",
		"Комора {n}": "Kammer {n}",
		"Комора {n}: {s} / {s} · вільно {s}": "Kammer {n}: {s} / {s} · {s} frei",
		"Комора {n} заповнена: {s} / {s}": "Kammer {n} ist voll: {s} / {s}",
		"Код плантації": "Plantagencode",
		"Необов’язково для BIO": "Optional für BIO",
		"Перевіряю…": "Wird geprüft…",
		"Не знайдено.": "Nicht gefunden.",
		"Не знайдено. Формат: {s}": "Nicht gefunden. Format: {s}",
		"Без мережі — код перевірить сервер пізніше": "Kein Netz — der Server prüft den Code später",
		"Ящиків на палеті": "Kartons auf der Palette",
		"повна": "voll",
		"Інша кількість": "Andere Menge",
		"інша кількість": "andere Menge",
		"+ Палета ·": "+ Palette ·",
		"ящ.": "Kart.",
		"Завершити контейнер": "Container abschließen",
		"Очікувано": "Erwartet",
		"Пораховано": "Gezählt",
		"Різниця": "Differenz",
		"Поясни різницю": "Erkläre die Differenz",
		"Все пояснено": "Alles geklärt",
		"Не пояснено: {n} ящ.": "Nicht geklärt: {n} Kart.",
		"Забагато на {n} ящ.": "Zu viele um {n} Kart.",
		"Більше, ніж очікувано, на {n} ящ.": "Mehr als erwartet um {n} Kart.",
		"Без очікуваної кількості — запиши лише невідповідний товар": "Ohne erwartete Menge — erfasse nur die nicht konforme Ware",
		"Зберегти і завершити": "Speichern und abschließen",
		"Назад до приймання": "Zurück zum Wareneingang",
		"У коморах": "In Kammern",
		"У коморах більше немає ящиків цього контейнера.": "In den Kammern sind keine Kartons dieses Containers mehr.",
		"{s} · газування {s}": "{s} · Begasung {s}",
		"{s} · без дня газування": "{s} · ohne Begasungstag",
		"≈ {n} палета": "≈ {n} Palette",
		"≈ {n} палети": "≈ {n} Paletten",
		"≈ {n} палет": "≈ {n} Paletten",
		"+ Додати палету": "+ Palette hinzufügen",
		"Звідки": "Von",
		"Комора {n} · {s}": "Kammer {n} · {s}",
		"Куди · комора": "Nach · Kammer",
		"Кількість ящиків": "Anzahl Kartons",
		"Усе": "Alle",
		"Перемістити {n} ящ. · {s} → {s}": "{n} Kart. umlagern · {s} → {s}",
		"Категорія": "Kategorie",
		"Категорія палети": "Palettenkategorie",
		"маркет": "Markt",
		"зелені": "grün",
		"утилізація": "Entsorgung",
		"Ящики підуть у комору 30 (CITRO).": "Die Kartons kommen in Kammer 30 (CITRO).",
		"Списати {n} ящ. у {s}": "{n} Kart. nach {s} abschreiben",
		"Скануй коробку · кожен скан = +1": "Karton scannen · jeder Scan = +1",
		"Код контейнера на коробці": "Containernummer auf dem Karton",
		"код коробки": "Kartoncode",
		"Коробок з {s}": "Kartons aus {s}",
		"Прибрати {s}": "{s} entfernen",
		"Разом": "Gesamt",
		"Зберегти палету": "Palette speichern",
		"День": "Tag",
		"План і замовлення": "Plan und Bestellungen",
		"Потрібно (Sales Plan, банан)": "Benötigt (Verkaufsplan, Banane)",
		"Замовлено: банан": "Bestellt: Banane",
		"Замовлено: BIO": "Bestellt: BIO",
		"Замовлено: маркет / смітник": "Bestellt: Markt / Abfall",
		"Замовлено: ананас": "Bestellt: Ananas",
		"Замовлено − план": "Bestellt − Plan",
		"Рух": "Bewegung",
		"Прийнято": "Angenommen",
		"Відвантажено (скани)": "Versendet (Scans)",
		"Ще не відвантажено": "Noch nicht versendet",
		"Переміщено між коморами": "Zwischen Kammern umgelagert",
		"Невідповідний товар": "Nicht konforme Ware",
		"Приймання R+T / GS / DEC": "Eingang R+T / GS / DEC",
		"Після дозрівання R+T / GS / DEC": "Nach der Reifung R+T / GS / DEC",
		"Залишок зараз": "Bestand jetzt",
		"Банан у коморах": "Banane in Kammern",
		"BIO у коморах": "BIO in Kammern",
		"{n} розбіжність за день. Позначено червоним.": "{n} Abweichung am Tag. Rot markiert.",
		"{n} розбіжності за день. Позначено червоним.": "{n} Abweichungen am Tag. Rot markiert.",
		"{n} розбіжностей за день. Позначено червоним.": "{n} Abweichungen am Tag. Rot markiert.",
		"Немає мережі — баланс недоступний": "Kein Netz — die Bilanz ist nicht verfügbar",
		"Відхилено · {n}": "Abgelehnt · {n}",
		"Очікують · {n}": "Wartend · {n}",
		"Усе відправлено.": "Alles gesendet.",
		"Операції відправляються по черзі, щойно є мережа.": "Vorgänge werden der Reihe nach gesendet, sobald Netz da ist.",
		"Операції відправляються по черзі. Остання спроба {s}.": "Vorgänge werden der Reihe nach gesendet. Letzter Versuch {s}.",
		"Сервер відхилив операцію": "Der Server hat den Vorgang abgelehnt",
		"Повторити": "Wiederholen",
		"Видалити": "Löschen",
		"Надіслати зараз": "Jetzt senden",
		"Сканування": "Scannen",
		"Сканування камерою": "Kamera-Scan",
		"Наведи на код контейнера": "Richte die Kamera auf die Containernummer",
		"Ввести вручну": "Von Hand eingeben",
		"Закрити камеру": "Kamera schließen",
		"Камера недоступна. Введи код вручну.": "Die Kamera ist nicht verfügbar. Gib den Code von Hand ein.",
		"Збережено на телефоні": "Auf dem Telefon gespeichert",
		"Відправиться, щойно з’явиться мережа": "Wird gesendet, sobald Netz da ist",
		"Невірний код": "Falscher Code",
		"порожньо": "leer",
		"Помилка сервера": "Serverfehler",
		"{s} уже відвантажено": "{s} ist bereits versendet",
		"Залишку в коморах немає": "In den Kammern ist nichts mehr",
		"Немає в плані контейнерів": "Nicht im Containerplan",
		"Можна прийняти — перевір код": "Kann angenommen werden — prüfe den Code",
		"Немає мережі": "Kein Netz",
		"Приймання збережеться на телефоні": "Der Eingang wird auf dem Telefon gespeichert",
		"Операції залишаються в черзі": "Die Vorgänge bleiben in der Warteschlange",
		"Вкажи кількість ящиків": "Gib die Anzahl der Kartons ein",
		"Невірна комора": "Falsche Kammer",
		"Приймання лише в комори 1–29": "Eingang nur in Kammern 1–29",
		"Не вміщується в комору {n}": "Passt nicht in Kammer {n}",
		"Вільно {s}. Обери іншу комору.": "{s} frei. Wähle eine andere Kammer.",
		"Вільно {s}": "{s} frei",
		"Код плантації не знайдено": "Plantagencode nicht gefunden",
		"Виправ код або очисти поле": "Korrigiere den Code oder leere das Feld",
		"+{n} ящ. → комора {n} {s}": "+{n} Kart. → Kammer {n} {s}",
		"{s} · палета {n}": "{s} · Palette {n}",
		"Різниця не пояснена": "Die Differenz ist nicht geklärt",
		"Розклади ящики по DEC / GS / R+T": "Verteile die Kartons auf DEC / GS / R+T",
		"Контейнер {s} завершено": "Container {s} abgeschlossen",
		"Немає звідки переміщати": "Nichts zum Umlagern",
		"Немає звідки списувати": "Nichts zum Abschreiben",
		"Невірна кількість": "Falsche Menge",
		"Доступно {s} ящ.": "{s} Kart. verfügbar",
		"Те саме місце": "Derselbe Platz",
		"Обери іншу комору або сторону": "Wähle eine andere Kammer oder Seite",
		"Переміщено {n} ящ. · {s} → {s}": "{n} Kart. umgelagert · {s} → {s}",
		"Списано {n} ящ. у {s}": "{n} Kart. nach {s} abgeschrieben",
		"{s} · комора {n}": "{s} · Kammer {n}",
		"Палета порожня": "Die Palette ist leer",
		"Відскануй хоча б одну коробку": "Scanne mindestens einen Karton",
		"Палета {s} · {n} ящ.": "Palette {s} · {n} Kart.",
		"{n} контейнер": "{n} Container",
		"{n} контейнери": "{n} Container",
		"{n} контейнерів": "{n} Container",
		"Не все відправлено": "Nicht alles wurde gesendet",
		"Спробую ще раз автоматично": "Ich versuche es automatisch erneut",
		"Усе відправлено": "Alles gesendet",
		"Last round": "Letzter Rundgang",
		"No round yet": "Noch kein Rundgang",
		"Open rounds": "Rundgang öffnen",
		"morning": "morgens",
		"evening": "abends",
		"Видача за замовленням": "Ausgabe nach Auftrag",
		"Сьогодні": "Heute",
		"Завтра": "Morgen",
		"Підготовка": "Vorbereitung",
		"У замовленні 0 ящиків. Підтвердь кількість, щоб почати.": "Der Auftrag hat 0 Kartons. Bestätige die Menge, um zu beginnen.",
		"Підтвердити кількість": "Menge bestätigen",
		"Лінії в машині": "Reihen im LKW",
		"Менше ліній": "Weniger Reihen",
		"Більше ліній": "Mehr Reihen",
		"Сторони": "Seiten",
		"Одна сторона": "Eine Seite",
		"Дві сторони": "Zwei Seiten",
		"Почати сканування": "Scannen starten",
		"Скануй коробку · код контейнера": "Karton scannen · Containernummer",
		"Ящиків за скан": "Kartons pro Scan",
		"Без наклейки": "Ohne Etikett",
		"без наклейки": "ohne Etikett",
		"Скасувати останній": "Letzten rückgängig",
		"Підсумок": "Zusammenfassung",
		"Скасувати видачу": "Ausgabe abbrechen",
		"Ящики за контейнерами": "Kartons nach Container",
		"Замовлено": "Bestellt",
		"Відскановано": "Gescannt",
		"Зберегти видачу": "Ausgabe speichern",
		"Звіт клієнту": "Kundenbericht",
		"Звіт клієнту створено": "Kundenbericht erstellt",
		"Звіт не створено": "Bericht nicht erstellt",
		"Завантаження…": "Wird geladen…",
		"Немає мережі — список замовлень недоступний": "Kein Netz — die Auftragsliste ist nicht verfügbar",
		"Список замовлень з телефона": "Auftragsliste vom Telefon",
		"Продовжити видачу": "Ausgabe fortsetzen",
		"{s} · {n} з {n} ящ.": "{s} · {n} von {n} Kart.",
		"{n} з {n} ящ.": "{n} von {n} Kart.",
		"{n} пал.": "{n} Pal.",
		"{n} ящ. · {n} пал.": "{n} Kart. · {n} Pal.",
		"{n} ящ.": "{n} Kart.",
		"готово": "fertig",
		"Немає замовлень на цей день": "Keine Aufträge für diesen Tag",
		"Є незавершена видача": "Eine Ausgabe ist nicht abgeschlossen",
		"Збережи або скасуй її спочатку": "Speichere oder brich sie zuerst ab",
		"Лінія {n}": "Reihe {n}",
		"Кількість підтверджено": "Menge bestätigt",
		"Не збережено": "Nicht gespeichert",
		"права": "rechts",
		"ліва": "links",
		"Усе вже відскановано": "Alles ist schon gescannt",
		"Замовлено {n} ящ.": "Bestellt {n} Kart.",
		"+{n} без наклейки": "+{n} ohne Etikett",
		"−{n} без наклейки": "−{n} ohne Etikett",
		"Більше, ніж замовлено, на {n} ящ.": "{n} Kart. mehr als bestellt",
		"Зайве не записано": "Der Überschuss wurde nicht erfasst",
		"Замовлення відскановано": "Auftrag gescannt",
		"Перевір підсумок": "Prüfe die Zusammenfassung",
		"Ця лінія вже повна": "Diese Reihe ist schon voll",
		"Натисни ще раз": "Nochmal tippen",
		"Ще нічого не відскановано": "Noch nichts gescannt",
		"Видача · {s}": "Ausgabe · {s}",
		"{n} ящ. · {n} контейнер": "{n} Kart. · {n} Container",
		"{n} ящ. · {n} контейнери": "{n} Kart. · {n} Container",
		"{n} ящ. · {n} контейнерів": "{n} Kart. · {n} Container",
		"Кількість ліній для сканування": "Anzahl der Reihen zum Scannen",
		"Як сканувати": "Wie scannen",
		"Серійне сканування": "Serienscan",
		"камера · +1 за код": "Kamera · +1 pro Code",
		"Введення кількості": "Menge eingeben",
		"код, потім кількість": "Code, dann Menge",
		"Серійне сканування · кожен код = +1 ящ.": "Serienscan · jeder Code = +1 Kart.",
		"Скануй код, потім вкажи кількість": "Code scannen, dann Menge eingeben",
		"Код": "Code",
		"Додати ·": "Hinzufügen ·",
		"палета": "Palette",
		"решта лінії": "Rest der Reihe",
		"решта": "Rest",
		"{n} з {n} ящ. · Лінія {n}": "{n} von {n} Kart. · Reihe {n}",
		"{n} з {n} ящ. · Лінія {n} · ліва": "{n} von {n} Kart. · Reihe {n} · links",
		"{n} з {n} ящ. · Лінія {n} · права": "{n} von {n} Kart. · Reihe {n} · rechts",
		"Ввести кількість": "Menge eingeben",
		"Кількість": "Menge",
		"Спершу відскануй код": "Zuerst einen Code scannen",
		"{s} · залишок у коморах невідомий": "{s} · Bestand in Kammern unbekannt",
		"{s} · більше, ніж є в коморах, на": "{s} · mehr als in den Kammern um",
		"{s} · у коморах залишиться": "{s} · bleibt in den Kammern",
		"{s} · перевіряю залишок…": "{s} · Bestand wird geprüft…",
		"Більше, ніж залишок у контейнері": "Mehr als im Container übrig",
		"{s}: у коморах {n} ящ.": "{s}: {n} Kart. in den Kammern",
		"залишиться {n}": "bleiben {n}",
		"Не все списано з комор": "Nicht alles aus den Kammern ausgebucht",
		"{s}: контейнер не підібрати": "{s}: Container nicht zuordenbar",
		"Немає контейнера з кольором клієнта": "Kein Container in der Farbe des Kunden",
		"Не знайдено в залишку": "Nicht im Bestand gefunden",
		"комора {n} {s}": "Kammer {n} {s}",
		"Ящики без номера контейнера": "Kartons ohne Containernummer",
		"З якої комори": "Aus welcher Kammer",
		"Код плантації (якщо видно)": "Plantagencode (falls lesbar)",
		"напр. BAN215": "z. B. BAN215",
		"Підібрати контейнер": "Container finden",
		"Додати без номера": "Ohne Nummer hinzufügen",
		"Вкажи комору або код плантації": "Kammer oder Plantagencode eingeben",
		"Додай без номера — підбір пізніше неможливий": "Ohne Nummer hinzufügen — offline keine Zuordnung",
		"Колір клієнта": "Farbe des Kunden",
		"колір {s}": "Farbe {s}",
		"залишок {n}": "Rest {n}",
		"колір не підходить": "Farbe passt nicht",
		"Стікери": "Etiketten",
		"Комора": "Kammer",
		"Шаблон": "Vorlage",
		"(автоматично)": "(automatisch)",
		"Кількість стікерів": "Anzahl Etiketten",
		"Друкувати": "Drucken",
		"У коморі немає товару": "Keine Ware in der Kammer",
		"Колір у коморі не підходить клієнту — перевір": "Die Farbe in der Kammer passt nicht zum Kunden — prüfen",
		"Код плантації невідомий — введи його": "Plantagencode unbekannt — eingeben",
		"Плантації немає в даних GGN": "Plantage nicht in den GGN-Daten",
		"Немає шаблону для цього клієнта — вибери": "Keine Vorlage für diesen Kunden — auswählen",
		"Бракує: {s}": "Fehlt: {s}",
		"Надруковано {n} стікерів": "{n} Etiketten gedruckt",
		"Стікери не надруковано": "Etiketten nicht gedruckt",
		"плантація {s}": "Plantage {s}",
		"Зберегти GLN": "GLN speichern",
		"GLN з файлу GGN": "GLN aus der GGN-Datei",
		"GLN, збережений раніше": "Früher gespeicherte GLN",
		"GLN з налаштувань": "GLN aus den Einstellungen",
		"Стандартний GLN шаблону — перевір постачальника": "Standard-GLN der Vorlage — Lieferanten prüfen",
		"GLN немає — введи його": "Keine GLN — eingeben",
		"GLN — 13 цифр": "GLN — 13 Ziffern",
		"GLN збережено": "GLN gespeichert",
		"GLN не збережено": "GLN nicht gespeichert",
		"Надруковано для цього замовлення": "Für diesen Auftrag gedruckt",
		"Damage of this container": "Schäden dieses Containers",
		"Пошкодження": "Schäden",
		"Не вибрано": "Nichts gewählt",
		"Вибрати дефекти": "Mängel wählen",
		"Фото": "Foto",
		"Фото до дефекту": "Foto zum Mangel",
		"Загальне фото": "Allgemeines Foto",
		"Довідник недоступний": "Nachschlagewerk nicht verfügbar",
		"Фото збережено": "Foto gespeichert",
		"Фото не збережено": "Foto nicht gespeichert",
		"Немає мережі — спробуй ще раз": "Kein Netz — erneut versuchen",
		"Межа": "Grenze",
		"Закрити": "Schließen",
		"Пораховано при прийомі": "Bei der Annahme gezählt",
		"невідповідних": "nicht konform",
		"Контейнер не знайдено в реєстрі": "Container nicht im Register gefunden",
		"Пошкоджень при прийомі не записано": "Bei der Annahme keine Schäden erfasst",
		"Знайдені дефекти": "Gefundene Mängel",
		"Які пошкодження?": "Welche Schäden?",
		"Довідник": "Nachschlagewerk",
		"Довідник дефектів": "Mängelkatalog",
		"Усі": "Alle",
		"Пошук дефекту": "Mangel suchen",
		"Фото ще немає — їх додають при прийомі": "Noch keine Fotos — sie werden bei der Annahme hinzugefügt",
		"Нічого не знайдено": "Nichts gefunden",
		"газування {s}": "Begasung {s}",
		"без дня газування": "ohne Begasungstag",
		"Останній: {s}": "Letzte: {s}",
		"ранок": "Morgen",
		"вечір": "Abend",
		"Скануй контейнер, щоб перемістити або списати.": "Container scannen, um ihn umzulagern oder abzuschreiben.",
		"Відвантаження": "Warenausgang"
	}
}];
var LANGS = [
	{
		code: "en",
		label: "English"
	},
	{
		code: "pl",
		label: "Polski"
	},
	{
		code: "ro",
		label: "Română"
	},
	{
		code: "hu",
		label: "Magyar"
	},
	{
		code: "uk",
		label: "Українська"
	},
	{
		code: "fr",
		label: "Français"
	},
	...PACKS.map(({ code, label }) => ({
		code,
		label
	}))
];
var COL = {
	en: 1,
	uk: 2,
	pl: 3,
	ro: 4,
	hu: 5,
	fr: 6
};
PACKS.forEach((pack, i) => {
	const col = 7 + i;
	COL[pack.code] = col;
	for (const row of dict_default) {
		const text = pack.dict[row[0]];
		if (text) row[col] = text;
	}
});
var KEY = "yellow:lang";
var ATTRS = [
	"placeholder",
	"aria-label",
	"title"
];
function siteLangs() {
	try {
		const lg = JSON.parse(localStorage.getItem("yellow:site-profile"))?.languages;
		const enabled = (lg?.enabled || []).filter((c) => COL[c]);
		return enabled.length ? {
			enabled,
			def: COL[lg.default] ? lg.default : enabled[0]
		} : null;
	} catch {
		return null;
	}
}
var SITE = siteLangs();
function pick() {
	try {
		const saved = localStorage.getItem(KEY);
		if (COL[saved]) return saved;
	} catch {}
	if (SITE) return SITE.def;
	for (const l of navigator.languages || [navigator.language]) {
		const code = String(l).slice(0, 2).toLowerCase();
		if (COL[code]) return code;
	}
	return "en";
}
var lang = pick();
var exact = /* @__PURE__ */ new Map();
var patterns = [];
var NUM = "([−+-]?\\d[\\d\\u2009\\u00a0 .,]*\\d|[−+-]?\\d)";
var esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
for (const row of dict_default) {
	const src = row[0];
	if (/\{[ns]\}/.test(src)) {
		const kinds = [...src.matchAll(/\{([ns])\}/g)].map((m) => m[1]);
		const re = new RegExp(`^${esc(src).replace(/\{n\}/g, NUM).replace(/\{s\}/g, "(.+?)")}$`);
		patterns.push({
			re,
			row,
			kinds
		});
	} else exact.set(src, row);
}
function fill(target, values) {
	let i = 0;
	return target.replace(/\{(\d|n|s)\}/g, (m, k) => (/\d/.test(k) ? values[Number(k) - 1] : values[i++]) ?? "");
}
function translate(text, to = lang) {
	if (!text || !/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(text)) return text;
	const row = exact.get(text);
	if (row) return row[COL[to]] ?? (to === "en" || to === "uk" ? text : row[1] ?? text);
	for (const p of patterns) {
		const m = text.match(p.re);
		if (!m) continue;
		return fill(p.row[COL[to]] ?? (to === "en" || to === "uk" ? p.row[0] : p.row[1] ?? p.row[0]), m.slice(1));
	}
	return text;
}
var t = (text) => translate(text);
var textSrc = /* @__PURE__ */ new WeakMap();
var attrSrc = /* @__PURE__ */ new WeakMap();
function doText(node) {
	const value = node.nodeValue;
	const known = textSrc.get(node);
	const src = known && value === known.out ? known.src : value;
	const m = src.match(/^(\s*)([\s\S]*?)(\s*)$/);
	const out = m[2] ? m[1] + translate(m[2]) + m[3] : src;
	textSrc.set(node, {
		src,
		out
	});
	if (out !== value) node.nodeValue = out;
}
function doAttrs(el) {
	let map = attrSrc.get(el);
	for (const a of ATTRS) {
		const value = el.getAttribute(a);
		if (value === null) continue;
		map ??= {};
		const known = map[a];
		const src = known && value === known.out ? known.src : value;
		const out = translate(src.trim());
		map[a] = {
			src,
			out
		};
		if (out !== value) el.setAttribute(a, out);
	}
	if (map) attrSrc.set(el, map);
}
var SKIP = "script,style,code,.mono,[data-no-i18n],input,textarea";
function walk(root) {
	if (root.nodeType === Node.TEXT_NODE) {
		if (!root.parentElement?.closest(SKIP)) doText(root);
		return;
	}
	if (root.nodeType !== Node.ELEMENT_NODE) return;
	if (root.closest?.("[data-no-i18n]")) return;
	doAttrs(root);
	const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
	let n;
	while (n = w.nextNode()) if (n.nodeType === Node.TEXT_NODE) {
		if (!n.parentElement.closest(SKIP)) doText(n);
	} else if (!n.closest("[data-no-i18n]")) doAttrs(n);
}
var titleOut = null;
function doTitle() {
	const value = document.title;
	if (value === titleOut) return;
	const [head, ...rest] = value.split(" · ");
	titleOut = [translate(head), ...rest].join(" · ");
	if (titleOut !== value) document.title = titleOut;
}
var observer = new MutationObserver((list) => {
	observer.disconnect();
	for (const m of list) if (m.type === "characterData") {
		if (!m.target.parentElement?.closest(SKIP)) doText(m.target);
	} else if (m.type === "attributes") doAttrs(m.target);
	else m.addedNodes.forEach(walk);
	doTitle();
	start();
});
function start() {
	observer.observe(document.body, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: ATTRS
	});
	const titleEl = document.querySelector("title");
	if (titleEl) observer.observe(titleEl, {
		childList: true,
		characterData: true,
		subtree: true
	});
}
function fillPickers() {
	document.querySelectorAll("[data-lang-select]").forEach((sel) => {
		if (!sel.options.length) {
			sel.innerHTML = (SITE ? LANGS.filter((l) => SITE.enabled.includes(l.code) || l.code === lang) : LANGS).map((l) => `<option value="${l.code}">${l.label}</option>`).join("");
			sel.setAttribute("data-no-i18n", "");
			sel.addEventListener("change", () => setLang(sel.value));
		}
		sel.value = lang;
	});
}
function setLang(code) {
	if (!COL[code] || code === lang) return;
	try {
		localStorage.setItem(KEY, code);
	} catch {}
	location.reload();
}
var LOCALES = {
	en: "en-GB",
	uk: "uk-UA",
	pl: "pl-PL",
	ro: "ro-RO",
	hu: "hu-HU",
	fr: "fr-FR"
};
for (const pack of PACKS) LOCALES[pack.code] = pack.locale;
var locale = () => LOCALES[lang] || "en-GB";
document.documentElement.lang = lang;
walk(document.body);
doTitle();
fillPickers();
start();
//#endregion
//#region src/components/custom/segmented/_segmented.js
function initSegmented(root = document) {
	root.addEventListener("click", (e) => {
		const option = e.target.closest(".segmented__option");
		const group = option?.closest(".segmented");
		if (!option || !group || option.disabled) return;
		select(group, option);
	});
	root.addEventListener("keydown", (e) => {
		const option = e.target.closest(".segmented__option");
		if (!option || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
		const options = [...option.closest(".segmented").querySelectorAll(".segmented__option:not([disabled])")];
		const next = options[(options.indexOf(option) + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
		next.focus();
		select(next.closest(".segmented"), next);
	});
}
function select(group, option) {
	group.querySelectorAll(".segmented__option").forEach((o) => {
		const on = o === option;
		o.classList.toggle("segmented__option--active", on);
		o.setAttribute(o.getAttribute("role") === "radio" ? "aria-checked" : "aria-pressed", String(on));
		o.tabIndex = on ? 0 : -1;
	});
	group.dataset.value = option.dataset.value ?? "";
	group.dispatchEvent(new CustomEvent("segmented:change", {
		bubbles: true,
		detail: {
			name: group.dataset.segmented,
			value: group.dataset.value
		}
	}));
}
//#endregion
//#region src/components/custom/qty-picker/_qty-picker.js
function initQtyPicker(root = document) {
	root.addEventListener("click", (e) => {
		const option = e.target.closest(".qty-picker__option");
		if (!option) return;
		const picker = option.closest(".qty-picker");
		picker.querySelectorAll(".qty-picker__option").forEach((o) => {
			const on = o === option;
			o.classList.toggle("qty-picker__option--active", on);
			o.setAttribute("aria-checked", String(on));
		});
		const manual = picker.querySelector(".qty-picker__manual input");
		if (manual) manual.value = "";
		emit(picker, option.dataset.value);
	});
	root.addEventListener("input", (e) => {
		const input = e.target.closest(".qty-picker__manual input");
		if (!input) return;
		const picker = input.closest(".qty-picker");
		picker.querySelectorAll(".qty-picker__option").forEach((o) => {
			o.classList.remove("qty-picker__option--active");
			o.setAttribute("aria-checked", "false");
		});
		emit(picker, input.value);
	});
}
function emit(picker, value) {
	picker.dataset.value = value;
	picker.dispatchEvent(new CustomEvent("qty:change", {
		bubbles: true,
		detail: { value: Number(value) || 0 }
	}));
}
//#endregion
//#region src/components/custom/ui/ui.js
if (window.Capacitor) document.documentElement.classList.add("is-app");
initSegmented();
initQtyPicker();
var html = document.documentElement;
if (html.classList.contains("is-auth-pending")) {
	const pagePerm = document.querySelector("[data-page-perm]")?.dataset.pagePerm.split(/\s+/);
	guard({ perm: pagePerm }).then((user) => {
		if (!user) return;
		html.classList.remove("is-auth-pending");
		markDemoData();
	}).catch((err) => {
		console.error("Session check failed:", err);
		showUnavailable(err);
	});
}
function markDemoData() {
	const root = document.querySelector("[data-demo-data]");
	if (!root || API_MODE !== "live" || root.querySelector(".demo-data-note")) return;
	const note = document.createElement("div");
	note.className = "banner banner--compact demo-data-note";
	note.setAttribute("role", "note");
	note.innerHTML = "<div class=\"banner__body\"><b>Example data.</b> This page is not connected to the server yet — the numbers below are not real.</div>";
	if (root.dataset.demoData) note.firstChild.append(` ${root.dataset.demoData}`);
	root.prepend(note);
}
if (API_MODE === "live" && !window.Capacitor && "serviceWorker" in navigator && window.isSecureContext) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
//#endregion
export { todayApi as A, savedServers as B, reportsViewApi as C, siteApi as D, roundsApi as E, currentSite as F, setDevMode as H, devMode as I, forgetServer as L, warehouseApi as M, API_MODE as N, stickersApi as O, IS_APP as P, perServer as R, reportsApi as S, ripeningViewApi as T, setServerUrl as U, serverUrl as V, filesApi as _, can as a, planWeekApi as b, idleLogout as c, ApiError as d, authApi as f, devicesApi as g, defectsApi as h, translate as i, usersApi as j, stockApi as k, ready as l, chambersApi as m, locale as n, currentUser as o, backupApi as p, t as r, homeFor as s, lang as t, showUnavailable as u, healthApi as v, ripeningApi as w, plansApi as x, ordersApi as y, routeReady as z };
