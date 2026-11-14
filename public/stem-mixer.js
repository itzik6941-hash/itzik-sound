(function(root){
 "use strict";
 const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
 const normalizeTrack=input=>({
  gainDb:clamp(input?.gainDb??0,-48,12),pan:clamp(input?.pan??0,-1,1),
  mute:input?.mute===true,solo:input?.solo===true,
  eqLow:clamp(input?.eqLow??0,-12,12),eqMid:clamp(input?.eqMid??0,-12,12),eqHigh:clamp(input?.eqHigh??0,-12,12),
  compThreshold:clamp(input?.compThreshold??0,-36,0),compRatio:clamp(input?.compRatio??1,1,12),
  reverbMix:clamp(input?.reverbMix??0,0,0.5),delayMix:clamp(input?.delayMix??0,0,0.5)
 });
 function formatPan(value){const pan=clamp(value,-1,1);return pan<=-.98?"L":pan>=.98?"R":pan===0?"C":pan<0?`L ${Math.round(-pan*100)}%`:`R ${Math.round(pan*100)}%`;}
 let context=null,tracks=new Map(),syncTimer=null,master=null,rendering=false;
 const mediaSources=new WeakMap();
 function createImpulse(ctx){
  const length=Math.floor(ctx.sampleRate*1.6),buffer=ctx.createBuffer(2,length,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2.4);}
  return buffer;
 }
 function buildTrackGraph(item,state){
  let source=mediaSources.get(item.audio);
  if(!source){source=context.createMediaElementSource(item.audio);mediaSources.set(item.audio,source);}
  const input=context.createGain(),low=context.createBiquadFilter(),mid=context.createBiquadFilter(),high=context.createBiquadFilter();
  low.type="lowshelf";low.frequency.value=120;mid.type="peaking";mid.frequency.value=1000;mid.Q.value=0.9;high.type="highshelf";high.frequency.value=9000;
  const compressor=context.createDynamicsCompressor(),dry=context.createGain(),pan=context.createStereoPanner();
  const convolver=context.createConvolver(),reverbWet=context.createGain(),delay=context.createDelay(1),delayWet=context.createGain();
  const delayFeedback=context.createGain();convolver.buffer=createImpulse(context);delay.delayTime.value=.24;delayFeedback.gain.value=.18;
  source.connect(input);input.connect(low);low.connect(mid);mid.connect(high);high.connect(compressor);
  compressor.connect(dry);dry.connect(pan);
  compressor.connect(convolver);convolver.connect(reverbWet);reverbWet.connect(pan);
  compressor.connect(delay);delay.connect(delayWet);delayWet.connect(pan);delay.connect(delayFeedback);delayFeedback.connect(delay);
  pan.connect(master);
  return {id:item.id,audio:item.audio,source,input,low,mid,high,compressor,dry,pan,convolver,reverbWet,delay,delayWet,delayFeedback,state};
 }
 function init(items){
  destroy();
  const AudioContextClass=root.AudioContext||root.webkitAudioContext;
  if(!AudioContextClass)throw new Error("הדפדפן אינו תומך במיקסר רב־ערוצי.");
  if(!context)context=new AudioContextClass();
  if(!master){master=context.createGain();master.gain.value=0.85;master.connect(context.destination);}
  for(const item of items){const state=normalizeTrack(item.settings),track=buildTrackGraph(item,state);tracks.set(item.id,track);}
  applyAll();
 }
 function anySolo(){return [...tracks.values()].some(t=>t.state.solo);}
 function applyAll(){const solo=anySolo();for(const t of tracks.values()){
  const s=t.state,now=context.currentTime;
  t.input.gain.setTargetAtTime(effectiveGain(s,solo),now,.012);t.pan.pan.setTargetAtTime(s.pan,now,.012);
  t.low.gain.setTargetAtTime(s.eqLow,now,.02);t.mid.gain.setTargetAtTime(s.eqMid,now,.02);t.high.gain.setTargetAtTime(s.eqHigh,now,.02);
  t.compressor.threshold.setTargetAtTime(s.compThreshold,now,.02);t.compressor.ratio.setTargetAtTime(s.compRatio,now,.02);
  t.dry.gain.setTargetAtTime(1-Math.max(s.reverbMix,s.delayMix)*.35,now,.02);
  t.reverbWet.gain.setTargetAtTime(s.reverbMix,now,.02);t.delayWet.gain.setTargetAtTime(s.delayMix,now,.02);
 }} 
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
    const low=output.createBiquadFilter(),mid=output.createBiquadFilter(),high=output.createBiquadFilter(),compressor=output.createDynamicsCompressor();
    const dry=output.createGain(),convolver=output.createConvolver(),reverbWet=output.createGain();
    const delay=output.createDelay(1),delayWet=output.createGain(),feedback=output.createGain();
    low.type="lowshelf";low.frequency.value=120;low.gain.value=item.state.eqLow;
    mid.type="peaking";mid.frequency.value=1000;mid.Q.value=.9;mid.gain.value=item.state.eqMid;
    high.type="highshelf";high.frequency.value=9000;high.gain.value=item.state.eqHigh;
    compressor.threshold.value=item.state.compThreshold;compressor.ratio.value=item.state.compRatio;
    convolver.buffer=createImpulse(output);reverbWet.gain.value=item.state.reverbMix;
    delay.delayTime.value=.24;delayWet.gain.value=item.state.delayMix;feedback.gain.value=.18;
    source.buffer=item.buffer;gain.gain.value=effectiveGain(item.state,solo);pan.pan.value=item.state.pan;
    source.connect(gain);gain.connect(low);low.connect(mid);mid.connect(high);high.connect(compressor);
    compressor.connect(dry);dry.connect(pan);
    compressor.connect(convolver);convolver.connect(reverbWet);reverbWet.connect(pan);
    compressor.connect(delay);delay.connect(delayWet);delayWet.connect(pan);delay.connect(feedback);feedback.connect(delay);
    pan.connect(bus);source.start(0);
   }
   return await output.startRendering();
  }finally{rendering=false;}
 }
 async function destroy(){
  pause();
  for(const t of tracks.values()){
   for(const node of [t.input,t.low,t.mid,t.high,t.compressor,t.dry,t.pan,t.convolver,t.reverbWet,t.delay,t.delayWet,t.delayFeedback]){try{node.disconnect();}catch{}}
   try{t.source.disconnect();}catch{}
  }
  tracks.clear();
 }
 root.ITZIK_STEM_MIXER={normalizeTrack,effectiveGain,formatPan,init,setTrack,getTrack,getSettings,play,pause,stop,renderMix,destroy};
})(typeof window!=="undefined"?window:globalThis);
