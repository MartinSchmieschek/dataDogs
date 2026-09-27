// Grabstein (tombstone) fuer den stillgelegten dataDogs-Integrationsdienst.
//
// Der Dienst ist tot; er wurde als SlopDogs neu geboren. Dieser Branch (integration) baut und startet
// NICHTS ausser diesem einen, in sich geschlossenen Node-Server: keine App, keine DB, kein MCP, keine
// npm-Abhaengigkeit. Jeder HTTP-Zugriff auf jede URL bekommt 410 Gone plus Verweis auf die neue Adresse --
// Besucher als HTML-Seite, MCP-Clients als JSON-RPC-Fehler.

const http = require('http');

const NEW_URL = 'https://slopdogs.onrender.com';
const NEW_MCP = 'https://slopdogs.onrender.com/mcp';
const HEADLINE = 'This service has been killed. We are respawned as SlopDogs.';
const MCP_MESSAGE = HEADLINE + ' New MCP endpoint: ' + NEW_MCP;
const PORT = Number(process.env.PORT) || 10000;

/** Sieht der geparste Body wie ein JSON-RPC-Aufruf aus? Defensiv, wirft nie. */
function looksLikeJsonRpc(body) {
    if (!body || typeof body !== 'object') return false;
    return body.jsonrpc === '2.0' || typeof body.method === 'string';
}

/** Die eigenstaendige, dunkle HTML-Grabstein-Seite -- inline, kein externes Asset. */
function tombstoneHtml() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="8;url=${NEW_URL}">
<title>Service killed - respawned as SlopDogs</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body {
    background: #0b0d10;
    color: #e6e8eb;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px; box-sizing: border-box; text-align: center;
  }
  .stone { max-width: 560px; }
  h1 { font-size: 1.5rem; font-weight: 600; line-height: 1.35; margin: 0 0 16px; }
  p { color: #9aa2ad; margin: 0 0 28px; line-height: 1.6; }
  a.btn {
    display: inline-block; padding: 12px 22px; border-radius: 8px;
    background: #4f8cff; color: #fff; text-decoration: none; font-weight: 600;
  }
  a.btn:hover { background: #3a78ef; }
  .plain { margin-top: 20px; font-size: 0.9rem; color: #6b7280; }
  .plain a { color: #8ab4ff; }
</style>
</head>
<body>
  <main class="stone">
    <h1>${HEADLINE}</h1>
    <p>We are respawned as SlopDogs. You are being redirected in a few seconds.</p>
    <a class="btn" href="${NEW_URL}">Go to SlopDogs</a>
    <p class="plain">New address: <a href="${NEW_URL}">${NEW_URL}</a></p>
  </main>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    // Body defensiv einsammeln (fuer die JSON-RPC-id), gedeckelt -- der Grabstein liest nie mehr als noetig.
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
        size += c.length;
        if (size > 1_000_000) { tooBig = true; return; }
        chunks.push(c);
    });
    req.on('end', () => {
        let body = null;
        if (!tooBig && chunks.length) {
            try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = null; }
        }

        const url = req.url || '/';
        const path = url.split('?')[0];
        const isMcpPath = path === '/mcp' || path.startsWith('/mcp/');
        const accept = String(req.headers['accept'] || '');
        const acceptsJson = accept.includes('application/json');
        const isJsonRpc = looksLikeJsonRpc(body);

        res.statusCode = 410;
        res.setHeader('Link', `<${NEW_URL}>; rel="alternate"`);

        // MCP-Client: JSON-RPC-Fehlerobjekt mit der eingehenden id (oder null).
        if (isMcpPath || isJsonRpc) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: (body && 'id' in body) ? body.id : null,
                error: {
                    code: -32000,
                    message: MCP_MESSAGE,
                    data: { newUrl: NEW_URL, newMcp: NEW_MCP },
                },
            }));
            return;
        }

        // Sonstige JSON-Anfrage: schlichtes Fehlerobjekt.
        if (acceptsJson) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: HEADLINE, newUrl: NEW_URL, newMcp: NEW_MCP }));
            return;
        }

        // Besucher: dunkle, in sich geschlossene HTML-Seite mit meta-refresh.
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(tombstoneHtml());
    });
    req.on('error', () => { try { res.statusCode = 410; res.end(); } catch { /* ignore */ } });
});

server.listen(PORT, () => {
    console.log(`[tombstone] SlopDogs tombstone listening on :${PORT} -> ${NEW_URL}`);
});
