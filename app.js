// ===================== GCAN — VERSÃO PROFISSIONAL COMPLETA =====================

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const uid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});

const state = { games: [], users: [], filter: "all", search: "", auth: null };
const MockDB = { users: [{ id: 'I0guJuuPlbOw8Ek0pOQrPV6sVVG2', role: 'admin', username: 'admin', field: 'GCAN' }] };

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
  // Listener global de cliques para garantir que nada fica "inclicável"
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

function render() {
  const grid = $('#grid'); if (!grid) return;
  let list = [...state.games];
  
  if (state.filter === "mine") list = list.filter(g => g.ownerId === state.auth?.id);
  if (state.search) list = list.filter(g => g.title.toLowerCase().includes(state.search.toLowerCase()));

  grid.innerHTML = list.map(g => {
    const owner = state.users.find(u => u.id === g.ownerId);
    const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
    const slots = g.total_slots - (g.attendees?.length || 0);
    
    return `
      <div class="card">
        <div class="hd" style="padding:15px; background:#1a221c;">
           <strong>${g.title}</strong>
           <div class="muted">${g.date}</div>
        </div>
        <div class="body" style="padding:15px;">
           <div class="muted">${g.attendees?.length || 0}/${g.total_slots} Inscritos</div>
           <div class="btn-row" style="margin-top:10px; display:flex; gap:5px;">
              <button class="btn ok" onclick="openJoinModal('${g.id}')">Entrar</button>
              <button class="btn" onclick="openListModal('${g.id}')">Lista</button>
              ${owner?.location ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(owner.location)}" target="_blank" class="btn">📍</a>` : ''}
           </div>
           ${isOwner ? `<div style="margin-top:10px; border-top:1px solid #222; pt:10px;">
              <button class="btn" onclick="openGameModal('${g.id}')">✏️</button>
              <button class="btn danger" onclick="deleteGame('${g.id}')">🗑️</button>
           </div>` : ''}
        </div>
      </div>`;
  }).join("") || '<p class="muted">Nenhum jogo encontrado.</p>';
}

function openModal(title, html, foot = "") {
  const o = $('#overlay');
  o.innerHTML = `<div class="modal"><h3>${title}</h3><div style="margin:20px 0;">${html}</div>${foot}<button class="btn" onclick="document.getElementById('overlay').hidden=true">Fechar</button></div>`;
  o.hidden = false;
}

function openAdminLogin() {
  openModal("Acesso Seguro", `
    <input id="aE" type="email" placeholder="E-mail" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="aP" type="password" placeholder="Password" style="width:100%; padding:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
  `, `<button class="btn ok" id="doLogin" style="margin-right:10px;">Entrar</button>`);
  
  $('#doLogin').onclick = async () => {
    try { await window.signIn(window.fbAuth, $('#aE').value, $('#aP').value); $('#overlay').hidden = true; }
    catch (e) { alert("Erro: " + e.message); }
  };
}

function openGameModal(id = null) {
  const g = id ? state.games.find(x => x.id === id) : null;
  openModal(g ? "Editar Jogo" : "Criar Jogo", `
    <input id="gT" placeholder="Título" value="${g?.title || ''}" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="gV" type="number" placeholder="Vagas" value="${g?.total_slots || 30}" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="gD" type="datetime-local" value="${g?.date || ''}" style="width:100%; padding:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
  `, `<button class="btn ok" id="saveG" style="margin-right:10px;">Guardar</button>`);

  $('#saveG').onclick = () => {
    const newG = { id: g?.id || uid(), ownerId: state.auth.id, title: $('#gT').value, total_slots: Number($('#gV').value), date: $('#gD').value, attendees: g?.attendees || [] };
    if(g) Object.assign(g, newG); else state.games.push(newG);
    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
  };
}

function openJoinModal(id) {
  const g = state.games.find(x => x.id === id);
  openModal("Inscrição", `
    <input id="jN" placeholder="Nick" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="jT" placeholder="Equipa" style="width:100%; padding:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
  `, `<button class="btn ok" id="confJ" style="margin-right:10px;">Confirmar</button>`);

  $('#confJ').onclick = () => {
    if(!g.attendees) g.attendees = [];
    g.attendees.push({ id: uid(), nickname: $('#jN').value, team: $('#jT').value, paid: false });
    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
  };
}

function openListModal(id) {
  const g = state.games.find(x => x.id === id);
  const rows = (g.attendees || []).map(a => `<tr><td style="padding:5px; border-bottom:1px solid #222;">${a.nickname} (${a.team})</td></tr>`).join("");
  openModal("Lista de Inscritos", `<table style="width:100%">${rows || "Vazio"}</table>`);
}

function openModsModal() {
  const mods = state.users.filter(u => u.role === 'moderator').map(m => `<li style="margin-bottom:5px;">${m.username} (${m.field})</li>`).join("");
  openModal("Gestão Moderadores", `
    <input id="mE" placeholder="E-mail" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="mP" type="password" placeholder="Password (min 6)" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="mF" placeholder="Campo" style="width:100%; padding:10px; margin-bottom:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <input id="mL" placeholder="📍 Localização" style="width:100%; padding:10px; background:#0b0e0c; color:#fff; border:1px solid #222;">
    <hr style="border-color:#222; margin:10px 0;">
    <ul>${mods || "Nenhum moderador"}</ul>
  `, `<button class="btn ok" id="addM" style="margin-right:10px;">Criar</button>`);

  $('#addM').onclick = async () => {
    try {
      const c = await window.signUp(window.fbAuth, $('#mE').value, $('#mP').value);
      state.users.push({ id: c.user.uid, role: 'moderator', username: $('#mE').value, field: $('#mF').value, location: $('#mL').value });
      saveDB({ games: state.games, users: state.users });
      $('#overlay').hidden = true;
    } catch(e) { alert(e.message); }
  };
}

function syncTopbar() {
  const info = $('#sessionInfo');
  $('#btnCreate').hidden = !state.auth;
  $('#btnUsers').hidden = state.auth?.role !== 'admin';
  $('#filterMine').hidden = !state.auth;
  info.innerHTML = state.auth ? `<span>${state.auth.username}</span> <button class="btn" id="btnLogout" style="padding:2px 5px; font-size:10px; margin-left:5px;">Sair</button>` : "";
}

function saveDB(d) { if (window.dbSet && window.dbRef && window.db) window.dbSet(window.dbRef(window.db, 'gcan_data'), d); }
function deleteGame(id) { if(confirm("Apagar?")) { state.games = state.games.filter(x => x.id !== id); saveDB({ games: state.games, users: state.users }); } }

init();