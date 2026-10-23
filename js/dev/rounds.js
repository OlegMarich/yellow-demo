import { E as roundsApi, c as idleLogout, i as translate, l as ready, m as chambersApi, n as locale } from "./ui.min.js";
import { t as toast } from "./toast.min.js";
/* empty css           */
//#region src/components/pages/rounds/rounds.js
var SUFFIX = {
	"": 0,
	"*": 1,
	"+": 2
};
var stepIndex = (v) => {
	const m = /^([1-7])([*+]?)$/.exec(String(v ?? "").trim());
	if (!m || m[1] === "7" && m[2]) return null;
	return Number(m[1]) * 3 + SUFFIX[m[2]];
};
var stepLabel = (i) => `${Math.floor(i / 3)}${[
	"",
	"*",
	"+"
][i % 3]}`;
var STEPS = Array.from({ length: 19 }, (_, i) => stepLabel(3 + i));
function parseColor(input) {
	const raw = String(input ?? "").replace(/\s+/g, "").replace(/[,\\-]/g, "/");
	if (!raw) return {
		ok: true,
		empty: true
	};
	const parts = raw.split("/");
	if (parts.length > 2) return { ok: false };
	const a = stepIndex(parts[0]);
	const b = stepIndex(parts[1] ?? parts[0]);
	if (a === null || b === null || a > b) return { ok: false };
	return {
		ok: true,
		from: a,
		to: b,
		text: a === b ? stepLabel(a) : `${stepLabel(a)}/${stepLabel(b)}`
	};
}
var chipColor = (i) => {
	const t = (i - 3) / 18;
	return `hsl(${(t < .67 ? 120 - t / .67 * 70 : 50 - (t - .67) / .33 * 22).toFixed(0)} 78% ${t < .67 ? 42 + t * 15 : 52 - (t - .67) * 30}%)`;
};
var ddmm = (iso) => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "";
var gasText = (iso) => {
	if (!iso) return "без дня газування";
	const [y, m, d] = iso.split("-").map(Number);
	return `газування ${new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: "short" })} ${ddmm(iso)}`;
};
var KIND_UA = {
	morning: "ранок",
	evening: "вечір"
};
function init() {
	const root = document.querySelector("[data-fls-rounds]");
	if (!root) return;
	const $ = (s, scope = root) => scope.querySelector(s);
	const list = $("[data-list]");
	const tpl = $("#round-card");
	const title = document.querySelector("[data-topbar-title]");
	if (title) title.textContent = "Обхід";
	document.querySelector("[data-back]")?.setAttribute("hidden", "");
	document.querySelector("[data-sync-pill]")?.setAttribute("hidden", "");
	const state = {
		kind: (/* @__PURE__ */ new Date()).getHours() >= 14 ? "evening" : "morning",
		all: false,
		chambers: [],
		day: null
	};
	const kindEl = $("[data-kind]");
	function renderKind() {
		kindEl.querySelectorAll("[data-value]").forEach((b) => {
			const on = b.dataset.value === state.kind;
			b.classList.toggle("segmented__option--active", on);
			b.setAttribute("aria-checked", String(on));
		});
	}
	kindEl.addEventListener("click", (e) => {
		const b = e.target.closest("[data-value]");
		if (!b) return;
		state.kind = b.dataset.value;
		renderKind();
		renderList();
	});
	$("[data-all]").addEventListener("change", (e) => {
		state.all = e.target.checked;
		renderList();
	});
	function bindSide(sideEl, initial) {
		const steps = $("[data-steps]", sideEl);
		const text = $("[data-text]", sideEl);
		let sel = parseColor(initial);
		steps.innerHTML = STEPS.map((s, k) => `<button type="button" class="round-step" data-i="${k + 3}" style="--step:${chipColor(k + 3)}">${s}</button>`).join("");
		const paint = () => {
			steps.querySelectorAll("[data-i]").forEach((b) => {
				const i = Number(b.dataset.i);
				b.classList.toggle("is-on", sel.ok && !sel.empty && i >= sel.from && i <= sel.to);
				b.classList.toggle("is-end", sel.ok && !sel.empty && (i === sel.from || i === sel.to));
			});
			text.classList.toggle("is-bad", !sel.ok);
		};
		steps.addEventListener("click", (e) => {
			const b = e.target.closest("[data-i]");
			if (!b) return;
			const i = Number(b.dataset.i);
			if (sel.ok && !sel.empty && sel.from === sel.to && i !== sel.from) sel = parseColor(`${stepLabel(Math.min(i, sel.from))}/${stepLabel(Math.max(i, sel.from))}`);
			else sel = parseColor(stepLabel(i));
			text.value = sel.text;
			paint();
		});
		text.addEventListener("input", () => {
			sel = parseColor(text.value);
			paint();
		});
		text.value = sel.ok && !sel.empty ? sel.text : "";
		paint();
		return { get: () => sel };
	}
	function lastText(c) {
		const r = c.round;
		if (!r) return "Ще не було обходу";
		const parts = [
			r.ls && `LS ${r.ls}`,
			r.rs && `RS ${r.rs}`,
			r.temp !== null && r.temp !== void 0 && `${r.temp} °C`
		].filter(Boolean);
		return `Останній: ${ddmm(r.date)} ${translate(KIND_UA[r.kind] || "")} · ${parts.join(" · ")}`;
	}
	function renderList() {
		const today = state.day?.[state.kind]?.chambers || {};
		const chambers = state.chambers.filter((c) => state.all || c.mod !== "empty");
		const done = chambers.filter((c) => today[c.n]).length;
		$("[data-summary]").textContent = chambers.length ? `Записано ${done} з ${chambers.length}` : "Немає камер з товаром";
		list.replaceChildren(...chambers.map((c) => {
			const card = tpl.content.firstElementChild.cloneNode(true);
			const now = today[c.n] || {};
			$("[data-slot=\"num\"]", card).textContent = c.n;
			$("[data-slot=\"supplier\"]", card).textContent = c.supplier || (c.mod === "empty" ? "порожня" : "");
			$("[data-slot=\"gas\"]", card).textContent = c.mod === "empty" ? "" : gasText(c.gasIso);
			$("[data-slot=\"done\"]", card).hidden = !today[c.n];
			$("[data-slot=\"last\"]", card).textContent = lastText(c);
			const ls = bindSide($("[data-side=\"ls\"]", card), now.ls || "");
			const rs = bindSide($("[data-side=\"rs\"]", card), now.rs || "");
			const temp = $("[data-temp]", card);
			temp.value = now.temp ?? "";
			$("[data-save]", card).addEventListener("click", async (e) => {
				const L = ls.get();
				const R = rs.get();
				if (!L.ok || !R.ok) return toast("error", "Невірний колір", "Кроки: 1, 1*, 1+, 2 … 7; діапазон «від/до», напр. 3+/4");
				if (L.empty && R.empty && temp.value === "") return toast("error", "Нічого зберігати", "Вкажи колір LS / RS або температуру");
				e.currentTarget.disabled = true;
				try {
					const r = await roundsApi.save({
						chamberNum: c.n,
						kind: state.kind,
						ls: L.empty ? "" : L.text,
						rs: R.empty ? "" : R.text,
						temp: temp.value
					});
					state.day[state.kind] ??= { chambers: {} };
					state.day[state.kind].chambers[c.n] = r.reading;
					c.round = {
						...r.reading,
						date: r.date,
						kind: r.kind
					};
					toast("success", `Камера ${c.n} збережена`);
					renderList();
				} catch (err) {
					toast("error", `Камера ${c.n}: не збережено`, err.body?.errors?.join("; ") || err.message || "");
					e.currentTarget.disabled = false;
				}
			});
			return card;
		}));
	}
	async function load() {
		try {
			const [view, day] = await Promise.all([chambersApi.view(), roundsApi.day()]);
			state.chambers = [...view.left, ...view.right].filter((c) => c.mod !== "citro").sort((a, b) => a.n - b.n);
			state.day = day;
			if (day.kind) state.kind = day.kind;
		} catch (err) {
			toast("error", "Немає зв’язку з сервером", err.message || "");
		}
		renderKind();
		renderList();
	}
	ready.then((user) => {
		if (!user) return;
		idleLogout(15);
		load();
	});
	renderKind();
}
init();
//#endregion
