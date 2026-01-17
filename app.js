// ===================== UTILIDADES BASE =====================
(function(){
  const y=document.getElementById('year');
  if(y) y.textContent=new Date().getFullYear();
})();

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function uid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);
    return v.toString(16)
  });
}

function fmtDate(iso){
  try{
    return new Date(iso).toLocaleString('pt-PT',{dateStyle:'medium',timeStyle:'short'});
  }catch{
    return iso;
  }
}

function svgPlaceholder(title){
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='600'>
      <rect width='100%' height='100%' fill='#1a221c'/>
      <text x='50%' y='50%' fill='#cfe7a7' font-size='64'
        font-family='system-ui' dominant-baseline='middle'
        text-anchor='middle'>${title||'GCAN'}</text>
    </svg>`
  )}`;
}

// ===================== TOASTS =====================
const TOASTS={
  el:$('.toasts'),
  show(msg,type='ok',ms=2600){
    const t=document.createElement('div');
    t.className='toast'+(type==='error'?' error':'');
    t.textContent=msg;
    this.el.appendChild(t);
    setTimeout(()=>t.remove(),ms);
  }
};

// ===================== STORAGE SEGURO =====================
const safeStorage=(()=>{
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

// ===================== CONSTANTES =====================
const STORAGE_KEY='gcan_games_v3';
const USER_KEY='gcan_public_user';
const AUTH_ROLE_KEY='gcan_role';
const AUTH_USER_KEY='gcan_user';

// ===================== USER ID PÚBLICO =====================
const PUBLIC_USER_ID=(()=>{
  let id=safeStorage.getItem(USER_KEY);
  if(!id){
    id=uid();
    safeStorage.setItem(USER_KEY,id);
  }
  return id;
})();

// ===================== MOCK DB =====================
const MockDB={
  games:[
    {
      id:'g1',
      title:'ARCANJOS',
      description:'Skirmish dominical',
      field:'ARCANJOS',
      crest:null,
      date:'2025-05-18T09:00:00Z',
      status:'open',
      pinned:true,
      total_slots:45,
      attendees:[
        {user_id:'u1',nickname:'Airt3st1',team:null,apd:'APD1234',guest:false}
      ],
      location:{text:'Braga, Portugal'},
      image:null
    },
    {
      id:'g2',
      title:'STG Night Ops',
      description:'MilSim noturno',
      field:'STG',
      crest:null,
      date:'2025-06-01T21:00:00Z',
      status:'closed',
      pinned:false,
      total_slots:30,
      attendees:[],
      location:{text:'Braga'},
      image:null
    }
  ]
};

function loadDB(){
  try{
    const s=safeStorage.getItem(STORAGE_KEY);
    if(s) return JSON.parse(s);
  }catch{}
  safeStorage.setItem(STORAGE_KEY,JSON.stringify(MockDB));
  return JSON.parse(JSON.stringify(MockDB));
}
function saveDB(db){
  safeStorage.setItem(STORAGE_KEY,JSON.stringify(db));
}

// ===================== STATE =====================
const state={
  games:[],
  filter:'all',
  search:''
};

// ===================== HELPERS =====================
function remaining(g){
  return g.total_slots-g.attendees.length;
}
function calcStatus(g){
  if(remaining(g)<=0) return 'lotado';
  return g.status==='closed'?'fechado':'aberto';
}
function isJoined(g){
  return g.attendees.some(a=>a.user_id===PUBLIC_USER_ID);
}

// ===================== RENDER =====================
function cardHTML(g){
  const st=calcStatus(g);
  const canJoin=st==='aberto' && !isJoined(g);
  return `
  <article class="card" data-id="${g.id}">
    <div class="hd">
      <span class="badge ${st}">${st}</span>
      <div class="crest-lg">
        ${g.crest?`<img src="${g.crest}">`:`<span>${(g.field||'?')[0]}</span>`}
      </div>
    </div>
    <div class="body">
      <div class="row">
        <strong>${g.title}</strong>
        <div class="spacer"></div>
        <span class="muted">${fmtDate(g.date)}</span>
      </div>
      <div class="muted">${g.description||''}</div>
      <div class="muted">${g.attendees.length}/${g.total_slots} inscritos • ${remaining(g)} vagas</div>
      <div class="btn-row">
        <button class="btn ok" data-action="join" ${canJoin?'':'disabled'}>
          Entrar (${remaining(g)})
        </button>
        <button class="btn" data-action="leave" ${isJoined(g)?'':'hidden'}>
          Sair
        </button>
        <button class="btn" data-action="list">Lista</button>
        <button class="btn" data-action="copy">Copiar link</button>
      </div>
    </div>
  </article>`;
}

function render(){
  const grid=$('#grid');
  grid.innerHTML='';
  let list=[...state.games];

  if(state.filter!=='all'){
    list=list.filter(g=>{
      if(state.filter==='open') return calcStatus(g)==='aberto';
      if(state.filter==='closed') return calcStatus(g)==='fechado';
      if(state.filter==='lotado') return calcStatus(g)==='lotado';
      if(state.filter==='pinned') return g.pinned;
      return true;
    });
  }

  if(state.search){
    const t=state.search.toLowerCase();
    list=list.filter(g=>
      (g.title+g.description+g.field).toLowerCase().includes(t)
    );
  }

  list.sort((a,b)=>a.pinned===b.pinned
    ? new Date(a.date)-new Date(b.date)
    : a.pinned?-1:1
  );

  grid.innerHTML=list.map(cardHTML).join('');
}

// ===================== ACTIONS =====================
async function reload(){
  const db=loadDB();
  state.games=db.games;
  render();
}

function copyLink(id){
  const url=location.href.split('#')[0]+`#game=${id}`;
  navigator.clipboard.writeText(url);
  TOASTS.show('Link copiado');
}

// ===================== EVENTOS =====================
document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(!btn) return;

  if(btn.id==='ctaGo'){
    $('#grid').scrollIntoView({behavior:'smooth'});
    return;
  }

  if(btn.classList.contains('chip')){
    $$('.chip').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    state.filter=btn.dataset.filter;
    render();
    return;
  }

  const card=btn.closest('.card');
  if(!card) return;
  const id=card.dataset.id;
  const g=state.games.find(x=>x.id===id);

  if(btn.dataset.action==='copy'){
    copyLink(id);
  }

  if(btn.dataset.action==='join'){
    g.attendees.push({
      user_id:PUBLIC_USER_ID,
      nickname:'Jogador',
      guest:true
    });
    saveDB({games:state.games});
    TOASTS.show('Inscrição efetuada');
    render();
  }

  if(btn.dataset.action==='leave'){
    g.attendees=g.attendees.filter(a=>a.user_id!==PUBLIC_USER_ID);
    saveDB({games:state.games});
    TOASTS.show('Inscrição removida');
    render();
  }
});

$('#search').addEventListener('input',e=>{
  state.search=e.target.value;
  render();
});

// ===================== INIT =====================
reload();
