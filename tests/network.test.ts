import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,chmod,stat,symlink,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import type {AddressInfo} from 'node:net';
import {hashPassword} from '../src/security/authentication.js';
import {loadConfig} from '../src/shared/config.js';
import {NetworkSettings} from '../src/security/network.js';
import {createHttpServer} from '../src/server/http.js';
const password='Network-Admin-Password-2026!';
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'vpsmcp-network-'));
 const cfg=loadConfig({ADMIN_PASSWORD_HASH:hashPassword(password),
  MCP_NETWORK_DRAFT_FILE:path.join(dir,'network-draft.json'),
  MCP_AUDIT_FILE:path.join(dir,'audit.jsonl'),MCP_STATE_FILE:path.join(dir,'oauth.json'),
  MCP_POLICY_FILE:path.join(dir,'policy.json'),MCP_CONTROL_FILE:path.join(dir,'control.json'),
  MCP_BIND_PORT:'3000'});
 return {dir,cfg};
}
test('network plan validates domain, TLS mode and private host port; draft does not modify active server',async()=>{
 const {cfg}=await fixture();
 const network=new NetworkSettings(cfg);
 assert.equal(network.snapshot().applied.hostPort,3000);
 assert.equal(network.snapshot().draft.domain,'');
 assert.throws(()=>network.save({domain:'https://evil.example.com/path',hostPort:3333,sslMode:'external-https'}));
 assert.throws(()=>network.save({domain:'localhost',hostPort:3333,sslMode:'external-https'}));
 assert.throws(()=>network.save({domain:'mcp.example.com',hostPort:22,sslMode:'external-https'}));
 assert.throws(()=>network.save({domain:'',hostPort:3333,sslMode:'external-https'}));
 assert.throws(()=>network.save({domain:'mcp.example.com',hostPort:3333,sslMode:'unknown'}));
 network.save({domain:'MCP.EXAMPLE.COM',hostPort:3333,sslMode:'external-https'});
 assert.equal(network.snapshot().draft.domain,'mcp.example.com');
 assert.equal(network.snapshot().draft.hostPort,3333);
 assert.equal(network.snapshot().applied.hostPort,3000);
 assert.equal(network.snapshot().domainConfigured,false);
 assert.equal(network.snapshot().sslCertificateManaged,false);
 assert.equal((await stat(cfg.MCP_NETWORK_DRAFT_FILE)).mode&0o777,0o600);
 assert.equal(new NetworkSettings(cfg).snapshot().draft.hostPort,3333);
});
test('network draft rejects insecure preexisting storage and default DNS does not query remotely',async()=>{
 const {cfg,dir}=await fixture();
 const network=new NetworkSettings(cfg);
 assert.equal((await network.dnsCheck()).state,'not-configured');
 await symlink(path.join(dir,'other'),cfg.MCP_NETWORK_DRAFT_FILE);
 assert.throws(()=>new NetworkSettings(cfg),/private/);
});
test('network API requires admin session and CSRF, persists draft and does not enable HTTPS',async()=>{
 const {cfg}=await fixture();
 const app=createHttpServer(cfg);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const post=(cookie:string,csrf:string,data:unknown)=>fetch(base+'/api/network/plan',{
  method:'POST',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
  body:JSON.stringify(data)});
 try{
  assert.equal((await post('','',{})).status,401);
  assert.equal((await fetch(base+'/api/network/dns')).status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({username:'admin',password})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const {csrf}=await login.json() as {csrf:string};
  const plan={domain:'mcp.example.com',hostPort:3333,sslMode:'external-https'};
  assert.equal((await post(cookie,'invalid',plan)).status,403);
  assert.equal((await post(cookie,csrf,{...plan,hostPort:22})).status,400);
  const staged=await post(cookie,csrf,plan);
  assert.equal(staged.status,200);
  const stored=await staged.json() as {network:{draft:{hostPort:number},applied:{hostPort:number,ssl:string}}};
  assert.equal(stored.network.draft.hostPort,3333);
  assert.equal(stored.network.applied.hostPort,3000);
  assert.equal(stored.network.applied.ssl,'not-configured');
  const status=await fetch(base+'/api/status',{headers:{cookie}});
  assert.equal((await status.json() as {network:{draft:{domain:string}}}).network.draft.domain,'mcp.example.com');
 }finally{await app.shutdown();}
});

test('network change fails closed when a durable audit record cannot be written',async()=>{
 const {cfg}=await fixture();
 await mkdir(cfg.MCP_AUDIT_FILE);
 const app=createHttpServer(cfg);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 try{
  const login=await fetch(base+'/api/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const {csrf}=await login.json() as {csrf:string};
  const changed=await fetch(base+'/api/network/plan',{method:'POST',
   headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
   body:JSON.stringify({domain:'mcp.example.org',hostPort:4400,sslMode:'private-only'})});
  assert.equal(changed.status,503);
  await assert.rejects(access(cfg.MCP_NETWORK_DRAFT_FILE));
 }finally{await app.shutdown();}
});

test('network storage error returns 503 without claiming a staged setting',async()=>{
 const {cfg}=await fixture();
 const app=createHttpServer(cfg);
 await mkdir(cfg.MCP_NETWORK_DRAFT_FILE); // Appears after startup, blocks atomic rename.
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 try{
  const login=await fetch(base+'/api/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const {csrf}=await login.json() as {csrf:string};
  const result=await fetch(base+'/api/network/plan',{method:'POST',
   headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
   body:JSON.stringify({domain:'mcp.example.org',hostPort:3355,sslMode:'private-only'})});
  assert.equal(result.status,503);
  assert.equal((await result.json() as {error:string}).error,'network_storage_unavailable');
  assert.equal((await (await fetch(base+'/api/status',{headers:{cookie}})).json() as {network:{draft:{hostPort:number}}}).network.draft.hostPort,3000);
 }finally{await app.shutdown();}
});

test('manual domain management supports add, edit, remove, DNS configuration recommendations, and DNS/SSL check',async()=>{
 const {cfg}=await fixture();
 const app=createHttpServer(cfg);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 try{
  const login=await fetch(base+'/api/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const {csrf}=await login.json() as {csrf:string};
  const post=(data:unknown)=>fetch(base+'/api/network/domains',{
   method:'POST',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
   body:JSON.stringify(data)});
  // Add subdomain
  const addRes=await post({action:'add',domain:'MCP.EXAMPLE.COM'});
  assert.equal(addRes.status,200);
  const added=await addRes.json() as {domain:{id:string,domain:string,type:string,dnsStatus:string,sslStatus:string,dnsConfig:{records:Array<{type:string,name:string,value:string}>}},network:{domains:Array<{id:string,domain:string}>}};
  assert.equal(added.domain.domain,'mcp.example.com');
  assert.equal(added.domain.type,'subdomain');
  assert.equal(added.domain.dnsStatus,'pending');
  assert.equal(added.domain.sslStatus,'pending');
  assert.equal(added.domain.dnsConfig.records.some(r=>r.type==='CNAME'&&r.name==='mcp'),true);
  assert.equal(added.network.domains.length,1);
  // Edit domain to root domain
  const editRes=await post({action:'update',id:added.domain.id,domain:'example.org'});
  assert.equal(editRes.status,200);
  const edited=await editRes.json() as {domain:{id:string,domain:string,type:string,dnsConfig:{records:Array<{type:string,name:string}>}}};
  assert.equal(edited.domain.domain,'example.org');
  assert.equal(edited.domain.type,'root');
  assert.equal(edited.domain.dnsConfig.records.some(r=>r.type==='A'&&r.name==='@'),true);
  // Check DNS & SSL
  const checkRes=await post({action:'check',id:added.domain.id});
  assert.equal(checkRes.status,200);
  const checked=await checkRes.json() as {domain:{dnsStatus:string,sslStatus:string,updatedAt:string}};
  assert.ok(['verified','failed'].includes(checked.domain.dnsStatus));
  assert.ok(['active','pending','failed'].includes(checked.domain.sslStatus));
  assert.ok(checked.domain.updatedAt);
  // Remove domain
  const remRes=await post({action:'remove',id:added.domain.id});
  assert.equal(remRes.status,200);
  const removed=await remRes.json() as {network:{domains:Array<unknown>}};
  assert.equal(removed.network.domains.length,0);
 }finally{await app.shutdown();}
});

test('multi-part TLD classification and MCP_PUBLIC_IP target IP recommendation (BUG-05, BUG-11)',async()=>{
 const {dir}=await fixture();
 const cfg=loadConfig({ADMIN_PASSWORD_HASH:hashPassword(password),
  MCP_NETWORK_DRAFT_FILE:path.join(dir,'network-draft-uk.json'),
  MCP_AUDIT_FILE:path.join(dir,'audit.jsonl'),MCP_STATE_FILE:path.join(dir,'oauth.json'),
  MCP_POLICY_FILE:path.join(dir,'policy.json'),MCP_CONTROL_FILE:path.join(dir,'control.json'),
  MCP_BIND_PORT:'3000',MCP_PUBLIC_IP:'198.51.100.42'});
 const network=new NetworkSettings(cfg);
 const rootUk=network.addDomain('example.co.uk').domain;
 assert.equal(rootUk.type,'root');
 assert.equal(rootUk.dnsConfig.records[0]?.type,'A');
 assert.equal(rootUk.dnsConfig.records[0]?.name,'@');
 assert.equal(rootUk.dnsConfig.records[0]?.value,'198.51.100.42');
 assert.equal(rootUk.dnsConfig.records[1]?.name,'_vpsmcp-challenge');

 const subUk=network.addDomain('mcp.example.co.uk').domain;
 assert.equal(subUk.type,'subdomain');
 assert.equal(subUk.dnsConfig.records[0]?.type,'A');
 assert.equal(subUk.dnsConfig.records[0]?.name,'mcp');
 assert.equal(subUk.dnsConfig.records[0]?.value,'198.51.100.42');
 assert.equal(subUk.dnsConfig.records[1]?.type,'CNAME');
 assert.equal(subUk.dnsConfig.records[1]?.name,'mcp');
 assert.equal(subUk.dnsConfig.records[2]?.name,'_vpsmcp-challenge.mcp');
});

test('DNS and TLS verification checks actual target IP/TXT token and never fakes active SSL (BUG-03, BUG-04)',async()=>{
 const {dir}=await fixture();
 const cfg=loadConfig({ADMIN_PASSWORD_HASH:hashPassword(password),
  MCP_NETWORK_DRAFT_FILE:path.join(dir,'network-draft-verify.json'),
  MCP_AUDIT_FILE:path.join(dir,'audit.jsonl'),MCP_STATE_FILE:path.join(dir,'oauth.json'),
  MCP_POLICY_FILE:path.join(dir,'policy.json'),MCP_CONTROL_FILE:path.join(dir,'control.json'),
  MCP_BIND_PORT:'3000',MCP_PUBLIC_IP:'198.51.100.42'});

 let simulatedIps=['93.184.216.34'];
 let simulatedTxt:string[][]=[];
 let simulatedTls:{ok:boolean;status:'active'|'pending'|'failed';issuer:string;validTo:string}={
  ok:false,status:'pending',issuer:'TLS 443 unreachable',validTo:''
 };

 const network=new NetworkSettings(cfg,{
  resolve4:async()=>simulatedIps,
  resolve6:async()=>[],
  resolveCname:async()=>[],
  resolveTxt:async()=>simulatedTxt,
  checkTls:async()=>simulatedTls
 });

 const added=network.addDomain('app.example.com').domain;
 const challengeToken=added.dnsConfig.records.find(r=>r.type==='TXT')?.value||'';

 // 1. Resolves to third-party IP without matching target IP or TXT token -> must fail DNS & SSL
 const thirdPartyCheck=(await network.checkDomainDnsAndSsl(added.id)).domain;
 assert.equal(thirdPartyCheck.dnsStatus,'failed');
 assert.equal(thirdPartyCheck.sslStatus,'failed');
 assert.match(thirdPartyCheck.sslIssuer,/does not match server IP/);

 // 2. Resolves to configured target IP, but TLS 443 is unreachable -> DNS verified, SSL pending (NOT active)
 simulatedIps=['198.51.100.42'];
 const pendingSslCheck=(await network.checkDomainDnsAndSsl(added.id)).domain;
 assert.equal(pendingSslCheck.dnsStatus,'verified');
 assert.equal(pendingSslCheck.sslStatus,'pending');
 assert.equal(pendingSslCheck.sslIssuer,'TLS 443 unreachable');

 // 3. Resolves via proxy IP with valid TXT challenge token and valid TLS -> DNS verified, SSL active
 simulatedIps=['104.21.2.1'];
 simulatedTxt=[[challengeToken]];
 simulatedTls={ok:true,status:'active',issuer:"Let's Encrypt (TLS verified)",validTo:'2027-01-01T00:00:00.000Z'};
 const activeSslCheck=(await network.checkDomainDnsAndSsl(added.id)).domain;
 assert.equal(activeSslCheck.dnsStatus,'verified');
 assert.equal(activeSslCheck.sslStatus,'active');
 assert.equal(activeSslCheck.sslIssuer,"Let's Encrypt (TLS verified)");
});

test('POST /api/network/domains returns HTTP 503 network_storage_unavailable on disk write error (BUG-12)',async()=>{
 const {cfg}=await fixture();
 const app=createHttpServer(cfg);
 await mkdir(cfg.MCP_NETWORK_DRAFT_FILE); // Blocks atomic rename
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 try{
  const login=await fetch(base+'/api/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const {csrf}=await login.json() as {csrf:string};
  const res=await fetch(base+'/api/network/domains',{method:'POST',
   headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
   body:JSON.stringify({action:'add',domain:'mcp.example.com'})});
  assert.equal(res.status,503);
  assert.equal((await res.json() as {error:string}).error,'network_storage_unavailable');
 }finally{await app.shutdown();}
});

test('managed domains dynamically allow matching Host and HTTPS Origin headers while blocking unlisted hosts (BUG-06)',async()=>{
 const {cfg}=await fixture();
 const app=createHttpServer(cfg);
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const port=(app.server.address() as AddressInfo).port;
 const base='http://127.0.0.1:'+port;
 const httpRequestWithHeaders=async(reqPath:string,headers:Record<string,string>)=>{
  const {request}=await import('node:http');
  return new Promise<{status:number;body:string}>((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port,path:reqPath,method:'GET',headers},res=>{
    const chunks:Buffer[]=[];
    res.on('data',c=>chunks.push(Buffer.from(c)));
    res.on('end',()=>resolve({status:res.statusCode||0,body:Buffer.concat(chunks).toString('utf8')}));
   });
   req.on('error',reject);
   req.end();
  });
 };
 try{
  // Before adding mcp.example.com, requests with Host: mcp.example.com are rejected with 403
  const beforeHost=await httpRequestWithHeaders('/health',{Host:'mcp.example.com'});
  assert.equal(beforeHost.status,403);
  assert.equal(beforeHost.body,'Invalid host');

  // Login and add mcp.example.com via POST /api/network/domains
  const login=await fetch(base+'/api/login',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
  assert.equal(login.status,200);
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const {csrf}=await login.json() as {csrf:string};

  const addRes=await fetch(base+'/api/network/domains',{method:'POST',
   headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
   body:JSON.stringify({action:'add',domain:'mcp.example.com'})});
  assert.equal(addRes.status,200);
  const added=await addRes.json() as {domain:{id:string}};

  // Now requests with Host: mcp.example.com and Origin: https://mcp.example.com are accepted (200)
  const allowedHost=await httpRequestWithHeaders('/health',{Host:'mcp.example.com',Origin:'https://mcp.example.com'});
  assert.equal(allowedHost.status,200);

  // Unlisted external host or unlisted origin is still blocked with 403
  const unlistedHost=await httpRequestWithHeaders('/health',{Host:'unlisted.example.com'});
  assert.equal(unlistedHost.status,403);
  const unlistedOrigin=await httpRequestWithHeaders('/health',{Host:'mcp.example.com',Origin:'https://evil.example.com'});
  assert.equal(unlistedOrigin.status,403);

  // Removing the domain immediately revokes Host routing access
  const remRes=await fetch(base+'/api/network/domains',{method:'POST',
   headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},
   body:JSON.stringify({action:'remove',id:added.domain.id})});
  assert.equal(remRes.status,200);
  const afterRemove=await httpRequestWithHeaders('/health',{Host:'mcp.example.com'});
  assert.equal(afterRemove.status,403);
 }finally{await app.shutdown();}
});



