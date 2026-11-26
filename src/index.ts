import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadConfig } from './shared/config.js';
import { hashPassword } from './security/authentication.js';
import { listenServer } from './server/http.js';

export function applyRuntimeDefaults(env: NodeJS.ProcessEnv = process.env) {
  for (const [key, val] of Object.entries(env)) {
    if (val === '' && (key.startsWith('MCP_') || key.startsWith('ADMIN_') || key.startsWith('OAUTH_'))) {
      delete env[key];
    }
  }
  const isProd = env.NODE_ENV === 'production';
  if (isProd) {
    // Production mode: strictly disallow demo auth mode and require real configured or persisted state.
    if (env.MCP_AUTH_MODE === 'demo') {
      throw new Error('Demo auth mode cannot run when NODE_ENV=production');
    }
    env.MCP_AUTH_MODE = 'production';
    const stateFile = env.MCP_ADMIN_STATE_FILE || './data/admin.json';
    const markerFile = stateFile + '.complete';
    if (!env.ADMIN_PASSWORD_HASH && !env.MCP_SETUP_TOKEN_HASH && !existsSync(stateFile) && !existsSync(markerFile)) {
      const generatedToken = env.MCP_SETUP_TOKEN || randomBytes(24).toString('hex');
      env.MCP_SETUP_TOKEN_HASH = createHash('sha256').update(generatedToken).digest('hex');
      process.stderr.write(`[VPS-MCP PRODUCTION BOOTSTRAP] First-time setup token generated: ${generatedToken}\n`);
    }
    return;
  }
  // Development / Local mode: never run production mode unless explicitly forced; activate Demo Auth mode.
  process.env.NODE_ENV = 'development';
  process.env.MCP_AUTH_MODE = 'demo';
  const hasTls = Boolean(process.env.MCP_TLS_CERT_FILE && process.env.MCP_TLS_KEY_FILE);
  if (!hasTls) {
    process.env.MCP_HOST = '0.0.0.0';
    process.env.MCP_PRIVATE_CONTAINER = 'true';
    process.env.MCP_PUBLIC_URL = `http://127.0.0.1:${process.env.MCP_PORT || '3000'}`;
  }
  const stateFile = process.env.MCP_ADMIN_STATE_FILE || './data/admin.json';
  if (!process.env.ADMIN_PASSWORD_HASH && !process.env.MCP_SETUP_TOKEN_HASH && !existsSync(stateFile)) {
    const defaultToken = process.env.MCP_SETUP_TOKEN || 'vps-mcp-setup-2026';
    process.env.MCP_SETUP_TOKEN_HASH = createHash('sha256').update(defaultToken).digest('hex');
    process.env.ADMIN_PASSWORD_HASH = hashPassword('AdminControl#2026');
  }
}

async function main() {
  applyRuntimeDefaults();
  const config=loadConfig();
  const app=await listenServer(config);
  process.stderr.write(`VPS-MCP listening on ${app.url} (public origin: ${config.origin})\n`);
  let stopping=false;
  const stop=async()=>{
    if(stopping)return;
    stopping=true;
    try{await app.shutdown();process.exitCode=0;}
    catch{process.stderr.write('Shutdown failed\n');process.exitCode=1;}
  };
  process.on('SIGINT',()=>{void stop();});
  process.on('SIGTERM',()=>{void stop();});
}
const isDirectEntry = Boolean(process.argv[1] && /(?:^|[\\/])index\.[tj]s$/.test(process.argv[1]));
if (isDirectEntry) {
  main().catch((err)=>{process.stderr.write(`MCP startup failed; check configuration and certificate paths. ${err instanceof Error ? err.message : ''}\n`);process.exitCode=1;});
}

