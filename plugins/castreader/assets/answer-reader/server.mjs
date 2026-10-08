// Local, read-only experiment page. No API credentials or paid synthesis.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const files=new Map([
 ['/', ['index.html','text/html; charset=utf-8']],
 ['/index.html', ['index.html','text/html; charset=utf-8']],
 ['/reader.mjs', ['reader.mjs','text/javascript; charset=utf-8']],
 ['/style.css', ['style.css','text/css; charset=utf-8']],
 ['/sync.mjs', ['sync.mjs','text/javascript; charset=utf-8']],
 ['/reader-data.json', ['reader-data.json','application/json; charset=utf-8']],
 ['/answer.txt', ['answer.txt','text/plain; charset=utf-8']],
 ['/audio.wav', ['audio.wav','audio/wav']],
 ['/audio.mp3', ['audio.mp3','audio/mpeg']],
]);
export function createReaderServer(directory){
 const server=createServer((req,res)=>{
  const respond=async()=>{
   res.setHeader('Cache-Control','no-store');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Cross-Origin-Resource-Policy','same-origin');
   if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403).end();return;}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
   const item=files.get(req.url);
   if(!item){res.writeHead(404).end();return;}
   const data=await readFile(join(directory,item[0]));
   let start=0,end=data.length-1,status=200;
   res.setHeader('Content-Type',item[1]);
   res.setHeader('Accept-Ranges','bytes');
   if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(match&&(match[1]||match[2])){
     start=match[1]?Number(match[1]):Math.max(0,data.length-Number(match[2]));
     end=match[1]&&match[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
    }else start=NaN;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=data.length){
     res.writeHead(416,{'Content-Range':`bytes */${data.length}`}).end();return;
    }
    status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${data.length}`);
   }
   res.setHeader('Content-Length',end-start+1);
   res.writeHead(status);res.end(req.method==='HEAD'?undefined:data.subarray(start,end+1));
  };
  respond().catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});
 });
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Usage: node server.mjs APP_DIRECTORY [PORT]');
 const server=createReaderServer(resolve(process.argv[2]));
 server.listen(Number(process.argv[3]??0),'127.0.0.1',()=>console.log(`CastReader local experiment: http://127.0.0.1:${server.address().port}/`));
}
