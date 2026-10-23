import { b as planWeekApi, d as ApiError, l as ready, u as showUnavailable, x as plansApi } from "./ui.min.js";
/* empty css               */
import { t as icon } from "./icon.min.js";
import "./app-shell.min.js";
import { t as toast } from "./toast.min.js";
import { n as esc, r as fmt } from "./format.min.js";
import "./dropzone.min.js";
//#region src/components/pages/plan-week/plan-week.js
var root = document.querySelector("[data-fls-plan-week]");
var $ = (sel) => root.querySelector(sel);
var $$ = (sel) => [...root.querySelectorAll(sel)];
var slot = (name) => $(`[data-slot="${name}"]`);
var stamp = (iso) => iso ? new Date(iso).toLocaleString("en-GB", {
	day: "2-digit",
	month: "2-digit",
	hour: "2-digit",
	minute: "2-digit"
}).replace(",", "").replace("/", ".") : "";
var view = null;
var product = "all";
function renderWeek() {
	slot("week-title").textContent = `W${view.week}`;
	slot("range").textContent = view.range ? `${view.range} ·` : "";
	slot("weeks").innerHTML = view.weeks.map((w) => {
		const on = Number(w.value) === view.week;
		const note = w.status === "done" ? "done" : w.status === "current" ? "now" : "next";
		return `<button type="button" class="segmented__option${on ? " segmented__option--active" : ""}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-value="${w.value}">${esc(w.label)}<span class="segmented__count">${note}</span></button>`;
	}).join("");
	root.querySelector("[data-upload-form]").week.value = view.week;
	const done = view.files.filter((f) => f.exists).length;
	slot("files-title").textContent = done ? `Week W${view.week}${done === view.files.length ? " is ready" : ""}` : `Week W${view.week} · nothing uploaded`;
	const badge = $("[data-week-status]");
	badge.className = `badge badge--dot ${done === view.files.length ? "badge--match" : "badge--diff"}`;
	badge.textContent = `${done} of ${view.files.length}`;
	slot("files").innerHTML = view.files.map((f) => `<li class="plan-week__file${f.exists ? "" : " plan-week__file--missing"}">
		<span class="plan-week__check" aria-hidden="true">${icon(f.exists ? "check" : "alert-circle")}</span>
		<span class="plan-week__file-text"><b>${esc(f.label)}</b><span class="mono">${esc(f.name)}</span></span>
		<span class="plan-week__file-meta" data-file-meta>${esc([f.detail, stamp(f.modifiedAt)].filter(Boolean).join(" · "))}</span>
	</li>`).join("");
}
function renderTable() {
	const today = view.today;
	const cls = (i) => i === today ? " plan-week__today" : "";
	slot("head").innerHTML = `<th scope="col">Client · location</th><th scope="col">Product</th>${view.days.map((d, i) => `<th scope="col" class="data-table__cell--num${cls(i)}">${d.dow} <small>${d.date}</small></th>`).join("")}<th scope="col" class="data-table__cell--num">Week</th>`;
	slot("body").innerHTML = view.items.map((it) => `<tr class="data-table__row" data-product="${esc(it.product)}" data-search-text="${esc(`${it.client} ${it.location} ${it.country}`)}">
		<th scope="row"><b>${esc(it.client)}</b> <span class="plan-week__loc">${esc([it.location, it.country].filter(Boolean).join(" · "))}</span></th>
		<td><span class="chip chip--sm plan-week__product plan-week__product--${esc(it.product)}">${esc(it.productLabel)}</span></td>
		${it.qty.map((q, i) => `<td class="data-table__cell--num${q === 0 ? " data-table__cell--zero" : ""}${cls(i)}" data-qty="${q}">${fmt(q)}</td>`).join("")}
		<td class="data-table__cell--num data-table__cell--strong" data-qty="${it.total}">${fmt(it.total)}</td>
	</tr>`).join("");
	$("[data-totals]").innerHTML = `<th scope="row" colspan="2">Total <span data-total-label>· all products</span></th>${view.days.map((d, i) => `<td class="data-table__cell--num${cls(i)}">0</td>`).join("")}<td class="data-table__cell--num">0</td>`;
	filter();
}
function filter() {
	const rows = $$("[data-slot=\"body\"] tr");
	const totals = [...$("[data-totals]").querySelectorAll("td")];
	const q = $("[data-search]").value.trim().toLowerCase();
	let shown = 0;
	const sums = totals.map(() => 0);
	rows.forEach((row) => {
		const visible = (product === "all" || row.dataset.product === product) && (!q || row.dataset.searchText.toLowerCase().includes(q));
		row.hidden = !visible;
		if (!visible) return;
		shown++;
		row.querySelectorAll("[data-qty]").forEach((td, i) => sums[i] += Number(td.dataset.qty));
	});
	totals.forEach((td, i) => {
		td.textContent = fmt(sums[i]);
		td.classList.toggle("data-table__cell--zero", sums[i] === 0);
	});
	const label = $(`[data-segmented="product"] [data-value="${product}"]`).textContent;
	$("[data-total-label]").textContent = `· ${product === "all" ? "all products" : label}${q ? ` · “${q}”` : ""}`;
	const empty = $("[data-empty]");
	empty.hidden = shown > 0;
	slot("empty-title").textContent = view.hasPlan ? "No clients match" : `No Sales Plan for W${view.week}`;
	slot("empty-text").textContent = view.hasPlan ? "Clear the search or pick another product." : "Upload sales.xlsx for this week above.";
	$("[data-totals]").hidden = shown === 0;
}
async function load(week) {
	try {
		view = await planWeekApi.view(week);
	} catch (err) {
		if (err.status === 401) return location.reload();
		if (err.status === 0 || err.status >= 500) return showUnavailable(err);
		return toast("error", "Week could not be loaded", err.message);
	}
	renderWeek();
	renderTable();
}
$("[data-search]").addEventListener("input", () => view && filter());
root.addEventListener("segmented:change", (e) => {
	if (e.detail.name === "product") {
		product = e.detail.value;
		if (view) filter();
	}
	if (e.detail.name === "week") {
		history.replaceState(null, "", `?week=${e.detail.value}`);
		load(e.detail.value);
	}
});
var form = $("[data-upload-form]");
var zone = $("[data-fls-dropzone]");
var submit = $("[data-upload-submit]");
root.addEventListener("dropzone:file", () => submit.disabled = false);
form.addEventListener("submit", async (e) => {
	e.preventDefault();
	const week = Number(form.week.value);
	if (!zone.file) return toast("error", "Choose the Sales Plan first", "sales.xlsx for one week");
	if (!(week >= 1 && week <= 53)) return form.week.focus();
	submit.disabled = true;
	submit.classList.add("is-loading");
	const files = $$(".plan-week__file");
	files.forEach((f) => f.classList.add("is-busy"));
	try {
		await plansApi.uploadSales(week, zone.file);
		toast("success", `Week W${week} plan generated`, "Sales Plan parsed — ripening and orders use it now.");
		zone.reset();
		history.replaceState(null, "", `?week=${week}`);
		await load(week);
	} catch (err) {
		if (!(err instanceof ApiError)) throw err;
		toast("error", "Plan not generated", err.message);
		submit.disabled = false;
	} finally {
		submit.classList.remove("is-loading");
		files.forEach((f) => f.classList.remove("is-busy"));
	}
});
var fromUrl = new URLSearchParams(location.search).get("week");
ready.then((user) => user && load(/^\d{1,2}$/.test(fromUrl || "") ? fromUrl : ""));
//#endregion
