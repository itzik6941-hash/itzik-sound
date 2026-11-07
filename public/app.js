const $ = (s) => document.querySelector(s);
const audio = $("#audio");
let currentPage = "home";
let currentFileUrl = null;
let currentFile = null;
let projects = JSON.parse(localStorage.getItem("itzikProjects") || "[]");

const pages = {
 home: {title:"הסטודיו שלך, הסאונד שלך.", html: () => `
  <div class="welcome"><div><div class="eyebrow">WELCOME TO YOUR STUDIO</div><h1>בוא ניצור משהו שנשמע גדול.</h1><p>כל הכלים שלך להפקה מוזיקלית, במקום אחד.<br>העלה שיר והתחל לעבוד עם ITZIK SOUND.</p></div><span class="tag">✦ YOUR MUSIC. YOUR SOUND.</span></div>
  <div class="upload-zone" id="uploadZone"><div class="upload-icon">⇧</div><h2>גרור קובץ לכאן או לחץ לבחירה</h2><p>MP3 · WAV · M4A · AAC · FLAC</p><button class="primary-btn">בחירת קובץ מהמחשב</button></div>
  <div class="section-heading"><h3>כלי הסטודיו</h3><span>בחר מאיפה להתחיל</span></div>
  <div class="quick-grid">
   <div class="quick-card" data-go="mix"><div class="quick-icon">☷</div><b>מיקס AI</b><small>איזון ועיצוב הסאונד של השיר</small></div>
   <div class="quick-card" data-go="master"><div class="quick-icon">◉</div><b>מאסטרינג AI</b><small>ליטוש והכנה להפצה</small></div>
   <div class="quick-card" data-go="pitch"><div class="quick-icon">♬</div><b>תיקון זיופים</b><small>דיוק קולי בשליטה שלך</small></div>
  </div>`},
 mix:{title:"מיקס AI",html:()=>toolPage("מיקס AI","איזון ערוצים, EQ, קומפרסיה ואפקטים — עם אישור שלך לפני כל שינוי.","☷")},
 master:{title:"מאסטרינג AI",html:()=>toolPage("מאסטרינג AI","ליטוש הסאונד, עוצמה ודינמיקה לקראת הפצה.","◉")},
 pitch:{title:"תיקון זיופים",html:()=>`<div class="workspace-title"><div class="quick-icon">♬</div><div><h1>תיקון זיופים</h1><p>אתה מחליט כמה ואיך לתקן.</p></div></div><div class="panel"><h3>מצב תיקון</h3><p>בגרסה הבאה נחבר מנוע זיהוי תווים ותיקון גובה צליל. נבנה שליטה ידנית ואוטומטית, עוצמת תיקון, מהירות, ועריכת תווים בודדים.</p><div class="notice">לא יבוצע שינוי בקובץ המקורי. כל תיקון יישמר כגרסה חדשה לאחר אישורך.</div></div>${filePanel()}`},
 ideas:{title:"רעיונות מוזיקליים",html:()=>toolPage("רעיונות מוזיקליים","אקורדים, מלודיות, קצב, עיבודים וכיווני הפקה לשיר שלך.","✧")},
 reference:{title:"סטודיו רפרנסים",html:()=>toolPage("סטודיו רפרנסים","השווה את הסאונד שלך לשיר ייחוס שתבחר.","◎")},
 assistant:{title:"איצקו AI",html:()=>`<div class="workspace-title"><div class="quick-icon">✳</div><div><h1>איצקו AI</h1><p>העוזר המוזיקלי האישי שלך.</p></div></div><div class="panel"><div class="notice">חיבור מנוע ה-AI עדיין לא הוגדר. כדי שאיצקו יוכל לנתח שירים ולבצע פעולות אמיתיות, נחבר בשלב הבא ספק AI ומנוע עיבוד אודיו בשרת. לא נציג תשובות מדומות כאילו בוצע עיבוד.</div><h3 style="margin-top:22px">מה תרצה לעשות בפרויקט?</h3><div class="chat-box"><input id="chatInput" placeholder="כתוב לאיצקו מה תרצה לשפר..."><button class="primary-btn" id="chatSend">שליחה</button></div><p id="chatReply"></p></div>${filePanel()}`},
 projects:{title:"הפרויקטים שלי",html:()=>`<div class="workspace-title"><div><h1>הפרויקטים שלי</h1><p>העבודות ששמרת במחשב הזה.</p></div></div><div class="project-list">${projects.length?projects.map((p,i)=>`<div class="project-card"><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.date)} · ${escapeHtml(p.fileName||"ללא קובץ")}</small></div><button data-open-project="${i}">פתיחה</button></div>`).join(""):`<div class="panel empty-state" style="grid-column:1/-1"><div class="big">▤</div><b>עדיין אין פרויקטים שמורים</b><p>העלה שיר במסך הראשי כדי ליצור פרויקט ראשון.</p><button class="secondary-btn" data-go="home">חזרה למסך הראשי</button></div>`}</div>`},
 settings:{title:"הגדרות ושפה",html:()=>`<div class="workspace-title"><div><h1>הגדרות ושפה</h1><p>התאמה אישית של סביבת העבודה.</p></div></div><div class="panel"><h3>שפה</h3><p>עברית (פעילה). תמיכה באנגלית תתווסף בהמשך.</p></div><div class="panel"><h3>שמירת פרויקטים</h3><p>בגרסה הנוכחית הפרויקטים נשמרים בדפדפן המקומי. בהמשך נוסיף גיבוי וסנכרון מאובטח.</p></div>`},
 help:{title:"עזרה ותמיכה",html:()=>`<div class="workspace-title"><div><h1>עזרה ותמיכה</h1><p>כל מה שצריך כדי לעבוד בנוחות.</p></div></div><div class="panel"><h3>איך מתחילים?</h3><p>חוזרים למסך הראשי, מעלים קובץ אודיו וממשיכים לכלי הרצוי.</p></div><div class="panel"><h3>האם ה-AI כבר מחובר?</h3><p>עדיין לא. כרגע אנחנו בונים את התשתית והממשק. חיבור AI ועיבוד אודיו אמיתי הוא שלב הפיתוח הבא.</p></div>`}
};
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function filePanel(){return `<div class="panel">${currentFile?`<h3>הקובץ בפרויקט</h3><p>${escapeHtml(currentFile.name)} · ${Math.round(currentFile.size/1024/1024*10)/10} MB</p>`:`<div class="empty-state"><div class="big">♫</div><b>עדיין לא הועלה שיר</b><p>העלה קובץ במסך הראשי כדי לעבוד איתו כאן.</p><button class="secondary-btn" data-go="home">העלאת שיר</button></div>`}</div>`}
function toolPage(name,desc,icon){return `<div class="workspace-title"><div class="quick-icon">${icon}</div><div><h1>${name}</h1><p>${desc}</p></div></div><div class="panel"><h3>העבודה שלך</h3>${currentFile?`<p>הקובץ הפעיל: <b>${escapeHtml(currentFile.name)}</b></p><div class="notice">ממשק הכלי מוכן. בשלב הבא נחבר את מנוע העיבוד האמיתי ונוסיף בקרות מקצועיות.</div>`:`<div class="empty-state"><div class="big">♫</div><b>קודם נעלה שיר</b><p>אותו קובץ יהיה זמין בכל כלי הסטודיו.</p><button class="secondary-btn" data-go="home">העלאת שיר</button></div>`}</div>`}
function render(page){currentPage=page;const p=pages[page]||pages.home;$("#topTitle").textContent=p.title;$("#pageContent").innerHTML=p.html();document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));bindDynamic();}
function bindDynamic(){
 const zone=$("#uploadZone");if(zone){zone.onclick=()=>$("#fileInput").click();zone.ondragover=e=>{e.preventDefault();zone.style.borderColor="var(--cyan)"};zone.ondragleave=()=>zone.style.borderColor="";zone.ondrop=e=>{e.preventDefault();if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);};}
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>render(b.dataset.go));
 document.querySelectorAll("[data-open-project]").forEach(b=>b.onclick=()=>openProject(Number(b.dataset.openProject)));
 const send=$("#chatSend");if(send)send.onclick=sendAssistant;
}
function loadFile(file){
 if(!file.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name)){alert("נא לבחור קובץ אודיו.");return;}
 currentFile=file;if(currentFileUrl)URL.revokeObjectURL(currentFileUrl);currentFileUrl=URL.createObjectURL(file);audio.src=currentFileUrl;
 $("#trackName").textContent=file.name;$("#trackMeta").textContent="קובץ בפרויקט הנוכחי";$("#playerStatus").textContent="מוכן לניגון ולייצוא";$("#playBtn").disabled=false;$("#seek").disabled=false;$("#exportBtn").disabled=false;
 const project={name:file.name.replace(/\.[^.]+$/,""),fileName:file.name,date:new Date().toLocaleString("he-IL"),note:"הקובץ הועלה בסשן הנוכחי"};
 projects.unshift(project);projects=projects.slice(0,30);localStorage.setItem("itzikProjects",JSON.stringify(projects));
 render("home");
}
$("#fileInput").addEventListener("change",e=>{if(e.target.files[0])loadFile(e.target.files[0]);e.target.value="";});
$("#newProject").onclick=()=>{currentFile=null;if(currentFileUrl)URL.revokeObjectURL(currentFileUrl);currentFileUrl=null;audio.pause();audio.removeAttribute("src");audio.load();$("#trackName").textContent="עדיין לא נבחר שיר";$("#trackMeta").textContent="העלה קובץ כדי להתחיל";$("#playBtn").disabled=true;$("#seek").disabled=true;$("#exportBtn").disabled=true;render("home");};
$("#navigation").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)render(b.dataset.page);});
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)render(b.dataset.go);});
$("#playBtn").onclick=()=>{if(audio.paused)audio.play();else audio.pause();};
audio.addEventListener("play",()=>$("#playBtn").textContent="Ⅱ");audio.addEventListener("pause",()=>$("#playBtn").textContent="▶");
function fmt(t){if(!Number.isFinite(t))return"0:00";return Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");}
audio.addEventListener("loadedmetadata",()=>{$("#duration").textContent=fmt(audio.duration);});
audio.addEventListener("timeupdate",()=>{$("#currentTime").textContent=fmt(audio.currentTime);if(audio.duration)$("#seek").value=audio.currentTime/audio.duration*100;});
$("#seek").oninput=()=>{if(audio.duration)audio.currentTime=Number($("#seek").value)/100*audio.duration;};
$("#exportBtn").onclick=()=>{if(!currentFile){alert("קודם צריך להעלות שיר.");return;}$("#exportStatus").textContent="";$("#exportModal").hidden=false;};
$("#closeExport").onclick=()=>{$("#exportModal").hidden=true;};
$("#exportModal").addEventListener("click",e=>{if(e.target.id==="exportModal")$("#exportModal").hidden=true;});
$("#exportFormat").onchange=()=>{const mp3=$("#exportFormat").value==="mp3";$("#mp3Bitrate").hidden=!mp3;$("#bitrateLabel").hidden=!mp3;};
$("#startExport").onclick=exportCurrentFile;
async function exportCurrentFile(){
 const status=$("#exportStatus"),button=$("#startExport");
 if(!currentFile)return;
 const format=$("#exportFormat").value;button.disabled=true;status.textContent="מכין את הקובץ לייצוא...";
 try{
  const bytes=await currentFile.arrayBuffer();
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)throw new Error("הדפדפן אינו תומך בעיבוד אודיו.");
  const ctx=new AudioCtx();const buffer=await ctx.decodeAudioData(bytes.slice(0));await ctx.close();
  let blob;
  if(format==="wav")blob=encodeWav(buffer);
  else {if(!window.lamejs)throw new Error("מנוע MP3 לא נטען. בדוק חיבור לאינטרנט והפעל מחדש את האתר.");blob=encodeMp3(buffer,Number($("#mp3Bitrate").value));}
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(currentFile.name.replace(/\.[^.]+$/,"")||"itzik-sound")+"."+format;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  status.textContent="הקובץ מוכן! בדוק את תיקיית ההורדות.";
 }catch(err){console.error(err);status.textContent="הייצוא נכשל: "+(err.message||"שגיאה לא ידועה");}
 finally{button.disabled=false;}
}
function encodeWav(buffer){
 const channels=Math.min(buffer.numberOfChannels,2),length=buffer.length,rate=buffer.sampleRate,bits=16,block=channels*bits/8;
 const out=new ArrayBuffer(44+length*block),v=new DataView(out);let o=0;
 const str=t=>{for(let i=0;i<t.length;i++)v.setUint8(o++,t.charCodeAt(i));};
 str("RIFF");v.setUint32(o,36+length*block,true);o+=4;str("WAVE");str("fmt ");v.setUint32(o,16,true);o+=4;v.setUint16(o,1,true);o+=2;v.setUint16(o,channels,true);o+=2;v.setUint32(o,rate,true);o+=4;v.setUint32(o,rate*block,true);o+=4;v.setUint16(o,block,true);o+=2;v.setUint16(o,bits,true);o+=2;str("data");v.setUint32(o,length*block,true);o+=4;
 const data=Array.from({length:channels},(_,c)=>buffer.getChannelData(c));
 for(let i=0;i<length;i++)for(let c=0;c<channels;c++){let x=Math.max(-1,Math.min(1,data[c][i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2;}
 return new Blob([out],{type:"audio/wav"});
}
function encodeMp3(buffer,bitrate){
 const channels=Math.min(buffer.numberOfChannels,2),rate=buffer.sampleRate,encoder=new lamejs.Mp3Encoder(channels,rate,bitrate),left=toInt16(buffer.getChannelData(0)),right=channels===2?toInt16(buffer.getChannelData(1)):null,chunks=[],size=1152;
 for(let i=0;i<left.length;i+=size){const l=left.subarray(i,i+size),r=right?right.subarray(i,i+size):undefined;const chunk=channels===2?encoder.encodeBuffer(l,r):encoder.encodeBuffer(l);if(chunk.length)chunks.push(new Int8Array(chunk));}
 const end=encoder.flush();if(end.length)chunks.push(new Int8Array(end));return new Blob(chunks,{type:"audio/mpeg"});
}
function toInt16(data){const out=new Int16Array(data.length);for(let i=0;i<data.length;i++){const x=Math.max(-1,Math.min(1,data[i]));out[i]=x<0?x*32768:x*32767;}return out;}

$("#newProject").title="איפוס סביבת העבודה ופתיחת פרויקט חדש";
function openProject(i){const p=projects[i];if(!p)return;alert("הפרויקט נשמר ברשימה, אך קובץ האודיו עצמו לא נשמר עדיין לאחר רענון. בשלב הבא נוסיף שמירת קבצים מלאה כדי לאפשר שחזור מלא.");render("home");}
async function sendAssistant(){const input=$("#chatInput"),reply=$("#chatReply");if(!input.value.trim())return;reply.textContent="בודק חיבור...";try{const r=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:input.value})});const data=await r.json();reply.textContent=data.message||data.error;}catch{reply.textContent="לא ניתן להגיע לשרת. בדוק שהאתר פועל.";}}
render("home");
