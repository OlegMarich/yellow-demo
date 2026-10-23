import { N as API_MODE, k as stockApi, l as ready, u as showUnavailable } from "./ui.min.js";
/* empty css               */
import "./app-shell.min.js";
import { t as toast } from "./toast.min.js";
import { i as isoToday, n as esc, o as signed, r as fmt, t as dotDate } from "./format.min.js";
import "./file2.min.js";
//#region src/components/pages/stock/stock.js
var root = document.querySelector("[data-fls-stock]");
var $ = (sel) => root.querySelector(sel);
var slot = (name) => root.querySelector(`[data-slot="${name}"]`);
var dateInput = $("[data-stock-date]");
var fileInput = root.querySelector("[data-file-input]");
var reconcileBtn = root.querySelector("[data-reconcile]");
var view = null;
var report = null;
var MAIN_FIELD = { INBOUND: "in" };
var fieldLabel = {
	out: "OUT",
	in: "IN",
	rejection: "REJ",
	ifs: "IFS",
	ekaer: "EKAER"
};
function renderSheets() {
	const totals = report?.totals || {};
	let bad = 0;
	slot("date").textContent = dotDate(view.date);
	slot("sheets").innerHTML = view.sheets.map((s) => {
		const t = totals[s.key];
		const theirs = t ? t.theirs : null;
		const diff = t ? t.theirs - s.system : null;
		const isBad = Boolean(diff);
		if (isBad) bad++;
		const zero = !s.system && !theirs;
		return `<tr class="data-table__row${isBad ? " data-table__row--diff" : ""}">
			<th scope="row"${isBad ? " class=\"data-table__cell--strong\"" : ""}>${esc(s.name)}</th>
			<td class="data-table__cell--num${zero ? " data-table__cell--zero" : ""}">${fmt(s.system)}</td>
			<td class="data-table__cell--num${zero ? " data-table__cell--zero" : ""}">${theirs === null ? "—" : fmt(theirs)}</td>
			<td class="data-table__cell--num ${isBad ? "data-table__cell--bad" : "data-table__cell--zero"}">${diff === null ? "—" : signed(diff)}</td>
		</tr>`;
	}).join("");
	const badge = slot("sheets-badge");
	badge.hidden = !report;
	badge.className = `badge badge--dot ${bad ? "badge--diff" : "badge--match"}`;
	badge.textContent = bad ? `${bad} of ${view.sheets.length} sheets differ${bad === 1 ? "s" : ""}` : "All sheets match";
}
function issueRow(sheet, i) {
	const main = MAIN_FIELD[sheet] || "out";
	const who = (row) => [row?.customer || row?.container, row?.truck].filter(Boolean).join(" · ");
	let kind, badge, client, field, sys, file, diff;
	if (i.type === "qty-diff") [kind, badge, client, field, sys, file, diff] = [
		"diff",
		"diff",
		i.label,
		i.field,
		fmt(i.system),
		fmt(i.theirs),
		signed(i.diff)
	];
	else if (i.type === "text-diff") [kind, badge, client, field, sys, file, diff] = [
		"diff",
		"diff",
		i.label,
		i.field,
		esc(i.system),
		esc(i.theirs),
		"—"
	];
	else if (i.type === "missing-in-their-file") [kind, badge, client, field, sys, file, diff] = [
		"missing",
		"missing in file",
		who(i.system),
		main,
		fmt(i.system?.[main]),
		"—",
		signed(-(Number(i.system?.[main]) || 0))
	];
	else [kind, badge, client, field, sys, file, diff] = [
		"extra",
		"not in system",
		who(i.theirs),
		main,
		"—",
		fmt(i.theirs?.[main]),
		signed(Number(i.theirs?.[main]) || 0)
	];
	return {
		kind,
		html: `<tr class="data-table__row">
		<td><span class="badge badge--${kind}">${badge}</span></td>
		<td class="stock__client"><span>${esc(client)}</span><span class="mono">${esc(sheet)}</span></td>
		<td><span class="mono stock__field">${fieldLabel[field] || esc(field)}</span></td>
		<td class="data-table__cell--num">${sys}</td>
		<td class="data-table__cell--num">${file}</td>
		<td class="data-table__cell--num stock__diff stock__diff--${kind}">${diff}</td>
	</tr>`
	};
}
function renderIssues() {
	const panel = slot("issues-panel");
	panel.hidden = !report;
	if (!report) return;
	const rows = Object.entries(report.sheets || {}).flatMap(([sheet, list]) => list.map((i) => issueRow(sheet, i)));
	slot("issues-count").textContent = `${rows.length} issue${rows.length === 1 ? "" : "s"}`;
	const count = (k) => rows.filter((r) => r.kind === k).length;
	slot("issues-badges").innerHTML = [
		["diff", "diff"],
		["missing", "missing in file"],
		["extra", "not in system"]
	].filter(([k]) => count(k)).map(([k, label]) => `<span class="badge badge--${k}">${label} ${count(k)}</span>`).join("");
	slot("issues").innerHTML = rows.length ? rows.map((r) => r.html).join("") : "<tr><td colspan=\"6\" class=\"stock__empty\">The file matches the system for this day.</td></tr>";
}
function renderUnscanned() {
	slot("unscanned-meta").textContent = `Orders planned for ${dotDate(view.date).slice(0, 5)} with no outbound scans yet.`;
	slot("unscanned").innerHTML = view.notScanned.length ? view.notScanned.map((o) => `<li class="stock__order">
			<span class="stock__order-client">${esc(o.client)}</span>
			<span class="stock__order-boxes">${fmt(o.qty)}</span>
			<span class="stock__order-meta">${esc([
		o.time && `Truck ${o.time}`,
		o.car,
		o.product !== "BANANA" ? o.product : ""
	].filter(Boolean).join(" · "))}</span>
			<span class="stock__order-meta stock__order-meta--right">boxes</span>
		</li>`).join("") : "<li class=\"stock__empty\">Everything planned for this day is scanned.</li>";
	slot("unscanned-total").textContent = fmt(view.notScannedTotal);
}
function renderLinks() {
	const year = view.date.slice(0, 4);
	root.querySelector("[data-download=\"book\"]").href = stockApi.bookUrl(year);
	root.querySelector("[data-download=\"total\"]").href = stockApi.totalUrl(view.date);
}
async function load(date) {
	try {
		view = await stockApi.view(date);
	} catch (err) {
		if (err.status === 401) return location.reload();
		if (err.status === 0 || err.status >= 500) return showUnavailable(err);
		return toast("error", "Stock could not be loaded", err.message);
	}
	renderSheets();
	renderIssues();
	renderUnscanned();
	renderLinks();
}
dateInput.addEventListener("change", () => {
	if (!dateInput.value) return;
	report = null;
	history.replaceState(null, "", `?date=${dateInput.value}`);
	load(dateInput.value);
});
root.querySelectorAll("[data-download]").forEach((a) => a.addEventListener("click", (e) => {
	if (API_MODE !== "mock") return;
	e.preventDefault();
	toast("error", "Not in the demo", "Files are made by the Banana Report server.");
}));
async function busy(btn, fn) {
	btn.classList.add("is-loading");
	btn.disabled = true;
	try {
		await fn();
	} finally {
		btn.classList.remove("is-loading");
		btn.disabled = false;
	}
}
root.querySelector("[data-fill-day]")?.addEventListener("click", (e) => busy(e.currentTarget, async () => {
	try {
		await stockApi.fill(dateInput.value);
		toast("success", "Stock day filled", `${dotDate(dateInput.value)} written to the stock book`);
		await load(dateInput.value);
	} catch (err) {
		toast("error", "Stock day not filled", err.message);
	}
}));
fileInput?.addEventListener("change", () => {
	const file = fileInput.files[0];
	reconcileBtn.disabled = !file;
	if (!file) return;
	const meta = root.querySelector(".file-card__meta");
	meta.innerHTML = `<span class="mono">${esc(file.name)}</span> · ${Math.max(1, Math.round(file.size / 1024))} KB`;
});
reconcileBtn?.addEventListener("click", (e) => busy(e.currentTarget, async () => {
	const file = fileInput.files[0];
	if (!file) return;
	try {
		report = await stockApi.reconcile(dateInput.value, file);
		renderSheets();
		renderIssues();
		toast(report.ok ? "success" : "error", report.ok ? "File matches the system" : "Differences found", `${file.name} · ${dotDate(dateInput.value)}`);
	} catch (err) {
		toast("error", "Reconcile failed", err.message);
	}
}));
var fromUrl = new URLSearchParams(location.search).get("date");
dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(fromUrl || "") ? fromUrl : isoToday();
ready.then((user) => user && load(dateInput.value));
//#endregion
//#region src/components/custom/file-card/file-card.js
document.querySelectorAll("[data-fls-file-card]").forEach((card) => {
	const input = card.querySelector("[data-file-input]");
	input?.addEventListener("change", () => {
		const file = input.files[0];
		if (!file) return;
		card.querySelector(".file-card__meta").innerHTML = "";
		const name = Object.assign(document.createElement("span"), {
			className: "mono",
			textContent: file.name
		});
		card.querySelector(".file-card__meta").append(name, ` · ${Math.round(file.size / 1024)} KB · just now`);
	});
});
//#endregion
