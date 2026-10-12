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
function pilotName(u){
  return u?.user_metadata?.voidrift_username
    || (u?.email&&!u.email.endsWith('@accounts.voidrift.invalid')?u.email.split('@')[0]:null)
    || ('Pilot '+(u?.id||'').slice(0,5).toUpperCase());
}
function chooseAuthTab(tab){
  const username=tab!=='email';
  toggle('usernameAuthPanel',username);
  toggle('emailAuthPanel',!username);
  $('authUsernameTab').setAttribute('aria-pressed',String(username));
  $('authEmailTab').setAttribute('aria-pressed',String(!username));
}
function showAccount(){
  toggle('cloudModal',true);
  $('accountStatus').textContent=!configured
    ?'Cloud setup required. You can still play as a guest.'
    :user?'Signed in as '+pilotName(user)+'. Your daily score is saved to your account, and this browser remembers your sign-in.'
    :'Choose a username and password, use an email link instead, or play as a guest.';
  $('accountEmail').value=(user?.email&&!user.email.endsWith('@accounts.voidrift.invalid'))?user.email:'';
  if(user)$('accountName').value=pilotName(user);
  toggle('accountSignedIn',!!user);
  toggle('accountSignedOut',!user);
  toggle('cloudSetupHint',!configured);
  toggle('accountNotice',false);
  if(!user){
    try{$('accountUsername').value=localStorage.getItem('voidrift-remembered-username')||'';}catch{}
    chooseAuthTab('username');
  }
}
function updateAccountLabel(){
  $('accountBtn').textContent=user?'☁ '+pilotName(user).slice(0,13).toUpperCase():'☁ SIGN IN';
  $('leaderboardBtn').title='See today’s top pilots';
}

async function refreshAuth(){
  try{const client=await getClient();if(!client){updateAccountLabel();return;}
    const {data:{user:u}}=await client.auth.getUser();user=u;
  }catch(e){user=null;}
  updateAccountLabel();
}
function usernameToEmail(username){
  return 'u_'+username+'@accounts.voidrift.invalid';
}
async function usePasswordAccount(createNew){
  const username=$('accountUsername').value.trim().toLowerCase();
  const password=$('accountPassword').value;
  if(!/^[a-z][a-z0-9_]{2,19}$/.test(username)){showToast('Username: 3–20 letters, numbers or underscores; start with a letter.');return;}
  if(createNew&&password.length<10){showToast('Use a password with at least 10 characters.');return;}
  if(!password){showToast('Enter your password.');return;}
  const loginButton=$('accountPasswordLogin');
  const createButton=$('accountPasswordRegister');
  loginButton.disabled=true;createButton.disabled=true;
  try{
    const client=await getClient();
    if(!client)throw Error('Unable to connect to pilot accounts.');
    if(createNew)await api('register',{username,password});
    const {data,error}=await client.auth.signInWithPassword({email:usernameToEmail(username),password});
    if(error)throw Error(createNew?'Account created, but automatic sign-in failed. Try SIGN IN.':'Incorrect username or password.');
    user=data.user;
    $('accountPassword').value='';
    try{localStorage.setItem('voidrift-remembered-username',username);}catch{}
    updateAccountLabel();showAccount();
    showToast(createNew?'Welcome aboard, '+username+'!':'Welcome back, '+username+'!');
  }catch(e){
    $('accountNotice').textContent=errMessage(e);
    toggle('accountNotice',true);
    showToast(errMessage(e));
  }finally{
    loginButton.disabled=false;createButton.disabled=false;
  }
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
    state.index=s.index;state.score=s.score;state.location=destinationForScore(state.score);
    state.finished=s.finished;state.started=true;state.locked=false;state.transit=null;
    let earned=0;
    state.answers=s.answers.map((ans,i)=>{
      const from=destinationForScore(earned);
      earned+=Number(ans.score)||0;
      const to=destinationForScore(earned);
      return {...ans,cat:mission[i]?.label||'',prompt:mission[i]?.prompt||'',
        landing:ans.correct?(to>from?BODIES[to].name:'En route to '+BODIES[Math.min(10,to+1)].name):null,
        passed:flightCrossings(from,to).slice(0,-1)};
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
  $('authUsernameTab').addEventListener('click',()=>chooseAuthTab('username'));
  $('authEmailTab').addEventListener('click',()=>chooseAuthTab('email'));
  $('accountPasswordLogin').addEventListener('click',()=>usePasswordAccount(false));
  $('accountPasswordRegister').addEventListener('click',()=>usePasswordAccount(true));
  $('accountUsername').addEventListener('keydown',e=>{if(e.key==='Enter')usePasswordAccount(false);});
  $('accountPassword').addEventListener('keydown',e=>{if(e.key==='Enter')usePasswordAccount(false);});
  $('accountShowPassword').addEventListener('click',()=>{
    const p=$('accountPassword'),visible=p.type==='text';
    p.type=visible?'password':'text';
    $('accountShowPassword').textContent=visible?'SHOW PASSWORD':'HIDE PASSWORD';
    $('accountShowPassword').setAttribute('aria-pressed',String(!visible));
  });
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
