import { _ as filesApi, a as can, d as ApiError, l as ready } from "./ui.min.js";
import { t as toast } from "./toast.min.js";
//#region src/components/custom/sheet-view/_sheet-render.js
var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;"
})[c]);
function styleCss(st) {
	const css = [];
	if (st.b) css.push("font-weight:700");
	if (st.i) css.push("font-style:italic");
	if (st.u) css.push("text-decoration:underline");
	if (st.fs) css.push(`font-size:${Math.round(st.fs * 1.333)}px`);
	if (st.color) css.push(`color:#${st.color}`);
	if (st.bg) css.push(`background-color:#${st.bg}`);
	if (st.pattern) css.push("background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.18) 0 1px,transparent 1px 5px)");
	if (st.ha) css.push(`text-align:${{
		centerContinuous: "center",
		fill: "left",
		justify: "justify",
		distributed: "center"
	}[st.ha] || st.ha}`);
	if (st.va) css.push(`vertical-align:${{
		center: "middle",
		top: "top",
		bottom: "bottom"
	}[st.va] || "bottom"}`);
	if (st.wrap) css.push("white-space:pre-wrap");
	if (st.tb) css.push(`border-top:${st.tb}`);
	if (st.rb) css.push(`border-right:${st.rb}`);
	if (st.bb) css.push(`border-bottom:${st.bb}`);
	if (st.lb) css.push(`border-left:${st.lb}`);
	return css.join(";");
}
function renderSheet(sheet, styles, { editable = /* @__PURE__ */ new Map(), overrides = {} } = {}) {
	const css = styles.map(styleCss);
	const table = document.createElement("table");
	table.className = "sheet";
	const width = sheet.cols.reduce((a, b) => a + b, 0);
	table.style.width = `${width}px`;
	table.innerHTML = `<colgroup>${sheet.cols.map((w) => `<col style="width:${w}px">`).join("")}</colgroup><tbody>${sheet.rows.map((row) => {
		const cells = row.cells.map((cell, i) => {
			if (!sheet.cols[cell.c - (sheet.c0 || 1)]) return "";
			const field = editable.get(cell.addr);
			const override = field && overrides[field.key];
			const value = override ? override.value : cell.v ?? "";
			const attrs = [
				cell.cs ? `colspan="${cell.cs}"` : "",
				cell.rs ? `rowspan="${cell.rs}"` : "",
				cell.s !== void 0 ? `style="${css[cell.s]}"` : "",
				`data-addr="${cell.addr}"`
			];
			const cls = ["sheet__cell"];
			if (field) {
				cls.push("sheet__cell--editable");
				if (override) cls.push("sheet__cell--edited");
				attrs.push(`data-field="${esc(field.key)}"`, "tabindex=\"0\"", `title="${esc(field.label)} · click to edit"`);
			}
			const st = cell.s !== void 0 ? styles[cell.s] : {};
			const next = row.cells[i + 1];
			if (value !== "" && !st.wrap && (!st.ha || st.ha === "left") && next && (next.v ?? "") === "") cls.push("sheet__cell--spill");
			return `<td class="${cls.join(" ")}" ${attrs.join(" ")}>${value === "" ? "" : `<span>${esc(value)}</span>`}</td>`;
		});
		return `<tr style="height:${row.h}px">${cells.join("")}</tr>`;
	}).join("")}</tbody>`;
	return table;
}
//#endregion
//#region src/components/pages/file/file.js
var fmtSize = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
var fmtWhen = (iso) => new Date(iso).toLocaleString("en-GB", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit"
}).replace(",", "").replaceAll("/", ".");
function init() {
	const root = document.querySelector("[data-fls-file]");
	if (!root) return;
	const $ = (sel) => root.querySelector(sel);
	const $$ = (sel) => [...root.querySelectorAll(sel)];
	const params = new URLSearchParams(location.search);
	const path = params.get("path") || "";
	const stage = $("[data-stage]");
	const paper = $("[data-paper]");
	let view = null;
	let sheetIndex = Math.max(0, Number(params.get("sheet")) || 0);
	let zoom = "fit";
	let table = null;
	const canEdit = () => can("reports.download", "plans.upload", "ripening.generate");
	async function load() {
		if (!path) return showError("No file selected", "Open a file from Reports.");
		try {
			view = await filesApi.view(path);
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			return showError(err.status === 404 ? "File not found" : "Could not open the file", err.message);
		}
		const f = view.file;
		document.title = `${f.name} · Yellow WMS`;
		$("[data-title]").textContent = f.name;
		$("[data-title]").title = f.name;
		renderMeta();
		const dl = $("[data-download]");
		dl.href = filesApi.downloadUrl(path);
		dl.setAttribute("download", f.name);
		dl.removeAttribute("aria-disabled");
		$("[data-print]").disabled = false;
		$("[data-toolbar]").hidden = false;
		const tabs = $("[data-sheets]");
		tabs.hidden = view.sheets.length < 2;
		tabs.innerHTML = view.sheets.map((s, i) => `<button type="button" class="segmented__option ${i === sheetIndex ? "segmented__option--active" : ""}" role="tab" aria-pressed="${i === sheetIndex}" data-value="${i}"></button>`).join("");
		tabs.querySelectorAll("button").forEach((b, i) => b.textContent = view.sheets[i].name);
		if (sheetIndex >= view.sheets.length) sheetIndex = 0;
		renderFields();
		draw();
	}
	function renderMeta() {
		const f = view.file;
		const n = Object.keys(view.overrides).length;
		$("[data-meta]").textContent = `${fmtSize(f.size)} · generated ${fmtWhen(f.modifiedAt)}${view.editable.length ? ` · ${n} of ${view.editable.length} manual fields filled` : ""}`;
		$("[data-fields-count]").textContent = n;
		$("[data-fields-toggle]").hidden = view.editable.length === 0;
	}
	function showError(title, text) {
		$("[data-title]").textContent = title;
		$("[data-error-title]").textContent = title;
		$("[data-error-text]").textContent = text || "";
		$("[data-error]").hidden = false;
		paper.hidden = true;
	}
	function draw() {
		const sheet = view.sheets[sheetIndex];
		const editable = new Map(view.editable.filter((f) => (f.sheet ?? 0) === sheetIndex).map((f) => [f.addr, f]));
		table = renderSheet(sheet, view.styles, {
			editable,
			overrides: view.overrides
		});
		paper.replaceChildren(table);
		applyZoom();
		runSearch();
	}
	function applyZoom() {
		if (!table) return;
		const w = table.offsetWidth;
		const h = table.offsetHeight;
		const available = stage.clientWidth - 40;
		const scale = zoom === "fit" ? Math.min(1, available / w) : 1;
		table.style.transform = scale === 1 ? "" : `scale(${scale})`;
		paper.style.width = `${Math.ceil(w * scale)}px`;
		paper.style.height = `${Math.ceil(h * scale)}px`;
	}
	new ResizeObserver(() => zoom === "fit" && applyZoom()).observe(stage);
	root.addEventListener("segmented:change", (e) => {
		if (e.detail.name === "sheet") {
			sheetIndex = Number(e.detail.value);
			closeEditor();
			draw();
		}
		if (e.detail.name === "zoom") {
			zoom = e.detail.value;
			applyZoom();
		}
	});
	let hits = [];
	let hit = -1;
	function runSearch() {
		const q = $("[data-search]").value.trim().toLowerCase();
		$$(".sheet .is-hit, .sheet .is-hit-current").forEach((td) => td.classList.remove("is-hit", "is-hit-current"));
		hits = q && table ? [...table.querySelectorAll("td")].filter((td) => td.textContent.toLowerCase().includes(q)) : [];
		hits.forEach((td) => td.classList.add("is-hit"));
		hit = hits.length ? 0 : -1;
		$("[data-hits]").textContent = q ? hits.length ? `1 / ${hits.length}` : "none" : "";
		$("[data-hit-prev]").disabled = $("[data-hit-next]").disabled = hits.length < 2;
		focusHit();
	}
	function focusHit() {
		$$(".sheet .is-hit-current").forEach((td) => td.classList.remove("is-hit-current"));
		const td = hits[hit];
		if (!td) return;
		td.classList.add("is-hit-current");
		td.scrollIntoView({
			block: "center",
			inline: "center",
			behavior: "smooth"
		});
		$("[data-hits]").textContent = `${hit + 1} / ${hits.length}`;
	}
	$("[data-search]").addEventListener("input", runSearch);
	$("[data-search]").addEventListener("keydown", (e) => {
		if (e.key === "Enter" && hits.length) {
			hit = (hit + (e.shiftKey ? -1 : 1) + hits.length) % hits.length;
			focusHit();
		}
	});
	$("[data-hit-next]").addEventListener("click", () => {
		hit = (hit + 1) % hits.length;
		focusHit();
	});
	$("[data-hit-prev]").addEventListener("click", () => {
		hit = (hit - 1 + hits.length) % hits.length;
		focusHit();
	});
	const panel = $("[data-fields]");
	function renderFields() {
		const list = $("[data-field-list]");
		if (!view.editable.length) {
			list.innerHTML = "<li class=\"file-view__fields-empty\">This file has no manual fields.</li>";
			return;
		}
		list.replaceChildren(...view.editable.map((f) => {
			const o = view.overrides[f.key];
			const li = document.createElement("li");
			li.className = "file-view__field";
			li.dataset.key = f.key;
			li.innerHTML = `<span class="file-view__field-head"><b></b><code></code></span><span class="file-view__field-value"></span>${o ? "<span class=\"file-view__field-by\"></span>" : ""}`;
			li.querySelector("b").textContent = f.label;
			li.querySelector("code").textContent = `${view.sheets[f.sheet ?? 0]?.name ?? ""}!${f.addr}`;
			const value = li.querySelector(".file-view__field-value");
			value.textContent = o ? o.value || "(empty)" : "as generated";
			value.classList.toggle("is-empty", !o);
			if (o) li.querySelector(".file-view__field-by").textContent = `${o.by} · ${fmtWhen(o.at)}`;
			return li;
		}));
	}
	function togglePanel(open = panel.hidden) {
		panel.hidden = !open;
		$$("[data-fields-toggle]").forEach((b) => b.setAttribute("aria-expanded", String(open)));
		requestAnimationFrame(applyZoom);
	}
	$$("[data-fields-toggle]").forEach((b) => b.addEventListener("click", () => togglePanel()));
	$("[data-field-list]").addEventListener("click", (e) => {
		const li = e.target.closest(".file-view__field");
		if (!li) return;
		const field = view.editable.find((f) => f.key === li.dataset.key);
		if ((field.sheet ?? 0) !== sheetIndex) $(`[data-sheets] [data-value="${field.sheet}"]`)?.click();
		const td = table.querySelector(`[data-addr="${field.addr}"]`);
		td?.scrollIntoView({
			block: "center",
			inline: "center",
			behavior: "smooth"
		});
		setTimeout(() => td && openEditor(field, td), 250);
	});
	const editor = $("[data-editor]");
	const input = () => editor.elements.namedItem("value");
	let editing = null;
	function openEditor(field, td) {
		if (!canEdit()) return toast("error", "Read only", "Your role can view this file but not change it.");
		editing = field;
		const current = view.overrides[field.key]?.value ?? td.textContent.trim();
		$("[data-editor-label]").textContent = `${field.label} · ${field.addr}`;
		$("[data-editor-hint]").textContent = field.hint || (field.options ? "Pick one, or type your own" : "Kept when the file is rebuilt");
		const slot = $("[data-editor-input]");
		if (field.multiline) slot.innerHTML = "<textarea class=\"field__input\" name=\"value\" maxlength=\"500\"></textarea>";
		else {
			slot.innerHTML = `<input class="field__input" name="value" maxlength="500" autocomplete="off"${field.options ? " list=\"field-options\"" : ""}>${field.options ? "<datalist id=\"field-options\"></datalist>" : ""}`;
			if (field.options) slot.querySelector("datalist").replaceChildren(...field.options.map((o) => new Option(o)));
		}
		input().value = current;
		$("[data-editor-reset]").hidden = !view.overrides[field.key];
		const r = td.getBoundingClientRect();
		editor.hidden = false;
		const w = editor.offsetWidth;
		const h = editor.offsetHeight;
		editor.style.left = `${Math.min(innerWidth - w - 12, Math.max(12, r.left))}px`;
		editor.style.top = `${r.bottom + h + 12 < innerHeight ? r.bottom + 6 : Math.max(12, r.top - h - 6)}px`;
		$$(".file-view__field").forEach((li) => li.classList.toggle("is-active", li.dataset.key === field.key));
		input().focus();
		input().select?.();
	}
	function closeEditor() {
		editor.hidden = true;
		editing = null;
		$$(".file-view__field.is-active").forEach((li) => li.classList.remove("is-active"));
	}
	async function saveField(fn, message) {
		const field = editing;
		try {
			const res = await fn();
			view.overrides = res.overrides;
			closeEditor();
			renderMeta();
			renderFields();
			draw();
			toast("success", message, field.label);
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			toast("error", "Not saved", err.message);
		}
	}
	editor.addEventListener("submit", (e) => {
		e.preventDefault();
		const value = input().value.trim();
		saveField(() => filesApi.saveField(path, editing.key, value), "Saved · kept on rebuild");
	});
	$("[data-editor-reset]").addEventListener("click", () => saveField(() => filesApi.resetField(path, editing.key), "Back to the generated value"));
	$("[data-editor-cancel]").addEventListener("click", closeEditor);
	document.addEventListener("keydown", (e) => e.key === "Escape" && !editor.hidden && closeEditor());
	document.addEventListener("pointerdown", (e) => {
		if (!editor.hidden && !editor.contains(e.target) && !e.target.closest(".sheet__cell--editable, .file-view__field")) closeEditor();
	});
	paper.addEventListener("click", (e) => {
		const td = e.target.closest(".sheet__cell--editable");
		if (td) openEditor(view.editable.find((f) => f.key === td.dataset.field), td);
	});
	paper.addEventListener("keydown", (e) => {
		const td = e.target.closest(".sheet__cell--editable");
		if (td && (e.key === "Enter" || e.key === " ")) {
			e.preventDefault();
			openEditor(view.editable.find((f) => f.key === td.dataset.field), td);
		}
	});
	let printOpts = null;
	const printerSel = $("[data-printer]");
	filesApi.printers().then((o) => {
		printOpts = o;
		if (!o?.available || o.printers.length < 2) return;
		printerSel.innerHTML = o.printers.map((p) => `<option value="${p.replace(/"/g, "&quot;")}">${p.replace(/</g, "&lt;")}</option>`).join("");
		if (o.defaultPrinter) printerSel.value = o.defaultPrinter;
		printerSel.hidden = false;
	}).catch(() => {});
	$("[data-print]").addEventListener("click", async (e) => {
		if (!printOpts?.available) return window.print();
		const btn = e.currentTarget;
		btn.disabled = true;
		btn.classList.add("is-loading");
		try {
			const r = await filesApi.print(path, printerSel.hidden ? "" : printerSel.value);
			toast("success", "Sent to the printer", r.printer || "");
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			toast("error", "Not printed", err.message);
		} finally {
			btn.disabled = false;
			btn.classList.remove("is-loading");
		}
	});
	$("[data-download]").addEventListener("click", (e) => {
		if (e.currentTarget.getAttribute("aria-disabled") === "true") e.preventDefault();
	});
	ready.then((user) => user && load());
}
init();
//#endregion
