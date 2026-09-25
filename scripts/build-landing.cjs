// Baut den statischen Fallback der Landing (PLAN P5): public/landing/index.html = der Default-Look (c Mixtape),
// gerendert aus denselben Quellen wie der Kennel slopdogs-landing (seed-data/kennels/slopdogs-landing/).
// Kein Kennel-Lauf, keine DB: Content-, Skin- und Lead-Code laufen hier wie im VM-Worker (sucrase, dann eine
// async-Huelle, Parents als Globals) — nur ohne Isolation, es ist unser eigener Code aus dem Repo.
// Deterministisch: gleiche Quellen, gleiche Bytes. Aufruf: `node scripts/build-landing.cjs` (Teil von npm run build).
'use strict';
const fs = require('fs');
const path = require('path');
const { transform } = require('sucrase');

const SOURCE_DIR = path.join(__dirname, '..', 'seed-data', 'kennels', 'slopdogs-landing');
const OUT_FILE = path.join(__dirname, '..', 'public', 'landing', 'index.html');
const DEFAULT_LOOK = 'c';
const LOOKS = ['a', 'b', 'c', 'd'];

function source(fileName) {
    return fs.readFileSync(path.join(SOURCE_DIR, fileName), 'utf8');
}

/** Ein Dog-Rumpf wie im Worker: TypeScript-Strip, `(async () => { … })()`, Parents als Globals. */
async function runDog(fileName, globals) {
    const code = transform(source(fileName), { transforms: ['typescript'] }).code;
    const names = Object.keys(globals);
    const run = new Function(...names, `return (async () => { ${code}\n})();`);
    return run(...names.map((name) => globals[name]));
}

/** Die Lead-Ausgabe fuer einen Look — dieselbe Seite, die der Kennel fuer ?look=<look> liefert. */
async function renderLook(look) {
    const content = await runDog('content.js', {});
    const skins = {};
    for (const key of LOOKS) {
        skins[`SlopdogsLandingSkin${key.toUpperCase()}`] = await runDog(`skin_${key}.js`, { SlopdogsLandingContent: content });
    }
    return runDog('lead.js', { QueryRetriever: { look }, ...skins });
}

async function main() {
    const html = await renderLook(DEFAULT_LOOK);
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, html, 'utf8');
    console.log(`[build-landing] ${path.relative(process.cwd(), OUT_FILE)}: look ${DEFAULT_LOOK}, ${Buffer.byteLength(html, 'utf8')} B`);
}

module.exports = { renderLook, DEFAULT_LOOK, OUT_FILE };

if (require.main === module) {
    main().catch((err) => {
        console.error('[build-landing]', err);
        process.exit(1);
    });
}
