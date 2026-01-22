// ===================== GCAN — SISTEMA DE GESTÃO DE CAMPOS =====================

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
  return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
  games: [],
  users: [
    { id: 'admin-1', role: 'admin', name: 'Admin Global', username: 'admin', password: 'airsoft2025', field: 'GCAN', crest: '' }
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

// ===== Render (Com Brasão Automático do Moderador) =====
function cardHTML(g) {
  const st = calcStatus(g);
  const canJoin = st === "aberto" && !isJoined(g);
  
  // Encontra o dono do jogo para usar o brasão dele
  const owner = state.users.find(u => u.id === g.ownerId);
  const crestImg = owner && owner.crest ? owner.crest : "";
  const crest = crestImg ? `<img src="${crestImg}" alt="Campo">` : `<span>${(g.field || "?")[0]}</span>`;

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
      </div>
    </div>
  </article>`;
}

function render() {
  const grid = $("#grid");
  if (!grid) return;
  let list = [...state.games];
  
  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => (g.title + g.field).toLowerCase().includes(t));
  }
  
  list.sort((a, b) => (!!b.pinned - !!a.pinned) || new Date(a.date) - new Date(b.date));
  grid.innerHTML = list.map(cardHTML).join("");
}

// ===== Lógica de Moderadores (Apenas Admin) =====
function openModeratorsModal() {
  const mods = state.users.filter(u => u.role === 'moderator');
  const listHTML = mods.map(m => `
    <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid var(--border)">
      <span><strong>${m.username}</strong> (${m.field})</span>
      <button class="btn danger" onclick="deleteUser('${m.id}')" style="padding:2px 8px">Remover</button>
    </div>
  `).join("") || "<p class='muted'>Nenhum moderador criado.</p>";

  openModal({
    title: "Gestão de Moderadores",
    contentHTML: `
      <div class="form">
        <h4>Criar Novo Moderador</h4>
        <div class="field"><label>Username</label><input id="mUser" type="text" /></div>
        <div class="field"><label>Password</label><input id="mPass" type="text" /></div>
        <div class="field"><label>Campo (Ex: STG)</label><input id="mField" type="text" /></div>
        <div class="field"><label>URL do Brasão (Logo)</label><input id="mCrest" type="text" /></div>
        <button class="btn ok" id="mSave">Criar Moderador</button>
        <hr style="margin:20px 0; border:0; border-top:1px solid var(--border)">
        <h4>Lista de Moderadores</h4>
        ${listHTML}
      </div>`,
    onMount: () => {
      $("#mSave").onclick = () => {
        const newUser = {
          id: uid(),
          role: 'moderator',
          username: $("#mUser").value,
          password: $("#mPass").value,
          field: $("#mField").value,
          crest: $("#mCrest").value
        };
        state.users.push(newUser);
        saveDB({ games: state.games, users: state.users });
        TOASTS.show("Moderador criado!");
        closeModal();
      };
    }
  });
}

window.deleteUser = (id) => {
  state.users = state.users.filter(u => u.id !== id);
  saveDB({ games: state.games, users: state.users });
  closeModal();
  TOASTS.show("Utilizador removido.");
};

// ===== Criação de Jogo (Associa ao Moderador) =====
function openCreateGameModal() {
  openModal({
    title: "Criar Jogo - " + state.auth.field,
    contentHTML: `
      <div class="form">
        <div class="field"><label>Título do Jogo</label><input id="cgTitle" type="text" /></div>
        <div class="field"><label>Vagas</label><input id="cgSlots" type="number" value="30" /></div>
        <div class="field"><label>Data</label><input id="cgDate" type="datetime-local" /></div>
        <div class="field"><label>Descrição</label><input id="cgDesc" type="text" /></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="cgSave">Publicar Jogo</button>`,
    onMount: () => {
      const dt = $("#cgDate");
      const now = new Date();
      dt.min = now.toISOString().slice(0,16);

      $("#cgSave").onclick = () => {
        const newGame = {
          id: uid(),
          ownerId: state.auth.id, // Vínculo com o criador
          title: $("#cgTitle").value,
          field: state.auth.field, // Automático do perfil
          date: dt.value,
          description: $("#cgDesc").value,
          total_slots: Number($("#cgSlots").value),
          status: "open",
          attendees: []
        };
        state.games.push(newGame);
        saveDB({ games: state.games, users: state.users });
        render(); closeModal(); TOASTS.show("Jogo publicado!");
      };
    }
  });
}

// ===== Lista de Inscritos (Privacidade APD) =====
function openListModal(game) {
  const isOwner = state.auth && (state.auth.id === game.ownerId || state.auth.role === 'admin');
  
  const header = isOwner 
    ? `<tr><th>#</th><th>Nick</th><th>Equipa</th><th>APD</th></tr>`
    : `<tr><th>#</th><th>Nickname</th></tr>`;

  const rows = game.attendees.map((a, i) => isOwner 
    ? `<tr><td>${i+1}</td><td>${escapeHtml(a.nickname)}</td><td>${escapeHtml(a.team)}</td><td><code>${escapeHtml(a.apd)}</code></td></tr>`
    : `<tr><td>${i+1}</td><td>${escapeHtml(a.nickname)}</td></tr>`
  ).join("");

  openModal({
    title: "Lista - " + game.title,
    contentHTML: `
      <table style="width:100%; text-align:left; border-collapse:collapse;" class="table">
        <thead>${header}</thead>
        <tbody>${rows || '<tr><td colspan="4">Ninguém inscrito.</td></tr>'}</tbody>
      </table>`
  });
}

// ===== Resto da Lógica (Login / Eventos) =====
function syncTopbar() {
  const info = $("#sessionInfo");
  if (!info) return;
  if (!state.auth) {
    info.textContent = "";
    $$("#btnCreate, #btnUsers, #btnLogs").forEach(b => b && (b.hidden = true));
  } else {
    info.textContent = `${state.auth.username} (${state.auth.field})`;
    $("#btnCreate").hidden = false; // Moderador pode criar
    $("#btnUsers").hidden = state.auth.role !== 'admin'; // Só Admin gere mods
    $("#btnLogs").hidden = state.auth.role !== 'admin';
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.id === "btnAdmin") return openAdminModal();
  if (btn.id === "btnCreate") return openCreateGameModal();
  if (btn.id === "btnUsers") return openModeratorsModal();
  
  const card = btn.closest(".card");
  if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const action = btn.dataset.action;

  if (action === "join") openJoinModal(g);
  if (action === "list") openListModal(g);
  if (action === "leave") {
    g.attendees = g.attendees.filter(a => a.user_id !== PUBLIC_USER_ID);
    saveDB({ games: state.games, users: state.users });
    render();
  }
});

function openJoinModal(game) {
  openModal({
    title: "Inscrição",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Nickname</label><input id="jNick" type="text" /></div>
        <div class="field"><label>Equipa</label><input id="jTeam" type="text" /></div>
        <div class="field"><label>APD</label><input id="jAPD" type="text" /></div>
        <div class="chk"><input id="jGDPR" type="checkbox" /><span>Aceito os termos</span></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="jConfirm">Confirmar</button>`,
    onMount: () => {
      $("#jConfirm").onclick = () => {
        game.attendees.push({
          user_id: PUBLIC_USER_ID,
          nickname: $("#jNick").value,
          team: $("#jTeam").value,
          apd: $("#jAPD").value
        });
        saveDB({ games: state.games, users: state.users });
        render(); closeModal();
      };
    }
  });
}

function openAdminModal() {
  openModal({
    title: "Acesso Restrito",
    contentHTML: `<div class="form"><div class="field"><label>User</label><input id="admU" type="text" /></div><div class="field"><label>Pass</label><input id="admP" type="password" /></div></div>`,
    footerHTML: `<button class="btn ok" id="admLogin">Entrar</button>`,
    onMount: () => {
      $("#admLogin").onclick = () => {
        const found = state.users.find(x => x.username === $("#admU").value && x.password === $("#admP").value);
        if (found) { state.auth = found; setAuth(found); syncTopbar(); closeModal(); TOASTS.show("Sessão iniciada!"); render(); }
        else { TOASTS.show("Erro de login", "error"); }
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