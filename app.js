// ===================== GCAN — APP (FULL ADMIN VERSION) =====================

// ===== Utilidades base =====
(function () {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch { return iso; }
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// ===== Toasts =====
const TOASTS = {
  el: $(".toasts"),
  show(msg, type = "ok", ms = 2600) {
    if (!this.el) return alert(msg);
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.textContent = msg;
    this.el.appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
};

// ===== Storage =====
const STORAGE_KEY = 'gcan_games_v3';
const AUTH_KEY = 'gcan_auth_v1';
const USER_KEY = 'gcan_public_user';

const safeStorage = (() => {
  try {
    localStorage.setItem("__t__", "1");
    localStorage.removeItem("__t__");
    return localStorage;
  } catch {
    const m = new Map();
    return {
      getItem: (k) => m.get(k) || null,
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k)
    };
  }
})();

const PUBLIC_USER_ID = (() => {
  let id = safeStorage.getItem(USER_KEY);
  if (!id) { id = uid(); safeStorage.setItem(USER_KEY, id); }
  return id;
})();

function getAuth() {
  const raw = safeStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}
function setAuth(a) { safeStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function clearAuth() { safeStorage.removeItem(AUTH_KEY); }

// ===== DB Logic =====
const MockDB = {
  games: [
    {
      id: "g1",
      title: "ARCANJOS",
      description: "Skirmish dominical",
      field: "ARCANJOS",
      date: "2025-05-18T10:00:00",
      status: "open",
      pinned: true,
      total_slots: 45,
      attendees: [],
      location: { text: "Braga, Portugal" }
    }
  ],
  users: [
    { id: 'admin-1', role: 'admin', name: 'Admin', username: 'admin', password: 'airsoft2025' }
  ]
};

function loadDB() {
  const s = safeStorage.getItem(STORAGE_KEY);
  if (s) return JSON.parse(s);
  saveDB(MockDB);
  return MockDB;
}

function saveDB(db) { safeStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

// ===== State =====
const state = {
  games: [],
  users: [],
  filter: "all",
  search: "",
  auth: getAuth(),
};

// ===== Helpers =====
function remaining(g) { return g.total_slots - g.attendees.length; }
function calcStatus(g) {
  if (remaining(g) <= 0) return "lotado";
  return g.status === "closed" ? "fechado" : "aberto";
}
function isJoined(g) { return g.attendees.some((a) => a.user_id === PUBLIC_USER_ID); }

// ===== UI: Modais =====
function openModal({ title, contentHTML, footerHTML, onMount }) {
  const overlay = $("#overlay");
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="icon-btn" id="btnClose">✕</button>
      </div>
      <div class="modal-body">${contentHTML}</div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ""}
    </div>
  `;
  overlay.hidden = false;
  $("#btnClose").onclick = closeModal;
  if (onMount) onMount();
}

function closeModal() { $("#overlay").hidden = true; }

// ===== Render =====
function render() {
  const grid = $("#grid");
  if (!grid) return;

  let list = [...state.games];
  if (state.filter !== "all") {
    list = list.filter(g => {
      if (state.filter === "open") return calcStatus(g) === "aberto";
      if (state.filter === "lotado") return calcStatus(g) === "lotado";
      if (state.filter === "pinned") return !!g.pinned;
      return true;
    });
  }

  list.sort((a, b) => (!!b.pinned - !!a.pinned) || new Date(a.date) - new Date(b.date));
  grid.innerHTML = list.map(g => `
    <article class="card" data-id="${g.id}">
      <div class="hd" style="background-image:url('assets/img/camo-header.jpg')">
        <span class="badge ${calcStatus(g)}">${calcStatus(g)}</span>
        ${g.pinned ? `<span class="pin">📌</span>` : ""}
      </div>
      <div class="body">
        <strong>${escapeHtml(g.title)}</strong>
        <p class="muted">${fmtDate(g.date)} - ${g.field}</p>
        <p class="muted">${g.attendees.length}/${g.total_slots} inscritos</p>
        <div class="btn-row">
          <button class="btn ok" data-action="join" ${calcStatus(g) === 'aberto' && !isJoined(g) ? "" : "disabled"}>Entrar</button>
          <button class="btn" data-action="list">Lista</button>
          ${isJoined(g) ? `<button class="btn danger" data-action="leave">Sair</button>` : ""}
        </div>
      </div>
    </article>
  `).join("");
}

// ===== Admin Functions =====
function syncTopbar() {
  const info = $("#sessionInfo");
  if (!info) return;
  if (!state.auth) {
    info.textContent = "";
    $$("#btnCreate, #btnUsers, #btnLogs").forEach(b => b.hidden = true);
  } else {
    info.textContent = `${state.auth.username} (${state.auth.role})`;
    $$("#btnCreate, #btnUsers, #btnLogs").forEach(b => b.hidden = state.auth.role !== 'admin');
  }
}

function openCreateGameModal() {
  openModal({
    title: "Criar Novo Jogo",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Título</label><input id="cgTitle" type="text" /></div>
        <div class="field"><label>Campo</label><input id="cgField" type="text" /></div>
        <div class="field"><label>Data</label><input id="cgDate" type="datetime-local" /></div>
        <div class="field"><label>Vagas</label><input id="cgSlots" type="number" value="20" /></div>
      </div>
    `,
    footerHTML: `<button class="btn ok" id="cgSave">Criar</button>`,
    onMount: () => {
      $("#cgSave").onclick = () => {
        const newGame = {
          id: uid(),
          title: $("#cgTitle").value,
          field: $("#cgField").value,
          date: $("#cgDate").value,
          total_slots: Number($("#cgSlots").value),
          status: "open",
          attendees: []
        };
        state.games.push(newGame);
        saveDB({ games: state.games, users: state.users });
        render();
        closeModal();
        TOASTS.show("Jogo criado!");
      };
    }
  });
}

function openModeratorsModal() {
  const list = state.users.map(u => `<li>${u.username} (${u.role})</li>`).join("");
  openModal({
    title: "Gestão de Utilizadores",
    contentHTML: `<ul>${list}</ul><p class="muted">Funcionalidade de adição em breve.</p>`
  });
}

function openLogsModal() {
  openModal({
    title: "Logs do Sistema",
    contentHTML: `<pre class="pre">Sessão iniciada por ${state.auth.username}\nBase de dados carregada.</pre>`
  });
}

function openAdminModal() {
  openModal({
    title: "Login Admin",
    contentHTML: `
      <div class="form">
        <div class="field"><label>User</label><input id="admU" type="text" /></div>
        <div class="field"><label>Pass</label><input id="admP" type="password" /></div>
      </div>
    `,
    footerHTML: `<button class="btn ok" id="admLogin">Entrar</button>`,
    onMount: () => {
      $("#admLogin").onclick = () => {
        const u = $("#admU").value;
        const p = $("#admP").value;
        const found = state.users.find(x => x.username === u && x.password === p);
        if (found) {
          state.auth = found;
          setAuth(found);
          syncTopbar();
          closeModal();
          TOASTS.show("Sessão iniciada");
        } else { TOASTS.show("Credenciais inválidas", "error"); }
      };
    }
  });
}

function openJoinModal(game) {
  openModal({
    title: "Inscrição",
    contentHTML: `<div class="form"><div class="field"><label>Nickname</label><input id="jNick" type="text" /></div></div>`,
    footerHTML: `<button class="btn ok" id="jConfirm">Confirmar</button>`,
    onMount: () => {
      $("#jConfirm").onclick = () => {
        game.attendees.push({ user_id: PUBLIC_USER_ID, nickname: $("#jNick").value });
        saveDB({ games: state.games, users: state.users });
        render();
        closeModal();
        TOASTS.show("Inscrito!");
      };
    }
  });
}

// ===== Eventos =====
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.id === "btnAdmin") return openAdminModal();
  if (btn.id === "btnCreate") return openCreateGameModal();
  if (btn.id === "btnUsers") return openModeratorsModal();
  if (btn.id === "btnLogs") return openLogsModal();
  if (btn.id === "ctaGo") return $("#grid")?.scrollIntoView({ behavior: "smooth" });

  const card = btn.closest(".card");
  if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const action = btn.dataset.action;

  if (action === "join") openJoinModal(g);
  if (action === "list") {
    const list = g.attendees.map(a => a.nickname).join("\n");
    openModal({ title: "Inscritos", contentHTML: `<pre class="pre">${list || "Ninguém ainda"}</pre>` });
  }
  if (action === "leave") {
    g.attendees = g.attendees.filter(a => a.user_id !== PUBLIC_USER_ID);
    saveDB({ games: state.games, users: state.users });
    render();
    TOASTS.show("Inscrição removida");
  }
});

// ===== Init =====
function init() {
  const db = loadDB();
  state.games = db.games;
  state.users = db.users;
  syncTopbar();
  render();
}

init();