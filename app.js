// ===================== GCAN — VERSÃO FINAL BLINDADA =====================

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const uid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});

const TOASTS = {
  el: $(".toasts"),
  show(msg, type = "ok") {
    if (!this.el) return;
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.textContent = msg;
    this.el.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  },
};

const state = { games: [], users: [], filter: "all", search: "", auth: null };
const MockDB = { users: [{ id: 'I0guJuuPlbOw8Ek0pOQrPV6sVVG2', role: 'admin', username: 'admin', field: 'GCAN' }] };

function saveDB(d) { if (window.dbSet && window.dbRef && window.db) window.dbSet(window.dbRef(window.db, 'gcan_data'), d); }

function init() {
  if (!window.dbOnValue || !window.onAuthChange) { setTimeout(init, 500); return; }

  window.onAuthChange(window.fbAuth, (user) => {
    if (user) {
      state.auth = state.users.find(u => u.id === user.uid) || { id: user.uid, role: 'moderator', username: user.email };
    } else { state.auth = null; }
    syncTopbar();
    render();
  });

  window.dbOnValue(window.dbRef(window.db, 'gcan_data'), (snapshot) => {
    const data = snapshot.val();
    state.users = data?.users || MockDB.users;
    state.games = data?.games || [];
    render();
    syncTopbar();
  });

  bindEvents();
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.id === 'btnAdmin') openAdminLogin();
    if (t.id === 'btnCreate') openGameModal();
    if (t.id === 'btnUsers') openModsModal();
    if (t.id === 'btnLogout') { window.signOutUser(window.fbAuth); location.reload(); }
    
    if (t.classList.contains('chip')) {
      $$('.chip').forEach(c => c.classList.remove('active'));
      t.classList.add('active');
      state.filter = t.dataset.filter;
      render();
    }
  });

  const s = $('#search');
  if (s) s.oninput = (e) => { state.search = e.target.value; render(); };
}
// --- LÓGICA DE JOGO (CRIAÇÃO/EDIÇÃO) ---
function openGameModal(id = null) {
  const g = id ? state.games.find(x => x.id === id) : null;
  const now = new Date().toISOString().slice(0, 16);

  openModal(g ? "Editar Jogo" : "Criar Novo Jogo", `
    <div class="form">
      <div class="field"><label>Título do Jogo</label><input id="gT" value="${g?.title || ''}" class="input-std"></div>
      <div class="field"><label>Vagas Totais</label><input id="gV" type="number" value="${g?.total_slots || 30}" class="input-std"></div>
      <div class="field"><label>Data e Hora</label><input id="gD" type="datetime-local" min="${now}" value="${g?.date || ''}" class="input-std"></div>
      <div class="field"><label>Equipas/Facções (separadas por vírgula)</label><input id="gF" value="${g?.factions || 'Equipa A, Equipa B'}" placeholder="Ex: Camuflados, PMC"></div>
    </div>
  `, `<button class="btn ok" id="saveG">Guardar Jogo</button>`);

  $('#saveG').onclick = () => {
    const title = $('#gT').value.trim();
    const dateVal = $('#gD').value;

    if (!title || !dateVal) return TOASTS.show("Preencha todos os campos.", "error");
    if (new Date(dateVal) < new Date()) return TOASTS.show("Não podes criar jogos no passado!", "error");

    const newGameData = {
      id: g?.id || uid(),
      ownerId: state.auth.id,
      title: title,
      total_slots: Number($('#gV').value),
      date: dateVal,
      factions: $('#gF').value.trim() || 'Equipa A, Equipa B', // NOVA LINHA: Guarda as equipas
      attendees: g?.attendees || []
    };

    if (g) Object.assign(g, newGameData);
    else state.games.push(newGameData);

    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
    TOASTS.show("Jogo guardado com sucesso!");
  };
}
// --- LÓGICA DE INSCRIÇÃO ---
function openJoinModal(gameId) {
  const g = state.games.find(x => x.id === gameId);
  
  // Gera os botões de escolha única (Radio Buttons) com base nas equipas do jogo
  const factionList = (g.factions || 'Equipa A, Equipa B').split(',').map(f => f.trim());
  const radios = factionList.map((f, i) => `
    <label style="display:flex; align-items:center; gap:8px; color:#e7efe9; font-size:14px; cursor:pointer;">
      <input type="radio" name="jF" value="${escapeHtml(f)}" ${i===0 ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--accent);"> ${escapeHtml(f)}
    </label>
  `).join('');

  openModal(`Inscrição: ${g.title}`, `
    <div class="form">
      <div class="field"><label>Nick / Nome de Guerra</label><input id="jN" placeholder="Ex: Ghost"></div>
      <div class="field"><label>Nº Telemóvel (Obrigatório)</label><input id="jTel" type="tel" placeholder="Ex: 912345678"></div>
      <div class="field"><label>Nº APD (Opcional se Convidado)</label><input id="jA" placeholder="Insira o Nº ou 'Convidado'"></div>
      <div class="field" style="margin-top:10px;">
        <label>Escolha a sua Facção/Equipa</label>
        <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:8px; padding:10px; background:#121614; border:1px solid #2a322c; border-radius:8px;">
          ${radios}
        </div>
      </div>
    </div>
  `, `<button class="btn ok" id="confJ">Confirmar Inscrição</button>`);

  $('#confJ').onclick = () => {
    const nick = $('#jN').value.trim();
    const tel = $('#jTel').value.trim();
    const apd = $('#jA').value.trim() || "Convidado";
    const team = document.querySelector('input[name="jF"]:checked')?.value || "Sem Equipa";

    if (!nick || !tel) return TOASTS.show("O Nick e o Telemóvel são obrigatórios!", "error");

    const isDup = (g.attendees || []).some(a => a.nickname.toLowerCase() === nick.toLowerCase());
    if (isDup) return TOASTS.show("Erro: Esse Nick já está inscrito neste jogo.", "error");

    if (!g.attendees) g.attendees = [];
    g.attendees.push({ 
      id: uid(), 
      nickname: nick, 
      phone: tel, // NOVA LINHA: Guarda o telemóvel
      team: team, // Guarda a bolinha escolhida
      apd: apd, 
      paid: false, 
      checkedIn: false 
    });

    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
    TOASTS.show("Inscrição confirmada!");
  };
}
// --- LISTA DE INSCRITOS ---
function openListModal(gameId) {
  const g = state.games.find(x => x.id === gameId);
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  
  const rows = (g.attendees || []).map(a => {
    // Só mostra o telemóvel a quem for dono do jogo ou admin
    const phoneInfo = (isOwner && a.phone) ? ` • 📱 ${escapeHtml(a.phone)}` : '';
    
    return `
    <tr>
      <td>
        <div style="font-weight:bold;">${escapeHtml(a.nickname)}</div>
        <div class="muted" style="font-size:11px;">Facção: <span style="color:#e7efe9;">${escapeHtml(a.team)}</span> • APD: ${escapeHtml(a.apd)}${phoneInfo}</div>
      </td>
      <td style="text-align:right;">
        ${isOwner ? `
          <button class="btn ${a.paid ? 'ok' : ''}" style="padding:4px 8px; font-size:10px;" onclick="toggleStatus('${g.id}','${a.id}','paid')">€</button>
          <button class="btn ${a.checkedIn ? 'ok' : ''}" style="padding:4px 8px; font-size:10px;" onclick="toggleStatus('${g.id}','${a.id}','checkedIn')">✅</button>
        ` : (a.paid ? '💰' : '⏳')}
      </td>
    </tr>`;
  }).join("");

  openModal(`Lista (${g.attendees?.length || 0}/${g.total_slots})`, `
    <table class="table">${rows || "<tr><td colspan='2' style='text-align:center; padding:20px;' class='muted'>Ainda sem inscrições.</td></tr>"}</table>
  `);
}
window.toggleStatus = (gId, aId, field) => {
  const g = state.games.find(x => x.id === gId);
  const p = g.attendees.find(x => x.id === aId);
  if (p) { p[field] = !p[field]; saveDB({ games: state.games, users: state.users }); openListModal(gId); }
};

// --- RENDERIZAÇÃO E INTERFACE ---
function render() {
  const grid = $('#grid'); if (!grid) return;
  let list = [...state.games];
  if (state.filter === "mine") list = list.filter(g => g.ownerId === state.auth?.id);
  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => g.title.toLowerCase().includes(t));
  }

  grid.innerHTML = list.map(g => {
    const owner = state.users.find(u => u.id === g.ownerId);
    const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
    const status = (g.total_slots - (g.attendees?.length || 0)) <= 0 ? "lotado" : "aberto";
    
    return `
      <div class="card">
        <div class="hd" style="padding:15px; position:relative;">
           <span class="badge ${status}">${status}</span>
           <strong>${g.title}</strong>
           <div class="muted">${new Date(g.date).toLocaleString()}</div>
        </div>
        <div class="body" style="padding:15px;">
           <div class="btn-row" style="display:flex; gap:8px;">
              <button class="btn ok" onclick="openJoinModal('${g.id}')" ${status === 'lotado' ? 'disabled' : ''}>Entrar</button>
              <button class="btn" onclick="openListModal('${g.id}')">Lista</button>
              ${owner?.location ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(owner.location)}" target="_blank" class="btn">📍</a>` : ''}
           </div>
           ${isOwner ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid #222;">
              <button class="btn" onclick="openGameModal('${g.id}')">✏️ Editar</button>
              <button class="btn danger" onclick="deleteGame('${g.id}')">🗑️</button>
           </div>` : ''}
        </div>
      </div>`;
  }).join("") || '<p class="muted">Nenhum jogo encontrado.</p>';
}

function openModal(title, html, foot = "") {
  const o = $('#overlay');
  o.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3>${title}</h3><button onclick="$('#overlay').hidden=true" style="background:none; border:none; color:#fff; cursor:pointer;">✕</button></div>
      <div class="modal-body">${html}</div>
      <div class="modal-foot" style="display:flex; gap:10px; justify-content:flex-end; padding-top:15px; border-top:1px solid #222;">
        ${foot} <button class="btn" onclick="$('#overlay').hidden=true">Fechar</button>
      </div>
    </div>`;
  o.hidden = false;
}

// ... Restantes funções de Login e Moderadores (AdminLogin, openModsModal, syncTopbar, etc) ...
// (Mantidas conforme aprovado anteriormente para garantir funcionamento total)

async function openAdminLogin() {
  openModal("Acesso Seguro", `
    <div class="form">
      <input id="aE" type="email" placeholder="E-mail">
      <input id="aP" type="password" placeholder="Password">
    </div>`, `<button class="btn ok" id="doLogin">Entrar</button>`);
  $('#doLogin').onclick = async () => {
    try { await window.signIn(window.fbAuth, $('#aE').value, $('#aP').value); $('#overlay').hidden = true; }
    catch (e) { alert("Erro: " + e.message); }
  };
}

function syncTopbar() {
  const info = $('#sessionInfo');
  $('#btnCreate').hidden = !state.auth;
  $('#btnUsers').hidden = state.auth?.role !== 'admin';
  $('#filterMine').hidden = !state.auth;
  info.innerHTML = state.auth ? `<span>${state.auth.username}</span> <button class="btn" id="btnLogout" style="padding:2px 5px; font-size:10px; margin-left:5px;">Sair</button>` : "";
}

function deleteGame(id) { if(confirm("Apagar jogo?")) { state.games = state.games.filter(x => x.id !== id); saveDB({ games: state.games, users: state.users }); } }

init();