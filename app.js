// ===================== GCAN — VERSÃO ULTIMATE CLOUD + EVENTOS FIX =====================

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
    const cleanIso = iso.includes('T') ? iso : iso.replace(' ', 'T');
    const date = new Date(cleanIso);
    if (isNaN(date.getTime())) return "Data a definir";
    return date.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "Data a definir"; }
}

function escapeHtml(s) {
  return String(s || "").replaceAll("&", "&").replaceAll("<", "<").replaceAll(">", ">").replaceAll('"', '"').replaceAll("'", "'");
}

const TOASTS = {
  el: $(".toasts"),
  show(msg, type = "ok", ms = 2600) {
    if (!this.el) return;
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.textContent = msg;
    this.el.appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
};

const AUTH_KEY = 'gcan_auth_v1';
const PLAYER_DATA_KEY = 'gcan_player_data';
const safeStorage = (() => {
  try { localStorage.setItem("__t__", "1"); localStorage.removeItem("__t__"); return localStorage; }
  catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
})();

const state = { games: [], users: [], filter: "all", search: "", auth: JSON.parse(safeStorage.getItem(AUTH_KEY) || 'null') };

const MockDB = {
  games: [],
  users: [{ id: 'admin-1', role: 'admin', username: 'admin', password: 'airsoft2025', field: 'GCAN', crest: '', location: '' }]
};

function saveDB(data) { if (window.dbSet && window.dbRef && window.db) window.dbSet(window.dbRef(window.db, 'gcan_data'), data); }

// FIX: Garante que os botões do topo funcionem sempre
function bindGlobalEvents() {
  const btnAdmin = $("#btnAdmin");
  if (btnAdmin) btnAdmin.onclick = openAdminLogin;

  const btnCreate = $("#btnCreate");
  if (btnCreate) btnCreate.onclick = () => openGameModal();

  const btnUsers = $("#btnUsers");
  if (btnUsers) btnUsers.onclick = openModsModal;
  
  const searchInput = $("#search");
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.search = e.target.value;
      render();
    };
  }
}

function init() {
  if (!window.dbOnValue) { setTimeout(init, 500); return; }
  
  bindGlobalEvents(); // Liga os botões assim que carrega

  window.dbOnValue(window.dbRef(window.db, 'gcan_data'), (snapshot) => {
    const data = snapshot.val();
    if (data) { 
      state.games = data.games || []; 
      state.users = data.users || MockDB.users; 
      render(); 
    }
    else saveDB(MockDB);
    syncTopbar();
  });
}

function remaining(g) { return g.total_slots - (g.attendees ? g.attendees.length : 0); }
function calcStatus(g) { return remaining(g) <= 0 ? "lotado" : (g.status === "closed" ? "fechado" : "aberto"); }

function cardHTML(g) {
  const st = calcStatus(g);
  const owner = state.users.find(u => u.id === g.ownerId);
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  const crest = owner && owner.crest ? `<img src="${owner.crest}" alt="Logo">` : `<span>${(g.field || "?")[0]}</span>`;
  const shareMsg = encodeURIComponent(`🎯 Jogo: ${g.title}\n📅 ${fmtDate(g.date)}\nLink: ${window.location.href}`);

  return `
  <article class="card" data-id="${g.id}">
    <div class="hd"><span class="badge ${st}">${st}</span>${g.pinned ? `<span class="pin">📌</span>` : ""}<div class="crest-lg">${crest}</div></div>
    <div class="body">
      <div class="row"><strong>${escapeHtml(g.title)}</strong><div class="spacer"></div><span class="muted">${fmtDate(g.date)}</span></div>
      <div class="muted" style="margin: 10px 0;">${escapeHtml(g.description || "")}</div>
      <div class="muted">${(g.attendees || []).length}/${g.total_slots} inscritos</div>
      <div class="btn-row">
        <button class="btn ok" data-action="join" ${st === 'aberto' ? "" : "disabled"}>✅ Entrar</button>
        <button class="btn" data-action="list">📄 Lista</button>
        ${owner && owner.location ? `<button class="btn" data-action="maps" data-loc="${owner.location}">📍</button>` : ""}
        <a href="https://wa.me/?text=${shareMsg}" target="_blank" class="btn">📱</a>
      </div>
      ${isOwner ? `<div class="btn-row admin-controls" style="border-top:1px solid #2a322c; padding-top:10px; margin-top:10px;">
        <button class="btn" data-action="edit">✏️</button><button class="btn" data-action="pin">${g.pinned ? '📍' : '📌'}</button>
        <button class="btn" data-action="export">📥</button><button class="btn danger" data-action="delete">🗑️</button>
      </div>` : ""}
    </div>
  </article>`;
}

function render() {
  const grid = $("#grid"); if (!grid) return;
  let list = [...state.games];
  if (state.filter === "mine") list = list.filter(g => g.ownerId === state.auth?.id);
  else if (state.filter !== "all") {
    if (state.filter === "open") list = list.filter(g => calcStatus(g) === "aberto");
    if (state.filter === "pinned") list = list.filter(g => g.pinned);
  }
  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => (g.title + (g.field || "")).toLowerCase().includes(t));
  }
  
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔭</div>
      <h3>Nenhum jogo encontrado</h3>
      <p class="muted">Tenta mudar os filtros ou pesquisar por outro termo.</p>
      ${state.auth ? '<button class="btn ok" onclick="openGameModal()">Publicar Novo Jogo</button>' : ''}
    </div>`;
  } else {
    list.sort((a, b) => (!!b.pinned - !!a.pinned) || new Date(a.date.replace(' ', 'T')) - new Date(b.date.replace(' ', 'T')));
    grid.innerHTML = list.map(cardHTML).join("");
  }
}

function openModal({ title, contentHTML, footerHTML, onMount }) {
  const overlay = $("#overlay");
  overlay.innerHTML = `<div class="modal"><div class="modal-head"><h3>${title}</h3><button class="icon-btn" id="btnClose">✕</button></div>
    <div class="modal-body">${contentHTML}</div>${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ""}</div>`;
  overlay.hidden = false;
  $("#btnClose").onclick = () => overlay.hidden = true;
  if (onMount) onMount();
}

function openGameModal(game = null) {
  const isEdit = !!game;
  openModal({
    title: isEdit ? "Editar Jogo" : "Criar Jogo",
    contentHTML: `<div class="form">
      <div class="field"><label>Título</label><input id="gT" type="text" value="${isEdit ? game.title : ''}" /></div>
      <div class="field"><label>Vagas</label><input id="gS" type="number" value="${isEdit ? game.total_slots : '30'}" /></div>
      <div class="field"><label>Data</label><input id="gD" type="datetime-local" value="${isEdit ? game.date : ''}" /></div>
      <div class="field"><label>Descrição</label><textarea id="gDesc" style="min-height:80px; background:#0b0e0c; color:#fff; border:1px solid #2a322c; border-radius:8px; padding:8px;">${isEdit ? game.description : ''}</textarea></div>
    </div>`,
    footerHTML: `<button class="btn ok" id="gSave">Confirmar</button>`,
    onMount: () => {
      $("#gSave").onclick = () => {
        if (!$("#gT").value || !$("#gD").value) return TOASTS.show("Título e Data obrigatórios", "error");
        if (isEdit) { 
          game.title = $("#gT").value; 
          game.total_slots = Number($("#gS").value); 
          game.date = $("#gD").value; 
          game.description = $("#gDesc").value; 
        }
        else { 
          state.games.push({ id: uid(), ownerId: state.auth.id, field: state.auth.field, title: $("#gT").value, total_slots: Number($("#gS").value), date: $("#gD").value, description: $("#gDesc").value, attendees: [], pinned: false }); 
        }
        saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true;
      };
    }
  });
}

function syncTopbar() {
  const info = $("#sessionInfo"); if (!info) return;
  if (!state.auth) { 
    info.innerHTML = ""; 
    $$("#btnCreate, #btnUsers").forEach(b => b.hidden = true); 
  }
  else {
    info.innerHTML = `<span>${state.auth.username}</span> <button class="btn ghost" id="btnLogout" style="padding:2px 8px; font-size:11px; margin-left:8px;">Sair</button>`;
    $("#btnLogout").onclick = () => { safeStorage.removeItem(AUTH_KEY); location.reload(); };
    $("#btnCreate").hidden = false; 
    $("#btnUsers").hidden = state.auth.role !== 'admin';
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  
  // Filtros Chips (Event Delegation)
  if (btn.classList.contains("chip")) { 
    $$(".chip").forEach(c => c.classList.remove("active")); 
    btn.classList.add("active"); 
    state.filter = btn.dataset.filter; 
    render(); 
    return; 
  }
  
  const card = btn.closest(".card"); if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const act = btn.dataset.action;
  
  if (act === "join") openJoinModal(g);
  if (act === "list") openListModal(g);
  if (act === "maps") window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(btn.dataset.loc)}`, '_blank');
  if (act === "edit") openGameModal(g);
  if (act === "pin") { g.pinned = !g.pinned; saveDB({ games: state.games, users: state.users }); }
  if (act === "delete" && confirm("Apagar jogo?")) { state.games = state.games.filter(x => x.id !== g.id); saveDB({ games: state.games, users: state.users }); }
});

function openAdminLogin() {
  openModal({
    title: "Login Admin",
    contentHTML: `<div class="form"><div class="field"><label>Utilizador</label><input id="aU" /></div><div class="field"><label>Password</label><input id="aP" type="password" /></div></div>`,
    footerHTML: `<button class="btn ok" id="aL">Entrar</button>`,
    onMount: () => {
      $("#aL").onclick = () => {
        const u = state.users.find(x => x.username === $("#aU").value && x.password === $("#aP").value);
        if (u) { 
          state.auth = u; 
          safeStorage.setItem(AUTH_KEY, JSON.stringify(u)); 
          location.reload(); 
        } else TOASTS.show("Erro: Credenciais inválidas", "error");
      };
    }
  });
}

function openJoinModal(g) {
  openModal({
    title: "Inscrição",
    contentHTML: `<div class="form"><div class="field"><label>Nick</label><input id="jN" /></div><div class="field"><label>Equipa</label><input id="jT" /></div><div class="field"><label>APD</label><input id="jA" /></div></div>`,
    footerHTML: `<button class="btn ok" id="jC">Confirmar</button>`,
    onMount: () => {
      $("#jC").onclick = () => {
        if(!$("#jN").value) return TOASTS.show("Nick é obrigatório", "error");
        if (!g.attendees) g.attendees = [];
        g.attendees.push({ nickname: $("#jN").value, team: $("#jT").value, apd: $("#jA").value, user_id: uid() });
        saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true;
        TOASTS.show("Inscrição realizada!");
      };
    }
  });
}

function openListModal(g) {
  const rows = (g.attendees || []).map(a => `<tr><td>${escapeHtml(a.nickname)}</td><td>${escapeHtml(a.team)}</td></tr>`).join("");
  openModal({ 
    title: "Inscritos: " + g.title, 
    contentHTML: `<table class="table" style="width:100%"><thead><tr><th>Nick</th><th>Equipa</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Vazio</td></tr>'}</tbody></table>` 
  });
}

function openModsModal() {
  const list = state.users.filter(u => u.role === 'moderator').map(m => `
    <li style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #2a322c; padding-bottom:4px;">
      <span>${m.username} (${m.field})</span>
    </li>`).join("");
    
  openModal({
    title: "Gestão de Moderadores",
    contentHTML: `
      <div class="form">
        <div class="field"><label>User</label><input id="mU" /></div>
        <div class="field"><label>Pass</label><input id="mP" /></div>
        <div class="field"><label>Campo</label><input id="mF" /></div>
        <div class="field"><label>URL Logo (Brasão)</label><input id="mC" placeholder="https://link-da-imagem.png" /></div>
        
        <button class="btn ok" id="mS">Criar Moderador GCN</button>
        <hr style="margin:15px 0; border:0; border-top:1px solid #2a322c;">
        <ul style="padding:0; list-style:none;">${list || '<li>Sem moderadores.</li>'}</ul>
      </div>`,
    onMount: () => {
      $("#mS").onclick = () => {
        if(!$("#mU").value || !$("#mP").value) return TOASTS.show("User e Pass obrigatórios", "error");
        
        state.users.push({ 
          id: uid(), 
          role: 'moderator', 
          username: $("#mU").value, 
          password: $("#mP").value, 
          field: $("#mF").value, 
          location: '', 
          crest: $("#mC").value // Captura o URL da imagem
        });
        
        saveDB({ games: state.games, users: state.users }); 
        $("#overlay").hidden = true;
        TOASTS.show("Moderador GCN criado com sucesso!");
      };
    }
  });
}

init();