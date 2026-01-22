// ===================== GCAN — APP (RESTAURADO + ADMIN FIX) =====================

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

// ===== State & DB =====
const MockDB = {
  games: [
    {
      id: "g1",
      title: "ARCANJOS",
      description: "Skirmish dominical",
      field: "ARCANJOS",
      crest: null,
      date: "2025-05-18T10:00:00",
      status: "open",
      pinned: true,
      total_slots: 45,
      guests_only: false,
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
  return s ? JSON.parse(s) : (saveDB(MockDB), MockDB);
}
function saveDB(db) { safeStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

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
      <div class="modal-head"><h3>${title}</h3><button class="icon-btn" id="btnClose">✕</button></div>
      <div class="modal-body">${contentHTML}</div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ""}
    </div>
  `;
  overlay.hidden = false;
  $("#btnClose").onclick = closeModal;
  if (onMount) onMount();
}

function closeModal() { $("#overlay").hidden = true; }

// ===== Render (Visual Original Restaurado) =====
function cardHTML(g) {
  const st = calcStatus(g);
  const canJoin = st === "aberto" && !isJoined(g);
  const crest = g.crest ? `<img src="${g.crest}" alt="Equipa">` : `<span>${(g.field || "?")[0]}</span>`;

  return `
  <article class="card" data-id="${g.id}">
    <div class="hd" style="background-image:url('assets/img/camo-header.jpg')">
      <span class="badge ${st}">${st}</span>
      ${g.pinned ? `<span class="pin">📌</span>` : ""}
      <div class="crest-lg">${crest}</div>
    </div>
    <div class="body">
      <div class="row"><strong>${escapeHtml(g.title)}</strong><div class="spacer"></div><span class="muted">${fmtDate(g.date)}</span></div>
      <div class="muted">${escapeHtml(g.description || "")}</div>
      <div class="muted">${g.attendees.length}/${g.total_slots} inscritos • ${remaining(g)} vagas</div>
      <div class="btn-row">
        <button class="btn ok" data-action="join" ${canJoin ? "" : "disabled"}>✅ Entrar</button>
        <button class="btn" data-action="leave" ${isJoined(g) ? "" : "hidden"}>❌ Sair</button>
        <button class="btn" data-action="list">📄 Lista</button>
        <button class="btn" data-action="copy">🔗 Link</button>
      </div>
    </div>
  </article>`;
}

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
  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => (g.title + g.field).toLowerCase().includes(t));
  }
  list.sort((a, b) => (!!b.pinned - !!a.pinned) || new Date(a.date) - new Date(b.date));
  grid.innerHTML = list.map(cardHTML).join("");
}

// ===== Formulários Originais Restaurados =====
function openJoinModal(game) {
  openModal({
    title: "Entrar no Jogo",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Nickname</label><input id="jNick" type="text" /></div>
        <div class="field"><label>Equipa</label><input id="jTeam" type="text" /></div>
        <div class="chk"><input id="jGuest" type="checkbox" /><span>Sou convidado (sem APD)</span></div>
        <div class="field"><label>Número APD *</label><input id="jAPD" type="text" /></div>
        <div class="chk"><input id="jGDPR" type="checkbox" /><span>Concordo com o tratamento de dados *</span></div>
      </div>`,
    footerHTML: `<button class="btn" id="jCancel">Cancelar</button><button class="btn ok" id="jConfirm">Confirmar</button>`,
    onMount: () => {
      const guest = $("#jGuest"); const apd = $("#jAPD");
      $("#jCancel").onclick = closeModal;
      guest.onchange = () => { apd.disabled = guest.checked; if(guest.checked) apd.value = ""; };
      $("#jConfirm").onclick = () => {
        if (!$("#jGDPR").checked) return TOASTS.show("Aceite o GDPR", "error");
        if (!guest.checked && $("#jAPD").value.length < 3) return TOASTS.show("APD obrigatório", "error");
        game.attendees.push({ user_id: PUBLIC_USER_ID, nickname: $("#jNick").value, team: $("#jTeam").value, apd: $("#jAPD").value, guest: guest.checked });
        saveDB({ games: state.games, users: state.users });
        render(); closeModal(); TOASTS.show("Inscrição efetuada!");
      };
    }
  });
}

function openCreateGameModal() {
  openModal({
    title: "Criar Jogo",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Título *</label><input id="cgTitle" type="text" /></div>
        <div class="field"><label>Campo *</label><input id="cgField" type="text" /></div>
        <div class="field"><label>Data e hora *</label><input id="cgDate" type="datetime-local" /></div>
        <div class="field"><label>Vagas totais *</label><input id="cgSlots" type="number" value="20" /></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="cgSave">Criar</button>`,
    onMount: () => {
      const dt = $("#cgDate");
      const now = new Date(); now.setSeconds(0,0);
      dt.min = now.toISOString().slice(0,16); // Impede datas passadas
      
      $("#cgSave").onclick = () => {
        const selectedDate = new Date(dt.value);
        if (selectedDate < now) return TOASTS.show("Não pode criar jogos no passado.", "error");
        if (!$("#cgTitle").value || !$("#cgField").value || !dt.value) return TOASTS.show("Preencha os campos obrigatórios", "error");

        state.games.push({
          id: uid(), title: $("#cgTitle").value, field: $("#cgField").value,
          date: dt.value, total_slots: Number($("#cgSlots").value), status: "open", attendees: []
        });
        saveDB({ games: state.games, users: state.users });
        render(); closeModal(); TOASTS.show("Jogo criado!");
      };
    }
  });
}

function syncTopbar() {
  const info = $("#sessionInfo");
  if (!info) return;
  if (!state.auth) {
    info.textContent = "";
    $$("#btnCreate, #btnUsers, #btnLogs").forEach(b => b && (b.hidden = true));
  } else {
    info.textContent = `${state.auth.username} (${state.auth.role})`;
    const isAdmin = state.auth.role === 'admin';
    $$("#btnCreate, #btnUsers, #btnLogs").forEach(b => b && (b.hidden = !isAdmin));
  }
}

// ===== Eventos (Admin Fix Incluído) =====
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.id === "btnAdmin") return openAdminModal();
  if (btn.id === "btnCreate") return openCreateGameModal();
  if (btn.id === "btnUsers") return TOASTS.show("Gestão de moderadores em breve.");
  if (btn.id === "btnLogs") return TOASTS.show("Logs do sistema em breve.");
  if (btn.id === "ctaGo") return $("#grid")?.scrollIntoView({ behavior: "smooth" });

  const card = btn.closest(".card");
  if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const action = btn.dataset.action;
  if (action === "join") openJoinModal(g);
  if (action === "list") {
    const names = g.attendees.map((a, i) => `${i + 1}. ${a.nickname || "(sem nick)"}`).join("\n");
    openModal({ title: `Lista — ${g.title}`, contentHTML: `<pre class="pre">${names || "Sem inscritos."}</pre>` });
  }
  if (action === "leave") {
    g.attendees = g.attendees.filter(a => a.user_id !== PUBLIC_USER_ID);
    saveDB({ games: state.games, users: state.users });
    render(); TOASTS.show("Inscrição removida");
  }
});

function openAdminModal() {
  openModal({
    title: "Admin Login",
    contentHTML: `<div class="form"><div class="field"><label>User</label><input id="admU" type="text" /></div><div class="field"><label>Pass</label><input id="admP" type="password" /></div></div>`,
    footerHTML: `<button class="btn ok" id="admLogin">Entrar</button>`,
    onMount: () => {
      $("#admLogin").onclick = () => {
        const found = state.users.find(x => x.username === $("#admU").value && x.password === $("#admP").value);
        if (found) { state.auth = found; setAuth(found); syncTopbar(); closeModal(); TOASTS.show("Bem-vindo!"); }
        else { TOASTS.show("Credenciais erradas", "error"); }
      };
    }
  });
}

function init() {
  const db = loadDB();
  state.games = db.games; state.users = db.users;
  syncTopbar(); render();
}
init();