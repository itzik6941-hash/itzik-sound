
const $ = (s) => document.querySelector(s);
const audio = $("#audio");

let currentPage = "home";
let currentFileUrl = null;
let currentFile = null;
let currentProjectId = null;
let projectTracksBindGeneration = 0;
let projectTrackAudioElements = new Map();
let activeProjectTracksProjectId = null;
let activeProjectTracksSignature = "";
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
   <div class="quick-card" data-go="pitch"><div class="quick-icon">♬</div><b>ניתוח גובה צליל</b><small>זיהוי תדר וסולם משוער</small></div>
  </div>`},

 mix:{title:"מיקס AI",html:()=>mixPage()},
 master:{title:"מאסטרינג AI",html:()=>masteringPage()},
 pitch:{title:"ניתוח גובה צליל",html:()=>pitchPage()},

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

function projectTrackScenesMarkup(scenes){
 const rows=scenes.map(scene=>'<article class="project-track-scene"><div><b>'+escapeHtml(scene.name||uiText("מצב ללא שם","Untitled scene"))+'</b><small>'+(scene.createdAt?new Date(scene.createdAt).toLocaleString():"")+'</small></div><div class="stem-track-actions"><button type="button" class="secondary-btn" data-project-track-scene-apply="'+escapeHtml(scene.id)+'">'+uiText("טען מצב","Load")+'</button><button type="button" class="secondary-btn" data-project-track-scene-delete="'+escapeHtml(scene.id)+'">'+uiText("מחק","Delete")+'</button></div></article>').join("");
 return '<section class="project-track-scenes" aria-label="'+uiText("שמירת מצבי מיקס","Mix scenes")+'"><div class="project-track-scenes-heading"><div><h4>'+uiText("מצבי מיקס שמורים","Saved mix scenes")+'</h4><p>'+uiText("שמור שילובים שונים של עוצמות, Pan, השתקות ו-Solo וחזור אליהם בכל רגע.","Save different combinations of levels, pan, mute and solo and recall them anytime.")+'</p></div><button type="button" class="primary-btn" id="projectTrackSceneSave" '+(scenes.length>=20?"disabled":"")+'>'+uiText("＋ שמור מצב נוכחי","＋ Save current mix")+'</button></div>'+(rows?'<div class="project-track-scene-list">'+rows+'</div>':'<p class="project-track-scenes-empty">'+uiText("עדיין לא שמרת מצבי מיקס. שמור מצב כדי לחזור אליו בעתיד.","No saved mix scenes yet. Save a scene to recall it later.")+'</p>')+'</section>';
}
function projectTracksPanel(){
 const project=projects.find(item=>item.id===currentProjectId);
 const tracks=project?.metadata?.projectTracks||[];
 const scenes=Array.isArray(project?.metadata?.projectTrackScenes)?project.metadata.projectTrackScenes:[];
 return `
  <section class="panel stem-panel" id="projectTrackMixer">
   <div class="workspace-title"><div class="quick-icon">♫</div><div><h2>${uiText("ערוצים שהוספת לפרויקט","Project audio tracks")}</h2><p>${uiText("הוסף כמה קובצי אודיו לאותו פרויקט. כולם יתחילו יחד ויישארו מסונכרנים.","Add multiple audio files to this project. They start together and stay synchronized.")}</p></div></div>
   <div class="stem-controls"><button type="button" class="primary-btn" id="addProjectTracks">${uiText("＋ הוסף ערוצים מהמחשב","＋ Add tracks from computer")}</button><input id="projectTracksInput" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac" multiple hidden></div>
   <p id="projectTracksStatus" aria-live="polite">${tracks.length?`${tracks.length} ${uiText("ערוצים נוספים שמורים בפרויקט","additional tracks saved in this project")}`:uiText("עדיין לא הוספת ערוצים נוספים. הקובץ הראשי נשאר ערוץ הבסיס.","No additional tracks yet. The original project file remains the base track.")}</p>
   ${tracks.length?`
    <div class="stem-mixer" id="projectTracksMixer">
     <div class="stem-mixer-heading"><h3>${uiText("מיקסר רב־ערוצי","Multitrack mixer")}</h3><p>${uiText("הקובץ הראשי וכל הערוצים הנוספים ינוגנו יחד. אפשר לשלוט בעוצמה, Pan, השתקה ו-Solo לכל ערוץ.","The original file and all added tracks play together. Control level, pan, mute and solo for each added track.")}</p></div>
     <div class="stem-transport"><button type="button" class="primary-btn" id="projectTracksPlay">${uiText("▶ נגן הכל","▶ Play all")}</button><button type="button" class="secondary-btn" id="projectTracksPause">${uiText("השהה","Pause")}</button><button type="button" class="secondary-btn" id="projectTracksStop">${uiText("עצור","Stop")}</button><button type="button" class="secondary-btn" id="projectTracksExport">${uiText("ייצא מיקס משולב WAV","Export combined WAV mix")}</button><button type="button" class="secondary-btn" id="projectTracksReset">${uiText("אפס מיקסר","Reset mixer")}</button><button type="button" class="secondary-btn" id="projectTracksPeakReset">${uiText("אפס שיאים","Reset peak holds")}</button></div>
     <label class="project-track-master"><span>${uiText("עוצמת מאסטר","Master level")} <output id="projectTrackMasterValue">-1.5 dB</output></span><input type="range" id="projectTrackMaster" min="-24" max="6" step="0.5" value="-1.5"></label>
     <label class="project-track-master"><span>${uiText("תקרת יציאה (Limiter)","Output ceiling (Limiter)")} <output id="projectTrackCeilingValue">-1.0 dB</output></span><input type="range" id="projectTrackCeiling" min="-6" max="-0.1" step="0.1" value="-1"></label>
     <div class="project-track-master-meter" role="meter" aria-label="Master output level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="project-track-master-meter-head"><span>${uiText("מד עוצמת יציאה","Output level")}</span><output id="projectTrackMasterMeterValue">Peak: -∞ dBFS</output></div>
      <div class="project-track-stereo-meters">
       <div class="project-track-stereo-channel"><span>L</span><div class="project-track-stereo-track"><span id="projectTrackLeftMeterFill"></span></div><output id="projectTrackLeftMeterValue">-∞ dBFS</output></div>
       <div class="project-track-stereo-channel"><span>R</span><div class="project-track-stereo-track"><span id="projectTrackRightMeterFill"></span></div><output id="projectTrackRightMeterValue">-∞ dBFS</output></div>
      </div>
      <div class="project-track-master-meter-rms"><span>RMS</span><output id="projectTrackMasterRmsValue">-∞ dBFS</output></div>
      <div class="project-track-master-meter-track"><span id="projectTrackMasterMeterFill"></span></div>
      <div class="project-track-master-meter-head"><span>${uiText("איזון סטריאו","Stereo balance")}</span><output id="projectTrackStereoBalanceValue">C</output></div>
      <div class="project-track-stereo-correlation"><span>${uiText("התאמה בין הערוצים","Channel correlation")}</span><output id="projectTrackStereoCorrelationValue">—</output></div>
      <span id="projectTrackMasterClip" class="project-track-master-clip" aria-live="polite"></span>
     </div>
     ${projectTrackScenesMarkup(scenes)}
     <div class="stem-mixer-tracks">
      ${tracks.map((track,index)=>`
       <article class="stem-mix-track"><div class="stem-track-heading"><b>${escapeHtml(track.name)}</b><div class="stem-track-actions">
        <button type="button" class="secondary-btn" data-project-track-rename="${escapeHtml(track.id)}">${uiText("שם","Rename")}</button><button type="button" class="secondary-btn" data-project-track-up="${escapeHtml(track.id)}" ${index===0?"disabled":""} title="${uiText("הזז למעלה","Move up")}">↑</button><button type="button" class="secondary-btn" data-project-track-down="${escapeHtml(track.id)}" ${index===tracks.length-1?"disabled":""} title="${uiText("הזז למטה","Move down")}">↓</button>
        <button type="button" class="secondary-btn" data-project-track-mute="${escapeHtml(track.id)}" aria-pressed="false">${uiText("השתק","Mute")}</button><button type="button" class="secondary-btn" data-project-track-solo="${escapeHtml(track.id)}" aria-pressed="false">Solo</button><button type="button" class="secondary-btn" data-project-track-remove="${escapeHtml(track.id)}" title="${uiText("הסר מהפרויקט","Remove from project")}">✕</button>
       </div></div>
       <label class="stem-mix-control"><span>${uiText("עוצמה","Level")} <output data-project-track-gain-value="${escapeHtml(track.id)}">0 dB</output></span><input type="range" data-project-track-gain="${escapeHtml(track.id)}" min="-48" max="12" step="0.5" value="0"></label>
       <label class="stem-mix-control"><span>Pan <output data-project-track-pan-value="${escapeHtml(track.id)}">Center</output></span><input type="range" data-project-track-pan="${escapeHtml(track.id)}" min="-1" max="1" step="0.01" value="0"></label>
       <div class="project-track-channel-meter" data-project-track-meter="${escapeHtml(track.id)}" data-peak-db="-120" role="meter" aria-label="${escapeHtml(track.name)} level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="project-track-channel-meter-head"><span>${uiText("מד עוצמת ערוץ","Track level")}</span><output data-project-track-meter-value="${escapeHtml(track.id)}">-∞ dBFS</output></div><div class="project-track-channel-meter-rms"><span>RMS</span><output data-project-track-meter-rms="${escapeHtml(track.id)}">-∞ dBFS</output></div><div class="project-track-channel-meter-track"><span data-project-track-meter-fill="${escapeHtml(track.id)}"></span><i data-project-track-meter-hold="${escapeHtml(track.id)}"></i></div><div class="project-track-channel-meter-foot"><small data-project-track-meter-clip="${escapeHtml(track.id)}"></small><output data-project-track-meter-peak="${escapeHtml(track.id)}">Peak hold: -∞ dBFS</output></div></div>
       <label class="stem-mix-control"><span>${uiText("רוחב סטריאו","Stereo width")} <output data-project-track-width-value="${escapeHtml(track.id)}">100%</output></span><input type="range" data-project-track-width="${escapeHtml(track.id)}" min="0" max="2" step="0.01" value="1"></label>
       <details class="project-track-effects"><summary>${uiText("אפקטים ועיבוד לערוץ","Track effects & processing")}</summary><div class="project-track-effects-grid">
        <label class="stem-mix-control"><span>${uiText("עוצמת כניסה","Input trim")} <output data-project-track-fx-value="inputTrimDb:${escapeHtml(track.id)}">0.0 dB</output></span><input type="range" data-project-track-fx="inputTrimDb:${escapeHtml(track.id)}" min="-24" max="24" step="0.5" value="0"></label>
        <label class="stem-mix-control"><span>Saturation <output data-project-track-fx-value="saturation:${escapeHtml(track.id)}">0%</output></span><input type="range" data-project-track-fx="saturation:${escapeHtml(track.id)}" min="0" max="100" step="1" value="0"></label>
        <label class="stem-mix-control"><span>Compressor attack <output data-project-track-fx-value="compAttack:${escapeHtml(track.id)}">12 ms</output></span><input type="range" data-project-track-fx="compAttack:${escapeHtml(track.id)}" min="0.001" max="0.1" step="0.001" value="0.012"></label>
        <label class="stem-mix-control"><span>Compressor release <output data-project-track-fx-value="compRelease:${escapeHtml(track.id)}">220 ms</output></span><input type="range" data-project-track-fx="compRelease:${escapeHtml(track.id)}" min="0.05" max="1" step="0.01" value="0.22"></label>
        <label class="stem-mix-control"><span>${uiText("היפוך פאזה","Phase invert")}</span><input type="checkbox" data-project-track-fx-toggle="phaseInvert:${escapeHtml(track.id)}"></label>
        <label class="stem-mix-control"><span>EQ Low <output data-project-track-fx-value="eqLowDb:${escapeHtml(track.id)}">0 dB</output></span><input type="range" data-project-track-fx="eqLowDb:${escapeHtml(track.id)}" min="-12" max="12" step="0.5" value="0"></label>
        <label class="stem-mix-control"><span>EQ Mid <output data-project-track-fx-value="eqMidDb:${escapeHtml(track.id)}">0 dB</output></span><input type="range" data-project-track-fx="eqMidDb:${escapeHtml(track.id)}" min="-12" max="12" step="0.5" value="0"></label>
        <label class="stem-mix-control"><span>EQ High <output data-project-track-fx-value="eqHighDb:${escapeHtml(track.id)}">0 dB</output></span><input type="range" data-project-track-fx="eqHighDb:${escapeHtml(track.id)}" min="-12" max="12" step="0.5" value="0"></label>
        <label class="stem-mix-control"><span>Compressor Threshold <output data-project-track-fx-value="compThreshold:${escapeHtml(track.id)}">-18 dB</output></span><input type="range" data-project-track-fx="compThreshold:${escapeHtml(track.id)}" min="-36" max="0" step="1" value="-18"></label>
        <label class="stem-mix-control"><span>Compressor Ratio <output data-project-track-fx-value="compRatio:${escapeHtml(track.id)}">1:1</output></span><input type="range" data-project-track-fx="compRatio:${escapeHtml(track.id)}" min="1" max="12" step="0.5" value="1"></label>
        <label class="stem-mix-control"><span>Reverb <output data-project-track-fx-value="reverbMix:${escapeHtml(track.id)}">0%</output></span><input type="range" data-project-track-fx="reverbMix:${escapeHtml(track.id)}" min="0" max="0.5" step="0.01" value="0"></label>
        <label class="stem-mix-control"><span>Delay <output data-project-track-fx-value="delayMix:${escapeHtml(track.id)}">0%</output></span><input type="range" data-project-track-fx="delayMix:${escapeHtml(track.id)}" min="0" max="0.5" step="0.01" value="0"></label>
        <label class="stem-mix-control"><span>${uiText("זמן השהיה","Delay time")} <output data-project-track-fx-value="delayTime:${escapeHtml(track.id)}">240 ms</output></span><input type="range" data-project-track-fx="delayTime:${escapeHtml(track.id)}" min="0.05" max="0.75" step="0.01" value="0.24"></label>
        <label class="stem-mix-control"><span>${uiText("משוב Delay","Delay feedback")} <output data-project-track-fx-value="delayFeedback:${escapeHtml(track.id)}">18%</output></span><input type="range" data-project-track-fx="delayFeedback:${escapeHtml(track.id)}" min="0" max="0.65" step="0.01" value="0.18"></label>
       </div></details></article>
      `).join("")}
     </div>
    </div>`:""}
  </section>`;
}

function mixPage() {
  const s = window.ITZIK_MIXER?.getSettings?.() || {};
  const activeProject=projects.find(p=>p.id===currentProjectId);
  const projectBaseSolo=activeProject?.metadata?.projectBaseSolo===true;
  const savedEnhanceTask=projects.find(p=>p.id===currentProjectId)?.metadata?.mixEnhance?.taskId||"";
  const control = (key, title, en, min, max, step, value, unit = "") =>
   `<label class="mix-control"><span>${title}<output data-mix-value="${key}">${Number(value).toFixed(key === "ratio" ? 1 : 0)}${unit}</output></span><input type="range" data-mix-control="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${en}"></label>`;
  return `
    <div class="workspace-title">
      <div class="quick-icon">☷</div>
      <div>
        <h1>${uiText("מיקס וערוצים נפרדים","Mix & separated tracks")}</h1>
        <p>${uiText("עבד את המיקס המקורי או הפרד אותו לערוצים עצמאיים לשליטה נפרדת.","Process the original mix or separate it into independent tracks for individual control.")}</p>
      </div>
    </div>

    ${currentFile ? `<div class="panel mixer-panel">
      <div class="mixer-heading"><div><h3>${uiText("ערוץ הפרויקט","Project channel")}</h3><p>${escapeHtml(currentFile.name)} · ${uiText("ערוץ בסיס סטריאו","Base stereo track")}</p></div><div class="mixer-actions"><button id="mixMute" class="secondary-btn" aria-pressed="${s.mute===true}">${s.mute?uiText("ביטול השתקה","Unmute"):uiText("השתק","Mute")}</button><button id="mixSolo" class="secondary-btn" disabled aria-pressed="${projectBaseSolo}" title="${uiText("סולו לערוץ הראשי","Solo the main track")}">${projectBaseSolo?uiText("ביטול Solo","Unsolo"):uiText("Solo","Solo")}</button><button id="mixAB" class="secondary-btn" aria-pressed="false">A/B</button><button id="mixReset" class="secondary-btn">${uiText("איפוס","Reset")}</button></div></div>
      <canvas id="mixMeter" class="mix-meter" width="800" height="22" aria-label="${uiText("מד עוצמת השמע","Audio level meter")}"></canvas>
      <div class="mixer-preset-row">
        <label for="mixPreset">${uiText("פרופיל מיקס מהיר","Quick mix profile")}</label>
        <select id="mixPreset">
          <option value="clean">${uiText("נקי ומאוזן","Clean & balanced")}</option>
          <option value="vocal">${uiText("בהירות לווקאל","Vocal clarity")}</option>
          <option value="warm">${uiText("חום ורכות","Warm & smooth")}</option>
          <option value="punch">${uiText("פאנץ' ועוצמה","Punch & power")}</option>
          <option value="wide">${uiText("סטריאו רחב","Wide stereo")}</option>
        </select>
        <button id="applyMixPreset" class="secondary-btn">${uiText("החל פרופיל","Apply profile")}</button>
      </div><small id="mixMeterText">${uiText("נגן את הקובץ כדי לראות עוצמה בזמן אמת","Play the track to see real-time level")}</small>
      <div class="mixer-strip"><h4>${uiText("ערוץ","Channel")}</h4>${control("gainDb","עוצמת ערוץ","Track level",-24,12,0.5,s.gainDb??0," dB")}${control("pan","Pan","Pan",-1,1,0.01,s.pan??0)}<div class="mixer-placeholder"><b>${uiText("ערוץ בסיס","Base track")}</b><small>${uiText("הערוצים הנוספים מופיעים במיקסר הרב־ערוצי","Additional tracks appear in the multitrack mixer")}</small></div></div>
      <div class="mixer-grid"><section class="mixer-strip"><h4>EQ</h4>${control("low","Bass · 100 Hz","Bass · 100 Hz",-12,12,0.5,s.low??0," dB")}${control("mid","Mid · 1 kHz","Mid · 1 kHz",-12,12,0.5,s.mid??0," dB")}${control("high","Treble · 8 kHz","Treble · 8 kHz",-12,12,0.5,s.high??0," dB")}</section>
      <section class="mixer-strip"><h4>${uiText("קומפרסור","Compressor")}</h4>${control("threshold","סף","Threshold",-60,0,1,s.threshold??-18," dB")}${control("ratio","יחס","Ratio",1,20,0.5,s.ratio??1,":1")}</section>
      <section class="mixer-strip"><h4>${uiText("אפקטים","Effects")}</h4>${control("reverb","Reverb","Reverb",0,0.6,0.01,s.reverb??0)}${control("delay","Delay","Delay",0,0.6,0.01,s.delay??0)}${control("width","רוחב סטריאו","Stereo width",0,2,0.01,s.width??1)}</section>
      <section class="mixer-strip"><h4>${uiText("יציאה","Output")}</h4>${control("masterDb","עוצמת Master","Master output",-18,6,0.5,s.masterDb??0," dB")}</section></div>
      <p class="mixer-note">${uiText("A/B משווה בין האות המקורי לעיבוד. הייצוא משתמש בעיבוד הפעיל.","A/B switches between the original signal and processing. Export uses the active processing.")}</p>
    </div>` : `<div class="panel empty-state"><div class="big">♫</div><b>${uiText("קודם נעלה שיר","Upload a track first")}</b><p>${uiText("המיקסר יופעל על ערוץ הסטריאו שבפרויקט.","The mixer works on the stereo track in your project.")}</p><button class="secondary-btn" data-go="home">${uiText("העלאת שיר","Upload a track")}</button></div>`}

    ${currentFile ? projectTracksPanel() : ""}

    ${currentFile ? (() => {
    const stemMeta=projects.find(p=>p.id===currentProjectId)?.metadata?.stemSeparation||{};
      const stemNames=stemMeta.separationMode==="vocals_instrumental"?["vocals","instrumental"]:["vocals","drums","bass","other"];
      const stemLabels={vocals:uiText("שירה","Vocals"),drums:uiText("תופים","Drums"),bass:uiText("בס","Bass"),other:uiText("כלים נוספים","Other instruments"),instrumental:uiText("פלייבק ללא שירה","Instrumental")};
      const saved=stemNames.filter(name=>stemMeta.stems?.[name]);
      return `<section class="panel stem-panel">
        <div class="workspace-title"><div class="quick-icon">♫</div><div><h2>${uiText("הפרדת ערוצים עם AI","AI stem separation")}</h2><p>${uiText("הפרד את הקובץ לערוצים עצמאיים ושמור אותם בפרויקט שלך.","Separate the mix into independent tracks and save them to your project.")}</p></div></div>
        <div class="stem-cost-note">${uiText("הפרדת 4 ערוצים עולה 75 קרדיטים ב-RoEx רק אם ההפרדה מצליחה. מצב 2 ערוצים מפריד שירה ופלייבק.","4-stem separation costs 75 RoEx credits only if successful. The 2-stem mode separates vocals and instrumental.")}</div>
        <div class="stem-controls">
          <label for="stemSeparationMode">${uiText("סוג הפרדה","Separation mode")}</label>
          <select id="stemSeparationMode">
            <option value="four" ${stemMeta.separationMode!=="vocals_instrumental"?"selected":""}>${uiText("4 ערוצים: שירה, תופים, בס וכל השאר","4 stems: vocals, drums, bass & other")}</option>
            <option value="vocals_instrumental" ${stemMeta.separationMode==="vocals_instrumental"?"selected":""}>${uiText("2 ערוצים: שירה ופלייבק","2 stems: vocals & instrumental")}</option>
          </select>
          <button id="separateStemsBtn" class="primary-btn">${stemMeta.taskId?uiText("בדיקת מצב / המשך שמירה","Check status / resume saving"):uiText("הפרד ערוצים · 75 קרדיטים","Separate stems · 75 credits")}</button>
        </div>
        <p id="stemSeparationStatus" aria-live="polite">${stemMeta.taskId?uiText("נמצאה משימת הפרדה קודמת. אפשר להמשיך לבדוק אותה.","A previous separation task was found. You can resume checking it."):""}</p>
        ${saved.length?`
          <div class="stem-mixer" id="stemMixer">
            <div class="stem-mixer-heading"><div><h3>${uiText("מיקסר רב־ערוצי","Multitrack mixer")}</h3><p>${uiText("כל הערוצים מנוגנים יחד ובסנכרון. שלוט בעוצמה, Pan, השתקה ו-Solo לכל ערוץ.","All tracks play together in sync. Control level, pan, mute and solo independently.")}</p></div></div>
            <label class="stem-master-control"><span>${uiText("עוצמת יציאה כללית","Master output")} <output id="stemMasterValue">0 dB</output></span><input id="stemMasterGain" type="range" min="-24" max="0" step="0.5" value="0"></label>
            <div class="stem-transport">
              <button id="stemPlay" class="primary-btn">${uiText("נגן הכל","Play all")}</button>
              <button id="stemPause" class="secondary-btn">${uiText("השהה","Pause")}</button>
              <button id="stemStop" class="secondary-btn">${uiText("עצור","Stop")}</button>
              <button id="stemExport" class="secondary-btn">${uiText("ייצא מיקס משולב WAV","Export combined WAV mix")}</button>
            </div>
            <p id="stemMixerStatus" aria-live="polite">${uiText("הערוצים נטענים מהאחסון המאובטח...","Loading tracks from secure storage...")}</p>
            <div class="stem-mixer-tracks">
              ${saved.map(name=>`<article class="stem-mix-track" data-stem-track="${name}">
                <div class="stem-track-heading"><b>${stemLabels[name]}</b><div class="stem-track-actions">
                  <button type="button" class="secondary-btn" data-stem-mute="${name}" aria-pressed="false">${uiText("השתק","Mute")}</button>
                  <button type="button" class="secondary-btn" data-stem-solo="${name}" aria-pressed="false">Solo</button>
                </div></div>
                <label class="stem-mix-control"><span>${uiText("עוצמה","Level")} <output data-stem-gain-value="${name}">0 dB</output></span><input type="range" data-stem-gain="${name}" min="-48" max="12" step="0.5" value="0"></label>
                <label class="stem-mix-control"><span>Pan <output data-stem-pan-value="${name}">Center</output></span><input type="range" data-stem-pan="${name}" min="-1" max="1" step="0.01" value="0"></label>
                <details class="stem-effects"><summary>${uiText("אפקטים לערוץ","Track effects")}</summary>
                  <div class="stem-effects-grid">
                    <label class="stem-mix-control"><span>EQ Low <output data-stem-fx-value="eqLow:${name}">0 dB</output></span><input type="range" data-stem-fx="eqLow:${name}" min="-12" max="12" step="0.5" value="0"></label>
                    <label class="stem-mix-control"><span>EQ Mid <output data-stem-fx-value="eqMid:${name}">0 dB</output></span><input type="range" data-stem-fx="eqMid:${name}" min="-12" max="12" step="0.5" value="0"></label>
                    <label class="stem-mix-control"><span>EQ High <output data-stem-fx-value="eqHigh:${name}">0 dB</output></span><input type="range" data-stem-fx="eqHigh:${name}" min="-12" max="12" step="0.5" value="0"></label>
                    <label class="stem-mix-control"><span>Compressor Threshold <output data-stem-fx-value="compThreshold:${name}">0 dB</output></span><input type="range" data-stem-fx="compThreshold:${name}" min="-36" max="0" step="1" value="0"></label>
                    <label class="stem-mix-control"><span>Compressor Ratio <output data-stem-fx-value="compRatio:${name}">1:1</output></span><input type="range" data-stem-fx="compRatio:${name}" min="1" max="12" step="0.5" value="1"></label>
                    <label class="stem-mix-control"><span>Reverb <output data-stem-fx-value="reverbMix:${name}">0%</output></span><input type="range" data-stem-fx="reverbMix:${name}" min="0" max="0.5" step="0.01" value="0"></label>
                    <label class="stem-mix-control"><span>Delay <output data-stem-fx-value="delayMix:${name}">0%</output></span><input type="range" data-stem-fx="delayMix:${name}" min="0" max="0.5" step="0.01" value="0"></label>
                    <label class="stem-mix-control"><span>${uiText("זמן השהיה","Delay time")} <output data-stem-fx-value="delayTime:${name}">240 ms</output></span><input type="range" data-stem-fx="delayTime:${name}" min="0.05" max="0.75" step="0.01" value="0.24"></label>
                    <label class="stem-mix-control"><span>${uiText("משוב Delay","Delay feedback")} <output data-stem-fx-value="delayFeedback:${name}">18%</output></span><input type="range" data-stem-fx="delayFeedback:${name}" min="0" max="0.65" step="0.01" value="0.18"></label>
                  </div>
                </details>
                <audio data-stem-audio="${name}" preload="auto" crossorigin="anonymous"></audio>
                <a class="secondary-btn stem-download" data-stem-download="${name}" download="${name}.wav">${uiText("הורד ערוץ","Download stem")}</a>
              </article>`).join("")}
            </div>
            <a id="stemMixDownload" class="primary-btn" hidden download="itzik-sound-mix.wav">${uiText("הורדת המיקס המשולב","Download combined mix")}</a>
          </div>`: ""}
        ${saved.length?"":`<div class="stem-list"><h3>${uiText("הערוצים יופיעו כאן לאחר ההפרדה","Tracks will appear here after separation")}</h3></div>`}
      </section>`;
    })() : ""}

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
 return `<div class="workspace-title"><div class="quick-icon">◉</div><div><h1>מאסטרינג AI</h1><p>${uiText("תצוגת Preview אמיתית של RoEx. בקשת מאסטר מלא מחויבת רק לאחר אישור מפורש.","Real RoEx mastering preview. A full master is requested only after explicit confirmation.")}</p></div></div><div class="panel"><h3>${uiText("הקובץ למאסטרינג","Track to master")}</h3>${currentFile?`<p>${escapeHtml(currentFile.name)}</p><label for="masterStyle">${uiText("סגנון","Style")}</label><select id="masterStyle"><option value="POP">Pop</option><option value="ROCK_INDIE">Rock / Indie</option><option value="ACOUSTIC">Acoustic</option><option value="HIPHOP_GRIME">Hip Hop</option><option value="ELECTRONIC">Electronic</option><option value="REGGAE_DUB">Reggae / Dub</option><option value="METAL">Metal</option><option value="OTHER">Other</option></select><label for="masterLoudness">${uiText("עוצמה רצויה","Target loudness")}</label><select id="masterLoudness"><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="HIGH">High</option></select><label for="masterSampleRate">${uiText("קצב דגימה","Sample rate")}</label><select id="masterSampleRate"><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option></select><button class="primary-btn" id="masterPreviewBtn">${uiText("יצירת Preview","Create preview")}</button><button class="secondary-btn" id="masterResumeBtn" ${storedTask?"":"hidden"}>${uiText("חזרה למשימת Preview שמורה","Resume saved preview task")}</button><p id="masterStatus" aria-live="polite"></p><p id="masterTaskId" ${storedTask?"":"hidden"} data-taskid="${escapeHtml(storedTask)}">${storedTask?`${uiText("מזהה משימה","Task ID")}: ${escapeHtml(storedTask)}`:""}</p><div class="comparison-grid" id="masterCompare" hidden><section><h4>${uiText("מקור","Original")}</h4><audio id="masterOriginalAudio" controls style="width:100%"></audio></section><section><h4>${uiText("Preview","Preview")}</h4><audio id="masterPreviewAudio" controls style="width:100%"></audio></section></div><button class="secondary-btn" id="masterFinalBtn" hidden>${uiText("בקשת מאסטר מלא · 220 קרדיטים","Request full master · 220 credits")}</button><audio id="masterFinalAudio" controls ${storedPath?"":"hidden"} style="width:100%;margin-top:15px"></audio><a id="masterDownload" ${storedPath?"":"hidden"} download>${uiText("הורדת קובץ המאסטר","Download mastered file")}</a><p id="masterSaveStatus" aria-live="polite">${storedPath?uiText("קיים קובץ מאסטר שמור בפרויקט.","A mastered file is saved in this project."):""}</p>`:`<div class="empty-state"><div class="big">♫</div><b>${uiText("קודם נעלה שיר","Upload a track first")}</b><p>${uiText("MP3, WAV, M4A, AAC או FLAC עד 50MB.","MP3, WAV, or FLAC up to 50 MB.")}</p><button class="secondary-btn" data-go="home">${uiText("העלאת שיר","Upload a track")}</button></div>`}</div>`;
}
function render(page){
 currentPage=page;
 const p=pages[page]||pages.home;
 $("#topTitle").textContent=p.title;
 $("#pageContent").innerHTML=p.html();
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 bindDynamic();
}


function clearProjectTrackAudioElements(){
 for(const element of projectTrackAudioElements.values()){
  try{element.pause();element.removeAttribute("src");element.load();}catch{}
 }
 projectTrackAudioElements.clear();
 activeProjectTracksProjectId=null;
 activeProjectTracksSignature="";
}

async function retryProjectTrackStorageCleanup(projectId,statusElement){
 const project=projects.find(item=>item.id===projectId);
 const pending=Array.isArray(project?.metadata?.projectTrackCleanupPending)
  ?project.metadata.projectTrackCleanupPending.filter(path=>typeof path==="string"&&path)
  :[];
 if(!pending.length)return;
 const {error}=await supabaseClient.storage.from("project-audio").remove(pending);
 if(error){
  if(statusElement)statusElement.textContent=uiText("יש קובצי ערוצים שהוסרו מהפרויקט אך עדיין ממתינים לניקוי באחסון.","Some tracks were removed from the project but are still pending storage cleanup.");
  return;
 }
 const latest=projects.find(item=>item.id===projectId);
 const remaining=(latest?.metadata?.projectTrackCleanupPending||[]).filter(path=>!pending.includes(path));
 if(!await updateProjectMetadata({projectTrackCleanupPending:remaining})&&statusElement){
  statusElement.textContent=uiText("הקבצים נוקו מהאחסון, אך עדכון מצב הניקוי בפרויקט נכשל.","Storage cleanup succeeded, but the project cleanup status could not be updated.");
 }
}

async function bindProjectTracks(){
 const bindGeneration=++projectTracksBindGeneration;
 const panel=$("#projectTrackMixer");
 if(!panel)return;
 const project=projects.find(item=>item.id===currentProjectId);
 const tracks=project?.metadata?.projectTracks||[];
 const status=$("#projectTracksStatus"),input=$("#projectTracksInput"),addButton=$("#addProjectTracks");
 if(!project||!currentProjectId){if(status)status.textContent=uiText("צריך לשמור את הפרויקט בענן לפני הוספת ערוצים.","Save this project to the cloud before adding tracks.");if(addButton)addButton.disabled=true;return;}
 await retryProjectTrackStorageCleanup(currentProjectId,status);
 if(addButton&&input)addButton.onclick=()=>input.click();
 if(input)input.onchange=async()=>{
  const selected=Array.from(input.files||[]);input.value="";if(!selected.length)return;
  if(tracks.length+selected.length>16){if(status)status.textContent=uiText("אפשר לשמור עד 16 ערוצים נוספים בפרויקט.","You can save up to 16 additional tracks per project.");return;}
  const currentBytes=tracks.reduce((sum,track)=>sum+(Number(track.size)||0),0);
  const selectedBytes=selected.reduce((sum,file)=>sum+file.size,0);
  if(currentBytes+selectedBytes>200*1024*1024){if(status)status.textContent=uiText("נפח הערוצים הנוספים מוגבל ל־200MB לפרויקט.","Additional tracks are limited to 200 MB per project.");return;}
  addButton.disabled=true;
  const uploaded=[];
  try{
   for(const file of selected){
    if(!file.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name))throw new Error(uiText("הקובץ "+file.name+" אינו קובץ אודיו נתמך.","The file "+file.name+" is not a supported audio file."));
    if(file.size>50*1024*1024)throw new Error(uiText("הקובץ "+file.name+" גדול מ־50MB.","The file "+file.name+" exceeds 50 MB."));
    if(status)status.textContent=uiText("מעלה: ","Uploading: ")+file.name;
    const id=crypto.randomUUID(),safeName=file.name.replace(/[^\w.() -]/g,"_").slice(0,100)||"audio-file";
    const storagePath=`${currentUser.id}/${currentProjectId}/tracks/${id}-${safeName}`;
    const {error:uploadError}=await supabaseClient.storage.from("project-audio").upload(storagePath,file,{contentType:file.type||"application/octet-stream",upsert:false});
    if(uploadError)throw new Error(uiText("העלאת הקובץ נכשלה: ","Upload failed: ")+uploadError.message);
    uploaded.push({id,name:file.name,storagePath,size:file.size,type:file.type||"application/octet-stream",createdAt:new Date().toISOString()});
   }
   const latest=projects.find(item=>item.id===currentProjectId);
   const next=[...(latest?.metadata?.projectTracks||[]),...uploaded];
   if(!await updateProjectMetadata({projectTracks:next}))throw new Error(uiText("הקבצים הועלו, אך שמירת פרטי הערוצים בפרויקט נכשלה.","The files uploaded, but their project records could not be saved."));
   render("mix");
  }catch(error){
   if(uploaded.length)await supabaseClient.storage.from("project-audio").remove(uploaded.map(track=>track.storagePath));
   const message=error.message||uiText("הוספת הערוצים נכשלה.","Could not add tracks.");
   if(status)status.textContent=message;
   else{render("mix");const nextStatus=$("#projectTracksStatus");if(nextStatus)nextStatus.textContent=message;}
  }finally{if(addButton)addButton.disabled=false;}
 };
 const trackSignature=tracks.map(track=>track.id).sort().join("|");
 if(!tracks.length){
  if(activeProjectTracksProjectId===currentProjectId||window.ITZIK_PROJECT_TRACKS?.isActive?.()){
   await window.ITZIK_PROJECT_TRACKS?.destroy?.();
   clearProjectTrackAudioElements();
  }
  return;
 }
 const engineReady=activeProjectTracksProjectId===currentProjectId&&activeProjectTracksSignature===trackSignature&&window.ITZIK_PROJECT_TRACKS?.isActive?.();
 const audioItems=[];
 try{
  if(!engineReady){
   await window.ITZIK_PROJECT_TRACKS?.destroy?.();
   clearProjectTrackAudioElements();
   for(const track of tracks){
    const element=new Audio();
    element.preload="auto";
    element.crossOrigin="anonymous";
    projectTrackAudioElements.set(track.id,element);
    const {data,error}=await supabaseClient.storage.from("project-audio").createSignedUrl(track.storagePath,3600);
    if(bindGeneration!==projectTracksBindGeneration||!panel.isConnected)return;
    if(error||!data?.signedUrl)throw new Error(uiText("לא ניתן לטעון את הערוץ: ","Could not load track: ")+track.name);
    element.src=data.signedUrl;element.load();
    audioItems.push({id:track.id,audio:element,settings:project.metadata?.projectTrackMixSettings?.[track.id]||{}});
   }
   if(bindGeneration!==projectTracksBindGeneration||!panel.isConnected)return;
   await window.ITZIK_PROJECT_TRACKS.init(audioItems,audio);
   window.ITZIK_PROJECT_TRACKS.setOutputCeilingDb(project.metadata?.projectTrackOutputCeilingDb??-1);
   activeProjectTracksProjectId=currentProjectId;
   activeProjectTracksSignature=trackSignature;
  }else{
   for(const track of tracks){
    const element=projectTrackAudioElements.get(track.id);
    if(!element)throw new Error(uiText("קובץ ערוץ חסר בזיכרון. טען מחדש את הפרויקט.","A project track is missing from memory. Reload the project."));
    audioItems.push({id:track.id,audio:element,settings:window.ITZIK_PROJECT_TRACKS.getTrack(track.id)||{}});
   }
  }
  if(bindGeneration!==projectTracksBindGeneration||!panel.isConnected)return;
  updateProjectTrackPlayer();
  const baseSoloButton=$("#mixSolo");
  const baseSoloActive=window.ITZIK_PROJECT_TRACKS.setBaseSolo(project.metadata?.projectBaseSolo===true);
  if(baseSoloButton){baseSoloButton.disabled=false;baseSoloButton.setAttribute("aria-pressed",String(baseSoloActive));baseSoloButton.textContent=baseSoloActive?uiText("ביטול Solo","Unsolo"):"Solo";}
  const save=async id=>{
   const latest=projects.find(item=>item.id===currentProjectId);
   const settings={...(latest?.metadata?.projectTrackMixSettings||{}),[id]:window.ITZIK_PROJECT_TRACKS.getTrack(id)};
   if(!await updateProjectMetadata({projectTrackMixSettings:settings})&&status)status.textContent=uiText("השינוי פעיל, אך השמירה בענן נכשלה.","The change is active, but cloud saving failed.");
  };
  const refresh=id=>{
   const state=window.ITZIK_PROJECT_TRACKS.getTrack(id);if(!state)return;
   const gain=document.querySelector('[data-project-track-gain-value="'+id+'"]'),pan=document.querySelector('[data-project-track-pan-value="'+id+'"]');
   const mute=document.querySelector('[data-project-track-mute="'+id+'"]'),solo=document.querySelector('[data-project-track-solo="'+id+'"]');
   if(gain)gain.textContent=state.gainDb.toFixed(1)+" dB";
   if(pan)pan.textContent=state.pan<=-.98?"L":state.pan>=.98?"R":state.pan===0?uiText("מרכז","Center"):state.pan<0?"L "+Math.round(-state.pan*100)+"%":"R "+Math.round(state.pan*100)+"%";
   const width=document.querySelector('[data-project-track-width-value="'+id+'"]');if(width)width.textContent=Math.round(state.stereoWidth*100)+"%";
   if(mute){mute.setAttribute("aria-pressed",String(state.mute));mute.textContent=state.mute?uiText("בטל השתקה","Unmute"):uiText("השתק","Mute");}
   if(solo)solo.setAttribute("aria-pressed",String(state.solo));
  };
  const refreshTrackFx=id=>{
   const state=window.ITZIK_PROJECT_TRACKS.getTrack(id);if(!state)return;
   document.querySelectorAll('[data-project-track-fx]').forEach(input=>{
    const [key,trackId]=input.dataset.projectTrackFx.split(":");if(trackId!==id)return;
    input.value=String(state[key]);
    const output=document.querySelector('[data-project-track-fx-value="'+key+':'+id+'"]');
    if(output)output.textContent=key==="compRatio"?Number(state[key]).toFixed(1)+":1":key==="delayTime"||key==="compAttack"||key==="compRelease"?Math.round(state[key]*1000)+" ms":key==="reverbMix"||key==="delayMix"||key==="delayFeedback"||key==="saturation"?Math.round(state[key]*100)+"%":Number(state[key]).toFixed(1)+" dB";
   });
   document.querySelectorAll('[data-project-track-fx-toggle]').forEach(input=>{
    const [key,trackId]=input.dataset.projectTrackFxToggle.split(":");
    if(trackId===id)input.checked=state[key]===true;
   });
  };
  for(const track of audioItems){
   const id=track.id,gain=document.querySelector('[data-project-track-gain="'+id+'"]'),pan=document.querySelector('[data-project-track-pan="'+id+'"]'),width=document.querySelector('[data-project-track-width="'+id+'"]');
   const mute=document.querySelector('[data-project-track-mute="'+id+'"]'),solo=document.querySelector('[data-project-track-solo="'+id+'"]');
   if(gain){gain.value=track.settings.gainDb??0;gain.oninput=()=>{window.ITZIK_PROJECT_TRACKS.setTrack(id,{gainDb:Number(gain.value)});refresh(id);save(id);};}
   if(pan){pan.value=track.settings.pan??0;pan.oninput=()=>{window.ITZIK_PROJECT_TRACKS.setTrack(id,{pan:Number(pan.value)});refresh(id);save(id);};}
   if(width){const value=track.settings.stereoWidth??1;width.value=value;const output=document.querySelector('[data-project-track-width-value="'+id+'"]');if(output)output.textContent=Math.round(value*100)+"%";width.oninput=()=>{const next=Number(width.value);window.ITZIK_PROJECT_TRACKS.setTrack(id,{stereoWidth:next});if(output)output.textContent=Math.round(next*100)+"%";save(id);};}
   document.querySelectorAll('[data-project-track-fx]').forEach(input=>{
    const [key,trackId]=input.dataset.projectTrackFx.split(":");if(trackId!==id)return;
    input.value=String(track.settings[key]??window.ITZIK_PROJECT_TRACKS.effectDefaults[key]);
    const output=document.querySelector('[data-project-track-fx-value="'+key+':'+id+'"]');
    const display=value=>key==="compRatio"?Number(value).toFixed(1)+":1":key==="delayTime"||key==="compAttack"||key==="compRelease"?Math.round(value*1000)+" ms":key==="reverbMix"||key==="delayMix"||key==="delayFeedback"||key==="saturation"?Math.round(value*100)+"%":Number(value).toFixed(1)+" dB";
    if(output)output.textContent=display(input.value);
    input.oninput=()=>{window.ITZIK_PROJECT_TRACKS.setTrack(id,{[key]:Number(input.value)});if(output)output.textContent=display(input.value);save(id);};
   });
   document.querySelectorAll('[data-project-track-fx-toggle]').forEach(input=>{
    const [key,trackId]=input.dataset.projectTrackFxToggle.split(":");if(trackId!==id)return;
    input.checked=track.settings[key]===true;
    input.onchange=()=>{window.ITZIK_PROJECT_TRACKS.setTrack(id,{[key]:input.checked});save(id);};
   });
   refreshTrackFx(id);
   if(mute)mute.onclick=()=>{const state=window.ITZIK_PROJECT_TRACKS.getTrack(id);window.ITZIK_PROJECT_TRACKS.setTrack(id,{mute:!state.mute});refresh(id);save(id);};
   if(solo)solo.onclick=async()=>{const state=window.ITZIK_PROJECT_TRACKS.getTrack(id);window.ITZIK_PROJECT_TRACKS.setTrack(id,{solo:!state.solo});audioItems.forEach(item=>refresh(item.id));const baseButton=$("#mixSolo");if(baseButton){baseButton.setAttribute("aria-pressed","false");baseButton.textContent="Solo";}const settings=window.ITZIK_PROJECT_TRACKS.getSettings();const saved=await updateProjectMetadata({projectBaseSolo:false,projectTrackMixSettings:settings});if(!saved&&status)status.textContent=uiText("מצב Solo פעיל, אך השמירה בענן נכשלה.","Solo is active, but cloud saving failed.");};
   refresh(id);
  }
  const masterSlider=$("#projectTrackMaster"),masterValue=$("#projectTrackMasterValue");
  const savedMasterDb=Number.isFinite(Number(project.metadata?.projectTrackMasterDb))?Number(project.metadata.projectTrackMasterDb):-1.5;
  const activeMasterDb=window.ITZIK_PROJECT_TRACKS.setMasterDb(savedMasterDb);
  if(masterSlider)masterSlider.value=String(activeMasterDb);
  if(masterValue)masterValue.textContent=activeMasterDb.toFixed(1)+" dB";
  if(masterSlider)masterSlider.oninput=async()=>{
   const value=window.ITZIK_PROJECT_TRACKS.setMasterDb(Number(masterSlider.value));
   if(masterValue)masterValue.textContent=value.toFixed(1)+" dB";
   if(!await updateProjectMetadata({projectTrackMasterDb:value})&&status)status.textContent=uiText("עוצמת המאסטר פעילה, אך השמירה בענן נכשלה.","Master level is active, but cloud saving failed.");
  };
  const ceilingSlider=$("#projectTrackCeiling"),ceilingValue=$("#projectTrackCeilingValue");
  const activeCeiling=window.ITZIK_PROJECT_TRACKS.setOutputCeilingDb(project.metadata?.projectTrackOutputCeilingDb??-1);
  if(ceilingSlider)ceilingSlider.value=String(activeCeiling);
  if(ceilingValue)ceilingValue.textContent=activeCeiling.toFixed(1)+" dB";
  if(ceilingSlider)ceilingSlider.oninput=async()=>{
   const value=window.ITZIK_PROJECT_TRACKS.setOutputCeilingDb(Number(ceilingSlider.value));
   if(ceilingValue)ceilingValue.textContent=value.toFixed(1)+" dB";
   if(!await updateProjectMetadata({projectTrackOutputCeilingDb:value})&&status)status.textContent=uiText("תקרת היציאה פעילה, אך השמירה בענן נכשלה.","Output ceiling is active, but cloud saving failed.");
  };
  const masterMeterFill=$("#projectTrackMasterMeterFill"),masterMeterValue=$("#projectTrackMasterMeterValue"),masterMeterRms=$("#projectTrackMasterRmsValue"),masterMeterWrap=$(".project-track-master-meter"),masterClip=$("#projectTrackMasterClip"),leftMeterFill=$("#projectTrackLeftMeterFill"),rightMeterFill=$("#projectTrackRightMeterFill"),leftMeterValue=$("#projectTrackLeftMeterValue"),rightMeterValue=$("#projectTrackRightMeterValue"),stereoBalanceValue=$("#projectTrackStereoBalanceValue"),stereoCorrelationValue=$("#projectTrackStereoCorrelationValue");
  if(window.__itzikMasterMeterFrame)cancelAnimationFrame(window.__itzikMasterMeterFrame);
  const updateMasterMeter=()=>{
   if(!masterMeterFill||!masterMeterValue||!window.ITZIK_PROJECT_TRACKS.isActive?.()){window.__itzikMasterMeterFrame=0;return;}
   const meter=window.ITZIK_PROJECT_TRACKS.getMasterMeter?.()||{peak:0,db:-120,clipping:false};
   const level=Math.max(0,Math.min(100,(meter.db+60)/60*100));
   masterMeterFill.style.width=level.toFixed(1)+"%";
   masterMeterValue.textContent="Peak: "+(meter.db<=-59.9?"-∞":meter.db.toFixed(1))+" dBFS";
   if(masterMeterRms){const rmsDb=20*Math.log10(Math.max(meter.rms||0,1e-6));masterMeterRms.textContent=rmsDb<=-59.9?"-∞ dBFS":rmsDb.toFixed(1)+" dBFS";}
   const left=meter.left||{peak:0,db:-Infinity},right=meter.right||{peak:0,db:-Infinity};
   if(leftMeterFill)leftMeterFill.style.width=Math.max(0,Math.min(100,(left.db+60)/60*100)).toFixed(1)+"%";
   if(rightMeterFill)rightMeterFill.style.width=Math.max(0,Math.min(100,(right.db+60)/60*100)).toFixed(1)+"%";
   if(leftMeterValue)leftMeterValue.textContent=left.db<=-59.9?"-∞":left.db.toFixed(1);
   if(rightMeterValue)rightMeterValue.textContent=right.db<=-59.9?"-∞":right.db.toFixed(1);
   if(stereoBalanceValue){const balance=meter.stereoBalance||0;stereoBalanceValue.textContent=Math.abs(balance)<0.04?"C":balance<0?"L "+Math.round(-balance*100)+"%":"R "+Math.round(balance*100)+"%";}
   if(stereoCorrelationValue)stereoCorrelationValue.textContent=Number.isFinite(meter.correlation)?meter.correlation.toFixed(2):"—";
   if(masterMeterWrap)masterMeterWrap.setAttribute("aria-valuenow",String(Math.round(level)));
   if(masterClip)masterClip.textContent=meter.clipping?uiText("שיא אות!","CLIP!"): "";
   document.querySelectorAll("[data-project-track-meter]").forEach(wrap=>{
    const id=wrap.dataset.projectTrackMeter,trackMeter=window.ITZIK_PROJECT_TRACKS.getTrackMeter?.(id)||{db:-Infinity,clipping:false};
    const fill=wrap.querySelector("[data-project-track-meter-fill]"),value=wrap.querySelector("[data-project-track-meter-value]"),clip=wrap.querySelector("[data-project-track-meter-clip]"),hold=wrap.querySelector("[data-project-track-meter-hold]"),peakValue=wrap.querySelector("[data-project-track-meter-peak]");
    const trackLevel=Math.max(0,Math.min(100,(trackMeter.db+60)/60*100));
    const heldDb=Math.max(Number(wrap.dataset.peakDb??-120),Number.isFinite(trackMeter.db)?trackMeter.db:-120);
    wrap.dataset.peakDb=String(heldDb);
    const heldLevel=Math.max(0,Math.min(100,(heldDb+60)/60*100));
    if(fill)fill.style.width=trackLevel.toFixed(1)+"%";
    if(hold)hold.style.left=heldLevel.toFixed(1)+"%";
    if(peakValue)peakValue.textContent="Peak hold: "+(heldDb<=-59.9?"-∞":heldDb.toFixed(1))+" dBFS";
    if(value)value.textContent=trackMeter.db<=-59.9?"-∞ dBFS":trackMeter.db.toFixed(1)+" dBFS";
    const rms=wrap.querySelector("[data-project-track-meter-rms]"),rmsDb=20*Math.log10(Math.max(trackMeter.rms||0,1e-6));
    if(rms)rms.textContent=rmsDb<=-59.9?"-∞ dBFS":rmsDb.toFixed(1)+" dBFS";
    if(clip)clip.textContent=trackMeter.clipping?uiText("שיא אות!","CLIP!"):"";
    wrap.setAttribute("aria-valuenow",String(Math.round(trackLevel)));
   });
   window.__itzikMasterMeterFrame=requestAnimationFrame(updateMasterMeter);
  };
  window.__itzikMasterMeterFrame=0;
  const peakReset=$("#projectTracksPeakReset");
  if(peakReset)peakReset.onclick=()=>{
   document.querySelectorAll("[data-project-track-meter]").forEach(wrap=>{
    wrap.dataset.peakDb="-120";
    const hold=wrap.querySelector("[data-project-track-meter-hold]"),peakValue=wrap.querySelector("[data-project-track-meter-peak]");
    if(hold)hold.style.left="0%";
    if(peakValue)peakValue.textContent="Peak hold: -∞ dBFS";
   });
   if(status)status.textContent=uiText("שיאי העוצמה אופסו.","Peak holds reset.");
  };
  if(window.ITZIK_PROJECT_TRACKS.isActive?.())window.__itzikMasterMeterFrame=requestAnimationFrame(updateMasterMeter);
  const sceneSave=$("#projectTrackSceneSave");
  if(sceneSave)sceneSave.onclick=async()=>{
   const latest=projects.find(item=>item.id===currentProjectId),savedScenes=[...(latest?.metadata?.projectTrackScenes||[])];
   if(savedScenes.length>=20){if(status)status.textContent=uiText("אפשר לשמור עד 20 מצבי מיקס בפרויקט.","You can save up to 20 mix scenes per project.");return;}
   const entered=prompt(uiText("תן שם למצב המיקס:","Name this mix scene:"),uiText("מצב מיקס ","Mix scene ")+(savedScenes.length+1));
   if(entered===null)return;
   const name=entered.trim().slice(0,60);
   if(!name){if(status)status.textContent=uiText("צריך לתת שם למצב המיקס.","Please enter a name for the mix scene.");return;}
   const scene={id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),settings:window.ITZIK_PROJECT_TRACKS.getSettings(),baseSolo:window.ITZIK_PROJECT_TRACKS.getBaseSolo(),masterDb:window.ITZIK_PROJECT_TRACKS.getMasterDb()};
   if(await updateProjectMetadata({projectTrackScenes:[...savedScenes,scene]})){render("mix");const nextStatus=$("#projectTracksStatus");if(nextStatus)nextStatus.textContent=uiText("מצב המיקס נשמר בפרויקט.","Mix scene saved to the project.");}
   else if(status)status.textContent=uiText("שמירת מצב המיקס נכשלה.","Could not save the mix scene.");
  };
  document.querySelectorAll("[data-project-track-scene-apply]").forEach(button=>button.onclick=async()=>{
   const id=button.dataset.projectTrackSceneApply,latest=projects.find(item=>item.id===currentProjectId);
   const scene=(latest?.metadata?.projectTrackScenes||[]).find(item=>item.id===id);if(!scene)return;
   const settings={};
   for(const item of audioItems){
    const state={gainDb:0,pan:0,mute:false,solo:false,...window.ITZIK_PROJECT_TRACKS.effectDefaults,...(scene.settings?.[item.id]||{})};
    window.ITZIK_PROJECT_TRACKS.setTrack(item.id,state);
    settings[item.id]=window.ITZIK_PROJECT_TRACKS.getTrack(item.id);
    const gain=document.querySelector('[data-project-track-gain="'+item.id+'"]'),pan=document.querySelector('[data-project-track-pan="'+item.id+'"]'),width=document.querySelector('[data-project-track-width="'+item.id+'"]');
    if(gain)gain.value=String(settings[item.id].gainDb);
    if(pan)pan.value=String(settings[item.id].pan);
    if(width)width.value=String(settings[item.id].stereoWidth);
    refresh(item.id);refreshTrackFx(item.id);
   }
   const baseSolo=window.ITZIK_PROJECT_TRACKS.setBaseSolo(scene.baseSolo===true);
   const master=window.ITZIK_PROJECT_TRACKS.setMasterDb(scene.masterDb);
   if(masterSlider)masterSlider.value=String(master);
   if(masterValue)masterValue.textContent=master.toFixed(1)+" dB";
   const baseButton=$("#mixSolo");
   if(baseButton){baseButton.setAttribute("aria-pressed",String(baseSolo));baseButton.textContent=baseSolo?uiText("ביטול Solo","Unsolo"):"Solo";}
   const saved=await updateProjectMetadata({projectTrackMixSettings:settings,projectBaseSolo:baseSolo,projectTrackMasterDb:master});
   if(status)status.textContent=saved?uiText("מצב המיקס נטען ונשמר בפרויקט.","Mix scene loaded and saved to the project."):uiText("המצב נטען, אך השמירה בענן נכשלה.","Scene loaded, but cloud saving failed.");
  });
  document.querySelectorAll("[data-project-track-scene-delete]").forEach(button=>button.onclick=async()=>{
   const id=button.dataset.projectTrackSceneDelete,latest=projects.find(item=>item.id===currentProjectId);
   const scene=(latest?.metadata?.projectTrackScenes||[]).find(item=>item.id===id);if(!scene)return;
   if(!confirm(uiText("למחוק את מצב המיקס \""+scene.name+"\"?","Delete mix scene \""+scene.name+"\"?")))return;
   const next=(latest.metadata.projectTrackScenes||[]).filter(item=>item.id!==id);
   if(await updateProjectMetadata({projectTrackScenes:next}))render("mix");
   else if(status)status.textContent=uiText("מחיקת מצב המיקס נכשלה.","Could not delete the mix scene.");
  });
  const resetButton=$("#projectTracksReset");
  if(resetButton)resetButton.onclick=async()=>{
   if(!confirm(uiText("לאפס את עוצמת הערוצים, Pan, השתקה ו-Solo?","Reset track levels, pan, mute and Solo?")))return;
   const settings={};
   for(const item of audioItems){
    window.ITZIK_PROJECT_TRACKS.setTrack(item.id,{gainDb:0,pan:0,mute:false,solo:false,...window.ITZIK_PROJECT_TRACKS.effectDefaults});
    settings[item.id]=window.ITZIK_PROJECT_TRACKS.getTrack(item.id);
    const gain=document.querySelector('[data-project-track-gain="'+item.id+'"]');
    const pan=document.querySelector('[data-project-track-pan="'+item.id+'"]');
    if(gain)gain.value="0";if(pan)pan.value="0";refresh(item.id);refreshTrackFx(item.id);
   }
   window.ITZIK_PROJECT_TRACKS.setBaseSolo(false);
   const baseButton=$("#mixSolo");
   if(baseButton){baseButton.setAttribute("aria-pressed","false");baseButton.textContent="Solo";}
   const master=window.ITZIK_PROJECT_TRACKS.setMasterDb(-1.5);
   if(masterSlider)masterSlider.value=String(master);
   if(masterValue)masterValue.textContent=master.toFixed(1)+" dB";
   const saved=await updateProjectMetadata({projectTrackMixSettings:settings,projectBaseSolo:false,projectTrackMasterDb:master});
   if(status)status.textContent=saved?uiText("המיקסר אופס ונשמר בפרויקט.","Mixer reset and saved to the project."):uiText("המיקסר אופס, אך השמירה בענן נכשלה.","Mixer reset, but cloud saving failed.");
  };
  document.querySelectorAll("[data-project-track-rename]").forEach(button=>button.onclick=async()=>{
   const id=button.dataset.projectTrackRename,latest=projects.find(item=>item.id===currentProjectId);
   const track=(latest?.metadata?.projectTracks||[]).find(item=>item.id===id);if(!track)return;
   const entered=prompt(uiText("הקלד שם חדש לערוץ:","Enter a new track name:"),track.name);
   if(entered===null)return;
   const name=entered.trim().slice(0,80);
   if(!name){if(status)status.textContent=uiText("שם הערוץ לא יכול להיות ריק.","Track name cannot be empty.");return;}
   if(name===track.name)return;
   const updated=(latest.metadata.projectTracks||[]).map(item=>item.id===id?{...item,name}:item);
   if(await updateProjectMetadata({projectTracks:updated}))render("mix");
   else if(status)status.textContent=uiText("שינוי שם הערוץ לא נשמר.","Track rename could not be saved.");
  });
  const moveTrack=async(id,direction)=>{
   const latest=projects.find(item=>item.id===currentProjectId),ordered=[...(latest?.metadata?.projectTracks||[])];
   const index=ordered.findIndex(item=>item.id===id),target=index+direction;
   if(index<0||target<0||target>=ordered.length)return;
   [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
   if(await updateProjectMetadata({projectTracks:ordered}))render("mix");
   else if(status)status.textContent=uiText("שינוי סדר הערוצים לא נשמר.","Track order could not be saved.");
  };
  document.querySelectorAll("[data-project-track-up]").forEach(button=>button.onclick=()=>moveTrack(button.dataset.projectTrackUp,-1));
  document.querySelectorAll("[data-project-track-down]").forEach(button=>button.onclick=()=>moveTrack(button.dataset.projectTrackDown,1));
  const play=$("#projectTracksPlay"),pause=$("#projectTracksPause"),stop=$("#projectTracksStop");
  if(play)play.onclick=async()=>{try{await window.ITZIK_PROJECT_TRACKS.play();if(status)status.textContent=uiText("מנגן את הקובץ הראשי ואת כל הערוצים הנוספים בסנכרון.","Playing the original file and all added tracks in sync.");}catch(error){if(status)status.textContent=error.message;}};
  if(pause)pause.onclick=()=>window.ITZIK_PROJECT_TRACKS.pause();
  if(stop)stop.onclick=()=>window.ITZIK_PROJECT_TRACKS.stop();
  const exportButton=$("#projectTracksExport");
  if(exportButton)exportButton.onclick=async()=>{
   exportButton.disabled=true;if(status)status.textContent=uiText("מחשב את המיקס המשולב...","Rendering the combined mix...");
   try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext,context=new AudioCtx();let base;
    try{base=await context.decodeAudioData((await currentFile.arrayBuffer()).slice(0));if(window.ITZIK_MIXER?.hasProcessing?.())base=await window.ITZIK_MIXER.renderOffline(base,window.ITZIK_MIXER.getSettings());}
    finally{await context.close().catch(()=>{});}
    const rendered=await window.ITZIK_PROJECT_TRACKS.renderMix(base),blob=encodeWav(rendered,24),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=(currentFile.name.replace(/\.[^.]+$/,"")||"itzik-sound")+"-multitrack-mix.wav";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    if(status)status.textContent=uiText("המיקס המשולב מוכן. קובץ WAV באיכות 24-bit הורד למחשב.","Combined mix exported as a 24-bit WAV file.");
   }catch(error){if(status)status.textContent=error.message||uiText("ייצוא המיקס נכשל.","Mix export failed.");}
   finally{exportButton.disabled=false;}
  };
  document.querySelectorAll("[data-project-track-remove]").forEach(button=>button.onclick=async()=>{
   const id=button.dataset.projectTrackRemove,projectId=currentProjectId;
   const latest=projects.find(item=>item.id===projectId);
   const track=(latest?.metadata?.projectTracks||[]).find(item=>item.id===id);
   if(!track||!confirm(uiText("להסיר את הערוץ \""+track.name+"\" מהפרויקט?","Remove \""+track.name+"\" from this project?")))return;
   button.disabled=true;
   const next=(latest.metadata.projectTracks||[]).filter(item=>item.id!==id);
   const settings={...(latest.metadata?.projectTrackMixSettings||{})};
   delete settings[id];
   if(!await updateProjectMetadata({projectTracks:next,projectTrackMixSettings:settings})){
    button.disabled=false;
    if(status)status.textContent=uiText("לא ניתן לעדכן את הפרויקט. הערוץ לא הוסר.","Could not update the project. The track was not removed.");
    return;
   }
   const {error}=await supabaseClient.storage.from("project-audio").remove([track.storagePath]);
   if(error){
    const current=projects.find(item=>item.id===projectId);
    const pending=[...(current?.metadata?.projectTrackCleanupPending||[])];
    if(!pending.includes(track.storagePath)){
     pending.push(track.storagePath);
     await updateProjectMetadata({projectTrackCleanupPending:pending});
    }
    render("mix");
    const nextStatus=$("#projectTracksStatus");
    if(nextStatus)nextStatus.textContent=uiText("הערוץ הוסר מהפרויקט, אך מחיקת הקובץ באחסון נכשלה. המערכת תנסה שוב בטעינה הבאה.","The track was removed from the project, but storage deletion failed. The system will retry on the next load.");
    return;
   }
   render("mix");
   const nextStatus=$("#projectTracksStatus");
   if(nextStatus)nextStatus.textContent=uiText("הערוץ הוסר מהפרויקט ומהאחסון.","Track removed from the project and storage.");
  });
 }catch(error){if(status)status.textContent=error.message||uiText("טעינת הערוצים נכשלה.","Could not load project tracks.");}
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
 bindStemSeparation();
 bindStemAudioPlayers();
 bindProjectTracks();
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
 if(window.ITZIK_PROJECT_TRACKS?.isActive?.())settings.mute=window.ITZIK_PROJECT_TRACKS.getBaseMute();
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

const projectMetadataSaveQueues=new Map();
async function updateProjectMetadata(patch){
 if(!currentProjectId||!currentUser||!supabaseClient)return false;
 const projectId=currentProjectId,userId=currentUser.id;
 const previous=projectMetadataSaveQueues.get(projectId)||Promise.resolve();
 const operation=previous.catch(()=>false).then(async()=>{
  if(currentUser?.id!==userId)return false;
  const project=projects.find(item=>item.id===projectId);
  if(!project)return false;
  const metadata={...(project.metadata||{}),...patch};
  const {data,error}=await supabaseClient.from("projects").update({metadata})
   .eq("id",projectId).eq("user_id",userId).select("id").single();
  if(error||!data){console.error("Project metadata sync failed",{code:error?.code||"NO_ROW"});return false;}
  project.metadata=metadata;
  return true;
 });
 projectMetadataSaveQueues.set(projectId,operation);
 try{return await operation;}
 finally{if(projectMetadataSaveQueues.get(projectId)===operation)projectMetadataSaveQueues.delete(projectId);}
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
 const presetSelect=$("#mixPreset");
 const applyPreset=$("#applyMixPreset");
 if(presetSelect&&applyPreset)applyPreset.onclick=()=>{
  const preset=window.ITZIK_MIX_PRESETS?.get?.(presetSelect.value);
  if(!preset)return;
  const next=window.ITZIK_MIXER.apply(preset);
  document.querySelectorAll("[data-mix-control]").forEach(input=>{
   const key=input.dataset.mixControl;
   input.value=next[key];
   const output=$(`[data-mix-value="${key}"]`);
   if(output)output.textContent=`${Number(next[key]).toFixed(key==="ratio"?1:0)}${key==="ratio"?":1":["gainDb","masterDb","low","mid","high","threshold"].includes(key)?" dB":""}`;
  });
  const muteButton=$("#mixMute");
  if(muteButton){muteButton.setAttribute("aria-pressed",String(next.mute));muteButton.textContent=next.mute?uiText("ביטול השתקה","Unmute"):uiText("השתק","Mute");}
  const abButton=$("#mixAB");
  if(abButton)abButton.setAttribute("aria-pressed",String(next.bypass));
  scheduleMixSettingsSave();
  const status=$("#mixSaveStatus");
  if(status)status.textContent=uiText("הפרופיל הוחל. ניתן להמשיך לכוון ידנית.","Profile applied. You can continue fine-tuning manually.");
 };
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
 const solo=$("#mixSolo");
 if(solo)solo.onclick=async()=>{
  const engine=window.ITZIK_PROJECT_TRACKS;
  if(!engine?.isActive?.())return;
  const active=engine.setBaseSolo(!engine.getBaseSolo());
  solo.setAttribute("aria-pressed",String(active));
  solo.textContent=active?uiText("ביטול Solo","Unsolo"):"Solo";
  document.querySelectorAll("[data-project-track-solo]").forEach(button=>button.setAttribute("aria-pressed","false"));
  const settings=engine.getSettings();
  const saved=await updateProjectMetadata({projectBaseSolo:active,projectTrackMixSettings:settings});
  if(!saved){const status=$("#projectTracksStatus");if(status)status.textContent=uiText("מצב Solo פעיל, אך השמירה בענן נכשלה.","Solo is active, but cloud saving failed.");}
 };
 const mute=$("#mixMute");
 if(mute)mute.onclick=()=>{
  const projectTracks=window.ITZIK_PROJECT_TRACKS;
  const muted=projectTracks?.isActive?.()
   ?projectTracks.setBaseMute(!projectTracks.getBaseMute())
   :window.ITZIK_MIXER.apply({mute:!window.ITZIK_MIXER.getSettings().mute}).mute;
  mute.setAttribute("aria-pressed",String(muted));
  mute.textContent=muted?uiText("ביטול השתקה","Unmute"):uiText("השתק","Mute");
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

async function prepareRoexAudio(file){
 const extension=file?.name?.split(".").pop()?.toLowerCase();
 if(["mp3","wav","flac"].includes(extension))return file;
 if(!["m4a","aac"].includes(extension))throw new Error(uiText("RoEx תומך בקובצי MP3, WAV ו-FLAC. ניתן להמיר M4A או AAC ל-WAV לפני השליחה.","RoEx accepts MP3, WAV, and FLAC. M4A or AAC must be converted to WAV first."));
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 if(!AudioCtx)throw new Error(uiText("הדפדפן אינו תומך בהמרת M4A/AAC ל-WAV.","This browser cannot convert M4A/AAC to WAV."));
 let context;
 try{
  context=new AudioCtx();
  const decoded=await context.decodeAudioData((await file.arrayBuffer()).slice(0));
  if(decoded.duration>600)throw new Error(uiText("המרת M4A/AAC ל-RoEx מוגבלת ל-10 דקות.","M4A/AAC conversion for RoEx is limited to 10 minutes."));
  const wav=encodeWav(decoded);
  if(wav.size>50*1024*1024)throw new Error(uiText("קובץ ה-WAV שנוצר גדול מ-50MB. נסה קובץ קצר יותר או WAV/MP3.","The converted WAV exceeds 50 MB. Try a shorter file or use WAV/MP3."));
  const name=(file.name.replace(/\.[^.]+$/,"")||"audio")+".wav";
  return new File([wav],name,{type:"audio/wav"});
 }finally{
  if(context)await context.close().catch(()=>{});
 }
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
   if(!["mp3","wav","m4a","aac","flac"].includes(ext))throw new Error("מאסטרינג תומך בקובצי MP3, WAV, M4A, AAC או FLAC בלבד.");
   if(!currentProjectId)throw new Error(uiText("יש לשמור את הפרויקט בענן לפני יצירת Preview.","Save the project to the cloud before creating a preview."));
   status.textContent=uiText("מכין את קובץ האודיו ל-RoEx...","Preparing audio for RoEx...");
   const roexFile=await prepareRoexAudio(currentFile);
   const form=new FormData(); form.append("audio",roexFile);
   form.append("projectId",currentProjectId);
   form.append("musicalStyle",$("#masterStyle").value);
   form.append("desiredLoudness",$("#masterLoudness").value);
   form.append("sampleRate",$("#masterSampleRate").value);
   status.textContent=uiText("מעלה קובץ ומבקש Preview...","Uploading track and requesting preview...");
   const response=await fetch("/api/roex/mastering-preview",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`},body:form});
   const result=await response.json(); if(!response.ok)throw new Error(uiText("יצירת Preview נכשלה.","Could not create the preview."));
   const taskSaved=await saveMasteringTask(result.taskId,{musicalStyle:$("#masterStyle").value,desiredLoudness:$("#masterLoudness").value,sampleRate:$("#masterSampleRate").value});
   setMasterTaskLabel(result.taskId);
   if(!taskSaved){
    status.textContent=uiText("המשימה נוצרה, אך מזהה המשימה לא נשמר בענן. לא ניתן לשלוף Preview עד שהשמירה תצליח.","The task was created, but its ID was not saved. Preview retrieval is blocked until it syncs.");
    const paidButton=$("#masterFinalBtn");if(paidButton){paidButton.disabled=true;paidButton.title=uiText("לא ניתן להפעיל עד שמזהה המשימה יישמר בפרויקט.","Unavailable until the task ID is saved to the project.");}
    return;
   }
   await pollMasteringPreview(result.taskId,data.session.access_token,status);
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


async function bindStemAudioPlayers(){
 const mixer=$("#stemMixer");
 if(!mixer||!currentProjectId)return;
 const project=projects.find(p=>p.id===currentProjectId);
 const paths=project?.metadata?.stemSeparation?.stems||{};
 const settings=project?.metadata?.stemMixSettings||{};
 const tracks=[];
 const status=$("#stemMixerStatus");
 try{
  await window.ITZIK_STEM_MIXER?.destroy?.();
  for(const [name,path] of Object.entries(paths)){
   const audioPlayer=$(`[data-stem-audio="${name}"]`);
   const download=$(`[data-stem-download="${name}"]`);
   if(!audioPlayer)continue;
   const {data,error}=await supabaseClient.storage.from("project-audio").createSignedUrl(path,3600);
   if(error||!data?.signedUrl)throw new Error(uiText(`לא ניתן לטעון את הערוץ ${name}.`,`Could not load the ${name} stem.`));
   audioPlayer.src=data.signedUrl;
   audioPlayer.load();
   if(download)download.href=data.signedUrl;
   const saved=settings[name]||{};
   const gain=$(`[data-stem-gain="${name}"]`),pan=$(`[data-stem-pan="${name}"]`);
   if(gain)gain.value=Number.isFinite(saved.gainDb)?saved.gainDb:0;
   if(pan)pan.value=Number.isFinite(saved.pan)?saved.pan:0;
   tracks.push({id:name,audio:audioPlayer,settings:{...saved,gainDb:gain?Number(gain.value):0,pan:pan?Number(pan.value):0,mute:saved.mute===true,solo:saved.solo===true}});
  }
  if(!tracks.length){if(status)status.textContent=uiText("לא נמצאו ערוצים שמורים בפרויקט.","No saved stems were found in this project.");return;}
  await window.ITZIK_STEM_MIXER.init(tracks,project?.metadata?.stemMasterDb??0);
  const masterInput=$("#stemMasterGain"),masterOutput=$("#stemMasterValue");
  if(masterInput){masterInput.value=window.ITZIK_STEM_MIXER.getMasterDb();if(masterOutput)masterOutput.textContent=window.ITZIK_STEM_MIXER.getMasterDb().toFixed(1)+" dB";}
  const refresh=()=>tracks.forEach(track=>{
   const gain=$(`[data-stem-gain-value="${track.id}"]`),pan=$(`[data-stem-pan-value="${track.id}"]`);
   const state=window.ITZIK_STEM_MIXER.getTrack(track.id);
   if(gain)gain.textContent=`${state.gainDb.toFixed(1)} dB`;
   if(pan)pan.textContent=window.ITZIK_STEM_MIXER.formatPan(state.pan).replace("C",uiText("מרכז","Center"));
   const mute=$(`[data-stem-mute="${track.id}"]`),solo=$(`[data-stem-solo="${track.id}"]`);
   if(mute){mute.setAttribute("aria-pressed",String(state.mute));mute.textContent=state.mute?uiText("בטל השתקה","Unmute"):uiText("השתק","Mute");}
   if(solo)solo.setAttribute("aria-pressed",String(state.solo));
  });
  const save=async()=>{const next=window.ITZIK_STEM_MIXER.getSettings();if(!await updateProjectMetadata({stemMixSettings:next,stemMasterDb:window.ITZIK_STEM_MIXER.getMasterDb()})&&status)status.textContent=uiText("השינויים פעילים, אך השמירה בענן נכשלה.","Changes are active, but cloud saving failed.");};
  if(masterInput)masterInput.oninput=()=>{const value=window.ITZIK_STEM_MIXER.setMasterDb(Number(masterInput.value));if(masterOutput)masterOutput.textContent=value.toFixed(1)+" dB";save();};
  tracks.forEach(track=>{
   const state=window.ITZIK_STEM_MIXER.getTrack(track.id);
   for(const key of ["eqLow","eqMid","eqHigh","compThreshold","compRatio","reverbMix","delayMix","delayTime","delayFeedback"]){
    const input=document.querySelector('[data-stem-fx="'+key+':'+track.id+'"]');
    const output=document.querySelector('[data-stem-fx-value="'+key+':'+track.id+'"]');
    if(input)input.value=state[key];
    const display=value=>key==="compRatio"?Number(value).toFixed(1)+":1":key==="delayTime"?Math.round(value*1000)+" ms":key==="delayFeedback"||key.endsWith("Mix")?Math.round(value*100)+"%":Number(value).toFixed(1)+" dB";
    if(output)output.textContent=display(state[key]);
    if(input)input.oninput=()=>{const value=Number(input.value);window.ITZIK_STEM_MIXER.setTrack(track.id,{[key]:value});if(output)output.textContent=display(value);save();};
   }
  });
  tracks.forEach(track=>{
   const gain=$(`[data-stem-gain="${track.id}"]`),pan=$(`[data-stem-pan="${track.id}"]`);
   if(gain)gain.oninput=()=>{window.ITZIK_STEM_MIXER.setTrack(track.id,{gainDb:Number(gain.value)});refresh();save();};
   if(pan)pan.oninput=()=>{window.ITZIK_STEM_MIXER.setTrack(track.id,{pan:Number(pan.value)});refresh();save();};
   const mute=$(`[data-stem-mute="${track.id}"]`),solo=$(`[data-stem-solo="${track.id}"]`);
   if(mute)mute.onclick=()=>{const state=window.ITZIK_STEM_MIXER.getTrack(track.id);window.ITZIK_STEM_MIXER.setTrack(track.id,{mute:!state.mute});refresh();save();};
   if(solo)solo.onclick=()=>{const state=window.ITZIK_STEM_MIXER.getTrack(track.id);window.ITZIK_STEM_MIXER.setTrack(track.id,{solo:!state.solo});refresh();save();};
  });
  const play=$("#stemPlay"),pause=$("#stemPause"),stop=$("#stemStop");
  if(play)play.onclick=async()=>{try{await window.ITZIK_STEM_MIXER.play();if(status)status.textContent=uiText("מנגן את כל הערוצים בסנכרון.","Playing all tracks in sync.");}catch(e){if(status)status.textContent=e.message;}};
  if(pause)pause.onclick=()=>window.ITZIK_STEM_MIXER.pause();
  if(stop)stop.onclick=()=>window.ITZIK_STEM_MIXER.stop();
  const exportButton=$("#stemExport"),download=$("#stemMixDownload");
  if(exportButton)exportButton.onclick=async()=>{
   exportButton.disabled=true;
   if(status)status.textContent=uiText("טוען ומחשב את כל הערוצים לייצוא...","Loading and rendering all tracks for export...");
   try{
    const rendered=await window.ITZIK_STEM_MIXER.renderMix();
    const blob=encodeWav(rendered,24);
    if(window.__itzikStemMixUrl)URL.revokeObjectURL(window.__itzikStemMixUrl);
    window.__itzikStemMixUrl=URL.createObjectURL(blob);
    if(download){download.href=window.__itzikStemMixUrl;download.hidden=false;}
    if(status)status.textContent=uiText("המיקס המשולב מוכן. אפשר להוריד קובץ WAV באיכות 24-bit.","Combined mix is ready. Download the 24-bit WAV.");
   }catch(error){if(status)status.textContent=error.message||uiText("ייצוא המיקס נכשל.","Mix export failed.");}
   finally{exportButton.disabled=false;}
  };
  refresh();
  if(status)status.textContent=uiText(`${tracks.length} ערוצים נטענו. אפשר לנגן ולערוך כל ערוץ בנפרד.`,`${tracks.length} tracks loaded. You can play and edit each track independently.`);
 }catch(error){if(status)status.textContent=error.message||uiText("טעינת הערוצים נכשלה.","Could not load stems.");}
}
async function bindStemSeparation(){
 const button=$("#separateStemsBtn");
 if(!button||!currentFile||!currentProjectId)return;
 button.onclick=async()=>{
  button.disabled=true;
  const status=$("#stemSeparationStatus");
  try{
   const {data,error}=await supabaseClient.auth.getSession();
   const token=data?.session?.access_token;
   if(error||!token)throw new Error(uiText("צריך להתחבר מחדש לחשבון.","Please sign in again."));
   let meta=projects.find(p=>p.id===currentProjectId)?.metadata?.stemSeparation||{};
   let taskId=meta.taskId;
   if(!taskId){
    const mode=$("#stemSeparationMode")?.value||"four";
    const chargeText=uiText("הפרדת ערוצים צורכת 75 קרדיטים ב-RoEx, והחיוב מתבצע רק אם ההפרדה מצליחה. יש לך זכויות לעבד את הקובץ. להמשיך?","Stem separation reserves 75 RoEx credits and charges only if it succeeds. You confirm you have the rights to process this audio. Continue?");
    if(!confirm(chargeText))return;
    status.textContent=uiText("מכין את הקובץ ושולח ל-RoEx...","Preparing the audio and submitting to RoEx...");
    const prepared=await prepareRoexAudio(currentFile);
    const form=new FormData();
    form.append("audio",prepared);
    form.append("projectId",currentProjectId);
    form.append("separationMode",mode);
    form.append("confirmedCreditCharge","true");
    const response=await fetch("/api/roex/separate",{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form});
    const result=await response.json();
    if(!response.ok)throw new Error(result.message||uiText("לא ניתן להתחיל הפרדת ערוצים.","Could not start stem separation."));
    taskId=result.taskId;
    meta={...meta,taskId,separationMode:mode,createdAt:new Date().toISOString(),stems:{}};
    if(!await updateProjectMetadata({stemSeparation:meta}))throw new Error(uiText("המשימה נוצרה, אך שמירת המזהה בפרויקט נכשלה. לא ניתן להמשיך לשלוף ערוצים עד שהשמירה תצליח.","The task was created, but saving its ID to the project failed. Retrieval is blocked until it is saved."));
   }
   const names=meta.separationMode==="vocals_instrumental"?["vocals","instrumental"]:["vocals","drums","bass","other"];
   let complete=false;
   for(let attempt=0;attempt<60;attempt++){
    status.textContent=uiText(`ממתין להפרדה ב-RoEx... בדיקה ${attempt+1}/60`,`Waiting for RoEx separation... check ${attempt+1}/60`);
    const check=await fetch("/api/roex/separate-status",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({projectId:currentProjectId,taskId})});
    const state=await check.json();
    if(check.status===202){await new Promise(resolve=>setTimeout(resolve,5000));continue;}
    if(!check.ok)throw new Error(state.message||uiText("בדיקת מצב ההפרדה נכשלה.","Could not check separation status."));
    if(state.status==="failed")throw new Error(state.message||uiText("RoEx דיווח שההפרדה נכשלה.","RoEx reported that separation failed."));
    if(state.status==="complete"){complete=true;break;}
   }
   if(!complete){status.textContent=uiText("ההפרדה עדיין בעיבוד. אפשר ללחוץ שוב כדי להמשיך לבדוק את אותה משימה.","Separation is still processing. Click again to resume the same task.");return;}
   meta=projects.find(p=>p.id===currentProjectId)?.metadata?.stemSeparation||meta;
   const stored={...(meta.stems||{})};
   for(const name of names){
    if(stored[name])continue;
    status.textContent=uiText(`מוריד ושומר את הערוץ: ${name}...`,`Downloading and saving stem: ${name}...`);
    const fileResponse=await fetch("/api/roex/retrieve-stem",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({projectId:currentProjectId,taskId,stem:name})});
    if(!fileResponse.ok){let failure={};try{failure=await fileResponse.json();}catch{}throw new Error(failure.message||uiText("הורדת אחד הערוצים נכשלה.","One of the stem downloads failed."));}
    const blob=await fileResponse.blob();
    const path=`${currentUser.id}/${currentProjectId}/stems/${name}.wav`;
    const {error:uploadError}=await supabaseClient.storage.from("project-audio").upload(path,blob,{contentType:"audio/wav",upsert:true});
    if(uploadError)throw new Error(uiText(`שמירת הערוץ ${name} בענן נכשלה: ${uploadError.message}`,`Saving stem ${name} to cloud failed: ${uploadError.message}`));
    stored[name]=path;
    meta={...meta,taskId,separationMode:meta.separationMode,stems:stored,savedAt:new Date().toISOString()};
    if(!await updateProjectMetadata({stemSeparation:meta}))throw new Error(uiText("הערוץ נשמר באחסון, אך עדכון הפרויקט נכשל. אפשר לנסות שוב.","The stem was uploaded, but project metadata did not update. You can retry."));
   }
   status.textContent=uiText("ההפרדה הושלמה וכל הערוצים נשמרו בפרויקט שלך.","Separation complete. All stems are saved in your project.");
   render("mix");
  }catch(error){
   status.textContent=error.message||uiText("אירעה תקלה בהפרדת הערוצים.","Stem separation failed.");
  }finally{
   button.disabled=false;
  }
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
    status.textContent=uiText("מכין את קובץ האודיו ל-Mix Enhance...","Preparing audio for Mix Enhance...");
    const roexFile=await prepareRoexAudio(currentFile);
    const form=new FormData();form.append("audio",roexFile);form.append("musicalStyle",$("#mixStyle")?.value||"POP");form.append("projectId",currentProjectId);form.append("confirmedCreditCharge","true");
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
  const response=await fetch("/api/roex/mastering-preview-result",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify({taskId,projectId:currentProjectId})});
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

   if (!["mp3", "wav", "m4a", "aac", "flac"].includes(extension)) {
    status.textContent = "Mix AI תומך בקובצי MP3, WAV, M4A, AAC או FLAC בלבד.";
    return;
   }

   mixPreviewBtn.disabled = true;
   status.textContent = "מתחבר ל-RoEx ומעלה את הקובץ...";

   try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session?.access_token) {
     throw new Error("צריך להתחבר מחדש לחשבון.");
    }

    if(!currentProjectId){
    status.textContent="יש לשמור את הפרויקט בענן לפני יצירת Preview.";
    return;
   }
   status.textContent=uiText("מכין את קובץ האודיו ל-Mix AI...","Preparing audio for Mix AI...");
   const roexFile = await prepareRoexAudio(currentFile);
    const formData = new FormData();
    formData.append("audio", roexFile);
    formData.append("projectId", currentProjectId);
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

    const priorPreview=projects.find(p=>p.id===currentProjectId)?.metadata?.mixPreview||{};
    const savedPreview=await updateProjectMetadata({mixPreview:{...priorPreview,taskId:result.taskId,style:$("#mixStyle")?.value||"POP",createdAt:new Date().toISOString()}});
    if(!savedPreview)throw new Error("המשימה נוצרה, אך לא הצלחנו לשמור את מזהה המשימה בפרויקט. לא ניתן לשלוף Preview.");

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
      taskId: result.taskId,
      projectId: currentProjectId
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
 window.ITZIK_PROJECT_TRACKS?.destroy?.();
 clearProjectTrackAudioElements();
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

 await window.ITZIK_PROJECT_TRACKS?.destroy?.();
 clearProjectTrackAudioElements();

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

function hasActiveProjectTracks(){
 return Boolean(currentProjectId&&(projects.find(item=>item.id===currentProjectId)?.metadata?.projectTracks||[]).length>0&&window.ITZIK_PROJECT_TRACKS?.isActive?.());
}

function fmt(t){
 if(!Number.isFinite(t))return"0:00";
 return Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
}

function updateProjectTrackPlayer(){
 if(!hasActiveProjectTracks())return;
 const engine=window.ITZIK_PROJECT_TRACKS;
 const duration=engine.getDuration(),position=engine.getPlaybackPosition();
 $("#playBtn").textContent=engine.isPlaying()?"Ⅱ":"▶";
 $("#currentTime").textContent=fmt(position);
 $("#duration").textContent=fmt(duration);
 if(duration)$("#seek").value=Math.min(100,position/duration*100);
}

$("#playBtn").onclick=()=>{
 if(hasActiveProjectTracks()){
  if(window.ITZIK_PROJECT_TRACKS.isPlaying())window.ITZIK_PROJECT_TRACKS.pause();
  else window.ITZIK_PROJECT_TRACKS.play().catch(error=>{const status=$("#projectTracksStatus");if(status)status.textContent=error.message;});
  updateProjectTrackPlayer();
  return;
 }
 if(audio.paused)audio.play();
 else audio.pause();
};

audio.addEventListener("play",()=>{if(!hasActiveProjectTracks())$("#playBtn").textContent="Ⅱ";});
audio.addEventListener("pause",()=>{if(!hasActiveProjectTracks())$("#playBtn").textContent="▶";});
audio.addEventListener("loadedmetadata",()=>{
 if(!hasActiveProjectTracks())$("#duration").textContent=fmt(audio.duration);
 else updateProjectTrackPlayer();
});
audio.addEventListener("timeupdate",()=>{
 if(hasActiveProjectTracks()){updateProjectTrackPlayer();return;}
 $("#currentTime").textContent=fmt(audio.currentTime);
 if(audio.duration)$("#seek").value=audio.currentTime/audio.duration*100;
});
window.addEventListener("itzik-project-tracks-statechange",updateProjectTrackPlayer);
$("#seek").oninput=()=>{
 if(hasActiveProjectTracks()){
  const duration=window.ITZIK_PROJECT_TRACKS.getDuration();
  if(duration)window.ITZIK_PROJECT_TRACKS.seek(Number($("#seek").value)/100*duration);
  updateProjectTrackPlayer();
  return;
 }
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
 $("#wavBitDepth").hidden=mp3;
 $("#wavBitDepthLabel").hidden=mp3;
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
  if(buffer.duration>600)throw new Error(uiText("ייצוא מוגבל ל-10 דקות כדי לשמור על יציבות הדפדפן.","Exports are limited to 10 minutes to keep the browser stable."));
  if(window.ITZIK_MIXER?.hasProcessing?.()){
   status.textContent=uiText("מחשב את עיבוד המיקס לייצוא...","Rendering the processed mix for export...");
   buffer=await window.ITZIK_MIXER.renderOffline(buffer,window.ITZIK_MIXER.getSettings());
  }
  const multitrack = hasActiveProjectTracks();
  if(multitrack){
   status.textContent=uiText("משלב את כל הערוצים לייצוא...","Combining all project tracks for export...");
   buffer=await window.ITZIK_PROJECT_TRACKS.renderMix(buffer);
   if(buffer.duration>600)throw new Error(uiText("המיקס המשולב ארוך מ־10 דקות. הייצוא נעצר כדי לשמור על יציבות הדפדפן.","The combined mix exceeds 10 minutes. Export stopped to keep the browser stable."));
  }

  let blob;

  if(format==="wav"){
   blob=encodeWav(buffer,Number($("#wavBitDepth").value||24));
  }else{
   if(!window.lamejs)throw new Error("מנוע MP3 לא נטען. בדוק חיבור לאינטרנט והפעל מחדש את האתר.");
   blob=encodeMp3(buffer,Number($("#mp3Bitrate").value));
  }

  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=(currentFile.name.replace(/\.[^.]+$/,"")||"itzik-sound")+(multitrack?"-multitrack-mix":"")+"."+format;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url),30000);
  status.textContent=multitrack?uiText("המיקס המשולב מוכן להורדה.","The combined multitrack mix is ready to download."): "הקובץ מוכן! בדוק את תיקיית ההורדות.";
 }catch(err){
  console.error(err);
  status.textContent="הייצוא נכשל: "+(err.message||"שגיאה לא ידועה");
 }finally{
  button.disabled=false;
 }
}

function encodeWav(buffer,bitDepth=24){
 if(!window.ITZIK_WAV_ENCODER)throw new Error("מנוע WAV לא נטען. רענן את האתר ונסה שוב.");
 return window.ITZIK_WAV_ENCODER.encode(buffer,bitDepth);
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
            <b>ניתוח גובה צליל</b>
            <small>זיהוי תדר וסולם משוער</small>
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
          <b>ניתוח גובה צליל</b>
          <small>זיהוי תדר וסולם משוער</small>
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
const waveContainers = document.querySelectorAll(".itzik-wave-area, .itzik-mini-wave-area");
if (!waveContainers.length) return;
const multitrack = hasActiveProjectTracks(), engine = window.ITZIK_PROJECT_TRACKS;
const duration = multitrack ? engine.getDuration() : (audio.duration || 0);
const position = multitrack ? engine.getPlaybackPosition() : audio.currentTime;
const playing = multitrack ? engine.isPlaying() : !audio.paused;
const progress = duration ? Math.max(0, Math.min(1, position / duration)) : 0;
waveContainers.forEach(container => {
  const bars = container.querySelectorAll(".itzik-wave-bar");
  const activeIndex = Math.floor(progress * bars.length);
  bars.forEach((bar, index) => bar.classList.toggle("active", index < activeIndex));
});
const seek = $("#itzikWaveSeek"), current = $("#itzikWaveCurrent"), total = $("#itzikWaveDuration");
if (seek) seek.value = progress * 100;
if (current) current.textContent = waveTime(position);
if (total) total.textContent = waveTime(duration);
const playButton = $("#itzikWavePlay");
if (playButton) playButton.textContent = playing ? "Ⅱ" : "▶";
  }
window.refreshIzikWaveformwindow.refreshIzikWaveform = buildWaveform;
    
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
    const multitrack = hasActiveProjectTracks();
    const duration = multitrack ? window.ITZIK_PROJECT_TRACKS.getDuration() : audio.duration;
    if (!duration) return;
    const rect = miniWave.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    if (multitrack) window.ITZIK_PROJECT_TRACKS.seek(ratio * duration);
    else audio.currentTime = ratio * duration;
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
          try {
            if (hasActiveProjectTracks()) {
              if (window.ITZIK_PROJECT_TRACKS.isPlaying()) window.ITZIK_PROJECT_TRACKS.pause();
              else await window.ITZIK_PROJECT_TRACKS.play();
            } else if (audio.paused) await audio.play();
            else audio.pause();
          } catch (error) { console.error("Playback failed:", error); }
          updateWaveformProgress();
        };
      }

      if (seek) {
        seek.oninput = () => {
          if (hasActiveProjectTracks()) {
            const duration = window.ITZIK_PROJECT_TRACKS.getDuration();
            if (duration) window.ITZIK_PROJECT_TRACKS.seek(Number(seek.value) / 100 * duration);
          } else if (audio.duration) audio.currentTime = Number(seek.value) / 100 * audio.duration;
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
  window.addEventListener("itzik-project-tracks-statechange", updateWaveformProgress);

  // The maintenance administrator session is separate from Supabase login.
  async function initializeAdminMode() {
    const badge = $("#adminModeBadge");
    const exit = $("#adminModeExit");
    if (!badge || !exit) return;
    try {
      const response = await fetch("/api/admin/status", { credentials: "same-origin", cache: "no-store" });
      const state = await response.json();
      if (!response.ok || state.admin !== true) return;
      badge.hidden = false;
      exit.hidden = false;
      exit.addEventListener("click", async () => {
        exit.disabled = true;
        try {
          await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
        } finally {
          window.location.replace("/");
        }
      }, { once: true });
    } catch { /* Admin badge is non-critical to the studio. */ }
  }
  initializeAdminMode();


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

  const stemPaths=Object.values(p.metadata?.stemSeparation?.stems||{});
  const projectTrackPaths=(p.metadata?.projectTracks||[]).map(track=>track?.storagePath);
  const paths=[...new Set([p.storage_path,p.metadata?.reference?.storagePath,p.metadata?.mastering?.storagePath,...stemPaths,...projectTrackPaths].filter(path=>typeof path==="string"&&path.length>0))];
  let storageCleanupFailed=false;
  if(paths.length){
    const {error:storageError}=await supabaseClient.storage.from("project-audio").remove(paths);
    if(storageError){
      storageCleanupFailed=true;
      console.error("Project storage cleanup failed",{code:storageError.code||"UNKNOWN"});
    }
  }

  if (currentProjectId === id) {
    resetWorkspace();
  }

  await loadProjects();

  if (currentPage === "projects") {
    render("projects");
  }

  alert(storageCleanupFailed
    ? "הפרויקט הוסר מהרשימה, אך חלק מקובצי האודיו נשארו באחסון. ניתן לפנות לתמיכה לניקוי."
    : "הפרויקט וקובצי האודיו המשויכים אליו נמחקו בהצלחה.");
}
})();
