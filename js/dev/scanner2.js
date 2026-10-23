import { M as warehouseApi, O as stickersApi, R as perServer, a as can, c as idleLogout, h as defectsApi, i as translate, l as ready, m as chambersApi, n as locale, s as homeFor, y as ordersApi } from "./ui.min.js";
import { t as icon } from "./icon.min.js";
import { i as isoToday, n as esc } from "./format.min.js";
/* empty css           */
/* empty css                   */
import { a as thumbs, i as openReference, o as txt, r as openDefectPicker, t as loadCatalog } from "./_damage.min.js";
//#region src/components/services/opQueue.js
var KEY = perServer("yellow:ops");
var RETRY_MS = 15e3;
var items = load();
var flushing = false;
var lastSync = null;
var lastAttempt = null;
function load() {
	try {
		return JSON.parse(localStorage.getItem(KEY)) || [];
	} catch {
		return [];
	}
}
function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(items));
	} catch {}
	window.dispatchEvent(new CustomEvent("ops:change"));
}
var pending = () => items.filter((i) => i.status === "pending");
var rejected = () => items.filter((i) => i.status === "rejected");
var newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
function enqueue({ op, body, title, sub = "" }) {
	const item = {
		opId: newId(),
		op,
		body: { ...body },
		title,
		sub,
		at: (/* @__PURE__ */ new Date()).toISOString(),
		status: "pending"
	};
	item.body.opId = item.opId;
	items.push(item);
	save();
	flush();
	return item;
}
function remove(opId) {
	items = items.filter((i) => i.opId !== opId);
	save();
}
function retry(opId) {
	const item = items.find((i) => i.opId === opId);
	if (!item) return;
	item.status = "pending";
	item.error = null;
	save();
	flush();
}
async function flush() {
	if (flushing) return;
	flushing = true;
	try {
		for (const item of pending()) {
			lastAttempt = /* @__PURE__ */ new Date();
			try {
				const result = await warehouseApi.send(item.op, item.body);
				items = items.filter((i) => i.opId !== item.opId);
				lastSync = /* @__PURE__ */ new Date();
				save();
				window.dispatchEvent(new CustomEvent("ops:sent", { detail: {
					item,
					result
				} }));
			} catch (err) {
				if (err.status === 0 || err.status >= 500 || err.status === 401 || err.status === 429 || err.code === "device_not_trusted") break;
				item.status = "rejected";
				item.error = err.body?.error || err.message;
				save();
			}
		}
	} finally {
		flushing = false;
		window.dispatchEvent(new CustomEvent("ops:change"));
	}
}
window.addEventListener("online", flush);
setInterval(() => pending().length && flush(), RETRY_MS);
//#endregion
//#region src/components/pages/scanner/_issue.js
var DRAFT_KEY = perServer("yellow:issue");
var CACHE_KEY = perServer("yellow:issue-orders");
var NO_STICKER = "WITHOUT_STICKER";
var PLANTATION_RE = /^[A-Z]{2,6}\d{1,6}$/;
var SERIAL_COOLDOWN_MS = 400;
var FORMATS = [
	"code_128",
	"code_39",
	"code_93",
	"itf",
	"ean_13",
	"ean_8",
	"upc_a",
	"codabar",
	"qr_code",
	"data_matrix",
	"pdf417"
];
var read = (key) => {
	try {
		return JSON.parse(localStorage.getItem(key)) || null;
	} catch {
		return null;
	}
};
var write = (key, value) => {
	try {
		value ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key);
	} catch {}
};
function orderParts(o) {
	const [title, ...rest] = String(o.name || o.copyTitle || o.orderKey || "").split(" | ");
	return {
		title: title || "—",
		sub: rest.filter((p) => p && p !== "?").join(" · ")
	};
}
function buildLines(order, count, twoSides) {
	const qty = Number(order.qty) || 0;
	const bpp = Number(order.boxesPerPallet) || 0;
	const palRaw = Number(order.pal) || 0;
	const pal = Math.max(1, Math.ceil(palRaw > 0 ? palRaw : bpp > 0 ? qty / bpp : 1));
	const n = Math.max(1, Math.min(Number(count) || 1, pal));
	const lines = [];
	const base = Math.floor(pal / n);
	let rest = pal % n;
	let cumPal = 0;
	let prev = 0;
	for (let i = 0; i < n; i++) {
		const pallets = base + (rest-- > 0 ? 1 : 0);
		cumPal += pallets;
		const cum = Math.round(qty * cumPal / pal);
		const boxes = cum - prev;
		prev = cum;
		const s1 = twoSides ? Math.floor(boxes / 2) : boxes;
		lines.push({
			pallets,
			boxes,
			sides: twoSides ? [s1, boxes - s1] : [s1]
		});
	}
	return lines;
}
function scannedBy(lines, scans) {
	const out = lines.map((l) => l.sides.map(() => 0));
	for (const s of scans) if (out[s.line]?.[s.side] !== void 0) out[s.line][s.side] += s.qty;
	return out;
}
function nextSlot(lines, scans) {
	const done = scannedBy(lines, scans);
	for (let l = 0; l < lines.length; l++) for (let s = 0; s < lines[l].sides.length; s++) if (done[l][s] < lines[l].sides[s]) return {
		line: l,
		side: s
	};
	return null;
}
function addBoxes(lines, scans, active, code, qty) {
	const done = scannedBy(lines, scans);
	const order = [];
	for (let l = 0; l < lines.length; l++) for (let s = 0; s < lines[l].sides.length; s++) order.push({
		line: l,
		side: s
	});
	const start = Math.max(0, order.findIndex((o) => o.line === active.line && o.side === active.side));
	let left = qty;
	const added = [];
	for (const o of [...order.slice(start), ...order.slice(0, start)]) {
		const room = lines[o.line].sides[o.side] - done[o.line][o.side];
		if (room <= 0 || left <= 0) continue;
		const q = Math.min(room, left);
		added.push({
			code,
			qty: q,
			line: o.line,
			side: o.side
		});
		left -= q;
	}
	return {
		added,
		over: left
	};
}
var boxCountsOf = (scans) => scans.reduce((acc, s) => (acc[s.code] = (acc[s.code] || 0) + s.qty, acc), {});
function initIssue({ $, $$, slot, show, reset, toast, openCamera, commit, can, fmt, plural, normalize, codeRe, isOffline }) {
	const S = {
		matches: /* @__PURE__ */ new Map(),
		stock: /* @__PURE__ */ new Map(),
		date: isoToday(),
		orders: [],
		scanned: /* @__PURE__ */ new Set(),
		savedHere: /* @__PURE__ */ new Set(),
		draft: read(DRAFT_KEY),
		pick: null
	};
	const saveDraft = () => write(DRAFT_KEY, S.draft);
	const total = (scans) => scans.reduce((t, s) => t + s.qty, 0);
	const dateInput = $("[data-issue-date]");
	const list = slot("issue-orders");
	dateInput.value = S.date;
	async function loadOrders() {
		S.date = dateInput.value || isoToday();
		list.innerHTML = "<p class=\"screen__hint\">Завантаження…</p>";
		try {
			const [orders, status] = await Promise.all([ordersApi.list(S.date), ordersApi.status(S.date)]);
			S.orders = Array.isArray(orders) ? orders : [];
			S.scanned = /* @__PURE__ */ new Set([...status?.scanned || [], ...S.savedHere]);
			write(CACHE_KEY, {
				date: S.date,
				orders: S.orders,
				scanned: [...S.scanned]
			});
		} catch (err) {
			const cache = read(CACHE_KEY);
			if (err.status !== 0 || cache?.date !== S.date) {
				list.innerHTML = `<p class="screen__hint screen__hint--bad">${err.status === 0 ? "Немає мережі — список замовлень недоступний" : "Помилка сервера"}</p>`;
				return;
			}
			S.orders = cache.orders;
			S.scanned = /* @__PURE__ */ new Set([...cache.scanned, ...S.savedHere]);
			toast("error", "Немає мережі", "Список замовлень з телефона");
		}
		renderOrders();
	}
	function renderOrders() {
		const d = S.draft;
		const draftCard = d ? `<button type="button" class="issue-order issue-order--draft" data-issue-resume>
				<span class="issue-order__text"><b>Продовжити видачу</b><span>${esc(orderParts(d.order).title)} · ${fmt(total(d.scans))} з ${fmt(d.order.qty)} ящ.</span></span>
				<span class="chip chip--sm">${esc(d.date.slice(8, 10))}.${esc(d.date.slice(5, 7))}</span>
			</button>` : "";
		const rows = S.orders.map((o, i) => {
			const p = orderParts(o);
			const done = S.scanned.has(o.orderKey || o.id);
			return `<button type="button" class="issue-order${done ? " issue-order--done" : ""}" data-issue-order="${i}">
				<span class="issue-order__text"><b>${esc(p.title)}</b><span>${esc(p.sub)}</span></span>
				<span class="issue-order__qty"><b>${fmt(o.qty)}</b><small>${fmt(Math.ceil(Number(o.pal) || 0))} пал.</small></span>
				${done ? "<span class=\"chip chip--sm chip--bio\">готово</span>" : ""}
			</button>`;
		});
		list.innerHTML = draftCard + (rows.length ? rows.join("") : "<p class=\"screen__hint\">Немає замовлень на цей день</p>");
	}
	dateInput.addEventListener("change", loadOrders);
	$$("[data-issue-day]").forEach((b) => b.addEventListener("click", () => {
		const d = /* @__PURE__ */ new Date();
		d.setDate(d.getDate() + Number(b.dataset.issueDay));
		dateInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		loadOrders();
	}));
	list.addEventListener("click", (e) => {
		if (e.target.closest("[data-issue-resume]")) return show("issue-scan");
		const btn = e.target.closest("[data-issue-order]");
		if (!btn) return;
		const order = S.orders[Number(btn.dataset.issueOrder)];
		if (S.draft && S.draft.order.orderKey !== order.orderKey && total(S.draft.scans) > 0) return toast("error", "Є незавершена видача", "Збережи або скасуй її спочатку");
		S.pick = {
			...order,
			orderKey: order.orderKey || order.id
		};
		show("issue-prep");
	});
	const countInput = $("[data-issue-lines]");
	const modeSeg = $("[data-segmented=\"issue-mode\"]");
	const prepMode = () => modeSeg.querySelector("[aria-checked=\"true\"]")?.dataset.value || "serial";
	const twoSides = () => prepMode() === "serial";
	function renderPrep() {
		const o = S.pick;
		if (!o) return;
		const p = orderParts(o);
		slot("issue-prep-title").textContent = p.title;
		slot("issue-prep-sub").textContent = p.sub;
		slot("issue-prep-qty").textContent = `${fmt(o.qty)} ящ. · ${fmt(Math.ceil(Number(o.pal) || 0))} пал.`;
		const zero = !(Number(o.qty) > 0);
		$("[data-issue-confirm]").hidden = !zero;
		$("[data-issue-start]").disabled = zero;
		if (zero) return slot("issue-lines-preview").innerHTML = "";
		const lines = buildLines(o, countInput.value, twoSides());
		if (Number(countInput.value) !== lines.length) countInput.value = lines.length;
		slot("issue-lines-preview").innerHTML = lines.map((l, i) => `<li><span>Лінія ${i + 1}</span><b>${l.sides.map(fmt).join(" + ")}</b><small>${fmt(l.pallets)} пал.</small></li>`).join("");
	}
	countInput.addEventListener("input", renderPrep);
	$$("[data-issue-step]").forEach((b) => b.addEventListener("click", () => {
		countInput.value = Math.max(1, (Number(countInput.value) || 1) + Number(b.dataset.issueStep));
		renderPrep();
	}));
	document.addEventListener("segmented:change", ({ detail }) => detail.name === "issue-mode" && renderPrep());
	$("[data-issue-confirm-save]").addEventListener("click", async () => {
		const qty = Number($("[data-issue-confirm-qty]").value);
		if (!(qty > 0)) return toast("error", "Вкажи кількість ящиків");
		try {
			const r = await ordersApi.updateQty({
				orderKey: S.pick.orderKey,
				date: S.date,
				qty
			});
			S.pick.qty = r.updated?.qty ?? qty;
			if (r.updated?.pal) S.pick.pal = r.updated.pal;
			toast("success", "Кількість підтверджено", `${fmt(S.pick.qty)} ящ.`);
			renderPrep();
		} catch (err) {
			toast("error", err.status === 0 ? "Немає мережі" : "Не збережено", err.message);
		}
	});
	const stkChamber = $("[data-stk-chamber]");
	const stkPlant = $("[data-stk-plant]");
	const stkTpl = $("[data-stk-template]");
	const stkCopies = $("[data-stk-copies]");
	const stkInputs = slot("stk-inputs");
	const stkView = slot("stk-preview");
	const stkInfo = slot("stk-info");
	const stkWarn = slot("stk-warn");
	const stkPrint = $("[data-stk-print]");
	const stkGlnRow = $("[data-stk-gln-row]");
	const stkGln = $("[data-stk-gln]");
	const stkGlnSrc = slot("stk-gln-src");
	const stkLogBox = $("[data-stk-log]");
	const stkLog = slot("stk-log");
	let stkLast = null;
	const GLN_SOURCE = {
		"ggn-file": "GLN з файлу GGN",
		saved: "GLN, збережений раніше",
		config: "GLN з налаштувань",
		template: "Стандартний GLN шаблону — перевір постачальника"
	};
	let stkTimer = null;
	let stkOk = false;
	const WARN = [
		[/no stock in chamber/, "У коморі немає товару"],
		[/fits the client colour/, "Колір у коморі не підходить клієнту — перевір"],
		[/plantation code unknown/, "Код плантації невідомий — введи його"],
		[/not in the GGN data/, "Плантації немає в даних GGN"],
		[/no sticker template/, "Немає шаблону для цього клієнта — вибери"]
	];
	const warnText = (w) => WARN.find(([re]) => re.test(w))?.[1] || w;
	function stkBody() {
		const inputs = Object.fromEntries($$("[data-stk-input]", stkInputs).map((i) => [i.dataset.stkInput, i.value.trim()]));
		const typedGln = stkGln.value.replace(/\D/g, "");
		if (typedGln.length === 13 && typedGln !== stkLast?.data?.gln) inputs.gln = typedGln;
		return {
			orderKey: S.pick?.orderKey,
			date: S.date,
			chamberNum: Number(stkChamber.value) || null,
			plantationCode: stkPlant.value.trim(),
			templateId: stkTpl.value,
			inputs
		};
	}
	function stkReset() {
		stkChamber.value = "";
		stkPlant.value = "";
		stkTpl.value = "";
		stkInputs.innerHTML = "";
		stkGln.value = "";
		stkGlnRow.hidden = true;
		stkGlnSrc.textContent = "";
		stkLast = null;
		stkView.innerHTML = "";
		stkInfo.textContent = "";
		stkWarn.hidden = true;
		stkCopies.value = Math.max(1, Number(S.pick?.qty) || 1);
		stkOk = false;
		stkPrint.disabled = true;
		stkLoadLog();
	}
	async function stkLoadLog() {
		const orderKey = S.pick?.orderKey;
		stkLogBox.hidden = true;
		if (!orderKey) return;
		let prints = [];
		try {
			prints = (await stickersApi.log({
				date: S.date,
				orderKey
			})).prints || [];
		} catch {
			return;
		}
		if (S.pick?.orderKey !== orderKey) return;
		stkLog.innerHTML = prints.map((p) => {
			const time = new Date(p.at).toTimeString().slice(0, 5);
			return `<li><b>${fmt(p.copies)}</b> · LOT ${esc(p.lot || "—")} · GGN ${esc(p.ggn || "—")} · ${esc(p.container || p.plantation || "—")}<span>${time}${p.by ? ` · ${esc(p.by)}` : ""}</span></li>`;
		}).join("");
		stkLogBox.hidden = !prints.length;
	}
	async function stkPreview() {
		if (!S.pick || !stkChamber.value && !stkPlant.value.trim()) return;
		let r;
		try {
			r = await stickersApi.preview(stkBody());
		} catch (err) {
			stkWarn.hidden = false;
			stkWarn.textContent = err.status === 0 ? "Немає мережі" : err.message;
			return;
		}
		if (!stkTpl.options.length || stkTpl.options.length !== r.templates.length + 1) stkTpl.innerHTML = `<option value="">${esc(translate("(автоматично)"))}</option>${r.templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}`;
		const need = r.template?.inputs || [];
		if (stkInputs.dataset.tpl !== r.template?.id) {
			stkInputs.dataset.tpl = r.template?.id || "";
			stkInputs.innerHTML = need.map((i) => `<label class="field"><span class="field__label">${esc(i.label)}</span><input class="field__input" data-stk-input="${esc(i.key)}"></label>`).join("");
		}
		stkPlant.placeholder = r.plantationCode || "напр. BAN215";
		stkLast = r;
		stkGlnRow.hidden = !r.needsGln;
		if (r.needsGln && document.activeElement !== stkGln) stkGln.value = r.data?.gln || "";
		stkGlnSrc.textContent = r.needsGln ? GLN_SOURCE[r.glnSource] || "GLN немає — введи його" : "";
		stkView.innerHTML = r.svg || "";
		stkInfo.innerHTML = r.template ? [
			r.template.name,
			r.containerNumber,
			r.plantationCode && `<span>плантація ${esc(r.plantationCode)}</span>`,
			r.data?.ggn && `GGN ${esc(r.data.ggn)}`,
			r.data?.lot && `LOT ${esc(r.data.lot)}`
		].filter(Boolean).map((x) => `<span>${x}</span>`).join(" · ") : "";
		const warns = [...(r.warnings || []).map(warnText), ...r.missing?.length ? [`Бракує: ${r.missing.join(", ")}`] : []];
		stkWarn.hidden = !warns.length;
		stkWarn.innerHTML = warns.map((w) => `<span>${esc(w)}</span>`).join("<br>");
		stkOk = Boolean(r.template && r.svg && !r.missing?.length && r.data?.ggn);
		stkPrint.disabled = !stkOk;
	}
	const stkSoon = () => {
		clearTimeout(stkTimer);
		stkTimer = setTimeout(stkPreview, 400);
	};
	stkChamber.addEventListener("input", stkSoon);
	stkPlant.addEventListener("input", stkSoon);
	stkTpl.addEventListener("change", () => {
		stkInputs.dataset.tpl = "";
		stkPreview();
	});
	stkInputs.addEventListener("input", stkSoon);
	stkGln.addEventListener("input", stkSoon);
	$("[data-stk-gln-save]").addEventListener("click", async () => {
		const gln = stkGln.value.replace(/\D/g, "");
		if (gln.length !== 13) return toast("error", "GLN — 13 цифр");
		try {
			await stickersApi.saveGln({
				gln,
				supplier: stkLast?.data?.supplier || "",
				plantationCode: stkLast?.plantationCode || stkPlant.value.trim()
			});
			toast("success", "GLN збережено", stkLast?.data?.supplier || stkLast?.plantationCode || "");
			stkPreview();
		} catch (err) {
			toast("error", "GLN не збережено", err.status === 0 ? "Немає мережі" : err.body?.error || err.message);
		}
	});
	stkPrint.addEventListener("click", async () => {
		if (!stkOk) return;
		const copies = Math.max(1, Number(stkCopies.value) || 1);
		stkPrint.disabled = true;
		try {
			const r = await stickersApi.print({
				...stkBody(),
				copies
			});
			toast("success", `Надруковано ${fmt(r.printed)} стікерів`, `GGN ${r.ggn}`);
			stkLoadLog();
		} catch (err) {
			toast("error", "Стікери не надруковано", err.status === 0 ? "Немає мережі" : err.body?.error || err.message);
		} finally {
			stkPrint.disabled = !stkOk;
		}
	});
	$("[data-issue-start]").addEventListener("click", () => {
		const o = S.pick;
		const lines = buildLines(o, countInput.value, twoSides());
		const same = S.draft?.order.orderKey === o.orderKey && JSON.stringify(S.draft.lines) === JSON.stringify(lines);
		S.draft = same ? {
			...S.draft,
			mode: prepMode()
		} : {
			date: S.date,
			order: o,
			count: lines.length,
			mode: prepMode(),
			lines,
			scans: [],
			active: {
				line: 0,
				side: 0
			}
		};
		saveDraft();
		show("issue-scan");
	});
	const scanForm = $("[data-issue-form]");
	const lastEl = slot("issue-last");
	const modeOf = () => S.draft?.mode || "serial";
	function renderScan() {
		const d = S.draft;
		if (!d) return;
		const done = scannedBy(d.lines, d.scans);
		const got = total(d.scans);
		slot("issue-scan-title").textContent = orderParts(d.order).title;
		$$("[data-issue-mode-only]").forEach((el) => el.hidden = el.dataset.issueModeOnly !== modeOf());
		slot("issue-progress-text").textContent = `${fmt(got)} з ${fmt(d.order.qty)} ящ.`;
		slot("issue-progress").style.setProperty("--value", `${Math.min(100, Math.round(got / (Number(d.order.qty) || 1) * 100))}%`);
		slot("issue-lines").innerHTML = d.lines.map((l, li) => `<li class="issue-line">
			<span class="issue-line__num">${li + 1}</span>
			${l.sides.map((target, si) => {
			const on = d.active.line === li && d.active.side === si;
			const full = done[li][si] >= target;
			return `<button type="button" class="issue-line__side${on ? " is-active" : ""}${full ? " is-full" : ""}" data-issue-slot="${li}:${si}" aria-pressed="${on}">
					${l.sides.length > 1 ? `<small>${si ? "права" : "ліва"}</small>` : ""}<b>${fmt(done[li][si])}</b> / ${fmt(target)}
				</button>`;
		}).join("")}
		</li>`).join("");
		$("[data-issue-undo]").disabled = !d.scans.length;
	}
	slot("issue-lines").addEventListener("click", (e) => {
		const b = e.target.closest("[data-issue-slot]");
		if (!b) return;
		const [line, side] = b.dataset.issueSlot.split(":").map(Number);
		S.draft.active = {
			line,
			side
		};
		saveDraft();
		renderScan();
		scanForm.elements.code.focus();
	});
	const scannedFor = (code) => (S.draft?.scans || []).filter((x) => x.code === code).reduce((t, x) => t + x.qty, 0);
	async function stockOf(code) {
		if (code === NO_STICKER) return null;
		if (S.stock.has(code)) return S.stock.get(code);
		let left = null;
		try {
			const r = await warehouseApi.lookup(code);
			if (r.state === "in-chamber") left = (r.placements || []).reduce((t, p) => t + (Number(p.remaining) || 0), 0);
			else if (r.state === "depleted") left = 0;
		} catch {}
		S.stock.set(code, left);
		return left;
	}
	function leftAfter(code, extra = 0) {
		const inChambers = S.stock.get(code);
		return inChambers == null ? null : inChambers - scannedFor(code) - extra;
	}
	const tone = (left) => left == null ? "unknown" : left < 0 ? "bad" : left === 0 ? "warn" : "ok";
	function stockLine(code, extra = 0) {
		const left = leftAfter(code, extra);
		if (left == null) return {
			tone: "unknown",
			html: `${esc(code)} · залишок у коморах невідомий`
		};
		return {
			tone: tone(left),
			html: left < 0 ? `${esc(code)} · більше, ніж є в коморах, на <b>${fmt(-left)}</b> ящ.` : `${esc(code)} · у коморах залишиться <b>${fmt(left)}</b> ящ.`
		};
	}
	const stockEl = slot("issue-stock");
	function renderStock(code) {
		if (!code || code === NO_STICKER) return stockEl.hidden = true;
		const { tone: t, html } = stockLine(code);
		stockEl.hidden = false;
		stockEl.className = `issue__stock issue__stock--${t}`;
		stockEl.innerHTML = html;
	}
	function checkStock(code) {
		if (code === NO_STICKER) return;
		const known = S.stock.has(code);
		stockOf(code).then(() => {
			if (S.lastCode === code) renderStock(code);
			if (pending?.code === code) renderQtyStock();
			if (!known) warnIfOver(code);
		});
	}
	function warnIfOver(code) {
		const left = leftAfter(code);
		if (left != null && left < 0) toast("error", "Більше, ніж залишок у контейнері", `${code}: у коморах ${fmt(S.stock.get(code))} ящ.`);
	}
	function add(code, qty) {
		const d = S.draft;
		const { added, over } = addBoxes(d.lines, d.scans, d.active, code, qty);
		if (!added.length) return toast("error", "Усе вже відскановано", `Замовлено ${fmt(d.order.qty)} ящ.`);
		d.scans.push(...added);
		d.active = nextSlot(d.lines, d.scans) || d.active;
		saveDraft();
		if (code !== NO_STICKER) S.lastCode = code;
		lastEl.innerHTML = `<span>+${total(added)} ${code === NO_STICKER ? "без наклейки" : esc(code)}</span>${via.has(code) ? ` ← ${via.get(code)}` : ""}`;
		renderStock(S.lastCode);
		if (S.stock.has(code)) warnIfOver(code);
		else checkStock(code);
		if (over > 0) toast("error", `Більше, ніж замовлено, на ${over} ящ.`, "Зайве не записано");
		renderScan();
		if (!nextSlot(d.lines, d.scans)) toast("success", "Замовлення відскановано", "Перевір підсумок");
	}
	const via = /* @__PURE__ */ new Map();
	async function resolveCode(raw, { quiet = false } = {}) {
		const code = normalize(raw);
		if (codeRe.test(code)) return code;
		if (!PLANTATION_RE.test(code)) return quiet ? null : (toast("error", "Невірний код", code || "порожньо"), null);
		if (!S.matches.has(code)) {
			if (isOffline()) return quiet ? null : (toast("error", "Немає мережі", `${code}: контейнер не підібрати`), null);
			try {
				const m = await warehouseApi.match({
					code,
					orderKey: S.draft.order.orderKey,
					date: S.draft.date
				});
				S.matches.set(code, m.best || null);
				if (!m.best && !quiet) {
					const list = m.candidates.map((c) => `${c.containerNumber} ${c.color || "?"}`).join(", ");
					toast("error", m.candidates.length ? "Немає контейнера з кольором клієнта" : "Не знайдено в залишку", list ? `${code}: ${list}` : code);
				}
			} catch (err) {
				return quiet ? null : (toast("error", "Помилка сервера", err.message), null);
			}
		}
		const best = S.matches.get(code);
		if (!best) return null;
		via.set(best.containerNumber, [
			code,
			best.chamberNum && `комора ${best.chamberNum} ${best.side || ""}`.trim(),
			best.color
		].filter(Boolean).map((x) => `<span>${esc(String(x))}</span>`).join(" · "));
		return best.containerNumber;
	}
	scanForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const raw = scanForm.elements.code.value;
		scanForm.reset();
		const code = await resolveCode(raw);
		if (!code) return scanForm.elements.code.focus();
		if (modeOf() === "serial") {
			add(code, 1);
			return scanForm.elements.code.focus();
		}
		openQty(code);
	});
	const qtyPanel = $("[data-issue-qtypanel]");
	const qtyPicker = $("[data-issue-picker]", qtyPanel);
	let pending = null;
	function restOfActive() {
		const d = S.draft;
		const done = scannedBy(d.lines, d.scans);
		return Math.max(0, d.lines[d.active.line].sides[d.active.side] - done[d.active.line][d.active.side]);
	}
	function setPick(qty) {
		pending.qty = qty;
		slot("issue-qty-label").textContent = fmt(qty || 0);
		$("[data-issue-qty-add]").disabled = !(qty > 0);
		renderQtyStock();
	}
	function renderQtyStock() {
		const el = slot("issue-qty-stock");
		if (!pending) return;
		const { tone: t, html } = stockLine(pending.code, pending.qty || 0);
		el.className = `issue__stock issue__stock--${t}`;
		el.innerHTML = S.stock.has(pending.code) ? html : `${esc(pending.code)} · перевіряю залишок…`;
	}
	function openQty(code, { resume = false } = {}) {
		const d = S.draft;
		const rest = restOfActive();
		const bpp = Number(d.order.boxesPerPallet) || 0;
		const left = (Number(d.order.qty) || 0) - total(d.scans);
		const options = [...new Set([
			bpp,
			rest,
			left
		].filter((n) => n > 0))];
		pending = {
			code,
			qty: 0,
			resume
		};
		checkStock(code);
		slot("issue-qty-code").textContent = code;
		$(".qty-picker__options", qtyPicker).innerHTML = options.map((n, i) => `<button type="button" class="qty-picker__option${i ? "" : " qty-picker__option--active"}" role="radio" aria-checked="${!i}" data-value="${n}">${fmt(n)}<span class="qty-picker__sub">${n === bpp ? "палета" : n === rest ? "решта лінії" : "решта"}</span></button>`).join("");
		$(".qty-picker__manual input", qtyPicker).value = "";
		setPick(options[0] || 0);
		qtyPanel.hidden = false;
		scanForm.hidden = true;
		qtyPanel.scrollIntoView({ block: "nearest" });
	}
	function closeQty() {
		pending = null;
		qtyPanel.hidden = true;
		scanForm.hidden = false;
		scanForm.elements.code.focus();
	}
	qtyPicker.addEventListener("qty:change", (e) => {
		e.stopPropagation();
		if (pending) setPick(e.detail.value);
	});
	$("[data-issue-qty-add]").addEventListener("click", () => {
		if (!pending?.qty) return;
		const { code, qty, resume } = pending;
		closeQty();
		add(code, qty);
		if (resume && modeOf() === "serial" && nextSlot(S.draft.lines, S.draft.scans)) startSerial();
	});
	async function typeQty({ resume = false } = {}) {
		const typed = scanForm.elements.code.value.trim();
		scanForm.reset();
		const code = typed ? await resolveCode(typed) : S.lastCode;
		if (!code) return typed ? null : toast("error", "Спершу відскануй код");
		openQty(code, { resume });
	}
	$("[data-issue-typeqty]").addEventListener("click", () => typeQty());
	$("[data-issue-qty-cancel]").addEventListener("click", closeQty);
	const overlay = $("[data-camera-overlay]");
	const video = $("[data-camera-video]");
	const hint = $(".camera-overlay__hint", overlay);
	let serial = null;
	const camQty = $("[data-issue-cam-qty]", overlay);
	camQty.addEventListener("click", () => {
		closeSerial();
		typeQty({ resume: true });
	});
	$("[data-issue-camera]").addEventListener("click", () => modeOf() === "serial" ? startSerial() : openCamera(scanForm));
	function serialHint() {
		const d = S.draft;
		const side = d.lines[d.active.line].sides.length > 1 ? ` · ${d.active.side ? "права" : "ліва"}` : "";
		hint.textContent = `${fmt(total(d.scans))} з ${fmt(d.order.qty)} ящ. · Лінія ${d.active.line + 1}${side}`;
	}
	async function startSerial() {
		overlay.hidden = false;
		overlay.classList.add("camera-overlay--serial");
		camQty.hidden = false;
		serial = {
			stream: null,
			lastAt: 0
		};
		serialHint();
		try {
			serial.stream = await navigator.mediaDevices.getUserMedia({ video: {
				facingMode: "environment",
				width: { ideal: 1280 },
				height: { ideal: 720 },
				advanced: [{ focusMode: "continuous" }]
			} });
			video.srcObject = serial.stream;
			await video.play();
			if (!("BarcodeDetector" in window)) throw new Error("no detector");
			const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
			const formats = FORMATS.filter((f) => supported.includes(f));
			loop(formats.length ? new window.BarcodeDetector({ formats }) : new window.BarcodeDetector());
		} catch {
			hint.textContent = "Камера недоступна. Введи код вручну.";
		}
	}
	async function loop(detector) {
		if (!serial || overlay.hidden) return stopSerial();
		try {
			const [hit] = await detector.detect(video);
			const raw = hit && normalize(hit.rawValue);
			if (raw && (codeRe.test(raw) || PLANTATION_RE.test(raw)) && Date.now() - serial.lastAt > SERIAL_COOLDOWN_MS) {
				serial.lastAt = Date.now();
				const code = await resolveCode(raw, { quiet: S.matches.has(raw) });
				if (!code || !serial) return requestAnimationFrame(() => loop(detector));
				add(code, 1);
				navigator.vibrate?.(40);
				overlay.classList.add("is-hit");
				setTimeout(() => overlay.classList.remove("is-hit"), 120);
				if (!nextSlot(S.draft.lines, S.draft.scans)) return closeSerial();
				serialHint();
			}
		} catch {}
		requestAnimationFrame(() => loop(detector));
	}
	function stopSerial() {
		serial?.stream?.getTracks().forEach((t) => t.stop());
		serial = null;
		overlay.classList.remove("camera-overlay--serial");
		camQty.hidden = true;
	}
	function closeSerial() {
		overlay.hidden = true;
		stopSerial();
	}
	$$("[data-camera-close]", overlay).forEach((b) => b.addEventListener("click", stopSerial));
	const nl = $("[data-issue-nolabel]");
	const nlChamber = $("[data-issue-nl-chamber]", nl);
	const nlPlant = $("[data-issue-nl-plant]", nl);
	const nlQty = $("[data-issue-nl-qty]", nl);
	const nlList = slot("issue-nl-list");
	let nlPick = null;
	let nlCandidates = [];
	function nlRender() {
		const qty = Number(nlQty.value) || 0;
		slot("issue-nl-label").textContent = fmt(qty);
		$("[data-issue-nl-add]", nl).disabled = !(qty > 0 && nlPick);
		$("[data-issue-nl-plain]", nl).disabled = !(qty > 0);
	}
	function nlOpen() {
		const rest = restOfActive();
		if (rest <= 0) return toast("error", "Ця лінія вже повна");
		nlQty.value = rest;
		nlChamber.value = "";
		nlPlant.value = "";
		nlList.innerHTML = "";
		nlPick = null;
		nlCandidates = [];
		nl.hidden = false;
		scanForm.hidden = true;
		nlRender();
		nl.scrollIntoView({ block: "nearest" });
		nlChamber.focus();
	}
	function nlClose() {
		nl.hidden = true;
		scanForm.hidden = false;
		scanForm.elements.code.focus();
	}
	$("[data-issue-nosticker]").addEventListener("click", nlOpen);
	$("[data-issue-nl-cancel]", nl).addEventListener("click", nlClose);
	nlQty.addEventListener("input", nlRender);
	$("[data-issue-nl-find]", nl).addEventListener("click", async () => {
		const chamberNum = Number(nlChamber.value) || null;
		const code = normalize(nlPlant.value);
		if (!chamberNum && !code) return toast("error", "Вкажи комору або код плантації");
		if (isOffline()) return toast("error", "Немає мережі", "Додай без номера — підбір пізніше неможливий");
		nlList.innerHTML = "<p class=\"screen__hint\">Завантаження…</p>";
		let m;
		try {
			m = await warehouseApi.match({
				code,
				chamberNum,
				orderKey: S.draft.order.orderKey,
				date: S.draft.date
			});
		} catch (err) {
			nlList.innerHTML = "";
			return toast("error", "Помилка сервера", err.message);
		}
		nlCandidates = m.candidates || [];
		nlPick = m.best || null;
		const range = m.clientColor ? `${m.clientColor.min === m.clientColor.max ? m.clientColor.min : `${m.clientColor.min}–${m.clientColor.max}`}` : "";
		nlList.innerHTML = (range ? `<p class="screen__hint"><span>Колір клієнта</span> <b>${esc(range)}</b></p>` : "") + (nlCandidates.length ? nlCandidates.map((c, i) => `<button type="button" class="issue-cand issue-cand--${c.fits === true ? "ok" : c.fits === false ? "bad" : "unknown"}${nlPick?.containerNumber === c.containerNumber && nlPick?.side === c.side ? " is-active" : ""}" data-cand="${i}">
				<b>${esc(c.containerNumber)}</b>
				<span><span>комора ${c.chamberNum} ${esc(c.side || "")}</span> · <span>колір ${esc(c.color || "?")}</span> · <span>залишок ${fmt(c.remaining)}</span></span>
				${c.fits === false ? "<small>колір не підходить</small>" : ""}
			</button>`).join("") : "<p class=\"screen__hint screen__hint--bad\">Не знайдено в залишку</p>");
		nlRender();
	});
	nlList.addEventListener("click", (e) => {
		const b = e.target.closest("[data-cand]");
		if (!b) return;
		nlPick = nlCandidates[Number(b.dataset.cand)];
		$$("[data-cand]", nlList).forEach((x) => x.classList.toggle("is-active", x === b));
		nlRender();
	});
	$("[data-issue-nl-add]", nl).addEventListener("click", () => {
		const qty = Number(nlQty.value) || 0;
		if (!nlPick || !(qty > 0)) return;
		via.set(nlPick.containerNumber, [
			`комора ${nlPick.chamberNum} ${nlPick.side || ""}`.trim(),
			nlPick.color,
			"без наклейки"
		].filter(Boolean).map((x) => `<span>${esc(String(x))}</span>`).join(" · "));
		const code = nlPick.containerNumber;
		nlClose();
		add(code, qty);
	});
	$("[data-issue-nl-plain]", nl).addEventListener("click", () => {
		const qty = Number(nlQty.value) || 0;
		if (!(qty > 0)) return;
		nlClose();
		add(NO_STICKER, qty);
	});
	$("[data-issue-undo]").addEventListener("click", () => {
		const d = S.draft;
		const last = d.scans.pop();
		if (!last) return;
		d.active = {
			line: last.line,
			side: last.side
		};
		saveDraft();
		lastEl.textContent = `−${last.qty} ${last.code === NO_STICKER ? "без наклейки" : last.code}`;
		renderScan();
	});
	$("[data-issue-cancel]").addEventListener("click", () => {
		const d = S.draft;
		if (d && total(d.scans) && !confirmTwice($("[data-issue-cancel]"))) return;
		S.draft = null;
		saveDraft();
		reset("issue-orders");
	});
	function confirmTwice(btn) {
		if (btn.dataset.armed) return true;
		btn.dataset.armed = "1";
		const label = btn.textContent;
		btn.textContent = "Натисни ще раз";
		setTimeout(() => {
			delete btn.dataset.armed;
			btn.textContent = label;
		}, 3e3);
		return false;
	}
	function renderSummary() {
		const d = S.draft;
		if (!d) return;
		const counts = boxCountsOf(d.scans);
		const got = total(d.scans);
		const diff = got - (Number(d.order.qty) || 0);
		slot("issue-summary-title").textContent = orderParts(d.order).title;
		slot("issue-summary").innerHTML = Object.entries(counts).map(([code, q]) => `<p class="balance-list__row${tone(leftAfter(code)) === "bad" ? " balance-list__row--bad" : ""}"><span>${code === NO_STICKER ? "без наклейки" : esc(code)}${leftAfter(code) == null ? "" : `<small class="issue__left issue__left--${tone(leftAfter(code))}">залишиться ${fmt(leftAfter(code))}</small>`}</span><b>${fmt(q)}</b></p>`).join("") || "<p class=\"screen__hint\">Ще нічого не відскановано</p>";
		slot("issue-sum-ordered").textContent = fmt(d.order.qty);
		slot("issue-sum-got").textContent = fmt(got);
		const diffEl = slot("issue-sum-diff");
		diffEl.textContent = diff > 0 ? `+${fmt(diff)}` : fmt(diff);
		diffEl.closest("p").classList.toggle("balance-list__row--bad", diff !== 0);
		$("[data-issue-save]").disabled = !got;
		$("[data-issue-report]").hidden = !can("reports.download");
	}
	$("[data-issue-save]").addEventListener("click", () => {
		const d = S.draft;
		const got = total(d.scans);
		if (!got) return toast("error", "Ще нічого не відскановано");
		const n = Object.keys(boxCountsOf(d.scans)).length;
		commit("issue", {
			orderKey: d.order.orderKey,
			date: d.date,
			boxCounts: boxCountsOf(d.scans),
			totalBoxes: Number(d.order.qty) || 0,
			boxesPerPallet: Number(d.order.boxesPerPallet) || 0,
			totalPallets: Number(d.order.pal) || 0
		}, `Видача · ${orderParts(d.order).title}`, `${fmt(got)} ящ. · ${n} ${plural(n, [
			"контейнер",
			"контейнери",
			"контейнерів"
		])}`);
		S.savedHere.add(d.order.orderKey);
		S.stock.clear();
		S.draft = null;
		saveDraft();
		reset("issue-orders");
	});
	$("[data-issue-report]").addEventListener("click", async (e) => {
		const btn = e.currentTarget;
		if (isOffline()) return toast("error", "Немає мережі");
		btn.disabled = true;
		try {
			await ordersApi.clientReport(S.draft?.date || S.date);
			toast("success", "Звіт клієнту створено");
		} catch (err) {
			toast("error", "Звіт не створено", err.message);
		} finally {
			btn.disabled = false;
		}
	});
	window.addEventListener("ops:sent", ({ detail: { item, result } }) => {
		if (item.op !== "issue") return;
		const short = Object.entries(result?.chambers?.short || {});
		if (short.length) toast("error", "Не все списано з комор", short.map(([c, q]) => `${c}: ${fmt(q)}`).join(", "));
	});
	return {
		"issue-orders": loadOrders,
		"issue-prep": () => {
			if (!S.pick) return reset("issue-orders");
			if (stkView.dataset.order !== S.pick.orderKey) {
				stkView.dataset.order = S.pick.orderKey;
				stkReset();
			}
			renderPrep();
		},
		"issue-scan": () => {
			if (!S.draft) return reset("issue-orders");
			closeQty();
			nlClose();
			renderScan();
			renderStock(S.lastCode);
			scanForm.elements.code.focus({ preventScroll: true });
		},
		"issue-summary": () => {
			if (!S.draft) return reset("issue-orders");
			renderSummary();
			const codes = [...new Set(S.draft.scans.map((x) => x.code))].filter((c) => c !== NO_STICKER && !S.stock.has(c));
			if (codes.length) Promise.all(codes.map(stockOf)).then(() => S.draft && renderSummary());
		}
	};
}
//#endregion
//#region src/components/pages/scanner/scanner.js
var CAPACITY = 2268;
var CODE_RE = /^[A-Z]{4}\d{7}$/;
var TOAST_MS = 3e3;
var CATEGORY = {
	"R+T": "RT",
	GS: "GS",
	DEC: "DEC"
};
var fmt = (n) => n === null || n === void 0 ? "—" : Number(n).toLocaleString("uk-UA").replace(/\s/g, " ");
function plural(n, forms) {
	const a = Math.abs(n) % 100;
	const b = a % 10;
	if (a > 10 && a < 20) return forms[2];
	if (b > 1 && b < 5) return forms[1];
	if (b === 1) return forms[0];
	return forms[2];
}
var hhmm = (d = /* @__PURE__ */ new Date()) => d.toLocaleTimeString("uk-UA", {
	hour: "2-digit",
	minute: "2-digit"
});
var normalize = (value) => String(value || "").toUpperCase().replace(/[\s\-_.]/g, "");
var ddmm = (iso) => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "";
var gasText = (iso) => {
	if (!iso) return "без дня газування";
	const [y, m, d] = iso.split("-").map(Number);
	return `газування ${new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: "short" })} ${ddmm(iso)}`;
};
var params = new URLSearchParams(location.search);
var MODE = /outbound\.html$/.test(location.pathname) || params.get("mode") === "out" ? "out" : "in";
var HOME_TITLE = MODE === "out" ? "Відвантаження" : "Приймання";
var state = {
	stack: [],
	offline: !navigator.onLine,
	c: null,
	chambers: /* @__PURE__ */ new Map(),
	qty: 48,
	side: "LS"
};
function init() {
	const root = document.querySelector("[data-fls-scanner]");
	if (!root) return;
	const $ = (sel, scope = root) => scope.querySelector(sel);
	const $$ = (sel, scope = root) => [...scope.querySelectorAll(sel)];
	const screens = new Map($$("[data-screen]").map((s) => [s.dataset.screen, s]));
	const title = document.querySelector("[data-topbar-title]");
	const backBtn = document.querySelector("[data-back]");
	const pill = document.querySelector("[data-sync-pill]");
	const slot = (name, scope = root) => $(`[data-slot="${name}"]`, scope);
	root.dataset.mode = MODE;
	$$("[data-only]").forEach((el) => el.hidden = el.dataset.only !== MODE);
	screens.get("home").dataset.title = HOME_TITLE;
	title.textContent = HOME_TITLE;
	document.title = `${HOME_TITLE} · Yellow WMS`;
	let current = "home";
	let mainPage = null;
	function show(name, { push = true } = {}) {
		const next = screens.get(name);
		if (!next || name === current) return;
		if (push) state.stack.push(current);
		screens.forEach((s, key) => s.hidden = key !== name);
		current = name;
		title.textContent = next.dataset.title;
		document.title = `${next.dataset.title} · Yellow WMS`;
		backBtn.hidden = name === "home" && !mainPage;
		window.scrollTo(0, 0);
		const url = new URL(location.href);
		name === "home" ? url.searchParams.delete("screen") : url.searchParams.set("screen", name);
		history.replaceState(null, "", url);
		onEnter[name]?.();
	}
	function back() {
		if (current === "home") {
			if (mainPage) location.href = mainPage;
			return;
		}
		show(state.stack.pop() ?? "home", { push: false });
	}
	function home() {
		state.stack = [];
		show("home", { push: false });
	}
	backBtn.addEventListener("click", back);
	root.addEventListener("click", (e) => {
		const go = e.target.closest("[data-go]");
		if (go) return show(go.dataset.go);
		const backTo = e.target.closest("[data-back-to]");
		if (backTo) {
			state.stack.pop();
			show(backTo.dataset.backTo, { push: false });
		}
	});
	pill.addEventListener("click", () => show("queue"));
	function toast(type, titleText, text = "") {
		const target = $("[data-toasts]", screens.get(current));
		if (!target) return;
		const node = $(`#toast-${type}`).content.firstElementChild.cloneNode(true);
		$(".toast__title", node).textContent = titleText;
		const textEl = $(".toast__text", node);
		if (textEl) textEl.textContent = text;
		target.replaceChildren(node);
		clearTimeout(target._timer);
		target._timer = setTimeout(() => node.remove(), TOAST_MS);
		if (type === "error") navigator.vibrate?.([
			60,
			40,
			60
		]);
	}
	async function loadChambers() {
		try {
			const view = await chambersApi.view();
			state.chambers = new Map([...view.left, ...view.right].filter((c) => c.mod !== "citro").map((c) => [c.n, {
				boxes: Number(c.boxes) || 0,
				cap: Number(c.cap) || CAPACITY,
				gasIso: c.gasIso || null
			}]));
		} catch {}
	}
	const freeIn = (n) => {
		const c = state.chambers.get(n);
		return c ? c.cap - c.boxes : null;
	};
	const chamberOk = (n) => state.chambers.size ? state.chambers.has(n) : n >= 1 && n <= 29;
	function rangeText() {
		const nums = state.chambers.size ? [...state.chambers.keys()].sort((a, b) => a - b) : [1, 29];
		if (!state.chambers.size) return "1–29";
		const parts = [];
		for (let i = 0; i < nums.length; i++) {
			let j = i;
			while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
			parts.push(i === j ? `${nums[i]}` : `${nums[i]}–${nums[j]}`);
			i = j;
		}
		return parts.join(", ");
	}
	function chamberHint(n) {
		if (!chamberOk(n)) return {
			bad: true,
			text: `Комори ${rangeText()} (CITRO — лише списання)`
		};
		const c = state.chambers.get(n);
		if (!c) return {
			bad: false,
			text: `Комора ${n}`
		};
		const free = c.cap - c.boxes;
		return free <= 0 ? {
			bad: true,
			text: `Комора ${n} заповнена: ${fmt(c.boxes)} / ${fmt(c.cap)}`
		} : {
			bad: false,
			text: `Комора ${n}: ${fmt(c.boxes)} / ${fmt(c.cap)} · вільно ${fmt(free)}`
		};
	}
	const banner = $("[data-offline-banner]");
	function renderSync() {
		const label = $(".sync-pill__label", pill);
		const queued = pending().length;
		const bad = rejected().length;
		pill.classList.toggle("sync-pill--online", !state.offline && !queued && !bad);
		pill.classList.toggle("sync-pill--offline", state.offline);
		pill.classList.toggle("sync-pill--queue", !state.offline && (queued > 0 || bad > 0));
		label.textContent = state.offline ? `офлайн · ${queued}` : bad ? `відхилено ${bad}` : queued ? `черга ${queued}` : "онлайн";
		banner.hidden = !state.offline;
		$$("[data-queue-count]").forEach((el) => el.textContent = queued);
		const line = $("[data-sync-text]");
		line.textContent = queued ? `У черзі: ${queued}` : lastSync ? `Синхронізовано · ${hhmm(lastSync)}` : "Готово до роботи";
		if (current === "queue") renderQueue();
	}
	function commit(op, body, titleText, sub) {
		enqueue({
			op,
			body,
			title: titleText,
			sub
		});
		toast("success", state.offline ? "Збережено на телефоні" : titleText, state.offline ? "Відправиться, щойно з’явиться мережа" : "");
	}
	window.addEventListener("ops:change", renderSync);
	window.addEventListener("ops:sent", ({ detail: { item, result } }) => {
		if (item.op === "receive-pallet" && state.c?.code === result.containerNumber) {
			state.c.counted = result.counted;
			if (result.expected !== void 0) state.c.expected = result.expected;
			if (current === "receive") renderReceive();
		}
		loadChambers();
	});
	window.addEventListener("online", () => {
		state.offline = false;
		renderSync();
	});
	window.addEventListener("offline", () => {
		state.offline = true;
		renderSync();
	});
	const scanForm = $("[data-scan-form]");
	const scanHint = $("[data-scan-hint]");
	async function openContainer(raw) {
		const code = normalize(raw);
		if (!CODE_RE.test(code)) {
			scanHint.textContent = "Формат коду: 4 літери + 7 цифр, напр. MNBU3318616";
			scanHint.classList.add("screen__hint--bad");
			return toast("error", "Невірний код", code || "порожньо");
		}
		scanHint.textContent = "Сканером, камерою або вручну";
		scanHint.classList.remove("screen__hint--bad");
		scanForm.reset();
		let r;
		try {
			r = await warehouseApi.lookup(code);
		} catch (err) {
			if (err.status !== 0) return toast("error", "Помилка сервера", err.message);
			r = {
				state: "offline",
				containerNumber: code
			};
		}
		const plan = r.plan || {};
		state.c = {
			code,
			state: r.state,
			expected: r.expected ?? plan.quantity ?? null,
			counted: r.counted ?? (r.state === "received-unplaced" ? r.remaining : 0) ?? 0,
			pallets: 0,
			placements: (r.placements || []).map((p) => ({
				chamberNum: p.chamberNum,
				side: p.side,
				remaining: p.remaining
			})),
			productType: r.productType || plan.productType || "",
			meta: [
				plan.brand,
				plan.originCountry || plan.country,
				plan.productVariety,
				r.productType && !plan.brand ? r.productType : ""
			].filter(Boolean).join(" · "),
			pickup: plan.pickupDateTime ? `pickup ${ddmm(plan.pickupDateTime.slice(0, 10))} ${plan.pickupDateTime.slice(11, 16)}` : ""
		};
		$$("[data-slot=\"code\"]").forEach((el) => el.textContent = code);
		if (r.state === "depleted") return toast("error", `${code} уже відвантажено`, "Залишку в коморах немає");
		if (r.state === "unknown") toast("error", "Немає в плані контейнерів", "Можна прийняти — перевір код");
		if (r.state === "offline") toast("error", "Немає мережі", "Приймання збережеться на телефоні");
		if (MODE === "out" && r.state !== "in-chamber" && r.state !== "offline") return toast("error", `${code}: немає в коморах`, "Відвантаження — лише з камер. Приймання — у вкладці «Приймання».");
		show(r.state === "in-chamber" || MODE === "out" ? "container" : "receive");
	}
	scanForm.addEventListener("submit", (e) => {
		e.preventDefault();
		openContainer(scanForm.code.value);
	});
	$("[data-scan-submit]").addEventListener("click", () => scanForm.requestSubmit());
	const chamberInput = $("[data-chamber-input]");
	const chamberHintEl = $("[data-chamber-hint]");
	const plantInput = $("[data-plant-input]");
	const plantHint = $("[data-plant-hint]");
	const plantField = $("[data-plant-field]");
	const receive = screens.get("receive");
	function renderChamber() {
		const h = chamberHint(Number(chamberInput.value));
		chamberHintEl.classList.toggle("screen__hint--bad", h.bad && chamberInput.value !== "");
		chamberHintEl.textContent = chamberInput.value === "" ? `Комори ${rangeText()}` : h.text;
	}
	let ggnTimer = null;
	let ggnOk = false;
	function renderPlant() {
		const code = normalize(plantInput.value);
		clearTimeout(ggnTimer);
		const set = (cls, text) => {
			plantField.classList.toggle("field--success", cls === "ok");
			plantField.classList.toggle("field--error", cls === "bad");
			plantHint.classList.toggle("screen__hint--ok", cls === "ok");
			plantHint.classList.toggle("screen__hint--bad", cls === "bad");
			plantHint.textContent = text;
		};
		ggnOk = false;
		if (!code) return set("", "Необов’язково для BIO");
		set("", "Перевіряю…");
		ggnTimer = setTimeout(async () => {
			try {
				const r = await warehouseApi.ggn(code);
				if (normalize(plantInput.value) !== code) return;
				if (r.match) {
					ggnOk = true;
					set("ok", `✓ ${r.match.plantationCode} · ${[r.match.producer || r.match.supplier, r.match.country].filter(Boolean).join(" · ")}`);
				} else set("bad", `Не знайдено.${r.formatExamples?.length ? ` Формат: ${r.formatExamples.slice(0, 3).join(", ")}` : ""}`);
			} catch {
				set("", "Без мережі — код перевірить сервер пізніше");
			}
		}, 350);
	}
	function renderReceive() {
		const c = state.c;
		if (!c) return;
		const expected = c.expected;
		slot("pickup", receive).textContent = c.pickup;
		slot("meta", receive).textContent = c.meta || (c.state === "unknown" ? "немає в плані контейнерів" : "");
		$("[data-receive-counted]").textContent = fmt(c.counted);
		$("[data-receive-expected]").textContent = expected ? `з ${fmt(expected)}` : "";
		$("[data-receive-pallet]").textContent = c.pallets + 1;
		const pct = expected ? Math.min(100, c.counted / expected * 100) : 0;
		$("[data-receive-bar]").style.setProperty("--value", `${pct.toFixed(1)}%`);
	}
	chamberInput.addEventListener("input", renderChamber);
	plantInput.addEventListener("input", renderPlant);
	root.addEventListener("qty:change", (e) => {
		state.qty = e.detail.value;
		$("[data-qty-label]").textContent = state.qty || "—";
	});
	root.addEventListener("segmented:change", (e) => {
		if (e.detail.name === "side") state.side = e.detail.value;
		if (e.detail.name === "move-side") renderMove();
		if (e.detail.name === "wo-category") renderWriteoff();
	});
	$("[data-add-pallet]").addEventListener("click", () => {
		const n = Number(chamberInput.value);
		const qty = Number(state.qty);
		if (!qty) return toast("error", "Вкажи кількість ящиків");
		if (!chamberOk(n)) return toast("error", "Невірна комора", `Приймання лише в комори ${rangeText()}`);
		const free = freeIn(n);
		if (free !== null && free < qty) return toast("error", `Не вміщується в комору ${n}`, `Вільно ${fmt(Math.max(0, free))}. Обери іншу комору.`);
		if (plantInput.value && !ggnOk && navigator.onLine) return toast("error", "Код плантації не знайдено", "Виправ код або очисти поле");
		const c = state.c;
		c.counted += qty;
		c.pallets++;
		const ch = state.chambers.get(n);
		if (ch) ch.boxes += qty;
		const place = c.placements.find((p) => p.chamberNum === n && p.side === state.side);
		place ? place.remaining += qty : c.placements.push({
			chamberNum: n,
			side: state.side,
			remaining: qty
		});
		commit("receive-pallet", {
			containerNumber: c.code,
			chamberNum: n,
			side: state.side,
			boxes: qty,
			plantationCode: normalize(plantInput.value)
		}, `+${qty} ящ. → комора ${n} ${state.side}`, `${c.code} · палета ${c.pallets}`);
		renderReceive();
		renderChamber();
	});
	const complete = screens.get("complete");
	const explainInputs = $$("[data-explain-input]");
	const explainResult = $("[data-explain-result]");
	const explained = () => Object.fromEntries(explainInputs.map((i) => [i.dataset.cat, Math.max(0, Number(i.value) || 0)]));
	function renderComplete() {
		const c = state.c;
		slot("expected", complete).textContent = fmt(c.expected);
		slot("counted", complete).textContent = fmt(c.counted);
		const diff = c.expected === null ? null : c.expected - c.counted;
		$("[data-diff]").textContent = diff === null ? "—" : fmt(diff);
		slot("diff-box", complete).classList.toggle("container-card__stat--warn", Boolean(diff));
		renderDamage();
		return renderExplain();
	}
	function renderExplain() {
		const c = state.c;
		const sum = Object.values(explained()).reduce((s, v) => s + v, 0);
		let ok;
		let text;
		if (c.expected === null) {
			ok = true;
			text = "Без очікуваної кількості — запиши лише невідповідний товар";
		} else {
			const diff = c.expected - c.counted;
			const left = diff - sum;
			ok = diff >= 0 ? left === 0 : sum === 0;
			text = diff < 0 ? `Більше, ніж очікувано, на ${-diff} ящ.` : left === 0 ? "Все пояснено" : left > 0 ? `Не пояснено: ${left} ящ.` : `Забагато на ${-left} ящ.`;
		}
		explainResult.classList.toggle("check-line--ok", ok);
		explainResult.classList.toggle("check-line--bad", !ok);
		const use = $("use", explainResult);
		use.setAttribute("href", use.getAttribute("href").replace(/#sprite-.*/, `#sprite-${ok ? "check" : "alert-triangle"}`));
		$("span", explainResult).textContent = text;
		return ok;
	}
	explainInputs.forEach((i) => i.addEventListener("input", renderExplain));
	const damage = {
		code: "",
		ids: [],
		photos: []
	};
	const damageFor = $("[data-damage-for]");
	async function renderDamage() {
		if (damage.code !== state.c?.code) Object.assign(damage, {
			code: state.c?.code || "",
			ids: [],
			photos: []
		});
		let cat = null;
		try {
			cat = damage.ids.length ? await loadCatalog() : null;
		} catch {}
		const name = (id) => txt(cat?.defects.find((d) => d.id === id)?.name) || id;
		slot("damage-chips", complete).innerHTML = damage.ids.length ? damage.ids.map((id) => `<span class="chip" data-no-i18n>${esc(name(id))}</span>`).join("") : `<span class="damage-box__none">Не вибрано</span>`;
		const keep = damageFor.value;
		damageFor.innerHTML = `<option value="">Загальне фото</option>` + damage.ids.map((id) => `<option value="${esc(id)}">${esc(name(id))}</option>`).join("");
		damageFor.value = damage.ids.includes(keep) ? keep : "";
		$("[data-damage-for-row]").hidden = !damage.ids.length;
		thumbs(slot("damage-thumbs", complete), damage.photos, cat);
	}
	$("[data-damage-ref]").addEventListener("click", () => openReference().catch((err) => toast("error", "Довідник недоступний", err.status === 0 ? "Немає мережі" : err.message)));
	$("[data-damage-pick]").addEventListener("click", async () => {
		let ids;
		try {
			ids = await openDefectPicker(damage.ids);
		} catch (err) {
			return toast("error", "Довідник недоступний", err.status === 0 ? "Немає мережі" : err.message);
		}
		if (ids) {
			damage.ids = ids;
			renderDamage();
		}
	});
	async function shrink(file) {
		try {
			const bmp = await createImageBitmap(file);
			const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
			const canvas = Object.assign(document.createElement("canvas"), {
				width: Math.round(bmp.width * k),
				height: Math.round(bmp.height * k)
			});
			canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", .82));
			return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
		} catch {
			return file;
		}
	}
	$("[data-damage-photo]").addEventListener("change", async (e) => {
		const files = [...e.target.files];
		e.target.value = "";
		for (const f of files) try {
			const r = await defectsApi.upload({
				file: await shrink(f),
				containerNumber: state.c.code,
				defect: damageFor.value
			});
			damage.photos.unshift(r.photo);
			renderDamage();
			toast("success", "Фото збережено", state.c.code);
		} catch (err) {
			toast("error", "Фото не збережено", err.status === 0 ? "Немає мережі — спробуй ще раз" : err.body?.error || err.message);
		}
	});
	$("[data-complete]").addEventListener("click", () => {
		if (!renderExplain()) return toast("error", "Різниця не пояснена", "Розклади ящики по DEC / GS / R+T");
		const nc = explained();
		commit("complete", {
			containerNumber: state.c.code,
			nonConforming: nc,
			defects: damage.ids
		}, `Контейнер ${state.c.code} завершено`, `DEC ${nc.DEC} · GS ${nc.GS} · R+T ${nc.RT}${damage.ids.length ? ` · ${damage.ids.length} деф.` : ""}`);
		explainInputs.forEach((i) => i.value = 0);
		Object.assign(damage, {
			code: "",
			ids: [],
			photos: []
		});
		setTimeout(home, 900);
	});
	const containerScreen = screens.get("container");
	function renderContainer() {
		const c = state.c;
		slot("meta", containerScreen).textContent = c.meta;
		const places = c.placements.filter((p) => p.remaining > 0);
		slot("places", containerScreen).innerHTML = places.length ? places.map((p) => `<div class="place-list__item">
				<span class="place-list__num">${p.chamberNum}</span>
				<span class="place-list__text"><span>${esc(p.side)} · ${gasText(state.chambers.get(p.chamberNum)?.gasIso)}</span><span>≈ ${Math.ceil(p.remaining / 48)} ${plural(Math.ceil(p.remaining / 48), [
			"палета",
			"палети",
			"палет"
		])}</span></span>
				<b class="place-list__boxes">${fmt(p.remaining)}</b>
			</div>`).join("") : "<p class=\"screen__hint\">У коморах більше немає ящиків цього контейнера.</p>";
	}
	function renderSources(target) {
		const places = state.c.placements.filter((p) => p.remaining > 0);
		const active = $(".place-list__item--active", target)?.dataset.key;
		target.innerHTML = places.map((p, i) => {
			const key = `${p.chamberNum}|${p.side}`;
			const on = active ? key === active : i === 0;
			return `<button type="button" class="place-list__item${on ? " place-list__item--active" : ""}" role="radio" aria-checked="${on}" data-key="${key}" data-boxes="${p.remaining}" data-from="${p.chamberNum}" data-side="${p.side}">
				<span class="place-list__text"><span>Комора ${p.chamberNum} · ${esc(p.side)}</span></span><b class="place-list__boxes">${fmt(p.remaining)} <small>ящ.</small></b>
			</button>`;
		}).join("");
	}
	const sourceOf = (screen) => $(".place-list__item--active", screens.get(screen));
	root.addEventListener("click", (e) => {
		const item = e.target.closest("[data-source] .place-list__item");
		if (!item) return;
		item.parentElement.querySelectorAll(".place-list__item").forEach((o) => {
			o.classList.toggle("place-list__item--active", o === item);
			o.setAttribute("aria-checked", String(o === item));
		});
		renderMove();
		renderWriteoff();
	});
	function takeLocal(chamberNum, side, qty) {
		const p = state.c.placements.find((x) => x.chamberNum === chamberNum && x.side === side);
		if (p) p.remaining -= qty;
		const ch = state.chambers.get(chamberNum);
		if (ch) ch.boxes -= qty;
	}
	const moveQty = $("[data-move-qty]");
	const moveTo = $("[data-move-to]");
	const moveHint = $("[data-move-hint]");
	const moveSide = () => $("[data-segmented=\"move-side\"] [aria-checked=\"true\"]").dataset.value;
	function renderMove() {
		const src = sourceOf("move");
		if (!src) return;
		const max = Number(src.dataset.boxes);
		const qty = Math.min(Number(moveQty.value) || 0, max);
		$("[data-move-max]").textContent = fmt(max);
		const h = chamberHint(Number(moveTo.value));
		moveHint.textContent = moveTo.value ? h.text : `Комори ${rangeText()}`;
		moveHint.classList.toggle("screen__hint--bad", Boolean(moveTo.value) && h.bad);
		$("[data-move-submit]").textContent = `Перемістити ${fmt(qty)} ящ. · ${src.dataset.from} → ${moveTo.value || "?"}`;
	}
	moveQty.addEventListener("input", renderMove);
	moveTo.addEventListener("input", renderMove);
	$("[data-move-all]").addEventListener("click", () => {
		moveQty.value = sourceOf("move").dataset.boxes;
		renderMove();
	});
	$("[data-move-submit]").addEventListener("click", () => {
		const src = sourceOf("move");
		if (!src) return toast("error", "Немає звідки переміщати");
		const qty = Number(moveQty.value);
		const from = Number(src.dataset.from);
		const to = Number(moveTo.value);
		if (!qty || qty > Number(src.dataset.boxes)) return toast("error", "Невірна кількість", `Доступно ${fmt(src.dataset.boxes)} ящ.`);
		if (!chamberOk(to)) return toast("error", "Невірна комора", `Комори ${rangeText()}`);
		const free = freeIn(to);
		if (to !== from && free !== null && free < qty) return toast("error", `Не вміщується в комору ${to}`, `Вільно ${fmt(Math.max(0, free))}`);
		if (to === from && moveSide() === src.dataset.side) return toast("error", "Те саме місце", "Обери іншу комору або сторону");
		takeLocal(from, src.dataset.side, qty);
		const ch = state.chambers.get(to);
		if (ch) ch.boxes += qty;
		const dest = state.c.placements.find((x) => x.chamberNum === to && x.side === moveSide());
		dest ? dest.remaining += qty : state.c.placements.push({
			chamberNum: to,
			side: moveSide(),
			remaining: qty
		});
		commit("move", {
			containerNumber: state.c.code,
			fromChamber: from,
			toChamber: to,
			toSide: moveSide(),
			qty
		}, `Переміщено ${qty} ящ. · ${from} → ${to}`, state.c.code);
		moveQty.value = "";
		back();
	});
	const woQty = $("[data-wo-qty]");
	const woCategory = $("[data-segmented=\"wo-category\"]");
	const woCat = () => woCategory.querySelector("[aria-checked=\"true\"]").dataset.value;
	function renderWriteoff() {
		$("[data-wo-submit]").textContent = `Списати ${fmt(Number(woQty.value) || 0)} ящ. у ${woCat()}`;
	}
	woQty.addEventListener("input", renderWriteoff);
	$("[data-wo-submit]").addEventListener("click", () => {
		const src = sourceOf("writeoff");
		if (!src) return toast("error", "Немає звідки списувати");
		const qty = Number(woQty.value);
		if (!qty || qty > Number(src.dataset.boxes)) return toast("error", "Невірна кількість", `Доступно ${fmt(src.dataset.boxes)} ящ.`);
		const from = Number(src.dataset.from);
		takeLocal(from, src.dataset.side, qty);
		commit("writeoff", {
			containerNumber: state.c.code,
			chamberNum: from,
			qty,
			category: CATEGORY[woCat()],
			stage: "ripening"
		}, `Списано ${qty} ящ. у ${woCat()}`, `${state.c.code} · комора ${from}`);
		woQty.value = "";
		back();
	});
	const marketForm = $("[data-market-form]");
	const marketList = $("[data-market-list]");
	const marketLast = $("[data-market-last]");
	function renderMarket() {
		const total = $$(".market-list__count", marketList).reduce((s, i) => s + (Number(i.value) || 0), 0);
		$("[data-market-total]").textContent = fmt(total);
		return total;
	}
	marketForm.addEventListener("submit", (e) => {
		e.preventDefault();
		const code = normalize(marketForm.code.value);
		marketForm.reset();
		if (!CODE_RE.test(code)) return toast("error", "Невірний код", code || "порожньо");
		let row = marketList.querySelector(`[data-code="${code}"]`);
		if (row) {
			const input = $(".market-list__count", row);
			input.value = Number(input.value) + 1;
			row.classList.remove("is-fresh");
			row.offsetWidth;
		} else {
			row = $("#market-row").content.firstElementChild.cloneNode(true);
			row.dataset.code = code;
			$(".market-list__code", row).textContent = code;
			$(".market-list__count", row).setAttribute("aria-label", `Коробок з ${code}`);
			$(".market-list__remove", row).setAttribute("aria-label", `Прибрати ${code}`);
			marketList.prepend(row);
		}
		row.classList.add("is-fresh");
		marketLast.textContent = `+1 ${code}`;
		renderMarket();
		marketForm.code.focus();
	});
	marketList.addEventListener("input", renderMarket);
	marketList.addEventListener("click", (e) => {
		const remove = e.target.closest(".market-list__remove");
		if (!remove) return;
		remove.closest(".market-list__item").remove();
		renderMarket();
	});
	$("[data-market-clear]").addEventListener("click", () => {
		marketList.replaceChildren();
		marketLast.textContent = "";
		renderMarket();
	});
	$("[data-market-save]").addEventListener("click", () => {
		const total = renderMarket();
		if (!total) return toast("error", "Палета порожня", "Відскануй хоча б одну коробку");
		const cat = $("[data-segmented=\"market-category\"] [aria-checked=\"true\"]").dataset.value;
		const boxCounts = Object.fromEntries($$(".market-list__item", marketList).map((r) => [r.dataset.code, Number($(".market-list__count", r).value) || 0]).filter(([, q]) => q > 0));
		const n = Object.keys(boxCounts).length;
		commit("writeoff-batch", {
			boxCounts,
			category: CATEGORY[cat],
			stage: "ripening"
		}, `Палета ${cat} · ${total} ящ.`, `${n} ${plural(n, [
			"контейнер",
			"контейнери",
			"контейнерів"
		])}`);
		marketList.replaceChildren();
		marketLast.textContent = "";
		renderMarket();
	});
	const balanceDate = $("[data-balance-date]");
	async function renderBalance() {
		const list = slot("balance");
		let b;
		try {
			b = await warehouseApi.balance(balanceDate.value);
		} catch (err) {
			list.innerHTML = `<p class="screen__hint screen__hint--bad">${err.status === 0 ? "Немає мережі — баланс недоступний" : esc(err.message)}</p>`;
			return;
		}
		const past = balanceDate.value < isoToday();
		const nc = (stage) => {
			const s = b.nonConforming?.[stage];
			if (!s) return "0 / 0 / 0";
			const sum = (k) => (s.regular?.[k] || 0) + (s.bio?.[k] || 0);
			return `${sum("RT")} / ${sum("GS")} / ${sum("DEC")}`;
		};
		const sections = [
			{
				title: "План і замовлення",
				rows: [
					["Потрібно (Sales Plan, банан)", fmt(b.needed)],
					["Замовлено: банан", fmt(b.ordered.regular)],
					["Замовлено: BIO", fmt(b.ordered.bio)],
					["Замовлено: маркет / смітник", fmt(b.ordered.market)],
					["Замовлено: ананас", fmt(b.ordered.ananas)],
					[
						"Замовлено − план",
						fmt(b.checks.orderedVsNeeded),
						b.checks.orderedVsNeeded !== 0
					]
				]
			},
			{
				title: "Рух",
				rows: [
					["Прийнято", fmt(b.received)],
					["Відвантажено (скани)", fmt(b.shipped)],
					[
						"Ще не відвантажено",
						fmt(b.checks.notShipped),
						past && b.checks.notShipped > 0
					],
					["Переміщено між коморами", fmt(b.moved)]
				]
			},
			{
				title: "Невідповідний товар",
				rows: [["Приймання R+T / GS / DEC", nc("receiving")], ["Після дозрівання R+T / GS / DEC", nc("ripening")]]
			},
			{
				title: "Залишок зараз",
				rows: [["Банан у коморах", fmt(b.stockNow.regular)], ["BIO у коморах", fmt(b.stockNow.bio)]]
			}
		];
		const bad = sections.flatMap((s) => s.rows).filter((r) => r[2]).length;
		$("[data-balance-banner]").hidden = !bad;
		slot("balance-note").textContent = `${bad} ${plural(bad, [
			"розбіжність",
			"розбіжності",
			"розбіжностей"
		])} за день. Позначено червоним.`;
		list.innerHTML = sections.map((s) => `<section class="balance-list__section">
			<h3 class="balance-list__title">${s.title}</h3>
			${s.rows.map(([label, v, isBad]) => `<p class="balance-list__row${isBad ? " balance-list__row--bad" : ""}"><span>${label}</span><b>${v}</b></p>`).join("")}
		</section>`).join("");
	}
	balanceDate.value = isoToday();
	balanceDate.addEventListener("change", renderBalance);
	const queueScreen = screens.get("queue");
	function renderQueue() {
		const bad = rejected();
		const wait = pending();
		const t = (iso) => hhmm(new Date(iso));
		slot("rejected-label", queueScreen).hidden = !bad.length;
		slot("rejected-label", queueScreen).textContent = `Відхилено · ${bad.length}`;
		slot("rejected", queueScreen).innerHTML = bad.map((i) => `<div class="sync-queue__item sync-queue__item--rejected" data-op="${i.opId}">
			<div class="sync-queue__head"><b>${esc(i.title)}</b><span class="sync-queue__time">${t(i.at)}</span></div>
			<span class="sync-queue__text"><span>${esc(i.sub)}</span></span>
			<span class="sync-queue__reason">${esc(i.error || "Сервер відхилив операцію")}</span>
			<div class="sync-queue__actions">
				<button type="button" class="btn btn--secondary" data-op-retry>Повторити</button>
				<button type="button" class="btn btn--danger" data-op-remove>Видалити</button>
			</div>
		</div>`).join("");
		slot("pending-label", queueScreen).textContent = `Очікують · ${wait.length}`;
		slot("pending", queueScreen).innerHTML = wait.length ? wait.map((i) => `<div class="sync-queue__item">
				<span class="sync-queue__icon" aria-hidden="true">${icon("clock")}</span>
				<span class="sync-queue__text"><b>${esc(i.title)}</b><span>${esc(i.sub)}</span></span>
				<span class="sync-queue__time">${t(i.at)}</span>
			</div>`).join("") : "<p class=\"screen__hint\">Усе відправлено.</p>";
		slot("queue-note", queueScreen).textContent = lastAttempt ? `Операції відправляються по черзі. Остання спроба ${hhmm(lastAttempt)}.` : "Операції відправляються по черзі, щойно є мережа.";
	}
	queueScreen.addEventListener("click", (e) => {
		const item = e.target.closest("[data-op]");
		if (!item) return;
		if (e.target.closest("[data-op-retry]")) retry(item.dataset.op);
		if (e.target.closest("[data-op-remove]")) remove(item.dataset.op);
	});
	$("[data-send-now]").addEventListener("click", async () => {
		if (state.offline) return toast("error", "Немає мережі", "Операції залишаються в черзі");
		await flush();
		pending().length ? toast("error", "Не все відправлено", "Спробую ще раз автоматично") : toast("success", "Усе відправлено");
	});
	const overlay = $("[data-camera-overlay]");
	const video = $("[data-camera-video]");
	let stream = null;
	let scanTarget = null;
	async function openCamera(form) {
		scanTarget = form;
		overlay.hidden = false;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
			video.srcObject = stream;
			await video.play();
			if ("BarcodeDetector" in window) detect(new window.BarcodeDetector());
		} catch {
			$(".camera-overlay__hint", overlay).textContent = "Камера недоступна. Введи код вручну.";
		}
	}
	async function detect(detector) {
		if (overlay.hidden) return;
		try {
			const [hit] = await detector.detect(video);
			if (hit) {
				scanTarget.code.value = hit.rawValue;
				closeCamera();
				return scanTarget.requestSubmit();
			}
		} catch {}
		requestAnimationFrame(() => detect(detector));
	}
	function closeCamera() {
		overlay.hidden = true;
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		scanTarget?.code.focus();
	}
	$$("[data-camera]").forEach((btn) => btn.addEventListener("click", () => openCamera(btn.closest("form"))));
	$$("[data-camera-close]").forEach((btn) => btn.addEventListener("click", closeCamera));
	document.addEventListener("keydown", (e) => e.key === "Escape" && !overlay.hidden && closeCamera());
	const needContainer = (fn) => () => state.c ? fn() : home();
	const onEnter = {
		home: () => scanForm.code.focus({ preventScroll: true }),
		receive: needContainer(() => {
			renderReceive();
			renderChamber();
			renderPlant();
		}),
		complete: needContainer(renderComplete),
		container: needContainer(renderContainer),
		move: needContainer(() => {
			renderSources(slot("move-sources"));
			renderMove();
		}),
		writeoff: needContainer(() => {
			renderSources(slot("wo-sources"));
			renderWriteoff();
		}),
		market: renderMarket,
		balance: renderBalance,
		queue: renderQueue
	};
	Object.assign(onEnter, initIssue({
		$,
		$$,
		slot,
		show,
		toast,
		commit,
		can,
		fmt,
		plural,
		normalize,
		openCamera: (form) => openCamera(form),
		reset: (name) => {
			state.stack = ["home"];
			show(name, { push: false });
		},
		codeRe: CODE_RE,
		isOffline: () => state.offline
	}));
	ready.then((user) => {
		if (!user) return;
		const main = homeFor(user);
		mainPage = location.pathname.endsWith(`/${main}`) ? null : main;
		if (current === "home") backBtn.hidden = !mainPage;
		const who = $("[data-scanner-user]");
		$("[data-slot=\"avatar\"]", who).textContent = user.initials;
		$("[data-slot=\"avatar\"]", who).classList.add(`avatar--${user.role}`);
		$("[data-slot=\"name\"]", who).textContent = user.name;
		who.hidden = false;
		idleLogout(15);
		if (can("chambers.view")) loadChambers();
		flush();
		const code = params.get("code");
		if (code) openContainer(code);
	});
	renderSync();
	backBtn.hidden = true;
	const start = params.get("screen");
	if (start && [
		"balance",
		"market",
		"queue",
		"issue-orders"
	].includes(start)) {
		state.stack = ["home"];
		show(start, { push: false });
	} else onEnter.home();
}
init();
//#endregion
