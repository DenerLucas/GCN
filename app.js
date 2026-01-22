// ===================== GCAN — VERSÃO ULTIMATE CLOUD RESTAURADA TOTAL =====================

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
    // Correção para evitar Invalid Date em browsers mobile
    const cleanIso = iso.includes('T') ? iso : iso.replace(' ', 'T');
    const date = new Date(cleanIso);
    if (isNaN(date.getTime())) return "Data a definir";
    return date.toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
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

const state = { 
    games: [], 
    users: [], 
    filter: "all", 
    search: "", 
    auth: JSON.parse(safeStorage.getItem(AUTH_KEY) || 'null') 
};

const MockDB = {
  games: [],
  users: [{ id: 'admin-1', role: 'admin', name: 'Admin Global', username: 'admin', password: 'airsoft2025', field: 'GCAN', crest: '', location: '' }]
};

// ===== SINCRONIZAÇÃO FIREBASE =====
function saveDB(data) {
  if (window.dbSet && window.dbRef && window.db) {
    window.dbSet(window.dbRef(window.db, 'gcan_data'), data);
  }
}

function init() {
  if (!window.dbOnValue) {
    setTimeout(init, 500);
    return;
  }
  window.dbOnValue(window.dbRef(window.db, 'gcan_data'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      state.games = data.games || [];
      state.users = data.users || MockDB.users;
      render();
    } else {
      saveDB(MockDB);
    }
    syncTopbar();
  });
}

// ===== LÓGICA DE NEGÓCIO =====
function remaining(g) { return g.total_slots - (g.attendees ? g.attendees.length : 0); }
function calcStatus(g) {
  if (remaining(g) <= 0) return "lotado";
  return g.status === "closed" ? "fechado" : "aberto";
}
function isJoined(g) { return (g.attendees || []).some((a) => a.user_id === PUBLIC_USER_ID); }

// ===== RENDERIZAÇÃO ORIGINAL RECUPERADA =====
function cardHTML(g) {
  const st = calcStatus(g);
  const rem = remaining(g);
  const isCritical = st === "aberto" && rem > 0 && rem < 5;
  const owner = state.users.find(u => u.id === g.ownerId);
  const isOwner = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  
  const crest = owner && owner.crest ? `<img src="${owner.crest}" alt="Logo">` : `<span>${(g.field || "?")[0]}</span>`;
  const shareMsg = encodeURIComponent(`🎯 Inscrição: ${g.title}\n📅 ${fmtDate(g.date)}\nLink: ${window.location.href}`);

  return `
  <article class="card" data-id="${g.id}">
    <div class="hd" style="background-image:url('assets/img/camo-header.jpg')">
      <span class="badge ${st}">${st}</span>
      ${g.pinned ? `<span class="pin">📌</span>` : ""}
      <div class="crest-lg">${crest}</div>
    </div>
    <div class="body">
      <div class="row" style="margin-bottom: 8px;">
        <strong style="font-size: 16px;">${escapeHtml(g.title)}</strong>
        <div class="spacer"></div>
        <span class="muted" style="font-size: 12px;">${fmtDate(g.date)}</span>
      </div>
      <div class="muted" style="font-size: 13px; margin-bottom: 10px; min-height: 1.2em;">${escapeHtml(g.description || "")}</div>
      <div class="muted" style="font-size: 13px; ${isCritical ? 'color:#b64b4b; font-weight:700;' : ''}">
        ${(g.attendees || []).length}/${g.total_slots} inscritos • ${rem} vagas ${isCritical ? '(ÚLTIMAS!)' : ''}
      </div>
      <div class="btn-row" style="margin-top: 15px;">
        <button class="btn ok" data-action="join" ${st === 'aberto' && !isJoined(g) ? "" : "disabled"}>✅ Entrar</button>
        <button class="btn" data-action="list">📄 Lista</button>
        ${owner && owner.location ? `<button class="btn" data-action="maps" data-loc="${owner.location}" title="Localização">📍</button>` : ""}
        <a href="https://wa.me/?text=${shareMsg}" target="_blank" class="btn" title="Partilhar WhatsApp" style="display: flex; align-items: center; justify-content: center; text-decoration: none;">📱</a>
      </div>
      ${isOwner ? `
      <div class="btn-row admin-controls" style="margin-top:15px; border-top:1px solid #2a322c; padding-top:10px; display: flex; gap: 8px;">
        <button class="btn" data-action="edit" title="Editar" style="padding: 5px 10px;">✏️</button>
        <button class="btn" data-action="pin" title="Fixar" style="padding: 5px 10px;">${g.pinned ? '📍' : '📌'}</button>
        <button class="btn" data-action="export" title="Exportar CSV" style="padding: 5px 10px;">📥</button>
        <button class="btn danger" data-action="delete" title="Apagar" style="padding: 5px 10px;">🗑️</button>
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
  
  list.sort((a, b) => (!!b.pinned - !!a.pinned) || new Date(a.date.replace(' ', 'T')) - new Date(b.date.replace(' ', 'T')));
  grid.innerHTML = list.map(cardHTML).join("") || "<p class='muted' style='grid-column: 1/-1; text-align: center; padding: 40px;'>Nenhum jogo encontrado.</p>";
}

// ===== MODAIS E FORMULÁRIOS =====
function openModal({ title, contentHTML, footerHTML, onMount }) {
  const overlay = $("#overlay");
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3>${title}</h3><button class="icon-btn" id="btnClose">✕</button></div>
      <div class="modal-body">${contentHTML}</div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ""}
    </div>`;
  overlay.hidden = false;
  $("#btnClose").onclick = () => overlay.hidden = true;
  if (onMount) onMount();
}

function openGameModal(game = null) {
  const isEdit = !!game;
  openModal({
    title: isEdit ? "Editar Jogo" : "Criar Jogo",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Título</label><input id="gT" type="text" value="${isEdit ? game.title : ''}" /></div>
        <div class="field"><label>Vagas Totais</label><input id="gS" type="number" value="${isEdit ? game.total_slots : '30'}" /></div>
        <div class="field"><label>Data</label><input id="gD" type="datetime-local" value="${isEdit ? game.date : ''}" /></div>
        <div class="field"><label>Descrição</label><textarea id="gDesc" style="width:100%; min-height:80px; background:#0b0e0c; color:#fff; border-radius:8px; padding:8px; border:1px solid #2a322c;">${isEdit ? game.description : ''}</textarea></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="gSave">${isEdit ? 'Atualizar Dados' : 'Publicar Jogo'}</button>`,
    onMount: () => {
      $("#gSave").onclick = () => {
        if (!$("#gT").value || !$("#gD").value) return TOASTS.show("Título e Data obrigatórios", "error");
        if (isEdit) {
          game.title = $("#gT").value; game.total_slots = Number($("#gS").value);
          game.date = $("#gD").value; game.description = $("#gDesc").value;
        } else {
          state.games.push({ id: uid(), ownerId: state.auth.id, field: state.auth.field, title: $("#gT").value, total_slots: Number($("#gS").value), date: $("#gD").value, description: $("#gDesc").value, attendees: [], pinned: false, status: "open" });
        }
        saveDB({ games: state.games, users: state.users });
        $("#overlay").hidden = true; TOASTS.show("Dados Guardados!");
      };
    }
  });
}

function openJoinModal(g) {
  const saved = JSON.parse(safeStorage.getItem(PLAYER_DATA_KEY) || '{}');
  openModal({
    title: "Inscrição",
    contentHTML: `
      <div class="form">
        <div class="field"><label>Nickname</label><input id="jN" value="${saved.nickname || ''}" /></div>
        <div class="field"><label>Equipa</label><input id="jT" value="${saved.team || ''}" /></div>
        <div class="field"><label>APD</label><input id="jA" value="${saved.apd || ''}" /></div>
        <div class="chk"><input id="jG" type="checkbox" /><span>Aceito os termos GDPR</span></div>
      </div>`,
    footerHTML: `<button class="btn ok" id="jC">Confirmar Inscrição</button>`,
    onMount: () => {
      $("#jC").onclick = () => {
        if(!$("#jG").checked) return TOASTS.show("Aceite os termos", "error");
        const p = { nickname: $("#jN").value, team: $("#jT").value, apd: $("#jA").value, user_id: PUBLIC_USER_ID };
        safeStorage.setItem(PLAYER_DATA_KEY, JSON.stringify(p));
        if (!g.attendees) g.attendees = [];
        g.attendees.push(p); saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true; TOASTS.show("Inscrito!");
      };
    }
  });
}

function openListModal(g) {
  const isPriv = state.auth && (state.auth.id === g.ownerId || state.auth.role === 'admin');
  const header = isPriv ? `<tr><th>#</th><th>Nick</th><th>Equipa</th><th>APD</th></tr>` : `<tr><th>#</th><th>Nickname</th></tr>`;
  const rows = (g.attendees || []).map((a, i) => `<tr><td>${i+1}</td><td>${escapeHtml(a.nickname)}</td>${isPriv ? `<td>${escapeHtml(a.team)}</td><td>${escapeHtml(a.apd)}</td>` : ''}</tr>`).join("");
  openModal({ title: "Inscritos - " + g.title, contentHTML: `<table class="table" style="width:100%; border-collapse: collapse;"><thead>${header}</thead><tbody style="text-align: center;">${rows || '<tr><td colspan="4">Vazio</td></tr>'}</tbody></table>` });
}

// ===== EVENTOS E SESSÃO =====
function syncTopbar() {
  const info = $("#sessionInfo"); if (!info) return;
  if (!state.auth) {
    info.innerHTML = "";
    $$("#btnCreate, #btnUsers").forEach(b => b.hidden = true);
    $("#filterMine")?.remove();
  } else {
    // Adicionado botão de Logout funcional
    info.innerHTML = `
      <span style="font-weight: 700; color: #fff;">${state.auth.username}</span>
      <button class="btn ghost" id="btnLogout" style="padding: 2px 8px; font-size: 11px; margin-left: 8px; background: transparent; border: 1px solid #b64b4b; color: #b64b4b;">Sair</button>
    `;
    $("#btnLogout").onclick = () => { safeStorage.removeItem(AUTH_KEY); location.reload(); };
    $("#btnCreate").hidden = false;
    $("#btnUsers").hidden = state.auth.role !== 'admin';
    if (!$("#filterMine")) {
      const b = document.createElement("button"); b.id = "filterMine"; b.className = "chip"; 
      b.dataset.filter = "mine"; b.textContent = "👤 Meus"; $("#filters").appendChild(b);
    }
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  if (btn.id === "btnAdmin") return openAdminLogin();
  if (btn.id === "btnCreate") return openGameModal();
  if (btn.id === "btnUsers") return openModsModal();
  if (btn.id === "ctaGo") return $("#grid")?.scrollIntoView({ behavior: 'smooth' });
  if (btn.classList.contains("chip")) {
    $$(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active"); state.filter = btn.dataset.filter; render(); return;
  }
  const card = btn.closest(".card"); if (!card) return;
  const g = state.games.find(x => x.id === card.dataset.id);
  const act = btn.dataset.action;
  if (act === "join") openJoinModal(g);
  if (act === "list") openListModal(g);
  if (act === "maps") window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(btn.dataset.loc)}`, '_blank');
  if (act === "edit") openGameModal(g);
  if (act === "pin") { g.pinned = !g.pinned; saveDB({ games: state.games, users: state.users }); }
  if (act === "export") exportCSV(g);
  if (act === "delete" && confirm("Apagar jogo permanentemente?")) { state.games = state.games.filter(x => x.id !== g.id); saveDB({ games: state.games, users: state.users }); }
});

function openAdminLogin() {
  openModal({
    title: "Acesso Restrito",
    contentHTML: `<div class="form"><div class="field"><label>Utilizador</label><input id="aU" /></div><div class="field"><label>Palavra-passe</label><input id="aP" type="password" /></div></div>`,
    footerHTML: `<button class="btn ok" id="aL">Entrar</button>`,
    onMount: () => {
      $("#aL").onclick = () => {
        const u = state.users.find(x => x.username === $("#aU").value && x.password === $("#aP").value);
        if (u) { state.auth = u; safeStorage.setItem(AUTH_KEY, JSON.stringify(u)); location.reload(); } else TOASTS.show("Dados incorretos", "error");
      };
    }
  });
}

function openModsModal() {
  const list = state.users.filter(u => u.role === 'moderator').map(m => `
    <div style="padding:10px; border-bottom:1px solid #2a322c; display: flex; justify-content: space-between; align-items: center;">
      <span><strong>${m.username}</strong> (${m.field})</span>
      <button onclick="delMod('${m.id}')" class="btn danger" style="padding:2px 8px">Remover</button>
    </div>`).join("");
  openModal({
    title: "Gestão de Moderadores",
    contentHTML: `
      <div class="form">
        <h4>Novo Moderador</h4>
        <div class="field"><label>User</label><input id="mU" /></div>
        <div class="field"><label>Pass</label><input id="mP" /></div>
        <div class="field"><label>Campo</label><input id="mF" /></div>
        <div class="field"><label>Google Maps</label><input id="mL" /></div>
        <div class="field"><label>URL Logo</label><input id="mC" /></div>
        <button class="btn ok" id="mS">Criar</button>
        <hr style="margin: 20px 0; border-top: 1px solid #2a322c;">
        <h4>Lista de Moderadores</h4>
        ${list || '<p class="muted">Nenhum moderador.</p>'}
      </div>`,
    onMount: () => {
      $("#mS").onclick = () => {
        state.users.push({ id: uid(), role: 'moderator', username: $("#mU").value, password: $("#mP").value, field: $("#mF").value, location: $("#mL").value, crest: $("#mC").value });
        saveDB({ games: state.games, users: state.users }); $("#overlay").hidden = true; TOASTS.show("Moderador Criado!");
      };
    }
  });
}

window.delMod = (id) => { 
  if(confirm("Remover este moderador?")) {
    state.users = state.users.filter(u => u.id !== id); 
    saveDB({ games: state.games, users: state.users }); 
    $("#overlay").hidden = true; 
  }
};

function exportCSV(g) {
  const h = "Nick,Equipa,APD\n", r = (g.attendees || []).map(a => `${a.nickname},${a.team},${a.apd}`).join("\n");
  const blob = new Blob(["\uFEFF" + h + r], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `lista_${g.title}.csv`; a.click();
}

init();