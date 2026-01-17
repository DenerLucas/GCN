// ===================== GCAN — APP (FULL) =====================

// ===== Utilidades base =====
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
  } catch {
    return iso;
  }
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

// ===== Storage seguro =====
const safeStorage = (() => {
  try {
    const t = "__t__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
})();

// ===== Constantes =====
const STORAGE_KEY = "gcan_games_v4";
const USER_KEY = "gcan_public_user";
const AUTH_KEY = "gcan_auth_v4"; // { role, username, name }

// ===== Utilizador público (para inscrições) =====
const PUBLIC_USER_ID = (() => {
  let id = safeStorage.getItem(USER_KEY);
  if (!id) {
    id = uid();
    safeStorage.setItem(USER_KEY, id);
  }
  return id;
})();

// ===== Auth (demo) =====
// NOTA: isto é protótipo. Quando tiver backend, isto vai mudar.
const DEMO_USERS = [
  { username: "admin", password: "airsoft2025", role: "admin", name: "Admin Global" },
];

function getAuth() {
  try {
    const raw = safeStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function setAuth(a) {
  safeStorage.setItem(AUTH_KEY, JSON.stringify(a));
}
function clearAuth() {
  safeStorage.removeItem(AUTH_KEY);
}

// ===== Mock DB inicial =====
const MockDB = {
  games: [
    {
      id: "g1",
      title: "ARCANJOS",
      description: "Skirmish dominical",
      field: "ARCANJOS",
      crest: null,
      date: "2025-05-18T10:00:00",
      status: "open",
      pinned: true,
      total_slots: 45,
      guests_only: false,
      attendees: [
        { user_id: "u1", nickname: "Airt3st1", team: "", apd: "APD1234", guest: false, gdpr: true },
      ],
      location: { text: "Braga, Portugal" },
    },
    {
      id: "g2",
      title: "STG Night Ops",
      description: "MilSim noturno",
      field: "STG",
      crest: null,
      date: "2025-06-01T22:00:00",
      status: "closed",
      pinned: false,
      total_slots: 30,
      guests_only: false,
      attendees: [],
      location: { text: "Braga" },
    },
  ],
};

function loadDB() {
  try {
    const s = safeStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(MockDB));
  return JSON.parse(JSON.stringify(MockDB));
}
function saveDB(db) {
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ===== State =====
const state = {
  games: [],
  filter: "all",
  search: "",
  auth: getAuth(), // null ou {role,username,name}
};

// ===== Helpers =====
function remaining(g) {
  return g.total_slots - g.attendees.length;
}

function calcStatus(g) {
  if (remaining(g) <= 0) return "lotado";
  return g.status === "closed" ? "fechado" : "aberto";
}

function isJoined(g) {
  return g.attendees.some((a) => a.user_id === PUBLIC_USER_ID);
}

// ===== Modal base (não fecha ao clicar fora) =====
function openModal({ title = "", contentHTML = "", footerHTML = "", onMount = null, className = "" }) {
  const overlay = $("#overlay");
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="modal ${className}">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="icon-btn" data-modal-close aria-label="Fechar">✕</button>
      </div>
      <div class="modal-body">
        ${contentHTML}
      </div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ""}
    </div>
  `;
  overlay.hidden = false;

  // só fecha no X / botão explicitamente marcado
  overlay.addEventListener(
    "click",
    (e) => {
      const closeBtn = e.target.closest("[data-modal-close]");
      if (closeBtn) closeModal();
    },
    { once: true }
  );

  if (typeof onMount === "function") onMount();
}

function closeModal() {
  const overlay = $("#overlay");
  if (!overlay) return;
  overlay.hidden = true;
  overlay.innerHTML = "";
}

// ===== Render =====
function cardHTML(g) {
  const st = calcStatus(g);
  const canJoin = st === "aberto" && !isJoined(g);

  const headerBg = `style="background-image:url('assets/img/camo-header.jpg')"`; // default
  const crest = g.crest
    ? `<img src="${g.crest}" alt="Equipa">`
    : `<span>${(g.field || "?")[0]}</span>`;

  return `
  <article class="card" data-id="${g.id}">
    <div class="hd" ${headerBg}>
      <span class="badge ${st}">${st}</span>
      ${g.pinned ? `<span class="pin">📌</span>` : ""}
      <div class="crest-lg">${crest}</div>
    </div>

    <div class="body">
      <div class="row">
        <strong>${g.title}</strong>
        <div class="spacer"></div>
        <span class="muted">${fmtDate(g.date)}</span>
      </div>

      <div class="muted">${g.description || ""}</div>

      <div class="muted">
        ${g.attendees.length}/${g.total_slots} inscritos • ${remaining(g)} vagas
        ${g.guests_only ? " • <strong>Convidados</strong>" : ""}
      </div>

      <div class="btn-row">
        <button class="btn ok" data-action="join" ${canJoin ? "" : "disabled"}>
          ✅ Entrar (${remaining(g)} vagas)
        </button>

        <button class="btn" data-action="leave" ${isJoined(g) ? "" : "hidden"}>
          ❌ Sair
        </button>

        <button class="btn" data-action="list">📄 Lista</button>
        <button class="btn" data-action="copy">🔗 Copiar link</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const grid = $("#grid");
  if (!grid) return;

  let list = [...state.games];

  // filtro rápido
  if (state.filter !== "all") {
    list = list.filter((g) => {
      if (state.filter === "open") return calcStatus(g) === "aberto";
      if (state.filter === "closed") return calcStatus(g) === "fechado";
      if (state.filter === "lotado") return calcStatus(g) === "lotado";
      if (state.filter === "pinned") return !!g.pinned;
      if (state.filter === "guests") return !!g.guests_only;
      return true;
    });
  }

  // search
  if (state.search) {
    const t = state.search.toLowerCase();
    list = list.filter((g) =>
      (String(g.title) + " " + String(g.description) + " " + String(g.field) + " " + (g.location?.text || ""))
        .toLowerCase()
        .includes(t)
    );
  }

  // sort: pinned primeiro, depois por data
  list.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return new Date(a.date) - new Date(b.date);
  });

  grid.innerHTML = list.map(cardHTML).join("");
}

// ===== Actions =====
function reload() {
  const db = loadDB();
  state.games = db.games || [];
  render();
}

async function copyLink(id) {
  const url = location.href.split("#")[0] + `#game=${id}`;
  try {
    await navigator.clipboard.writeText(url);
    TOASTS.show("Link copiado");
  } catch {
    TOASTS.show("Não foi possível copiar automaticamente.", "error");
  }
}

function openJoinModal(game) {
  openModal({
    title: `Entrar no jogo`,
    contentHTML: `
      <div class="form">
        <div class="field">
          <label>Nickname (opcional)</label>
          <input id="joinNick" type="text" placeholder="Ex: SniperBraga" />
        </div>

        <div class="field">
          <label>Equipa (opcional)</label>
          <input id="joinTeam" type="text" placeholder="Ex: STG / Arcanjos" />
        </div>

        <div class="field inline">
          <label class="chk">
            <input id="joinGuest" type="checkbox" />
            <span>Sou convidado (sem APD)</span>
          </label>
        </div>

        <div class="field">
          <label>Número APD <span class="req">*</span></label>
          <input id="joinAPD" type="text" placeholder="Ex: APD12345" />
          <div class="hint">Se marcar "convidado", o APD deixa de ser obrigatório.</div>
        </div>

        <div class="field inline">
          <label class="chk">
            <input id="joinGDPR" type="checkbox" />
            <span>Concordo com o tratamento de dados (GDPR) <span class="req">*</span></span>
          </label>
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn" data-modal-close>Cancelar</button>
      <button class="btn ok" id="btnJoinConfirm">Confirmar</button>
    `,
    onMount: () => {
      const guest = $("#joinGuest");
      const apd = $("#joinAPD");
      const confirm = $("#btnJoinConfirm");

      const syncAPD = () => {
        const isGuest = !!guest.checked;
        apd.disabled = isGuest;
        apd.placeholder = isGuest ? "Convidado (sem APD)" : "Ex: APD12345";
      };

      guest.addEventListener("change", syncAPD);
      syncAPD();

      confirm.addEventListener("click", () => {
        const nickname = ($("#joinNick").value || "").trim();
        const team = ($("#joinTeam").value || "").trim();
        const isGuest = !!$("#joinGuest").checked;
        const apdVal = ($("#joinAPD").value || "").trim();
        const gdpr = !!$("#joinGDPR").checked;

        if (!gdpr) return TOASTS.show("Tens de aceitar o GDPR para entrar.", "error");

        if (!isGuest && apdVal.length < 3) {
          return TOASTS.show("Número APD é obrigatório (ou marca 'convidado').", "error");
        }

        if (game.guests_only && !isGuest) {
          return TOASTS.show("Este jogo está marcado como 'Só Convidados'.", "error");
        }

        if (calcStatus(game) !== "aberto") {
          return TOASTS.show("Este jogo não está aberto.", "error");
        }

        if (isJoined(game)) {
          return TOASTS.show("Já estás inscrito.", "error");
        }

        game.attendees.push({
          user_id: PUBLIC_USER_ID,
          nickname: nickname || "",
          team: team || "",
          apd: isGuest ? "" : apdVal,
          guest: isGuest,
          gdpr: gdpr,
        });

        saveDB({ games: state.games });
        closeModal();
        TOASTS.show("Inscrição efetuada ✅");
        render();
      });
    },
  });
}

function openAdminModal() {
  openModal({
    title: "Admin",
    contentHTML: `
      <div class="form">
        <div class="field">
          <label>Utilizador</label>
          <input id="admUser" type="text" placeholder="admin" autocomplete="username" />
        </div>
        <div class="field">
          <label>Senha</label>
          <input id="admPass" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div class="hint">(demo) admin / airsoft2025</div>
      </div>
    `,
    footerHTML: `
      <button class="btn" data-modal-close>Cancelar</button>
      <button class="btn ok" id="btnAdminLogin">Entrar</button>
    `,
    onMount: () => {
      const u = $("#admUser");
      const p = $("#admPass");
      const btn = $("#btnAdminLogin");

      btn.addEventListener("click", () => {
        const username = (u.value || "").trim();
        const password = (p.value || "").trim();

        const found = DEMO_USERS.find((x) => x.username === username && x.password === password);
        if (!found) return TOASTS.show("Credenciais inválidas.", "error");

        state.auth = { role: found.role, username: found.username, name: found.name };
        setAuth(state.auth);
        closeModal();
        TOASTS.show(`Sessão iniciada: ${found.username} (${found.role})`);

        // mostra botões de admin (se existirem no HTML)
        syncTopbar();
      });
    },
  });
}

// ===================== ADMIN: CRIAR JOGO =====================
function openCreateGameModal() {
  if (!state.auth || state.auth.role !== "admin") {
    TOASTS.show("Apenas admin pode criar jogos.", "error");
    return;
  }

  openModal({
    title: "Criar Jogo",
    contentHTML: `
      <div class="form">
        <div class="field">
          <label>Título *</label>
          <input id="cgTitle" type="text" placeholder="Ex: STG 14 Dezembro" />
        </div>

        <div class="field">
          <label>Campo *</label>
          <input id="cgField" type="text" placeholder="Ex: STG / Arcanjos / ..." />
        </div>

        <div class="field">
          <label>Data e hora *</label>
          <input id="cgDate" type="datetime-local" />
        </div>

        <div class="field">
          <label>Vagas totais *</label>
          <input id="cgSlots" type="number" min="1" value="20" />
        </div>

        <div class="field">
          <label>Descrição</label>
          <input id="cgDesc" type="text" placeholder="Ex: Skirmish 5x5 / MilSim..." />
        </div>

        <div class="field inline">
          <label class="chk">
            <input id="cgGuestsOnly" type="checkbox" />
            <span>Só Convidados</span>
          </label>
        </div>

        <div class="field inline">
          <label class="chk">
            <input id="cgPinned" type="checkbox" />
            <span>Fixado</span>
          </label>
        </div>
      </div>
    `,
    footerHTML: `
      <button class="btn" data-modal-close>Cancelar</button>
      <button class="btn ok" id="cgSave">Criar</button>
    `,
    onMount: () => {
            // Limites de data (UI)
      const dt = $("#cgDate");
      if (dt) {
        const pad = (n) => String(n).padStart(2, "0");
        const toLocalInputValue = (d) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

        const now = new Date();
        now.setSeconds(0, 0); // datetime-local não usa segundos

        const max = new Date(now);
        max.setMonth(max.getMonth() + 18); // +18 meses (ajusta se quiseres)

        dt.min = toLocalInputValue(now);
        dt.max = toLocalInputValue(max);

        // Ajuda: pré-preencher com +7 dias à mesma hora
        const def = new Date(now);
        def.setDate(def.getDate() + 7);
        dt.value = toLocalInputValue(def);
      }

      $("#cgSave").addEventListener("click", () => {
        const title = ($("#cgTitle").value || "").trim();
        const field = ($("#cgField").value || "").trim();
        const date = $("#cgDate").value;
        const total = Number($("#cgSlots").value || 0);
        const desc = ($("#cgDesc").value || "").trim();
        const guestsOnly = !!$("#cgGuestsOnly").checked;
        const pinned = !!$("#cgPinned").checked;

        if (!title || !field || !date || !total || total < 1) {
          TOASTS.show("Preenche os campos obrigatórios (*).", "error");
          return;
        }
        // Validação de data (real)
        const selected = new Date(date);
        if (Number.isNaN(selected.getTime())) {
          TOASTS.show("Data inválida.", "error");
          return;
        }

        const now = new Date();
        now.setSeconds(0, 0);

        const max = new Date(now);
        max.setMonth(max.getMonth() + 18);

        if (selected < now) {
          TOASTS.show("Não é possível criar jogos no passado.", "error");
          return;
        }

        if (selected > max) {
          TOASTS.show("Data demasiado no futuro (máx. +18 meses).", "error");
          return;
        }

        const g = {
          id: uid(),
          title,
          field,
          date,                // datetime-local já vem em formato ISO local
          description: desc,
          status: "open",
          pinned,
          total_slots: total,
          guests_only: guestsOnly,
          crest: null,
          attendees: [],
          location: { text: "Braga, Portugal" },
        };

        state.games.push(g);
        saveDB({ games: state.games });
        closeModal();
        TOASTS.show("Jogo criado ✅");
        render();
      });
    },
  });
}

// ===================== ADMIN: MODERADORES (DEMO) =====================
function openModeratorsModal() {
  if (!state.auth || state.auth.role !== "admin") {
    TOASTS.show("Apenas admin pode gerir moderadores.", "error");
    return;
  }

  openModal({
    title: "Moderadores",
    contentHTML: `
      <div class="muted" style="margin-bottom:10px">
        (Protótipo) Nesta versão estática, isto é apenas uma prévia. No backend vai existir criação/remoção real.
      </div>

      <div class="form">
        <div class="field">
          <label>Novo moderador (email ou utilizador)</label>
          <input id="modNew" type="text" placeholder="Ex: stg@campo.pt" />
        </div>
      </div>

      <div style="margin-top:14px" class="muted">
        👉 Próximo passo (backend): guardar moderadores + limitar edição aos jogos do próprio moderador.
      </div>
    `,
    footerHTML: `
      <button class="btn" data-modal-close>Fechar</button>
      <button class="btn ok" id="modAdd">Simular Adição</button>
    `,
    onMount: () => {
      $("#modAdd").addEventListener("click", () => {
        const v = ($("#modNew").value || "").trim();
        if (!v) return TOASTS.show("Escreve um utilizador/email.", "error");
        TOASTS.show(`(Demo) Moderador adicionado: ${v}`);
        $("#modNew").value = "";
      });
    },
  });
}

// ===================== ADMIN: LOGS (DEMO) =====================
function openLogsModal() {
  if (!state.auth || state.auth.role !== "admin") {
    TOASTS.show("Apenas admin pode ver logs.", "error");
    return;
  }

  // Versão estática: logs simples "fakes" só para UI
  const lines = [
    `[${new Date().toLocaleString("pt-PT")}] Admin abriu painel`,
    `[${new Date().toLocaleString("pt-PT")}] (Demo) Logs ainda não persistem sem backend`,
  ].join("\n");

  openModal({
    title: "Logs",
    contentHTML: `<pre class="pre">${lines}</pre>`,
    footerHTML: `<button class="btn ok" data-modal-close>Fechar</button>`,
  });
}
function syncTopbar() {
  const info = $("#sessionInfo");
  const btnCreate = $("#btnCreate");
  const btnUsers = $("#btnUsers");
  const btnLogs = $("#btnLogs");

  if (!info) return;

  if (!state.auth) {
    info.textContent = "";
    if (btnCreate) btnCreate.hidden = true;
    if (btnUsers) btnUsers.hidden = true;
    if (btnLogs) btnLogs.hidden = true;
    return;
  }

  info.textContent = `Sessão: ${state.auth.username} (${state.auth.role})`;
  if (btnCreate) btnCreate.hidden = state.auth.role !== "admin";
  if (btnUsers) btnUsers.hidden = state.auth.role !== "admin";
  if (btnLogs) btnLogs.hidden = state.auth.role !== "admin";
}

// ===== Eventos globais =====
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  // CTA
  if (btn.id === "ctaGo") {
    $("#grid")?.scrollIntoView({ behavior: "smooth" });
    return;
  }

  // Admin
  if (btn.id === "btnAdmin") {
    openAdminModal();
    return;
  }
    // Criar Jogo (admin)
  if (btn.id === "btnCreate") {
    openCreateGameModal();
    return;
  }

  // Moderadores (admin)
  if (btn.id === "btnUsers") {
    openModeratorsModal();
    return;
  }

  // Logs (admin)
  if (btn.id === "btnLogs") {
    openLogsModal();
    return;
  }

  // chips
  if (btn.classList.contains("chip")) {
    $$(".chip").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter || "all";
    render();
    return;
  }

  // ações dentro de cards
  const card = btn.closest(".card");
  if (!card) return;

  const id = card.dataset.id;
  const g = state.games.find((x) => x.id === id);
  if (!g) return;

  const action = btn.dataset.action;

  if (action === "copy") {
    copyLink(id);
    return;
  }

  if (action === "join") {
    // abre modal (não inscreve automaticamente)
    openJoinModal(g);
    return;
  }

  if (action === "leave") {
    g.attendees = g.attendees.filter((a) => a.user_id !== PUBLIC_USER_ID);
    saveDB({ games: state.games });
    TOASTS.show("Inscrição removida");
    render();
    return;
  }

  if (action === "list") {
    const names = g.attendees.map((a, i) => `${i + 1}. ${a.nickname || "(sem nick)"} ${a.guest ? "(convidado)" : ""}`).join("\n");
    openModal({
      title: `Lista — ${g.title}`,
      contentHTML: `<pre class="pre">${names || "Sem inscritos ainda."}</pre>`,
      footerHTML: `<button class="btn ok" data-modal-close>Fechar</button>`,
    });
    return;
  }
});

const searchEl = $("#search");
if (searchEl) {
  searchEl.addEventListener("input", (e) => {
    state.search = e.target.value || "";
    render();
  });
}

// ===== Init =====
syncTopbar();
reload();
