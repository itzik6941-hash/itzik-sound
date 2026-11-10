
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
let soundEnabled = (()=>{try{return localStorage.getItem("itzik_sound_enabled")==="true";}catch{return false;}})();
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

 mix:{title:"מיקס AI",html:()=>mixPage()},
 master:{title:"מאסטרינג AI",html:()=>masteringPage()},
 pitch:{title:"תיקון זיופים",html:()=>`<div class="workspace-title"><div class="quick-icon">♬</div><div><h1>תיקון זיופים</h1><p>אתה מחליט כמה ואיך לתקן.</p></div></div><div class="panel"><h3>מצב תיקון</h3><p>בגרסה הבאה נחבר מנוע זיהוי תווים ותיקון גובה צליל. נבנה שליטה ידנית ואוטומטית, עוצמת תיקון, מהירות, ועריכת תווים בודדים.</p><div class="notice">לא יבוצע שינוי בקובץ המקורי. כל תיקון יישמר כגרסה חדשה לאחר אישורך.</div></div>${filePanel()}`},

 ideas:{title:"רעיונות מוזיקליים",html:()=>toolPage("רעיונות מוזיקליים","אקורדים, מלודיות, קצב, עיבודים וכיווני הפקה לשיר שלך.","✧")},
 reference:{title:"סטודיו רפרנסים",html:()=>toolPage("סטודיו רפרנסים","השווה את הסאונד שלך לשיר ייחוס שתבחר.","◎")},

 assistant:{title:"איצקו AI",html:()=>`<div class="workspace-title"><div class="quick-icon">✳</div><div><h1>איצקו AI</h1><p>העוזר המוזיקלי האישי שלך.</p></div></div><div class="panel"><div class="notice">איצקו מחובר למנוע AI ויכול לענות על שאלות מוזיקליות ולייעץ. ביצוע פעולות עיבוד אודיו אמיתיות יחייב חיבור מנועי עיבוד נוספים.</div><h3 style="margin-top:22px">מה תרצה לעשות בפרויקט?</h3><div class="chat-box"><input id="chatInput" placeholder="כתוב לאיצקו מה תרצה לשפר..."><button class="primary-btn" id="chatSend">שליחה</button></div><p id="chatReply"></p></div>${filePanel()}`},

 projects:{title:"הפרויקטים שלי",html:()=>`<div class="workspace-title"><div><h1>הפרויקטים שלי</h1><p>הפרויקטים שלך שמורים בחשבון וניתנים לפתיחה מכל מכשיר.</p></div></div><div class="project-list">${projects.length?projects.map(p=>`<div class="project-card"><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(formatDate(p.created_at))} · ${escapeHtml(p.original_file_name||"ללא קובץ")}</small></div><button data-open-project="${escapeHtml(p.id)}">פתיחה</button>
<button class="delete-project-btn" data-delete-project="${escapeHtml(p.id)}">🗑 מחיקה</button></div>`).join(""):`<div class="panel empty-state" style="grid-column:1/-1"><div class="big">▤</div><b>עדיין אין פרויקטים שמורים</b><p>העלה שיר במסך הראשי כדי ליצור פרויקט ראשון. הוא יישמר בחשבון שלך.</p><button class="secondary-btn" data-go="home">חזרה למסך הראשי</button></div>`}</div>`},

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
    </select>

    <button class="btn btn-primary" id="saveLanguageBtn">
      שמור שפה
    </button>

    <p id="languageStatus"></p>
  </div>
  <div class="panel">
    <h3>🔊 צליל פתיחה</h3>
    <p>בחר אם להפעיל את צליל הפתיחה של ITZIK SOUND.</p>

    <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <input id="studioSoundEnabled" type="checkbox" style="width:auto">
      הפעל צליל פתיחה
    </label>

    <p id="soundStatus"></p>
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
function syncSoundControls(){
  const authToggle=$("#authSoundEnabled");
  const studioToggle=$("#studioSoundEnabled");

  if(authToggle)authToggle.checked=soundEnabled;
  if(studioToggle)studioToggle.checked=soundEnabled;
}

async function saveSoundPreference(enabled){
  soundEnabled=Boolean(enabled);

  localStorage.setItem("itzik_sound_enabled",String(soundEnabled));
  localStorage.setItem("itzik_sound_preference_set","1");

  syncSoundControls();

  if(currentUser && supabaseClient){
    const {data,error}=await supabaseClient.auth.updateUser({
      data:{sound_enabled:soundEnabled}
    });

    if(error)throw error;
    if(data.user)currentUser=data.user;
  }

  if(soundEnabled && window.playIzikSignature){
    try{
      await window.playIzikSignature();
    }catch(error){
      console.log("Browser blocked startup sound:",error);
    }
  }
}
function mixPage() {
  return `
    <div class="workspace-title">
      <div class="quick-icon">☷</div>
      <div>
        <h1>מיקס AI</h1>
        <p>שיפור חכם של הסאונד באמצעות RoEx AI.</p>
      </div>
    </div>

    <div class="panel">
      <h3>הקובץ לעיבוד</h3>

      ${currentFile ? `
        <p>הקובץ הפעיל: <b>${escapeHtml(currentFile.name)}</b></p>

        <label for="mixStyle">סגנון מוזיקלי</label>
        <select id="mixStyle">
          <option value="POP">Pop</option>
          <option value="ROCK">Rock</option>
          <option value="HIP_HOP_GRIME">Hip Hop</option>
          <option value="RNB">R&B</option>
          <option value="ELECTRONIC">Electronic</option>
          <option value="HOUSE">House</option>
          <option value="TECHNO">Techno</option>
          <option value="JAZZ">Jazz</option>
          <option value="METAL">Metal</option>
          <option value="ACOUSTIC">Acoustic</option>
        </select>

        <button class="primary-btn" id="mixPreviewBtn">
          יצירת תצוגה מקדימה
        </button>

        <p id="mixStatus"></p>

<audio
  id="mixPreviewAudio"
  controls
  hidden
  style="width:100%; margin-top:15px;"
></audio>
      ` : `
        <div class="empty-state">
          <div class="big">♫</div>
          <b>קודם נעלה שיר</b>
          <p>אותו קובץ יהיה זמין בכל כלי הסטודיו.</p>
          <button class="secondary-btn" data-go="home">העלאת שיר</button>
        </div>
      `}
    </div>
  `;
}
function masteringPage(){
 return `<div class="workspace-title"><div class="quick-icon">◉</div><div><h1>מאסטרינג AI</h1><p>תצוגה מקדימה של מאסטרינג באמצעות RoEx AI.</p></div></div><div class="panel"><h3>הקובץ למאסטרינג</h3>${currentFile?`<p>הקובץ הפעיל: <b>${escapeHtml(currentFile.name)}</b></p><label for="masterStyle">סגנון</label><select id="masterStyle"><option value="POP">Pop</option><option value="ROCK_INDIE">Rock / Indie</option><option value="ACOUSTIC">Acoustic</option><option value="HIPHOP_GRIME">Hip Hop</option><option value="ELECTRONIC">Electronic</option><option value="REGGAE_DUB">Reggae / Dub</option><option value="METAL">Metal</option><option value="OTHER">Other</option></select><label for="masterLoudness">עוצמה רצויה</label><select id="masterLoudness"><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="HIGH">High</option></select><label for="masterSampleRate">קצב דגימה</label><select id="masterSampleRate"><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select><button class="primary-btn" id="masterPreviewBtn">יצירת Preview</button><p id="masterStatus" aria-live="polite"></p><p id="masterTaskId" hidden></p><audio id="masterPreviewAudio" controls hidden style="width:100%;margin-top:15px"></audio><button class="secondary-btn" id="masterFinalBtn" hidden>קבלת מאסטר מלא (עשוי לחייב קרדיטים)</button>`:`<div class="empty-state"><div class="big">♫</div><b>קודם נעלה שיר</b><p>העלה קובץ MP3, WAV או FLAC כדי ליצור Preview.</p><button class="secondary-btn" data-go="home">העלאת שיר</button></div>`}</div>`;
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
document.querySelectorAll("[data-delete-project]").forEach(b=>{
  b.onclick=()=>deleteProject(b.dataset.deleteProject);
});
 const send=$("#chatSend");
 if(send)send.onclick=sendAssistant;
 bindMastering();
 const studioSoundToggle=$("#studioSoundEnabled");
 const soundStatus=$("#soundStatus");

 if(studioSoundToggle){
  studioSoundToggle.checked=soundEnabled;

  studioSoundToggle.onchange=async()=>{
   try{
    await saveSoundPreference(studioSoundToggle.checked);

    if(soundStatus){
     soundStatus.textContent="העדפת הצליל נשמרה בחשבון שלך.";
    }
   }catch(error){
    console.error(error);

    if(soundStatus){
     soundStatus.textContent="לא הצלחתי לשמור את ההעדפה.";
    }

    syncSoundControls();
   }
  };
 }
 const languageSelect=$("#languageSelect");
 const saveLanguageBtn=$("#saveLanguageBtn");
 const languageStatus=$("#languageStatus");

 if(languageSelect){
  const currentLanguage=window.ITZIK_I18N?.getLanguage?.()||"he";
  languageSelect.value=currentLanguage;
 }

if(saveLanguageBtn && languageSelect){
  saveLanguageBtn.onclick=async()=>{
    const selected=languageSelect.value;

    if(window.ITZIK_I18N){
      window.ITZIK_I18N.applyLanguage(selected);
    }else{
      localStorage.setItem("itzik_language",selected);
      document.documentElement.lang=selected;
      document.documentElement.dir=["he","ar"].includes(selected)?"rtl":"ltr";
    }

    if(currentUser && supabaseClient){
      const {data,error}=await supabaseClient.auth.updateUser({
        data:{language:selected}
      });

      if(error){
        if(languageStatus){
          languageStatus.textContent="השפה הוחלפה, אך השמירה בחשבון נכשלה.";
        }
        console.error(error);
        return;
      }

      if(data.user) currentUser=data.user;
    }

    if(languageStatus){
      languageStatus.textContent="השפה נשמרה בהצלחה בחשבון שלך!";
    }
  };
}

function bindMastering(){
 const button=$("#masterPreviewBtn");
 if(!button)return;
 button.onclick=async()=>{
  const status=$("#masterStatus");
  button.disabled=true;
  try{
   const {data,error}=await supabaseClient.auth.getSession();
   if(error||!data.session?.access_token)throw new Error("צריך להתחבר מחדש לחשבון.");
   const ext=currentFile?.name.split(".").pop().toLowerCase();
   if(!["mp3","wav","flac"].includes(ext))throw new Error("מאסטרינג תומך בקובצי MP3, WAV או FLAC בלבד.");
   const form=new FormData(); form.append("audio",currentFile);
   form.append("musicalStyle",$("#masterStyle").value);
   form.append("desiredLoudness",$("#masterLoudness").value);
   form.append("sampleRate",$("#masterSampleRate").value);
   status.textContent="מעלה את הקובץ ומבקש Preview...";
   const response=await fetch("/api/roex/mastering-preview",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`},body:form});
   const result=await response.json(); if(!response.ok)throw new Error(result.message||"יצירת Preview נכשלה.");
   const taskLabel=$("#masterTaskId"); taskLabel.hidden=false; taskLabel.textContent=`מזהה משימה: ${result.taskId}`;
   status.textContent="ממתין ל-RoEx...";
   let ready=false;
   for(let i=0;i<12;i++){
    const poll=await fetch("/api/roex/mastering-preview-result",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({taskId:result.taskId})});
    const out=await poll.json();
    if(poll.status===202){status.textContent="RoEx עדיין מעבד את ה-Preview...";await new Promise(r=>setTimeout(r,5000));continue;}
    if(!poll.ok)throw new Error(out.message||"קבלת ה-Preview נכשלה.");
    const player=$("#masterPreviewAudio"); player.src=out.previewUrl;player.hidden=false;player.load();
    $("#masterFinalBtn").hidden=false; status.textContent="ה-Preview מוכן להאזנה.";ready=true;break;
   }
   if(!ready)status.textContent=`העיבוד עדיין נמשך. מזהה משימה: ${result.taskId}`;
  }catch(error){status.textContent=error.message||"אירעה תקלה ביצירת Preview.";}
  finally{button.disabled=false;}
 };
 const finalButton=$("#masterFinalBtn");
 if(finalButton)finalButton.onclick=async()=>{
  const id=$("#masterTaskId")?.textContent.replace("מזהה משימה: ","");
  if(!id||!confirm("קבלת מאסטר מלא עשויה לחייב קרדיטים בחשבון RoEx. להמשיך?"))return;
  finalButton.disabled=true;
  try{
   const {data,error}=await supabaseClient.auth.getSession(); if(error||!data.session?.access_token)throw new Error("צריך להתחבר מחדש לחשבון.");
   const response=await fetch("/api/roex/mastering-final",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({taskId:id,confirmedCreditCharge:true})});
   const out=await response.json();if(!response.ok)throw new Error(out.message||"קבלת המאסטר נכשלה.");
   const link=document.createElement("a");link.href=out.masterUrl;link.target="_blank";link.rel="noopener";link.textContent="הורדת המאסטר המלא";$("#masterStatus").append(" ",link);
  }catch(error){$("#masterStatus").textContent=error.message||"אירעה תקלה בקבלת המאסטר.";}
  finally{finalButton.disabled=false;}
 };
}
   const mixPreviewBtn = $("#mixPreviewBtn");

 if (mixPreviewBtn) {
  mixPreviewBtn.onclick = async () => {
   const status = $("#mixStatus");

   if (!currentFile) {
    status.textContent = "קודם צריך לבחור קובץ אודיו.";
    return;
   }

   const extension = currentFile.name.split(".").pop().toLowerCase();

   if (!["mp3", "wav", "flac"].includes(extension)) {
    status.textContent = "Mix AI תומך כרגע בקובצי MP3, WAV או FLAC בלבד.";
    return;
   }

   mixPreviewBtn.disabled = true;
   status.textContent = "מתחבר ל-RoEx ומעלה את הקובץ...";

   try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session?.access_token) {
     throw new Error("צריך להתחבר מחדש לחשבון.");
    }

    const formData = new FormData();
    formData.append("audio", currentFile);
    formData.append("musicalStyle", $("#mixStyle")?.value || "POP");

    const response = await fetch("/api/roex/preview", {
     method: "POST",
     headers: {
      Authorization: `Bearer ${data.session.access_token}`
     },
     body: formData
    });

    const result = await response.json();

    if (!response.ok) {
     throw new Error(result.message || "יצירת התצוגה המקדימה נכשלה.");
    }

    status.textContent = "הבקשה נשלחה! ממתין לתצוגה המקדימה...";

const { data: sessionData, error: sessionError } =
  await supabaseClient.auth.getSession();

if (sessionError || !sessionData.session?.access_token) {
  throw new Error("צריך להתחבר מחדש לחשבון.");
}

let previewReady = false;

for (let attempt = 0; attempt < 12; attempt++) {
  const previewResponse = await fetch("/api/roex/preview-result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`
    },
    body: JSON.stringify({
      taskId: result.taskId
    })
  });

  const previewResult = await previewResponse.json();

  if (previewResponse.status === 202) {
    status.textContent = "RoEx עדיין מעבד את השיר...";

    await new Promise(resolve => setTimeout(resolve, 5000));
    continue;
  }

  if (!previewResponse.ok) {
    throw new Error(
      previewResult.message || "קבלת התצוגה המקדימה נכשלה."
    );
  }

  const previewAudio = $("#mixPreviewAudio");

  if (!previewAudio || !previewResult.previewUrl) {
    throw new Error("לא התקבל קישור לתצוגה המקדימה.");
  }

  previewAudio.src = previewResult.previewUrl;
  previewAudio.hidden = false;
  previewAudio.load();

  status.textContent = "התצוגה המקדימה מוכנה! אפשר להאזין כאן. 🎧";

  previewReady = true;
  break;
}

if (!previewReady) {
  status.textContent =
    "השיר עדיין בעיבוד. אפשר לנסות לקבל את התוצאה שוב בעוד רגע. מזהה משימה: " +
    result.taskId;
}

   } catch (error) {
    console.error("Mix AI error:", error);
    status.textContent = error.message || "אירעה תקלה בחיבור ל-RoEx.";
   } finally {
    mixPreviewBtn.disabled = false;
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

 // Prevent duplicate loading.
 if(currentUser?.id===user.id){
  showApp(user);
  return;
 }
 const localSoundChoice =
  localStorage.getItem("itzik_sound_preference_set")==="1";

 if(localSoundChoice){
  soundEnabled =
   localStorage.getItem("itzik_sound_enabled")==="true";

  const {data,error}=await supabaseClient.auth.updateUser({
   data:{sound_enabled:soundEnabled}
  });

  if(!error && data.user)user=data.user;
  if(error)console.error("Could not save sound preference:",error);

  localStorage.removeItem("itzik_sound_preference_set");

 }else if(typeof user.user_metadata?.sound_enabled==="boolean"){
  soundEnabled=user.user_metadata.sound_enabled;

  localStorage.setItem(
   "itzik_sound_enabled",
   String(soundEnabled)
  );
 }

 syncSoundControls();

 if(soundEnabled && window.playIzikSignature){
  window.playIzikSignature().catch(error=>{
   console.log("Browser blocked automatic startup sound:",error);
  });
 }
 const supportedLanguages=["he","en","ar","ru","es","fr","de"];
 const loginLanguageSelected=
  localStorage.getItem("itzik_login_language_selected")==="1";

 const savedLanguage=user.user_metadata?.language;
 const localLanguage=window.ITZIK_I18N?.getLanguage?.()||"he";

 let languageToSave=null;

 if(loginLanguageSelected && supportedLanguages.includes(localLanguage)){
  languageToSave=localLanguage;
 }else if(savedLanguage && supportedLanguages.includes(savedLanguage)){
  window.ITZIK_I18N?.applyLanguage(savedLanguage);
 }else if(supportedLanguages.includes(localLanguage)){
  languageToSave=localLanguage;
 }

 if(languageToSave){
  window.ITZIK_I18N?.applyLanguage(languageToSave);

  const {data,error}=await supabaseClient.auth.updateUser({
   data:{language:languageToSave}
  });

  if(!error && data.user) user=data.user;
  if(error) console.error("Could not save language:",error);
 }

 localStorage.removeItem("itzik_login_language_selected");

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

render("home");

requestAnimationFrame(() => {
  if (window.refreshIzikWaveform) {
    window.refreshIzikWaveform();
  }
});

if (!existingProjectId) {
  await saveNewProject(file);

  if (currentPage === "home") {
    render("home");
  }
}
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
const bottomPlayer = $("#bottomPlayer");

if (bottomPlayer) {
  bottomPlayer.addEventListener("click", e => {
    if (e.target.closest("#playBtn, #seek, #exportBtn, #itzikMiniWaveform")) return;
    if (currentFile) render("home");
  });
}
// data-go buttons are bound once per render by bindDynamic().

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
 const authLanguageSelect=$("#authLanguageSelect");
 if(authLanguageSelect){
  authLanguageSelect.value=window.ITZIK_I18N?.getLanguage?.()||"he";
  authLanguageSelect.onchange=()=>{
   try{localStorage.setItem("itzik_login_language_selected","1");}catch{}
   window.ITZIK_I18N?.applyLanguage(authLanguageSelect.value);
  };
 }
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
const authSoundToggle=$("#authSoundEnabled");

if(authSoundToggle){
 authSoundToggle.checked=soundEnabled;

 authSoundToggle.onchange=async()=>{
  try{
   await saveSoundPreference(authSoundToggle.checked);
  }catch(error){
   console.error("Sound preference error:",error);
   setAuthMessage("לא הצלחתי לשמור את העדפת הצליל.",true);
   syncSoundControls();
  }
 };
} 
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

/* ==========================================
   ITZIK SOUND — PROFESSIONAL WAVEFORM PLAYER
   תוספת בלבד — לא מחליפה קוד קיים
========================================== */

(() => {
  // עיצוב הנגן
  if (!document.getElementById("itzikWaveStyle")) {
    const style = document.createElement("style");
    style.id = "itzikWaveStyle";
    style.textContent = `
      .itzik-project-player {
        background: linear-gradient(145deg,#101d32,#0b1425);
        border: 1px solid #263b58;
        border-radius: 22px;
        padding: 25px;
        margin-bottom: 25px;
        box-shadow: 0 15px 45px rgba(0,0,0,.25);
      }

      .itzik-player-top {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:25px;
      }

      .itzik-player-top h2 {
        margin:0 0 7px;
        color:#edf4ff;
      }

      .itzik-player-top p {
        margin:0;
        color:#91a2bb;
        overflow-wrap:anywhere;
      }

      .itzik-wave-area {
        height:155px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:3px;
        overflow:hidden;
        padding:12px 5px;
        border-radius:14px;
        background:rgba(4,10,21,.65);
        cursor:pointer;
      }

      .itzik-wave-bar {
        flex:1;
        min-width:2px;
        max-width:9px;
        height:3px;
        border-radius:8px;
        background:linear-gradient(to top,#648cff,#52d9d0);
        opacity:.78;
        transition:height .15s ease,opacity .15s ease;
      }

      .itzik-wave-bar.active {
        opacity:1;
        filter:brightness(1.5);
        box-shadow:0 0 8px rgba(82,217,208,.35);
      }

      .itzik-player-controls {
        display:flex;
        align-items:center;
        gap:14px;
        margin-top:20px;
      }

      .itzik-wave-play {
        width:48px;
        height:48px;
        border:0;
        border-radius:50%;
        background:linear-gradient(135deg,#52d9d0,#648cff);
        color:#07111f;
        font-size:20px;
        font-weight:900;
        cursor:pointer;
      }

      .itzik-wave-seek {
        flex:1;
        min-width:0;
        accent-color:#52d9d0;
        cursor:pointer;
      }

      .itzik-wave-time {
        color:#91a2bb;
        font-size:12px;
        white-space:nowrap;
        direction:ltr;
      }

      .itzik-player-actions {
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:22px;
      }

      .itzik-player-actions button {
        cursor:pointer;
      }

      .itzik-wave-loading {
        color:#52d9d0;
        text-align:center;
        font-size:13px;
        margin-top:12px;
      }
      .itzik-mini-wave-area {
        flex:1;
        min-width:100px;
        height:42px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:2px;
        overflow:hidden;
        padding:4px 8px;
        border-radius:10px;
        background:rgba(4,10,21,.65);
        cursor:pointer;
      }

      .itzik-mini-wave-area .itzik-wave-bar {
        min-width:2px;
        max-width:5px;
        height:3px;
      }

      @media(max-width:700px) {
        .itzik-mini-wave-area {
          min-width:100%;
          height:34px;
        }
      }
      @media(max-width:600px) {
        .itzik-project-player {padding:16px}
        .itzik-wave-area {height:115px;gap:2px}
        .itzik-player-controls {gap:8px}
      }
    `;
    document.head.appendChild(style);
  }

  // תצוגת מסך הבית משתנה בהתאם למצב הפרויקט
  pages.home.html = () => {
    if (!currentFile) {
      return `
        <div class="welcome">
          <div>
            <div class="eyebrow">WELCOME TO YOUR STUDIO</div>
            <h1>בוא ניצור משהו שנשמע גדול.</h1>
            <p>כל הכלים שלך להפקה מוזיקלית, במקום אחד.<br>
            העלה שיר והתחל לעבוד עם ITZIK SOUND.</p>
          </div>
          <span class="tag">✦ YOUR MUSIC. YOUR SOUND.</span>
        </div>

        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">⇧</div>
          <h2>גרור קובץ לכאן או לחץ לבחירה</h2>
          <p>MP3 · WAV · M4A · AAC · FLAC · עד 50MB</p>
          <button class="primary-btn" type="button">
            בחירת קובץ מהמחשב
          </button>
        </div>

        <div class="section-heading">
          <h3>כלי הסטודיו</h3>
          <span>בחר מאיפה להתחיל</span>
        </div>

        <div class="quick-grid">
          <div class="quick-card" data-go="mix">
            <div class="quick-icon">☷</div>
            <b>מיקס AI</b>
            <small>איזון ועיצוב הסאונד של השיר</small>
          </div>
          <div class="quick-card" data-go="master">
            <div class="quick-icon">◉</div>
            <b>מאסטרינג AI</b>
            <small>ליטוש והכנה להפצה</small>
          </div>
          <div class="quick-card" data-go="pitch">
            <div class="quick-icon">♬</div>
            <b>תיקון זיופים</b>
            <small>דיוק קולי בשליטה שלך</small>
          </div>
        </div>
      `;
    }

    return `
      <div class="welcome">
        <div>
          <div class="eyebrow">YOUR PROJECT IS READY</div>
          <h1>האולפן שלך מוכן לעבודה.</h1>
          <p>הקובץ שלך נטען. עכשיו אפשר להאזין ולעבוד עליו.</p>
        </div>
        <span class="tag">✦ ITZIK SOUND STUDIO</span>
      </div>

      <div class="itzik-project-player">
        <div class="itzik-player-top">
          <div>
            <div class="eyebrow">NOW IN YOUR STUDIO</div>
            <h2>♫ הפרויקט שלך</h2>
            <p>${escapeHtml(currentFile.name)}</p>
          </div>
          <span class="tag">● ${currentProjectId ? "PROJECT SAVED" : "LOCAL AUDIO"}</span>
        </div>

        <div class="itzik-wave-area" id="itzikWaveform">
          <span class="itzik-wave-loading">מנתח את הסאונד...</span>
        </div>

        <div class="itzik-player-controls">
          <button class="itzik-wave-play" id="itzikWavePlay" type="button">▶</button>
          <span class="itzik-wave-time" id="itzikWaveCurrent">0:00</span>
          <input class="itzik-wave-seek" id="itzikWaveSeek"
            type="range" min="0" max="100" value="0">
          <span class="itzik-wave-time" id="itzikWaveDuration">0:00</span>
        </div>
<div class="itzik-player-actions">
  <button class="secondary-btn" id="itzikNewProject" type="button">
    ＋ פרויקט חדש
  </button>
  <button class="secondary-btn" data-go="projects" type="button">
    ▤ הפרויקטים שלי
  </button>
  <button class="secondary-btn" data-go="mix" type="button">
    ☷ מעבר למיקס
  </button>
  <button class="export-button" id="itzikWaveExport" type="button">
    ⇩ ייצוא WAV / MP3
  </button>
</div>
      </div>

      <div class="section-heading">
        <h3>כלי הסטודיו</h3>
        <span>המשך לעבוד על הסאונד שלך</span>
      </div>

      <div class="quick-grid">
        <div class="quick-card" data-go="mix">
          <div class="quick-icon">☷</div>
          <b>מיקס AI</b>
          <small>איזון ועיצוב הסאונד של השיר</small>
        </div>
        <div class="quick-card" data-go="master">
          <div class="quick-icon">◉</div>
          <b>מאסטרינג AI</b>
          <small>ליטוש והכנה להפצה</small>
        </div>
        <div class="quick-card" data-go="pitch">
          <div class="quick-icon">♬</div>
          <b>תיקון זיופים</b>
          <small>דיוק קולי בשליטה שלך</small>
        </div>
      </div>
    `;
  };

  // פורמט זמן
  function waveTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    return Math.floor(seconds / 60) + ":" +
      String(Math.floor(seconds % 60)).padStart(2, "0");
  }
async function buildWaveform() {
  // ציור פסי הגל לפי עוצמת האודיו האמיתית
  const container = $("#itzikWaveform");
  const miniContainer = $("#itzikMiniWaveform");

  if ((!container && !miniContainer) || !currentFile) return;

  const fileBeingAnalyzed = currentFile;

  if (container) {
    container.innerHTML =
      '<span class="itzik-wave-loading">מנתח את הסאונד...</span>';
  }

  if (miniContainer) {
    miniContainer.innerHTML =
      '<span class="itzik-wave-loading">מנתח את הסאונד...</span>';
  }

    let context;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("AudioContext unavailable");
      }

      context = new AudioContextClass();

      const buffer = await context.decodeAudioData(
        await fileBeingAnalyzed.arrayBuffer()
      );

      if (currentFile !== fileBeingAnalyzed) return;

      const samples = buffer.getChannelData(0);
      const barCount = 120;
      const samplesPerBar = Math.max(
        1,
        Math.floor(samples.length / barCount)
      );

      const peaks = [];

      for (let bar = 0; bar < barCount; bar++) {
        const start = bar * samplesPerBar;
        const end = Math.min(
          start + samplesPerBar,
          samples.length
        );

        let peak = 0;
        let sum = 0;

        for (let i = start; i < end; i++) {
          const value = Math.abs(samples[i]);
          if (value > peak) peak = value;
          sum += value * value;
        }

        const rms = end > start
          ? Math.sqrt(sum / (end - start))
          : 0;

        peaks.push(Math.max(peak * 0.75, rms * 2));
      }

      const maxPeak = Math.max(...peaks, 0.001);

const waveformHtml = peaks.map((peak, index) => {
  const normalized = peak / maxPeak;
  const height = Math.max(3, normalized * 110);

  return `
    <div class="itzik-wave-bar"
      data-wave-index="${index}"
      style="height:${height}px">
    </div>
  `;
}).join("");

if (container) container.innerHTML = waveformHtml;
if (miniContainer) miniContainer.innerHTML = waveformHtml;

      updateWaveformProgress();

} catch (error) {
  console.error("Waveform analysis failed:", error);

  if (container) {
    container.innerHTML =
      '<span class="itzik-wave-loading">לא ניתן להציג את צורת הגל.</span>';
  }

  if (miniContainer) {
    miniContainer.innerHTML =
      '<span class="itzik-wave-loading">לא ניתן להציג את צורת הגל.</span>';
  }
    } finally {
      if (context && context.state !== "closed") {
        context.close().catch(() => {});
      }
    }
  }

  // עדכון ההתקדמות בנגן
  function updateWaveformProgress() {
const waveContainers = document.querySelectorAll(
  ".itzik-wave-area, .itzik-mini-wave-area"
);

if (!waveContainers.length) return;

    const duration = audio.duration || 0;
    const progress = duration
      ? audio.currentTime / duration
      : 0;

waveContainers.forEach(container => {
  const bars = container.querySelectorAll(".itzik-wave-bar");
  const activeIndex = Math.floor(progress * bars.length);

  bars.forEach((bar, index) => {
    bar.classList.toggle("active", index < activeIndex);
  });
});

    const seek = $("#itzikWaveSeek");
    const current = $("#itzikWaveCurrent");
    const total = $("#itzikWaveDuration");

    if (seek) seek.value = progress * 100;
    if (current) current.textContent = waveTime(audio.currentTime);
    if (total) total.textContent = waveTime(duration);

    const playButton = $("#itzikWavePlay");
    if (playButton) {
      playButton.textContent = audio.paused ? "▶" : "Ⅱ";
    }
  }
window.refreshIzikWaveform = buildWaveform;
    
  // הרחבת render הקיים בלי לפגוע בו
  const originalRender = render;

  render = function(page) {
    originalRender(page);
    const bottomPlayer = $("#bottomPlayer");

    if (bottomPlayer) {
      bottomPlayer.hidden = page === "home";
    }
    if (currentFile) {
      buildWaveform();

      const playButton = $("#itzikWavePlay");
      const seek = $("#itzikWaveSeek");
      const newProjectButton = $("#itzikNewProject");
      const miniWave = $("#itzikMiniWaveform");

if (miniWave) {
  miniWave.onclick = event => {
    if (!audio.duration) return;

    const rect = miniWave.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );

    audio.currentTime = ratio * audio.duration;
    updateWaveformProgress();
  };
}
const waveExportButton = $("#itzikWaveExport");

if (waveExportButton) {
  waveExportButton.onclick = () => {
    if (!currentFile) {
      alert("קודם צריך להעלות שיר.");
      return;
    }

    $("#exportStatus").textContent = "";
    $("#exportModal").hidden = false;
  };
}
      if (playButton) {
        playButton.onclick = async () => {
          if (audio.paused) {
            try {
              await audio.play();
            } catch (error) {
              console.error("Playback failed:", error);
            }
          } else {
            audio.pause();
          }

          updateWaveformProgress();
        };
      }

      if (seek) {
        seek.oninput = () => {
          if (audio.duration) {
            audio.currentTime =
              Number(seek.value) / 100 * audio.duration;
          }
          updateWaveformProgress();
        };
      }

      if (newProjectButton) {
        newProjectButton.onclick = () => {
          resetWorkspace();
          render("home");
        };
      }

      updateWaveformProgress();
    }
  };

  // סנכרון הפסים בזמן הניגון
  audio.addEventListener("timeupdate", updateWaveformProgress);
  audio.addEventListener("play", updateWaveformProgress);
  audio.addEventListener("pause", updateWaveformProgress);
  audio.addEventListener("loadedmetadata", updateWaveformProgress);


async function deleteProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;

  if (!confirm("למחוק את הפרויקט ואת קובץ האודיו שלו לצמיתות?")) {
    return;
  }

  if (p.storage_path) {
    const { error: storageError } = await supabaseClient
      .storage
      .from("project-audio")
      .remove([p.storage_path]);

    if (storageError) {
      console.error(storageError);
      alert("לא הצלחנו למחוק את קובץ האודיו.");
      return;
    }
  }

  const { error } = await supabaseClient
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("לא הצלחנו למחוק את הפרויקט.");
    return;
  }

  if (currentProjectId === id) {
    resetWorkspace();
  }

  await loadProjects();

  if (currentPage === "projects") {
    render("projects");
  }

  alert("הפרויקט נמחק בהצלחה!");
}
})();
