const $=s=>document.querySelector(s),ADMIN=document.body.dataset.page==='admin';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S={teams:[],log:[]},prev={},cur={},draft=[],sb=null;
if(matchMedia('(prefers-color-scheme:dark)').matches)document.body.classList.add('dk');

const total=id=>S.log.filter(e=>e.team===id).reduce((a,e)=>a+e.pts,0);
const team=id=>S.teams.find(t=>t.id===id)||{name:'(removed team)',color:'#888'};
const sign=n=>(n>0?'+':'')+n;
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
function toast(m){const t=$('#toast');if(!t)return alert(m);t.textContent=m;t.classList.add('on');clearTimeout(toast.k);toast.k=setTimeout(()=>t.classList.remove('on'),3200)}
function status(txt,ok=true){$('#status').textContent=txt;$('#status').parentElement.classList.toggle('off',!ok)}
function notice(html){const n=$('#notice');n.innerHTML=html;n.hidden=!html}

/* ---------- data ---------- */
async function refresh(){
  const [t,p]=await Promise.all([
    sb.from('teams').select('*').order('position'),
    sb.from('points').select('*').order('created_at',{ascending:false}).limit(1000)]);
  if(t.error||p.error){status('Offline — retrying',false);return}
  S.teams=t.data;
  S.log=p.data.map(r=>({id:r.id,t:new Date(r.created_at).getTime(),team:r.team_id,person:r.person,pts:r.pts,why:r.reason||''}));
  status('Live');render();
}
let tm;const soon=()=>{clearTimeout(tm);tm=setTimeout(refresh,250)};

/* ---------- render (same for public + admin) ---------- */
const CROWN='<svg class="crown" viewBox="0 0 24 24" aria-label="Leader"><path d="M3 18 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 11z"/><rect x="3" y="19.5" width="18" height="2.2" rx="1"/></svg>';
const ini=n=>n.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const shown={},seen=new Set();let firstPaint=true;
function tween(el,from,to){
  if(from===to||matchMedia('(prefers-reduced-motion:reduce)').matches){el.textContent=to;return}
  const t0=performance.now(),d=700;
  (function f(t){const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(to-from)*e);if(k<1)requestAnimationFrame(f)})(t0);
}
function render(){
  const scores={};S.teams.forEach(t=>scores[t.id]=total(t.id));
  const order=[...S.teams].sort((a,b)=>scores[b.id]-scores[a.id]),max=Math.max(...Object.values(scores),0);
  const before={};document.querySelectorAll('.row[data-id]').forEach(r=>before[r.dataset.id]=r.getBoundingClientRect().top);

  $('#teams').innerHTML=order.map((t,i)=>{
    const sc=scores[t.id],lead=sc===max&&max>0,w=max>0?Math.max(0,sc)/max*100:0;
    return `<article class="row ${lead?'lead':''}" data-id="${t.id}" style="--c:${esc(t.color)};--w:${w}%">
      <span class="rk">${i+1}</span>
      <div class="nm"><h3>${lead?CROWN:''}${esc(t.name)}</h3><div class="track"><i></i></div></div>
      <div class="sc" data-to="${sc}">${shown[t.id]??sc}</div>
      ${ADMIN?`<div class="pm">
        <button class="minus" data-t="${t.id}" data-s="-1" aria-label="Deduct points from ${esc(t.name)}">−</button>
        <button class="plus" data-t="${t.id}" data-s="1" aria-label="Add points to ${esc(t.name)}">+</button></div>`:''}
    </article>`}).join('');

  document.querySelectorAll('.row[data-id]').forEach(r=>{
    const id=r.dataset.id,to=+r.querySelector('.sc').dataset.to,from=shown[id]??to;
    tween(r.querySelector('.sc'),from,to);
    if(from!==to&&to>from)r.classList.add('flash');
    shown[id]=to;
    const dy=before[id]-r.getBoundingClientRect().top;
    if(before[id]!==undefined&&Math.abs(dy)>1){ // glide to the new rank
      r.style.transition='none';r.style.transform=`translateY(${dy}px)`;r.offsetHeight;
      r.style.transition='transform .7s cubic-bezier(.2,.8,.2,1)';r.style.transform='';
    }
  });

  const per={};[...S.log].reverse().forEach(e=>{const k=e.person.toLowerCase();(per[k]??={name:e.person,team:e.team,pts:0}).pts+=e.pts;per[k].team=e.team});
  const top=Object.values(per).sort((a,b)=>b.pts-a.pts).slice(0,8);
  $('#people').innerHTML=top.length?top.map((p,i)=>`<li style="--c:${esc(team(p.team).color)}"><span class="rank">${i+1}</span><span class="av">${esc(ini(p.name))}</span><span class="who"><b>${esc(p.name)}</b><small>${esc(team(p.team).name)}</small></span><span class="chip ${p.pts<0?'neg':'pos'}">${sign(p.pts)}</span></li>`).join(''):'<li class="empty">No points yet. Let the games begin!</li>';

  $('#log').innerHTML=S.log.length?S.log.slice(0,60).map(e=>`<li class="${!firstPaint&&!seen.has(e.id)?'new':''}" style="--c:${esc(team(e.team).color)}"><span class="av">${esc(ini(e.person))}</span><span class="who"><b>${esc(e.person)}</b><small>${esc(team(e.team).name)}${e.why?' · '+esc(e.why):''} · ${ago(e.t)}</small></span><span class="chip ${e.pts<0?'neg':'pos'}">${sign(e.pts)}</span>${ADMIN?`<button class="x" data-del="${e.id}" aria-label="Remove this entry" title="Undo this entry">✕</button>`:''}</li>`).join(''):'<li class="empty">Nothing logged yet.</li>';
  S.log.forEach(e=>seen.add(e.id));if(S.log.length||S.teams.length)firstPaint=false;

  const nl=$('#names');if(nl)nl.innerHTML=[...new Set(S.log.map(e=>e.person))].map(n=>`<option value="${esc(n)}">`).join('');
  const lead=order.filter(t=>scores[t.id]===max&&max>0);
  $('#lead').textContent=lead.length?(lead.length>1?'Tied at the top: '+lead.map(t=>t.name).join(' & '):lead[0].name+' leads the way'):(ADMIN?'Only you can change the scores.':'Every point has a name behind it.');
}

/* ---------- admin actions ---------- */
function adminSetup(){
  const lg=$('#login'),panel=$('#panel');
  const show=async s=>{lg.hidden=!!s;panel.hidden=!s;$('#tools').hidden=!s;$('#logout').hidden=!s;if(s)await refresh()};
  sb.auth.getSession().then(({data})=>show(data.session));
  sb.auth.onAuthStateChange((_e,s)=>{lg.hidden=!!s;panel.hidden=!s;$('#tools').hidden=!s;$('#logout').hidden=!s});
  lg.addEventListener('submit',async e=>{
    e.preventDefault();$('#loginErr').textContent='';
    const {data,error}=await sb.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});
    if(error)return $('#loginErr').textContent='Wrong email or password.';
    $('#pw').value='';show(data.session);
  });
  $('#logout').onclick=async()=>{await sb.auth.signOut();S={teams:[],log:[]};render();status('Logged out',false)};

  document.addEventListener('click',async e=>{
    const b=e.target.closest('.pm button');
    if(b){cur={team:b.dataset.t,sign:+b.dataset.s};
      $('#award').dataset.sign=cur.sign;$('#award').style.setProperty('--c',team(cur.team).color);$('#awTitle').textContent=(cur.sign>0?'Award points to ':'Deduct points from ')+team(cur.team).name;
      $('#awSave').textContent=cur.sign>0?'Add points':'Deduct points';
      $('#awName').value='';$('#awWhy').value='';$('#awPts').value=1;$('#award').showModal();$('#awName').focus()}
    const c=e.target.closest('#chips button');if(c)$('#awPts').value=c.dataset.v;
    const d=e.target.closest('[data-del]');
    if(d&&confirm('Remove this entry?')){const {error}=await sb.from('points').delete().eq('id',d.dataset.del);error?toast('Could not remove: '+error.message):refresh()}
  });
  $('#awCancel').onclick=()=>$('#award').close();
  $('#awardForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const person=$('#awName').value.trim(),n=Math.abs(parseInt($('#awPts').value,10)||0);
    if(!person||!n)return;
    $('#award').close();
    const {error}=await sb.from('points').insert({team_id:cur.team,person,pts:n*cur.sign,reason:$('#awWhy').value.trim()||null});
    error?toast('Not saved: '+error.message):(toast('Saved: '+sign(n*cur.sign)+' for '+person),refresh());
  });

  const rows=()=>$('#teamRows').innerHTML=draft.map((t,i)=>`<div class="trow"><input type="color" value="${esc(t.color)}" data-i="${i}" data-k="color" aria-label="Team colour"><input type="text" value="${esc(t.name)}" maxlength="24" data-i="${i}" data-k="name" aria-label="Team name"><button type="button" class="x" data-rm="${i}" aria-label="Remove team">✕</button></div>`).join('');
  const PAL=['#1f5fbf','#c23030','#128a4b','#b8780a','#7a3fb0','#0f8b8d','#d6336c','#495057'];
  $('#teamsBtn').onclick=()=>{draft=structuredClone(S.teams);rows();$('#teamDlg').showModal()};
  $('#tdCancel').onclick=()=>$('#teamDlg').close();
  $('#addTeam').onclick=()=>{draft.push({id:crypto.randomUUID(),name:'Team '+(draft.length+1),color:PAL[draft.length%PAL.length],isNew:true});rows()};
  $('#teamRows').addEventListener('input',e=>{const i=e.target.dataset.i;if(i!=null)draft[i][e.target.dataset.k]=e.target.value});
  $('#teamRows').addEventListener('click',e=>{const r=e.target.closest('[data-rm]');if(r&&draft.length>1){draft.splice(+r.dataset.rm,1);rows()}});
  $('#teamForm').addEventListener('submit',async e=>{
    e.preventDefault();$('#teamDlg').close();
    const keep=draft.map((t,i)=>({id:t.id,name:t.name.trim()||'Team',color:t.color,position:i+1}));
    const gone=S.teams.filter(o=>!keep.some(k=>k.id===o.id)).map(o=>o.id);
    let err=null;
    if(gone.length&&!confirm('Removing a team deletes its points too. Continue?'))return;
    if(gone.length)err=(await sb.from('teams').delete().in('id',gone)).error;
    if(!err)err=(await sb.from('teams').upsert(keep)).error;
    err?toast('Could not save teams: '+err.message):(toast('Teams updated'),refresh());
  });
  $('#resetBtn').onclick=async()=>{
    if(!confirm('Clear ALL points and names? This cannot be undone.'))return;
    const {error}=await sb.from('points').delete().gte('created_at','1970-01-01');
    error?toast('Could not reset: '+error.message):(prev={},refresh());
  };
}

/* ---------- start ---------- */
(function start(){
  if(!window.supabase||!window.SB_URL||window.SB_URL.includes('YOUR-PROJECT')){
    notice('<b>Almost there.</b> Add your Supabase URL and key to <code>config.js</code>, and run <code>supabase.sql</code> once in the Supabase SQL Editor.');
    status('Not connected',false);render();return}
  sb=supabase.createClient(window.SB_URL,window.SB_KEY);
  sb.channel('board').on('postgres_changes',{event:'*',schema:'public',table:'points'},soon)
    .on('postgres_changes',{event:'*',schema:'public',table:'teams'},soon)
    .subscribe(s=>{if(s==='SUBSCRIBED')status('Live');else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')status('Reconnecting…',false)});
  if(ADMIN)adminSetup();else refresh();
  setInterval(()=>{if(!ADMIN||!$('#panel').hidden)refresh()},20000); // safety net if realtime drops
})();
