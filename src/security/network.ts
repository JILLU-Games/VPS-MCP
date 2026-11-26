import {existsSync,lstatSync,mkdirSync,readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {resolve4,resolve6,resolveCname,resolveTxt} from 'node:dns/promises';
import {isIP} from 'node:net';
import os from 'node:os';
import tls from 'node:tls';
import path from 'node:path';
import * as z from 'zod/v4';
import type {AppConfig} from '../shared/config.js';

export class NetworkStorageError extends Error {
 constructor(message='Network storage unavailable'){super(message);}
}

const hostname=z.string().max(253).trim().toLowerCase().refine(value=>{
 if(!value)return true;
 if(value.includes('..')||value.endsWith('.')||value.includes('_'))return false;
 const parts=value.split('.');
 return parts.length>=2 && parts.every(part=>part.length>=1 && part.length<=63 &&
 /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part)) &&
 !['localhost','local','internal','test','invalid','example'].includes(parts.at(-1)!);
},'Enter a public domain, not a URL or local name');
const requiredHostname=hostname.refine(v=>v.length>0,'Domain is required');
const domainItemSchema=z.object({
 id:z.string().min(4).max(64),
 domain:requiredHostname,
 type:z.enum(['root','subdomain']),
 dnsStatus:z.enum(['pending','verified','failed']).default('pending'),
 sslStatus:z.enum(['pending','active','failed']).default('pending'),
 resolvedIps:z.array(z.string()).default([]),
 resolvedCnames:z.array(z.string()).default([]),
 sslIssuer:z.string().default(''),
 sslValidTo:z.string().default(''),
 verifyToken:z.string().default(''),
 updatedAt:z.string()
});
export type ManagedDomain=z.infer<typeof domainItemSchema>;
const schema=z.object({version:z.literal(1),domain:hostname,
 hostPort:z.number().int().min(1024).max(65535),
 sslMode:z.enum(['private-only','external-https']),
 domains:z.array(domainItemSchema).optional()}).strict();
export type NetworkPlan=z.infer<typeof schema>;

const MULTI_PART_TLDS=new Set([
 'co.uk','org.uk','gov.uk','ac.uk','me.uk','net.uk',
 'com.bd','net.bd','org.bd','edu.bd','gov.bd','ac.bd',
 'com.au','net.au','org.au','edu.au','gov.au',
 'co.in','net.in','org.in','ac.in','gov.in',
 'co.jp','ne.jp','or.jp','ac.jp','go.jp',
 'co.nz','net.nz','org.nz','govt.nz',
 'co.za','net.za','org.za','gov.za',
 'com.br','net.br','org.br','gov.br',
 'com.sg','net.sg','org.sg','edu.sg',
 'com.my','net.my','org.my','edu.my',
 'com.hk','net.hk','org.hk','edu.hk',
 'com.tr','net.tr','org.tr','edu.tr',
 'com.pk','net.pk','org.pk','edu.pk',
 'com.ng','net.ng','org.ng','edu.ng'
]);

export function rootLabelCount(domain:string):number{
 const parts=domain.toLowerCase().split('.');
 if(parts.length>=3){
  const lastTwo=parts.slice(-2).join('.');
  if(MULTI_PART_TLDS.has(lastTwo) || /^(?:co|com|net|org|edu|gov|ac|mil)\.[a-z]{2}$/.test(lastTwo)){
   return 3;
  }
 }
 return 2;
}

export function classifyDomain(domain:string):'root'|'subdomain'{
 const parts=domain.toLowerCase().split('.');
 return parts.length>rootLabelCount(domain)?'subdomain':'root';
}

export function detectServerTargetIp(config:AppConfig,originHost:string):{targetIp:string;explicitIp:string}{
 const configured=(config.MCP_PUBLIC_IP||'').trim();
 if(configured && isIP(configured)===4 && configured!=='127.0.0.1'){
  return {targetIp:configured,explicitIp:configured};
 }
 if(isIP(originHost)===4 && originHost!=='127.0.0.1'){
  return {targetIp:originHost,explicitIp:originHost};
 }
 try{
  const nets=os.networkInterfaces();
  for(const list of Object.values(nets)){
   for(const item of list||[]){
    if(item.family==='IPv4' && !item.internal && item.address && item.address!=='127.0.0.1'){
     return {targetIp:item.address,explicitIp:''};
    }
   }
  }
 }catch{}
 return {targetIp:'YOUR_VPS_PUBLIC_IP',explicitIp:''};
}

function dnsRecommendations(item:ManagedDomain,config:AppConfig,originHost:string){
 const parts=item.domain.split('.');
 const rCount=rootLabelCount(item.domain);
 const isSub=parts.length>rCount;
 const hostLabel=isSub?parts.slice(0,-rCount).join('.'):'@';
 const rootDomain=isSub?parts.slice(-rCount).join('.'):item.domain;
 const {targetIp}=detectServerTargetIp(config,originHost);
 const challengeHost=hostLabel==='@'?'_vpsmcp-challenge':`_vpsmcp-challenge.${hostLabel}`;
 const records=isSub
  ?[
   {type:'A',name:hostLabel,value:targetIp,ttl:'Auto / 300'},
   {type:'CNAME',name:hostLabel,value:rootDomain,ttl:'Auto / 300'},
   {type:'TXT',name:challengeHost,value:`vpsmcp-verify=${item.verifyToken}`,ttl:'300'}
  ]
  :[
   {type:'A',name:'@',value:targetIp,ttl:'Auto / 300'},
   {type:'TXT',name:challengeHost,value:`vpsmcp-verify=${item.verifyToken}`,ttl:'300'}
  ];
 return {hostLabel,rootDomain,targetIp,records};
}

export type TlsProbeResult={ok:boolean;status:'active'|'pending'|'failed';issuer:string;validTo:string};
export type NetworkResolvers={
 resolve4:(host:string)=>Promise<string[]>;
 resolve6:(host:string)=>Promise<string[]>;
 resolveCname:(host:string)=>Promise<string[]>;
 resolveTxt:(host:string)=>Promise<string[][]>;
 checkTls:(domain:string)=>Promise<TlsProbeResult>;
};

export async function checkTlsCertificate(domain:string):Promise<TlsProbeResult>{
 return new Promise(resolve=>{
  const socket=tls.connect({host:domain,port:443,servername:domain,timeout:3500,rejectUnauthorized:false},()=>{
   try{
    const cert=socket.getPeerCertificate();
    socket.end();
    if(!cert || (!cert.subject?.CN && !cert.valid_to)){
     resolve({ok:false,status:'failed',issuer:'No TLS certificate presented',validTo:''});
     return;
    }
    const expiresAt=cert.valid_to?Date.parse(String(cert.valid_to)):NaN;
    if(!Number.isNaN(expiresAt) && expiresAt<=Date.now()){
     resolve({ok:false,status:'failed',issuer:'TLS certificate expired',validTo:String(cert.valid_to||'')});
     return;
    }
    const identityError=tls.checkServerIdentity(domain,cert);
    if(identityError){
     resolve({ok:false,status:'failed',issuer:'Certificate hostname mismatch',validTo:String(cert.valid_to||'')});
     return;
    }
    const issuer=cert.issuer?.O || cert.issuer?.CN || 'Verified TLS';
    resolve({ok:true,status:'active',issuer:String(issuer),validTo:String(cert.valid_to||'')});
    return;
   }catch{}
   resolve({ok:false,status:'failed',issuer:'TLS handshake inspection failed',validTo:''});
  });
  socket.on('error',()=>resolve({ok:false,status:'pending',issuer:'HTTPS not reachable on port 443',validTo:''}));
  socket.on('timeout',()=>{socket.destroy();resolve({ok:false,status:'pending',issuer:'HTTPS connection timed out on port 443',validTo:''});});
 });
}

const defaultResolvers:NetworkResolvers={
 resolve4,
 resolve6,
 resolveCname,
 resolveTxt,
 checkTls:checkTlsCertificate
};

export class NetworkSettings {
 private plan:NetworkPlan;
 private domains:ManagedDomain[]=[];
 constructor(private readonly config:AppConfig,private readonly resolvers:NetworkResolvers=defaultResolvers){
  this.plan={version:1,domain:'',hostPort:config.MCP_BIND_PORT,sslMode:'private-only'};
  const file=config.MCP_NETWORK_DRAFT_FILE;
  let stat;
  try {stat=lstatSync(file);} catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  }
  if(stat){
   if(!stat.isFile()||(stat.mode&0o077)!==0)throw Error('Network draft must be private');
   const parsed=schema.parse(JSON.parse(readFileSync(file,'utf8')));
   this.domains=(parsed.domains??[]).map(d=>({...d,type:classifyDomain(d.domain)}));
   this.plan={version:1,domain:parsed.domain,hostPort:parsed.hostPort,sslMode:parsed.sslMode};
  }
 }
 private persist(nextPlan:NetworkPlan,nextDomains:ManagedDomain[]){
  const file=this.config.MCP_NETWORK_DRAFT_FILE;
  const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
  const payload:NetworkPlan={...nextPlan,domains:nextDomains};
  try{
   mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
   writeFileSync(tmp,JSON.stringify(payload),{flag:'wx',mode:0o600});
   renameSync(tmp,file);
  }catch(err){
   throw new NetworkStorageError(err instanceof Error?err.message:'Network storage unavailable');
  }finally{if(existsSync(tmp))unlinkSync(tmp);}
  this.plan=nextPlan;
  this.domains=nextDomains;
 }
 snapshot(){
  const originHost=new URL(this.config.origin).hostname;
  return {applied:{origin:this.config.origin,internalPort:this.config.MCP_PORT,
    hostPort:this.config.MCP_BIND_PORT,
    hostBind:this.config.MCP_PRIVATE_CONTAINER==='true'||this.config.MCP_HOST==='127.0.0.1'?'127.0.0.1':'configured externally',
    ssl:this.config.secureCookies?'native-https-configured':'not-configured',
    publicReady:false},draft:this.plan,
    domains:this.domains.map(d=>({...d,type:classifyDomain(d.domain),dnsConfig:dnsRecommendations(d,this.config,originHost)})),
    domainConfigured:false,sslCertificateManaged:false,
    applyInstruction:'sudo bash scripts/apply-network.sh',
    note:'Saving a plan does not change DNS, certificates, public HTTPS or the Docker port. Apply private host port over SSH.'};
 }
 validate(input:unknown):NetworkPlan{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid network plan');
  const data=input as Record<string,unknown>;
  const next=schema.parse({version:1,domain:data.domain,hostPort:data.hostPort,sslMode:data.sslMode});
  if(next.sslMode==='external-https'&&!next.domain)throw Error('Domain required for external HTTPS planning');
  return next;
 }
 save(input:unknown){
  const next=this.validate(input);
  this.persist({version:1,domain:next.domain,hostPort:next.hostPort,sslMode:next.sslMode},this.domains);
  return this.snapshot();
 }
 addDomain(rawDomain:unknown){
  if(typeof rawDomain!=='string')throw Error('Invalid domain');
  const clean=requiredHostname.parse(rawDomain);
  if(this.domains.some(d=>d.domain===clean))throw Error('Domain already exists');
  if(this.domains.length>=25)throw Error('Domain limit reached');
  const item:ManagedDomain={
   id:'dom_'+randomUUID().replace(/-/g,'').slice(0,16),
   domain:clean,
   type:classifyDomain(clean),
   dnsStatus:'pending',
   sslStatus:'pending',
   resolvedIps:[],
   resolvedCnames:[],
   sslIssuer:'',
   sslValidTo:'',
   verifyToken:randomBytes(12).toString('hex'),
   updatedAt:new Date().toISOString()
  };
  const nextDomains=[...this.domains,item];
  const nextPlan=this.plan.domain?this.plan:{...this.plan,domain:clean};
  this.persist(nextPlan,nextDomains);
  const snap=this.snapshot();
  const enriched=snap.domains.find(d=>d.id===item.id)!;
  return {domain:enriched,snapshot:snap};
 }
 updateDomain(id:unknown,rawDomain:unknown){
  if(typeof id!=='string'||typeof rawDomain!=='string')throw Error('Invalid domain update');
  const clean=requiredHostname.parse(rawDomain);
  const idx=this.domains.findIndex(d=>d.id===id);
  if(idx===-1)throw Error('Domain not found');
  if(this.domains.some((d,i)=>i!==idx && d.domain===clean))throw Error('Domain already exists');
  const prev=this.domains[idx]!;
  const changed=prev.domain!==clean;
  const updatedItem:ManagedDomain={
   ...prev,
   domain:clean,
   type:classifyDomain(clean),
   dnsStatus:changed?'pending':prev.dnsStatus,
   sslStatus:changed?'pending':prev.sslStatus,
   resolvedIps:changed?[]:prev.resolvedIps,
   resolvedCnames:changed?[]:prev.resolvedCnames,
   sslIssuer:changed?'':prev.sslIssuer,
   sslValidTo:changed?'':prev.sslValidTo,
   updatedAt:new Date().toISOString()
  };
  const nextDomains=[...this.domains];
  nextDomains[idx]=updatedItem;
  const nextPlan=this.plan.domain===prev.domain?{...this.plan,domain:clean}:this.plan;
  this.persist(nextPlan,nextDomains);
  const snap=this.snapshot();
  const enriched=snap.domains.find(d=>d.id===updatedItem.id)!;
  return {domain:enriched,snapshot:snap};
 }
 removeDomain(id:unknown){
  if(typeof id!=='string')throw Error('Invalid domain id');
  const idx=this.domains.findIndex(d=>d.id===id);
  if(idx===-1)throw Error('Domain not found');
  const removed=this.domains[idx]!;
  const nextDomains=this.domains.filter((_,i)=>i!==idx);
  const nextPlan=this.plan.domain===removed.domain?{...this.plan,domain:nextDomains[0]?.domain||''}:this.plan;
  this.persist(nextPlan,nextDomains);
  return this.snapshot();
 }
 async checkDomainDnsAndSsl(id:unknown){
  if(typeof id!=='string')throw Error('Invalid domain id');
  const idx=this.domains.findIndex(d=>d.id===id);
  if(idx===-1)throw Error('Domain not found');
  const item={...this.domains[idx]!};
  const originHost=new URL(this.config.origin).hostname;
  const {targetIp,explicitIp}=detectServerTargetIp(this.config,originHost);
  const rCount=rootLabelCount(item.domain);
  const parts=item.domain.split('.');
  const rootDomain=parts.length>rCount?parts.slice(-rCount).join('.'):item.domain;
  const [v4,v6,cname,txt]=await Promise.allSettled([
   this.resolvers.resolve4(item.domain),
   this.resolvers.resolve6(item.domain),
   this.resolvers.resolveCname(item.domain),
   this.resolvers.resolveTxt(`_vpsmcp-challenge.${item.domain}`)
  ]);
  const ipv4=v4.status==='fulfilled'?v4.value.slice(0,8):[];
  const ipv6=v6.status==='fulfilled'?v6.value.slice(0,8):[];
  const cnames=cname.status==='fulfilled'?cname.value.slice(0,4).map(c=>c.toLowerCase().replace(/\.$/,'')):[];
  const txts=txt.status==='fulfilled'?txt.value.flat():[];
  const allIps=[...ipv4,...ipv6];
  const txtVerified=Boolean(item.verifyToken) && txts.some(t=>t.includes(`vpsmcp-verify=${item.verifyToken}`) || t.trim()===item.verifyToken);
  const ipMatchesTarget=explicitIp
   ?allIps.includes(explicitIp)
   :(targetIp!=='YOUR_VPS_PUBLIC_IP' && allIps.includes(targetIp));
  const cnameMatchesTarget=cnames.some(c=>c===rootDomain || (originHost!=='127.0.0.1' && c===originHost));
  const hasAnyDns=allIps.length>0 || cnames.length>0;
  // Verification logic:
  // 1. If TXT challenge token is present, or CNAME points to root/originHost, or IP matches configured/detected target IP -> verified.
  // 2. If explicit MCP_PUBLIC_IP is set and domain resolves only to a different IP without TXT proof -> failed (target mismatch).
  // 3. If no explicit MCP_PUBLIC_IP is enforced and TXT challenge or valid target IP/CNAME resolves -> verified.
  let dnsVerified=false;
  if(txtVerified || ipMatchesTarget || cnameMatchesTarget){
   dnsVerified=true;
  }else if(hasAnyDns && !explicitIp){
   // When no explicit public IP is configured on a local/container host, check if TXT challenge is present;
   // if not, only verify if IP matches detected interface IP.
   dnsVerified=false;
  }
  item.resolvedIps=allIps;
  item.resolvedCnames=cnames;
  item.dnsStatus=dnsVerified?'verified':'failed';
  if(dnsVerified){
   const tlsCheck=await this.resolvers.checkTls(item.domain);
   item.sslStatus=tlsCheck.status;
   item.sslIssuer=tlsCheck.issuer;
   item.sslValidTo=tlsCheck.validTo;
  }else{
   item.sslStatus='failed';
   item.sslIssuer=hasAnyDns
    ?`DNS resolves (${allIps.concat(cnames).join(', ')}) but does not match server IP (${targetIp}) or TXT challenge`
    :'DNS records not resolved';
   item.sslValidTo='';
  }
  item.updatedAt=new Date().toISOString();
  const nextDomains=[...this.domains];
  nextDomains[idx]=item;
  this.persist(this.plan,nextDomains);
  const snap=this.snapshot();
  const enriched=snap.domains.find(d=>d.id===item.id)!;
  return {domain:enriched,snapshot:snap};
 }
 async dnsCheck(){
  if(!this.plan.domain)return {domain:'',state:'not-configured',ipv4:[],ipv6:[]};
  const domain=this.plan.domain;
  const [v4,v6]=await Promise.allSettled([this.resolvers.resolve4(domain),this.resolvers.resolve6(domain)]);
  const ipv4=v4.status==='fulfilled'?v4.value.slice(0,8):[];
  const ipv6=v6.status==='fulfilled'?v6.value.slice(0,8):[];
  return {domain,state:ipv4.length||ipv6.length?'resolved':'not-resolved',ipv4,ipv6,
   warning:'DNS resolution is not proof of domain ownership, an installed SSL certificate or a deployed public gateway'};
 }
 isAllowedHost(rawHost:string):boolean{
  const clean=String(rawHost||'').trim().toLowerCase().replace(/:\d+$/,'');
  if(!clean)return false;
  return this.domains.some(d=>d.domain===clean);
 }
 isAllowedOrigin(rawOrigin:string):boolean{
  try{
   const parsed=new URL(String(rawOrigin||'').trim());
   if(parsed.protocol!=='https:' && !(this.config.MCP_PRIVATE_CONTAINER==='true' && parsed.protocol==='http:'))return false;
   return this.isAllowedHost(parsed.hostname);
  }catch{
   return false;
  }
 }
}