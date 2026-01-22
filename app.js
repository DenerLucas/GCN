// ===================== GCAN — VERSÃO FINAL ROBUSTA =====================

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = { games: [], users: [], filter: "all", search: "", auth: null };

// UID Real do seu Admin
const MockDB = {
  users: [{ id: 'I0guJuuPlbOw8Ek0pOQrPV6sVVG2', role: 'admin', username: 'admin', field: 'GCAN' }]
};

function init() {
  if (!window.dbOnValue || !window.onAuthChange) { setTimeout(init, 500); return; }

  // Sincronização em tempo real
  window.dbOnValue(window.dbRef(window.db, 'gcan_data'), (snapshot) => {
    const data = snapshot.val();
    state.users = data?.users || MockDB.users;
    state.games = data?.games || [];
    render();
    syncTopbar();
  });

  // Listener de autenticação
  window.onAuthChange(window.fbAuth, (user) => {
    if (user) {
      state.auth = state.users.find(u => u.id === user.uid) || { id: user.uid, role: 'moderator', username: user.email };
    } else {
      state.auth = null;
    }
    syncTopbar();
    render();
  });

  bindEvents();
}

function bindEvents() {
    // Escuta cliques globais para evitar problemas com camadas
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.id === 'btnAdmin') openAdminLogin();
        if (target.id === 'btnCreate') openGameModal();
        if (target.id === 'btnLogout') logout();
        
        if (target.classList.contains('chip')) {
            $$('.chip').forEach(c => c.classList.remove('active'));
            target.classList.add('active');
            state.filter = target.dataset.filter;
            render();
        }
    });

    const searchInput = $('#search');
    if (searchInput) searchInput.oninput = (e) => { state.search = e.target.value; render(); };
}

function render() {
  const grid = $('#grid');
  if (!grid) return;

  let list = [...state.games];
  if (state.filter === "mine") list = list.filter(g => g.ownerId === state.auth?.id);
  if (state.search) list = list.filter(g => g.title.toLowerCase().includes(state.search.toLowerCase()));

  grid.innerHTML = list.map(g => `
    <div class="card">
        <h3>${g.title}</h3>
        <p class="muted">${g.date}</p>
        <div style="margin-top:15px;">
            <button class="btn ok" onclick="alert('Inscrição em breve')">Entrar</button>
        </div>
    </div>
  `).join("") || '<p class="muted">Nenhum jogo encontrado.</p>';
}

function openAdminLogin() {
  const overlay = $('#overlay');
  overlay.innerHTML = `
    <div class="modal">
        <h3>Acesso Seguro</h3>
        <div style="margin:20px 0;">
            <input id="aE" type="email" placeholder="E-mail" style="width:100%; padding:10px; margin-bottom:10px;">
            <input id="aP" type="password" placeholder="Password" style="width:100%; padding:10px;">
        </div>
        <button class="btn ok" id="doLogin">Entrar</button>
        <button class="btn" onclick="document.getElementById('overlay').hidden = true">Fechar</button>
    </div>`;
  overlay.hidden = false;

  $('#doLogin').onclick = async () => {
    try {
      await window.signIn(window.fbAuth, $('#aE').value, $('#aP').value);
      overlay.hidden = true;
    } catch (e) { alert("Erro: " + e.message); }
  };
}

function syncTopbar() {
  const info = $('#sessionInfo');
  $('#btnCreate').hidden = !state.auth;
  $('#filterMine').hidden = !state.auth;
  info.innerHTML = state.auth ? `<span>${state.auth.username}</span> <button class="btn" id="btnLogout">Sair</button>` : "";
}

async function logout() {
    await window.signOutUser(window.fbAuth);
    location.reload();
}

init();