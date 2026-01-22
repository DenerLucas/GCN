// ===================== GCAN — VERSÃO FINAL LOCAL =====================

(function () {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fmtDate(iso) {
  try {
    if (!iso) return "Data a definir";
    const date = new Date(iso.replace(' ', 'T'));
    return date.toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "Data inválida"; }
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

// ===== Storage Keys =====
const STORAGE_KEY = 'gcan_games_v3';
const AUTH_KEY = 'gcan_auth_v1';
const USER_KEY = 'gcan_public_user';
const PLAYER_DATA_KEY = 'gcan_player_data';

const safeStorage = (() => {
  try {
    localStorage.setItem("__t__", "1");
    localStorage.removeItem("__t__");
    return localStorage;
  } catch {
    const m = new Map();
    return { getItem: (k) => m.get(k) || null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
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

// ===== State & DB (Provisório no LocalStorage) =====
const MockDB = {
  games: [],
  users: [
    { id: 'admin-1', role: 'admin', name: 'Admin Global', username: 'admin', password: 'airsoft2025', field: 'GCAN', crest: '', location: '' }
  ]
};

function loadDB() {
  const s = safeStorage.getItem(STORAGE_KEY);
  return s ? JSON.parse(s) : (saveDB(MockDB), MockDB);
}
function saveDB(db) { safeStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

const state = { games: [], users: [], filter: "all", search: "", auth: getAuth() };

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
    </div>`;
  overlay.hidden = false;
  $("#btnClose").onclick = closeModal;
  if (onMount) onMount();
}
function closeModal() { $("#overlay").hidden = true; }

// ===== Renderização com Gestão e UX =====
function cardHTML(g) {
  const st = calcStatus(g);
  const canJoin = st === "aberto" && !isJoined(g);
  const owner = state.users.find(u => u.id === g.ownerId);
  const crestImg = owner && owner.crest ? owner.crest : "";
  const crest = crestImg ? `<img src="${crestImg}" alt="Campo">` : `<span>${(g.field || "?")[0]}</span>`;
  
  const rem = remaining(g);
  const isCritical = st === "aberto" && rem > 0 && rem < 5;
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');

  const shareMsg = encodeURIComponent(`🎯 Inscrições: ${g.title}\n📅 Data: ${fmtDate(g.date)}\n📍 Campo: ${g.field}\nLink: ${window.location.href}`);
  const waUrl = `https://wa.me/?text=${shareMsg}`;

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
      <div class="muted" style="${isCritical ? 'color:#b64b4b; font-weight:700;' : ''}">
        ${g.attendees.length}/${g.total_slots} inscritos • ${rem} vagas ${isCritical ? '(ÚLTIMAS!)' : ''}
      </div>
      
      <div class="btn-row">
        <button class="btn ok" data-action="join" ${canJoin ? "" : "disabled"}>✅ Entrar</button>
        <button class="btn" data-action="list">📄 Lista</button>
        ${owner && owner.location ? `<button class="btn" data-action="maps" data-loc="${owner.location}">📍</button>` : ""}
        <a href="${waUrl}" target="_blank" class="btn" style="text-decoration:none;">📱</a>
      </div>

      ${isOwner ? `
      <div class="btn-row admin-controls" style="margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
        <button class="btn" data-action="edit">✏️</button>
        <button class="btn" data-action="pin">${g.pinned ? '📍' : '📌'}</button>
        <button class="btn" data-action="export">📥</button>
        <button class="btn danger" data-action="delete">🗑️</button>
      </div>` : ""}
    </div>
  </article>`;
}

function render() {
  const grid = $("#grid");
  if (!grid) return;
  let list = [...state.games];

  if (state.filter === "mine" && state.auth) {
    list = list.filter(g => g.ownerId === state.auth.id);
  } else if (state.filter !== "all") {
    list = list.filter(g => {
      if (state.filter === "open") return calcStatus(g) === "aberto";
      if (state.filter === "pinned") return !!g.pinned;
      return true;
    });
  }

  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => (g.title + g.field).toLowerCase().includes(t));
  }
  
  list.sort((a, b) => (!!b.pinned - !!a.pinned) || new Date(a.date) - new Date(b.date));
  grid.innerHTML = list.length ? list.map(cardHTML).join("") : "<p class='muted' style='grid-column:1/-1; text-align:center;'>Nenhum jogo encontrado.</p>";
}

// ===== Funções de Sessão =====
function syncTopbar() {
  const info = $("#sessionInfo");
  if (!info) return;

  if (!state.auth) {
    info.innerHTML = "";
    $$("#btnCreate, #btnUsers, #btnLogs").forEach(b => b && (b.hidden = true));
    if ($("#filterMine")) $("#filterMine").remove();
  } else {
    info.innerHTML = `
      ${state.auth.username} (${state.auth.field}) 
      <button class="btn ghost" id="btnLogout" style="padding:2px 8px; margin-left:8px; font-size:11px;">🚪 Sair</button>
    `;
    $("#btnLogout").onclick = logout;

    const isAdmin = state.auth.role === 'admin';
    $("#btnCreate").hidden = false;
    if($("#btnUsers")) $("#btnUsers").hidden = !isAdmin;
    
    if (!$("#filterMine")) {
      const chipMine = document.createElement("button");
      chipMine.id = "filterMine";
      chipMine.className = "chip";
      chipMine.dataset.filter = "mine";
      chipMine.textContent = "👤 Meus Jogos";
      $("#filters")?.appendChild(chipMine);
    }
  }
}

function logout() {
  clearAuth();
  state.auth = null;
  syncTopbar();
  render();
  TOASTS.show("Sessão encerrada.");
}

// ===== Modais de Gestão =====
function openGameModal(game = null) {
  const isEdit = !!game;
  openModal({
    title: isEdit ? "Editar Jogo" : "Criar Jogo",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Título</label><input id="gTitle" type="text" value="${isEdit ? game.title : ''}" /></div>
        <div class="field"><label>Vagas</label><input id="gSlots" type="number" value="${isEdit ? game.total_slots : '30'}" /></div>
        <div class="field"><label>Data</label><input id="gDate" type="datetime-local" value="${isEdit ? game.date : ''}" /></div>
        <div class="field"><label>Descrição</label><textarea id="gDesc" style="width:100%; min-height:60px; background:#0b0e0c; color:#fff; border:1px solid #2a322c; border-radius:8px; padding:8px;">${isEdit ? game.description : ''}</textarea></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="gSave">Confirmar</button>`,
    onMount: () => {
      $("#gSave").onclick = () => {
        if (!$("#gTitle").value || !$("#gDate").value) return TOASTS.show("Preencha Título e Data", "error");
        if (isEdit) {
          game.title = $("#gTitle").value; game.total_slots = Number($("#gSlots").value);
          game.date = $("#gDate").value; game.description = $("#gDesc").value;
        } else {
          state.games.push({
            id: uid(), ownerId: state.auth.id, title: $("#gTitle").value, field: state.auth.field,
            date: $("#gDate").value, description: $("#gDesc").value, total_slots: Number($("#gSlots").value),
            status: "open", attendees: [], pinned: false
          });
        }
        saveDB({ games: state.games, users: state.users });
        render(); closeModal();
      };
    }
  });
}

// ===== Eventos Globais =====
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  
  if (btn.id === "btnAdmin") return openAdminModal();
  if (btn.id === "btnCreate") return openGameModal();
  if (btn.id === "btnUsers") return openModeratorsModal();

  if (btn.classList.contains("chip")) {
    $$(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render(); return;
  }

  const card = btn.closest(".card");
  if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const action = btn.dataset.action;

  if (action === "join") openJoinModal(g);
  if (action === "list") openListModal(g);
  if (action === "maps") window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(btn.dataset.loc)}`, '_blank');
  if (action === "edit") openGameModal(g);
  if (action === "pin") { g.pinned = !g.pinned; saveDB({ games: state.games, users: state.users }); render(); }
  if (action === "delete" && confirm("Apagar jogo?")) { state.games = state.games.filter(x => x.id !== g.id); saveDB({ games: state.games, users: state.users }); render(); }
  if (action === "leave") { g.attendees = g.attendees.filter(a => a.user_id !== PUBLIC_USER_ID); saveDB({ games: state.games, users: state.users }); render(); }
});

// ===== Funções de Suporte (Moderadores, CSV, Inscrição) =====
function openModeratorsModal() {
  const mods = state.users.filter(u => u.role === 'moderator');
  const listHTML = mods.map(m => `
    <div style="padding:10px; border-bottom:1px solid #2a322c">
      <strong>${m.username}</strong> (${m.field}) <button class="btn danger" onclick="deleteUser('${m.id}')" style="float:right">X</button>
    </div>`).join("");

  openModal({
    title: "Gestão de Moderadores",
    contentHTML: `
      <div class="form">
        <div class="field"><label>User</label><input id="mU" type="text" /></div>
        <div class="field"><label>Pass</label><input id="mP" type="text" /></div>
        <div class="field"><label>Campo</label><input id="mF" type="text" /></div>
        <div class="field"><label>Localização</label><input id="mL" type="text" /></div>
        <div class="field"><label>URL Logo</label><input id="mC" type="text" /></div>
        <button class="btn ok" id="mS">Criar</button><hr style="margin:15px 0; border-top:1px solid #2a322c">${listHTML}
      </div>`,
    onMount: () => { $("#mS").onclick = () => {
      state.users.push({ id: uid(), role: 'moderator', username: $("#mU").value, password: $("#mP").value, field: $("#mF").value, crest: $("#mC").value, location: $("#mL").value });
      saveDB({ games: state.games, users: state.users }); closeModal();
    };}
  });
}

function openJoinModal(game) {
  const saved = JSON.parse(safeStorage.getItem(PLAYER_DATA_KEY) || '{}');
  openModal({
    title: "Inscrição",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Nickname</label><input id="jN" type="text" value="${saved.nickname || ''}" /></div>
        <div class="field"><label>Equipa</label><input id="jT" type="text" value="${saved.team || ''}" /></div>
        <div class="field"><label>APD</label><input id="jA" type="text" value="${saved.apd || ''}" /></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="jC">Confirmar</button>`,
    onMount: () => { $("#jC").onclick = () => {
      const pData = { nickname: $("#jN").value, team: $("#jT").value, apd: $("#jA").value };
      safeStorage.setItem(PLAYER_DATA_KEY, JSON.stringify(pData));
      game.attendees.push({ user_id: PUBLIC_USER_ID, ...pData });
      saveDB({ games: state.games, users: state.users });
      render(); closeModal();
    }; }
  });
}

function openListModal(game) {
  const isOwner = state.auth && (state.auth.id === game.ownerId || state.auth.role === 'admin');
  const header = isOwner ? `<tr><th>Nick</th><th>Equipa</th><th>APD</th></tr>` : `<tr><th>Nickname</th></tr>`;
  const rows = game.attendees.map(a => isOwner 
    ? `<tr><td>${escapeHtml(a.nickname)}</td><td>${escapeHtml(a.team)}</td><td>${escapeHtml(a.apd)}</td></tr>`
    : `<tr><td>${escapeHtml(a.nickname)}</td></tr>`).join("");
  openModal({ title: "Inscritos", contentHTML: `<table class="table" style="width:100%"><thead>${header}</thead><tbody>${rows || '<tr><td>Vazio</td></tr>'}</tbody></table>` });
}

function openAdminModal() {
  openModal({
    title: "Login",
    contentHTML: `<div class="form"><div class="field"><label>User</label><input id="admU" type="text" /></div><div class="field"><label>Pass</label><input id="admP" type="password" /></div></div>`,
    footerHTML: `<button class="btn ok" id="admL">Entrar</button>`,
    onMount: () => { $("#admL").onclick = () => {
      const u = state.users.find(x => x.username === $("#admU").value && x.password === $("#admP").value);
      if (u) { state.auth = u; setAuth(u); syncTopbar(); closeModal(); render(); } else TOASTS.show("Erro", "error");
    };}
  });
}

function init() {
  const db = loadDB();
  state.games = db.games; state.users = db.users;
  syncTopbar(); render();
}
window.deleteUser = (id) => { state.users = state.users.filter(u => u.id !== id); saveDB({ games: state.games, users: state.users }); render(); closeModal(); };
init();