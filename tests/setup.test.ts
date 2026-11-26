import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {type AddressInfo} from 'node:net';
import {loadConfig} from '../src/shared/config.js';
import {createHttpServer} from '../src/server/http.js';

test('private container config allows loopback origin with internal bind, but public plaintext is denied',()=>{
 const token=randomBytes(32).toString('hex');
 const base={MCP_HOST:'0.0.0.0',MCP_PORT:'3000',MCP_SETUP_TOKEN_HASH:createHash('sha256').update(token).digest('hex')};
 assert.throws(()=>loadConfig({...base,MCP_PUBLIC_URL:'http://127.0.0.1:3000'}));
 assert.throws(()=>loadConfig({...base,MCP_PRIVATE_CONTAINER:'true',MCP_PUBLIC_URL:'http://example.com'}));
 assert.equal(loadConfig({...base,MCP_PRIVATE_CONTAINER:'true',MCP_PUBLIC_URL:'http://127.0.0.1:3000'}).origin,'http://127.0.0.1:3000');
});

test('first installation denies login and MCP until authenticated one-time admin setup',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vpsmcp-setup-'));
 const token=randomBytes(32).toString('hex');
 const cfg=loadConfig({
  MCP_SETUP_TOKEN_HASH:createHash('sha256').update(token).digest('hex'),
  MCP_ADMIN_STATE_FILE:path.join(dir,'admin.json'),
  MCP_CONTROL_FILE:path.join(dir,'control.json'),
  MCP_STATE_FILE:path.join(dir,'oauth.json'),
  MCP_POLICY_FILE:path.join(dir,'policy.json'),
  MCP_AUDIT_FILE:path.join(dir,'audit.jsonl')
 });
 const app=createHttpServer(cfg);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const post=(route:string,data:unknown)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 try{
  assert.deepEqual(await (await fetch(base+'/api/setup/status')).json(),{required:true,username:'admin'});
  assert.equal((await post('/api/login',{username:'admin',password:'Pass@123'})).status,503);
  assert.equal((await post('/api/setup',{token:'wrong',username:'admin',password:'My-Unique-Passphrase#2026',confirm:'My-Unique-Passphrase#2026'})).status,403);
  assert.equal((await post('/api/setup',{token,username:'admin',password:'Pass@123',confirm:'Pass@123'})).status,403);
  assert.equal((await post('/api/setup',{token,username:'admin',password:'My-Unique-Passphrase#2026',confirm:'My-Unique-Passphrase#2026'})).status,200);
  assert.equal((await post('/api/setup',{token,username:'newadmin',password:'Other-Unique-Passphrase#2026',confirm:'Other-Unique-Passphrase#2026'})).status,409);
  assert.equal((await post('/api/login',{username:'admin',password:'Pass@123'})).status,401);
  assert.equal((await post('/api/login',{username:'admin',password:'My-Unique-Passphrase#2026'})).status,200);
  assert.deepEqual(await (await fetch(base+'/api/setup/status')).json(),{required:false});
  const stored=await readFile(cfg.MCP_ADMIN_STATE_FILE,'utf8');
  assert.equal(stored.includes('My-Unique-Passphrase#2026'),false);
  assert.equal((await stat(cfg.MCP_ADMIN_STATE_FILE)).mode&0o777,0o600);
 }finally{await app.shutdown();}
 const restarted=createHttpServer(cfg);
 try{assert.equal(restarted.oauth.stats().clients,0);}finally{await restarted.shutdown().catch(()=>undefined);}
});

test('configuration with no pre-existing admin hash or setup token fails closed',()=>{
 assert.throws(()=>createHttpServer(loadConfig({})),/installer-generated setup token hash/);
});

test('deleting admin credentials after setup does not reopen the bootstrap endpoint',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vpsmcp-state-loss-'));
 const token=randomBytes(32).toString('hex');
 const cfg=loadConfig({
   MCP_SETUP_TOKEN_HASH:createHash('sha256').update(token).digest('hex'),
   MCP_ADMIN_STATE_FILE:path.join(dir,'admin.json'),
   MCP_CONTROL_FILE:path.join(dir,'control.json'),
   MCP_STATE_FILE:path.join(dir,'oauth.json'),
   MCP_POLICY_FILE:path.join(dir,'policy.json'),
   MCP_AUDIT_FILE:path.join(dir,'audit.jsonl')
 });
 const first=createHttpServer(cfg);
 await new Promise<void>(resolve=>first.server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+(first.server.address() as AddressInfo).port;
  const result=await fetch(base+'/api/setup',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({token,username:'admin',password:'UniqueSecurePassphrase#2026!',
      confirm:'UniqueSecurePassphrase#2026!'})
  });
  assert.equal(result.status,200);
 }finally{await first.shutdown();}
 assert.equal((await stat(cfg.MCP_ADMIN_STATE_FILE+'.complete')).mode&0o777,0o600);
 await (await import('node:fs/promises')).unlink(cfg.MCP_ADMIN_STATE_FILE);
 assert.throws(()=>createHttpServer(cfg),/Previously initialized admin state is missing/);
});

test('demo auth mode works in development and is strictly rejected in NODE_ENV=production',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vpsmcp-authmode-'));
 assert.throws(()=>loadConfig({NODE_ENV:'production',MCP_AUTH_MODE:'demo'}),/Demo auth mode is forbidden/);
 const prodCfg=loadConfig({NODE_ENV:'production'});
 assert.equal(prodCfg.authMode,'production');
 assert.throws(()=>createHttpServer(prodCfg),/installer-generated setup token hash/);

 const demoCfg=loadConfig({
  NODE_ENV:'development',
  MCP_AUTH_MODE:'demo',
  MCP_ADMIN_STATE_FILE:path.join(dir,'admin.json'),
  MCP_CONTROL_FILE:path.join(dir,'control.json'),
  MCP_STATE_FILE:path.join(dir,'oauth.json'),
  MCP_POLICY_FILE:path.join(dir,'policy.json'),
  MCP_AUDIT_FILE:path.join(dir,'audit.jsonl')
 });
 assert.equal(demoCfg.authMode,'demo');
 const app=createHttpServer(demoCfg);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 try{
  const status=await (await fetch(base+'/api/setup/status')).json() as Record<string,unknown>;
  assert.equal(status.required,false);
  assert.equal(status.authMode,'demo');
  // Demo mode must still enforce real scrypt password verification and reject wrong passwords (BUG-09)
  const badLogin=await fetch(base+'/api/login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({username:'admin',password:'wrong-password'})
  });
  assert.equal(badLogin.status,401);
  const loginRes=await fetch(base+'/api/login',{
   method:'POST',headers:{'content-type':'application/json','x-forwarded-host':'localhost:3000'},
   body:JSON.stringify({username:'admin',password:'AdminControl#2026'})
  });
  assert.equal(loginRes.status,200);
  // Plain HTTP with X-Forwarded-Host must NOT set Secure; SameSite=None (BUG-07)
  const setCookie=loginRes.headers.get('set-cookie')||'';
  assert.equal(setCookie.includes('SameSite=Strict'),true);
  assert.equal(setCookie.includes('SameSite=None'),false);
  const loginBody=await loginRes.json() as {ok:boolean;csrf:string;sessionToken:string};
  assert.ok(loginBody.sessionToken);
  // Session can authenticate via x-session-token even without cookie header (BUG-02)
  const sessionViaHeader=await fetch(base+'/api/session',{
   headers:{'x-session-token':loginBody.sessionToken}
  });
  assert.equal(sessionViaHeader.status,200);
 }finally{await app.shutdown();}
});

test('applyRuntimeDefaults auto-generates setup token hash on fresh NODE_ENV=production boot when no admin state exists',async()=>{
 const {applyRuntimeDefaults}=await import('../src/index.js');
 const dir=await mkdtemp(path.join(tmpdir(),'vpsmcp-prodboot-'));
 const env:NodeJS.ProcessEnv={
  NODE_ENV:'production',
  MCP_ADMIN_STATE_FILE:path.join(dir,'admin.json'),
  MCP_SETUP_TOKEN:'custom-prod-bootstrap-token-2026'
 };
 applyRuntimeDefaults(env);
 assert.equal(env.MCP_AUTH_MODE,'production');
 assert.equal(env.MCP_SETUP_TOKEN_HASH,createHash('sha256').update('custom-prod-bootstrap-token-2026').digest('hex'));
});



