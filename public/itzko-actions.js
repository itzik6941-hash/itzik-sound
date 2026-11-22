(() => {
  "use strict";
  const MAIN_KEYS=new Set(["gainDb","pan","low","mid","high","threshold","ratio","reverb","delay","width","masterDb"]);
  const TRACK_KEYS=new Set(["gainDb","pan","inputTrimDb","phaseInvert","saturation","eqLowDb","eqMidDb","eqHighDb","compThreshold","compRatio","compAttack","compRelease","reverbMix","delayMix","delayTime","delayFeedback","stereoWidth"]);
  const MAIN_LIMITS={gainDb:[-24,12],pan:[-1,1],low:[-12,12],mid:[-12,12],high:[-12,12],threshold:[-60,0],ratio:[1,20],reverb:[0,.6],delay:[0,.6],width:[0,2],masterDb:[-18,6]};
  const TRACK_LIMITS={gainDb:[-48,12],pan:[-1,1],inputTrimDb:[-24,24],saturation:[0,100],eqLowDb:[-12,12],eqMidDb:[-12,12],eqHighDb:[-12,12],compThreshold:[-36,0],compRatio:[1,12],compAttack:[.001,.1],compRelease:[.05,1],reverbMix:[0,.5],delayMix:[0,.5],delayTime:[.05,.75],delayFeedback:[0,.65],stereoWidth:[0,2]};
  const node=(tag,value)=>{const el=document.createElement(tag);el.textContent=value??"";return el;};
  function validate(p){
    if(!p||p.enabled!==true||!p.settings||typeof p.settings!=="object"||Array.isArray(p.settings))return null;
    const target=p.target==="track"?"track":"main",engine=target==="track"?window.ITZIK_PROJECT_TRACKS:window.ITZIK_MIXER;
    if(!engine)return null;
    let allowed,limits,trackId="";
    if(target==="track"){
      const all=engine.getSettings?.()||{};trackId=p.trackId;
      if(!trackId||!Object.prototype.hasOwnProperty.call(all,trackId))return null;
      allowed=TRACK_KEYS;limits=TRACK_LIMITS;
    }else{
      // Main mixer settings can be staged before playback connects the WebAudio graph.
      if(typeof engine.getSettings!=="function"||typeof engine.apply!=="function")return null;
      if(!engine.getSettings())return null;
      allowed=MAIN_KEYS;limits=MAIN_LIMITS;
    }
    const patch={};
    for(const [key,value] of Object.entries(p.settings)){
      if(!allowed.has(key))continue;
      if(key==="phaseInvert"){if(typeof value==="boolean")patch[key]=value;continue;}
      if(typeof value!=="number"||!Number.isFinite(value)||!limits[key])continue;
      const [min,max]=limits[key];patch[key]=Math.max(min,Math.min(max,value));
    }
    return Object.keys(patch).length?{target,trackId,patch}:null;
  }
  function render(container,result){
    container.replaceChildren();container.appendChild(node("div",result.message||""));
    const safe=validate(result.proposal);if(!safe)return;
    const card=document.createElement("div");card.className="panel itzko-action-proposal";
    card.appendChild(node("h3",result.proposal.title||"הצעת מיקס של איצקו"));
    card.appendChild(node("p",result.proposal.reason||"איצקו מציע שינוי קטן בהגדרות המיקס."));
    const list=document.createElement("ul");
    for(const [key,value] of Object.entries(safe.patch))list.appendChild(node("li",key+": "+value));
    card.appendChild(list);card.appendChild(node("p","השינוי לא יבוצע עד שתלחץ על אישור."));
    const actions=document.createElement("div");actions.className="chat-box";
    const approve=node("button","אישור והחלת השינוי");approve.type="button";approve.className="primary-btn";
    const reject=node("button","לא עכשיו");reject.type="button";reject.className="secondary-btn";
    approve.addEventListener("click",async()=>{
      try{
        if(safe.target==="track"){
          const engine=window.ITZIK_PROJECT_TRACKS;
          const latest=engine?.getTrack?.(safe.trackId);
          if(!latest)throw new Error("הערוץ כבר אינו זמין בפרויקט.");
          const next=engine.setTrack(safe.trackId,{...latest,...safe.patch});
          if(!next)throw new Error("לא ניתן להחיל את השינוי על הערוץ.");
          const id=safe.trackId;
          const gain=document.querySelector('[data-project-track-gain="'+id+'"]');
          const pan=document.querySelector('[data-project-track-pan="'+id+'"]');
          const width=document.querySelector('[data-project-track-width="'+id+'"]');
          if(gain)gain.value=String(next.gainDb);
          if(pan)pan.value=String(next.pan);
          if(width)width.value=String(next.stereoWidth);
          const gainValue=document.querySelector('[data-project-track-gain-value="'+id+'"]');
          const panValue=document.querySelector('[data-project-track-pan-value="'+id+'"]');
          const widthValue=document.querySelector('[data-project-track-width-value="'+id+'"]');
          if(gainValue)gainValue.textContent=next.gainDb.toFixed(1)+" dB";
          if(panValue)panValue.textContent=next.pan<=-.98?"L":next.pan>=.98?"R":next.pan===0?"Center":next.pan<0?"L "+Math.round(-next.pan*100)+"%":"R "+Math.round(next.pan*100)+"%";
          if(widthValue)widthValue.textContent=Math.round(next.stereoWidth*100)+"%";
          document.querySelectorAll("[data-project-track-fx]").forEach(input=>{
            const [key,trackId]=input.dataset.projectTrackFx.split(":");
            if(trackId!==id)return;
            input.value=String(next[key]);
            const output=document.querySelector('[data-project-track-fx-value="'+key+':'+id+'"]');
            if(output)output.textContent=key==="compRatio"?Number(next[key]).toFixed(1)+":1":key==="delayTime"||key==="compAttack"||key==="compRelease"?Math.round(next[key]*1000)+" ms":key==="reverbMix"||key==="delayMix"||key==="delayFeedback"||key==="saturation"?Math.round(next[key]*100)+"%":Number(next[key]).toFixed(1)+" dB";
          });
          document.querySelectorAll("[data-project-track-fx-toggle]").forEach(input=>{
            const [key,trackId]=input.dataset.projectTrackFxToggle.split(":");
            if(trackId===id)input.checked=next[key]===true;
          });
          let cloudSaved=null;
          if(typeof window.updateProjectMetadata==="function"&&window.currentProjectId){
            cloudSaved=await window.updateProjectMetadata({projectTrackMixSettings:engine.getSettings()});
          }
        }else{
          const engine=window.ITZIK_MIXER;
          const latest=engine?.getSettings?.();
          if(!latest)throw new Error("מנוע המיקס אינו פעיל כרגע.");
          const next=engine.apply({...latest,...safe.patch});
          document.querySelectorAll("[data-mix-control]").forEach(input=>{
            const key=input.dataset.mixControl;
            if(!(key in next))return;
            input.value=String(next[key]);
            const output=document.querySelector('[data-mix-value="'+key+'"]');
            if(output)output.textContent=Number(next[key]).toFixed(key==="ratio"?1:0)+(key==="ratio"?":1":["gainDb","masterDb","low","mid","high","threshold"].includes(key)?" dB":"");
          });
          const mute=document.querySelector("#mixMute");
          if(mute){mute.setAttribute("aria-pressed",String(next.mute));mute.textContent=next.mute?"Unmute":"Mute";}
          const ab=document.querySelector("#mixAB");
          if(ab)ab.setAttribute("aria-pressed",String(next.bypass));
          let cloudSaved=null;
          if(typeof window.persistMixSettings==="function")cloudSaved=await window.persistMixSettings();
        }
        approve.disabled=true;reject.disabled=true;approve.textContent="השינוי הוחל";
        const statusText=cloudSaved===false
          ?"השינוי הוחל במיקסר, אך השמירה בענן נכשלה. ההגדרות נשמרו במכשיר אם האחסון המקומי זמין."
          :cloudSaved===true
            ?"השינוי הוחל וההגדרות נשמרו בפרויקט."
            :"השינוי הוחל. אין פרויקט פעיל לשמירה בענן.";
        card.appendChild(node("p",statusText));
      }catch(error){card.appendChild(node("p",error.message||"לא ניתן להחיל את השינוי."));}
    });
    reject.addEventListener("click",()=>card.remove());
    actions.append(approve,reject);card.appendChild(actions);container.appendChild(card);
  }
  window.ITZKO_ACTIONS=Object.freeze({render,validate});
})();
