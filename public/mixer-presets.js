(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.ITZIK_MIX_PRESETS=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const definitions={
  clean:{labelHe:"נקי ומאוזן",labelEn:"Clean & balanced",settings:{gainDb:0,pan:0,low:0,mid:0,high:0,threshold:-18,ratio:1,reverb:0,delay:0,width:1,masterDb:0,mute:false,bypass:false}},
  vocal:{labelHe:"בהירות לווקאל",labelEn:"Vocal clarity",settings:{gainDb:0,pan:0,low:-1,mid:1.5,high:1.5,threshold:-22,ratio:2.5,reverb:0.04,delay:0,width:1,masterDb:0,mute:false,bypass:false}},
  warm:{labelHe:"חום ורכות",labelEn:"Warm & smooth",settings:{gainDb:0,pan:0,low:1.5,mid:0.5,high:-1.5,threshold:-20,ratio:2,reverb:0.08,delay:0.02,width:0.95,masterDb:0,mute:false,bypass:false}},
  punch:{labelHe:"פאנץ' ועוצמה",labelEn:"Punch & power",settings:{gainDb:0,pan:0,low:1.5,mid:-0.5,high:1,threshold:-25,ratio:3.5,reverb:0.02,delay:0,width:1.05,masterDb:-1,mute:false,bypass:false}},
  wide:{labelHe:"סטריאו רחב",labelEn:"Wide stereo",settings:{gainDb:0,pan:0,low:0,mid:0,high:0.5,threshold:-18,ratio:1.5,reverb:0.06,delay:0.03,width:1.35,masterDb:0,mute:false,bypass:false}}
 };
 function list(){return Object.entries(definitions).map(([id,item])=>({id,labelHe:item.labelHe,labelEn:item.labelEn}));}
 function get(id){const item=definitions[id];return item?{...item.settings}:null;}
 return Object.freeze({list,get});
});
