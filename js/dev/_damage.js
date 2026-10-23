import { h as defectsApi, r as t, t as lang } from "./ui.min.js";
import { n as esc, r as fmt } from "./format.min.js";
//#region src/components/custom/damage/_damage.js
var catalog = null;
async function loadCatalog() {
	catalog ??= defectsApi.catalog().catch((err) => {
		catalog = null;
		throw err;
	});
	return catalog;
}
var txt = (field) => field ? field[lang] || field.en || field.uk || "" : "";
var ACTION_CLASS = {
	DEC: "chip--dec",
	GS: "chip--gs",
	RT: "chip--rt"
};
var ACTION_LABEL = {
	DEC: "DEC",
	GS: "GS",
	RT: "R+T"
};
function groupName(cat, id) {
	return txt(cat.groups.find((g) => g.id === id)?.name) || id;
}
/** one defect as a card (button header → details) */
function defectCardHtml(d, cat, { open = false, photos = true } = {}) {
	const action = d.action ? `<span class="chip chip--sm ${ACTION_CLASS[d.action] || ""}">${ACTION_LABEL[d.action] || esc(d.action)}</span>` : "";
	return `<article class="defect-card defect-card--${esc(d.group)}${open ? " is-open" : ""}" data-defect="${esc(d.id)}">
		<button type="button" class="defect-card__head" aria-expanded="${open}">
			<span class="defect-card__sev" data-no-i18n>${esc(groupName(cat, d.group))}</span>
			<span class="defect-card__name" data-no-i18n>${esc(txt(d.name))}</span>
			${action}
		</button>
		<div class="defect-card__body" data-no-i18n>
			<p class="defect-card__look">${esc(txt(d.look))}</p>
			${d.limit ? `<p class="defect-card__limit"><b>${esc(t("Межа"))}:</b> ${esc(txt(d.limit))}</p>` : ""}
			${photos ? "<div class=\"defect-card__photos\" data-photos></div>" : ""}
		</div>
	</article>`;
}
/** photo thumbnails (loaded with the session) into a list element; tap → full size */
function thumbs(list, photos, cat) {
	list.innerHTML = photos.map((p) => `<button type="button" class="damage-thumb" data-photo="${esc(p.id)}" title="${esc([
		p.containerNumber,
		p.note,
		p.by
	].filter(Boolean).join(" · "))}">
		<img alt="" loading="lazy"><span class="damage-thumb__meta" data-no-i18n>${esc(p.containerNumber || "")}${p.defect && cat ? ` · ${esc(txt(cat.defects.find((d) => d.id === p.defect)?.name))}` : ""}</span></button>`).join("");
	list.querySelectorAll("[data-photo]").forEach(async (b) => {
		try {
			b.querySelector("img").src = await defectsApi.photoUrl(b.dataset.photo);
		} catch {
			b.classList.add("is-missing");
		}
	});
}
document.addEventListener("click", (e) => {
	const b = e.target.closest(".damage-thumb");
	if (!b || b.classList.contains("is-missing")) return;
	const src = b.querySelector("img")?.src;
	if (!src) return;
	const dlg = dialog("damage-dialog damage-dialog--photo");
	dlg.innerHTML = `<button type="button" class="damage-dialog__close btn btn--icon" data-close aria-label="${esc(t("Закрити"))}">✕</button><img class="damage-dialog__big" src="${src}" alt="">`;
	dlg.showModal();
});
function dialog(cls) {
	const dlg = document.createElement("dialog");
	dlg.className = cls;
	dlg.addEventListener("click", (e) => {
		if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
	});
	dlg.addEventListener("close", () => dlg.remove());
	document.body.append(dlg);
	return dlg;
}
/** chamber drawer → "i" next to a container: everything about its damage */
async function openDamage(code) {
	const dlg = dialog("damage-dialog");
	dlg.innerHTML = `<header class="damage-dialog__head"><h2 class="damage-dialog__title">${esc(t("Пошкодження"))} · <span data-no-i18n>${esc(code)}</span></h2>
		<button type="button" class="btn btn--icon" data-close aria-label="${esc(t("Закрити"))}">✕</button></header>
		<div class="damage-dialog__body" data-body><p class="damage-dialog__empty">${esc(t("Завантаження…"))}</p></div>`;
	dlg.showModal();
	const body = dlg.querySelector("[data-body]");
	let r;
	try {
		[r] = await Promise.all([defectsApi.container(code), loadCatalog()]);
	} catch (err) {
		body.innerHTML = `<p class="damage-dialog__empty">${esc(err.status === 0 ? t("Немає мережі") : err.message)}</p>`;
		return;
	}
	const nc = r.nonConforming || {};
	const cats = (r.categories || []).map((c) => `<div class="damage-nc damage-nc--${c.id.toLowerCase()}" title="${esc(txt(c.hint))}">
		<span class="chip chip--sm ${ACTION_CLASS[c.id]}">${ACTION_LABEL[c.id]}</span><b>${fmt(nc[c.id] || 0)}</b><small data-no-i18n>${esc(txt(c.name).split("·").pop().trim())}</small></div>`).join("");
	const none = !r.defects.length && !r.photos.length && !r.nonConformingTotal;
	body.innerHTML = `
		<p class="damage-dialog__meta">${r.known ? `${esc(t("Пораховано при прийомі"))}: <b>${fmt(r.counted)}</b> · ${esc(t("невідповідних"))}: <b>${fmt(r.nonConformingTotal)}</b>` : esc(t("Контейнер не знайдено в реєстрі"))}</p>
		<div class="damage-nc-row">${cats}</div>
		${none ? `<p class="damage-dialog__empty">${esc(t("Пошкоджень при прийомі не записано"))}</p>` : ""}
		${r.defects.length ? `<h3 class="damage-dialog__section">${esc(t("Знайдені дефекти"))}</h3><div class="defect-list">${r.defects.map((d) => defectCardHtml(d, r, {
		open: true,
		photos: false
	})).join("")}</div>` : ""}
		${r.photos.length ? `<h3 class="damage-dialog__section">${esc(t("Фото"))} · ${r.photos.length}</h3><div class="damage-thumbs" data-thumbs></div>` : ""}`;
	if (r.photos.length) thumbs(body.querySelector("[data-thumbs]"), r.photos, r);
	bindCards(body);
}
/** expand / collapse defect cards inside a root */
function bindCards(root, onOpen) {
	root.addEventListener("click", (e) => {
		const head = e.target.closest(".defect-card__head");
		if (!head) return;
		const card = head.closest(".defect-card");
		const open = !card.classList.contains("is-open");
		card.classList.toggle("is-open", open);
		head.setAttribute("aria-expanded", String(open));
		if (open && onOpen) onOpen(card);
	});
}
/** receiving: tick the defects found in the container */
async function openDefectPicker(selected = []) {
	const cat = await loadCatalog();
	const dlg = dialog("damage-dialog damage-dialog--picker");
	const chosen = new Set(selected);
	dlg.innerHTML = `<header class="damage-dialog__head"><h2 class="damage-dialog__title">${esc(t("Які пошкодження?"))}</h2>
		<button type="button" class="btn btn--icon" data-close aria-label="${esc(t("Закрити"))}">✕</button></header>
		<div class="damage-dialog__body">${cat.groups.map((g) => `<h3 class="damage-dialog__section">${esc(txt(g.name))}</h3>
			<div class="defect-pick">${cat.defects.filter((d) => d.group === g.id).map((d) => `<label class="defect-pick__item defect-pick__item--${esc(d.group)}">
				<input type="checkbox" value="${esc(d.id)}"${chosen.has(d.id) ? " checked" : ""}><span data-no-i18n>${esc(txt(d.name))}</span>
				<button type="button" class="defect-pick__info" data-info="${esc(d.id)}" aria-label="${esc(t("Довідник"))}">i</button></label>`).join("")}</div>`).join("")}</div>
		<footer class="damage-dialog__foot"><button type="button" class="btn btn--primary btn--lg btn--block" data-done>${esc(t("Done"))}</button></footer>`;
	dlg.showModal();
	dlg.addEventListener("click", (e) => {
		const info = e.target.closest("[data-info]");
		if (!info) return;
		e.preventDefault();
		openReference(info.dataset.info);
	});
	return new Promise((resolve) => {
		let result = null;
		dlg.querySelector("[data-done]").addEventListener("click", () => {
			result = [...dlg.querySelectorAll("input:checked")].map((i) => i.value);
			dlg.close();
		});
		dlg.addEventListener("close", () => resolve(result));
	});
}
/** the defect reference inside receiving; with an id: only that defect, opened */
async function openReference(focusId = "") {
	const cat = await loadCatalog();
	const dlg = dialog("damage-dialog damage-dialog--ref");
	const CHIP = {
		DEC: "chip--dec",
		GS: "chip--gs",
		RT: "chip--rt"
	};
	const one = focusId && cat.defects.find((d) => d.id === focusId);
	dlg.innerHTML = `<header class="damage-dialog__head"><h2 class="damage-dialog__title">${esc(one ? txt(one.name) : t("Довідник дефектів"))}</h2>
		<button type="button" class="btn btn--icon" data-close aria-label="${esc(t("Закрити"))}">✕</button></header>
		<div class="damage-dialog__body">
			${one ? "" : `<div class="damage-cats">${cat.categories.map((c) => `<div class="damage-cat"><span class="chip chip--sm ${CHIP[c.id] || ""}">${ACTION_LABEL[c.id] || esc(c.id)}</span>
				<p data-no-i18n><b>${esc(txt(c.name).split("·").pop().trim())}</b> — ${esc(txt(c.hint))}</p></div>`).join("")}</div>
			<div class="damage-ref__tools">
				<div class="segmented" role="radiogroup" data-segmented="ref-group">${[["all", t("Усі")], ...cat.groups.map((g) => [g.id, txt(g.name)])].map(([v, l], i) => `<button type="button" class="segmented__option${i ? "" : " segmented__option--active"}" role="radio" aria-checked="${!i}" data-value="${esc(v)}" data-no-i18n>${esc(l)}</button>`).join("")}</div>
				<input type="search" class="field__input" placeholder="${esc(t("Пошук дефекту"))}" data-ref-search>
			</div>`}
			<div data-ref-list></div>
		</div>`;
	const list = dlg.querySelector("[data-ref-list]");
	let group = "all";
	const loaded = /* @__PURE__ */ new Set();
	async function photos(card) {
		const id = card.dataset.defect;
		if (loaded.has(id)) return;
		loaded.add(id);
		const box = card.querySelector("[data-photos]");
		try {
			const r = await defectsApi.photos({ defect: id });
			if (r.photos.length) thumbs(box, r.photos.slice(0, 24), cat);
			else box.outerHTML = `<p class="damage-dialog__empty">${esc(t("Фото ще немає — їх додають при прийомі"))}</p>`;
		} catch {
			loaded.delete(id);
		}
	}
	function render() {
		const q = (dlg.querySelector("[data-ref-search]")?.value || "").trim().toLowerCase();
		const match = (d) => !q || [
			d.name,
			d.look,
			d.limit
		].some((f) => Object.values(f || {}).some((v) => String(v).toLowerCase().includes(q)));
		if (one) {
			list.innerHTML = `<div class="defect-list">${defectCardHtml(one, cat, { open: true })}</div>`;
			return photos(list.querySelector(".defect-card"));
		}
		list.innerHTML = cat.groups.filter((g) => group === "all" || g.id === group).map((g) => {
			const items = cat.defects.filter((d) => d.group === g.id && match(d));
			return items.length ? `<h3 class="damage-dialog__section">${esc(txt(g.name))} · ${items.length}</h3>
				<p class="damage-dialog__empty" data-no-i18n>${esc(txt(g.hint))}</p>
				<div class="defect-list">${items.map((d) => defectCardHtml(d, cat)).join("")}</div>` : "";
		}).join("") || `<p class="damage-dialog__empty">${esc(t("Нічого не знайдено"))}</p>`;
	}
	dlg.addEventListener("segmented:change", (e) => {
		if (e.detail.name !== "ref-group") return;
		group = e.detail.value;
		render();
	});
	dlg.querySelector("[data-ref-search]")?.addEventListener("input", render);
	bindCards(list, photos);
	render();
	dlg.showModal();
}
//#endregion
export { thumbs as a, openReference as i, openDamage as n, txt as o, openDefectPicker as r, loadCatalog as t };
