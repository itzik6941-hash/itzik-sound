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
    approve.addEventListener("click",()=>{
      try{
        if(safe.target==="track"){
          const latest=window.ITZIK_PROJECT_TRACKS?.getTrack?.(safe.trackId);
          if(!latest)throw new Error("הערוץ כבר אינו זמין בפרויקט.");
          window.ITZIK_PROJECT_TRACKS.setTrack(safe.trackId,{...latest,...safe.patch});
        }else{
          const latest=window.ITZIK_MIXER?.getSettings?.();
          if(!latest)throw new Error("מנוע המיקס אינו פעיל כרגע.");
          window.ITZIK_MIXER.apply({...latest,...safe.patch});
        }
        approve.disabled=true;reject.disabled=true;approve.textContent="השינוי הוחל";
        card.appendChild(node("p","השינוי הוחל. אפשר לבטל דרך Undo במיקסר הרב-ערוצי או לאפס את המיקסר הראשי."));
      }catch(error){card.appendChild(node("p",error.message||"לא ניתן להחיל את השינוי."));}
    });
    reject.addEventListener("click",()=>card.remove());
    actions.append(approve,reject);card.appendChild(actions);container.appendChild(card);
  }
  window.ITZKO_ACTIONS=Object.freeze({render,validate});
})();
