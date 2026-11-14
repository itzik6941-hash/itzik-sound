(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.ITZIK_WAV_ENCODER=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const MAX_WAV_BYTES=512*1024*1024;
  function encode(buffer,bitDepth=24){
    if(!buffer||!Number.isInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||!Number.isInteger(buffer.length)||buffer.length<1){
      throw new TypeError("AudioBuffer לא תקין לייצוא WAV.");
    }
    if(![16,24,32].includes(Number(bitDepth)))throw new RangeError("עומק הביטים חייב להיות 16, 24 או 32.");
    const channels=Math.min(buffer.numberOfChannels,2);
    const rate=Number(buffer.sampleRate);
    if(!Number.isInteger(rate)||rate<8000||rate>384000)throw new RangeError("קצב הדגימה אינו תקין.");
    const floatMode=Number(bitDepth)===32;
    const bytesPerSample=Number(bitDepth)/8;
    const blockAlign=channels*bytesPerSample;
    const dataSize=buffer.length*blockAlign;
    const totalSize=44+dataSize;
    if(!Number.isSafeInteger(totalSize)||totalSize>MAX_WAV_BYTES||dataSize>0xFFFFFFFF-36){
      throw new RangeError("קובץ ה-WAV גדול מדי לייצוא בדפדפן. נסה עומק ביטים נמוך יותר או קובץ קצר יותר.");
    }
    const output=new ArrayBuffer(totalSize);
    const view=new DataView(output);
    let offset=0;
    const writeText=value=>{for(let i=0;i<value.length;i++)view.setUint8(offset++,value.charCodeAt(i));};
    writeText("RIFF");view.setUint32(offset,36+dataSize,true);offset+=4;
    writeText("WAVE");writeText("fmt ");view.setUint32(offset,16,true);offset+=4;
    view.setUint16(offset,floatMode?3:1,true);offset+=2;
    view.setUint16(offset,channels,true);offset+=2;
    view.setUint32(offset,rate,true);offset+=4;
    view.setUint32(offset,rate*blockAlign,true);offset+=4;
    view.setUint16(offset,blockAlign,true);offset+=2;
    view.setUint16(offset,Number(bitDepth),true);offset+=2;
    writeText("data");view.setUint32(offset,dataSize,true);offset+=4;
    const channelData=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));
    for(let frame=0;frame<buffer.length;frame++){
      for(let channel=0;channel<channels;channel++){
        const raw=Number(channelData[channel][frame]);
        const sample=Number.isFinite(raw)?raw:0;
        if(floatMode){
          view.setFloat32(offset,sample,true);offset+=4;
        }else if(Number(bitDepth)===24){
          const clamped=Math.max(-1,Math.min(1,sample));
          const integer=clamped<0?Math.round(clamped*8388608):Math.round(clamped*8388607);
          view.setUint8(offset++,integer&255);
          view.setUint8(offset++,(integer>>8)&255);
          view.setUint8(offset++,(integer>>16)&255);
        }else{
          const clamped=Math.max(-1,Math.min(1,sample));
          view.setInt16(offset,clamped<0?Math.round(clamped*32768):Math.round(clamped*32767),true);
          offset+=2;
        }
      }
    }
    return new Blob([output],{type:"audio/wav"});
  }
  return Object.freeze({encode,MAX_WAV_BYTES});
});
