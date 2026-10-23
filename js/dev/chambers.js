import { a as can, l as ready, m as chambersApi, u as showUnavailable } from "./ui.min.js";
/* empty css               */
import { n as onDrawerClose, r as openDrawer } from "./_drawer.min.js";
import "./app-shell.min.js";
import { t as toast } from "./toast.min.js";
import { i as isoToday, n as esc, r as fmt } from "./format.min.js";
import { n as openDamage } from "./_damage.min.js";
//#region src/components/custom/chamber-map/_view.js
var CAPACITY = 2592;
var WEEKDAY = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat"
];
var LABEL = {
	regular: "BANANA",
	bio: "BIO",
	mixed: "MIXED",
	empty: "EMPTY",
	citro: "CITRO"
};
var num = (v) => typeof v === "number" ? v : Number(String(v ?? "").replace(/\D/g, "")) || 0;
function gasLabel(iso) {
	if (!iso) return "";
	const [y, m, d] = iso.split("-").map(Number);
	return `${WEEKDAY[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}
var chipClass = (mod) => `chip chip--${mod === "regular" ? "banana" : mod === "bio" ? "bio" : "plain"}`;
var labelOf = (mod) => LABEL[mod] || mod;
function decorate(c) {
	if (c.mod === "citro") return {
		...c,
		rt: num(c.rt),
		gs: num(c.gs),
		dec: num(c.dec)
	};
	const boxes = num(c.boxes);
	const free = c.free === void 0 ? Math.max(0, CAPACITY - boxes) : num(c.free);
	const gasIso = c.gasIso || "";
	return {
		...c,
		boxes,
		boxesF: fmt(boxes),
		freeF: fmt(free),
		gasIso,
		gas: gasLabel(gasIso),
		full: Boolean(c.full) || boxes >= 2592,
		pctMix: num(c.pctMix),
		sub: c.mod === "empty" ? "Empty" : [c.supplier, c.mod === "bio" ? c.tag : ""].filter(Boolean).join(" · ") || "—",
		placements: (c.placements || []).map((p) => ({
			...p,
			boxes: num(p.boxes),
			boxesF: fmt(p.boxes)
		}))
	};
}
var hueOf = (color) => {
	const n = parseInt(color, 10);
	return n ? Math.max(48, 120 - (n - 1) * 18) : null;
};
function roundParts(r) {
	if (!r || !r.ls && !r.rs && r.temp == null) return null;
	return {
		sides: [["LS", r.ls], ["RS", r.rs]].filter(([, v]) => v).map(([side, color]) => ({
			side,
			color,
			hue: hueOf(color)
		})),
		temp: r.temp == null || r.temp === "" ? "" : `${String(r.temp).replace(".", ",")}°`,
		date: gasLabel(r.date),
		kind: r.kind === "evening" ? "evening" : "morning",
		stale: r.date !== isoToday()
	};
}
function roundHtml(r) {
	const p = roundParts(r);
	if (!p) return "";
	const sides = p.sides.map((s) => `<span class="chamber-tile__side">${s.hue == null ? "" : `<span class="chamber-tile__dot" style="--hue: ${s.hue}"></span>`}${s.side} <b>${esc(s.color)}</b></span>`);
	if (p.temp) sides.push(`<span class="chamber-tile__side"><b>${p.temp}</b></span>`);
	return `<span class="chamber-tile__round${p.stale ? " is-stale" : ""}">${sides.join("")}</span>`;
}
function tileHtml(c) {
	if (c.mod === "citro") return `<button type="button" class="chamber-tile chamber-tile--citro" data-chamber="${c.n}" data-filter="citro" aria-pressed="false">
			<span class="chamber-tile__num">${c.n}</span>
			<span class="chamber-tile__head"><span class="chamber-tile__citro">CITRO</span><span class="chamber-tile__sub">non-conforming</span></span>
			<span class="chamber-tile__counts">
				<span class="chamber-tile__count"><span class="chamber-tile__count-key">R+T</span> <b>${fmt(c.rt)}</b></span>
				<span class="chamber-tile__count"><span class="chamber-tile__count-key">GS</span> <b>${fmt(c.gs)}</b></span>
				<span class="chamber-tile__count"><span class="chamber-tile__count-key">DEC</span> <b>${fmt(c.dec)}</b></span>
			</span>
		</button>`;
	const empty = c.mod === "empty";
	const noDay = !empty && !c.gas;
	const chip = empty ? "<span class=\"chamber-tile__chip chamber-tile__chip--none\">—</span>" : c.gas ? `<span class="chamber-tile__chip">${c.gas}</span>` : "<span class=\"chamber-tile__chip chamber-tile__chip--no-day\">no gas day</span>";
	const prod = c.mod === "bio" || c.mod === "mixed" ? `<span class="chamber-tile__prod">${c.mod === "bio" ? "BIO" : "MIX"}</span>` : "";
	const round = empty ? "" : roundHtml(c.round);
	return `<button type="button" class="chamber-tile chamber-tile--${c.mod}${noDay ? " chamber-tile--no-day" : ""}${c.full ? " chamber-tile--full" : ""}${round ? " chamber-tile--round" : ""}" data-chamber="${c.n}" data-filter="${c.mod}${noDay ? " no-gas-day" : ""}" aria-pressed="false" aria-label="Chamber ${c.n}, ${empty ? "empty" : `${c.boxesF} of ${fmt(CAPACITY)} boxes`}">
		<span class="chamber-tile__num">${c.n}</span>
		<span class="chamber-tile__head">${prod}<span class="chamber-tile__sub">${esc(c.sub)}</span>${chip}</span>
		<span class="chamber-tile__body">
			<span class="chamber-tile__bar" style="--value: ${num(c.pct)}%; --split: ${c.pctMix}%"><span class="chamber-tile__fill"></span></span>
			<span class="chamber-tile__boxes"><b>${c.boxesF}</b><span class="chamber-tile__cap"> / ${fmt(CAPACITY)}</span></span>
		</span>${round}
	</button>`;
}
function rowHtml(r) {
	const tag = r.mod === "regular" ? "<span class=\"gas-days__none\">—</span>" : `<input type="text" class="field__input gas-days__tag" value="${esc(r.tag)}" aria-label="Client tag for chamber ${r.n}" autocomplete="off">`;
	return `<tr class="data-table__row gas-days__row${r.gasIso ? "" : " gas-days__row--no-day"}" data-gas-row="${r.n}" data-mod="${r.mod}">
		<th scope="row" class="gas-days__num">${r.n}</th>
		<td><span class="${chipClass(r.mod)}">${esc(r.prod)}</span></td>
		<td class="data-table__cell--num">${fmt(num(r.boxes ?? r.boxesF))}</td>
		<td class="gas-days__codes">${(r.codes || []).map((code) => `<span>${esc(code)}</span>`).join("")}</td>
		<td><input type="date" class="field__input gas-days__date" value="${esc(r.gasIso)}" aria-label="Gas day for chamber ${r.n}"></td>
		<td>${tag}</td>
		<td class="gas-days__action"><button type="button" class="btn btn--secondary gas-days__save" disabled>Saved</button></td>
	</tr>`;
}
//#endregion
//#region src/components/pages/chambers/chambers.js
var root$1 = document.querySelector("[data-fls-chambers]");
document.addEventListener("chambers:data", ({ detail: { view } }) => {
	const s = view.summary;
	root$1.querySelector("[data-chambers-summary]").textContent = `${s.loaded} loaded · ${s.empty} empty · ${s.noDay} without gas day · capacity ${fmt(view.capacity)} per chamber`;
	for (const f of view.filters) {
		const el = root$1.querySelector(`[data-count="${f.value}"]`);
		if (el) el.textContent = f.count;
	}
});
//#endregion
//#region src/components/custom/chamber-map/_store.js
var current = null;
var chambers = () => current;
async function loadChambers() {
	const raw = await chambersApi.view();
	current = {
		...raw,
		left: raw.left.map(decorate),
		right: raw.right.map(decorate)
	};
	current.byNumber = new Map([...current.left, ...current.right].map((c) => [String(c.n), c]));
	document.dispatchEvent(new CustomEvent("chambers:data", { detail: { view: current } }));
	return current;
}
async function setGasDay(n, planDate, clientTag) {
	const res = await chambersApi.setGasDay(Number(n), planDate, clientTag);
	await loadChambers();
	return res;
}
//#endregion
//#region src/components/custom/gas-days/gas-days.js
var root = document.querySelector("[data-fls-gas-days]");
var body = root.querySelector("[data-gas-body]");
var status = root.querySelector("[data-gas-status]");
var initial = /* @__PURE__ */ new Map();
document.addEventListener("chambers:data", ({ detail: { view } }) => {
	const drafts = new Map([...body.querySelectorAll(".gas-days__row.is-dirty")].map((row) => [row.dataset.gasRow, values(row)]));
	body.innerHTML = view.rows.length ? view.rows.map(rowHtml).join("") : "<tr><td colspan=\"7\" class=\"gas-days__empty\">No loaded chambers.</td></tr>";
	initial.clear();
	const readOnly = !can("chambers.gasday");
	body.querySelectorAll("[data-gas-row]").forEach((row) => {
		initial.set(row.dataset.gasRow, snapshot(row));
		row.querySelectorAll("input").forEach((i) => i.disabled = readOnly);
		if (readOnly) row.querySelector(".gas-days__save").hidden = true;
		const draft = drafts.get(row.dataset.gasRow);
		if (draft) {
			row.querySelector(".gas-days__date").value = draft.date;
			const tag = row.querySelector(".gas-days__tag");
			if (tag) tag.value = draft.tag;
			markDirty(row);
		}
	});
	updateStatus();
});
var values = (row) => ({
	date: row.querySelector(".gas-days__date").value,
	tag: row.querySelector(".gas-days__tag")?.value.trim() ?? ""
});
var snapshot = (row) => JSON.stringify(values(row));
function markDirty(row) {
	const dirty = snapshot(row) !== initial.get(row.dataset.gasRow);
	row.classList.toggle("is-dirty", dirty);
	const save = row.querySelector(".gas-days__save");
	save.disabled = !dirty;
	save.textContent = dirty ? "Save" : "Saved";
	save.classList.toggle("btn--primary", dirty);
	save.classList.toggle("btn--secondary", !dirty);
}
function updateStatus(text) {
	const dirty = body.querySelectorAll(".gas-days__row.is-dirty").length;
	status.textContent = text || (dirty ? `${dirty} unsaved change${dirty > 1 ? "s" : ""}` : "All changes saved");
	status.classList.toggle("gas-days__status--dirty", dirty > 0);
}
root.addEventListener("input", (e) => {
	const row = e.target.closest("[data-gas-row]");
	if (!row) return;
	markDirty(row);
	updateStatus();
});
root.addEventListener("click", async (e) => {
	const save = e.target.closest(".gas-days__save");
	if (!save || save.disabled) return;
	const row = save.closest("[data-gas-row]");
	const n = row.dataset.gasRow;
	const { date, tag } = values(row);
	save.classList.add("is-loading");
	save.disabled = true;
	updateStatus("Saving…");
	try {
		row.classList.remove("is-dirty");
		await setGasDay(n, date, row.dataset.mod === "regular" ? void 0 : tag);
	} catch (err) {
		row.classList.add("is-dirty");
		save.classList.remove("is-loading");
		save.disabled = false;
		toast("error", `Chamber ${n}: not saved`, err.message);
		updateStatus();
	}
});
//#endregion
//#region src/components/custom/chamber-map/chamber-map.js
var map = document.querySelector("[data-fls-chamber-map]");
var drawer = document.querySelector("[data-chamber-drawer]");
var message = map.querySelector("[data-map-message]");
var selected = null;
var filter = "all";
for (const col of map.querySelectorAll("[data-column]")) col.innerHTML = "<span class=\"chamber-tile chamber-tile--skeleton\" aria-hidden=\"true\"></span>".repeat(15);
document.addEventListener("chambers:data", ({ detail: { view } }) => {
	map.querySelector("[data-column=\"left\"]").innerHTML = view.left.map(tileHtml).join("");
	map.querySelector("[data-column=\"right\"]").innerHTML = view.right.map(tileHtml).join("");
	map.classList.remove("is-loading");
	map.removeAttribute("aria-busy");
	message.hidden = true;
	applyFilter();
	const keep = selected;
	selected = null;
	if (keep && view.byNumber.has(keep)) select(keep);
});
document.addEventListener("segmented:change", ({ detail }) => {
	if (detail.name !== "chamber-filter") return;
	filter = detail.value;
	applyFilter();
});
function applyFilter() {
	map.querySelectorAll(".chamber-tile[data-filter]").forEach((tile) => {
		const tags = tile.dataset.filter.split(" ");
		const show = filter === "all" || filter === "regular" && (tags.includes("regular") || tags.includes("mixed")) || filter === "bio" && (tags.includes("bio") || tags.includes("mixed")) || tags.includes(filter);
		tile.classList.toggle("is-dimmed", !show);
	});
}
map.addEventListener("click", (e) => {
	const tile = e.target.closest(".chamber-tile[data-chamber]");
	if (tile) select(tile.dataset.chamber);
});
onDrawerClose(() => select(null));
function select(n) {
	if (selected === n) return;
	selected = n;
	map.querySelectorAll(".chamber-tile[data-chamber]").forEach((tile) => {
		const on = tile.dataset.chamber === n;
		tile.classList.toggle("is-selected", on);
		tile.setAttribute("aria-pressed", String(on));
	});
	document.querySelectorAll("[data-gas-row]").forEach((row) => row.classList.toggle("is-selected", row.dataset.gasRow === n));
	const c = n && chambers()?.byNumber.get(n);
	if (c) fillDrawer(c);
}
function fillDrawer(c) {
	const $ = (sel) => drawer.querySelector(sel);
	const isCitro = c.mod === "citro";
	drawer.dataset.chamber = c.n;
	$("[data-slot=\"title\"]").textContent = `Chamber ${c.n}`;
	const chip = $("[data-slot=\"chip\"]");
	chip.textContent = labelOf(c.mod);
	chip.className = chipClass(c.mod);
	drawer.classList.toggle("chamber-drawer--citro", isCitro);
	if (isCitro) {
		$("[data-slot=\"rt\"]").textContent = fmt(c.rt);
		$("[data-slot=\"gs\"]").textContent = fmt(c.gs);
		$("[data-slot=\"dec\"]").textContent = fmt(c.dec);
	} else {
		const empty = c.mod === "empty";
		$("[data-slot=\"boxes\"]").textContent = c.boxesF;
		$("[data-slot=\"capacity\"]").textContent = `/ ${fmt(CAPACITY)} boxes`;
		$("[data-slot=\"meta\"]").textContent = empty ? "Empty · ready for a container" : `${c.pct}% full · ${c.freeF} free · ${c.supplier || "—"}`;
		const bar = $("[data-slot=\"bar\"]");
		bar.className = `progress progress--lg progress--${c.mod === "regular" ? "banana" : c.mod}`;
		bar.style.setProperty("--value", `${c.pct}%`);
		bar.style.setProperty("--split", `${c.pctMix}%`);
		$("[data-slot=\"no-day\"]").hidden = empty || Boolean(c.gas);
		const form = $("[data-gas-form]");
		form.hidden = empty || !can("chambers.gasday");
		form.elements.gas.value = c.gasIso || "";
		form.elements.tag.value = c.tag || "";
		form.querySelector("[data-slot=\"tag-field\"]").hidden = c.mod === "regular";
		renderRound(c, $);
		renderPlacements($("[data-slot=\"placements\"]"), $("#placement-row"), c.placements);
		$("[data-slot=\"placement-count\"]").textContent = c.placements.length ? `${c.placements.length} container side${c.placements.length > 1 ? "s" : ""}` : "none";
	}
	openDrawer(drawer);
}
function renderRound(c, $) {
	const p = roundParts(c.round);
	$("[data-slot=\"round\"]").hidden = c.mod === "empty";
	$("[data-slot=\"round-none\"]").hidden = Boolean(p);
	$("[data-slot=\"round-cells\"]").hidden = !p;
	$("[data-slot=\"round-when\"]").hidden = !p;
	$("[data-slot=\"round-link\"]").hidden = !can("chambers.gasday");
	if (!p) return;
	const color = (side) => p.sides.find((s) => s.side === side)?.color || "—";
	$("[data-slot=\"round-ls\"]").textContent = color("LS");
	$("[data-slot=\"round-rs\"]").textContent = color("RS");
	$("[data-slot=\"round-temp\"]").textContent = p.temp || "—";
	$("[data-slot=\"round-date\"]").textContent = p.date;
	$("[data-slot=\"round-kind\"]").textContent = p.kind;
}
function renderPlacements(list, template, placements) {
	list.replaceChildren(...placements.map((p) => {
		const row = template.content.cloneNode(true);
		row.querySelector("[data-slot=\"code\"]").textContent = p.code;
		row.querySelector("[data-damage]").dataset.damage = p.code;
		row.querySelector("[data-slot=\"tag\"]").textContent = p.tag || "";
		row.querySelector("[data-slot=\"side\"]").textContent = p.side;
		row.querySelector("[data-slot=\"boxes\"]").textContent = p.boxesF;
		return row;
	}));
}
drawer.addEventListener("click", (e) => {
	const b = e.target.closest("[data-damage]");
	if (b?.dataset.damage) openDamage(b.dataset.damage);
});
drawer.querySelector("[data-gas-form]").addEventListener("submit", async (e) => {
	e.preventDefault();
	const form = e.currentTarget;
	const button = form.querySelector("[type=\"submit\"]");
	const n = drawer.dataset.chamber;
	button.classList.add("is-loading");
	button.disabled = true;
	try {
		await setGasDay(n, form.elements.gas.value, form.elements.tag.value.trim());
		toast("success", `Chamber ${n}`, form.elements.gas.value ? "Gas day saved" : "Gas day cleared");
	} catch (err) {
		toast("error", `Chamber ${n}: not saved`, err.message);
	} finally {
		button.classList.remove("is-loading");
		button.disabled = false;
	}
});
async function start() {
	if (!await ready) return;
	try {
		await loadChambers();
	} catch (err) {
		if (err.status === 401) return location.reload();
		if (err.status === 0 || err.status >= 500) return showUnavailable(err);
		map.classList.remove("is-loading");
		message.textContent = `Chambers could not be loaded: ${err.message}`;
		message.hidden = false;
		return;
	}
	const n = location.hash.slice(1);
	if (n && chambers().byNumber.has(n)) select(n);
}
start();
//#endregion
