
const $ = (s) => document.querySelector(s);
const audio = $("#audio");

let currentPage = "home";
let currentFileUrl = null;
let currentFile = null;
let currentProjectId = null;
let projects = [];
let supabaseClient = null;
let currentUser = null;
let authMode = "login";
let authBusy = false;

const pages = {
 home: {title:"הסטודיו שלך, הסאונד שלך.", html: () => `
  <div class="welcome"><div><div class="eyebrow">WELCOME TO YOUR STUDIO</div><h1>בוא ניצור משהו שנשמע גדול.</h1><p>כל הכלים שלך להפקה מוזיקלית, במקום אחד.<br>העלה שיר והתחל לעבוד עם ITZIK SOUND.</p></div><span class="tag">✦ YOUR MUSIC. YOUR SOUND.</span></div>
  <div class="upload-zone" id="uploadZone"><div class="upload-icon">⇧</div><h2>גרור קובץ לכאן או לחץ לבחירה</h2><p>MP3 · WAV · M4A · AAC · FLAC · עד 50MB</p><button class="primary-btn" type="button">בחירת קובץ מהמחשב</button></div>
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

 assistant:{title:"איצקו AI",html:()=>`<div class="workspace-title"><div class="quick-icon">✳</div><div><h1>איצקו AI</h1><p>העוזר המוזיקלי האישי שלך.</p></div></div><div class="panel"><div class="notice">איצקו מחובר למנוע AI ויכול לענות על שאלות מוזיקליות ולייעץ. ביצוע פעולות עיבוד אודיו אמיתיות יחייב חיבור מנועי עיבוד נוספים.</div><h3 style="margin-top:22px">מה תרצה לעשות בפרויקט?</h3><div class="chat-box"><input id="chatInput" placeholder="כתוב לאיצקו מה תרצה לשפר..."><button class="primary-btn" id="chatSend">שליחה</button></div><p id="chatReply"></p></div>${filePanel()}`},

 projects:{title:"הפרויקטים שלי",html:()=>`<div class="workspace-title"><div><h1>הפרויקטים שלי</h1><p>הפרויקטים שלך שמורים בחשבון וניתנים לפתיחה מכל מכשיר.</p></div></div><div class="project-list">${projects.length?projects.map(p=>`<div class="project-card"><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(formatDate(p.created_at))} · ${escapeHtml(p.original_file_name||"ללא קובץ")}</small></div><button data-open-project="${escapeHtml(p.id)}">פתיחה</button></div>`).join(""):`<div class="panel empty-state" style="grid-column:1/-1"><div class="big">▤</div><b>עדיין אין פרויקטים שמורים</b><p>העלה שיר במסך הראשי כדי ליצור פרויקט ראשון. הוא יישמר בחשבון שלך.</p><button class="secondary-btn" data-go="home">חזרה למסך הראשי</button></div>`}</div>`},

settings:{title:"הגדרות ושפה",html:()=>`
  <div class="workspace-title">
    <div>
      <h1>הגדרות ושפה</h1>
      <p>התאמה אישית של סביבת העבודה שלך.</p>
    </div>
  </div>

  <div class="panel">
    <h3>🌍 בחירת שפה</h3>
    <p>בחר את השפה שבה תרצה להשתמש ב־ITZIK SOUND.</p>

    <select id="languageSelect" class="input">
      <option value="he">🇮🇱 עברית</option>
      <option value="en">🇬🇧 English</option>
      <option value="ar">🇸🇦 العربية</option>
      <option value="ru">🇷🇺 Русский</option>
      <option value="es">🇪🇸 Español</option>
      <option value="fr">🇫🇷 Français</option>
      <option value="de">🇩🇪 Deutsch</option>
    </select>

    <button class="btn btn-primary" id="saveLanguageBtn">
      שמור שפה
    </button>

    <p id="languageStatus"></p>
  </div>

  <div class="panel">
    <h3>☁️ שמירת פרויקטים</h3>
    <p>
      הפרויקטים וקובצי האודיו נשמרים בחשבון שלך בענן פרטי,
      בכפוף למגבלות האחסון של התוכנית.
    </p>
  </div>
`},

 help:{title:"עזרה ותמיכה",html:()=>`<div class="workspace-title"><div><h1>עזרה ותמיכה</h1><p>כל מה שצריך כדי לעבוד בנוחות.</p></div></div><div class="panel"><h3>איך מתחילים?</h3><p>חוזרים למסך הראשי, מעלים קובץ אודיו וממשיכים לכלי הרצוי. הפרויקט נשמר בחשבון שלך.</p></div><div class="panel"><h3>האם ה-AI כבר מחובר?</h3><p>איצקו יכול לשוחח ולייעץ. עיבוד אודיו אמיתי יחייב מנועי עיבוד נוספים.</p></div><div class="panel"><h3>האם הפרויקטים פרטיים?</h3><p>הגישה לפרויקטים ולקובצי האודיו מוגבלת למשתמש המחובר באמצעות הרשאות Supabase.</p></div>`}
};

function escapeHtml(s){
 return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function formatDate(value){
 if(!value)return"";
 const d=new Date(value);
 return Number.isNaN(d.getTime())?"":d.toLocaleString("he-IL");
}

function filePanel(){
 return `<div class="panel">${currentFile?`<h3>הקובץ בפרויקט</h3><p>${escapeHtml(currentFile.name)} · ${Math.round(currentFile.size/1024/1024*10)/10} MB</p>`:`<div class="empty-state"><div class="big">♫</div><b>עדיין לא הועלה שיר</b><p>העלה קובץ במסך הראשי כדי לעבוד איתו כאן.</p><button class="secondary-btn" data-go="home">העלאת שיר</button></div>`}</div>`;
}

function toolPage(name,desc,icon){
 return `<div class="workspace-title"><div class="quick-icon">${icon}</div><div><h1>${name}</h1><p>${desc}</p></div></div><div class="panel"><h3>העבודה שלך</h3>${currentFile?`<p>הקובץ הפעיל: <b>${escapeHtml(currentFile.name)}</b></p><div class="notice">ממשק הכלי מוכן. בשלב הבא נחבר את מנוע העיבוד האמיתי ונוסיף בקרות מקצועיות.</div>`:`<div class="empty-state"><div class="big">♫</div><b>קודם נעלה שיר</b><p>אותו קובץ יהיה זמין בכל כלי הסטודיו.</p><button class="secondary-btn" data-go="home">העלאת שיר</button></div>`}</div>`;
}

function render(page){
 currentPage=page;
 const p=pages[page]||pages.home;
 $("#topTitle").textContent=p.title;
 $("#pageContent").innerHTML=p.html();
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 bindDynamic();
}

function bindDynamic(){
 const zone=$("#uploadZone");
 if(zone){
  zone.onclick=()=>$("#fileInput").click();
  zone.ondragover=e=>{e.preventDefault();zone.style.borderColor="var(--cyan)";};
  zone.ondragleave=()=>zone.style.borderColor="";
  zone.ondrop=e=>{e.preventDefault();if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);};
 }

 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>render(b.dataset.go));
 document.querySelectorAll("[data-open-project]").forEach(b=>b.onclick=()=>openProject(b.dataset.openProject));

 const send=$("#chatSend");
 if(send)send.onclick=sendAssistant;

 const languageSelect=$("#languageSelect");
 const saveLanguageBtn=$("#saveLanguageBtn");
 const languageStatus=$("#languageStatus");

 if(languageSelect){
  const currentLanguage=window.ITZIK_I18N?.getLanguage?.()||"he";
  languageSelect.value=currentLanguage;
 }

 if(saveLanguageBtn && languageSelect){
  saveLanguageBtn.onclick=()=>{
   const selected=languageSelect.value;

   if(window.ITZIK_I18N){
    window.ITZIK_I18N.applyLanguage(selected);
   }else{
    localStorage.setItem("itzik_language",selected);
    document.documentElement.lang=selected;
    document.documentElement.dir=["he","ar"].includes(selected)?"rtl":"ltr";
   }

   if(languageStatus){
    languageStatus.textContent="השפה נשמרה בהצלחה! כדי להשלים את התרגום נמשיך לחבר את המסכים.";
   }
  };
 }
}

function showAuth(message=""){
 $("#appShell").hidden=true;
 $("#authScreen").hidden=false;
 $("#authMessage").textContent=message;
}

function showApp(user){
 currentUser=user;
 $("#authScreen").hidden=true;
 $("#appShell").hidden=false;
 $("#accountEmail").textContent=user.email||"חשבון מחובר";
 $(".profile-avatar").textContent=(user.email||"א").charAt(0).toUpperCase();
}

function setAuthMessage(message,isError=false){
 const el=$("#authMessage");
 el.textContent=message;
 el.classList.toggle("error",isError);
}

function setAuthMode(mode){
 authMode=mode;
 const signup=mode==="signup";
 $("#authTitle").textContent=signup?"יוצרים חשבון חדש":"ברוך הבא לאולפן שלך";
 $("#authSubtitle").textContent=signup?"פתח חשבון כדי לשמור את הפרויקטים שלך בענן.":"התחבר כדי לשמור את הפרויקטים שלך בענן.";
 $("#authSubmit").textContent=signup?"יצירת חשבון":"התחברות";
 $("#authPassword").autocomplete=signup?"new-password":"current-password";
 $("#authSwitch").innerHTML=signup?'כבר יש לך חשבון? <button id="toggleAuth" type="button">התחברות</button>':'אין לך חשבון? <button id="toggleAuth" type="button">הרשמה</button>';
 $("#toggleAuth").onclick=()=>{setAuthMode(signup?"login":"signup");setAuthMessage("");};
 setAuthMessage("");
}

function friendlyAuthError(error){
 const m=error?.message||"אירעה שגיאה לא צפויה.";
 if(/invalid login credentials/i.test(m))return"האימייל או הסיסמה אינם נכונים.";
 if(/email not confirmed/i.test(m))return"צריך לאשר את כתובת האימייל דרך ההודעה שנשלחה אליך.";
 if(/user already registered/i.test(m))return"כבר קיים חשבון עם האימייל הזה. נסה להתחבר.";
 return m;
}

async function handleAuthSubmit(e){
 e.preventDefault();
 if(authBusy)return;

 const email=$("#authEmail").value.trim();
 const password=$("#authPassword").value;

 authBusy=true;
 $("#authSubmit").disabled=true;
 setAuthMessage(authMode==="signup"?"יוצר חשבון...":"מתחבר...");

 try{
  let result;

  if(authMode==="signup"){
   result=await supabaseClient.auth.signUp({
    email,
    password,
    options:{emailRedirectTo:window.location.origin}
   });

   if(result.error)throw result.error;

   if(result.data.session){
    await onSignedIn(result.data.session.user);
   }else{
    setAuthMessage("ההרשמה התקבלה. בדוק את תיבת האימייל שלך ואשר את החשבון, ואז חזור להתחבר.");
   }
  }else{
   result=await supabaseClient.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   await onSignedIn(result.data.user);
  }
 }catch(err){
  setAuthMessage(friendlyAuthError(err),true);
 }finally{
  authBusy=false;
  $("#authSubmit").disabled=false;
 }
}

async function signInWithGoogle(){
 setAuthMessage("מעביר להתחברות עם Google...");
 const {error}=await supabaseClient.auth.signInWithOAuth({
  provider:"google",
  options:{redirectTo:window.location.origin}
 });
 if(error)setAuthMessage(friendlyAuthError(error),true);
}

async function onSignedIn(user){
 if(!user)return;

 // Prevent duplicate loading when both the OAuth event
 // and getSession report the same user.
 if(currentUser?.id===user.id){
  showApp(user);
  return;
 }

 showApp(user);
 await loadProjects();
 render("home");
}

async function loadProjects(){
 const {data,error}=await supabaseClient
  .from("projects")
  .select("id,name,original_file_name,storage_path,metadata,created_at,updated_at")
  .order("created_at",{ascending:false});

 if(error){
  console.error(error);
  alert("התחברת, אבל לא הצלחתי לטעון את הפרויקטים: "+error.message);
  return;
 }

 projects=data||[];
}

async function signOut(){
 if(!confirm("לצאת מהחשבון? הפרויקטים השמורים בענן לא יימחקו."))return;

 const {error}=await supabaseClient.auth.signOut();

 if(error){
  alert("לא הצלחתי לצאת: "+error.message);
  return;
 }

 resetWorkspace();
 currentUser=null;
 projects=[];
 showAuth("התנתקת מהחשבון בהצלחה.");
 setAuthMode("login");
}

function resetWorkspace(){
 currentProjectId=null;
 currentFile=null;

 if(currentFileUrl)URL.revokeObjectURL(currentFileUrl);
 currentFileUrl=null;

 audio.pause();
 audio.removeAttribute("src");
 audio.load();

 $("#trackName").textContent="עדיין לא נבחר שיר";
 $("#trackMeta").textContent="העלה קובץ כדי להתחיל";
 $("#playerStatus").textContent="ממתין לקובץ";
 $("#playBtn").disabled=true;
 $("#seek").disabled=true;
 $("#exportBtn").disabled=true;
}

async function loadFile(file,existingProjectId=null){
 if(!file.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name)){
  alert("נא לבחור קובץ אודיו.");
  return;
 }

 if(file.size>50*1024*1024){
  alert("הקובץ גדול מ־50MB. כרגע מגבלת ההעלאה היא 50MB.");
  return;
 }

 currentFile=file;
 currentProjectId=existingProjectId;

 if(currentFileUrl)URL.revokeObjectURL(currentFileUrl);
 currentFileUrl=URL.createObjectURL(file);
 audio.src=currentFileUrl;

 $("#trackName").textContent=file.name;
 $("#trackMeta").textContent="קובץ בפרויקט הנוכחי";
 $("#playerStatus").textContent="מוכן לניגון ולייצוא";
 $("#playBtn").disabled=false;
 $("#seek").disabled=false;
 $("#exportBtn").disabled=false;

 if(!existingProjectId)await saveNewProject(file);
 render("home");
}

async function saveNewProject(file){
 const id=crypto.randomUUID();
 const safeName=file.name.replace(/[^\w.() -]/g,"_").slice(0,100)||"audio-file";
 const storagePath=`${currentUser.id}/${id}/${safeName}`;

 $("#playerStatus").textContent="שומר פרויקט בענן...";

 const {error:uploadError}=await supabaseClient
  .storage.from("project-audio")
  .upload(storagePath,file,{
   contentType:file.type||"application/octet-stream",
   upsert:false
  });

 if(uploadError){
  console.error(uploadError);
  currentProjectId=null;
  $("#playerStatus").textContent="הקובץ נטען, אך לא נשמר בענן";
  alert("הקובץ נטען לנגן, אבל השמירה בענן נכשלה: "+uploadError.message);
  return;
 }

 const {data,error}=await supabaseClient
  .from("projects")
  .insert({
   id,
   user_id:currentUser.id,
   name:file.name.replace(/\.[^.]+$/,""),
   original_file_name:file.name,
   storage_path:storagePath,
   metadata:{}
  })
  .select()
  .single();

 if(error){
  await supabaseClient.storage.from("project-audio").remove([storagePath]);
  currentProjectId=null;
  $("#playerStatus").textContent="השמירה נכשלה";
  alert("קובץ האודיו הועלה אך רישום הפרויקט נכשל: "+error.message);
  return;
 }

 currentProjectId=data.id;
 $("#playerStatus").textContent="הפרויקט נשמר בענן";
 await loadProjects();
}

async function openProject(id){
 const p=projects.find(x=>x.id===id);
 if(!p)return;

 if(!p.storage_path){
  alert("לא נמצא קובץ אודיו שמור בפרויקט הזה.");
  return;
 }

 $("#playerStatus").textContent="טוען פרויקט מהענן...";

 const {data,error}=await supabaseClient
  .storage.from("project-audio")
  .createSignedUrl(p.storage_path,300);

 if(error){
  alert("לא הצלחתי לפתוח את קובץ הפרויקט: "+error.message);
  return;
 }

 try{
  const response=await fetch(data.signedUrl);
  if(!response.ok)throw new Error("הורדת הקובץ נכשלה.");

  const blob=await response.blob();
  const file=new File(
   [blob],
   p.original_file_name||p.name,
   {type:blob.type||"audio/mpeg"}
  );

  await loadFile(file,p.id);
  $("#trackMeta").textContent="פרויקט שמור בענן";
 }catch(err){
  alert("לא הצלחתי לטעון את הפרויקט: "+err.message);
 }
}

$("#fileInput").addEventListener("change",e=>{
 if(e.target.files[0])loadFile(e.target.files[0]);
 e.target.value="";
});

$("#newProject").onclick=()=>{
 resetWorkspace();
 render("home");
};

$("#navigation").addEventListener("click",e=>{
 const b=e.target.closest("[data-page]");
 if(b)render(b.dataset.page);
});

document.addEventListener("click",e=>{
 const b=e.target.closest("[data-go]");
 if(b)render(b.dataset.go);
});

$("#playBtn").onclick=()=>{
 if(audio.paused)audio.play();
 else audio.pause();
};

audio.addEventListener("play",()=>$("#playBtn").textContent="Ⅱ");
audio.addEventListener("pause",()=>$("#playBtn").textContent="▶");

function fmt(t){
 if(!Number.isFinite(t))return"0:00";
 return Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
}

audio.addEventListener("loadedmetadata",()=>{
 $("#duration").textContent=fmt(audio.duration);
});

audio.addEventListener("timeupdate",()=>{
 $("#currentTime").textContent=fmt(audio.currentTime);
 if(audio.duration)$("#seek").value=audio.currentTime/audio.duration*100;
});

$("#seek").oninput=()=>{
 if(audio.duration)audio.currentTime=Number($("#seek").value)/100*audio.duration;
};

$("#exportBtn").onclick=()=>{
 if(!currentFile){
  alert("קודם צריך להעלות שיר.");
  return;
 }
 $("#exportStatus").textContent="";
 $("#exportModal").hidden=false;
};

$("#closeExport").onclick=()=>{
 $("#exportModal").hidden=true;
};

$("#exportModal").addEventListener("click",e=>{
 if(e.target.id==="exportModal")$("#exportModal").hidden=true;
});

$("#exportFormat").onchange=()=>{
 const mp3=$("#exportFormat").value==="mp3";
 $("#mp3Bitrate").hidden=!mp3;
 $("#bitrateLabel").hidden=!mp3;
};

$("#startExport").onclick=exportCurrentFile;

async function exportCurrentFile(){
 const status=$("#exportStatus");
 const button=$("#startExport");

 if(!currentFile)return;

 const format=$("#exportFormat").value;
 button.disabled=true;
 status.textContent="מכין את הקובץ לייצוא...";

 try{
  const bytes=await currentFile.arrayBuffer();
  const AudioCtx=window.AudioContext||window.webkitAudioContext;

  if(!AudioCtx)throw new Error("הדפדפן אינו תומך בעיבוד אודיו.");

  const ctx=new AudioCtx();
  const buffer=await ctx.decodeAudioData(bytes.slice(0));
  await ctx.close();

  let blob;

  if(format==="wav"){
   blob=encodeWav(buffer);
  }else{
   if(!window.lamejs)throw new Error("מנוע MP3 לא נטען. בדוק חיבור לאינטרנט והפעל מחדש את האתר.");
   blob=encodeMp3(buffer,Number($("#mp3Bitrate").value));
  }

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=(currentFile.name.replace(/\.[^.]+$/,"")||"itzik-sound")+"."+format;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url),30000);
  status.textContent="הקובץ מוכן! בדוק את תיקיית ההורדות.";
 }catch(err){
  console.error(err);
  status.textContent="הייצוא נכשל: "+(err.message||"שגיאה לא ידועה");
 }finally{
  button.disabled=false;
 }
}

function encodeWav(buffer){
 const channels=Math.min(buffer.numberOfChannels,2);
 const length=buffer.length;
 const rate=buffer.sampleRate;
 const bits=16;
 const block=channels*bits/8;
 const out=new ArrayBuffer(44+length*block);
 const v=new DataView(out);
 let o=0;

 const str=t=>{
  for(let i=0;i<t.length;i++)v.setUint8(o++,t.charCodeAt(i));
 };

 str("RIFF");
 v.setUint32(o,36+length*block,true);o+=4;
 str("WAVE");
 str("fmt ");
 v.setUint32(o,16,true);o+=4;
 v.setUint16(o,1,true);o+=2;
 v.setUint16(o,channels,true);o+=2;
 v.setUint32(o,rate,true);o+=4;
 v.setUint32(o,rate*block,true);o+=4;
 v.setUint16(o,block,true);o+=2;
 v.setUint16(o,bits,true);o+=2;
 str("data");
 v.setUint32(o,length*block,true);o+=4;

 const data=Array.from(
  {length:channels},
  (_,c)=>buffer.getChannelData(c)
 );

 for(let i=0;i<length;i++){
  for(let c=0;c<channels;c++){
   let x=Math.max(-1,Math.min(1,data[c][i]));
   v.setInt16(o,x<0?x*32768:x*32767,true);
   o+=2;
  }
 }

 return new Blob([out],{type:"audio/wav"});
}

function encodeMp3(buffer,bitrate){
 const channels=Math.min(buffer.numberOfChannels,2);
 const rate=buffer.sampleRate;
 const encoder=new lamejs.Mp3Encoder(channels,rate,bitrate);
 const left=toInt16(buffer.getChannelData(0));
 const right=channels===2?toInt16(buffer.getChannelData(1)):null;
 const chunks=[];
 const size=1152;

 for(let i=0;i<left.length;i+=size){
  const l=left.subarray(i,i+size);
  const r=right?right.subarray(i,i+size):undefined;
  const chunk=channels===2
   ?encoder.encodeBuffer(l,r)
   :encoder.encodeBuffer(l);

  if(chunk.length)chunks.push(new Int8Array(chunk));
 }

 const end=encoder.flush();
 if(end.length)chunks.push(new Int8Array(end));

 return new Blob(chunks,{type:"audio/mpeg"});
}

function toInt16(data){
 const out=new Int16Array(data.length);

 for(let i=0;i<data.length;i++){
  const x=Math.max(-1,Math.min(1,data[i]));
  out[i]=x<0?x*32768:x*32767;
 }

 return out;
}

// Send a message to ITZKO with the current user's secure session token
async function sendAssistant(){
 const input=$("#chatInput");
 const reply=$("#chatReply");
 const button=$("#chatSend");
 const message=input.value.trim();

 if(!message)return;

 button.disabled=true;
 reply.textContent="איצקו חושב...";

 try{
  const {data,error}=await supabaseClient.auth.getSession();

  if(error)throw error;

  const accessToken=data.session?.access_token;

  if(!accessToken){
   throw new Error("פג תוקף החיבור לחשבון. התחבר מחדש.");
  }

  const r=await fetch("/api/assistant",{
   method:"POST",
   headers:{
    "Content-Type":"application/json",
    "Authorization":`Bearer ${accessToken}`
   },
   body:JSON.stringify({message})
  });

  const result=await r.json();

  if(!r.ok){
   throw new Error(result.message||"איצקו לא הצליח לענות כרגע.");
  }

  reply.textContent=result.message||"לא התקבלה תשובה מאיצקו.";
 }catch(err){
  console.error("ITZKO error:",err);
  reply.textContent=err.message||"לא ניתן להגיע לשרת. בדוק שהאתר פועל.";
 }finally{
  button.disabled=false;
 }
}

async function init(){
 const config=window.ITZIK_CONFIG||{};

 if(!config.supabaseUrl||!config.supabaseKey||!window.supabase?.createClient){
  showAuth("חיבור החשבון עדיין לא הוגדר בשרת. בדוק את משתני Supabase ב-Render.");
  $("#authForm").addEventListener("submit",e=>e.preventDefault());
  return;
 }

 supabaseClient=window.supabase.createClient(
  config.supabaseUrl,
  config.supabaseKey
 );

 $("#authForm").addEventListener("submit",handleAuthSubmit);
 $("#googleLogin").onclick=signInWithGoogle;
 $("#signOutBtn").onclick=signOut;

 setAuthMode("login");

 // Handle both Google OAuth return and normal sign-in events.
 // setTimeout avoids doing Supabase work inside its auth callback.
 supabaseClient.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_OUT"){
   currentUser=null;
   projects=[];
   resetWorkspace();
   showAuth();
  }

  if(event==="SIGNED_IN"&&session?.user){
   setTimeout(()=>{
    onSignedIn(session.user).catch(err=>console.error("Sign-in error:",err));
   },0);
  }
 });

 const {data,error}=await supabaseClient.auth.getSession();

 if(error){
  showAuth("לא הצלחתי לבדוק את מצב ההתחברות: "+error.message);
  return;
 }

 if(data.session?.user){
  await onSignedIn(data.session.user);
 }else{
  showAuth();
 }
}

init();
