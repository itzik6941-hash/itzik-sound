
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
let mixSaveTimer = null;
let stopMixMeter = null;
let referenceObjectUrl = null;
let referenceUrl = null;
let referenceFile = null;
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
 pitch:{title:"תיקון זיופים",html:()=>pitchPage()},

 ideas:{title:"רעיונות מוזיקליים",html:()=>ideasPage()},
 reference:{title:"סטודיו רפרנסים",html:()=>referencePage()},

 assistant:{title:"איצקו AI",html:()=>`<div class="workspace-title"><div class="quick-icon">✳</div><div><h1>איצקו AI</h1><p>${uiText("עוזר הפקה שמייצר תשובות דרך OpenAI.","Production assistant powered by OpenAI.")}</p></div></div><div class="panel"><div class="notice">${uiText("איצקו מקבל טקסט בלבד. אפשר לבקש ניתוח מדידות מקומיות מקורבות; קובץ האודיו עצמו אינו נשלח.","ITZKO receives text only. You can request an approximate local signal-metrics review; the audio file itself is not uploaded to OpenAI.")}</div>${currentFile?`<button id="assistantAudioReview" class="secondary-btn">${uiText("מדוד ושלח מאפייני שמע מקורבים","Measure and send approximate audio metrics")}</button><p id="assistantAudioStatus" aria-live="polite"></p>`:""}<h3 style="margin-top:22px">${uiText("מה תרצה לברר?","What would you like to ask?")}</h3><div class="chat-box"><input id="chatInput" placeholder="${uiText("כתוב שאלה על הפקה או סאונד...","Ask about production or sound...")}"><button class="primary-btn" id="chatSend">${uiText("שליחה","Send")}</button></div><p id="chatReply" aria-live="polite"></p></div>${filePanel()}`},

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
 if(window.ITZIK_I18N?.formatDate)return window.ITZIK_I18N.formatDate(value);
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
  const s = window.ITZIK_MIXER?.getSettings?.() || {};
  const savedEnhanceTask=projects.find(p=>p.id===currentProjectId)?.metadata?.mixEnhance?.taskId||"";
  const control = (key, title, en, min, max, step, value, unit = "") =>
   `<label class="mix-control"><span>${title}<output data-mix-value="${key}">${Number(value).toFixed(key === "ratio" ? 1 : 0)}${unit}</output></span><input type="range" data-mix-control="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${en}"></label>`;
  return `
    <div class="workspace-title">
      <div class="quick-icon">☷</div>
      <div>
        <h1>${uiText("מיקס לערוץ הסטריאו","Stereo Track Mixer")}</h1>
        <p>${uiText("הקובץ בפרויקט הוא ערוץ סטריאו יחיד; כל שינוי כאן מעבד את האודיו בפועל.","This project contains one stereo mix; every control below processes the audio signal.")}</p>
      </div>
    </div>

    ${currentFile ? `<div class="panel mixer-panel">
      <div class="mixer-heading"><div><h3>${uiText("ערוץ הפרויקט","Project channel")}</h3><p>${escapeHtml(currentFile.name)} · ${uiText("ערוץ סטריאו אחד","One stereo channel")}</p></div><div class="mixer-actions"><button id="mixMute" class="secondary-btn" aria-pressed="${s.mute===true}">${s.mute?uiText("ביטול השתקה","Unmute"):uiText("השתק","Mute")}</button><button id="mixSolo" class="secondary-btn" disabled title="${uiText("אין ערוצים נוספים לסולו","There are no other tracks to solo")}">${uiText("Solo","Solo")}</button><button id="mixAB" class="secondary-btn" aria-pressed="false">A/B</button><button id="mixReset" class="secondary-btn">${uiText("איפוס","Reset")}</button></div></div>
      <canvas id="mixMeter" class="mix-meter" width="800" height="22" aria-label="${uiText("מד עוצמת השמע","Audio level meter")}"></canvas><small id="mixMeterText">${uiText("נגן את הקובץ כדי לראות עוצמה בזמן אמת","Play the track to see real-time level")}</small>
      <div class="mixer-strip"><h4>${uiText("ערוץ","Channel")}</h4>${control("gainDb","עוצמת ערוץ","Track level",-24,12,0.5,s.gainDb??0," dB")}${control("pan","Pan","Pan",-1,1,0.01,s.pan??0)}<div class="mixer-placeholder"><b>${uiText("ערוץ יחיד","Single track")}</b><small>${uiText("Solo אינו זמין ללא ערוצים נפרדים","Solo requires separate stems")}</small></div></div>
      <div class="mixer-grid"><section class="mixer-strip"><h4>EQ</h4>${control("low","Bass · 100 Hz","Bass · 100 Hz",-12,12,0.5,s.low??0," dB")}${control("mid","Mid · 1 kHz","Mid · 1 kHz",-12,12,0.5,s.mid??0," dB")}${control("high","Treble · 8 kHz","Treble · 8 kHz",-12,12,0.5,s.high??0," dB")}</section>
      <section class="mixer-strip"><h4>${uiText("קומפרסור","Compressor")}</h4>${control("threshold","סף","Threshold",-60,0,1,s.threshold??-18," dB")}${control("ratio","יחס","Ratio",1,20,0.5,s.ratio??1,":1")}</section>
      <section class="mixer-strip"><h4>${uiText("אפקטים","Effects")}</h4>${control("reverb","Reverb","Reverb",0,0.6,0.01,s.reverb??0)}${control("delay","Delay","Delay",0,0.6,0.01,s.delay??0)}${control("width","רוחב סטריאו","Stereo width",0,2,0.01,s.width??1)}</section>
      <section class="mixer-strip"><h4>${uiText("יציאה","Output")}</h4>${control("masterDb","עוצמת Master","Master output",-18,6,0.5,s.masterDb??0," dB")}</section></div>
      <p class="mixer-note">${uiText("A/B משווה בין האות המקורי לעיבוד. הייצוא משתמש בעיבוד הפעיל. אין ערוצי stems בפרויקט הזה.","A/B switches between the original signal and processing. Export uses the processed signal. This project has no separate stems.")}</p>
    </div>` : `<div class="panel empty-state"><div class="big">♫</div><b>${uiText("קודם נעלה שיר","Upload a track first")}</b><p>${uiText("המיקסר יופעל על ערוץ הסטריאו שבפרויקט.","The mixer works on the stereo track in your project.")}</p><button class="secondary-btn" data-go="home">${uiText("העלאת שיר","Upload a track")}</button></div>`}

    <div class="panel">
      <h3>${uiText("RoEx Mix Enhance Preview","RoEx Mix Enhance Preview")}</h3>
      ${currentFile ? `
        <p>${uiText("Preview נפרד של RoEx, על קובץ המקור. ה-Preview ללא עלות בחשבון עם יתרת קרדיטים חיובית.","A separate RoEx preview generated from the original file. Previews are free when the account has a positive credit balance.")}</p>

        <label for="mixStyle">${uiText("סגנון מוזיקלי","Musical style")}</label>
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
          ${uiText("יצירת Preview ב-RoEx","Create RoEx preview")}
        </button>

        <p id="mixStatus"></p>

<audio
  id="mixPreviewAudio"
  controls
  hidden
  style="width:100%; margin-top:15px;"
></audio>
        <button id="mixFullBtn" class="secondary-btn" ${savedEnhanceTask?"":"hidden"} data-taskid="${escapeHtml(savedEnhanceTask)}">${uiText("קבלת Mix Enhance מלא · 250 קרדיטים","Get full Mix Enhance · 250 credits")}</button>
        <p id="mixFullStatus" aria-live="polite"></p>
        <p id="mixFullTaskId" ${savedEnhanceTask?"":"hidden"}>${savedEnhanceTask?uiText("מזהה משימת Mix Enhance","Mix Enhance task ID")+": "+escapeHtml(savedEnhanceTask):""}</p>
        <audio id="mixFullAudio" controls hidden style="width:100%;margin-top:12px"></audio>
        <a id="mixFullDownload" hidden download>${uiText("הורדת Mix Enhance","Download Mix Enhance")}</a>
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
function uiText(he,en){return window.ITZIK_I18N?.getLanguage?.()==="en"?en:he;}
function pitchPage(){
 return `<div class="workspace-title"><div class="quick-icon">♬</div><div><h1>${uiText("ניתוח גובה צליל","Pitch analysis")}</h1><p>${uiText("זיהוי מחזוריות בסיסי על קטע מהקובץ המקומי.","Basic periodic pitch detection on a segment of the local file.")}</p></div></div>${currentFile?`<div class="panel"><p>${escapeHtml(currentFile.name)}</p><label for="pitchKey">${uiText("סולם להשוואה","Reference key")}</label><select id="pitchKey"><option value="C">C</option><option value="C#">C# / Db</option><option value="D">D</option><option value="D#">D# / Eb</option><option value="E">E</option><option value="F">F</option><option value="F#">F# / Gb</option><option value="G">G</option><option value="G#">G# / Ab</option><option value="A">A</option><option value="A#">A# / Bb</option><option value="B">B</option></select><label for="pitchScale">${uiText("סוג סולם","Scale")}</label><select id="pitchScale"><option value="major">${uiText("מז'ור","Major")}</option><option value="minor">${uiText("מינור","Minor")}</option></select><button id="pitchAnalyze" class="primary-btn">${uiText("ניתוח קטע","Analyze a segment")}</button><p id="pitchResult" aria-live="polite"></p><div class="notice">${uiText("המדידה היא של התדר הדומיננטי בחלון קצר. היא אינה מפרידה שירה מכלי נגינה ואינה מתקנת או מייצאת Pitch. מנוע תיקון אוטומטי אמיתי עדיין אינו מחובר.","This measures the dominant frequency in a short window. It does not isolate vocals and does not apply or export pitch correction. An actual automatic correction engine is not connected.")}</div></div>`:`<div class="panel empty-state"><b>${uiText("העלה קובץ כדי לנתח גובה צליל","Upload a track to analyze pitch")}</b><button class="secondary-btn" data-go="home">${uiText("העלאת שיר","Upload a track")}</button></div>`}`;
}

function ideasPage(){
 return `<div class="workspace-title"><div class="quick-icon">✧</div><div><h1>${uiText("רעיונות מוזיקליים","Music ideas")}</h1><p>${uiText("הצעות טקסט אמיתיות שנוצרות על ידי AI לפי התיאור שלך.","AI-generated ideas based on the description you provide.")}</p></div></div><div class="panel"><label for="ideaType">${uiText("סוג רעיון","Idea type")}</label><select id="ideaType"><option value="melody">${uiText("מנגינה","Melody")}</option><option value="chords">${uiText("אקורדים","Chords")}</option><option value="rhythm">${uiText("קצב","Rhythm")}</option><option value="arrangement">${uiText("עיבוד והפקה","Arrangement and production")}</option></select><label for="ideaStyle">${uiText("סגנון ומצב רוח","Style and mood")}</label><input id="ideaStyle" class="input" maxlength="300" placeholder="${uiText("למשל: פופ אלקטרוני, נוסטלגי ואופטימי","For example: nostalgic, upbeat electronic pop")}"><label for="ideaContext">${uiText("הקשר או כיוון","Context or direction")}</label><textarea id="ideaContext" class="input" rows="4" maxlength="1200" placeholder="${uiText("תאר את השיר, הכלים או הכיוון שאתה מחפש","Describe the song, instruments, or direction")}"></textarea><button id="ideaGenerate" class="primary-btn">${uiText("יצירת רעיונות","Generate ideas")}</button><p id="ideaStatus" aria-live="polite"></p><div id="ideaOutput" class="ai-output" hidden></div><p class="muted-note">${uiText("המערכת מקבלת רק את הטקסט שבשדות. היא אינה מנתחת את קובץ האודיו.","Only the text in these fields is sent. The system does not analyze the audio file.")}</p></div>`;
}

function referencePage(){
 return `<div class="workspace-title"><div class="quick-icon">◎</div><div><h1>${uiText("השוואת Reference","Reference comparison")}</h1><p>${uiText("נגן והשווה את ערוץ הפרויקט לקובץ ייחוס.","Play and compare the project track with a reference file.")}</p></div></div>${currentFile?`<div class="panel"><p>${uiText("פרויקט","Project")}: <b>${escapeHtml(currentFile.name)}</b></p><div class="comparison-grid"><section><h4>${uiText("ערוץ הפרויקט","Project track")}</h4><audio id="referenceProjectAudio" controls style="width:100%"></audio><button id="referenceUseProject" class="secondary-btn">${uiText("השמעת הפרויקט בנגן","Play project in main player")}</button></section><section><h4>${uiText("שיר ייחוס","Reference track")}</h4><input id="referenceFileInput" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac"><audio id="referenceAudio" controls style="width:100%"></audio><button id="referenceUseTrack" class="secondary-btn" disabled>${uiText("השמעת הייחוס בנגן","Play reference in main player")}</button></section></div><p id="referenceStatus" aria-live="polite"></p><button id="referenceAnalyze" class="primary-btn" disabled>${uiText("ניתוח והשוואת עוצמה, EQ וסטריאו","Analyze loudness, EQ, and stereo")}</button><div id="referenceMetrics" class="metrics-grid" hidden></div><div class="notice">${uiText("ההשוואה מציגה מדידות RMS, Peak, תחומי תדר ורוחב סטריאו מהאות. אין התאמת עוצמה אוטומטית.","Comparison reports RMS, peak, frequency bands, and stereo width from the signals. No automatic loudness matching is applied.")}</div></div>`:`<div class="panel empty-state"><b>${uiText("העלה שיר לפרויקט לפני השוואת Reference","Upload a project track before comparing a reference")}</b><button class="secondary-btn" data-go="home">${uiText("העלאת שיר","Upload a track")}</button></div>`}`;
}

function masteringPage(){
 const storedTask=projects.find(p=>p.id===currentProjectId)?.metadata?.mastering?.taskId||"";
 const storedPath=projects.find(p=>p.id===currentProjectId)?.metadata?.mastering?.storagePath||"";
 return `<div class="workspace-title"><div class="quick-icon">◉</div><div><h1>מאסטרינג AI</h1><p>${uiText("תצוגת Preview אמיתית של RoEx. בקשת מאסטר מלא מחויבת רק לאחר אישור מפורש.","Real RoEx mastering preview. A full master is requested only after explicit confirmation.")}</p></div></div><div class="panel"><h3>${uiText("הקובץ למאסטרינג","Track to master")}</h3>${currentFile?`<p>${escapeHtml(currentFile.name)}</p><label for="masterStyle">${uiText("סגנון","Style")}</label><select id="masterStyle"><option value="POP">Pop</option><option value="ROCK_INDIE">Rock / Indie</option><option value="ACOUSTIC">Acoustic</option><option value="HIPHOP_GRIME">Hip Hop</option><option value="ELECTRONIC">Electronic</option><option value="REGGAE_DUB">Reggae / Dub</option><option value="METAL">Metal</option><option value="OTHER">Other</option></select><label for="masterLoudness">${uiText("עוצמה רצויה","Target loudness")}</label><select id="masterLoudness"><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="HIGH">High</option></select><label for="masterSampleRate">${uiText("קצב דגימה","Sample rate")}</label><select id="masterSampleRate"><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select><button class="primary-btn" id="masterPreviewBtn">${uiText("יצירת Preview","Create preview")}</button><button class="secondary-btn" id="masterResumeBtn" ${storedTask?"":"hidden"}>${uiText("חזרה למשימת Preview שמורה","Resume saved preview task")}</button><p id="masterStatus" aria-live="polite"></p><p id="masterTaskId" ${storedTask?"":"hidden"} data-taskid="${escapeHtml(storedTask)}">${storedTask?`${uiText("מזהה משימה","Task ID")}: ${escapeHtml(storedTask)}`:""}</p><div class="comparison-grid" id="masterCompare" hidden><section><h4>${uiText("מקור","Original")}</h4><audio id="masterOriginalAudio" controls style="width:100%"></audio></section><section><h4>${uiText("Preview","Preview")}</h4><audio id="masterPreviewAudio" controls style="width:100%"></audio></section></div><button class="secondary-btn" id="masterFinalBtn" hidden>${uiText("בקשת מאסטר מלא · 220 קרדיטים","Request full master · 220 credits")}</button><audio id="masterFinalAudio" controls ${storedPath?"":"hidden"} style="width:100%;margin-top:15px"></audio><a id="masterDownload" ${storedPath?"":"hidden"} download>${uiText("הורדת קובץ המאסטר","Download mastered file")}</a><p id="masterSaveStatus" aria-live="polite">${storedPath?uiText("קיים קובץ מאסטר שמור בפרויקט.","A mastered file is saved in this project."):""}</p>`:`<div class="empty-state"><div class="big">♫</div><b>${uiText("קודם נעלה שיר","Upload a track first")}</b><p>${uiText("MP3, WAV או FLAC עד 50MB.","MP3, WAV, or FLAC up to 50 MB.")}</p><button class="secondary-btn" data-go="home">${uiText("העלאת שיר","Upload a track")}</button></div>`}</div>`;
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
 if(stopMixMeter){stopMixMeter();stopMixMeter=null;}
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
 bindAssistantAudioReview();
 bindMastering();
 bindMixer();
 bindRoexFullMix();
 bindIdeas();
 bindPitchAnalysis();
 bindReference();
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

function mixSettingsKey(){
 const identity=currentProjectId||currentFile?.name||"unsaved";
 return `itzik_mix_settings_${identity}`;
}

function scheduleMixSettingsSave(){
 clearTimeout(mixSaveTimer);
 mixSaveTimer=setTimeout(persistMixSettings,350);
}

async function persistMixSettings(){
 if(!window.ITZIK_MIXER)return;
 const settings=window.ITZIK_MIXER.getSettings();
 try{localStorage.setItem(mixSettingsKey(),JSON.stringify(settings));}catch{}
 if(!currentProjectId||!supabaseClient)return;
 const saved=await updateProjectMetadata({mixSettings:settings});
 if(!saved){
  const status=$("#mixSaveStatus");
  if(status)status.textContent=uiText("ההגדרות נשמרו במכשיר; סנכרון הענן נכשל.","Settings saved on this device; cloud sync failed.");
  return;
 }
 const status=$("#mixSaveStatus");
 if(status)status.textContent=uiText("הגדרות המיקס נשמרו בפרויקט.","Mix settings saved to the project.");
}

async function updateProjectMetadata(patch){
 if(!currentProjectId||!currentUser||!supabaseClient)return false;
 const project=projects.find(item=>item.id===currentProjectId);
 if(!project)return false;
 const metadata={...(project.metadata||{}),...patch};
 const {data,error}=await supabaseClient.from("projects").update({metadata})
  .eq("id",currentProjectId).eq("user_id",currentUser.id).select("id").single();
 if(error||!data){console.error("Project metadata sync failed",{code:error?.code||"NO_ROW"});return false;}
 project.metadata=metadata;
 return true;
}

function bindMixer(){
 const panel=$("#mixMeter");
 if(!panel||!window.ITZIK_MIXER)return;
 try{
  if(!window.ITZIK_MIXER.connect())throw new Error("Web Audio is unavailable");
 }catch(error){
  const message=$("#mixSaveStatus");
  if(message)message.textContent=uiText("המיקסר אינו נתמך בדפדפן הזה.","This browser does not support the mixer.");
  return;
 }
 stopMixMeter=window.ITZIK_MIXER.drawMeter(panel,$("#mixMeterText"));
 const settings=window.ITZIK_MIXER.getSettings();
 document.querySelectorAll("[data-mix-control]").forEach(input=>{
  input.oninput=()=>{
   const key=input.dataset.mixControl;
   const value=Number(input.value);
   const next=window.ITZIK_MIXER.apply({[key]:value});
   const output=$(`[data-mix-value="${key}"]`);
   if(output)output.textContent=`${value.toFixed(key==="ratio"?1:0)}${key==="ratio"?":1":key==="gainDb"||key==="masterDb"||key==="low"||key==="mid"||key==="high"||key==="threshold"?" dB":""}`;
   scheduleMixSettingsSave();
  };
 });
 const mute=$("#mixMute");
 if(mute)mute.onclick=()=>{
  const next=window.ITZIK_MIXER.apply({mute:!window.ITZIK_MIXER.getSettings().mute});
  mute.setAttribute("aria-pressed",String(next.mute));
  mute.textContent=next.mute?uiText("ביטול השתקה","Unmute"):uiText("השתק","Mute");
  scheduleMixSettingsSave();
 };
 const ab=$("#mixAB");
 if(ab){
  ab.setAttribute("aria-pressed",String(settings.bypass));
  ab.onclick=()=>{
   const next=window.ITZIK_MIXER.apply({bypass:!window.ITZIK_MIXER.getSettings().bypass});
   ab.setAttribute("aria-pressed",String(next.bypass));
  };
 }
 const reset=$("#mixReset");
 if(reset)reset.onclick=()=>{
  const next=window.ITZIK_MIXER.reset();
  document.querySelectorAll("[data-mix-control]").forEach(input=>{
   input.value=next[input.dataset.mixControl];
   input.dispatchEvent(new Event("input",{bubbles:true}));
  });
  const m=$("#mixMute");if(m){m.setAttribute("aria-pressed","false");m.textContent=uiText("השתק","Mute");}
  const compare=$("#mixAB");if(compare)compare.setAttribute("aria-pressed","false");
  scheduleMixSettingsSave();
 };
}

function bindMastering(){
 const button=$("#masterPreviewBtn");
 if(!button)return;
 const original=$("#masterOriginalAudio");
 if(original&&currentFileUrl)original.src=currentFileUrl;
 loadSavedMasterResult();
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
   status.textContent=uiText("מעלה קובץ ומבקש Preview...","Uploading track and requesting preview...");
   const response=await fetch("/api/roex/mastering-preview",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`},body:form});
   const result=await response.json(); if(!response.ok)throw new Error(uiText("יצירת Preview נכשלה.","Could not create the preview."));
   const taskSaved=await saveMasteringTask(result.taskId,{musicalStyle:$("#masterStyle").value,desiredLoudness:$("#masterLoudness").value,sampleRate:$("#masterSampleRate").value});
   setMasterTaskLabel(result.taskId);
   if(!taskSaved)status.textContent=uiText("המשימה נוצרה, אך מזהה המשימה לא הסתנכרן לענן. השאר את המסך פתוח והעתק את המזהה.","The task was created, but its ID did not sync to the cloud. Keep this page open and copy the task ID.");
   await pollMasteringPreview(result.taskId,data.session.access_token,status);
   if(!taskSaved){const paidButton=$("#masterFinalBtn");if(paidButton){paidButton.disabled=true;paidButton.title=uiText("לא ניתן להפעיל עד שמזהה המשימה יישמר בפרויקט.","Unavailable until the task ID is saved to the project.");}}
  }catch(error){status.textContent=error.message||uiText("אירעה תקלה ביצירת Preview.","There was a problem creating the preview.");}
  finally{button.disabled=false;}
 };
 const resume=$("#masterResumeBtn");
 if(resume)resume.onclick=async()=>{
  const taskId=$("#masterTaskId")?.dataset.taskid;
  if(!taskId)return;
  resume.disabled=true;
  try{
   const {data,error}=await supabaseClient.auth.getSession();if(error||!data.session?.access_token)throw new Error(uiText("צריך להתחבר מחדש לחשבון.","Please sign in again."));
   await pollMasteringPreview(taskId,data.session.access_token,$("#masterStatus"));
  }catch(error){$("#masterStatus").textContent=error.message;}
  finally{resume.disabled=false;}
 };
 const finalButton=$("#masterFinalBtn");
 if(finalButton)finalButton.onclick=async()=>{
  const id=$("#masterTaskId")?.dataset.taskid;
  if(!id||!confirm(uiText("בקשת מאסטר מלא מחייבת 220 קרדיטים בחשבון RoEx. הפעולה מתבצעת רק לאחר אישורך. להמשיך?","Requesting the full master uses 220 RoEx credits. It runs only after your confirmation. Continue?")))return;
  finalButton.disabled=true;
  try{
   const {data,error}=await supabaseClient.auth.getSession(); if(error||!data.session?.access_token)throw new Error(uiText("צריך להתחבר מחדש לחשבון.","Please sign in again."));
   const response=await fetch("/api/roex/mastering-final",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({taskId:id,projectId:currentProjectId,confirmedCreditCharge:true})});
   const out=await response.json();if(!response.ok)throw new Error(out.message||uiText("קבלת המאסטר נכשלה.","Could not retrieve the full master."));
   const player=$("#masterFinalAudio");player.src=out.masterUrl;player.hidden=false;player.load();
   const link=$("#masterDownload");link.href=out.masterUrl;link.hidden=false;link.target="_blank";link.rel="noopener";
   const status=$("#masterSaveStatus");status.textContent=uiText("הקישור לקובץ המאסטר מוכן להורדה. הקובץ לא הועתק לאחסון הפרויקט.","The mastered file is ready to download. It has not been copied into project storage.");
  }catch(error){$("#masterStatus").textContent=error.message||uiText("אירעה תקלה בקבלת המאסטר.","There was a problem retrieving the master.");}
  finally{finalButton.disabled=false;}
 };
}

function bindRoexFullMix(){
 const button=$("#mixFullBtn");if(!button)return;
 button.onclick=async()=>{
  const status=$("#mixFullStatus"),tokenResult=await supabaseClient.auth.getSession();
  const token=tokenResult.data?.session?.access_token;
  if(tokenResult.error||!token){status.textContent=uiText("צריך להתחבר מחדש לחשבון.","Please sign in again.");return;}
  if(!currentProjectId){status.textContent=uiText("יש לשמור את הפרויקט בענן לפני Mix מלא.","Save the project to the cloud before a full mix.");return;}
  const existingTask=button.dataset.taskid||"";
  const confirmation=existingTask
   ?uiText("שליפת Mix Enhance מלא עולה 250 קרדיטים. המשימה כבר נוצרה. להמשיך לשליפת התוצאה?","Retrieving the full Mix Enhance costs 250 credits. This task already exists. Continue to retrieve it?")
   :uiText("יצירת Mix Enhance מלא ושליפת התוצאה יחייבו 250 קרדיטים. להמשיך?","Creating and retrieving a full Mix Enhance costs 250 credits. Continue?");
  if(!confirm(confirmation))return;
  button.disabled=true;
  try{
   let taskId=existingTask;
   if(!taskId){
    if(!currentFile)throw new Error(uiText("לא נמצא קובץ אודיו פעיל.","No active audio file was found."));
    status.textContent=uiText("מכין את משימת Mix Enhance המלאה...","Preparing the full Mix Enhance task...");
    const form=new FormData();form.append("audio",currentFile);form.append("musicalStyle",$("#mixStyle")?.value||"POP");form.append("projectId",currentProjectId);form.append("confirmedCreditCharge","true");
    const start=await fetch("/api/roex/enhance-final",{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form}),created=await start.json();
    if(!start.ok)throw new Error(created.message||uiText("לא ניתן להתחיל Mix Enhance.","Could not start Mix Enhance."));
    taskId=created.taskId;button.dataset.taskid=taskId;
    const taskLabel=$("#mixFullTaskId");if(taskLabel){taskLabel.hidden=false;taskLabel.textContent=uiText("מזהה משימת Mix Enhance","Mix Enhance task ID")+": "+taskId;}
    const project=projects.find(p=>p.id===currentProjectId)?.metadata?.mixEnhance||{};
    const saved=await updateProjectMetadata({mixEnhance:{...project,taskId,style:$("#mixStyle")?.value||"POP",createdAt:new Date().toISOString()}});
    if(!saved){status.textContent=uiText("המשימה נוצרה אך מזהה המשימה לא נשמר בפרויקט. לא אשלוף תוצאה בתשלום עד שהשמירה תצליח.","The task was created but its ID was not saved to the project. Paid retrieval is blocked until it is saved.");return;}
   }
   const projectTask=projects.find(p=>p.id===currentProjectId)?.metadata?.mixEnhance?.taskId;
   if(existingTask&&projectTask!==existingTask){const prior=projects.find(p=>p.id===currentProjectId)?.metadata?.mixEnhance||{};const saved=await updateProjectMetadata({mixEnhance:{...prior,taskId:existingTask,style:$("#mixStyle")?.value||"POP"}});if(!saved){status.textContent=uiText("מזהה המשימה לא נשמר בפרויקט; שליפת תוצאה בתשלום חסומה.","The task ID is not saved to the project; paid retrieval is blocked.");return;}}
   const label=$("#mixFullTaskId");
   if(label){label.hidden=false;label.textContent=uiText("מזהה משימת Mix Enhance","Mix Enhance task ID")+": "+taskId;}
   for(let attempt=0;attempt<12;attempt++){
    status.textContent=uiText("ממתין ל-RoEx; הבקשה לשליפת תוצאה כוללת אישור חיוב...","Waiting for RoEx; result retrieval is covered by your credit confirmation...");
    const response=await fetch("/api/roex/enhance-result",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({taskId,projectId:currentProjectId,confirmedCreditCharge:true})});
    const result=await response.json();
    if(response.status===202){status.textContent=uiText("RoEx עדיין מעבד את הקובץ...","RoEx is still processing the file...");await new Promise(resolve=>setTimeout(resolve,5000));continue;}
    if(!response.ok)throw new Error(result.message||uiText("שליפת Mix Enhance נכשלה.","Could not retrieve Mix Enhance."));
    const player=$("#mixFullAudio"),link=$("#mixFullDownload");player.src=result.masterUrl;player.hidden=false;player.load();link.href=result.masterUrl;link.hidden=false;link.target="_blank";link.rel="noopener";
    status.textContent=uiText("Mix Enhance המלא מוכן. הקובץ לא הועתק לאחסון הפרויקט.","Full Mix Enhance is ready. The file has not been copied into project storage.");
    return;
   }
   status.textContent=uiText("המשימה עדיין בעיבוד. לחץ שוב כדי להמשיך לבדוק את אותה משימה.","The task is still processing. Click again to resume checking the same task.");
  }catch(error){status.textContent=error.message||uiText("אירעה תקלה ב-Mix Enhance.","Mix Enhance failed.");}
  finally{button.disabled=false;}
 };
}

function setMasterTaskLabel(taskId){
 const label=$("#masterTaskId");if(!label)return;
 label.hidden=false;label.dataset.taskid=taskId;
 label.textContent=`${uiText("מזהה משימה","Task ID")}: ${taskId}`;
 const resume=$("#masterResumeBtn");if(resume)resume.hidden=false;
}

async function saveMasteringTask(taskId,settings){
 if(!currentProjectId)return false;
 const current=projects.find(p=>p.id===currentProjectId)?.metadata?.mastering||{};
 return updateProjectMetadata({mastering:{...current,taskId,settings,createdAt:new Date().toISOString()}});
}

async function pollMasteringPreview(taskId,accessToken,status){
 status.textContent=uiText("ממתין לתוצאה מ-RoEx...","Waiting for RoEx...");
 for(let attempt=0;attempt<12;attempt++){
  const response=await fetch("/api/roex/mastering-preview-result",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify({taskId})});
  let result={};try{result=await response.json();}catch{}
  if(response.status===202){status.textContent=uiText("RoEx עדיין מעבד. אבדוק שוב בעוד כמה שניות...","RoEx is still processing. Checking again shortly...");await new Promise(resolve=>setTimeout(resolve,5000));continue;}
  if(!response.ok)throw new Error(uiText("RoEx לא החזיר Preview תקין.","RoEx did not return a valid preview."));
  const player=$("#masterPreviewAudio");player.src=result.previewUrl;player.load();
  const panel=$("#masterCompare");if(panel)panel.hidden=false;
  const full=$("#masterFinalBtn");if(full)full.hidden=false;
  status.textContent=uiText("ה-Preview מוכן. השווה בין המקור לתוצאה.","Preview is ready. Compare it with the original.");
  return true;
 }
 status.textContent=uiText("העיבוד עדיין נמשך. אפשר לבדוק שוב את אותה המשימה.","Processing is still underway. You can resume checking this task.");
 return false;
}

async function loadSavedMasterResult(){
 const path=projects.find(p=>p.id===currentProjectId)?.metadata?.mastering?.storagePath;
 if(!path||!supabaseClient)return;
 const {data,error}=await supabaseClient.storage.from("project-audio").createSignedUrl(path,300);
 if(error)return;
 const player=$("#masterFinalAudio"),link=$("#masterDownload");
 if(player){player.src=data.signedUrl;player.hidden=false;}
 if(link){link.href=data.signedUrl;link.hidden=false;link.target="_blank";link.rel="noopener";}
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
  const fullMixButton=$("#mixFullBtn");if(fullMixButton)fullMixButton.hidden=false;

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
 const supportedLanguages=["he","en"];
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
 if(!confirm(uiText("לצאת מהחשבון? הפרויקטים השמורים בענן לא יימחקו.","Sign out? Your saved cloud projects will not be deleted.")))return;

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

 if(referenceObjectUrl)URL.revokeObjectURL(referenceObjectUrl);
 referenceObjectUrl=null;referenceUrl=null;referenceFile=null;

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

 if(referenceObjectUrl)URL.revokeObjectURL(referenceObjectUrl);
 referenceObjectUrl=null;referenceUrl=null;referenceFile=null;
 currentFile=file;
 currentProjectId=existingProjectId;
 let savedMixSettings=null;
 if(existingProjectId){
  savedMixSettings=projects.find(item=>item.id===existingProjectId)?.metadata?.mixSettings||null;
  if(!savedMixSettings){
   try{savedMixSettings=JSON.parse(localStorage.getItem(`itzik_mix_settings_${existingProjectId}`)||"null");}catch{}
  }
 }
 if(window.ITZIK_MIXER)window.ITZIK_MIXER.apply(savedMixSettings||window.ITZIK_MIXER.defaults);

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
   metadata:{mixSettings:window.ITZIK_MIXER?.getSettings?.()||{}}
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
 if(data)projects.unshift(data);
 $("#playerStatus").textContent="הפרויקט נשמר בענן";
 await loadProjects();
 await persistMixSettings();
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
  let buffer;
  try{buffer=await ctx.decodeAudioData(bytes.slice(0));}
  finally{await ctx.close().catch(()=>{});}
  if(window.ITZIK_MIXER?.hasProcessing?.()){
   status.textContent=uiText("מחשב את עיבוד המיקס לייצוא...","Rendering the processed mix for export...");
   buffer=await window.ITZIK_MIXER.renderOffline(buffer,window.ITZIK_MIXER.getSettings());
  }

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

 await requestAssistant(message,reply,button);
}

async function requestAssistant(message,reply,button){
 if(!message)return;
 button.disabled=true;
 reply.textContent=uiText("איצקו חושב...","ITZKO is thinking...");
 try{
  const {data,error}=await supabaseClient.auth.getSession();
  if(error||!data.session?.access_token)throw new Error(uiText("פג תוקף החיבור לחשבון. התחבר מחדש.","Your session expired. Please sign in again."));
  const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({message,language:window.ITZIK_I18N?.getLanguage?.()||"he"})});
  const result=await response.json();
  if(!response.ok)throw new Error(uiText("שירות ה-AI אינו זמין כרגע. בדוק את הגדרת OpenAI בשרת.","The AI service is unavailable. Check the server's OpenAI configuration."));
  reply.textContent=result.message||uiText("לא התקבלה תשובה.","No response was returned.");
 }catch(error){reply.textContent=error.message||uiText("לא ניתן להגיע לשרת.","The server could not be reached.");}
 finally{button.disabled=false;}
}

function bindIdeas(){
 const button=$("#ideaGenerate");if(!button)return;
 button.onclick=async()=>{
  const output=$("#ideaOutput"),status=$("#ideaStatus");
  const type=$("#ideaType").value,style=$("#ideaStyle").value.trim(),context=$("#ideaContext").value.trim();
  if(!style&&!context){status.textContent=uiText("כתוב סגנון או הקשר לפני יצירת רעיונות.","Describe a style or context before generating ideas.");return;}
  const labels={melody:uiText("מנגינה","melody"),chords:uiText("התקדמות אקורדים","chord progression"),rhythm:uiText("קצב וגרוב","rhythm and groove"),arrangement:uiText("עיבוד והפקה","arrangement and production")};
  const prompt=uiText("צור 3 רעיונות מעשיים עבור ","Create 3 practical ")+`${labels[type]} `+uiText("לשיר בסגנון ","ideas for a song in the style ")+`${style||uiText("לא צוין","not specified")}. `+uiText("הקשר: ","Context: ")+`${context||uiText("לא צוין","not specified")}. `+uiText("הצג כל רעיון בנפרד עם הסבר קצר, ורעיון אחד שאפשר לנסות מיד. אל תטען שניגנת או ניתחת קובץ.","Separate the ideas, briefly explain each, and include one immediate experiment. Do not claim to have heard or analyzed audio.");
  output.hidden=false;status.textContent="";await requestAssistant(prompt,output,button);
 };
}

function bindAssistantAudioReview(){
 const button=$("#assistantAudioReview");if(!button)return;
 button.onclick=async()=>{
  const status=$("#assistantAudioStatus"),reply=$("#chatReply");button.disabled=true;
  status.textContent=uiText("מודד עד 60 שניות מהקובץ במכשיר...","Measuring up to 60 seconds of audio on this device...");
  let ctx;
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error(uiText("הדפדפן אינו תומך בניתוח אודיו.","Audio analysis is not supported by this browser."));
   ctx=new Ctx();const b=await ctx.decodeAudioData((await currentFile.arrayBuffer()).slice(0)),n=Math.min(b.length,Math.floor(b.sampleRate*60)),channels=Math.min(2,b.numberOfChannels);let peak=0,sum=0,count=0,clipped=0,side=0,mid=0;
   for(let i=0;i<n;i+=8){const l=b.getChannelData(0)[i],r=channels>1?b.getChannelData(1)[i]:l,m=(l+r)/2,s=(l-r)/2;peak=Math.max(peak,Math.abs(l),Math.abs(r));sum+=l*l+(channels>1?r*r:0);count+=channels;clipped+=(Math.abs(l)>=0.999?1:0)+(channels>1&&Math.abs(r)>=0.999?1:0);mid+=m*m;side+=s*s;}
   const db=x=>20*Math.log10(Math.max(1e-9,x)),measurements={durationSeconds:Number(b.duration.toFixed(1)),sampleRateHz:b.sampleRate,channels:b.numberOfChannels,peakDbfs:Number(db(peak).toFixed(1)),rmsDbfs:Number(db(Math.sqrt(sum/Math.max(1,count))).toFixed(1)),sampleClipPercent:Number((clipped/Math.max(1,count)*100).toFixed(3)),stereoSideToMid:Number(Math.sqrt(side/Math.max(1e-9,mid)).toFixed(3))};
   const prompt=uiText("נתח את המדידות המקורבות הבאות מהקובץ שלי ותן הצעות זהירות לשיפור. אל תטען ששמעת את הקובץ. המדידות אינן LUFS או ניתוח תפיסתי: ","Review these approximate local signal measurements and suggest cautious improvements. Do not claim that you heard the track. These are not LUFS or perceptual analysis: ")+JSON.stringify(measurements);
   status.textContent=uiText("המדידות נשלחות כטקסט ל-OpenAI כדי לקבל עצה. קובץ האודיו לא נשלח.","Sending measurements as text to OpenAI for advice. The audio file is not sent.");await requestAssistant(prompt,reply,button);status.textContent=uiText("המדידות המקומיות הושלמו.","Local measurements complete.");
  }catch(error){status.textContent=error.message||uiText("ניתוח המדידות נכשל.","Could not analyze the measurements.");}finally{if(ctx)await ctx.close().catch(()=>{});button.disabled=false;}
 };
}

function bindPitchAnalysis(){
 const button=$("#pitchAnalyze");if(!button)return;
 button.onclick=async()=>{
  const result=$("#pitchResult");button.disabled=true;result.textContent=uiText("מנתח קטע קצר...","Analyzing a short segment...");
  let context;
  try{
   const AudioCtx=window.AudioContext||window.webkitAudioContext;
   if(!AudioCtx)throw new Error(uiText("הדפדפן אינו תומך בניתוח אודיו.","This browser does not support audio analysis."));
   context=new AudioCtx();const decoded=await context.decodeAudioData((await currentFile.arrayBuffer()).slice(0));
   const source=decoded.getChannelData(0),stride=Math.max(1,Math.floor(decoded.sampleRate/11025)),count=Math.min(8192,Math.floor(source.length/stride));
   if(count<1024)throw new Error(uiText("הקובץ קצר מדי לניתוח.","The audio is too short to analyze."));
   const start=Math.max(0,Math.floor((source.length-count*stride)/2)),samples=new Float32Array(count);let energy=0;
   for(let i=0;i<count;i++){samples[i]=source[start+i*stride];energy+=samples[i]*samples[i];}
   if(energy/count<1e-8)throw new Error(uiText("הקטע שנבדק שקט מדי.","The analyzed segment is too quiet."));
   const rate=decoded.sampleRate/stride,minLag=Math.floor(rate/1000),maxLag=Math.min(Math.floor(rate/55),Math.floor(count/2));let bestLag=-1,best=-Infinity;
   for(let lag=minLag;lag<=maxLag;lag++){let corr=0,n=count-lag;for(let i=0;i<n;i++)corr+=samples[i]*samples[i+lag];corr/=n;if(corr>best){best=corr;bestLag=lag;}}
   if(bestLag<0||best<0.05)throw new Error(uiText("לא נמצא תדר מחזורי ברור. נסה קטע סולו או שירה.","No clear periodic pitch was found. Try a solo or vocal passage."));
   const hz=rate/bestLag,midi=69+12*Math.log2(hz/440),nearest=Math.round(midi),cents=Math.round((midi-nearest)*100),names=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"],note=names[(nearest%12+12)%12],octave=Math.floor(nearest/12)-1;
   const key=$("#pitchKey").value,scale=$("#pitchScale").value,keyPc=({C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11})[key],intervals=scale==="major"?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10],fits=intervals.includes((nearest%12-keyPc+12)%12);
   result.textContent=uiText("הערכה דומיננטית","Dominant estimate")+": "+note+octave+" · "+hz.toFixed(1)+" Hz · "+(cents>=0?"+":"")+cents+" cents. "+uiText("סולם להשוואה","Reference key")+": "+key+" "+scale+" · "+(fits?uiText("התדר תואם לסולם","Detected note fits the scale"):uiText("התדר מחוץ לסולם","Detected note falls outside the scale"))+". "+uiText("האודיו לא תוקן.","No audio correction was applied.");
  }catch(error){result.textContent=error.message||uiText("ניתוח האודיו נכשל.","Audio analysis failed.");}
  finally{if(context)await context.close().catch(()=>{});button.disabled=false;}
 };
}

function bindReference(){
 const input=$("#referenceFileInput");if(!input)return;
 const status=$("#referenceStatus"),projectPlayer=$("#referenceProjectAudio"),refPlayer=$("#referenceAudio");projectPlayer.src=currentFileUrl||"";
 const saved=projects.find(p=>p.id===currentProjectId)?.metadata?.reference;
 const setReference=(file,url)=>{if(referenceObjectUrl)URL.revokeObjectURL(referenceObjectUrl);referenceObjectUrl=url.startsWith("blob:")?url:null;referenceUrl=url;referenceFile=file||null;refPlayer.src=url;$("#referenceUseTrack").disabled=false;$("#referenceAnalyze").disabled=false;};
 if(saved?.storagePath&&supabaseClient){
  status.textContent=uiText("טוען Reference שמור...","Loading saved reference...");
  supabaseClient.storage.from("project-audio").createSignedUrl(saved.storagePath,300).then(async({data,error})=>{if(error||!data?.signedUrl)throw new Error("Signed URL unavailable");const response=await fetch(data.signedUrl);if(!response.ok)throw new Error("Reference download failed");const blob=await response.blob();setReference(new File([blob],saved.name||"reference.audio",{type:blob.type}),URL.createObjectURL(blob));status.textContent=uiText("קובץ הייחוס השמור מוכן.","Saved reference is ready.");}).catch(()=>{status.textContent=uiText("לא ניתן לטעון את קובץ הייחוס השמור.","Could not load the saved reference.");});
 }
 input.onchange=async()=>{
  const file=input.files?.[0];if(!file)return;
  if(!file.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name)){status.textContent=uiText("יש לבחור קובץ אודיו.","Choose an audio file.");input.value="";return;}
  if(file.size>50*1024*1024){status.textContent=uiText("קובץ הייחוס גדול מ־50MB.","Reference file exceeds 50 MB.");input.value="";return;}
  if(!currentProjectId||!currentUser||!supabaseClient){status.textContent=uiText("שמור תחילה את הפרויקט כדי לשמור בו Reference.","Save the project first to store a reference.");return;}
  const safe=file.name.replace(/[^\w.() -]/g,"_").slice(0,100)||"reference-audio",path=currentUser.id+"/"+currentProjectId+"/reference-"+crypto.randomUUID()+"-"+safe;
  status.textContent=uiText("מעלה ושומר את קובץ הייחוס...","Uploading and saving the reference...");input.disabled=true;
  try{const{error}=await supabaseClient.storage.from("project-audio").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});if(error)throw new Error(uiText("העלאת קובץ הייחוס נכשלה.","Reference upload failed."));const ok=await updateProjectMetadata({reference:{storagePath:path,name:file.name,mimeType:file.type||""}});if(!ok){status.textContent=uiText("הקובץ הועלה אך קישורו לא נשמר; הקובץ נשאר באחסון.","Uploaded, but its project link was not saved; the file was preserved.");return;}setReference(file,URL.createObjectURL(file));status.textContent=uiText("קובץ הייחוס נשמר בפרויקט.","Reference saved to the project.");}
  catch(error){status.textContent=error.message||uiText("שמירת הייחוס נכשלה.","Could not save reference.");}finally{input.disabled=false;}
 };
 const route=(url,name)=>{const wasPlaying=!audio.paused,position=audio.currentTime;audio.pause();audio.src=url;audio.load();$("#trackName").textContent=name;audio.addEventListener("loadedmetadata",()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(position,Math.max(0,audio.duration-.05));if(wasPlaying)audio.play().catch(()=>{});},{once:true});};
 $("#referenceUseProject").onclick=()=>route(currentFileUrl,currentFile?.name||"");$("#referenceUseTrack").onclick=()=>{if(referenceUrl)route(referenceUrl,referenceFile?.name||uiText("שיר ייחוס","Reference track"));};
 $("#referenceAnalyze").onclick=async()=>{
  const button=$("#referenceAnalyze"),metrics=$("#referenceMetrics");button.disabled=true;status.textContent=uiText("מחשב מדידות מקורבות...","Calculating approximate measurements...");let ctx;
  try{
   if(!referenceFile||!currentFile)throw new Error(uiText("חסרים קובץ פרויקט או ייחוס.","Project or reference audio is missing."));const Ctx=window.AudioContext||window.webkitAudioContext;ctx=new Ctx();
   const measure=async file=>{const b=await ctx.decodeAudioData((await file.arrayBuffer()).slice(0)),n=Math.min(b.length,Math.floor(b.sampleRate*30)),channels=Math.min(2,b.numberOfChannels);let peak=0,sum=0,count=0,low=0,mid=0,high=0,side=0,midEnergy=0;const lows=[0,0],mids=[0,0];
    for(let c=0;c<channels;c++){const d=b.getChannelData(c);for(let i=0;i<n;i+=4){const x=d[i];peak=Math.max(peak,Math.abs(x));sum+=x*x;count++;lows[c]+=.02*(x-lows[c]);mids[c]+=.15*((x-lows[c])-mids[c]);low+=lows[c]*lows[c];mid+=mids[c]*mids[c];high+=(x-lows[c]-mids[c])**2;}}
    if(channels>1){const l=b.getChannelData(0),r=b.getChannelData(1);for(let i=0;i<n;i+=4){const m=(l[i]+r[i])/2,s=(l[i]-r[i])/2;midEnergy+=m*m;side+=s*s;}}
    const db=x=>20*Math.log10(Math.max(1e-9,x));return{peak:db(peak),rms:db(Math.sqrt(sum/Math.max(1,count))),low:db(Math.sqrt(low/Math.max(1,count))),mid:db(Math.sqrt(mid/Math.max(1,count))),high:db(Math.sqrt(high/Math.max(1,count))),width:channels>1?Math.sqrt(side/Math.max(1e-9,midEnergy)):0};};
   const a=await measure(currentFile),b=await measure(referenceFile),rows=[["Peak",a.peak,b.peak],["RMS",a.rms,b.rms],[uiText("נמוכים","Low band"),a.low,b.low],[uiText("אמצע","Mid band"),a.mid,b.mid],[uiText("גבוהים","High band"),a.high,b.high],[uiText("יחס צד/אמצע","Side/mid ratio"),a.width.toFixed(2),b.width.toFixed(2)]];
   metrics.innerHTML=rows.map(row=>'<div class="metric-card"><b>'+escapeHtml(row[0])+"</b><span>"+row[1]+" · "+row[2]+"</span><small>"+uiText("פרויקט · Reference","Project · Reference")+"</small></div>").join("");metrics.hidden=false;status.textContent=uiText("ההשוואה הסתיימה; המדידות מקורבות ואינן LUFS תקני.","Comparison complete; measurements are approximate and are not standards-based LUFS.");
  }catch(error){status.textContent=error.message||uiText("השוואת האודיו נכשלה.","Audio comparison failed.");}finally{if(ctx)await ctx.close().catch(()=>{});button.disabled=false;}
 };
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

  if (!confirm(uiText("למחוק את הפרויקט ואת קובצי האודיו המשויכים אליו לצמיתות?","Permanently delete this project and its associated audio files?"))) {
    return;
  }

  const { error } = await supabaseClient
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    alert("לא הצלחנו למחוק את הפרויקט.");
    return;
  }

  const paths=[p.storage_path,p.metadata?.reference?.storagePath,p.metadata?.mastering?.storagePath].filter(Boolean);
  if(paths.length){
    const {error:storageError}=await supabaseClient.storage.from("project-audio").remove(paths);
    if(storageError){console.error("Project storage cleanup failed",{code:storageError.code||"UNKNOWN"});alert("הפרויקט נמחק, אך חלק מקובצי האחסון נשארו. ניתן לנקות אותם דרך התמיכה.");}
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
