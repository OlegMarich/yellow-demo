import { C as reportsViewApi, N as API_MODE, S as reportsApi, _ as filesApi, d as ApiError, l as ready, o as currentUser, u as showUnavailable } from "./ui.min.js";
import { t as icon } from "./icon.min.js";
import "./app-shell.min.js";
import { t as toast } from "./toast.min.js";
import { i as isoToday, n as esc, t as dotDate } from "./format.min.js";
import "./dropzone.min.js";
//#region src/components/pages/reports/reports.js
var root = document.querySelector("[data-fls-reports]");
var $ = (sel) => root.querySelector(sel);
var $$ = (sel) => [...root.querySelectorAll(sel)];
var slot = (name) => $(`[data-slot="${name}"]`);
var dateInput = $("[data-date]");
var kb = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
var DAY_LINK = {
	"Loading list": "",
	Total: "stock.html",
	"Stock book": "stock.html",
	"Ripening plan": "ripening-plan.html"
};
var view = null;
var type = "all";
function fileRow(f, searchText) {
	const link = DAY_LINK[f.typeLabel] ? `<a href="${DAY_LINK[f.typeLabel]}" class="btn btn--ghost doc-file__open">Page</a>` : "";
	return `<li class="doc-file" data-type="${esc(f.type)}" data-search-text="${esc(searchText)}">
		${icon("file-check", "icon doc-file__icon")}
		<a class="doc-file__name mono" href="file.html?path=${encodeURIComponent(f.path)}" title="Open in the app">${esc(f.name)}</a>
		<span class="doc-file__type">${esc(f.typeLabel)}</span>
		<span class="doc-file__size">${kb(f.size)}</span>
		${link}
		<a href="${filesApi.downloadUrl(f.path)}" class="btn btn--secondary doc-file__dl" data-download download aria-label="Download ${esc(f.name)}">${icon("download")}</a>
	</li>`;
}
function render() {
	const label = dotDate(view.date);
	slot("date-label").textContent = label;
	const last = view.lastRun;
	const badge = slot("last-badge");
	badge.className = `badge badge--dot ${last ? "badge--match" : "badge--diff"}`;
	badge.textContent = last ? "done" : "not run";
	$("[data-last-at]").textContent = last ? new Date(last.at).toLocaleString("en-GB", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	}).replace(",", "") : "—";
	$("[data-last-trips]").textContent = last ? last.trips : "—";
	$("[data-last-files]").textContent = last ? last.files : "—";
	const day = view.dayFiles.length ? `<section class="doc-group" data-group aria-label="Day files">
			<header class="doc-group__head">
				<span class="doc-group__icon doc-group__icon--day" aria-hidden="true">${icon("calendar")}</span>
				<span class="doc-group__title"><b>Day files</b><span>${label}</span></span>
			</header>
			<ul class="doc-group__files">${view.dayFiles.map((f) => fileRow({
		...f,
		type: "day",
		typeLabel: f.label
	}, `${f.name} ${f.label}`)).join("")}</ul>
		</section>` : "";
	const trips = view.trips.map((t) => {
		const who = t.clients.join(" · ");
		return `<section class="doc-group" data-group aria-label="${esc(`${who} ${t.time}`)}">
			<header class="doc-group__head">
				<span class="doc-group__time">${esc(t.time)}</span>
				<span class="doc-group__title"><b>${esc(who)}</b><span class="mono">${esc([t.truck, t.trailer].filter(Boolean).join(" · "))}</span></span>
				<span class="doc-group__products">${t.products.map((p) => `<span class="chip chip--sm">${esc(p)}</span>`).join("")}</span>
			</header>
			<ul class="doc-group__files">${t.files.map((f) => fileRow(f, `${who} ${t.truck} ${t.trailer} ${f.name}`)).join("")}</ul>
		</section>`;
	}).join("");
	slot("groups").innerHTML = day + trips;
	filter();
}
function filter() {
	const q = $("[data-search]").value.trim().toLowerCase();
	let any = false;
	$$("[data-group]").forEach((group) => {
		let shown = 0;
		group.querySelectorAll(".doc-file").forEach((file) => {
			const ok = (type === "all" || file.dataset.type === type) && (!q || file.dataset.searchText.toLowerCase().includes(q));
			file.hidden = !ok;
			if (ok) shown++;
		});
		group.hidden = shown === 0;
		any ||= shown > 0;
	});
	const nothing = !view.trips.length && !view.dayFiles.length;
	slot("empty-title").textContent = nothing ? `No documents for ${dotDate(view.date)}` : "Nothing matches";
	slot("empty-text").textContent = nothing ? "Upload the transport plan above to generate them." : "Clear the search or pick another type.";
	$("[data-empty]").hidden = any;
}
async function load(date) {
	try {
		view = await reportsViewApi.view(date);
	} catch (err) {
		if (err.status === 401) return location.reload();
		if (err.status === 0 || err.status >= 500) return showUnavailable(err);
		return toast("error", "Documents could not be loaded", err.message);
	}
	render();
}
$("[data-search]").addEventListener("input", () => view && filter());
root.addEventListener("segmented:change", (e) => {
	if (e.detail.name !== "doc-type") return;
	type = e.detail.value;
	if (view) filter();
});
dateInput.addEventListener("change", () => {
	if (!dateInput.value) return;
	history.replaceState(null, "", `?date=${dateInput.value}`);
	load(dateInput.value);
});
root.addEventListener("click", (e) => {
	if (!e.target.closest("[data-download]") || API_MODE !== "mock") return;
	e.preventDefault();
	toast("error", "Not in the demo", "Open the file in the app instead — downloads come from the server.");
});
var form = $("[data-run-form]");
if (form) {
	const zone = form.querySelector("[data-fls-dropzone]");
	const submit = $("[data-run-submit]");
	root.addEventListener("dropzone:file", () => submit.disabled = false);
	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!zone.file) return;
		const date = dateInput.value;
		submit.disabled = true;
		submit.classList.add("is-loading");
		try {
			await reportsApi.runDay(date, zone.file);
			toast("success", "Documents generated", `${dotDate(date)} · from ${zone.file.name}`);
			const file = zone.file.name;
			zone.reset();
			await load(date);
			$("[data-last-by]").textContent = currentUser()?.name ?? "—";
			$("[data-last-file]").textContent = file;
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			toast("error", "Documents not generated", err.message);
			submit.disabled = false;
		} finally {
			submit.classList.remove("is-loading");
		}
	});
}
var fromUrl = new URLSearchParams(location.search).get("date");
dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(fromUrl || "") ? fromUrl : isoToday();
ready.then((user) => user && load(dateInput.value));
//#endregion
