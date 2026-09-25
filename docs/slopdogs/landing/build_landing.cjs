// Baut/aktualisiert den Kennel slopdogs-landing: Content-Dog + vier Skin-Dogs + Lead (?look=).
// Idempotent: existierende Dogs (per displayName in list_nodes) werden per save_node aktualisiert.
const os = require('os'), fs = require('fs');
const TOK = require(os.homedir() + '/.claude.json').mcpServers['datadogs-int'].headers.Authorization.replace(/^Bearer /, '');
const B = 'https://datadogs-9qde.onrender.com/actions/';
async function call(tool, body) {
  const r = await fetch(B + tool, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(tool + ' ' + r.status + ' ' + t.slice(0, 400));
  return JSON.parse(t).result;
}
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

const LEAD = `var Q = typeof QueryRetriever !== 'undefined' && QueryRetriever ? QueryRetriever : {};
var S = {
  a: typeof SlopdogsLandingSkinA !== 'undefined' ? SlopdogsLandingSkinA : null,
  b: typeof SlopdogsLandingSkinB !== 'undefined' ? SlopdogsLandingSkinB : null,
  c: typeof SlopdogsLandingSkinC !== 'undefined' ? SlopdogsLandingSkinC : null,
  d: typeof SlopdogsLandingSkinD !== 'undefined' ? SlopdogsLandingSkinD : null
};
// Default-Look: c (Mixtape) — Entscheidung 10-0 (PLAN 8.19).
var look = String(Q.look || 'c').toLowerCase();
var html = S[look] || S.c || S.d || S.a || S.b;
if (!html || typeof html !== 'string') { throw new Error('SlopdogsLanding: kein Skin geliefert (look=' + look + ').'); }
return html;`;

async function upsertDog(displayName, code, parents, icon, description, existing) {
  const hit = existing.find(n => n.displayName === displayName);
  if (hit) {
    await call('save_node', { id: hit.lineageId, tsCodeBase64: b64(code), parentsRequired: parents, parentsOptional: [], visibility: 'public', icon, description });
    return hit.lineageId;
  }
  const n = await call('create_node', { displayName, tsCodeBase64: b64(code), parentsRequired: parents, visibility: 'public', icon, description });
  return n.lineageId;
}

(async () => {
  const list = await call('list_nodes', { search: 'SlopdogsLanding' });
  const existing = (Array.isArray(list) ? list : (list.nodes || list.items || [])).map(n => ({ displayName: n.displayName, lineageId: n.lineageId || n.id }));
  const content = await upsertDog('SlopdogsLandingContent', fs.readFileSync('landing_content.js', 'utf8'), [], '🧾', 'SlopDogs landing copy as pure data; the four skins render it.', existing);
  const skins = {};
  const meta = { a: ['Breakout', '🧱'], b: ['Zine', '🗞️'], c: ['Blueprint', '📐'], d: ['Neon Alley', '🌃'] };
  for (const k of ['a', 'b', 'c', 'd']) {
    const f = 'skin_' + k + '.js';
    if (!fs.existsSync(f)) { console.log('fehlt', f); continue; }
    skins[k] = await upsertDog('SlopdogsLandingSkin' + k.toUpperCase(), fs.readFileSync(f, 'utf8'), [content], meta[k][1], 'Landing skin ' + k.toUpperCase() + ' "' + meta[k][0] + '" rendering SlopdogsLandingContent.', existing);
  }
  const lead = await upsertDog('SlopdogsLandingLead', LEAD, [...Object.values(skins), 'QueryRetriever'], '🐕', 'Picks the landing skin by ?look=a|b|c|d (default c).', existing);
  const dogIds = [lead, content, ...Object.values(skins), 'base:QueryRetriever'];
  const nodes = [
    { id: lead, comment: 'Lead: waehlt den Skin per ?look=.' },
    { id: content, comment: 'Gemeinsamer Inhalt, eine Quelle fuer alle Looks.' },
    ...Object.entries(skins).map(([k, id]) => ({ id, comment: 'Skin ' + k.toUpperCase() + ' ' + meta[k][0] + '.' })),
    { id: 'base:QueryRetriever', comment: 'Traegt ?look= herein.' }
  ];
  const task = '## Wunsch\nDie SlopDogs-Landing ist selbst ein Kennel (10-0: "als landing page ein bereits existierenden kennel zu haben und dann zu wechseln"). Ein Inhalt, vier Looks, Umschalter per ?look=.\n\n## Was wir nicht wissen\nSpeicherkosten je Lauf (vier Skins laufen mit), Sichttest A/B im Browser.\n\n## Was wir dafuer brauchen\nFollies Content-Master und Skins vom 25.09.2026; Plan A030 P5.\n\n## Entscheidungen (grob)\nDefault-Look c (Mixtape), 10-0 PLAN 8.19. In P5: Seed im Repo, HTML-Memo, statischer Fallback.';
  let exists = true;
  try { await call('get_kennel', { id: 'slopdogs-landing' }); } catch (e) { exists = false; }
  const body = { id: 'slopdogs-landing', name: 'SlopDogs', emoji: '🐕', visibility: 'public', description: 'The SlopDogs landing page, served by SlopDogs itself. Switch looks with ?look=a|b|c|d.', dogIds, nodes, task };
  await call(exists ? 'update_kennel' : 'create_kennel', body);
  console.log(exists ? 'kennel aktualisiert' : 'kennel neu', 'skins:', Object.keys(skins).join(','));
})().catch(e => { console.error('FEHLER', e.message); process.exit(1); });
