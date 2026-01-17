/* =========================================================
   GCAN — app.js (FULL)
   - Admin login + modais + inscrição com dados
   - CRUD jogos (admin/mod)
   - Moderadores + Logs (admin)
   - Templates auto-injetados se não existirem no index.html
========================================================= */

/* ===================== UTIL / BASE ===================== */
(function(){
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function uid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r = Math.random()*16|0;
    const v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function fmtDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString('pt-PT',{dateStyle:'medium',timeStyle:'short'});
  }catch{
    return iso;
  }
}

function svgPlaceholder(title){
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'>
      <defs>
        <linearGradient id='g' x1='0' x2='1'>
          <stop offset='0' stop-color='#1a221c'/>
          <stop offset='1' stop-color='#2a3a2f'/>
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <text x='50%' y='52%' fill='#dcebd0' font-size='64'
        font-family='system-ui' font-weight='800'
        dominant-baseline='middle' text-anchor='middle'>${title||'GCAN'}</text>
    </svg>`
  )}`;
}

/* ===================== Toasts ===================== */
const TOASTS = {
  el: null,
  ensure(){
    if (!this.el){
      this.el = document.querySelector('.toasts');
      if (!this.el){
        this.el = document.createElement('div');
        this.el.className = 'toasts';
        document.body.appendChild(this.el);
      }
    }
  },
  show(msg, type='ok', ms=2800){
    this.ensure();
    const n = document.createElement('div');
    n.className = 'toast' + (type==='error'?' error':'');
    n.innerHTML = `<span>${msg}</span><button class="btn ghost" aria-label="Fechar">✖️</button>`;
    n.querySelector('button').onclick = ()=> n.remove();
    this.el.appendChild(n);
    setTimeout(()=>n.remove(), ms);
  }
};

/* ===================== Storage safe ===================== */
const safeStorage = (() => {
  try{
    const t='__t__';
    localStorage.setItem(t,'1');
    localStorage.removeItem(t);
    return localStorage;
  }catch{
    const m=new Map();
    return {
      getItem:k=>m.has(k)?m.get(k):null,
      setItem:(k,v)=>m.set(k,String(v)),
      removeItem:k=>m.delete(k)
    };
  }
})();

/* ===================== KEYS / CONST ===================== */
const STORAGE_KEY     = 'gcan_games_v4';
const USERS_KEY       = 'gcan_users_v1';
const AUDIT_KEY       = 'gcan_audit_v1';
const USER_KEY        = 'gcan_public_user';
const PROFILE_KEY     = 'gcan_profile_v1';

const AUTH_TOKEN_KEY  = 'gcan_token';
const AUTH_ROLE_KEY   = 'gcan_role';
const AUTH_NAME_KEY   = 'gcan_user';
const AUTH_FIELD_KEY  = 'gcan_field';

/* ===================== Public user id ===================== */
const PUBLIC_USER_ID = (() => {
  let id = safeStorage.getItem(USER_KEY);
  if(!id){
    id = uid();
    safeStorage.setItem(USER_KEY,id);
  }
  return id;
})();

/* ===================== Seed Users ===================== */
function seedUsers(){
  let u = null;
  try{ u = JSON.parse(safeStorage.getItem(USERS_KEY) || 'null'); }catch{ u=null; }
  if(!u){
    u = [
      { username:'admin',   password:'airsoft2025', role:'admin',     field:null, display:'Administrador', field_crest:null },
      { username:'mod_stg', password:'mod2025',    role:'moderator', field:'STG', display:'Moderador STG', field_crest:null }
    ];
    safeStorage.setItem(USERS_KEY, JSON.stringify(u));
  }
}
seedUsers();

function loadUsers(){ try{ return JSON.parse(safeStorage.getItem(USERS_KEY)||'[]'); }catch{ return []; } }
function saveUsers(arr){ safeStorage.setItem(USERS_KEY, JSON.stringify(arr)); }
function getCurrentUser(){
  const name = safeStorage.getItem(AUTH_NAME_KEY);
  return loadUsers().find(u=>u.username===name) || null;
}

/* ===================== Audit ===================== */
function audit(entry){
  const arr = JSON.parse(safeStorage.getItem(AUDIT_KEY)||'[]');
  arr.push({ ts:new Date().toISOString(), ...entry });
  safeStorage.setItem(AUDIT_KEY, JSON.stringify(arr));
}

/* ===================== Mock DB ===================== */
const MockDB = {
  games: [
    {
      id:'g_100',
      title:'ARCANJOS',
      description:'Skirmish dominical',
      location:{text:'Braga, Portugal',lat:41.545,lng:-8.426},
      date:'2025-05-18T09:00:00Z',
      status:'open',
      total_slots:45,
      attendees:[{user_id:'u_1',nickname:'Airt3st1',team:null,apd:'APD1001',guest:false}],
      image:null,
      pinned:true,
      field:'ARCANJOS',
      owner_id:'admin',
      crest:null
    },
    {
      id:'g_101',
      title:'STG Night Ops',
      description:'MilSim noturno',
      location:{text:'Braga',lat:null,lng:null},
      date:'2025-06-01T21:00:00Z',
      status:'closed',
      total_slots:30,
      attendees:[],
      image:null,
      pinned:false,
      field:'STG',
      owner_id:'mod_stg',
      crest:null
    }
  ]
};

function loadDB(){
  try{
    const s = safeStorage.getItem(STORAGE_KEY);
    if(s) return JSON.parse(s);
  }catch{}
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(MockDB));
  return JSON.parse(JSON.stringify(MockDB));
}
function saveDB(db){
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/* ===================== mockApi ===================== */
const mockApi = {
  async request(method, path, body){
    await new Promise(r=>setTimeout(r, 120 + Math.random()*200));
    const db = loadDB();
    const seg = path.split('/').filter(Boolean);

    const role = safeStorage.getItem(AUTH_ROLE_KEY) || null;
    const actor = safeStorage.getItem(AUTH_NAME_KEY) || null;
    const actorField = safeStorage.getItem(AUTH_FIELD_KEY) || null;

    // Auth
    if(method==='POST' && seg[0]==='auth' && seg[1]==='login'){
      const users = loadUsers();
      const found = users.find(u => u.username===body?.username && u.password===body?.password);
      if(!found) throw new Error('UNAUTHORIZED');

      safeStorage.setItem(AUTH_TOKEN_KEY,'1');
      safeStorage.setItem(AUTH_ROLE_KEY,found.role);
      safeStorage.setItem(AUTH_NAME_KEY,found.username);
      safeStorage.setItem(AUTH_FIELD_KEY,found.field || '');

      audit({ actor:{user:found.username,role:found.role}, action:'AUTH_LOGIN' });
      return { token:'ok', role:found.role, username:found.username, field:found.field||null };
    }

    if(method==='POST' && seg[0]==='auth' && seg[1]==='logout'){
      audit({ actor:{user:actor,role}, action:'AUTH_LOGOUT' });
      safeStorage.removeItem(AUTH_TOKEN_KEY);
      safeStorage.removeItem(AUTH_ROLE_KEY);
      safeStorage.removeItem(AUTH_NAME_KEY);
      safeStorage.removeItem(AUTH_FIELD_KEY);
      return { ok:true };
    }

    // Users (admin only)
    if(seg[0]==='users' && method==='GET'){
      if(role!=='admin') throw new Error('FORBIDDEN');
      return loadUsers();
    }
    if(seg[0]==='users' && method==='POST'){
      if(role!=='admin') throw new Error('FORBIDDEN');
      const users = loadUsers();
      if(users.some(u=>u.username===body.username)) throw new Error('USER_EXISTS');
      const nu = {
        username: body.username,
        password: body.password,
        role: 'moderator',
        field: body.field || null,
        display: body.username,
        field_crest: body.field_crest || null
      };
      users.push(nu);
      saveUsers(users);
      audit({ actor:{user:actor,role}, action:'USER_CREATE', meta:{username:nu.username,field:nu.field} });
      return nu;
    }

    // Games
    if(method==='GET' && seg[0]==='games' && seg.length===1){
      return JSON.parse(JSON.stringify(db.games));
    }

    if(method==='GET' && seg[0]==='games' && seg.length===2){
      const g = db.games.find(x=>x.id===seg[1]);
      if(!g) throw new Error('404');
      return JSON.parse(JSON.stringify(g));
    }

    if(method==='GET' && seg[0]==='games' && seg[2]==='attendees'){
      const g = db.games.find(x=>x.id===seg[1]);
      if(!g) throw new Error('404');
      return JSON.parse(JSON.stringify(g.attendees));
    }

    if(method==='POST' && seg[0]==='games' && seg.length===1){
      if(role!=='admin' && role!=='moderator') throw new Error('FORBIDDEN');

      const id = 'g_' + Math.floor(Math.random()*1e9);
      const owner = role==='moderator' ? (actor||'mod') : 'admin';

      // herdar brasão do moderador se não vier no body
      let crestBody = body?.crest || null;
      if(role==='moderator' && !crestBody){
        crestBody = getCurrentUser()?.field_crest || null;
      }

      const g = {
        id,
        title:(body.title||'Sem nome').trim(),
        description:(body.description||'').trim(),
        location: body.location || {text:'Braga, Portugal',lat:null,lng:null},
        date: body.date,
        status: body.status || 'open',
        total_slots: Math.max(1, Number(body.total_slots||1)),
        attendees: [],
        image: body.image || null,
        crest: crestBody,
        pinned: !!body.pinned,
        field: (role==='moderator' ? (actorField||body.field||'') : (body.field||'')),
        owner_id: owner
      };

      db.games.push(g);
      saveDB(db);
      audit({ actor:{user:actor,role}, action:'GAME_CREATE', game_id:g.id, meta:{title:g.title,field:g.field} });
      return g;
    }

    if(method==='PATCH' && seg[0]==='games' && seg.length===2){
      const g = db.games.find(x=>x.id===seg[1]);
      if(!g) throw new Error('404');

      if(role==='moderator' && g.owner_id!==actor) throw new Error('FORBIDDEN');
      if(role!=='admin' && role!=='moderator') throw new Error('FORBIDDEN');

      if(typeof body.total_slots!=='undefined' && Number(body.total_slots)<g.attendees.length){
        throw new Error('INVALID_SLOTS');
      }

      Object.assign(g, body);
      saveDB(db);
      audit({ actor:{user:actor,role}, action:'GAME_PATCH', game_id:g.id, meta:body });
      return g;
    }

    if(method==='DELETE' && seg[0]==='games' && seg.length===2){
      const i = db.games.findIndex(x=>x.id===seg[1]);
      if(i<0) throw new Error('404');
      const g = db.games[i];

      if(role==='moderator' && g.owner_id!==actor) throw new Error('FORBIDDEN');
      if(role!=='admin') throw new Error('FORBIDDEN');

      db.games.splice(i,1);
      saveDB(db);
      audit({ actor:{user:actor,role}, action:'GAME_DELETE', game_id:g.id });
      return {ok:true};
    }

    if(method==='POST' && seg[0]==='games' && seg[2]==='join'){
      const g = db.games.find(x=>x.id===seg[1]);
      if(!g) throw new Error('404');

      const already = g.attendees.some(a=>a.user_id===body.user_id);
      const remaining = g.total_slots - g.attendees.length;

      if(already) throw new Error('ALREADY');
      if(g.status==='closed') throw new Error('CLOSED');
      if(remaining<=0) throw new Error('FULL');

      g.attendees.push({
        user_id: body.user_id,
        nickname: body.nickname||null,
        team: body.team||null,
        apd: body.guest ? null : (body.apd??null),
        guest: !!body.guest
      });

      saveDB(db);
      audit({ actor:{user:body.user_id,role:'user'}, action:'JOIN', game_id:g.id });
      return g;
    }

    if(method==='POST' && seg[0]==='games' && seg[2]==='leave'){
      const g = db.games.find(x=>x.id===seg[1]);
      if(!g) throw new Error('404');

      const before = g.attendees.length;
      g.attendees = g.attendees.filter(a=>a.user_id!==body.user_id);
      if(g.attendees.length===before) throw new Error('NOT_JOINED');

      saveDB(db);
      audit({ actor:{user:body.user_id,role:'user'}, action:'LEAVE', game_id:g.id });
      return g;
    }

    if(method==='GET' && seg[0]==='logs'){
      if(role!=='admin') throw new Error('FORBIDDEN');
      return JSON.parse(safeStorage.getItem(AUDIT_KEY)||'[]');
    }

    throw new Error('Not Implemented');
  }
};

/* ===================== Crest helpers ===================== */
function initials(str){
  if(!str) return '??';
  const parts = String(str).trim().split(/\s+/).slice(0,2);
  const t = parts.map(p=>p[0]?.toUpperCase()||'').join('');
  return t || '??';
}
function crestHeaderHTML(g){
  const alt = g.field ? `Brasão do campo ${g.field}` : 'Brasão do campo';
  if(g.crest) return `<div class="crest-lg" title="${alt}"><img src="${g.crest}" alt="${alt}" onerror="this.remove()"></div>`;
  return `<div class="crest-lg" title="${alt}"><div class="crest-lg--fallback">${initials(g.field||g.title)}</div></div>`;
}

/* ===================== State ===================== */
const state = {
  role: safeStorage.getItem(AUTH_ROLE_KEY),
  username: safeStorage.getItem(AUTH_NAME_KEY),
  field: safeStorage.getItem(AUTH_FIELD_KEY) || '',
  user_id: PUBLIC_USER_ID,
  games: [],
  filterText: '',
  filterKey: 'all'
};

function canManage(g){
  if(state.role==='admin') return true;
  if(state.role==='moderator' && g.owner_id===state.username) return true;
  return false;
}

/* ===================== Templates injection (se faltarem) ===================== */
function ensureTemplate(id, html){
  if(document.getElementById(id)) return;
  const t = document.createElement('template');
  t.id = id;
  t.innerHTML = html;
  document.body.appendChild(t);
}

function ensureOverlay(){
  if(!document.getElementById('overlay')){
    const ov = document.createElement('div');
    ov.id = 'overlay';
    ov.className = 'overlay';
    ov.hidden = true;
    document.body.appendChild(ov);
  }
}

function injectTemplatesIfMissing(){
  ensureOverlay();

  ensureTemplate('tpl-login', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Admin">
      <div class="modal-hd">
        <strong>Admin</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd">
        <label class="lbl">Utilizador</label>
        <input id="lg_user" class="input" autocomplete="username" placeholder="admin / mod_stg" />
        <label class="lbl">Senha</label>
        <input id="lg_pass" class="input" type="password" autocomplete="current-password" placeholder="airsoft2025 / mod2025" />
        <p class="muted" style="margin-top:10px">
          Demo: <code>admin / airsoft2025</code> • <code>mod_stg / mod2025</code>
        </p>
      </div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Cancelar</button>
        <button id="confirmLogin" class="btn ok">Entrar</button>
      </div>
    </div>
  `);

  ensureTemplate('tpl-join', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Inscrever">
      <div class="modal-hd">
        <strong>Inscrição no jogo</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd">
        <input type="hidden" id="joinGameId">
        <label class="lbl">Nickname</label>
        <input id="nickname" class="input" placeholder="Ex: Ghost" maxlength="40" />
        <label class="lbl">Equipa (opcional)</label>
        <input id="team" class="input" placeholder="Ex: Alpha" maxlength="40" />
        <div style="display:flex; gap:10px; align-items:center; margin-top:12px;">
          <label style="display:flex; gap:8px; align-items:center;">
            <input id="guest" type="checkbox"> Convidado
          </label>
          <div style="flex:1"></div>
        </div>
        <label class="lbl" style="margin-top:10px;">APD (obrigatório se não for convidado)</label>
        <input id="apd" class="input" placeholder="Ex: APD1234" maxlength="20" />
        <label style="display:flex; gap:8px; align-items:center; margin-top:12px;">
          <input id="consent" type="checkbox"> Aceita que o registo fique guardado localmente para esta demo
        </label>
        <label style="display:flex; gap:8px; align-items:center; margin-top:10px;">
          <input id="rememberMe" type="checkbox"> Memorizar dados neste dispositivo
        </label>
      </div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Cancelar</button>
        <button id="confirmJoin" class="btn ok">Confirmar inscrição</button>
      </div>
    </div>
  `);

  ensureTemplate('tpl-leave', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Sair">
      <div class="modal-hd">
        <strong>Remover inscrição</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd">
        <input type="hidden" id="leaveGameId">
        <p>Tem a certeza que quer sair deste jogo?</p>
      </div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Cancelar</button>
        <button id="confirmLeave" class="btn danger">Sair</button>
      </div>
    </div>
  `);

  ensureTemplate('tpl-list', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Lista">
      <div class="modal-hd">
        <strong>Lista rápida</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd" id="listContent" style="max-height:50vh; overflow:auto;"></div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Fechar</button>
        <button id="btnPrintList" class="btn">🖨️ Imprimir</button>
      </div>
    </div>
  `);

  ensureTemplate('tpl-upsert', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Criar/Editar jogo">
      <div class="modal-hd">
        <strong id="upsertTitle">Criar Jogo</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd">
        <input type="hidden" id="u_id">
        <label class="lbl">Título</label>
        <input id="u_title" class="input" placeholder="Ex: STG CQB" />
        <label class="lbl">Descrição</label>
        <input id="u_desc" class="input" placeholder="Ex: Treino CQB 9x9x9" />
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <label class="lbl">Data/Hora</label>
            <input id="u_date" class="input" type="datetime-local" />
          </div>
          <div>
            <label class="lbl">Vagas</label>
            <input id="u_total" class="input" type="number" min="1" value="20" />
          </div>
        </div>
        <label class="lbl" style="margin-top:10px;">Local (texto)</label>
        <input id="u_loc" class="input" placeholder="Braga, Portugal" />
        <label class="lbl" style="margin-top:10px;">Coords (opcional: lat,lng)</label>
        <input id="u_coords" class="input" placeholder="41.545,-8.426" />
        <label class="lbl" style="margin-top:10px;">Imagem de fundo (URL opcional)</label>
        <input id="u_img" class="input" placeholder="https://..." />
        <label class="lbl" style="margin-top:10px;">Brasão do campo (URL opcional)</label>
        <input id="u_crest" class="input" placeholder="https://..." />
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <div>
            <label class="lbl">Estado</label>
            <select id="u_status" class="input">
              <option value="open">Aberto</option>
              <option value="closed">Fechado</option>
            </select>
          </div>
          <div>
            <label class="lbl">Campo</label>
            <input id="u_field" class="input" placeholder="Ex: STG" />
          </div>
        </div>
        <label style="display:flex; gap:8px; align-items:center; margin-top:12px;">
          <input id="u_pinned" type="checkbox"> Fixar jogo
        </label>
      </div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Cancelar</button>
        <button id="confirmUpsert" class="btn ok">Guardar</button>
      </div>
    </div>
  `);

  ensureTemplate('tpl-users', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Moderadores">
      <div class="modal-hd">
        <strong>Moderadores</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd">
        <div id="usersList"></div>
        <hr style="opacity:.2; margin:14px 0;">
        <strong>Criar moderador</strong>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <input id="nu_user" class="input" placeholder="username" />
          <input id="nu_pass" class="input" placeholder="senha" />
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <input id="nu_field" class="input" placeholder="campo (ex: STG)" />
          <input id="nu_crest" class="input" placeholder="url do brasão (opcional)" />
        </div>
      </div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Fechar</button>
        <button id="btnCreateUser" class="btn ok">Criar</button>
      </div>
    </div>
  `);

  ensureTemplate('tpl-logs', `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Logs">
      <div class="modal-hd">
        <strong>Logs</strong>
        <button class="btn ghost" data-close>✖️</button>
      </div>
      <div class="modal-bd" id="logsContent" style="max-height:55vh; overflow:auto;"></div>
      <div class="modal-ft">
        <button class="btn secondary" data-close>Fechar</button>
      </div>
    </div>
  `);
}
injectTemplatesIfMissing();

/* ===================== Overlays / Modais ===================== */
let _escHandler = null;

function onCloseOutside(e){
  const ov = $('#overlay');
  if(e.target.id==='overlay' && ov.dataset.outsideClose==='1'){
    closeModal();
  }
}

function openModal(tplId, opts={}){
  const { outsideClose=true, escClose=true } = opts;
  const ov = $('#overlay');
  const tpl = document.getElementById(tplId);

  if(!ov || !tpl){
    TOASTS.show('Erro: modal não encontrado ('+tplId+').','error',4500);
    return;
  }

  ov.innerHTML = '';
  ov.appendChild(tpl.content.cloneNode(true));
  ov.hidden = false;

  ov.dataset.outsideClose = outsideClose ? '1' : '0';
  ov.dataset.escClose = escClose ? '1' : '0';

  if(outsideClose) ov.addEventListener('click', onCloseOutside);

  _escHandler = (e)=>{
    if(e.key==='Escape' && $('#overlay').dataset.escClose==='1') closeModal();
  };
  document.addEventListener('keydown', _escHandler);

  ov.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', closeModal));
}

function closeModal(){
  const ov = $('#overlay');
  if(!ov) return;
  ov.hidden = true;
  ov.innerHTML = '';
  ov.removeEventListener('click', onCloseOutside);
  delete ov.dataset.outsideClose;
  delete ov.dataset.escClose;

  if(_escHandler){
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }
}

/* ===================== Render helpers ===================== */
function calcStatus(g){
  const remaining = g.total_slots - g.attendees.length;
  if(remaining<=0) return 'lotado';
  return g.status==='closed' ? 'fechado' : 'aberto';
}
function progressHTML(g){
  const used = g.attendees.length;
  const pct = Math.min(100, Math.round(used/Math.max(1,g.total_slots)*100));
  return `<div class="progress"><span style="width:${pct}%"></span></div>`;
}
function orderGames(list){
  return list.slice().sort((a,b)=> (a.pinned===b.pinned ? (new Date(a.date)-new Date(b.date)) : (a.pinned?-1:1)));
}

function cardHTML(g){
  const remaining = g.total_slots - g.attendees.length;
  const st = calcStatus(g);

  const joined = g.attendees.some(a=>a.user_id===state.user_id);
  const canJoin = (st==='aberto' && remaining>0 && !joined);

  const badgeCls = st==='lotado'?'badge lotado':(st==='fechado'?'badge fechado':'badge');
  const img = g.image || svgPlaceholder(g.title);
  const _canManage = canManage(g);

  return `
  <article class="card" data-id="${g.id}">
    <div class="hd">
      <span class="${badgeCls}">${st==='aberto'?'Aberto':st==='lotado'?'Lotado':'Fechado'}</span>
      ${g.pinned?`<span class="pin" title="Fixado">📌</span>`:''}
      <img class="hero-img" src="${img}" alt="" aria-hidden="true" onerror="this.style.display='none'">
      ${crestHeaderHTML(g)}
    </div>

    <div class="body">
      <div class="row">
        <strong>${g.title}</strong>
        ${g.field?`<span class="tag" title="Campo">${g.field}</span>`:''}
        ${joined?`<span class="tag" title="Já inscrito">Inscrito</span>`:''}
        <div class="spacer"></div>
        <span class="muted">${fmtDate(g.date)}</span>
      </div>

      <div class="muted">${g.description||''}</div>

      <div class="meta">
        <div><strong>${g.attendees.length}/${g.total_slots}</strong> inscritos • ${remaining} vagas • ${g.location?.text||''}</div>
        ${progressHTML(g)}
      </div>

      <div class="btn-row">
        <button class="btn ok" data-action="join" ${canJoin?'':'disabled'}>✅ Entrar (${remaining} vagas)</button>
        <button class="btn secondary" data-action="leave" ${joined?'':'hidden'}>❌ Sair</button>
        <button class="btn secondary full" data-action="quick">📄 Lista Rápida</button>
        <button class="btn secondary" data-action="copy">🔗 Copiar link</button>
      </div>

      <div class="admin-row" ${_canManage?'':'hidden'}>
        <button class="btn" data-action="edit">✏️ Editar</button>
        <button class="btn" data-action="toggle">${g.status==='open'?'🚪 Fechar':'🚪 Abrir'}</button>
        <button class="btn" data-action="pin">${g.pinned?'📌 Desafixar':'📌 Fixar'}</button>
        <button class="btn danger" data-action="delete" ${state.role==='admin'?'':'hidden'}>🗑️ Eliminar</button>
      </div>
    </div>
  </article>`;
}

function render(){
  const grid = $('#grid');
  if(!grid) return;

  grid.innerHTML = orderGames(state.games).map(cardHTML).join('');
  applyFilterToCards();
}

function applyFilterToCards(){
  const text = (state.filterText||'').toLowerCase();
  $$('#grid .card').forEach(card=>{
    const id = card.getAttribute('data-id');
    const g = state.games.find(x=>x.id===id);
    if(!g) return;

    const st = calcStatus(g);

    let match = true;
    switch(state.filterKey){
      case 'open':   match = (st==='aberto'); break;
      case 'closed': match = (st==='fechado'); break;
      case 'lotado': match = (st==='lotado'); break;
      case 'pinned': match = !!g.pinned; break;
      default: match = true;
    }

    if(match && text){
      const hay = [g.title,g.description,g.field,g.location?.text,fmtDate(g.date)].join(' ').toLowerCase();
      match = hay.includes(text);
    }
    card.classList.toggle('is-hidden', !match);
  });
}

/* ===================== Session UI ===================== */
function updateSessionUI(){
  const s = $('#sessionInfo');
  if(s){
    if(state.role){
      s.textContent = `Sessão: ${state.role}${state.username?` (${state.username}${state.field?` • ${state.field}`:''})`:''}`;
    }else{
      s.textContent = '';
    }
  }

  const btnCreate = $('#btnCreate');
  const btnUsers  = $('#btnUsers');
  const btnLogs   = $('#btnLogs');
  const btnAdmin  = $('#btnAdmin');

  if(btnCreate) btnCreate.hidden = !(state.role==='admin' || state.role==='moderator');
  if(btnUsers)  btnUsers.hidden  = !(state.role==='admin');
  if(btnLogs)   btnLogs.hidden   = !(state.role==='admin');

  if(btnAdmin){
    btnAdmin.textContent = state.role ? 'Sair' : '⚙️ Admin';
    btnAdmin.setAttribute('aria-pressed', !!state.role);
  }
}

/* ===================== Core actions ===================== */
async function reload(){
  const grid = $('#grid');
  if(grid) grid.setAttribute('aria-busy','true');
  try{
    const games = await mockApi.request('GET','/games');
    state.games = games;
    render();
  }finally{
    if(grid) grid.setAttribute('aria-busy','false');
  }
}

function copyLink(id){
  const base = location.href.split('#')[0];
  const url = `${base}#game=${encodeURIComponent(id)}`;
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(url).then(()=>TOASTS.show('Link copiado.'));
  }else{
    const ta=document.createElement('textarea');
    ta.value=url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    TOASTS.show('Link copiado.');
  }
}

/* ===================== Login/Logout ===================== */
async function doLogin(){
  const user = $('#lg_user')?.value?.trim() || '';
  const pass = $('#lg_pass')?.value || '';
  const btn  = $('#confirmLogin');
  if(btn) btn.disabled = true;

  try{
    const res = await mockApi.request('POST','/auth/login',{username:user,password:pass});
    state.role = res.role;
    state.username = res.username;
    state.field = res.field || '';
    closeModal();
    TOASTS.show('Sessão iniciada.');
    updateSessionUI();
    await reload();
  }catch{
    TOASTS.show('Credenciais inválidas.','error');
  }finally{
    if(btn) btn.disabled = false;
  }
}

async function doLogout(){
  try{ await mockApi.request('POST','/auth/logout'); }catch{}
  state.role = null;
  state.username = null;
  state.field = '';
  updateSessionUI();
  TOASTS.show('Sessão terminada.');
  await reload();
}

/* ===================== Join / Leave ===================== */
function openJoin(id){
  openModal('tpl-join');
  $('#joinGameId').value = id;

  const profile = (()=>{ try{ return JSON.parse(safeStorage.getItem(PROFILE_KEY)||'null'); }catch{ return null; } })();
  if(profile){
    $('#nickname').value = profile.nickname || '';
    $('#team').value     = profile.team || '';
    $('#apd').value      = profile.apd || '';
    $('#guest').checked  = !!profile.guest;
    $('#rememberMe').checked = true;
  }else{
    $('#rememberMe').checked = false;
  }

  const apd = $('#apd');
  const guest = $('#guest');

  function sync(){
    if(guest.checked){
      apd.disabled = true;
      apd.required = false;
      apd.value = '';
    }else{
      apd.disabled = false;
      apd.required = true;
    }
  }
  guest.onchange = sync;
  sync();

  $('#confirmJoin').onclick = async ()=>{
    if(!$('#consent').checked){
      TOASTS.show('Necessário aceitar o consentimento.','error');
      return;
    }

    const isGuest = guest.checked;
    const apdVal = apd.value.trim();

    if(!isGuest){
      if(!apdVal){
        TOASTS.show('Informe APD ou marque "Convidado".','error');
        return;
      }
      if(!/^[A-Za-z0-9-]{3,20}$/.test(apdVal)){
        TOASTS.show('APD inválido.','error');
        return;
      }
    }

    const body = {
      user_id: state.user_id,
      nickname: $('#nickname').value.trim(),
      team: $('#team').value.trim(),
      consent: true,
      apd: isGuest ? null : apdVal,
      guest: isGuest
    };

    if($('#rememberMe').checked){
      safeStorage.setItem(PROFILE_KEY, JSON.stringify({
        nickname: body.nickname||'',
        team: body.team||'',
        apd: body.apd||'',
        guest: body.guest
      }));
    }else{
      safeStorage.removeItem(PROFILE_KEY);
    }

    try{
      await mockApi.request('POST',`/games/${id}/join`,body);
      closeModal();
      TOASTS.show('Inscrição efetuada.');
      await reload();
    }catch(err){
      const map = { ALREADY:'Já está inscrito.', FULL:'Sem vagas.', CLOSED:'Inscrições fechadas.' };
      TOASTS.show(map[err.message]||'Erro ao inscrever.','error');
    }
  };
}

function openLeave(id){
  openModal('tpl-leave');
  $('#leaveGameId').value=id;

  $('#confirmLeave').onclick = async ()=>{
    try{
      await mockApi.request('POST',`/games/${id}/leave`,{user_id:state.user_id});
      closeModal();
      TOASTS.show('Inscrição removida.');
      await reload();
    }catch{
      TOASTS.show('Erro ao sair.','error');
    }
  };
}

/* ===================== Quick list ===================== */
async function openQuick(id){
  openModal('tpl-list');
  const attendees = await mockApi.request('GET',`/games/${id}/attendees`);
  const total = attendees.length;
  $('#listContent').innerHTML =
    `<ol>` + attendees.map(a=>{
      const name = a.nickname || a.user_id;
      const meta = a.guest ? 'Convidado' : (a.apd ? `APD: ${a.apd}` : '');
      const team = a.team ? ` <span class="muted">( ${a.team} )</span>` : '';
      const extra = meta ? ` <span class="muted">[ ${meta} ]</span>` : '';
      return `<li>${name}${team}${extra}</li>`;
    }).join('') + `</ol><p><strong>Total: ${total}</strong></p>`;

  $('#btnPrintList').onclick = ()=>window.print();
}

/* ===================== Create/Edit game ===================== */
function openUpsert(id=null){
  openModal('tpl-upsert', { outsideClose:false, escClose:false });

  const isEdit = !!id;
  const g = isEdit ? state.games.find(x=>x.id===id) : null;

  if(isEdit && !canManage(g)){
    TOASTS.show('Sem permissão para editar este jogo.','error');
    closeModal();
    return;
  }

  $('#upsertTitle').textContent = isEdit ? 'Editar Jogo' : 'Criar Jogo';
  $('#u_id').value = g?.id || '';
  $('#u_title').value = g?.title || '';
  $('#u_desc').value = g?.description || '';
  $('#u_total').value = g?.total_slots || 20;

  const dt = g?.date ? new Date(g.date) : new Date(Date.now()+24*3600*1000);
  const toLocal = d => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $('#u_date').value = toLocal(dt);

  $('#u_loc').value = g?.location?.text || 'Braga, Portugal';
  $('#u_coords').value = (g?.location?.lat!=null && g?.location?.lng!=null) ? `${g.location.lat},${g.location.lng}` : '';
  $('#u_img').value = g?.image || '';

  const crestInput = $('#u_crest');
  if(crestInput) crestInput.value = g?.crest || (getCurrentUser()?.field_crest || '');

  $('#u_pinned').checked = !!g?.pinned;
  $('#u_status').value = g?.status || 'open';
  $('#u_field').value = g?.field || (state.role==='moderator' ? (state.field||'') : '');

  $('#confirmUpsert').onclick = async ()=>{
    const coords = $('#u_coords').value.trim();
    let lat=null,lng=null;
    if(coords){
      const [a,b] = coords.split(',').map(Number);
      if(!isNaN(a) && !isNaN(b)){ lat=a; lng=b; }
    }

    const body = {
      title: $('#u_title').value.trim(),
      description: $('#u_desc').value.trim(),
      total_slots: Number($('#u_total').value),
      date: new Date($('#u_date').value).toISOString(),
      location: { text: $('#u_loc').value.trim(), lat, lng },
      image: $('#u_img').value.trim() || null,
      crest: (crestInput?.value?.trim() || null),
      pinned: $('#u_pinned').checked,
      status: $('#u_status').value,
      field: $('#u_field').value.trim()
    };

    try{
      if(isEdit) await mockApi.request('PATCH',`/games/${id}`,body);
      else await mockApi.request('POST','/games',body);
      closeModal();
      TOASTS.show(isEdit?'Jogo atualizado.':'Jogo criado.');
      await reload();
    }catch(err){
      const map={ INVALID_SLOTS:'Vagas não podem ser inferiores aos inscritos.', FORBIDDEN:'Sem permissão.' };
      TOASTS.show(map[err.message]||'Erro ao guardar.','error');
    }
  };
}

async function toggleOpen(id, btn){
  if(btn) btn.disabled=true;
  try{
    const g = state.games.find(x=>x.id===id);
    if(!canManage(g)) throw new Error('FORBIDDEN');
    const next = g.status==='open' ? 'closed' : 'open';
    await mockApi.request('PATCH',`/games/${id}`,{status:next});
    await reload();
  }catch(e){
    TOASTS.show(e.message==='FORBIDDEN'?'Sem permissão.':'Erro.','error');
  }finally{
    if(btn) btn.disabled=false;
  }
}

async function togglePin(id, btn){
  if(btn) btn.disabled=true;
  try{
    const g = state.games.find(x=>x.id===id);
    if(!canManage(g)) throw new Error('FORBIDDEN');
    await mockApi.request('PATCH',`/games/${id}`,{pinned:!g.pinned});
    await reload();
  }catch(e){
    TOASTS.show(e.message==='FORBIDDEN'?'Sem permissão.':'Erro.','error');
  }finally{
    if(btn) btn.disabled=false;
  }
}

async function deleteGame(id, btn){
  if(!confirm('Eliminar este jogo?')) return;
  if(btn) btn.disabled=true;
  try{
    const g = state.games.find(x=>x.id===id);
    if(!(state.role==='admin' && canManage(g))) throw new Error('FORBIDDEN');
    await mockApi.request('DELETE',`/games/${id}`);
    TOASTS.show('Jogo eliminado.');
    await reload();
  }catch(e){
    TOASTS.show(e.message==='FORBIDDEN'?'Sem permissão.':'Erro ao eliminar.','error');
  }finally{
    if(btn) btn.disabled=false;
  }
}

/* ===================== Users / Logs ===================== */
async function renderUsersList(){
  const list = $('#usersList');
  try{
    const users = await mockApi.request('GET','/users');
    list.innerHTML = `
      <table class="table">
        <thead><tr><th>Utilizador</th><th>Role</th><th>Campo</th><th>Brasão</th></tr></thead>
        <tbody>
          ${users.map(u=>`
            <tr>
              <td>${u.username}</td>
              <td>${u.role}</td>
              <td>${u.field||''}</td>
              <td>${u.field_crest ? `<img src="${u.field_crest}" alt="brasão" style="width:28px;height:28px;border-radius:50%;border:1px solid #334037;object-fit:cover">` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }catch{
    list.textContent = 'Sem permissão para listar utilizadores.';
  }
}

async function openUsers(){
  openModal('tpl-users', { outsideClose:false, escClose:false });
  await renderUsersList();

  $('#btnCreateUser').onclick = async ()=>{
    const u = $('#nu_user').value.trim();
    const p = $('#nu_pass').value.trim();
    const f = $('#nu_field').value.trim();
    const c = $('#nu_crest').value.trim();

    if(!u || !p){
      TOASTS.show('Utilizador e senha são obrigatórios.','error');
      return;
    }

    try{
      await mockApi.request('POST','/users',{username:u,password:p,field:f||null,field_crest:c||null});
      TOASTS.show('Moderador criado.');
      await renderUsersList();
    }catch(err){
      TOASTS.show(err.message==='USER_EXISTS'?'Já existe um utilizador com esse nome.':'Erro ao criar moderador.','error');
    }
  };
}

async function openLogs(){
  openModal('tpl-logs');
  let logs = [];
  try{
    logs = await mockApi.request('GET','/logs');
  }catch{
    $('#logsContent').textContent = 'Sem permissão.';
    return;
  }

  const rows = logs.map(l=>{
    const actor = l.actor?.user ? `${l.actor.user} (${l.actor.role||''})` : '';
    return `<tr>
      <td>${l.ts||''}</td>
      <td>${actor}</td>
      <td>${l.action||''}</td>
      <td>${l.game_id||''}</td>
      <td><code style="font-size:12px">${(l.meta?JSON.stringify(l.meta):'')}</code></td>
    </tr>`;
  }).join('');

  $('#logsContent').innerHTML = `
    <table class="table">
      <thead><tr><th>ts</th><th>actor</th><th>action</th><th>game</th><th>meta</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ===================== Event wiring ===================== */
function wireChips(){
  const chips = $$('#filters .chip');
  if(!chips.length) return;
  chips.forEach(chip=>{
    chip.setAttribute('type','button');
    chip.addEventListener('click', (e)=>{
      const b = e.currentTarget;
      chips.forEach(x=>{
        const a = x===b;
        x.classList.toggle('active', a);
        x.setAttribute('aria-selected', a?'true':'false');
      });
      state.filterKey = b.getAttribute('data-filter') || 'all';
      applyFilterToCards();
    });
  });
}

document.addEventListener('click', async (e)=>{
  const t = e.target.closest('button');
  if(!t) return;

  if(t.id==='ctaGo'){
    $('#grid')?.scrollIntoView({behavior:'smooth'});
    return;
  }

  if(t.id==='btnAdmin'){
    if(!state.role){
      openModal('tpl-login');
      $('#confirmLogin').onclick = doLogin;
    }else{
      await doLogout();
    }
    return;
  }

  if(t.id==='btnCreate'){ openUpsert(); return; }
  if(t.id==='btnUsers'){ openUsers(); return; }
  if(t.id==='btnLogs'){ openLogs(); return; }

  const card = e.target.closest('.card');
  if(!card) return;

  const id = card.getAttribute('data-id');
  const action = t.getAttribute('data-action');

  if(action==='join'){ openJoin(id); return; }
  if(action==='leave'){ openLeave(id); return; }
  if(action==='quick'){ openQuick(id); return; }
  if(action==='copy'){ copyLink(id); return; }

  if(action==='edit'){ openUpsert(id); return; }
  if(action==='toggle'){ toggleOpen(id,t); return; }
  if(action==='pin'){ togglePin(id,t); return; }
  if(action==='delete'){ deleteGame(id,t); return; }
});

const search = $('#search');
if(search){
  search.addEventListener('input', e=>{
    state.filterText = e.target.value;
    applyFilterToCards();
  });
}

/* ===================== Init ===================== */
(async function init(){
  wireChips();
  updateSessionUI();
  try{
    await reload();
  }catch(err){
    console.error(err);
    TOASTS.show('Erro a carregar jogos.','error');
  }
})();

window.addEventListener('error', ev=>{
  try{ TOASTS.show('Erro de script: '+ev.message,'error',5000); }catch{}
});
