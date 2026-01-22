// ===================== GCAN — SISTEMA FINAL CONSOLIDADO =====================

(function () {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const uid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});

const fmtDate = (iso) => {
  try {
    if (!iso) return "Data a definir";
    const date = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
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

const MockDB = {
  games: [],
  users: [{ id: 'I0guJuuPlbOw8Ek0pOQrPV6sVVG2', role: 'admin', username: 'admin', field: 'GCAN', crest: '', location: '' }]
};

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
      const found = state.users.find(u => u.id === user.uid);
      if (found) {
        state.auth = found;
        safeStorage.setItem(AUTH_KEY, JSON.stringify(found));
        syncTopbar();
        render();
      }
    } else {
      state.auth = null;
      safeStorage.removeItem(AUTH_KEY);
      syncTopbar();
      render();
    }
  });

  bindGlobalEvents();

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

function bindGlobalEvents() {
  $("#btnAdmin").onclick = openAdminLogin;
  $("#btnCreate").onclick = () => openGameModal();
  $("#btnUsers").onclick = () => (state.auth?.role === 'admin' ? openModsModal() : TOASTS.show("Acesso negado", "error"));
  $("#search").oninput = (e) => { state.search = e.target.value; render(); };
  
  $$(".chip").forEach(btn => {
    btn.onclick = () => {
      $$(".chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      state.filter = btn.dataset.filter;
      render();
    };
  });
}

function cardHTML(g) {
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  const owner = state.users.find(u => u.id === g.ownerId);
  const crest = owner?.crest ? `<img src="${owner.crest}">` : `<span>${(owner?.field || "?")[0]}</span>`;
  const slotsLeft = g.total_slots - (g.attendees?.length || 0);
  const status = slotsLeft <= 0 ? "lotado" : "aberto";
  
  const mapsLink = owner?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(owner.location)}` : null;

  return `
    <article class="card" data-id="${g.id}">
      <div class="hd"><span class="badge ${status}">${status}</span><div class="crest-lg">${crest}</div></div>
      <div class="body">
        <strong>${escapeHtml(g.title)}</strong>
        <div class="muted">${fmtDate(g.date)}</div>
        <div class="muted" style="font-size:11px; margin-top:4px;">${g.attendees?.length || 0}/${g.total_slots} Inscritos</div>
        <div class="btn-row">
          <button class="btn ok" onclick="openJoinModal('${g.id}')" ${status === 'lotado' ? 'disabled' : ''}>✅ Entrar</button>
          <button class="btn" onclick="openListModal('${g.id}')">📄 Lista</button>
          ${mapsLink ? `<a href="${mapsLink}" target="_blank" class="btn">📍 Local</a>` : ""}
        </div>
        ${isOwner ? `<div class="btn-row admin-controls" style="border-top:1px solid #2a322c; padding-top:10px; margin-top:10px;">
          <button class="btn" onclick="openGameModal('${g.id}')">✏️</button>
          <button class="btn danger" onclick="deleteGame('${g.id}')">🗑️</button>
        </div>` : ""}
      </div>
    </article>`;
}

function render() {
  const grid = $("#grid"); if (!grid) return;
  let list = [...state.games];
  
  if (state.filter === "mine") list = list.filter(g => g.ownerId === state.auth?.id);
  else if (state.filter === "open") list = list.filter(g => (g.total_slots - (g.attendees?.length || 0)) > 0);

  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter(g => g.title.toLowerCase().includes(t) || (state.users.find(u => u.id === g.ownerId)?.field || "").toLowerCase().includes(t));
  }

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:50px;"><div style="font-size:40px;">🔭</div><p class="muted">Nenhum jogo encontrado.</p></div>`;
  } else {
    list.sort((a, b) => new Date(a.date) - new Date(b.date));
    grid.innerHTML = list.map(cardHTML).join("");
  }
}

// --- MODAIS ---
function openModal({ title, contentHTML, footerHTML, onMount }) {
  const overlay = $("#overlay");
  overlay.innerHTML = `<div class="modal"><div class="modal-head"><h3>${title}</h3><button class="btn icon-btn" id="btnClose">✕</button></div><div class="modal-body">${contentHTML}</div>${footerHTML ? `<div class="modal-foot" style="padding:15px; border-top:1px solid #2a322c; display:flex; justify-content:flex-end;">${footerHTML}</div>` : ""}</div>`;
  overlay.hidden = false;
  $("#btnClose").onclick = () => overlay.hidden = true;
  if (onMount) onMount();
}

function openJoinModal(gameId) {
  const g = state.games.find(x => x.id === gameId);
  openModal({
    title: "Inscrição",
    contentHTML: `<div class="form"><div class="field"><label>Nick</label><input id="jN"></div><div class="field"><label>Equipa</label><input id="jT"></div></div>`,
    footerHTML: `<button class="btn ok" id="jC">Confirmar</button>`,
    onMount: () => {
      $("#jC").onclick = () => {
        if (!$("#jN").value) return TOASTS.show("Nick obrigatório", "error");
        if (!g.attendees) g.attendees = [];
        g.attendees.push({ id: uid(), nickname: $("#jN").value, team: $("#jT").value || "Individual", paid: false, checkedIn: false });
        saveDB({ games: state.games, users: state.users });
        $("#overlay").hidden = true;
        TOASTS.show("Inscrito!");
      };
    }
  });
}

function openListModal(gameId) {
  const g = state.games.find(x => x.id === gameId);
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  
  const rows = (g.attendees || []).map(a => `
    <tr>
      <td>${escapeHtml(a.nickname)}<br><small class="muted">${escapeHtml(a.team)}</small></td>
      <td style="text-align:right;">
        ${isOwner ? `
          <button class="btn ${a.paid ? 'ok' : ''}" onclick="toggleStatus('${g.id}','${a.id}','paid')">€</button>
          <button class="btn ${a.checkedIn ? 'ok' : ''}" onclick="toggleStatus('${g.id}','${a.id}','checkedIn')">✅</button>
        ` : (a.paid ? '💰' : '⏳')}
      </td>
    </tr>`).join("");

  openModal({
    title: "Lista: " + g.title,
    contentHTML: `<table class="table"><thead><tr><th>Jogador</th><th style="text-align:right;">Estado</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Vazio</td></tr>'}</tbody></table>`
  });
}

window.toggleStatus = (gId, aId, field) => {
  const g = state.games.find(x => x.id === gId);
  const p = g.attendees.find(x => x.id === aId);
  if (p) { p[field] = !p[field]; saveDB({ games: state.games, users: state.users }); openListModal(gId); }
};

function openGameModal(gameId = null) {
  const g = gameId ? state.games.find(x => x.id === gameId) : null;
  openModal({
    title: g ? "Editar Jogo" : "Criar Novo Jogo",
    contentHTML: `<div class="form">
      <div class="field"><label>Título</label><input id="gT" value="${g?.title || ''}"></div>
      <div class="field"><label>Vagas</label><input id="gV" type="number" value="${g?.total_slots || 30}"></div>
      <div class="field"><label>Data</label><input id="gD" type="datetime-local" value="${g?.date || ''}"></div>
    </div>`,
    footerHTML: `<button class="btn ok" id="gS">Guardar</button>`,
    onMount: () => {
      $("#gS").onclick = () => {
        if (!$("#gT").value || !$("#gD").value) return TOASTS.show("Campos obrigatórios", "error");
        if (g) { Object.assign(g, { title: $("#gT").value, total_slots: Number($("#gV").value), date: $("#gD").value }); }
        else { state.games.push({ id: uid(), ownerId: state.auth.id, title: $("#gT").value, total_slots: Number($("#gV").value), date: $("#gD").value, attendees: [] }); }
        saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true;
      };
    }
  });
}

window.deleteGame = (id) => { if (confirm("Apagar jogo?")) { state.games = state.games.filter(x => x.id !== id); saveDB({ games: state.games, users: state.users }); } };

function openModsModal() {
  const renderList = () => state.users.filter(u => u.role === 'moderator').map(m => `
    <li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:5px; border-bottom:1px solid #222;">
      <span>${m.username} <br><small class="muted">${m.field}</small></span>
      <button onclick="deleteMod('${m.id}')" class="btn danger" style="padding:2px 6px;">✕</button>
    </li>`).join("");

  openModal({
    title: "Gestão de Moderadores",
    contentHTML: `<div class="form">
      <input id="mE" type="email" placeholder="E-mail">
      <input id="mP" type="password" placeholder="Pass (min 6)">
      <input id="mF" placeholder="Nome do Campo">
      <input id="mL" placeholder="📍 Localização (Coordenadas)">
      <button class="btn ok" id="mB">Criar Moderador</button>
      <hr style="border-color:#222; margin:15px 0;"><ul id="modList">${renderList()}</ul>
    </div>`,
    onMount: () => {
      $("#mB").onclick = async () => {
        try {
          const cred = await window.signUp(window.fbAuth, $("#mE").value, $("#mP").value);
          state.users.push({ id: cred.user.uid, role: 'moderator', username: $("#mE").value, field: $("#mF").value, location: $("#mL").value, crest: '' });
          saveDB({ games: state.games, users: state.users }); TOASTS.show("Moderador Criado!"); $("#overlay").hidden = true;
        } catch (e) { TOASTS.show(e.message, "error"); }
      };
    }
  });
}

window.deleteMod = (id) => { if (confirm("Remover moderador?")) { state.users = state.users.filter(u => u.id !== id); saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true; } };

async function openAdminLogin() {
  openModal({
    title: "Acesso Seguro",
    contentHTML: `<div class="form"><input id="aE" type="email" placeholder="E-mail"><input id="aP" type="password" placeholder="Pass"></div>`,
    footerHTML: `<button class="btn ok" id="aL">Entrar</button>`,
    onMount: () => {
      $("#aL").onclick = async () => {
        try { await window.signIn(window.fbAuth, $("#aE").value, $("#aP").value); location.reload(); }
        catch (e) { TOASTS.show("Erro: " + e.message, "error"); }
      };
    }
  });
}

function syncTopbar() {
  const info = $("#sessionInfo");
  if (!state.auth) {
    info.innerHTML = "";
    $("#btnCreate").hidden = $("#btnUsers").hidden = $("#filterMine").hidden = true;
  } else {
    info.innerHTML = `${state.auth.username} <button class="btn icon-btn" id="btnLogout" style="font-size:11px; color:var(--danger);">Sair</button>`;
    $("#btnLogout").onclick = async () => { await window.signOutUser(window.fbAuth); location.reload(); };
    $("#btnCreate").hidden = false;
    $("#filterMine").hidden = false;
    $("#btnUsers").hidden = state.auth.role !== 'admin';
  }
}

init();