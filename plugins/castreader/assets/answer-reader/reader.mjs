import {attachOriginalTextReader} from './sync.mjs';
const answer=document.getElementById('answer'),audio=document.getElementById('audio');
const play=document.getElementById('play'),stop=document.getElementById('stop'),status=document.getElementById('status');
let reader,last=-1;
try{
 const response=await fetch('reader-data.json');if(!response.ok)throw Error('无法加载阅读文本');
 const data=await response.json();
 // User text is always literal text, never interpreted as HTML or instructions.
 answer.textContent=data.text;answer.lang=data.language;
 audio.src=data.audioFile;
 reader=attachOriginalTextReader({root:answer,audio,words:data.words,onState:s=>{
  play.textContent=s.paused?'开始朗读':'暂停';
  status.textContent=s.error?'播放已停止，请重新打开已保存的阅读页。':s.stopped?'已停止':s.word?`${s.paused?'已暂停':'正在朗读'} · ${s.rangeText}`:s.paused?'准备好了':'正在播放';
  if(s.disposed){play.disabled=true;stop.disabled=true;}
  if(s.active>=0&&s.active!==last&&document.getElementById('follow').checked){
   const range=reader?.ranges[s.active],rect=range?.getBoundingClientRect();
   if(rect&&(rect.top<90||rect.bottom>innerHeight-230))scrollBy({top:rect.top-innerHeight*.3,behavior:'smooth'});
  }
  last=s.active;
 }});
 document.getElementById('cost').textContent=`本次语音费用 $${data.chargedUSD} · 重播使用本地音频，不重复生成`;
 play.disabled=false;stop.disabled=false;
 play.onclick=async()=>{if(audio.paused){try{await audio.play();}catch{status.textContent='播放未开始，请使用播放器上的播放按钮重试。';}}else audio.pause();};
 stop.onclick=()=>reader.stop();
 document.getElementById('rate').onchange=event=>audio.playbackRate=Number(event.target.value);
 addEventListener('pagehide',()=>reader.dispose(),{once:true});
}catch(error){status.textContent=`无法开始同步朗读：${error.message}`;audio.removeAttribute('src');}
