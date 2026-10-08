import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {get} from 'node:http';
import {prepareReader} from '../scripts/reader.mjs';
import {createReaderServer} from '../assets/answer-reader/server.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'castreader-reader-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const text='Hello, world.',body={text,language:'en',output_format:'wav',return_timestamps:true};
 const audio=Buffer.from('RIFF-unit-fixture-WAVE-not-real-synthesis');
 const receipt={status:'succeeded',file:'audio.wav',sha256:hash(audio),chargedUSD:'0.000104'};
 const state={status:'succeeded',body,bodyHash:hash(JSON.stringify(body)),sha256:hash(audio),privateMarker:'DO_NOT_EXPORT_STATE'};
 const timing={segments:[{alignment:{status:'aligned',unit:'seconds',duration_seconds:2,
  words:[{word:'Hello',start_time:.2,end_time:.8},{word:'world',start_time:1,end_time:1.8}]}}]};
 const save=(name,value)=>writeFile(join(dir,name),JSON.stringify(value));
 await Promise.all([save('state.json',state),save('receipt.json',receipt),save('timestamps.json',timing),writeFile(join(dir,'audio.wav'),audio),writeFile(join(dir,'answer.txt'),text)]);
 return {dir,text,state,receipt,timing,save,options:{textFile:join(dir,'answer.txt'),audioDir:dir,output:join(dir,'reader')}};
}
test('reader binds the exact selected answer to saved audio and exports no private job state',async t=>{
 const f=await fixture(t),result=await prepareReader(f.options);
 assert.equal(result.source,'selected_answer');assert.equal(result.additionalGenerationChargeUSD,'0.000000');
 assert.equal(await readFile(join(f.options.output,'answer.txt'),'utf8'),f.text);
 const files=await readdir(f.options.output);assert(!files.includes('state.json'));assert(!files.includes('receipt.json'));
 for(const name of files)assert(!(await readFile(join(f.options.output,name),'utf8')).includes('DO_NOT_EXPORT_STATE'));
 await assert.rejects(prepareReader(f.options),e=>e.code==='EEXIST');
});
test('a different selected answer cannot reuse another answers audio',async t=>{
 const f=await fixture(t);await writeFile(f.options.textFile,'Different answer');
 await assert.rejects(prepareReader(f.options),/does not match/);await assert.rejects(access(f.options.output));
});
test('corrupted retained audio cannot be presented as verified playback',async t=>{
 const f=await fixture(t);await writeFile(join(f.dir,'audio.wav'),'corrupt');
 await assert.rejects(prepareReader(f.options),/checksum mismatch/);
});
test('unavailable, out-of-bounds or mismatched alignment fails before creating a reader',async t=>{
 const f=await fixture(t);
 for(const alignment of [{status:'unavailable'}, {...f.timing.segments[0].alignment,duration_seconds:.5},
 {...f.timing.segments[0].alignment,words:[{word:'Goodbye',start_time:0,end_time:1}]}]){
  await f.save('timestamps.json',{segments:[{alignment}]});
  await assert.rejects(prepareReader(f.options));await assert.rejects(access(f.options.output));
 }
 await f.save('timestamps.json',{segments:[...f.timing.segments,...f.timing.segments]});
 await assert.rejects(prepareReader(f.options),/one aligned segment/);
});
test('reader serves byte ranges and only approved local assets',async t=>{
 const f=await fixture(t);await prepareReader(f.options);
 const server=createReaderServer(f.options.output);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const range=await fetch(base+'/audio.wav',{headers:{Range:'bytes=0-3'}});
 assert.equal(range.status,206);assert.equal(await range.text(),'RIFF');
 assert.equal((await fetch(base+'/reader-data.json')).status,200);
 assert.equal((await fetch(base+'/state.json')).status,404);
 assert.equal((await fetch(base+'/audio.wav',{headers:{Range:'bytes=9-2'}})).status,416);
 assert.equal((await fetch(base+'/reader-data.json',{method:'POST'})).status,405);
 const foreign=await new Promise((resolve,reject)=>get(base+'/',{headers:{Host:'foreign.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject));
 assert.equal(foreign,403);
});
