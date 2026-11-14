(function(root){
 "use strict";
 const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
 const normalizeTrack=input=>({gainDb:clamp(input?.gainDb??0,-48,12),pan:clamp(input?.pan??0,-1,1),mute:input?.mute===true,solo:input?.solo===true});
 function effectiveGain(state,anySolo){return state.mute||(anySolo&&!state.solo)?0:10**(state.gainDb/20);}
 let context=null,tracks=new Map(),syncTimer=null,master=null,rendering=false,objectUrl=null;
 function init(items){
  destroy();
  const AudioContextClass=root.AudioContext||root.webkitAudioContext;
  if(!AudioContextClass)throw new Error("הדפדפן אינו תומך במיקסר רב־ערוצי.");
  context=new AudioContextClass();master=context.createGain();master.gain.value=0.85;master.connect(context.destination);
  for(const item of items){
   const state=normalizeTrack(item.settings),source=context.createMediaElementSource(item.audio),gain=context.createGain(),pan=context.createStereoPanner();
   source.connect(gain);gain.connect(pan);pan.connect(master);tracks.set(item.id,{id:item.id,audio:item.audio,source,gain,pan,state});
  }
  applyAll();
 }
 function anySolo(){return [...tracks.values()].some(t=>t.state.solo);}
 function applyAll(){const solo=anySolo();for(const t of tracks.values()){t.gain.gain.setTargetAtTime(effectiveGain(t.state,solo),context.currentTime,.012);t.pan.pan.setTargetAtTime(t.state.pan,context.currentTime,.012);}}
 function setTrack(id,patch){const t=tracks.get(id);if(!t)return null;t.state=normalizeTrack({...t.state,...patch});applyAll();return {...t.state};}
 function getTrack(id){const t=tracks.get(id);return t?{...t.state}:null;}
 function getSettings(){return Object.fromEntries([...tracks].map(([id,t])=>[id,{...t.state}]));}
 async function play(){
  if(!context||!tracks.size)throw new Error("לא נטענו ערוצים לנגינה.");
  await context.resume();
  const list=[...tracks.values()],masterTime=Math.max(0,list[0].audio.currentTime||0);
  for(const t of list){if(!Number.isFinite(t.audio.duration))await new Promise((resolve,reject)=>{t.audio.addEventListener("loadedmetadata",resolve,{once:true});t.audio.addEventListener("error",()=>reject(new Error("קובץ ערוץ לא נטען.")),{once:true});});}
  for(const t of list){if(Math.abs(t.audio.currentTime-masterTime)>.12)t.audio.currentTime=Math.min(masterTime,Math.max(0,(t.audio.duration||masterTime)-.02));}
  await Promise.all(list.map(t=>t.audio.play()));
  if(syncTimer)clearInterval(syncTimer);
  syncTimer=setInterval(()=>{const lead=list[0]?.audio;if(!lead||lead.paused)return;for(const t of list.slice(1)){if(Math.abs(t.audio.currentTime-lead.currentTime)>.08&&!t.audio.seeking){try{t.audio.currentTime=lead.currentTime;}catch{}}}},300);
 }
 function pause(){for(const t of tracks.values())t.audio.pause();if(syncTimer){clearInterval(syncTimer);syncTimer=null;}}
 function stop(){pause();for(const t of tracks.values()){try{t.audio.currentTime=0;}catch{}}}
 async function renderMix(){
  if(rendering)throw new Error("ייצוא מיקס כבר מתבצע.");
  if(!tracks.size)throw new Error("לא נמצאו ערוצים לייצוא.");
  rendering=true;
  try{
   const entries=[...tracks.values()],decoded=[];
   if(entries.length>8)throw new Error("ניתן לייצא עד 8 ערוצים במיקס אחד.");
   for(const t of entries){
    const response=await fetch(t.audio.src);
    if(!response.ok)throw new Error("לא ניתן להוריד ערוץ לצורך ייצוא.");
    const buffer=await response.arrayBuffer();
    const decodedBuffer=await context.decodeAudioData(buffer.slice(0));
    decoded.push({buffer:decodedBuffer,state:{...t.state}});
   }
   const sampleRate=Math.min(48000,Math.max(...decoded.map(x=>x.buffer.sampleRate)));
   const duration=Math.max(...decoded.map(x=>x.buffer.duration));
   if(duration>600)throw new Error("ייצוא מוגבל ל־10 דקות.");
   const length=Math.ceil(duration*sampleRate);
   const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;
   if(!Offline)throw new Error("הדפדפן אינו תומך בייצוא Offline.");
   const output=new Offline(2,length,sampleRate),bus=output.createGain(),limiter=output.createDynamicsCompressor();
   bus.gain.value=.85;limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;bus.connect(limiter);limiter.connect(output.destination);
   const solo=decoded.some(x=>x.state.solo);
   for(const item of decoded){
    const source=output.createBufferSource(),gain=output.createGain(),pan=output.createStereoPanner();
    source.buffer=item.buffer;gain.gain.value=effectiveGain(item.state,solo);pan.pan.value=item.state.pan;
    source.connect(gain);gain.connect(pan);pan.connect(bus);source.start(0);
   }
   return await output.startRendering();
  }finally{rendering=false;}
 }
 async function destroy(){
  pause();for(const t of tracks.values()){try{t.source.disconnect();t.gain.disconnect();t.pan.disconnect();}catch{}}
  tracks.clear();if(master){try{master.disconnect();}catch{}master=null;}
  if(context){const old=context;context=null;await old.close().catch(()=>{});}
 }
 root.ITZIK_STEM_MIXER={normalizeTrack,effectiveGain,init,setTrack,getTrack,getSettings,play,pause,stop,renderMix,destroy};
})(typeof window!=="undefined"?window:globalThis);
