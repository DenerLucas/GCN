// ===================== GCAN — VERSÃO FINAL COM EQUIPAS E ADMIN ABSOLUTO =====================

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Gerador de ID único
const uid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});

// Formatador de Data
const fmtDate = (iso) => {
  try {
    if (!iso) return "Data a definir";
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "Data a definir" : date.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "Data a definir"; }
};

const escapeHtml = (s) => String(s || "").replace(/[&<>"']/g, m => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": "'" }[m]));

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

const AUTH_KEY = 'gcan_auth_v1';
const safeStorage = (() => {
  try { localStorage.setItem("t", "1"); localStorage.removeItem("t"); return localStorage; }
  catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
})();

const state = { games: [], users: [], filter: "all", search: "", auth: JSON.parse(safeStorage.getItem(AUTH_KEY) || 'null') };
const MockDB = { users: [{ id: 'I0guJuuPlbOw8Ek0pOQrPV6sVVG2', role: 'admin', username: 'admin', field: 'GCAN' }] };

function saveDB(data) {
  if (window.dbSet && window.dbRef && window.db) {
    window.dbSet(window.dbRef(window.db, 'gcan_data'), data)
      .catch(err => TOASTS.show("Erro Cloud: " + err.message, "error"));
  }
}

function init() {
  if (!window.dbOnValue || !window.onAuthChange) { setTimeout(init, 500); return; }

  window.onAuthChange(window.fbAuth, (user) => {
    if (user) {
      state.auth = state.users.find(u => u.id === user.uid) || { id: user.uid, role: 'moderator', username: user.email };
      
      // CORREÇÃO CRÍTICA: Força o teu UID a ser SEMPRE Administrador Absoluto
      if (state.auth.id === 'I0guJuuPlbOw8Ek0pOQrPV6sVVG2') {
          state.auth.role = 'admin';
      }
      
      safeStorage.setItem(AUTH_KEY, JSON.stringify(state.auth));
    } else {
      state.auth = null;
      safeStorage.removeItem(AUTH_KEY);
    }
    syncTopbar();
    render();
  });

  window.dbOnValue(window.dbRef(window.db, 'gcan_data'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      state.users = data.users || MockDB.users;
      state.games = data.games || [];
    } else {
      saveDB({ games: [], users: MockDB.users });
    }
    render();
    syncTopbar();
  });

  bindEvents();
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    
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

// --- RENDERIZAÇÃO ---
function render() {
  const grid = $('#grid'); if (!grid) return;
  let list = [...state.games];
  
  if (state.filter === "mine") list = list.filter(g => g.ownerId === state.auth?.id);
  else if (state.filter === "open") list = list.filter(g => (g.total_slots - (g.attendees?.length || 0)) > 0);

  if (state.search) {
    const term = state.search.toLowerCase();
    list = list.filter(g => g.title.toLowerCase().includes(term));
  }

  list.sort((a, b) => new Date(a.date) - new Date(b.date));

  grid.innerHTML = list.map(g => {
    const owner = state.users.find(u => u.id === g.ownerId);
    
    // O Admin tem sempre permissão total sobre qualquer jogo
    const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
    
    const occupied = g.attendees?.length || 0;
    const status = (g.total_slots - occupied) <= 0 ? "lotado" : "aberto";
    const mapsLink = owner?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(owner.location)}` : null;

    return `
      <div class="card">
        <div class="hd">
           <span class="badge ${status}">${status}</span>
           <div style="font-weight:bold; font-size:16px;">${escapeHtml(g.title)}</div>
           <div class="muted" style="margin-top:4px;">📅 ${fmtDate(g.date)}</div>
           <div class="muted" style="font-size:11px;">${owner?.field || 'Campo Desconhecido'}</div>
        </div>
        <div class="body">
           <div style="font-size:13px; margin-bottom:10px;">👤 ${occupied}/${g.total_slots} Inscritos</div>
           
           <div class="btn-row">
              <button class="btn ok" onclick="window.openJoinModal('${g.id}')" ${status === 'lotado' ? 'disabled' : ''}>Entrar</button>
              <button class="btn" onclick="window.openListModal('${g.id}')">Lista</button>
              ${mapsLink ? `<a href="${mapsLink}" target="_blank" class="btn icon-btn">📍</a>` : ''}
           </div>

           ${isOwner ? `
           <div style="margin-top:15px; padding-top:10px; border-top:1px solid #2a322c; display:flex; gap:10px;">
              <button class="btn" onclick="window.openGameModal('${g.id}')">✏️ Editar</button>
              <button class="btn danger" onclick="window.deleteGame('${g.id}')">🗑️ Apagar</button>
           </div>` : ''}
        </div>
      </div>`;
  }).join("") || '<div style="grid-column:1/-1; text-align:center; padding:40px;" class="muted">Nenhum jogo encontrado.</div>';
}

// --- MODAL GENÉRICO ---
function openModal(title, contentHTML, footerHTML) {
  const o = $('#overlay');
  o.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="icon-btn" onclick="document.getElementById('overlay').hidden=true">✕</button>
      </div>
      <div class="modal-body">${contentHTML}</div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML} <button class="btn" onclick="document.getElementById('overlay').hidden=true">Fechar</button></div>` : ''}
    </div>`;
  o.hidden = false;
}

// --- CRIAÇÃO / EDIÇÃO DE JOGOS (AGORA COM EQUIPAS) ---
window.openGameModal = function(id = null) {
  const g = id ? state.games.find(x => x.id === id) : null;
  const now = new Date().toISOString().slice(0, 16);

  openModal(g ? "Editar Jogo" : "Criar Novo Jogo", `
    <div class="form">
      <div class="field"><label>Título do Jogo</label><input id="gT" value="${g?.title || ''}"></div>
      <div class="field"><label>Vagas Totais</label><input id="gV" type="number" value="${g?.total_slots || 30}"></div>
      <div class="field"><label>Data e Hora</label><input id="gD" type="datetime-local" min="${now}" value="${g?.date || ''}"></div>
      <div class="field"><label>Equipas/Facções (Separadas por vírgula)</label><input id="gF" value="${g?.factions || 'Equipa A, Equipa B'}" placeholder="Ex: Camuflados, PMC, Russo"></div>
    </div>
  `, `<button class="btn ok" id="saveG">Guardar Jogo</button>`);

  $('#saveG').onclick = () => {
    const title = $('#gT').value.trim();
    const dateVal = $('#gD').value;

    if (!title || !dateVal) return TOASTS.show("Preencha todos os campos obrigatórios.", "error");
    if (new Date(dateVal) < new Date()) return TOASTS.show("Não podes criar jogos no passado!", "error");

    const newGameData = {
      id: g?.id || uid(),
      ownerId: state.auth.id,
      title: title,
      total_slots: Number($('#gV').value),
      date: dateVal,
      factions: $('#gF').value.trim() || 'Equipa A, Equipa B', // Grava as equipas
      attendees: g?.attendees || []
    };

    if (g) Object.assign(g, newGameData);
    else state.games.push(newGameData);

    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
    TOASTS.show("Jogo guardado com sucesso!");
  };
};

// --- INSCRIÇÕES (AGORA COM RÁDIO BUTTONS E TELEMÓVEL) ---
window.openJoinModal = function(gameId) {
  const g = state.games.find(x => x.id === gameId);
  
  // Gera os botões (Radio) dinamicamente com base no que o criador escreveu
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
        <label>Escolha a sua Facção/Equipa:</label>
        <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:8px; padding:12px; background:#121614; border:1px solid #2a322c; border-radius:8px;">
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

    // Verifica duplicados
    const isDup = (g.attendees || []).some(a => a.nickname.toLowerCase() === nick.toLowerCase());
    if (isDup) return TOASTS.show("Erro: Esse Nick já está inscrito neste jogo.", "error");

    if (!g.attendees) g.attendees = [];
    g.attendees.push({ 
      id: uid(), 
      nickname: nick, 
      phone: tel, // Grava o telemóvel
      team: team, // Grava a facção escolhida nas bolinhas
      apd: apd, 
      paid: false, 
      checkedIn: false 
    });

    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
    TOASTS.show("Inscrição confirmada!");
  };
};

// --- LISTA DE INSCRITOS ---
window.openListModal = function(gameId) {
  const g = state.games.find(x => x.id === gameId);
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  
  const rows = (g.attendees || []).map(a => {
    // O telemóvel só aparece para o dono do jogo ou para o Admin. Jogadores normais não vêm!
    const phoneInfo = (isOwner && a.phone) ? `<br><span style="color:var(--accent);">📱 ${escapeHtml(a.phone)}</span>` : '';
    
    return `
    <tr>
      <td>
        <div style="font-weight:bold;">${escapeHtml(a.nickname)}</div>
        <div class="muted" style="font-size:11px;">Facção: <span style="color:#e7efe9;">${escapeHtml(a.team)}</span> • APD: ${escapeHtml(a.apd)} ${phoneInfo}</div>
      </td>
      <td style="text-align:right;">
        ${isOwner ? `
          <button class="btn ${a.paid ? 'ok' : ''}" style="padding:4px 8px; font-size:10px;" onclick="window.toggleStatus('${g.id}','${a.id}','paid')">€</button>
          <button class="btn ${a.checkedIn ? 'ok' : ''}" style="padding:4px 8px; font-size:10px;" onclick="window.toggleStatus('${g.id}','${a.id}','checkedIn')">✅</button>
        ` : (a.paid ? '💰' : '⏳')}
      </td>
    </tr>`;
  }).join("");

  openModal(`Lista (${g.attendees?.length || 0}/${g.total_slots})`, `
    <table class="table">${rows || "<tr><td colspan='2' style='text-align:center; padding:20px;' class='muted'>Ainda sem inscrições.</td></tr>"}</table>
  `);
};

window.toggleStatus = function(gId, aId, field) {
  const g = state.games.find(x => x.id === gId);
  const p = g.attendees.find(x => x.id === aId);
  if (p) { 
    p[field] = !p[field]; 
    saveDB({ games: state.games, users: state.users }); 
    window.openListModal(gId); 
  }
};

window.deleteGame = function(id) {
  if(confirm("Tem a certeza que quer apagar este jogo?")) {
    state.games = state.games.filter(x => x.id !== id);
    saveDB({ games: state.games, users: state.users });
  }
};

// --- GESTÃO DE MODERADORES ---
function openModsModal() {
  const renderList = () => state.users.filter(u => u.role === 'moderator').map(m => `
    <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; padding:8px 0;">
      <span>${m.username} <small class="muted">(${m.field})</small></span>
      <button onclick="window.deleteMod('${m.id}')" class="btn danger" style="padding:2px 6px;">✕</button>
    </li>`).join("");

  openModal("Gestão de Moderadores", `
    <div class="form">
      <div class="field"><label>E-mail</label><input id="mE" type="email"></div>
      <div class="field"><label>Password (min 6)</label><input id="mP" type="password"></div>
      <div class="field"><label>Nome do Campo</label><input id="mF"></div>
      <div class="field"><label>Localização (GPS)</label><input id="mL" placeholder="Ex: 41.550, -8.420"></div>
      <button class="btn ok" id="addM">Criar Moderador</button>
    </div>
    <div style="margin-top:20px;">
      <h4 class="muted">Moderadores Atuais</h4>
      <ul style="list-style:none; padding:0; margin:0; max-height:150px; overflow-y:auto;">${renderList()}</ul>
    </div>
  `);

  $('#addM').onclick = async () => {
    try {
      const email = $('#mE').value;
      const pass = $('#mP').value;
      const field = $('#mF').value;
      if(!email || !pass || !field) return TOASTS.show("Preencha todos os campos", "error");

      const cred = await window.signUp(window.fbAuth, email, pass);
      state.users.push({ 
        id: cred.user.uid, 
        role: 'moderator', 
        username: email, 
        field: field, 
        location: $('#mL').value 
      });
      
      saveDB({ games: state.games, users: state.users });
      $('#overlay').hidden = true;
      TOASTS.show("Moderador criado!");
    } catch(e) { TOASTS.show(e.message, "error"); }
  };
}

window.deleteMod = function(id) {
  if(confirm("Remover este moderador?")) {
    state.users = state.users.filter(u => u.id !== id);
    saveDB({ games: state.games, users: state.users });
    $('#overlay').hidden = true;
  }
};

// --- LOGIN ADMIN ---
function openAdminLogin() {
  if (state.auth) {
      if(confirm("Deseja terminar a sessão de " + state.auth.username + "?")) {
          window.signOutUser(window.fbAuth);
          location.reload();
      }
      return;
  }

  openModal("Acesso à Plataforma", `
    <div class="form">
      <div class="field"><label>E-mail</label><input id="aE" type="email"></div>
      <div class="field"><label>Password</label><input id="aP" type="password"></div>
    </div>
  `, `<button class="btn ok" id="doLogin">Entrar</button>`);

  $('#doLogin').onclick = async () => {
    try { 
      await window.signIn(window.fbAuth, $('#aE').value, $('#aP').value); 
      $('#overlay').hidden = true; 
    } catch (e) { TOASTS.show("Erro: " + e.message, "error"); }
  };
}

function syncTopbar() {
  const adminDiv = $('#adminButtons');
  const btnAdmin = $('#btnAdmin');
  const sessionInfo = $('#sessionInfo');
  const filterMine = $('#filterMine');

  if (state.auth) {
    sessionInfo.textContent = `Olá, ${state.auth.username}`;
    btnAdmin.textContent = "⚙️"; 
    btnAdmin.style.border = "1px solid #7ea35a"; 
    
    adminDiv.style.display = 'flex'; 
    $('#btnCreate').hidden = false;
    $('#btnUsers').hidden = (state.auth.role !== 'admin');
    filterMine.hidden = false;
  } else {
    sessionInfo.textContent = "";
    btnAdmin.textContent = "⚙️";
    btnAdmin.style.border = "1px solid #2a322c";
    
    adminDiv.style.display = 'none'; 
    filterMine.hidden = true;
  }
}

init();