//#region src/components/custom/dropzone/dropzone.js
var kb = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
document.querySelectorAll("[data-fls-dropzone]").forEach((zone) => {
	const input = zone.querySelector("[data-dropzone-input]");
	const title = zone.querySelector("[data-dropzone-title]");
	const hint = zone.querySelector("[data-dropzone-hint]");
	const initial = {
		title: title.innerHTML,
		hint: hint.textContent
	};
	const pattern = zone.dataset.pattern ? new RegExp(zone.dataset.pattern, "i") : null;
	function take(file) {
		if (!file) return;
		const ok = !pattern || pattern.test(file.name);
		zone.file = ok ? file : null;
		zone.classList.toggle("is-ready", ok);
		zone.classList.toggle("is-error", !ok);
		title.textContent = file.name;
		hint.textContent = ok ? `${kb(file.size)} · ready` : `Wrong file. Expected ${zone.dataset.expected}`;
		if (ok) zone.dispatchEvent(new CustomEvent("dropzone:file", {
			bubbles: true,
			detail: { file }
		}));
	}
	zone.reset = () => {
		zone.file = null;
		input.value = "";
		zone.classList.remove("is-ready", "is-error");
		title.innerHTML = initial.title;
		hint.textContent = initial.hint;
	};
	input.addEventListener("change", () => take(input.files[0]));
	zone.addEventListener("dragover", (e) => {
		e.preventDefault();
		zone.classList.add("is-over");
	});
	zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
	zone.addEventListener("drop", (e) => {
		e.preventDefault();
		zone.classList.remove("is-over");
		take(e.dataTransfer.files[0]);
	});
});
//#endregion
