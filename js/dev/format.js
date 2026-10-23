import { n as locale } from "./ui.min.js";
//#region src/components/services/format.js
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
var fmt = (n) => n === null || n === void 0 || n === "" ? "—" : String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
var signed = (n) => n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0";
var p2 = (n) => String(n).padStart(2, "0");
var isoToday = () => {
	const d = /* @__PURE__ */ new Date();
	return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
var fromIso = (iso) => {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
};
var longDate = (iso) => fromIso(iso).toLocaleDateString(locale(), {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric"
});
var dotDate = (iso) => iso.split("-").reverse().join(".");
var timeNow = () => (/* @__PURE__ */ new Date()).toLocaleTimeString(locale(), {
	hour: "2-digit",
	minute: "2-digit"
});
//#endregion
export { longDate as a, isoToday as i, esc as n, signed as o, fmt as r, timeNow as s, dotDate as t };
