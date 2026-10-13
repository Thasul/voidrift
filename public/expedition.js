/* VOIDRIFT EXPEDITION — map, journal, crews, cosmetics, seasonal events, share cards.
   Client displays cloud-verified achievements; guest log is device-local only. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
const cloud=()=>window.VOIDRIFT_CLOUD;
const signed=()=>!!cloud()?.isSignedIn?.();
const api=(action,body={})=>{
  if(!signed()||!cloud()?.request)throw Error('Sign in to use online crew and captain features.');
  return cloud().request(action,body);
};
const STORE='voidrift:captains-log:v1',STYLE='voidrift:ship:v1';
let profileCache=null,crewCache=null,currentPanel='';
const shipChoices=[['scout','Scout','Standard explorer'],['comet','Comet','Finish one daily'],['storm','Storm Chaser','Reach Jupiter'],['nebula','Nebula Cruiser','Reach Pluto'],['rift','Riftbreaker','Reach the Rift']];
const trailChoices=[['cyan','Ion Cyan','Starter thrusters'],['amber','Solar Gold','Finish one daily'],['violet','Void Violet','3-day streak'],['rose','Pulsar Rose','Best score 600+']];
const icons=['☀','☿','♀','🌎','♂','✧','♃','♄','♅','♆','◌','❄','✺','✦','◇'];
function savedHistory(){
 try{const r=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(r)?r:[]}catch{return []}
}
function applyStyle(){
 let skin={ship:'scout',trail:'cyan'};try{skin={...skin,...JSON.parse(localStorage.getItem(STYLE)||'{}')}}catch{}
 const app=$('app');if(!app)return;
 app.className=app.className.replace(/\bvr-(ship|trail)-[\w-]+\b/g,'').trim();
 app.classList.add('vr-ship-'+skin.ship,'vr-trail-'+skin.trail);
 return skin;
}
function historySnapshot(){
 const records=savedHistory();
 const totals=records.filter(x=>x.mode==='daily');
 const best=Math.max(0,...totals.map(x=>x.score));
 const farthest=Math.max(0,...totals.map(x=>x.destination));
 const played=totals.length;
 const rarest=totals.flatMap(x=>x.answers||[]).sort((a,b)=>b.score-a.score)[0]||null;
 const nowStreak=typeof streak==='function'?streak():0;
 const badges=[
  {id:'first-flight',name:'First Contact',detail:'Finish a daily flight',earned:played>=1},
  {id:'orbital',name:'Orbital Navigator',detail:'Reach Jupiter',earned:farthest>=6},
  {id:'pluto',name:'Deep-Space Explorer',detail:'Reach Pluto',earned:farthest>=10},
  {id:'rift',name:'Riftbreaker',detail:'Reach the final Rift',earned:farthest>=14},
  {id:'legend',name:'Galactic Legend',detail:'Score 85+ on an answer',earned:(rarest?.score||0)>=85},
  {id:'veteran',name:'Seasoned Pilot',detail:'Finish 7 daily missions',earned:played>=7},
  {id:'steady',name:'Steady Navigator',detail:'3-day streak',earned:nowStreak>=3},
  {id:'halloween',name:'Halloween Voyager',detail:'Finish a daily in October',earned:totals.some(x=>String(x.day).slice(5,7)==='10')}
 ];
 const ownedShips=['scout',...(played>=1?['comet']:[]),...(farthest>=6?['storm']:[]),...(farthest>=10?['nebula']:[]),...(farthest>=14?['rift']:[])];
 const ownedTrails=['cyan',...(played>=1?['amber']:[]),...(nowStreak>=3?['violet']:[]),...(best>=600?['rose']:[])];
 return {name:'Guest Pilot',streak:nowStreak,totalDaily:played,
  totalPractice:records.filter(x=>x.mode==='practice').length,bestScore:best,farthest,
  pointsEarned:totals.reduce((n,x)=>n+x.score,0),
  rarest:rarest?{answer:rarest.answer,points:rarest.score,category:rarest.cat}:null,
  badges,recent:totals.slice(0,12).map(x=>({day:x.day,score:x.score,destinations:x.destination})),
  ownedShips,ownedTrails,cosmetic:applyStyle()};
}
function onFinish(){
 if(!state.finished)return;
 const key=(activeMode==='daily'?'daily:'+DAY:'practice:'+DAY+':'+currentRunId);
 let records=savedHistory();
 if(records.some(x=>x.key===key))return;
 records.unshift({key,day:DAY,mode:activeMode,genre:activeGenre,score:state.score,
   destination:state.location,answers:state.answers.map(x=>({answer:x.answer,score:x.score,cat:x.cat}))});
 records=records.slice(0,240);
 try{localStorage.setItem(STORE,JSON.stringify(records))}catch{}
 profileCache=null;
}
function onAnswer(result,from,to){
 const flash=$('vr-jump-flash');if(!flash)return;
 flash.replaceChildren();
 if(!result.correct)return;
 const score=Number(result.score)||0,stops=Math.max(0,to-from);
 const strong=document.createElement('b'),sub=document.createElement('span');
 strong.textContent=score>=100?'REALITY BREAKER':score>=85?'GALACTIC LEGEND':score>=65?'VOID RUNNER':score>=45?'TRAILBLAZER':'HYPERDRIVE';
 sub.textContent='+'+score+' FUEL  ·  '+(stops>1?'PASSED '+(stops-1)+' WORLDS':stops===1?'NEW DESTINATION':'CLOSING DISTANCE');
 flash.append(strong,sub);flash.classList.remove('visible');void flash.offsetWidth;flash.classList.add('visible');
 if(score>=65){const app=$('app');app?.classList.add('vr-hyperdrive');setTimeout(()=>app?.classList.remove('vr-hyperdrive'),1450)}
}
function uiButton(text,onClick){
 const el=document.createElement('button');el.className='vr-btn';el.textContent=text;
 el.addEventListener('click',onClick);return el;
}
function panel(title,eyebrow){
 currentPanel=title;
 const backdrop=$('vr-overlay'),mount=$('vr-dialog');
 mount.replaceChildren();
 const header=document.createElement('div');header.className='vr-panel-head';
 const left=document.createElement('div');
 left.innerHTML='<div class="vr-eyebrow">'+escapeHTML(eyebrow||'MISSION CONTROL')+'</div><h2>'+escapeHTML(title)+'</h2>';
 const close=uiButton('✕ Close',closePanel);close.className='vr-close';
 header.append(left,close);mount.append(header);
 backdrop.classList.remove('vr-hide');
 return mount;
}
function closePanel(){const b=$('vr-overlay');if(b)b.classList.add('vr-hide');currentPanel='';}
function section(html){const node=document.createElement('section');node.innerHTML=html;return node;}
function tutorialPanel(){
 const root=panel('HOW TO FLY','WELCOME TO VOIDRIFT');
 root.append(section('<p class="vr-muted">You are piloting a trivia-powered ship. Every answer becomes fuel. The rarer the answer, the farther you travel.</p>'+
 '<div class="vr-grid">'+
 '<div class="vr-stat"><strong>① ANSWER</strong><span>10 DAILY PROMPTS</span><p>Type something that fits the question within 25 seconds.</p></div>'+
 '<div class="vr-stat"><strong>② BOOST</strong><span>RARE = LONGER JUMP</span><p>Earn 10–100 points and zoom past multiple planets.</p></div>'+
 '<div class="vr-stat"><strong>③ EXPLORE</strong><span>14 DESTINATIONS</span><p>Check the star chart, earn ships, join friends, share a card.</p></div>'+
 '</div><p class="vr-muted">Daily resets at midnight UTC. Unlimited and seasonal runs do not alter the daily score. Username accounts sync to Supabase; guests save on this browser.</p>'));
 root.append(uiButton('READY TO LAUNCH',()=>{try{localStorage.setItem('voidrift:training:v1','1')}catch{}closePanel()}));
}
function mapPanel(){
 const mount=panel('STAR CHART','14 DESTINATIONS • EXPLORE FURTHER');
 const here=state.location,score=state.score;
 const intro=section('<p class="vr-muted">Every point is fuel. Rare answers can take you past several worlds at once. Your mission reaches the fictional VOIDRIFT at 975 cumulative points.</p>'+
 '<div class="vr-progress"><div style="width:'+Math.max(0,Math.min(100,score/10))+'%"></div></div>'+
 '<div class="vr-grid"><div class="vr-stat"><strong>'+score+' / 1,000</strong><span>MISSION FUEL</span></div>'+
 '<div class="vr-stat"><strong>'+here+' / 14</strong><span>WORLDS PASSED</span></div>'+
 '<div class="vr-stat"><strong>'+escapeHTML(BODIES[here]?.name)+'</strong><span>CURRENT SECTOR</span></div></div>');
 mount.append(intro);
 const track=document.createElement('div');track.className='vr-map-track';
 BODIES.forEach((body,i)=>{
  const b=document.createElement('button');b.className='vr-world '+(i<here?'passed':i===here?'current':'future');
  b.innerHTML='<span class="vr-dot">'+icons[i]+'</span><strong>'+escapeHTML(body.name)+'</strong><small>'+
    (i===0?'LAUNCH':(FLIGHT_THRESHOLDS[i]||0)+' PTS')+'</small>';
  b.addEventListener('click',()=>{const info=$('vr-world-info');if(info)info.textContent=body.name+' · '+body.fact;});
  track.append(b);
 });
 mount.append(track);
 const info=section('<p class="vr-muted" id="vr-world-info">Select any destination to see its discovery note.</p>'+
 '<p class="vr-muted">The Kuiper Belt and Alpha Centauri are real; the Oort Cloud is theoretical, and the final VOIDRIFT is fictional. Flight distances are game milestones, not physical flight times.</p>');
 mount.append(info);
 if(crewCache?.crew){
  mount.append(section('<h3>YOUR CREW · TODAY</h3><p class="vr-muted">'+escapeHTML(crewCache.crew.board.map(x=>x.name+': '+(x.finished?BODIES[x.worlds]?.name:'In flight')).join(' · '))+'</p>'));
 }
}
async function loadSummary(){
 if(signed()){
  const data=await api('captain');profileCache=data;return data;
 }
 return historySnapshot();
}
function makeBadges(data){
 const wrap=document.createElement('div');wrap.className='vr-achievements';
 (data.badges||[]).forEach(a=>{
  const item=section('<strong>'+(a.earned?'✦ ':'◇ ')+escapeHTML(a.name)+'</strong><small>'+escapeHTML(a.detail)+'</small>');
  item.className='vr-achievement'+(a.earned?'':' locked');wrap.append(item);
 });
 return wrap;
}
async function journalPanel(){
 const root=panel('CAPTAIN’S LOG','YOUR PERSONAL FLIGHT ARCHIVE');
 const loading=section('<p class="vr-muted">Reading mission logs…</p>');root.append(loading);
 try{
  const data=await loadSummary();if(currentPanel!=='CAPTAIN’S LOG')return;
  loading.remove();
  root.append(section('<p class="vr-muted">'+(signed()?'Cloud account history':'Guest history is saved on this browser only')+'.</p>'+
    '<div class="vr-grid">'+
    '<div class="vr-stat"><strong>'+Number(data.totalDaily||0)+'</strong><span>DAILY FLIGHTS</span></div>'+
    '<div class="vr-stat"><strong>'+Number(data.bestScore||0)+'</strong><span>BEST SCORE</span></div>'+
    '<div class="vr-stat"><strong>'+escapeHTML(BODIES[Math.min(14,Number(data.farthest)||0)]?.name)+'</strong><span>FARTHEST REACHED</span></div>'+
    '<div class="vr-stat"><strong>'+Number(data.streak||0)+'</strong><span>CURRENT STREAK</span></div>'+
    '<div class="vr-stat"><strong>'+Number(data.pointsEarned||0).toLocaleString()+'</strong><span>LIFETIME DAILY POINTS</span></div>'+
    '<div class="vr-stat"><strong>'+Number(data.totalPractice||0)+'</strong><span>RECENT PRACTICE RUNS</span></div></div>'));
  root.append(section('<h3>RAREST KNOWN ANSWER</h3><p class="vr-muted">'+
    (data.rarest?escapeHTML(data.rarest.answer)+' · '+data.rarest.points+' pts · '+escapeHTML(data.rarest.category):'No verified answers yet')+'</p><h3>ACHIEVEMENTS</h3>'));
  root.append(makeBadges(data));
  const records=document.createElement('div');
  records.innerHTML='<h3>RECENT DAILY FLIGHTS</h3>';
  (data.recent||[]).forEach(r=>records.append(section('<div class="vr-member"><span>'+escapeHTML(r.day)+'</span><strong>'+
    Number(r.score)+' pts · '+escapeHTML(BODIES[r.destinations]?.name||'Sun')+'</strong></div>')));
  if(!data.recent?.length)records.append(section('<p class="vr-muted">Finish a daily mission to start your flight history.</p>'));
  root.append(records);
 }catch(e){loading.textContent='Could not load journal: '+e.message}
}
async function crewPanel(){
 const root=panel('FRIEND CREW','PRIVATE DAILY RACE');
 const status=section('<p class="vr-muted">Only people with your six-character invite code can join. Completed daily flights are ranked by score; unfinished answers stay hidden.</p><p>Connecting to flight control…</p>');root.append(status);
 if(!signed()){status.replaceChildren(section('<p>Sign in with a pilot account to create or join a crew.</p>'),uiButton('OPEN SIGN-IN',()=>{closePanel();cloud()?.showAccount?.()}));return}
 try{
  const data=await api('crew_status');crewCache=data;
  if(currentPanel!=='FRIEND CREW')return;
  status.replaceChildren();
  if(!data.crew){
   const form=section('<h3>CREATE A CREW</h3><input class="vr-input" id="vr-crew-name" maxlength="28" placeholder="Crew name, e.g. Stardust Squad">'+
   '<div><button class="vr-btn" id="vr-crew-create">CREATE CREW</button></div>'+
   '<h3>OR JOIN FRIENDS</h3><input class="vr-input" id="vr-crew-code" maxlength="6" placeholder="INVITE CODE">'+
   '<div><button class="vr-btn" id="vr-crew-join">JOIN CREW</button></div><p id="vr-crew-message" class="vr-muted"></p>');
   status.append(form);
   $('vr-crew-create').onclick=async()=>{await actCrew('crew_create',{name:$('vr-crew-name').value})};
   $('vr-crew-join').onclick=async()=>{await actCrew('crew_join',{code:$('vr-crew-code').value})};
   return;
  }
  const cr=data.crew;
  status.append(section('<h3>'+escapeHTML(cr.name)+'</h3><p class="vr-muted">CREW CODE: <strong>'+escapeHTML(cr.code)+
     '</strong> · '+cr.memberCount+' / 30 MEMBERS · '+escapeHTML(cr.day)+' UTC</p>'));
  const controls=document.createElement('div');
  controls.append(uiButton('COPY INVITE CODE',()=>navigator.clipboard?.writeText(cr.code)));
  controls.append(uiButton(cr.isOwner?'DISBAND CREW':'LEAVE CREW',async()=>{
    if(!confirm(cr.isOwner?'Disband this crew for everyone?':'Leave this crew?'))return;
    await actCrew('crew_leave',{});
  }));
  status.append(controls);
  const board=section('<h3>TODAY’S CREW RACE</h3>');
  cr.board.forEach((member,i)=>board.append(section('<div class="vr-member"><span>#'+(i+1)+' · '+
   escapeHTML(member.name)+(member.isYou?' (YOU)':'')+'</span><strong>'+
   (member.finished?member.score+' PTS · '+escapeHTML(BODIES[member.worlds]?.name):'IN FLIGHT')+'</strong></div>')));
  status.append(board);
 }catch(e){status.textContent='Crew unavailable: '+e.message}
}
async function actCrew(action,data){
 const msg=$('vr-crew-message');
 if(msg)msg.textContent='Contacting mission control…';
 try{await api(action,data);await crewPanel()}catch(e){if(msg)msg.textContent=e.message;else alert(e.message)}
}
async function hangarPanel(){
 const root=panel('THE HANGAR','EARNED SHIPS AND ENGINE TRAILS');
 const line=section('<p class="vr-muted">Customize your cockpit. Cosmetics never change answer rarity or leaderboard scores. Locked options are earned through real daily flights.</p>');root.append(line);
 let data;
 try{data=await loadSummary()}catch{data=historySnapshot()}
 if(currentPanel!=='THE HANGAR')return;
 async function pick(kind,value){
  const current=applyStyle(),update={...current,[kind]:value};
  const allowed=kind==='ship'?data.ownedShips:data.ownedTrails;
  if(!allowed.includes(value))return;
  try{
   if(signed())await api('customize',update);
   localStorage.setItem(STYLE,JSON.stringify(update));applyStyle();hangarPanel();
  }catch(e){alert('Could not save your cosmetic: '+e.message)}
 }
 const render=(title,choices,kind)=>{
  root.append(section('<h3>'+title+'</h3>'));
  const box=document.createElement('div');box.className='vr-palette';
  choices.forEach(([id,name,detail])=>{
   const owned=(kind==='ship'?data.ownedShips:data.ownedTrails)||[];
   const btn=document.createElement('button');
   btn.className=(!owned.includes(id)?'locked ':'')+(applyStyle()[kind]===id?'active':'');
   btn.innerHTML='<strong>'+escapeHTML(name)+'</strong><br><small>'+escapeHTML(detail)+'</small>';
   btn.title=owned.includes(id)?'Choose '+name:'LOCKED · '+detail;
   btn.disabled=!owned.includes(id);btn.onclick=()=>pick(kind,id);box.append(btn);
  });
  root.append(box);
 };
 render('SHIP HULLS',shipChoices,'ship');
 render('ENGINE TRAILS',trailChoices,'trail');
 root.append(section('<p class="vr-muted">Your choice stays on this browser'+(signed()?' and syncs to your pilot account.':'. Sign in to sync across devices.')+'</p>'));
}
function createShareCard(){
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;
 const ctx=canvas.getContext('2d');if(!ctx)return canvas;
 const g=ctx.createLinearGradient(0,0,1080,1080);
 g.addColorStop(0,'#041528');g.addColorStop(.65,'#10142f');g.addColorStop(1,'#210d40');
 ctx.fillStyle=g;ctx.fillRect(0,0,1080,1080);
 let seed=(Number(state.score)||0)*13+DAY.length*17;
 for(let i=0;i<185;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%1080;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%1080;
  const a=.2+(seed%65)/100;ctx.fillStyle='rgba(220,243,255,'+a+')';ctx.fillRect(x,y,1+(seed%3),1+(seed%3));
 }
 const aura=ctx.createRadialGradient(750,290,15,750,290,310);
 aura.addColorStop(0,'#83e0ff77');aura.addColorStop(.25,'#528de544');aura.addColorStop(1,'#5e78ff00');
 ctx.fillStyle=aura;ctx.beginPath();ctx.arc(750,290,310,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#6fe1fb';ctx.lineWidth=3;ctx.strokeRect(50,50,980,980);
 ctx.fillStyle='#81eaff';ctx.font='800 32px system-ui';ctx.fillText('✦ VOIDRIFT',90,125);
 ctx.fillStyle='#b1cce7';ctx.font='20px system-ui';ctx.fillText('THINK RARE. TRAVEL FAR.',90,163);
 ctx.fillStyle='#fff';ctx.font='800 82px system-ui';ctx.fillText(String(state.score)+' PTS',85,315);
 ctx.font='800 43px system-ui';ctx.fillText(BODIES[state.location]?.name||'Sun',90,383);
 ctx.fillStyle='#93b6d3';ctx.font='24px system-ui';
 ctx.fillText(activeMode==='daily'?'DAILY FLIGHT · '+DAY:'UNLIMITED · '+modeName(),90,437);
 ctx.strokeStyle='#6399c0';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(100,560);ctx.lineTo(985,560);ctx.stroke();
 ctx.strokeStyle='#76e1ff';ctx.beginPath();ctx.moveTo(100,560);ctx.lineTo(100+885*Math.min(1,state.score/1000),560);ctx.stroke();
 BODIES.forEach((body,i)=>{
  const x=100+885*FLIGHT_THRESHOLDS[i]/1000;
  ctx.beginPath();ctx.arc(x,560,i===state.location?13:6,0,Math.PI*2);
  ctx.fillStyle=i<=state.location?'#92efff':'#56708e';ctx.fill();
 });
 ctx.fillStyle='#cceaff';ctx.font='600 30px system-ui';ctx.fillText('RAREST SIGNALS',90,655);
 const sorted=state.answers.map(x=>({answer:x.answer,score:x.score})).sort((a,b)=>b.score-a.score).slice(0,3);
 sorted.forEach((ans,i)=>{
  ctx.fillStyle='#9bd6f0';ctx.font='24px system-ui';
  ctx.fillText((i+1)+'. '+String(ans.answer).slice(0,34),100,715+i*65);
  ctx.fillStyle='#e6c7ff';ctx.fillText('+'+ans.score,830,715+i*65);
 });
 ctx.fillStyle='#97b9d6';ctx.font='22px system-ui';
 ctx.fillText('14 WORLDS · '+state.location+' REACHED · '+state.answers.length+' ANSWERS',90,966);
 return canvas;
}
function shareCardPanel(){
 const root=panel('MISSION TRANSMISSION','SHARE YOUR FLIGHT');
 if(!state.finished){root.append(section('<p class="vr-muted">Finish a flight to unlock your personalized share card.</p>'));return;}
 const canvas=createShareCard();
 const img=document.createElement('img');img.src=canvas.toDataURL('image/png');img.alt='VOIDRIFT score and journey card';img.className='vr-card-preview';
 const actions=document.createElement('div');actions.className='vr-card-actions';
 actions.append(section('<h3>YOUR MISSION REPORT</h3><p class="vr-muted">An original share card with your score, final destination and rarest answers. Share it on Discord, Instagram or anywhere you like.</p>'));
 actions.append(uiButton('DOWNLOAD PNG',()=>{
  const a=document.createElement('a');a.download='voidrift-'+DAY+'.png';a.href=canvas.toDataURL('image/png');a.click();
 }));
 actions.append(uiButton('OPEN STAR CHART',mapPanel));
 actions.append(uiButton('COPY RESULT TEXT',async()=>{
  const text='VOIDRIFT · '+DAY+'\n'+state.score+'/1000 points\n'+BODIES[state.location].name+' · '+state.location+' worlds reached\nThink Rare. Travel Far.\nhttps://voiddrifting.netlify.app/';
  try{await navigator.clipboard.writeText(text);alert('Result text copied!')}catch{alert(text)}
 }));
 if(navigator.share&&typeof File!=='undefined'){
  actions.append(uiButton('SHARE IMAGE',async()=>{
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob)return;
   const file=new File([blob],'voidrift-'+DAY+'.png',{type:'image/png'});
   try{await navigator.share({files:[file],title:'VOIDRIFT flight result'})}catch{}
  }));
 }
 const row=document.createElement('div');row.className='vr-card-panel';row.append(img,actions);root.append(row);
}
function installAnswerAliases(){
 // Match offline guest/practice answers to the same canonical scores used by cloud play.
 const states='al:alabama,ak:alaska,az:arizona,ar:arkansas,ca:california,co:colorado,ct:connecticut,de:delaware,fl:florida,ga:georgia,hi:hawaii,id:idaho,il:illinois,in:indiana,ia:iowa,ks:kansas,ky:kentucky,la:louisiana,me:maine,md:maryland,ma:massachusetts,mi:michigan,mn:minnesota,ms:mississippi,mo:missouri,mt:montana,ne:nebraska,nv:nevada,nh:new hampshire,nj:new jersey,nm:new mexico,ny:new york,nc:north carolina,nd:north dakota,oh:ohio,ok:oklahoma,or:oregon,pa:pennsylvania,ri:rhode island,sc:south carolina,sd:south dakota,tn:tennessee,tx:texas,ut:utah,vt:vermont,va:virginia,wa:washington,wv:west virginia,wi:wisconsin,wy:wyoming';
 const groups=[
  ['geography2',states.split(',').map(s=>s.split(':'))],
  ['geography',[['uk','united kingdom'],['great britain','united kingdom']]],
  ['gaming',[['cod','call of duty'],['gta','grand theft auto'],['ff','final fantasy'],['the legend of zelda','legend of zelda']]],
  ['practice-games-12',[
   ['final fantasy i','final fantasy 1'],['final fantasy ii','final fantasy 2'],
   ['final fantasy iii','final fantasy 3'],['final fantasy iv','final fantasy 4'],
   ['final fantasy v','final fantasy 5'],['final fantasy vi','final fantasy 6'],
   ['final fantasy vii','final fantasy 7'],['final fantasy viii','final fantasy 8'],
   ['final fantasy ix','final fantasy 9'],['final fantasy x','final fantasy 10'],
   ['final fantasy xi','final fantasy 11'],['final fantasy xii','final fantasy 12'],
   ['final fantasy xiii','final fantasy 13'],['final fantasy xiv','final fantasy 14'],
   ['final fantasy xv','final fantasy 15'],['final fantasy xvi','final fantasy 16']]]
 ];
 groups.forEach(([tag,pairs])=>{
  const cat=CATEGORIES.find(c=>c.tag===tag);if(!cat?.ans)return;
  pairs.forEach(([alias,canonical])=>{
   const key=norm(alias),target=cat.ans.get(norm(canonical));
   if(target&&!cat.ans.has(key))cat.ans.set(key,target);
  });
 });
}
const halloweenPack=[
 ['Name a classic movie monster.','vampire|10;werewolf|10;zombie|10;frankenstein|25;mummy|25;creature from the black lagoon|65;phantom of the opera|65;nosferatu|45;the blob|85'],
 ['Name a horror video game.','resident evil|10;silent hill|10;dead space|25;amnesia|45;outlast|25;fatal frame|65;signalis|85;little nightmares|45;alien isolation|25;until dawn|25'],
 ['Name a supernatural creature.','ghost|10;witch|10;vampire|10;banshee|45;wendigo|65;poltergeist|25;dullahan|85;gorgon|65;kelpie|85;demon|10'],
 ['Name a scary movie franchise.','scream|10;halloween|10;friday the 13th|10;a nightmare on elm street|25;saw|10;the conjuring|25;evil dead|25;insidious|25;hellraiser|45;the omen|65'],
 ['Name a Halloween costume character.','dracula|10;witch|10;michael myers|25;ghostface|25;jason voorhees|10;freddy krueger|25;beetlejuice|25;samara|65;chucky|10;pinhead|65'],
 ['Name a fictional haunted location.','haunted mansion|10;the overlook hotel|45;hill house|65;haddonfield|65;castle dracula|45;raccoon city|45;silent hill|25;amityville house|45;the shining hotel|65'],
 ['Name a spooky animated movie.','coraline|10;the nightmare before christmas|10;corpse bride|25;monster house|25;paranorman|45;frankenweenie|45;scooby doo on zombie island|65;the house|65'],
 ['Name an author famous for horror.','stephen king|10;edgar allan poe|10;h p lovecraft|25;mary shelley|25;shirley jackson|45;clive barker|45;anne rice|45;ramsey campbell|85;thomas ligotti|85'],
 ['Name a mythical undead being.','zombie|10;vampire|10;ghost|10;lich|25;wight|45;revenant|65;ghoul|25;draugr|85;skeleton|10'],
 ['Name a Halloween candy.','snickers|10;kit kat|10;twix|10;reeses|10;candy corn|10;milky way|25;butterfinger|25;tootsie roll|25;airheads|45;almond joy|45'],
 ['Name a horror movie villain.','ghostface|10;michael myers|10;freddy krueger|10;jason voorhees|10;chucky|10;pinhead|45;art the clown|25;norman bates|45;leatherface|25;the creeper|65'],
 ['Name a spooky tabletop monster.','vampire|10;lich|25;mind flayer|25;beholder|45;zombie|10;specter|25;wraith|25;death knight|65;night hag|65;demilich|85']
];
const winterPack=[
 ['Name a winter holiday movie.','home alone|10;elf|10;the polar express|25;the santa clause|25;love actually|45;the holiday|45;klaus|65;jingle all the way|45'],
 ['Name a winter sport.','skiing|10;snowboarding|10;ice hockey|10;figure skating|25;curling|45;bobsled|45;skeleton|65;biathlon|65'],
 ['Name something you find in a snowy landscape.','snowman|10;pine tree|10;icicle|25;glacier|25;avalanche|45;frozen lake|25;snow drift|45;snowshoe hare|85'],
 ['Name a winter holiday song.','jingle bells|10;silent night|10;last christmas|25;white christmas|25;let it snow|25;winter wonderland|25;carol of the bells|45;the first noel|45'],
 ['Name a winter-themed fictional character.','elsa|10;frosty|10;jack frost|25;olaf|10;santa claus|10;the grinch|25;ice king|45;sub zero|65'],
 ['Name a cold climate animal.','polar bear|10;penguin|10;arctic fox|25;reindeer|10;snowy owl|45;walrus|25;arctic hare|65;narwhal|45'],
 ['Name a winter drink.','hot chocolate|10;eggnog|25;mulled cider|25;chai latte|45;peppermint mocha|45;hot apple cider|25;ginger tea|65'],
 ['Name a snowy location in a video game.','skyrim|10;ice cap zone|45;frostpoint field|85;snowpeak ruins|65;mount lanayru|65;winterspring|45;frostfire ridge|85'],
 ['Name a winter holiday tradition.','gift giving|10;tree decorating|10;caroling|25;making snowmen|25;lighting candles|25;stockings|25;ice skating|45'],
 ['Name a winter dessert.','gingerbread|10;fruitcake|25;peppermint bark|25;panettone|45;yule log|45;stollen|65;sugar cookies|10;mince pies|45']
];
function installSeasonal(){
 const month=new Date().getUTCMonth()+1;
 const isHalloween=month===10,isWinter=month===12;
 const id=isHalloween?'halloween':isWinter?'winter':null;
 const name=isHalloween?'Halloween Rift':isWinter?'Winter Nebula':null;
 const pack=isHalloween?halloweenPack:isWinter?winterPack:null;
 if(!pack)return;
 MODES.push({id,name,icon:isHalloween?'🎃':'❄',desc:'Limited seasonal flight'});
 pack.forEach((pair,i)=>{
  const cat={tag:'vr-event-'+id+'-'+i,label:isHalloween?'HALLOWEEN RIFT':'WINTER NEBULA',prompt:pair[0],
   desc:'Seasonal edition · discover a rare answer.',hint:'Unusual correct answers carry your ship farther.',
   practiceGenre:id,ans:new Map()};
  pair[1].split(';').forEach(x=>{const parts=x.split('|');cat.ans.set(norm(parts[0]),{display:parts[0],score:Number(parts[1])})});
  CATEGORIES.push(cat);
 });
 const intro=$('intro')?.querySelector('.modal-panel');
 if(intro){
  const tile=section('<strong>'+(isHalloween?'🎃':'❄')+' '+name.toUpperCase()+' · LIMITED EVENT</strong>'+
   '<p>10 themed questions. Earn rare boosts and fly deeper into space. Unlimited Play; your daily mission stays separate.</p>'+
   '<button id="vr-launch-event">LAUNCH SEASONAL FLIGHT →</button>');
  tile.className='vr-event-tile';intro.append(tile);
  $('vr-launch-event').addEventListener('click',()=>{closePanel();practiceFlight(id)});
 }
}
function init(){
 try{installAnswerAliases()}catch(e){console.warn('Offline answer aliases unavailable',e)}
 try{installSeasonal()}catch(e){console.warn('Seasonal pack unavailable',e)}
 const tools=document.createElement('nav');tools.className='vr-tools vr-header';
 tools.setAttribute('aria-label','VOIDRIFT exploration tools');
 const commands=[['✦ STAR MAP',mapPanel],['📖 CAPTAIN’S LOG',journalPanel],['🚀 HANGAR',hangarPanel],['👥 CREW',crewPanel]];
 commands.unshift(['? HOW TO PLAY',tutorialPanel]);
 commands.forEach(([text,handler])=>{
  const btn=document.createElement('button');btn.className='vr-action';btn.type='button';
  btn.textContent=text;btn.onclick=handler;tools.append(btn);
 });
 $('app')?.append(tools);
 const overlay=document.createElement('div');overlay.className='vr-panel-overlay vr-hide';overlay.id='vr-overlay';
 overlay.innerHTML='<div class="vr-panel" role="dialog" aria-modal="true" aria-label="VOIDRIFT mission control" id="vr-dialog"></div>';
 overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel()});
 document.body.append(overlay);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.classList.contains('vr-hide'))closePanel()});
 const flash=document.createElement('div');flash.id='vr-jump-flash';document.body.append(flash);
 const actions=$('results')?.querySelector('.result-actions');
 if(actions){
  actions.append(uiButton('⬇ SHARE CARD',shareCardPanel));
  actions.append(uiButton('✦ STAR MAP',mapPanel));
  actions.append(uiButton('📖 CAPTAIN’S LOG',journalPanel));
  actions.append(uiButton('👥 MY CREW',crewPanel));
 }
 applyStyle();
 try{
  if(!localStorage.getItem('voidrift:training:v1')&&!state.started)tutorialPanel();
 }catch{}
 if(state?.finished)onFinish();
}
window.VOIDRIFT_EXPEDITION={onFinish,onAnswer,openMap:mapPanel,openJournal:journalPanel,openCrew:crewPanel,shareCard:shareCardPanel};
init();
})();
