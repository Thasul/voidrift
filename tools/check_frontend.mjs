import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root),'utf8');
const source = read('public/index.html');
const cloud = read('public/cloud.js');
const cfg = read('public/config.js');
const expedition = read('public/expedition.js');
const expeditionCSS = read('public/expedition.css');
const checks = [
  [source.includes('const DAILY_CATEGORIES'), 'Daily challenge remains available'],
  [source.includes('const BONUS_QUESTIONS'), 'Unlimited questions exist'],
  [source.includes('id="accountBtn"') && source.includes('id="leaderboardBtn"'), 'Cloud/account UI exists'],
  [source.includes('id="spellPanel"'), 'Spelling correction UI exists'],
  [cloud.includes('submitOnline') && cloud.includes('showCloudSuggestions'), 'Cloud scoring and suggestions exist'],
  [source.includes('id="rarityExplorer"') && source.includes('exploreRarity'), 'Post-daily Rarity Explorer exists'],
  [source.includes('src="./expedition.js"') && source.includes('href="./expedition.css"'), 'Expedition game extension loaded'],
  [expedition.includes('function mapPanel(') && expedition.includes('function journalPanel(') && expedition.includes('function crewPanel('), 'Map, captain log and crews exist'],
  [expedition.includes('function shareCardPanel(') && expedition.includes('function hangarPanel('), 'Share cards and cosmetic hangar exist'],
  [expeditionCSS.includes('.vr-map-track') && expeditionCSS.includes('.vr-panel-overlay'), 'Responsive expedition style exists'],
  [cloud.includes('async function rarity(tag,answer)'), 'Rarity Explorer calls server for cloud scores'],
  [!cfg.includes('service_role:') && !cfg.includes('sk-proj-'), 'No obvious secret key in browser config'],
];
for (const [ok, label] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ': ' + label); if (!ok) process.exitCode = 1; }
const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const tmp=mkdtempSync(join(tmpdir(),'voidrift-check-'));
try {
  for (const [idx, script] of scripts.entries()) {
    if (!script.trim()) continue;
    const file=join(tmp, `inline-${idx}.js`); writeFileSync(file,script);
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(checked.status!==0){ console.error(checked.stderr);process.exitCode=1; }
  }
  for (const extra of ['public/cloud.js','public/expedition.js']) {
  const file=new URL(extra,root).pathname;
  const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(checked.status!==0){ console.error(extra+': '+checked.stderr);process.exitCode=1; }
  }
} finally { rmSync(tmp,{recursive:true,force:true}); }
console.log('JavaScript syntax checks completed.');
