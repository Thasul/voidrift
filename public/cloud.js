/* VOIDRIFT multiplayer client. Daily play is server-authoritative when signed in.
   Guests retain fully functional local Daily + Unlimited Play as before. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cfg = window.VOIDRIFT_CONFIG || {};
const configured = !!(cfg.supabaseUrl && cfg.publishableKey);
let sb = null, user = null, onlineFlight = false, lastUnknown = '', lastPendingTag = '';
let leaderboardCache = null, onlineStreak = 0;
function showToast(message){if(typeof toast === 'function')toast(message); else console.log(message);}
function toggle(id,show){const n=$(id);if(n)n.classList.toggle('hidden',!show);}
function errMessage(e){return e?.message || String(e);}
function htmlSafe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function getClient(){
  if(!configured)return null;
  if(sb)return sb;
  if(!window.supabase?.createClient){showToast('Auth library failed to load; local play is still available.');return null;}
  sb=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{
    auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,storageKey:'voidrift-auth-v1'}
  });
  return sb;
}
async function api(action,payload,method='POST'){
  if(!configured)throw Error('Add public Supabase settings to config.js first.');
  const client=await getClient();if(!client)throw Error('Could not initialize authentication.');
  const {data:{session}}=await client.auth.getSession();
  const fullUrl=cfg.supabaseUrl.replace(/\/$/,'')+'/functions/v1/game';
  const endpoint=method==='GET'?`${fullUrl}?action=${encodeURIComponent(action)}${payload?.day?'&day='+encodeURIComponent(payload.day):''}`:fullUrl;
  const res=await fetch(endpoint,{
    method,
    headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,...(session?.access_token?{'Authorization':'Bearer '+session.access_token}:{})},
    ...(method!=='GET'?{body:JSON.stringify({action,...payload})}:{})
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(body.error||`Server returned ${res.status}`);
  return body;
}
function showAccount(){
  toggle('cloudModal',true);
  $('accountStatus').textContent=!configured?'Cloud setup required. The game is playable locally. The website owner must add Supabase settings in config.js and deploy the backend.':user?`Signed in as ${user.email}. Your daily progress is saved across devices.`:'Sign in with email to save your daily run and appear on the leaderboard.';
  $('accountEmail').value=user?.email||'';
  toggle('accountSignedIn',!!user);
  toggle('accountSignedOut',!user);
  toggle('cloudSetupHint',!configured);
  toggle('accountNotice',false);
}
function updateAccountLabel(){
  $('accountBtn').textContent=user?'☁ '+(user.email?.split('@')[0]||'PILOT').slice(0,13).toUpperCase():'☁ SIGN IN';
  $('leaderboardBtn').title='See today’s top pilots';
}
async function refreshAuth(){
  try{const client=await getClient();if(!client){updateAccountLabel();return;}
    const {data:{user:u}}=await client.auth.getUser();user=u;
  }catch(e){user=null;}
  updateAccountLabel();
}
async function sendMagicLink(){
  try{
    const email=$('accountEmail').value.trim();if(!/^\S+@\S+\.\S+$/.test(email))throw Error('Enter a valid email address.');
    const client=await getClient();if(!client)throw Error('Cloud is not configured yet.');
    $('accountSignIn').disabled=true;
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
    if(error)throw error;
    $('accountNotice').textContent='Check your email for your sign-in link. Return here after clicking it.';
    toggle('accountNotice',true);
  }catch(e){showToast(errMessage(e));}
  finally{$('accountSignIn').disabled=false;}
}
async function signOut(){
  try{const client=await getClient();await client.auth.signOut();user=null;onlineFlight=false;updateAccountLabel();toggle('cloudModal',false);showModeMenu();showToast('Signed out. You can still play offline.');}
  catch(e){showToast(errMessage(e));}
}
async function saveName(){
  try{const name=$('accountName').value.trim();const data=await api('profile',{name});showToast('Callsign saved: '+data.name);}
  catch(e){showToast(errMessage(e));}
}
async function loadLeaderboard(){
  toggle('leaderboardModal',true);
  $('leaderboardList').textContent='Connecting to mission control…';
  if(!configured){$('leaderboardList').textContent='Connect a Supabase project to enable the global leaderboard. Local play is available now.';return;}
  try{
    const data=await api('leaderboard',null,'GET');
    leaderboardCache=data;
    $('leaderboardDate').textContent=data.day+' UTC';
    $('leaderboardList').replaceChildren();
    if(!data.leaders.length){$('leaderboardList').textContent='No finished cloud flights today. Be the first pilot!';return;}
    for(const p of data.leaders){
      const row=document.createElement('div');row.className='pilot-line';
      const name=document.createElement('span');name.textContent=`#${p.rank} · ${p.name}`;
      const score=document.createElement('strong');score.textContent=`${p.score} pts · ${p.worlds}/10 worlds`;
      row.append(name,score);$('leaderboardList').append(row);
    }
  }catch(e){$('leaderboardList').textContent='Could not load rankings: '+errMessage(e);}
}
async function startDaily(){
  if(!configured||!user){
    onlineFlight=false;
    if(configured&&!user){showAccount();$('accountStatus').textContent='Sign in for cloud scores, or close this window to play the offline daily game.';return;}
    return dailyFlight();
  }
  try{
    resetState();activeMode='daily';activeGenre='mixed';activeSaveKey=`voidrift-cloud-${user.id}-${new Date().toISOString().slice(0,10)}`;
    toggle('intro',false);toggle('cloudModal',false);
    showToast('Synchronizing today’s mission…');
    const payload=await api('daily',null,'GET');
    const local=new Map(CATEGORIES.map(c=>[c.tag,c]));
    const questions=payload.mission.map(q=>local.get(q.tag));
    if(questions.some(q=>!q))throw Error('The mission catalog is out of date. Reload the website.');
    mission=questions;
    onlineStreak=payload.streak||0;
    const s=payload.run;
    state.index=s.index;state.location=s.location;state.score=s.score;state.finished=s.finished;state.started=true;state.locked=false;state.transit=null;
    let landed=0;
    state.answers=s.answers.map((ans,i)=>{
      if(ans.correct)landed++;
      return {...ans,cat:mission[i]?.label||'',prompt:mission[i]?.prompt||'',landing:ans.correct?BODIES[landed].name:null};
    });
    onlineFlight=true;
    save();
    if(state.finished)showResults();else renderQuestion();
  }catch(e){onlineFlight=false;showModeMenu();showToast('Cloud mission unavailable: '+errMessage(e));}
}
function showCloudSuggestions(choices,raw){
  lastUnknown=raw;lastPendingTag=mission[state.index]?.tag||'';
  $('spellPanel').classList.remove('hidden');$('spellContext').textContent=`“${raw}” looks similar to one of these answers. Choose the one you meant:`;
  $('spellOptions').replaceChildren();
  $('unlisted').classList.add('hidden');
  $('answer').disabled=true;$('answerSubmit').disabled=true;
  for(const c of choices){
    const b=document.createElement('button');b.type='button';
    b.textContent=c.name;
    b.addEventListener('click',()=>{ $('spellPanel').classList.add('hidden');$('answer').value=c.name;state.locked=false;submitOnline({answer:c.name}); });
    $('spellOptions').append(b);
  }
}
function showUnverified(raw,message){
  lastUnknown=raw;lastPendingTag=mission[state.index]?.tag||'';
  $('spellPanel').classList.add('hidden');$('unlisted').classList.remove('hidden');
  $('unlisted').firstChild.textContent='Answer could not be verified. ';
  $('unlisted').childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE&&n!==$('unlisted').firstChild)n.textContent=' '+message+' '});
  $('confirmBtn').textContent='REPORT FOR REVIEW';
  $('answer').disabled=true;$('answerSubmit').disabled=true;
}
async function submitOnline(opts={}){
 if(!onlineFlight||activeMode!=='daily')return submit(opts);
 if(state.locked||state.transit||state.index>=10)return;
 const raw=opts.answer!==undefined?String(opts.answer).trim():opts.isPass?'':opts.isTimeout?'':el.answer.value.trim();
 state.locked=true;stopClock();
 $('answerSubmit').disabled=true;$('passBtn').disabled=true;
 try{
   const result=await api('submit',{index:state.index,answer:raw,tryUnlisted:opts.tryUnlisted===true});
   if(result.status==='suggestions'){showCloudSuggestions(result.suggestions,raw);return;}
   if(result.status==='unverified'){showUnverified(raw,result.message);return;}
   if(result.status!=='accepted')throw Error('Unexpected response from mission control.');
   state.locked=false;
   commit({answer:result.answer||'PASSED',score:result.score,correct:result.correct,serverChecked:true});
   if(result.scoreSource==='players')showToast('Rarity scored from past player answers');
 }catch(e){
   state.locked=false;
   if(/already|already been|Reload/i.test(errMessage(e))){showToast('Syncing your cloud run…');startDaily();return;}
   $('answerSubmit').disabled=false;$('passBtn').disabled=false;
   showToast('Could not verify answer: '+errMessage(e));
   // Don't re-submit blind guesses indefinitely; server enforces a grace deadline.
   state.timer=Math.max(4,state.timer);state.deadline=Date.now()+state.timer*1000;
   stopClock();state.timeJob=setInterval(()=>{state.timer=Math.max(0,(state.deadline-Date.now())/1000);refreshClock();if(state.timer<=0){stopClock();submitOnline({isTimeout:true});}},75);
 }
}
async function reportUnknown(){
  try{await api('report',{tag:lastPendingTag,answer:lastUnknown});showToast('Answer sent for review.');}
  catch(e){showToast('Report failed: '+errMessage(e));}
  $('unlisted').classList.add('hidden');state.locked=false;
  await submitOnline({isPass:true});
}
async function rarity(tag,answer){
  if(!onlineFlight||!user||activeMode!=='daily'||!state.finished)
    throw Error('Finish your signed-in daily flight to view community rarity.');
  return api('rarity',{tag,answer});
}
async function savePractice(){
  if(!configured||!user||activeMode!=='practice')return;
  try{await api('practice',{clientRunId:`${user.id}:${currentRunId}:${DAY}`,genre:activeGenre,score:state.score,destinations:state.location});}
  catch(e){console.warn('Could not save practice history',errMessage(e));}
}
async function refreshStreak(){
  if(!onlineFlight||!user||!state.finished)return;
  try{const payload=await api('daily',null,'GET');onlineStreak=payload.streak||0;updateHud();}
  catch{}
}
async function loadPractice(){
  if(!user){showAccount();return;}
  try{
    const r=await api('history',{});
    $('accountHistory').replaceChildren();
    if(!r.runs.length){$('accountHistory').textContent='No saved practice flights yet.';return;}
    for(const x of r.runs.slice(0,8)){
      const div=document.createElement('div');div.className='pilot-line';
      div.textContent=`${new Date(x.created_at).toLocaleDateString()} · ${x.genre} · ${x.score} pts · ${x.destinations}/10`;
      $('accountHistory').append(div);
    }
  }catch(e){showToast(errMessage(e));}
}
function bind(){
  $('accountBtn').addEventListener('click',showAccount);
  $('leaderboardBtn').addEventListener('click',loadLeaderboard);
  $('introLeadersBtn').addEventListener('click',loadLeaderboard);
  $('accountClose').addEventListener('click',()=>toggle('cloudModal',false));
  $('leaderboardClose').addEventListener('click',()=>toggle('leaderboardModal',false));
  $('accountSignIn').addEventListener('click',sendMagicLink);
  $('accountSignOut').addEventListener('click',signOut);
  $('accountSaveName').addEventListener('click',saveName);
  $('accountHistoryBtn').addEventListener('click',loadPractice);
  $('playLocalBtn').addEventListener('click',()=>{toggle('cloudModal',false);onlineFlight=false;dailyFlight();});
  // Intercept legacy self-verification so unreviewed answers cannot score online.
  $('confirmBtn').addEventListener('click',e=>{
    if(!onlineFlight||activeMode!=='daily')return;
    e.preventDefault();e.stopImmediatePropagation();reportUnknown();
  },true);
  $('spellOther').addEventListener('click',e=>{
    if(!onlineFlight||activeMode!=='daily')return;
    e.preventDefault();e.stopImmediatePropagation();$('spellPanel').classList.add('hidden');state.locked=false;
    submitOnline({answer:lastUnknown,tryUnlisted:true});
  },true);
  $('spellEdit').addEventListener('click',e=>{
    if(!onlineFlight||activeMode!=='daily')return;
    // Keep the edit button but hide suggestions; the browser timer is only advisory while cloud is verifying.
    e.preventDefault();e.stopImmediatePropagation();
    $('spellPanel').classList.add('hidden');state.locked=false;resumeEditing();
  },true);
  $('retryBtn').addEventListener('click',e=>{
    if(!onlineFlight||activeMode!=='daily')return;
    e.preventDefault();e.stopImmediatePropagation();resumeEditing();
  },true);
}
async function init(){
  bind();await refreshAuth();
  if(configured&&sb){
    sb.auth.onAuthStateChange((event,session)=>{
      user=session?.user||null;updateAccountLabel();
      if(event==='SIGNED_IN'){showToast('Pilot signed in. Daily flights sync to your account.');if($('cloudModal')&&!$('cloudModal').classList.contains('hidden'))showAccount();}
    });
  }
}
window.VOIDRIFT_CLOUD={active:()=>onlineFlight&&activeMode==='daily',isSignedIn:()=>!!user,startDaily,submit:submitOnline,rarity,savePractice,showAccount,streak:()=>onlineStreak,refreshStreak};
init();
})();
