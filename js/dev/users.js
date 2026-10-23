import { d as ApiError, g as devicesApi, j as usersApi, l as ready, n as locale, o as currentUser, p as backupApi, r as t } from "./ui.min.js";
/* empty css               */
import { n as onDrawerClose, r as openDrawer, t as closeDrawer } from "./_drawer.min.js";
import { t as icon } from "./icon.min.js";
import "./app-shell.min.js";
//#region src/components/pages/users/devices-tab.js
function initDevicesTab({ root, toast, failToast }) {
	const $ = (sel, scope = root) => scope.querySelector(sel);
	const fmt = (iso) => iso ? new Date(iso).toLocaleString(locale(), {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	}) : "—";
	const kb = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
	let loaded = false;
	let codeTimer = 0;
	const cell = (text, cls = "") => {
		const td = document.createElement("td");
		if (cls) td.className = cls;
		td.textContent = text;
		return td;
	};
	const button = (label, data, kind = "ghost") => {
		const b = document.createElement("button");
		b.type = "button";
		b.className = `btn btn--${kind}`;
		b.dataset[data] = "";
		b.textContent = label;
		return b;
	};
	function renderDevices(devices) {
		const rows = devices.map((d) => {
			const tr = document.createElement("tr");
			tr.className = "data-table__row";
			tr.dataset.id = d.id;
			const name = document.createElement("th");
			name.scope = "row";
			name.innerHTML = "<b></b>";
			name.firstChild.textContent = d.name;
			const added = cell(`${fmt(d.createdAt)} · ${d.via === "code" ? "code" : "warehouse Wi-Fi"}`, "users__muted");
			const seen = cell(`${fmt(d.lastSeenAt)}${d.lastIp ? ` · ${d.lastIp}` : ""}`, "users__muted");
			const actions = document.createElement("td");
			actions.className = "users__actions";
			actions.append(button("Remove", "revokeDevice", "secondary"));
			tr.append(name, added, seen, actions);
			return tr;
		});
		if (!rows.length) rows.push(Object.assign(document.createElement("tr"), { innerHTML: "<td colspan=\"4\" class=\"users__loading\">No trusted devices yet.</td>" }));
		$("[data-device-rows]").replaceChildren(...rows);
		$("[data-count=\"devices\"]").textContent = devices.length;
	}
	function renderSessions(sessions) {
		const me = currentUser()?.id;
		const rows = sessions.map((s) => {
			const tr = document.createElement("tr");
			tr.className = "data-table__row";
			tr.dataset.id = s.id;
			const who = document.createElement("th");
			who.scope = "row";
			who.innerHTML = "<b></b>";
			who.firstChild.textContent = s.userName;
			const where = `${s.remote ? "Outside" : "Warehouse network"}${s.ip ? ` · ${s.ip.replace(/^::ffff:/, "")}` : ""}`;
			const actions = document.createElement("td");
			actions.className = "users__actions";
			actions.append(button("Sign out", "endSession", "secondary"));
			tr.append(who, cell(fmt(s.createdAt), "users__muted"), cell(where, "users__muted"), cell(fmt(s.expiresAt), "users__muted"), actions);
			if (s.userId === me) who.insertAdjacentHTML("beforeend", " <small class=\"users__you\">you</small>");
			return tr;
		});
		if (!rows.length) rows.push(Object.assign(document.createElement("tr"), { innerHTML: "<td colspan=\"5\" class=\"users__loading\">Nobody is signed in.</td>" }));
		$("[data-session-rows]").replaceChildren(...rows);
	}
	function renderBackup(st) {
		const line = st.last ? `Last: ${fmt(st.last.createdAt)} · ${kb(st.last.size)} · ${st.count} kept (${st.keepDays} days) in the backups folder` : "No backups yet.";
		$("[data-backup-status]").textContent = st.lastError ? `${line} · last error: ${st.lastError}` : line;
	}
	async function load() {
		try {
			const [{ devices, sessions, remoteMode }, backup] = await Promise.all([devicesApi.list(), backupApi.status()]);
			renderDevices(devices);
			renderSessions(sessions);
			renderBackup(backup);
			$("[data-remote-mode]").textContent = remoteMode === "device" ? "From outside: trusted device + PIN. On the warehouse network: as before." : "From outside: PIN only (REMOTE_ACCESS=login). Trusted devices are not required.";
			loaded = true;
		} catch (err) {
			if (err instanceof ApiError) failToast(err);
			else throw err;
		}
	}
	root.addEventListener("click", async (e) => {
		const codeBtn = e.target.closest("[data-pair-code]");
		if (codeBtn) {
			codeBtn.disabled = true;
			try {
				const { code, expiresAt } = await devicesApi.createCode();
				const box = $("[data-code-box]");
				box.hidden = false;
				$("[data-code-value]").textContent = code;
				clearInterval(codeTimer);
				const tick = () => {
					const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1e3));
					$("[data-code-left]").textContent = s ? t(`Valid for ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`) : t("Expired — make a new one");
					if (!s) clearInterval(codeTimer);
				};
				tick();
				codeTimer = setInterval(tick, 1e3);
			} catch (err) {
				if (err instanceof ApiError) failToast(err);
				else throw err;
			} finally {
				codeBtn.disabled = false;
			}
			return;
		}
		const row = e.target.closest("tr[data-id]");
		const revoke = e.target.closest("[data-revoke-device]");
		const end = e.target.closest("[data-end-session]");
		if (row && (revoke || end)) {
			const btn = revoke || end;
			btn.disabled = true;
			try {
				if (revoke) await devicesApi.revoke(row.dataset.id);
				else await devicesApi.endSession(row.dataset.id);
				toast(revoke ? "Device removed" : "Session ended", revoke ? "It needs a new code or the warehouse Wi-Fi to come back." : "");
				await load();
			} catch (err) {
				btn.disabled = false;
				if (err instanceof ApiError) failToast(err);
				else throw err;
			}
			return;
		}
		const backupBtn = e.target.closest("[data-backup-now]");
		if (backupBtn) {
			backupBtn.disabled = true;
			try {
				const { backup, status } = await backupApi.run();
				renderBackup(status);
				toast("Backup made", `${backup.file} · ${kb(backup.size)}`);
			} catch (err) {
				if (err instanceof ApiError) failToast(err);
				else throw err;
			} finally {
				backupBtn.disabled = false;
			}
		}
	});
	return {
		show: () => loaded ? null : load(),
		reload: load
	};
}
//#endregion
//#region src/components/pages/users/users.js
var ADMIN_PERM = "users.manage";
var TOAST_MS = 3600;
function init() {
	const root = document.querySelector("[data-fls-users]");
	const drawer = document.querySelector("[data-user-drawer]");
	if (!root || !drawer) return;
	const $ = (sel, scope = root) => scope.querySelector(sel);
	const $$ = (sel, scope = root) => [...scope.querySelectorAll(sel)];
	const params = new URLSearchParams(location.search);
	const state = {
		users: [],
		roles: [],
		groups: []
	};
	const roleBy = (key) => state.roles.find((r) => r.key === key);
	function toast(title, text = "", type = "success") {
		const node = $(type === "error" ? "#users-toast-error" : "#users-toast").content.firstElementChild.cloneNode(true);
		$(".toast__title", node).textContent = title;
		$(".toast__text", node).textContent = text;
		$("[data-toasts]").append(node);
		setTimeout(() => node.remove(), TOAST_MS);
	}
	const failToast = (err) => toast(err.status === 0 ? "No connection to the server" : "Not saved", err.message, "error");
	const devicesTab = initDevicesTab({
		root,
		toast,
		failToast
	});
	const fmtDate = new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
	function lastSeen(iso) {
		if (!iso) return "Never";
		const d = new Date(iso);
		const today = /* @__PURE__ */ new Date();
		const yesterday = /* @__PURE__ */ new Date(Date.now() - 864e5);
		const time = d.toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit"
		});
		if (d.toDateString() === today.toDateString()) return `Today ${time}`;
		if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
		return fmtDate.format(d).replace(",", "").replace("/", ".");
	}
	function minutesLeft(until) {
		const s = Math.max(0, Math.round((until - Date.now()) / 1e3));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
	}
	async function load() {
		try {
			const [users, { roles, groups }] = await Promise.all([usersApi.list(), usersApi.roles()]);
			Object.assign(state, {
				users,
				roles,
				groups
			});
			$("[data-load-error]").hidden = true;
			renderUsers();
			renderMatrix();
			renderRoleOptions();
			$("[data-add-user]").disabled = false;
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			const box = $("[data-load-error]");
			box.hidden = false;
			$(".banner__body", box).textContent = err.status === 0 ? "No connection to the server. Check the network and reload." : `Could not load users (${err.message}).`;
			$("[data-user-rows]").replaceChildren();
		}
	}
	function renderUsers() {
		const tpl = $("#user-row");
		const rows = state.users.map((u) => {
			const row = tpl.content.firstElementChild.cloneNode(true);
			const status = u.disabled ? "disabled" : u.locked ? "locked" : "active";
			row.dataset.id = u.id;
			row.classList.add(`users__row--${status}`);
			const avatar = $(".avatar", row);
			avatar.textContent = u.initials;
			avatar.classList.add(`avatar--${u.role}`);
			$("[data-cell=\"name\"]", row).textContent = u.name;
			const tag = $("[data-cell=\"role\"]", row);
			tag.textContent = u.roleLabel;
			tag.classList.add(`role-tag--${u.role}`);
			$("[data-cell=\"pin\"]", row).textContent = `${u.pinLength} digits`;
			$("[data-cell=\"last\"]", row).textContent = lastSeen(u.lastLoginAt);
			const badge = document.createElement("span");
			badge.className = {
				active: "badge badge--match badge--dot",
				locked: "badge badge--diff badge--dot",
				disabled: "badge"
			}[status];
			badge.textContent = {
				active: "Active",
				locked: `Locked · ${minutesLeft(u.lockedUntil)}`,
				disabled: "Disabled"
			}[status];
			$("[data-cell=\"status\"]", row).append(badge);
			$("[data-unlock]", row).hidden = status !== "locked";
			if (u.id === currentUser()?.id) $("[data-cell=\"name\"]", row).insertAdjacentHTML("beforeend", " <small class=\"users__you\">you</small>");
			return row;
		});
		$("[data-user-rows]").replaceChildren(...rows);
		$("[data-user-rows]").removeAttribute("aria-busy");
		$("[data-count=\"users\"]").textContent = state.users.length;
	}
	root.addEventListener("click", async (e) => {
		if (e.target.closest("[data-add-user]")) return openForm();
		const row = e.target.closest(".users__row");
		if (!row) return;
		const user = state.users.find((u) => u.id === row.dataset.id);
		if (e.target.closest("[data-edit-user]")) return openForm(user);
		const unlockBtn = e.target.closest("[data-unlock]");
		if (unlockBtn) {
			unlockBtn.disabled = true;
			try {
				await usersApi.unlock(user.id);
				toast(`${user.name} unlocked`);
				await reloadUsers();
			} catch (err) {
				unlockBtn.disabled = false;
				failToast(err);
			}
		}
	});
	async function reloadUsers() {
		state.users = await usersApi.list();
		renderUsers();
	}
	const form = $("[data-user-form]", drawer);
	const slot = (name) => $(`[data-slot="${name}"]`, drawer);
	const resetBtn = $("[data-reset-pin]", drawer);
	const toggleBtn = $("[data-toggle-disabled]", drawer);
	let editing = null;
	let pinShown = false;
	function renderRoleOptions() {
		const current = form.role.value;
		form.role.replaceChildren(...state.roles.map((r) => new Option(r.label, r.key)));
		if (current) form.role.value = current;
		$("[data-count=\"roles\"]").textContent = state.roles.length;
	}
	const pinLengthFor = (role) => roleBy(role)?.perms.includes(ADMIN_PERM) ? 6 : 4;
	const masked = (n) => Array(n).fill("•").join(" ");
	function showPin(pin) {
		pinShown = Boolean(pin);
		slot("pin").textContent = pin || masked(editing?.pinLength ?? pinLengthFor(form.role.value));
		$("[data-pin-reveal]", drawer).classList.toggle("is-shown", pinShown);
		slot("pin-note").hidden = !pinShown;
		slot("pin-hint").hidden = pinShown || Boolean(editing);
	}
	function lockForm(locked) {
		form.name.disabled = locked;
		form.role.disabled = locked;
		slot("submit").hidden = locked;
		slot("cancel").textContent = locked ? "Done" : "Cancel";
		$("[data-edit-only]", drawer).hidden = locked || !editing;
	}
	function openForm(user = null) {
		editing = user;
		form.reset();
		$("[data-name-field]", drawer).classList.remove("field--error");
		slot("title").textContent = user ? "Edit user" : "Add user";
		slot("submit").textContent = user ? "Save changes" : "Create user";
		resetBtn.hidden = !user;
		resetBtn.textContent = "Reset PIN";
		resetBtn.dataset.confirm = "";
		lockForm(false);
		if (user) {
			form.name.value = user.name;
			form.role.value = user.role;
			toggleBtn.textContent = user.disabled ? "Enable user" : "Disable user";
			toggleBtn.className = user.disabled ? "btn btn--secondary" : "btn btn--danger";
		} else form.role.value = state.roles.find((r) => !r.perms.includes(ADMIN_PERM))?.key ?? state.roles[0]?.key;
		showPin("");
		openDrawer(drawer);
		form.name.focus();
	}
	form.role.addEventListener("change", () => !pinShown && showPin(""));
	onDrawerClose((d) => {
		if (d !== drawer) return;
		showPin("");
		editing = null;
	});
	async function busy(button, fn) {
		button.disabled = true;
		button.classList.add("is-loading");
		try {
			return await fn();
		} finally {
			button.disabled = false;
			button.classList.remove("is-loading");
		}
	}
	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const name = form.name.value.trim();
		if (!name) {
			$("[data-name-field]", drawer).classList.add("field--error");
			return form.name.focus();
		}
		const role = form.role.value;
		try {
			await busy(slot("submit"), async () => {
				if (editing) {
					const res = await usersApi.update(editing.id, {
						name,
						role
					});
					await reloadUsers();
					if (res.pin) {
						editing = res.user;
						showPin(res.pin);
						lockForm(true);
						toast(`${name} has a new ${res.pin.length}-digit PIN`, "Their role needs a longer PIN.");
					} else {
						closeDrawer(drawer);
						toast(`Saved · ${name}`);
					}
				} else {
					const res = await usersApi.create({
						name,
						role
					});
					await reloadUsers();
					editing = res.user;
					showPin(res.pin);
					lockForm(true);
					toast(`${name} added`, "Give them the PIN shown in the panel.");
				}
			});
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			if (err.code === "bad_name") $("[data-name-field]", drawer).classList.add("field--error");
			failToast(err);
		}
	});
	resetBtn.addEventListener("click", async () => {
		if (!editing) return;
		if (!resetBtn.dataset.confirm) {
			resetBtn.dataset.confirm = "1";
			resetBtn.textContent = "Click again to reset";
			setTimeout(() => {
				resetBtn.dataset.confirm = "";
				if (!pinShown) resetBtn.textContent = "Reset PIN";
			}, 3e3);
			return;
		}
		try {
			const res = await busy(resetBtn, () => usersApi.resetPin(editing.id));
			showPin(res.pin);
			lockForm(true);
			resetBtn.hidden = true;
			await reloadUsers();
			toast(`New PIN for ${res.user.name}`, "The old PIN no longer works.");
		} catch (err) {
			if (err instanceof ApiError) failToast(err);
			else throw err;
		}
	});
	toggleBtn.addEventListener("click", async () => {
		if (!editing) return;
		const disable = !editing.disabled;
		try {
			await busy(toggleBtn, () => usersApi.update(editing.id, { disabled: disable }));
			toast(disable ? `${editing.name} can no longer sign in` : `${editing.name} can sign in again`);
			closeDrawer(drawer);
			await reloadUsers();
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			toast(err.code === "last_admin" ? "This is the last administrator" : "Not saved", err.message, "error");
		}
	});
	function showTab(name) {
		$$("[data-tab]").forEach((panel) => panel.hidden = panel.dataset.tab !== name);
		$$(".users__tabs .segmented__option").forEach((o) => {
			const on = o.dataset.value === name;
			o.classList.toggle("segmented__option--active", on);
			o.setAttribute("aria-pressed", String(on));
		});
		if (name === "devices") devicesTab.show();
	}
	root.addEventListener("segmented:change", (e) => e.detail.name === "users-tab" && showTab(e.detail.value));
	const matrix = $("[data-matrix]");
	const saveBtn = $("[data-matrix-save]");
	const status = $("[data-matrix-status]");
	const defaultStatus = status.textContent;
	let draft = [];
	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;"
	})[c]);
	const checkbox = (role, perm, label) => `
		<label class="check">
			<span class="visually-hidden">${esc(role.label)}: ${esc(label)}</span>
			<input type="checkbox" class="check__input" data-role="${role.key}" data-perm="${perm}"${role.perms.includes(perm) ? " checked" : ""}${role.locked ? " disabled" : ""}>
			<span class="check__box" aria-hidden="true">${icon("check")}</span>
		</label>`;
	function renderMatrix() {
		draft = structuredClone(state.roles);
		const head = draft.map((r) => r.isNew ? `<th scope="col" class="users__role-col"><input class="field__input users__role-name" data-role-name="${r.key}" value="${esc(r.label)}" aria-label="Role name"><small>new</small></th>` : `<th scope="col" class="users__role-col"><span class="role-tag role-tag--${r.key}">${esc(r.label)}</span><small>${r.users} ${r.users === 1 ? "user" : "users"}</small></th>`).join("");
		$("[data-matrix-head]", matrix).innerHTML = `<th scope="col">Permission</th>${head}`;
		$$("tbody", matrix).forEach((b) => b.remove());
		matrix.insertAdjacentHTML("beforeend", state.groups.map((g) => `
			<tbody>
				<tr class="users__group"><th scope="rowgroup" colspan="${draft.length + 1}">${esc(g.label)}</th></tr>
				${g.perms.map((p) => `
					<tr class="data-table__row">
						<th scope="row" class="users__perm">${esc(p.label)} <code>${p.key}</code></th>
						${draft.map((r) => `<td class="users__check">${checkbox(r, p.key, p.label)}</td>`).join("")}
					</tr>`).join("")}
			</tbody>`).join(""));
		renderDirty();
	}
	const changedCount = () => $$(".check__input.is-changed", matrix).length + draft.filter((r) => r.isNew).length;
	function renderDirty() {
		const n = changedCount();
		status.textContent = n ? `${n} unsaved change${n === 1 ? "" : "s"}` : defaultStatus;
		status.classList.toggle("is-dirty", n > 0);
		saveBtn.disabled = n === 0;
		saveBtn.textContent = n ? "Save roles" : "Saved";
	}
	matrix.addEventListener("change", (e) => {
		const box = e.target.closest(".check__input");
		if (!box) return;
		box.classList.toggle("is-changed", box.checked !== box.defaultChecked);
		const role = draft.find((r) => r.key === box.dataset.role);
		role.perms = box.checked ? [...role.perms, box.dataset.perm] : role.perms.filter((p) => p !== box.dataset.perm);
		renderDirty();
	});
	matrix.addEventListener("input", (e) => {
		const input = e.target.closest("[data-role-name]");
		if (input) draft.find((r) => r.key === input.dataset.roleName).label = input.value;
	});
	$("[data-add-role]").addEventListener("click", () => {
		let n = state.roles.length + 1;
		while (roleBy(`role${n}`)) n++;
		state.roles.push({
			key: `role${n}`,
			label: "New role",
			perms: [],
			users: 0,
			isNew: true
		});
		const pending = draft;
		renderMatrix();
		pending.forEach((r) => {
			const d = draft.find((x) => x.key === r.key);
			if (d) d.perms = r.perms;
			$$(`.check__input[data-role="${r.key}"]`, matrix).forEach((box) => {
				box.checked = r.perms.includes(box.dataset.perm);
				box.classList.toggle("is-changed", box.checked !== box.defaultChecked);
			});
		});
		renderDirty();
		$(`[data-role-name="role${n}"]`, matrix).select();
		matrix.parentElement.scrollLeft = matrix.scrollWidth;
	});
	saveBtn.addEventListener("click", async () => {
		const payload = draft.map(({ key, label, perms }) => ({
			key,
			label: label.trim(),
			perms
		}));
		try {
			const res = await busy(saveBtn, () => usersApi.saveRoles(payload));
			state.roles = res.roles;
			renderMatrix();
			renderRoleOptions();
			await reloadUsers();
			toast("Roles saved", "People with changed roles sign in again to get them.");
		} catch (err) {
			if (err instanceof ApiError) failToast(err);
			else throw err;
		}
	});
	ready.then(async (user) => {
		if (!user) return;
		await load();
		if (["roles", "devices"].includes(params.get("tab"))) showTab(params.get("tab"));
		const d = params.get("drawer");
		if (d === "add") openForm();
		else if (d) {
			const u = state.users.find((x) => x.id === d);
			if (u) openForm(u);
		}
	});
}
init();
//#endregion
