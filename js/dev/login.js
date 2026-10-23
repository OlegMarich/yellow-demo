import { B as savedServers, F as currentSite, H as setDevMode, I as devMode, L as forgetServer, P as IS_APP, R as perServer, U as setServerUrl, V as serverUrl, d as ApiError, f as authApi, g as devicesApi, s as homeFor, z as routeReady } from "./ui.min.js";
import { r as loadSite, t as applySiteName } from "./site.min.js";
/* empty css                   */
//#region src/components/pages/login/login.js
var LAST_KEY = perServer("yellow:lastUser");
var CONFETTI_COLORS = [
	"var(--color-banana)",
	"var(--color-primary)",
	"var(--color-success)",
	"var(--color-bio)",
	"#60a5fa"
];
var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
var rand = (min, max) => min + Math.random() * (max - min);
function storage(key, value) {
	try {
		if (value === void 0) return localStorage.getItem(key);
		localStorage.setItem(key, value);
	} catch {
		return null;
	}
}
function plural(n) {
	const a = n % 10;
	const b = n % 100;
	if (a === 1 && b !== 11) return "спроба";
	if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "спроби";
	return "спроб";
}
function init() {
	const root = document.querySelector("[data-fls-login]");
	if (!root) return;
	applySiteName();
	loadSite().then(applySiteName);
	const $ = (sel) => root.querySelector(sel);
	const params = new URLSearchParams(location.search);
	const steps = {
		pick: $("[data-step=\"pick\"]"),
		pin: $("[data-step=\"pin\"]")
	};
	const pinEl = $("[data-pin]");
	const message = $("[data-message]");
	const bar = $(".verify__bar");
	const pct = $("[data-verify-pct]");
	const confetti = $("[data-confetti]");
	let user = null;
	let digits = [];
	let busy = false;
	let lockTimer = 0;
	function setState(state) {
		root.dataset.state = state;
		steps.pick.hidden = state !== "pick";
		steps.pin.hidden = state === "pick";
	}
	function say(text, error = false) {
		message.textContent = text;
		message.classList.toggle("is-error", error);
	}
	const list = $("[data-users]");
	const usersError = $("[data-users-error]");
	let tiles = [];
	async function loadUsers() {
		let users;
		try {
			users = await authApi.users();
		} catch (err) {
			if (err.code === "device_not_trusted") return showPair();
			list.replaceChildren();
			usersError.hidden = false;
			usersError.textContent = err.status === 0 ? "Немає зв’язку з сервером. Перевір Wi-Fi і онови сторінку." : "Не вдалося завантажити користувачів.";
			return;
		}
		if (!users.length) {
			list.replaceChildren();
			list.removeAttribute("aria-busy");
			usersError.hidden = false;
			usersError.textContent = "Ще немає жодного користувача. На комп’ютері із сервером виконай: npm run create-admin -- \"Ім’я\" — і онови сторінку.";
			return;
		}
		const lastId = storage(LAST_KEY);
		users.sort((a, b) => (b.id === lastId) - (a.id === lastId));
		const tpl = $("#user-tile");
		tiles = users.map((u) => {
			const li = tpl.content.firstElementChild.cloneNode(true);
			const tile = li.querySelector(".user-tile");
			Object.assign(tile.dataset, {
				id: u.id,
				name: u.name,
				initials: u.initials,
				role: u.role,
				roleLabel: u.roleLabel,
				pinLength: u.pinLength
			});
			tile.querySelector(".avatar").textContent = u.initials;
			tile.querySelector(".avatar").classList.add(`avatar--${u.role}`);
			tile.querySelector(".user-tile__name").textContent = u.name;
			tile.querySelector(".user-tile__role").textContent = u.roleLabel;
			tile.classList.toggle("is-last", u.id === lastId);
			return li;
		});
		list.replaceChildren(...tiles);
		list.removeAttribute("aria-busy");
		tiles = tiles.map((li) => li.querySelector(".user-tile"));
	}
	const pairForm = $("[data-pair-form]");
	function showPair() {
		root.dataset.state = "pair";
		steps.pick.hidden = true;
		steps.pin.hidden = true;
		pairForm.hidden = false;
		pairForm.code.focus();
	}
	pairForm.code.addEventListener("input", () => {
		const raw = pairForm.code.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
		pairForm.code.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
	});
	pairForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const error = $("[data-pair-error]");
		const code = pairForm.code.value;
		if (code.replace(/-/g, "").length !== 8) return pairForm.code.focus();
		const button = pairForm.querySelector("[type=\"submit\"]");
		button.classList.add("is-loading");
		button.disabled = true;
		error.hidden = true;
		try {
			await devicesApi.pair(code, pairForm.name.value.trim());
			location.reload();
		} catch (err) {
			error.textContent = err.status === 429 ? "Забагато спроб. Зачекай 15 хвилин." : err.status === 0 ? "Немає зв’язку з сервером. Перевір інтернет." : "Код неправильний, уже використаний або прострочений.";
			error.hidden = false;
			button.classList.remove("is-loading");
			button.disabled = false;
		}
	});
	root.addEventListener("click", (e) => {
		const tile = e.target.closest(".user-tile");
		if (tile && tile.dataset.id) pickUser(tile);
	});
	function pickUser(tile) {
		user = {
			...tile.dataset,
			pinLength: Number(tile.dataset.pinLength) || 4
		};
		$("[data-who-avatar]").textContent = user.initials;
		$("[data-who-avatar]").className = `avatar avatar--lg avatar--${user.role}`;
		$("[data-who-name]").textContent = user.name;
		$("[data-who-role]").textContent = user.roleLabel;
		pinEl.classList.toggle("pin--6", user.pinLength === 6);
		pinEl.replaceChildren(...Array.from({ length: user.pinLength }, () => {
			const box = document.createElement("span");
			box.className = "pin__box";
			return box;
		}));
		reset();
		setState("pin");
		say(`Введи PIN · ${user.pinLength} цифр${user.pinLength === 4 ? "и" : ""}`);
	}
	$("[data-back]").addEventListener("click", () => {
		clearInterval(lockTimer);
		user = null;
		setState("pick");
	});
	function render() {
		[...pinEl.children].forEach((box, i) => {
			const filled = i < digits.length;
			box.classList.toggle("is-filled", filled);
			box.classList.toggle("is-current", i === digits.length);
			if (filled && !box.textContent) {
				box.textContent = digits[i];
				setTimeout(() => box.classList.contains("is-filled") && (box.textContent = "•"), 350);
			}
			if (!filled) box.textContent = "";
		});
		pinEl.setAttribute("aria-label", `PIN-код, введено ${digits.length} з ${user.pinLength}`);
	}
	function reset() {
		digits = [];
		pinEl.classList.remove("is-error");
		[...pinEl.children].forEach((b) => b.classList.remove("is-scatter"));
		root.classList.remove("is-failed");
		render();
	}
	function press(key) {
		if (!user || busy || root.dataset.state === "locked") return;
		if (pinEl.classList.contains("is-error")) reset();
		if (key === "back") digits.pop();
		else if (key === "clear") digits = [];
		else if (/^\d$/.test(key) && digits.length < user.pinLength) digits.push(key);
		render();
		if (digits.length === user.pinLength) verify();
	}
	$("[data-keypad]").addEventListener("click", (e) => {
		const key = e.target.closest("[data-key]");
		if (key) press(key.dataset.key);
	});
	document.addEventListener("keydown", (e) => {
		if (root.dataset.state !== "pin") return;
		if (/^\d$/.test(e.key)) press(e.key);
		else if (e.key === "Backspace") press("back");
		else if (e.key === "Escape") $("[data-back]").click();
	});
	function setProgress(p) {
		bar.style.setProperty("--p", p);
		pct.textContent = `${Math.round(p)}%`;
	}
	function runProgress() {
		let p = 0;
		let raf = 0;
		const tick = () => {
			p += (90 - p) * .06;
			setProgress(p);
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	}
	function scatter() {
		[...pinEl.children].forEach((box) => {
			box.style.setProperty("--dx", `${rand(-140, 140)}px`);
			box.style.setProperty("--dy", `${rand(-90, 90)}px`);
			box.style.setProperty("--rot", `${rand(-90, 90)}deg`);
			box.classList.add("is-scatter");
		});
	}
	function burst() {
		if (reduceMotion) return;
		confetti.replaceChildren(...Array.from({ length: 28 }, (_, i) => {
			const piece = document.createElement("i");
			const angle = i / 28 * Math.PI * 2;
			const dist = rand(90, 170);
			piece.style.cssText = `--c:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};--x:${Math.cos(angle) * dist}px;--y:${Math.sin(angle) * dist}px;--r:${rand(-360, 360)}deg;--d:${rand(0, 120)}ms`;
			return piece;
		}));
	}
	async function verify() {
		busy = true;
		scatter();
		await wait(reduceMotion ? 0 : 320);
		setState("verify");
		say("Перевірка…");
		setProgress(0);
		const stop = runProgress();
		const res = await signIn(user.id, digits.join(""));
		stop();
		if (res.status === "ok") {
			setProgress(100);
			await wait(200);
			setState("success");
			say(`Вітаємо, ${user.name.split(" ")[0]}!`);
			burst();
			storage(LAST_KEY, user.id);
			if (!params.has("noredirect")) setTimeout(() => location.replace(safeNext() || homeFor(res.user)), 1600);
			return;
		}
		root.classList.add("is-failed");
		await wait(350);
		setState("pin");
		reset();
		busy = false;
		if (res.status === "locked") return lock(res.lockedUntil);
		pinEl.classList.add("is-error");
		if (res.status === "offline") say("Немає зв’язку з сервером. Спробуй ще раз.", true);
		else if (res.status === "throttled") say("Забагато спроб з цього телефона. Зачекай 15 хвилин.", true);
		else if (res.attemptsLeft == null) say("Невірний PIN", true);
		else say(`Невірний PIN. Залишилось ${res.attemptsLeft} ${plural(res.attemptsLeft)}`, true);
		navigator.vibrate?.([
			60,
			40,
			60
		]);
	}
	function lock(until) {
		setState("locked");
		pinEl.classList.add("is-error");
		const tick = () => {
			const left = Math.max(0, until - Date.now());
			say(`Забагато спроб. Спробуй через ${Math.floor(left / 6e4)}:${String(Math.floor(left % 6e4 / 1e3)).padStart(2, "0")} або звернись до адміністратора`, true);
			if (!left) {
				clearInterval(lockTimer);
				setState("pin");
				reset();
				say(`Введи PIN · ${user.pinLength} цифр${user.pinLength === 4 ? "и" : ""}`);
			}
		};
		tick();
		lockTimer = setInterval(tick, 1e3);
	}
	async function signIn(userId, pin) {
		try {
			return await authApi.login(userId, pin);
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			if (err.status === 0) return { status: "offline" };
			if (err.status === 429) return { status: "throttled" };
			return err.body?.status ? err.body : {
				status: "wrong",
				attemptsLeft: null
			};
		}
	}
	function safeNext() {
		const next = params.get("next") || "";
		return /^[\w-]+\.html(\?[^#]*)?$/.test(next) ? next : "";
	}
	const serverForm = $("[data-server-form]");
	async function reachable(url, ms = 6e3) {
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
	function showServerForm(canCancel) {
		root.dataset.state = "server";
		steps.pick.hidden = true;
		steps.pin.hidden = true;
		serverForm.hidden = false;
		$("[data-server-cancel]").hidden = !canCancel;
		serverForm.server.focus();
	}
	if (IS_APP) {
		const select = $("[data-server-select]");
		const list = savedServers();
		$("[data-server-line]").hidden = !serverUrl() || !devMode();
		let taps = [];
		$(".login__logo").addEventListener("click", () => {
			taps = [...taps.filter((t) => Date.now() - t < 3e3), Date.now()];
			if (taps.length < 5) return;
			taps = [];
			setDevMode(!devMode());
			$("[data-server-line]").hidden = !serverUrl() || !devMode();
		});
		select.setAttribute("data-no-i18n", "");
		select.replaceChildren(...list.map((s) => {
			const host = (s.url === currentSite()?.url ? serverUrl() : s.url).replace(/^https?:\/\//, "");
			return new Option(s.name === host ? host : `${s.name} · ${host}`, s.url);
		}));
		select.value = currentSite()?.url || serverUrl();
		list.forEach((s, i) => reachable(s.url, 4e3).then((ok) => {
			select.options[i].textContent = `${ok ? "●" : "○"} ${select.options[i].textContent.replace(/^[●○] /, "")}`;
		}));
		select.addEventListener("change", () => {
			setServerUrl(select.value);
			location.reload();
		});
		$("[data-server-add]").addEventListener("click", () => showServerForm(true));
		$("[data-server-forget]").addEventListener("click", () => {
			forgetServer(serverUrl());
			location.reload();
		});
		$("[data-server-cancel]").addEventListener("click", () => location.reload());
		const appInfo = window.Capacitor?.Plugins?.App?.getInfo?.();
		if (serverUrl() && appInfo) Promise.all([appInfo, fetch(`${serverUrl()}/downloads/version.json`, {
			cache: "no-store",
			headers: { "ngrok-skip-browser-warning": "1" }
		}).then((r) => r.ok ? r.json() : null)]).then(([mine, latest]) => {
			if (!latest?.versionCode || Number(latest.versionCode) <= Number(mine?.build || 0)) return;
			const link = $("[data-app-update]");
			link.href = `${serverUrl()}/install/`;
			link.hidden = false;
		}).catch(() => {});
		function normalize(raw) {
			let url = String(raw || "").trim().replace(/\/+$/, "");
			if (!url) return "";
			if (!/^https?:\/\//i.test(url)) url = `${/ngrok/i.test(url) ? "https" : "http"}://${url}`;
			try {
				if (!/:\d+$/.test(new URL(url).host) && !/ngrok|https:/i.test(url)) url = `${url}:3000`;
			} catch {
				return "";
			}
			return url;
		}
		async function connect(url, name) {
			if (!await reachable(url)) return false;
			let urls = [url];
			try {
				const info = await fetch(`${url}/api/server-info`, {
					cache: "no-store",
					headers: { "ngrok-skip-browser-warning": "1" }
				}).then((r) => r.ok ? r.json() : null);
				const more = [info?.lan, info?.ngrok].filter((u) => typeof u === "string" && /^https?:\/\//.test(u) && !/localhost|127\.0\.0\.1/.test(u));
				urls = [...new Set([url, ...more].map((u) => u.replace(/\/+$/, "")))];
			} catch {}
			setServerUrl(url, name, urls);
			location.reload();
			return true;
		}
		const serverError = $("[data-server-error]");
		function serverFail(text) {
			serverError.textContent = text;
			serverError.hidden = false;
		}
		serverForm.addEventListener("submit", async (e) => {
			e.preventDefault();
			const url = normalize(serverForm.server.value);
			if (!url) return serverForm.server.focus();
			const button = serverForm.querySelector("[type=\"submit\"]");
			button.classList.add("is-loading");
			button.disabled = true;
			serverError.hidden = true;
			if (await connect(url, serverForm.serverName.value)) return;
			serverFail(`Сервер ${url} не відповідає. Перевір адресу і що телефон у тій самій Wi-Fi мережі.`);
			button.classList.remove("is-loading");
			button.disabled = false;
		});
		const camera = $("[data-server-camera]");
		const video = $("[data-server-video]");
		const hint = $("[data-server-camera-hint]");
		let stream = null;
		function closeCamera() {
			camera.hidden = true;
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
		}
		async function found(text) {
			let url = "";
			try {
				const u = new URL(String(text).trim());
				if (/^https?:$/.test(u.protocol)) url = u.origin;
			} catch {}
			if (!url) {
				hint.textContent = "Це не QR-код сервера Yellow WMS";
				return false;
			}
			closeCamera();
			serverError.hidden = true;
			const scan = $("[data-server-scan]");
			scan.classList.add("is-loading");
			scan.disabled = true;
			if (await connect(url)) return true;
			serverFail(`Сервер ${url} не відповідає. Перевір адресу і що телефон у тій самій Wi-Fi мережі.`);
			scan.classList.remove("is-loading");
			scan.disabled = false;
			return true;
		}
		async function detect(detector) {
			if (camera.hidden) return;
			try {
				const [hit] = await detector.detect(video);
				if (hit && await found(hit.rawValue)) return;
			} catch {}
			setTimeout(() => detect(detector), 150);
		}
		$("[data-server-scan]").addEventListener("click", async () => {
			serverError.hidden = true;
			if (!("BarcodeDetector" in window)) return serverFail("На цьому телефоні сканування недоступне. Введи адресу вручну.");
			let detector;
			try {
				detector = new window.BarcodeDetector({ formats: ["qr_code"] });
			} catch {
				detector = new window.BarcodeDetector();
			}
			hint.textContent = "Наведи камеру на QR-код на екрані комп’ютера";
			camera.hidden = false;
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
				video.srcObject = stream;
				await video.play();
				detect(detector);
			} catch {
				closeCamera();
				serverFail("Камера недоступна. Введи адресу вручну.");
			}
		});
		root.querySelectorAll("[data-server-camera-close]").forEach((b) => b.addEventListener("click", () => {
			closeCamera();
			serverForm.server.focus();
		}));
		if (!serverUrl()) {
			showServerForm(false);
			return;
		}
	}
	setState("pick");
	loadUsers().then(() => {
		const preset = tiles.find((t) => t.dataset.id === params.get("user"));
		if (preset) pickUser(preset);
	});
}
routeReady.then(init, init);
//#endregion
