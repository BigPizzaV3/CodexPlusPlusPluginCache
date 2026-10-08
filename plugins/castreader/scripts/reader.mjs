#!/usr/bin/env node
/** Builds a local plain-text reader from the selected answer and its verified saved job. */
import {readFile,writeFile,mkdir,copyFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {alignWords} from '../assets/answer-reader/sync.mjs';
import {createReaderServer} from '../assets/answer-reader/server.mjs';
const assets=fileURLToPath(new URL('../assets/answer-reader/',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
export async function prepareReader({textFile,audioDir,output}){
 const text=await readFile(textFile,'utf8');
 const state=await json(join(audioDir,'state.json'));
 const receipt=await json(join(audioDir,'receipt.json'));
 const timing=await json(join(audioDir,'timestamps.json'));
 const normalized=text.replace(/\r\n/g,'\n').normalize('NFC').trim();
 if(!normalized||state.body?.text!==normalized||hash(JSON.stringify(state.body))!==state.bodyHash)
  throw Error('Selected answer does not match the saved generation');
 if(state.status!=='succeeded'||receipt.status!=='succeeded'||!['audio.wav','audio.mp3'].includes(receipt.file))
  throw Error('A successful saved audio job is required');
 const path=join(audioDir,receipt.file),stat=await lstat(path);
 if(stat.isSymbolicLink()||!stat.isFile())throw Error('Unsafe audio file');
 const audio=await readFile(path);
 if(hash(audio)!==receipt.sha256||state.sha256!==receipt.sha256)throw Error('Audio checksum mismatch');
 if(timing.segments?.length!==1)throw Error('This preview requires one aligned segment; no guessed segment offsets');
 const alignment=timing.segments[0].alignment;
 if(alignment?.status!=='aligned'||alignment.unit!=='seconds'||!Number.isFinite(alignment.duration_seconds)||alignment.duration_seconds<=0)
  throw Error('Real word alignment unavailable; no synchronized reader was created');
 const mapped=alignWords(text,alignment.words);
 if(mapped.at(-1).end_time>alignment.duration_seconds+.03)throw Error('Alignment exceeds the audio duration');
 if(!/^\d+\.\d{6}$/.test(receipt.chargedUSD??''))throw Error('Invalid charge receipt');
 const out=resolve(output);
 await mkdir(dirname(out),{recursive:true,mode:0o700});
 await mkdir(out,{mode:0o700}); // Existing readers are never silently replaced.
 for(const file of ['index.html','reader.mjs','style.css','sync.mjs'])await copyFile(join(assets,file),join(out,file));
 await writeFile(join(out,receipt.file),audio,{mode:0o600});
 await writeFile(join(out,'answer.txt'),text,{mode:0o600});
 await writeFile(join(out,'reader-data.json'),JSON.stringify({text,language:state.body.language,
  audioFile:receipt.file,words:alignment.words,duration:alignment.duration_seconds,
  chargedUSD:receipt.chargedUSD,audioSha256:receipt.sha256},null,2),{mode:0o600});
 return {status:'reader_ready',output:out,language:state.body.language,words:mapped.length,
  chargedUSD:receipt.chargedUSD,additionalGenerationChargeUSD:'0.000000',source:'selected_answer',surface:'side_panel'};
}
async function main(){
 const [command,...args]=process.argv.slice(2),opts={};
 for(let i=0;i<args.length;i+=2){if(!['--text','--audio-dir','--output','--port'].includes(args[i])||!args[i+1]||opts[args[i]])throw Error('Invalid reader arguments');opts[args[i]]=args[i+1];}
 if(command==='prepare'){
  if(!opts['--text']||!opts['--audio-dir']||!opts['--output'])throw Error('prepare requires --text, --audio-dir and --output');
  console.log(JSON.stringify(await prepareReader({textFile:resolve(opts['--text']),audioDir:resolve(opts['--audio-dir']),output:opts['--output']})));return;
 }
 if(command==='serve'&&opts['--output']){
  const port=Number(opts['--port']??0);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
  const server=createReaderServer(resolve(opts['--output']));
  server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}/`,readOnly:true,additionalGenerationChargeUSD:'0.000000'})));return;
 }
 throw Error('Usage: reader.mjs prepare --text answer.txt --audio-dir AUDIO_RUN --output NEW_READER_DIR | serve --output READER_DIR [--port 0]');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
