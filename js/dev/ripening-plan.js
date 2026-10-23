import { T as ripeningViewApi, d as ApiError, l as ready, u as showUnavailable, w as ripeningApi } from "./ui.min.js";
import { t as icon } from "./icon.min.js";
import "./app-shell.min.js";
import { t as toast } from "./toast.min.js";
import { n as esc, o as signed, r as fmt } from "./format.min.js";
//#region src/components/pages/ripening-plan/ripening-plan.js
var root = document.querySelector("[data-fls-ripening-plan]");
var $ = (sel) => root.querySelector(sel);
var slot = (name) => $(`[data-slot="${name}"]`);
var view = null;
var stamp = (iso) => new Date(iso).toLocaleString("en-GB", {
	day: "2-digit",
	month: "2-digit",
	hour: "2-digit",
	minute: "2-digit"
}).replace(",", "").replace("/", ".");
function checkHtml(c) {
	return `<li class="ripening__check ripening__check--${esc(c.state)}">
		<span class="ripening__check-icon" aria-hidden="true">${icon(c.state === "ok" ? "check" : "alert-triangle")}</span>
		<span class="ripening__check-text"><b>${esc(c.title)}</b><span>${esc(c.text)}</span></span>
		${c.link ? `<a href="${esc(c.link)}" class="panel__link">${esc(c.linkLabel)} →</a>` : ""}
	</li>`;
}
function roundHtml(r, today) {
	if (!r) return "";
	const parts = [
		r.ls && `LS <b>${esc(r.ls)}</b>`,
		r.rs && `RS <b>${esc(r.rs)}</b>`,
		r.temp != null && r.temp !== "" && `<b>${esc(String(r.temp).replace(".", ","))}°</b>`
	].filter(Boolean);
	return parts.length ? `<span class="day-row__round${r.date !== today ? " is-stale" : ""}">${parts.join(" · ")}</span>` : "";
}
function dayHtml(d) {
	const rows = d.rows.length ? d.rows.map((r) => `<li class="day-row${r.bio ? " day-row--bio" : ""}">
			<a class="day-row__room" href="chambers.html#${r.rooms[0]}" aria-label="Chamber ${r.rooms.join(", ")}">${r.rooms.join(", ")}</a>
			<span class="day-row__text">
				<span class="day-row__supplier">${esc(r.supplier)}</span>
				<span class="day-row__gas">${esc(r.gas)}${r.side ? ` · <b>${esc(r.side)}</b>` : ""}</span>
				${roundHtml(r.round, view.today)}
			</span>
			<span class="day-row__q">${esc(/^\d+$/.test(String(r.q)) ? fmt(r.q) : r.q)}</span>
		</li>`).join("") : "<li class=\"day-row day-row--empty\">No chambers for this day</li>";
	return `<article class="day-card${d.today ? " day-card--today" : ""}" aria-label="${d.dow} ${d.date}">
		<header class="day-card__head">
			<h2 class="day-card__date">${d.dow} <span>${d.date}</span></h2>
			${d.today ? "<span class=\"chip chip--sm day-card__today\">today</span>" : ""}
		</header>
		<dl class="day-card__stats">
			<div><dt>Plan</dt><dd>${fmt(d.plan)}</dd></div>
			<div><dt>In rooms</dt><dd>${fmt(d.rooms)}</dd></div>
			<div class="day-card__diff day-card__diff--${esc(d.tone)}"><dt>Diff</dt><dd>${signed(d.diff)}</dd></div>
		</dl>
		<ol class="day-card__rows">${rows}</ol>
		${d.comment ? `<footer class="day-card__comment"><span>Comment</span> ${esc(d.comment)}</footer>` : ""}
	</article>`;
}
function render() {
	slot("generated").textContent = view.generated ? `Last generated ${stamp(view.generated.modifiedAt)}.` : "Not generated yet.";
	const open = $("[data-open-file]");
	open.hidden = !view.generated;
	if (view.generated) open.href = `file.html?path=${encodeURIComponent(view.generated.path)}`;
	slot("checks").innerHTML = view.checks.map(checkHtml).join("");
	slot("days").innerHTML = view.days.map(dayHtml).join("");
}
async function load() {
	try {
		view = await ripeningViewApi.view();
	} catch (err) {
		if (err.status === 401) return location.reload();
		if (err.status === 0 || err.status >= 500) return showUnavailable(err);
		return toast("error", "Ripening plan could not be loaded", err.message);
	}
	render();
}
root.addEventListener("segmented:change", (e) => {
	if (e.detail.name === "ripening-view") slot("days").dataset.view = e.detail.value;
});
var generate = $("[data-generate]");
generate.addEventListener("click", async () => {
	const warn = view?.checks.some((c) => c.key === "gasday");
	generate.disabled = true;
	generate.classList.add("is-loading");
	try {
		await ripeningApi.generate(`week${view?.week ?? ""}`);
		toast("success", "Ripening plan generated", warn ? "Some chambers have no gas day — they are placed by delivery date." : "Open the file to print it.");
		await load();
	} catch (err) {
		if (!(err instanceof ApiError)) throw err;
		toast("error", "Plan not generated", err.message);
	} finally {
		generate.disabled = false;
		generate.classList.remove("is-loading");
	}
});
$("[data-ggn-input]").addEventListener("change", async (e) => {
	const file = e.target.files[0];
	e.target.value = "";
	if (!file) return;
	const label = e.target.closest(".ripening__ggn");
	label.classList.add("is-loading");
	try {
		const res = await ripeningApi.uploadGgn(file);
		toast("success", "GGN data updated", `${file.name} · ${res.count ?? "?"} plantations`);
		await load();
	} catch (err) {
		toast("error", "GGN not updated", err.message);
	} finally {
		label.classList.remove("is-loading");
	}
});
ready.then((user) => user && load());
//#endregion
