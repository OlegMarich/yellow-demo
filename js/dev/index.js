import { A as todayApi, N as API_MODE, k as stockApi, l as ready, u as showUnavailable } from "./ui.min.js";
import { t as icon } from "./icon.min.js";
import "./app-shell.min.js";
import { t as toast } from "./toast.min.js";
import { a as longDate, i as isoToday, n as esc, r as fmt, s as timeNow } from "./format.min.js";
//#region src/components/pages/index/_render.js
function kpiHtml(k) {
	const dot = k.dot ? `<span class="kpi-tile__dot kpi-tile__dot--${esc(k.dot)}" aria-hidden="true"></span>` : "";
	const bar = k.bar !== void 0 && k.bar !== null && k.key === "shipped" ? `<span class="kpi-tile__bar progress" role="progressbar" aria-valuenow="${k.bar}" aria-valuemin="0" aria-valuemax="100" style="--value: ${k.bar}%"><span class="progress__fill"></span></span>` : "";
	return `<article class="kpi-tile${k.tone ? ` kpi-tile--${esc(k.tone)}` : ""}">
		<span class="kpi-tile__label">${dot}${esc(k.label)}</span>
		<span class="kpi-tile__value">${fmt(k.value)}</span>
		${bar}
		<span class="kpi-tile__meta">${esc(k.meta)}</span>
	</article>`;
}
function alertHtml(a) {
	return `<li class="alert-list__item alert-list__item--${esc(a.level)}">
		<span class="alert-list__icon" aria-hidden="true">${icon(a.level === "danger" ? "alert-triangle" : "alert-circle")}</span>
		<span class="alert-list__text">
			<span class="alert-list__title">${esc(a.title)}</span>
			<span class="alert-list__meta${a.mono ? " alert-list__meta--mono" : ""}">${esc(a.meta)}</span>
		</span>
		<a href="${esc(a.href)}" class="alert-list__action">${esc(a.action)} <span aria-hidden="true">→</span></a>
	</li>`;
}
function barsHtml(view) {
	const cap = fmt(view.capacity || 2592);
	const col = (side) => `<ul class="chamber-bars__column chamber-bars__column--${side}">${view[side].map((c) => {
		const citro = c.mod === "citro";
		const title = citro ? `Chamber ${c.n} · CITRO` : `Chamber ${c.n} · ${fmt(c.boxes)} / ${cap}`;
		const value = citro ? 25 : Number(c.pct) || 0;
		return `<li class="chamber-bars__row" title="${title}">
			<span class="chamber-bars__num">${c.n}</span>
			<span class="chamber-bars__track chamber-bars__track--${c.mod}" style="--value: ${value}%; --split: ${Number(c.pctMix) || 0}%"><span class="chamber-bars__fill"></span></span>
		</li>`;
	}).join("")}</ul>`;
	return `${col("left")}<span class="chamber-bars__aisle" aria-hidden="true">aisle</span>${col("right")}`;
}
//#endregion
//#region src/components/pages/index/index.js
var root = document.querySelector("[data-fls-index]");
var $ = (sel) => root.querySelector(sel);
var date = /^\d{4}-\d{2}-\d{2}$/.test(new URLSearchParams(location.search).get("date") || "") ? new URLSearchParams(location.search).get("date") : isoToday();
function render(view) {
	$("[data-today-subtitle]").textContent = `${longDate(view.date)} · data as of ${timeNow()}`;
	$("[data-today-kpis]").innerHTML = view.kpis.map(kpiHtml).join("");
	$("[data-alerts-count]").textContent = `${view.alerts.length} open`;
	$("[data-today-alerts]").innerHTML = view.alerts.length ? view.alerts.map(alertHtml).join("") : "<li class=\"alert-list__empty\">Nothing needs attention right now.</li>";
	$("[data-chamber-bars]").innerHTML = barsHtml(view.chambers);
	const badge = document.querySelector(".sidebar__item--active .sidebar__count");
	if (badge) badge.textContent = view.alerts.length;
}
async function load() {
	try {
		render(await todayApi.view(date));
	} catch (err) {
		if (err.status === 401) return location.reload();
		if (err.status === 0 || err.status >= 500) return showUnavailable(err);
		toast("error", "Today could not be loaded", err.message);
	}
}
var total = $("[data-total-link]");
total?.setAttribute("href", stockApi.totalUrl(date));
total?.addEventListener("click", (e) => {
	if (API_MODE !== "mock") return;
	e.preventDefault();
	toast("error", "Not in the demo", "Files are made by the Banana Report server.");
});
$("[data-fill-day]")?.addEventListener("click", async (e) => {
	const btn = e.currentTarget;
	btn.classList.add("is-loading");
	btn.disabled = true;
	try {
		await stockApi.fill(date);
		toast("success", "Stock day filled", `${date} written to the stock book`);
	} catch (err) {
		toast("error", "Stock day not filled", err.message);
	} finally {
		btn.classList.remove("is-loading");
		btn.disabled = false;
	}
});
ready.then((user) => user && load());
//#endregion
