// ===================== GCAN — VERSÃO UNIFICADA & SINCRONIZADA =====================

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
const safeStorage = (() => {
  try { localStorage.setItem("__t__", "1"); localStorage.removeItem("__t__"); return localStorage; }
  catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
})();

const state = { games: [], users: [], filter: "all", search: "", auth: JSON.parse(safeStorage.getItem(AUTH_KEY) || 'null') };

const MockDB = {
  games: [],
  users: [{ id: 'admin-1', role: 'admin', username: 'admin', password: 'airsoft2025', field: 'GCAN', crest: '', location: '' }]
};

// GRAVAÇÃO COM CALLBACK: Garante que o Firebase recebeu antes de atualizar o site
function saveDB(data) { 
  if (window.dbSet && window.dbRef && window.db) {
    window.dbSet(window.dbRef(window.db, 'gcan_data'), data)
      .then(() => {
        state.users = data.users;
        state.games = data.games;
        render();
        syncTopbar();
      })
      .catch(err => TOASTS.show("Erro Cloud: " + err.message, "error"));
  } 
}

function bindGlobalEvents() {
  const btnAdmin = $("#btnAdmin");
  if (btnAdmin) btnAdmin.onclick = openAdminLogin;

  const btnCreate = $("#btnCreate");
  if (btnCreate) btnCreate.onclick = () => openGameModal();

  const btnUsers = $("#btnUsers");
  if (btnUsers) btnUsers.onclick = () => {
    if (state.auth && state.auth.role === 'admin') openModsModal();
    else TOASTS.show("Acesso negado", "error");
  };
  
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
  bindGlobalEvents();
  
  // SINCRONIZAÇÃO EM TEMPO REAL: Resolve o problema do jogo não aparecer
  window.dbOnValue(window.dbRef(window.db, 'gcan_data'), (snapshot) => {
    const data = snapshot.val();
    if (data) { 
      state.users = data.users || MockDB.users; 
      state.games = data.games || []; 
      render(); 
      syncTopbar();
    } else {
      saveDB(MockDB);
    }
  });
}

function remaining(g) { return g.total_slots - (g.attendees ? g.attendees.length : 0); }
function calcStatus(g) { return remaining(g) <= 0 ? "lotado" : (g.status === "closed" ? "fechado" : "aberto"); }

function cardHTML(g) {
  const st = calcStatus(g);
  const owner = state.users.find(u => u.id === g.ownerId);
  // PERMISSÕES: Todos vêm, mas só o dono ou admin edita
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
        <a href="https://wa.me/?text=${shareMsg}" target="_blank" class="btn">📱</a>
      </div>
      ${isOwner ? `<div class="btn-row admin-controls" style="border-top:1px solid #2a322c; padding-top:10px; margin-top:10px;">
        <button class="btn" data-action="edit">✏️</button><button class="btn" data-action="pin">${g.pinned ? '📍' : '📌'}</button>
        <button class="btn danger" data-action="delete">🗑️</button>
      </div>` : ""}
    </div>
  </article>`;
}

function render() {
  const grid = $("#grid"); if (!grid) return;
  let list = [...state.games];
  
  // FILTRO GLOBAL: Por padrão mostra todos os jogos da nuvem
  if (state.filter === "mine") {
    list = list.filter(g => g.ownerId === state.auth?.id);
  } else if (state.filter !== "all") {
    if (state.filter === "open") list = list.filter(g => calcStatus(g) === "aberto");
    if (state.filter === "pinned") list = list.filter(g => g.pinned);
  }

  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => (escapeHtml(g.title) + escapeHtml(g.field)).toLowerCase().includes(t));
  }
  
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔭</div><h3>Nenhum jogo encontrado</h3></div>`;
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
          game.title = $("#gT").value; game.total_slots = Number($("#gS").value); game.date = $("#gD").value; game.description = $("#gDesc").value; 
        } else { 
          state.games.push({ 
            id: uid(), ownerId: state.auth.id, field: state.auth.field || "GCN", 
            title: $("#gT").value, total_slots: Number($("#gS").value), 
            date: $("#gD").value, description: $("#gDesc").value, attendees: [], pinned: false 
          }); 
        }
        saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true;
      };
    }
  });
}

function syncTopbar() {
  const info = $("#sessionInfo"); if (!info) return;
  const btnCreate = $("#btnCreate");
  const btnUsers = $("#btnUsers");

  if (!state.auth) {
    info.innerHTML = "";
    if (btnCreate) btnCreate.hidden = true;
    if (btnUsers) btnUsers.hidden = true;
  } else {
    info.innerHTML = `<span>${state.auth.username}</span> <button class="btn ghost" id="btnLogout" style="padding:2px 8px; font-size:11px; margin-left:8px;">Sair</button>`;
    $("#btnLogout").onclick = () => { safeStorage.removeItem(AUTH_KEY); location.reload(); };
    if (btnCreate) btnCreate.hidden = false; 
    if (btnUsers) btnUsers.hidden = (state.auth.role !== 'admin');
  }
}

// LOGIN UNIFICADO: Aceita qualquer utilizador da base de dados
function openAdminLogin() {
  openModal({
    title: "Acesso Seguro GCAN",
    contentHTML: `
      <div class="form">
        <div class="field"><label>E-mail</label><input id="aU" type="email" placeholder="exemplo@gcan.pt" /></div>
        <div class="field"><label>Password</label><input id="aP" type="password" /></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="aL">Entrar</button>`,
    onMount: () => {
      $("#aL").onclick = async () => {
        const email = $("#aU").value.trim();
        const pass = $("#aP").value.trim();

        try {
          // Utiliza a função real do Firebase que importamos no index.html
          const userCredential = await window.signIn(window.fbAuth, email, pass);
          const user = userCredential.user;

          // Procura os dados adicionais (role, campo) na base de dados usando o UID real
          const userData = state.users.find(u => u.id === user.uid) || { id: user.uid, role: 'moderator', username: email };
          
          state.auth = userData;
          safeStorage.setItem(AUTH_KEY, JSON.stringify(userData));
          
          TOASTS.show("Login bem-sucedido!");
          location.reload();
        } catch (error) {
          console.error(error);
          TOASTS.show("Erro: " + error.message, "error");
        }
      };
    }
  });
}

// GESTÃO DE MODERADORES COM ATUALIZAÇÃO DE LISTA
function openModsModal() {
  const renderList = () => state.users.filter(u => u.role === 'moderator').map(m => `
    <li style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #2a322c; padding:4px 0;">
      <span>${escapeHtml(m.username)} (${escapeHtml(m.field)})</span>
      <button onclick="deleteMod('${m.id}')" class="btn danger" style="padding:2px 5px; font-size:10px;">X</button>
    </li>`).join("");

  openModal({
    title: "Gestão de Moderadores",
    contentHTML: `
      <div class="form">
        <div class="field"><label>User</label><input id="mU" /></div>
        <div class="field"><label>Pass</label><input id="mP" /></div>
        <div class="field"><label>Campo</label><input id="mF" /></div>
        <div class="field"><label>URL Logo</label><input id="mC" /></div>
        <button class="btn ok" id="mS">Criar Moderador GCN</button>
        <hr style="border-top:1px solid #2a322c; margin:15px 0;">
        <ul id="modalModList" style="list-style:none; padding:0; max-height:150px; overflow-y:auto;">
          ${renderList() || '<li>Sem moderadores</li>'}
        </ul>
      </div>`,
    onMount: () => {
      $("#mS").onclick = () => {
        if(!$("#mU").value || !$("#mP").value) return TOASTS.show("User/Pass obrigatórios", "error");
        state.users.push({ id: uid(), role: 'moderator', username: $("#mU").value.trim(), password: $("#mP").value.trim(), field: $("#mF").value, crest: $("#mC").value });
        saveDB({ games: state.games, users: state.users });
        const listContainer = $("#modalModList");
        if(listContainer) listContainer.innerHTML = renderList();
        $("#mU").value = ""; $("#mP").value = ""; // Limpa para nova criação
      };
    }
  });
}

window.deleteMod = (id) => {
    if(confirm("Remover?")) {
        state.users = state.users.filter(u => u.id !== id);
        saveDB({ games: state.games, users: state.users });
        const listContainer = $("#modalModList");
        if(listContainer) listContainer.innerHTML = state.users.filter(u => u.role === 'moderator').map(m => `<li>${m.username}</li>`).join("");
    }
};

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  if (btn.classList.contains("chip")) { $$(".chip").forEach(c => c.classList.remove("active")); btn.classList.add("active"); state.filter = btn.dataset.filter; render(); return; }
  const card = btn.closest(".card"); if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const act = btn.dataset.action;
  if (act === "join") openJoinModal(g);
  if (act === "list") openListModal(g);
  if (act === "edit") openGameModal(g);
  if (act === "pin") { g.pinned = !g.pinned; saveDB({ games: state.games, users: state.users }); }
  if (act === "delete" && confirm("Apagar jogo?")) { state.games = state.games.filter(x => x.id !== g.id); saveDB({ games: state.games, users: state.users }); }
});

function openJoinModal(g) {
  openModal({
    title: "Inscrição",
    contentHTML: `<div class="form"><div class="field"><label>Nick</label><input id="jN" /></div><div class="field"><label>Equipa</label><input id="jT" /></div></div>`,
    footerHTML: `<button class="btn ok" id="jC">Confirmar</button>`,
    onMount: () => {
      $("#jC").onclick = () => {
        if (!g.attendees) g.attendees = [];
        g.attendees.push({ nickname: $("#jN").value, team: $("#jT").value, user_id: uid() });
        saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true;
      };
    }
  });
}

function openListModal(g) {
  const rows = (g.attendees || []).map(a => `<tr><td>${escapeHtml(a.nickname)}</td><td>${escapeHtml(a.team)}</td></tr>`).join("");
  openModal({ title: "Lista", contentHTML: `<table class="table" style="width:100%"><thead><tr><th>Nick</th><th>Equipa</th></tr></thead><tbody>${rows || '<tr><td>Vazio</td></tr>'}</tbody></table>` });
}

function init() {
  if (!window.dbOnValue || !window.onAuthChange) { setTimeout(init, 500); return; }
  
  // Verifica se o utilizador já estava logado no Firebase
  window.onAuthChange(window.fbAuth, (user) => {
    if (user) {
      console.log("Utilizador autenticado via Firebase:", user.email);
    } else {
      console.log("Nenhum utilizador logado.");
    }
  });

  bindGlobalEvents();
  // ... resto do seu init ...
}
init();