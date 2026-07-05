/**
 * MCP gateway integration test (POST /mcp).
 *
 * Voraussetzung: API läuft (z. B. npm run dev / start:integration).
 *
 *   node mcp/integration/mcp-gateway.integration.cjs
 *   npm run test:mcp:integration
 *
 * Env:
 *   MCP_BASE   — Default http://127.0.0.1:3000
 *   MCP_PATH   — Default /mcp
 *   MCP_BEARER — optional (MCP_AUTH_REQUIRED / Integration)
 *   KENNEL_ID  — Default weather-kennel (Snapshot + execute)
 */
'use strict';

const http = require('http');
const https = require('https');

const MCP_BASE = (process.env.MCP_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const MCP_PATH = process.env.MCP_PATH || '/mcp';
const KENNEL_ID = process.env.KENNEL_ID || 'weather-kennel';
const bearer = process.env.MCP_BEARER || process.env.DATADOGS_MCP_BEARER || '';

const REQUIRED_TOOLS = [
  'health_check',
  'get_readme',
  'describe_tool',
  'list_kennels',
  'list_nodes',
  'execute_kennel',
  'refresh_kennel_snapshot',
  'wait_for_kennel_snapshot',
  'get_kennel_snapshot_lead_result',
  'get_snapshot_errors',
];

let rpcId = 0;
const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function parseSseJson(raw) {
  const lines = raw.split(/\r?\n/);
  const dataLines = lines.filter((l) => l.startsWith('data:'));
  if (dataLines.length === 0) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const last = dataLines[dataLines.length - 1].replace(/^data:\s*/, '');
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

function toolTextContent(envelope) {
  const content = envelope?.result?.content;
  if (!Array.isArray(content) || !content[0]) return null;
  const block = content[0];
  if (block.type !== 'text') return null;
  const t = block.text;
  if (typeof t !== 'string') return t;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

function mcpRequest(method, params) {
  const id = ++rpcId;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const u = new URL(MCP_PATH.replace(/^\//, ''), MCP_BASE + '/');
  const lib = u.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(body),
          ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, raw, envelope: parseSseJson(raw) });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function mcpCall(toolName, args = {}) {
  const { status, raw, envelope } = await mcpRequest('tools/call', {
    name: toolName,
    arguments: args,
  });
  if (status !== 200) {
    throw new Error(`${toolName}: HTTP ${status} — ${raw.slice(0, 400)}`);
  }
  if (!envelope) {
    throw new Error(`${toolName}: no JSON in response — ${raw.slice(0, 400)}`);
  }
  if (envelope.error) {
    throw new Error(`${toolName}: ${JSON.stringify(envelope.error)}`);
  }
  if (envelope.result?.isError) {
    const t = toolTextContent(envelope);
    throw new Error(`${toolName}: tool error — ${typeof t === 'string' ? t : JSON.stringify(t)}`);
  }
  return toolTextContent(envelope);
}

function shallowEqualLead(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ca = a.current;
  const cb = b.current;
  if (!ca || !cb) return false;
  return ca.temperature === cb.temperature && ca.weatherCode === cb.weatherCode;
}

async function run() {
  console.log(`MCP integration → ${MCP_BASE}${MCP_PATH.startsWith('/') ? '' : '/'}${MCP_PATH}`);
  console.log(`Kennel probe: ${KENNEL_ID}\n`);

  // initialize
  try {
    const { status, envelope } = await mcpRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-gateway.integration', version: '1.0' },
    });
    if (status !== 200) {
      fail('initialize', `HTTP ${status}`);
    } else if (!envelope?.result?.serverInfo) {
      fail('initialize', 'missing serverInfo');
    } else {
      const si = envelope.result.serverInfo;
      pass('initialize', `${si.name} ${si.version}`);
    }
  } catch (e) {
    fail('initialize', e.message);
    throw e;
  }

  // tools/list
  let toolNames = [];
  try {
    const { status, envelope } = await mcpRequest('tools/list', {});
    if (status !== 200 || !envelope?.result?.tools) {
      fail('tools/list', `HTTP ${status}`);
    } else {
      toolNames = envelope.result.tools.map((t) => t.name);
      pass('tools/list', `${toolNames.length} tools`);
      const missing = REQUIRED_TOOLS.filter((n) => !toolNames.includes(n));
      if (missing.length) {
        fail('tools/list required', `missing: ${missing.join(', ')}`);
      } else {
        pass('tools/list required', REQUIRED_TOOLS.length + ' core tools');
      }
    }
  } catch (e) {
    fail('tools/list', e.message);
  }

  // health_check
  try {
    const h = await mcpCall('health_check', {});
    if (h?.ok !== true) fail('health_check', JSON.stringify(h));
    else pass('health_check', h.serverTime || 'ok');
  } catch (e) {
    fail('health_check', e.message);
  }

  // get_readme
  try {
    const readme = await mcpCall('get_readme', {});
    if (typeof readme !== 'string' || readme.length < 200) {
      fail('get_readme', 'too short or not text');
    } else {
      pass('get_readme', `${readme.length} chars`);
    }
  } catch (e) {
    fail('get_readme', e.message);
  }

  // describe_tool
  try {
    const d = await mcpCall('describe_tool', { name: 'execute_kennel' });
    if (!d?.name || !d?.inputSchema) fail('describe_tool', 'missing schema');
    else pass('describe_tool', d.name);
  } catch (e) {
    fail('describe_tool', e.message);
  }

  // list_kennels
  let kennels = [];
  try {
    kennels = await mcpCall('list_kennels', {});
    if (!Array.isArray(kennels)) fail('list_kennels', 'not an array');
    else pass('list_kennels', `${kennels.length} packs`);
  } catch (e) {
    fail('list_kennels', e.message);
  }

  const hasProbe = kennels.some((k) => k.lineageId === KENNEL_ID);
  if (kennels.length && !hasProbe) {
    fail('list_kennels probe', `${KENNEL_ID} not visible`);
  } else if (hasProbe) {
    pass('list_kennels probe', KENNEL_ID);
  }

  // list_nodes (first page)
  try {
    const nodes = await mcpCall('list_nodes', {});
    const total = nodes?.total ?? nodes?.nodes?.length;
    if (!nodes?.nodes?.length) fail('list_nodes', 'empty');
    else pass('list_nodes', `page ${nodes.nodes.length}, total ${total ?? '?'}`);
  } catch (e) {
    fail('list_nodes', e.message);
  }

  const query = { lat: '50.1109', lng: '8.6821' };

  // snapshot pipeline
  try {
    const refresh = await mcpCall('refresh_kennel_snapshot', { id: KENNEL_ID, query });
    if (refresh?.status !== 'running' && refresh?.status !== 'ok') {
      fail('refresh_kennel_snapshot', JSON.stringify(refresh));
    } else {
      pass('refresh_kennel_snapshot', refresh.status);
    }

    const waited = await mcpCall('wait_for_kennel_snapshot', { id: KENNEL_ID });
    if (!waited?.status || waited.status === 'running') {
      fail('wait_for_kennel_snapshot', JSON.stringify(waited));
    } else {
      pass('wait_for_kennel_snapshot', `${waited.status} (${waited.durationMs ?? '?'} ms)`);
    }

    const errors = await mcpCall('get_snapshot_errors', { id: KENNEL_ID });
    if (Array.isArray(errors) && errors.length > 0) {
      fail('get_snapshot_errors', `${errors.length} error(s)`);
    } else {
      pass('get_snapshot_errors', 'none');
    }

    const snapLead = await mcpCall('get_kennel_snapshot_lead_result', { id: KENNEL_ID });
    if (!snapLead?.leadResult?.current) {
      fail('get_kennel_snapshot_lead_result', 'no lead current');
    } else {
      pass(
        'get_kennel_snapshot_lead_result',
        `${snapLead.leadResult.current.temperature}°C ${snapLead.leadResult.current.weatherDescription || ''}`.trim(),
      );
    }

    const execLead = await mcpCall('execute_kennel', { id: KENNEL_ID, query });
    if (!execLead?.current) {
      fail('execute_kennel', 'no current');
    } else {
      pass('execute_kennel', `${execLead.current.temperature}°C`);
    }

    if (snapLead?.leadResult && execLead && !shallowEqualLead(snapLead.leadResult, execLead)) {
      fail('lead coherence', 'snapshot lead ≠ execute_kennel');
    } else if (snapLead?.leadResult && execLead) {
      pass('lead coherence', 'snapshot ≡ execute');
    }
  } catch (e) {
    fail('snapshot pipeline', e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length) {
    console.error(`FAILED: ${failed.length}/${results.length} checks`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASSED: ${results.length}/${results.length} checks`);
}

run().catch((e) => {
  console.error('\nFatal:', e.message);
  if (e.code === 'ECONNREFUSED') {
    console.error('API nicht erreichbar — zuerst npm run dev oder npm run start:integration.');
  }
  process.exitCode = 1;
});
