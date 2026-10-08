import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, createPlan, runPlan, inputBody, money } from '../scripts/voice.mjs';
const voice='voice_'+'a'.repeat(32), job='job_'+'b'.repeat(32);
const estimate={reservation_created:false,balance_sufficient:true,maximum_charge_usd:'0.000320',estimated_charge_usd:'0.000320'};
const input={text:'Hello from CastReader.',language:'en'};
const audio=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(32)]);
function fixture({ drop=false, fail=false, pending=false, badAudio=false, budget='0.000320', evilRoute=false, cn=false }={}) {
  const calls=[], keys=[];let submissions=0;
  const fetchImpl=async(url,opts)=>{
    const path=new URL(url).pathname;calls.push({url:String(url),path,method:opts.method});
    const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json','retry-after':'0'}});
    if(path.endsWith('/route'))return json({base_url:evilRoute?'https://evil.example/v1':cn?'https://api.castreader.cn/voice-api/v1':'https://voice.castreader.com/v1'});
    if(path.endsWith('/models'))return json({data:[{id:'clone-v1',languages:['en']}]});
    if(path.endsWith('/voices'))return json({data:[{id:voice,status:'ready',name:'Rowan',default_voice_key:'narrator'}]});
    if(path.endsWith('/usage/estimate'))return json({...estimate,maximum_charge_usd:budget});
    const data={id:job,status:pending?'running':fail?'failed':'succeeded',chargedMicrousd:fail?'0':'176',trialCharacters:0,billableCharacters:22,completedAt:'2026-09-15T00:00:00Z',chunks:[]};
    if(path.endsWith('/jobs')){submissions++;keys.push(opts.headers['Idempotency-Key']);if(drop&&submissions===1)throw Error('socket reset');return json(data);}
    if(path.endsWith('/audio'))return new Response(badAudio?'{}':audio,{headers:{'content-type':badAudio?'application/json':'audio/mpeg'}});
    if(path.endsWith('/'+job))return json(data);
    throw Error(path);
  };
  return {client:new Client({apiKey:'test-key',fetchImpl}),calls,keys};
}
async function dir(t){const path=await mkdtemp(join(tmpdir(),'castreader-test-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
test('normalize Unicode by codepoint and validate language/format',()=>{assert.equal(inputBody({text:' e\u0301\r\n😀 ',language:'en'}).text,'é\n😀');assert.throws(()=>inputBody({...input,text:'x'.repeat(501)}));assert.throws(()=>inputBody({...input,language:undefined}));assert.throws(()=>inputBody({...input,language:'zh',return_timestamps:true}));assert.equal(money('0.000320'),320n);});
test('plan estimates without synthesis; run saves playable-shaped bytes and exact charge',async t=>{const output=await dir(t),f=fixture();const planned=await createPlan({...f,input,output,maxUSD:'0.01'});assert.equal(planned.generated,false);assert.equal(f.keys.length,0);const result=await runPlan({...f,output});assert.equal(result.chargedUSD,'0.000176');assert.deepEqual(await readFile(result.path),audio);const count=f.calls.length;const again=await runPlan({...f,output});assert.equal(again.reused,true);assert.equal(f.calls.length,count);});
test('lost submission response resumes exact same idempotency key',async t=>{const output=await dir(t),f=fixture({drop:true});await createPlan({...f,input,output,maxUSD:'0.01'});await assert.rejects(runPlan({...f,output}),{code:'network_outcome_unknown'});assert.equal(JSON.parse(await readFile(join(output,'state.json'))).status,'submission_unknown');await runPlan({...f,output});assert.equal(f.keys.length,2);assert.equal(new Set(f.keys).size,1);});
test('failed terminal job never resubmits',async t=>{const output=await dir(t),f=fixture({fail:true});await createPlan({...f,input,output,maxUSD:'0.01'});assert.equal((await runPlan({...f,output})).status,'failed');await runPlan({...f,output});assert.equal(f.keys.length,1);});
test('pending job is returned and subsequent resume reads same job',async t=>{const output=await dir(t),f=fixture({pending:true});await createPlan({...f,input,output,maxUSD:'0.01'});assert.equal((await runPlan({...f,output,waitMs:0})).status,'pending');await runPlan({...f,output,waitMs:0});assert.equal(f.keys.length,1);});
test('budget exceeded blocks generation',async t=>{const output=await dir(t),f=fixture({budget:'1.000000'});await assert.rejects(createPlan({...f,input,output,maxUSD:'0.01'}),{code:'budget_exceeded'});assert.equal(f.keys.length,0);});
test('tampered input cannot reuse old paid request identity',async t=>{const output=await dir(t),f=fixture();await createPlan({...f,input,output,maxUSD:'0.01'});const path=join(output,'state.json'),state=JSON.parse(await readFile(path));state.body.text='changed';await writeFile(path,JSON.stringify(state));await assert.rejects(runPlan({...f,output}),{code:'invalid_checkpoint'});assert.equal(f.keys.length,0);});
test('JSON response cannot be saved as MP3',async t=>{const output=await dir(t),f=fixture({badAudio:true});await createPlan({...f,input,output,maxUSD:'0.01'});await assert.rejects(runPlan({...f,output}),{code:'invalid_audio_type'});await assert.rejects(readFile(join(output,'audio.mp3')),{code:'ENOENT'});});
test('untrusted routing never receives the key',async()=>{const f=fixture({evilRoute:true});await assert.rejects(f.client.prepare(input),{code:'invalid_route'});assert.equal(f.calls.length,1);});
test('missing or corrupted local output redownloads original job',async t=>{const output=await dir(t),f=fixture();await createPlan({...f,input,output,maxUSD:'0.01'});const result=await runPlan({...f,output});await writeFile(result.path,'corrupt');const recovered=await runPlan({...f,output});assert.deepEqual(await readFile(result.path),audio);assert.equal(recovered.sha256,result.sha256);assert.equal(f.keys.length,1);});
test('China route uses api.castreader.cn without contacting the retired domain',async t=>{
  const output=await dir(t),f=fixture({cn:true});
  assert.equal((await createPlan({...f,input,output,maxUSD:'0.01'})).region,'cn');
  assert.equal((await runPlan({...f,output})).region,'cn');
  assert.ok(f.calls.every(c=>c.url.startsWith('https://api.castreader.cn/voice-api/v1/')||c.url.startsWith('https://voice.castreader.com/v1/route')));
});
test('legacy China checkpoint resumes original job at new endpoint without submitting again',async t=>{
  const output=await dir(t),f=fixture({cn:true,pending:true});
  await createPlan({...f,input,output,maxUSD:'0.01'});
  await runPlan({...f,output,waitMs:0});
  const path=join(output,'state.json'),state=JSON.parse(await readFile(path));
  state.base='https://voice.castreader.cn/v1';await writeFile(path,JSON.stringify(state));
  const count=f.calls.length;
  await runPlan({...f,output,waitMs:0});
  const saved=JSON.parse(await readFile(path));
  assert.equal(saved.base,'https://api.castreader.cn/voice-api/v1');
  assert.equal(saved.bodyHash,state.bodyHash);assert.equal(saved.idempotencyKey,state.idempotencyKey);assert.equal(saved.job.id,state.job.id);
  assert.equal(f.keys.length,1);
  assert.ok(f.calls.slice(count).every(c=>c.method==='GET'&&c.url.startsWith('https://api.castreader.cn/voice-api/v1/jobs/')));
});
