
(function () {
  "use strict";

  const LANGUAGES = {
    he: { name: "עברית", direction: "rtl" },
    en: { name: "English", direction: "ltr" },
  };

  const ROWS = [
    ["מסך ראשי","Home","الرئيسية","Главная","Inicio","Accueil","Startseite"],
    ["הסטודיו שלך, הסאונד שלך.","Your studio, your sound.","استوديوك، صوتك.","Твоя студия, твой звук.","Tu estudio, tu sonido.","Ton studio, ton son.","Dein Studio, dein Sound."],
    ["הסטודיו שלך","Your studio","استوديوك","Твоя студия","Tu estudio","Ton studio","Dein Studio"],
    ["פרויקט חדש","New project","مشروع جديد","Новый проект","Nuevo proyecto","Nouveau projet","Neues Projekt"],
    ["מיקס AI","AI Mixing","المزج بالذكاء الاصطناعي","AI-микширование","Mezcla con IA","Mixage IA","KI-Mixing"],
    ["מאסטרינג AI","AI Mastering","إتقان الصوت بالذكاء الاصطناعي","AI-мастеринг","Masterización con IA","Mastering IA","KI-Mastering"],
    ["תיקון זיופים","Pitch Correction","تصحيح النغمات","Коррекция высоты тона","Corrección de tono","Correction de tonalité","Tonhöhenkorrektur"],
    ["רעיונות מוזיקליים","Musical Ideas","أفكار موسيقية","Музыкальные идеи","Ideas musicales","Idées musicales","Musikalische Ideen"],
    ["סטודיו רפרנסים","Reference Studio","استوديو المقارنة","Студия сравнения","Estudio de referencia","Studio de référence","Referenzstudio"],
    ["איצקו AI","ITZKO AI","إيتسكو AI","ITZKO AI","ITZKO AI","ITZKO AI","ITZKO AI"],
    ["הפרויקטים שלי","My Projects","مشاريعي","Мои проекты","Mis proyectos","Mes projets","Meine Projekte"],
    ["הגדרות ושפה","Settings and Language","الإعدادات واللغة","Настройки и язык","Configuración e idioma","Paramètres et langue","Einstellungen und Sprache"],
    ["עזרה ותמיכה","Help and Support","المساعدة والدعم","Помощь и поддержка","Ayuda y soporte","Aide et assistance","Hilfe und Support"],
    ["עזרה","Help","مساعدة","Помощь","Ayuda","Aide","Hilfe"],
    ["יציאה","Sign out","تسجيل الخروج","Выйти","Cerrar sesión","Déconnexion","Abmelden"],
    ["התנתקות","Sign out","تسجيل الخروج","Выйти","Cerrar sesión","Déconnexion","Abmelden"],
    ["בחירת שפה","Choose Language","اختيار اللغة","Выбор языка","Elegir idioma","Choisir la langue","Sprache auswählen"],
    ["בחר את השפה שבה תרצה להשתמש ב־ITZIK SOUND.","Choose the language you want to use in ITZIK SOUND.","اختر اللغة التي تريد استخدامها في ITZIK SOUND.","Выберите язык для ITZIK SOUND.","Elige el idioma que deseas usar en ITZIK SOUND.","Choisissez la langue à utiliser dans ITZIK SOUND.","Wähle die Sprache für ITZIK SOUND."],
    ["שמור שפה","Save Language","حفظ اللغة","Сохранить язык","Guardar idioma","Enregistrer la langue","Sprache speichern"],
    ["השפה נשמרה בהצלחה! כדי להשלים את התרגום נמשיך לחבר את המסכים.","Language saved! More screen translations will be added.","تم حفظ اللغة بنجاح!","Язык сохранён!","¡Idioma guardado!","Langue enregistrée !","Sprache gespeichert!"],
    ["שמירת פרויקטים","Project Storage","حفظ المشاريع","Хранение проектов","Almacenamiento de proyectos","Stockage des projets","Projektspeicherung"],
    ["הפרויקטים וקובצי האודיו נשמרים בחשבון שלך בענן פרטי, בכפוף למגבלות האחסון של התוכנית.","Your projects and audio files are stored in your private cloud account, subject to your plan's storage limits.","يتم حفظ مشاريعك وملفات الصوت في حسابك السحابي الخاص.","Deine Projekte und Audiodateien werden in deinem privaten Cloud-Konto gespeichert.","Tus proyectos y archivos de audio se guardan en tu cuenta privada en la nube.","Tes projets et fichiers audio sont enregistrés dans ton cloud privé.","Deine Projekte und Audiodateien werden in deinem privaten Cloud-Konto gespeichert."],
    ["WELCOME TO YOUR STUDIO","WELCOME TO YOUR STUDIO","مرحباً بك في الاستوديو","WILLKOMMEN IN DEINEM STUDIO","BIENVENIDO A TU ESTUDIO","BIENVENUE DANS TON STUDIO","WILLKOMMEN IN DEINEM STUDIO"],
    ["בוא ניצור משהו שנשמע גדול.","Let's create something that sounds big.","لنصنع شيئاً بصوت رائع.","Давай создадим нечто грандиозное.","Vamos a crear algo increíble.","Créons quelque chose de grandiose.","Lass uns etwas Großartiges erschaffen."],
    ["כל הכלים שלך להפקה מוזיקלית, במקום אחד.","All your music production tools in one place.","كل أدوات إنتاج الموسيقى في مكان واحد.","Все инструменты для создания музыки в одном месте.","Todas tus herramientas de producción musical en un solo lugar.","Tous tes outils de production musicale au même endroit.","Alle deine Musikproduktionswerkzeuge an einem Ort."],
    ["העלה שיר והתחל לעבוד עם ITZIK SOUND.","Upload a song and start working with ITZIK SOUND.","ارفع أغنية وابدأ العمل مع ITZIK SOUND.","Загрузи песню и начни работать с ITZIK SOUND.","Sube una canción y empieza a trabajar con ITZIK SOUND.","Importe un morceau et commence à travailler avec ITZIK SOUND.","Lade einen Song hoch und beginne mit ITZIK SOUND zu arbeiten."],
    ["גרור קובץ לכאן או לחץ לבחירה","Drag a file here or click to choose","اسحب ملفاً إلى هنا أو اضغط للاختيار","Перетащите файл сюда или нажмите для выбора","Arrastra un archivo aquí o haz clic para elegir","Glisse un fichier ici ou clique pour choisir","Ziehe eine Datei hierher oder klicke zum Auswählen"],
    ["בחירת קובץ מהמחשב","Choose file from computer","اختيار ملف من الكمبيوتر","Выбрать файл с компьютера","Elegir archivo del ordenador","Choisir un fichier sur l’ordinateur","Datei vom Computer auswählen"],
    ["בחר מאיפה להתחיל","Choose where to start","اختر من أين تبدأ","Выбери, с чего начать","Elige por dónde empezar","Choisis par où commencer","Wähle, womit du beginnen möchtest"],
    ["איזון ועיצוב הסאונד של השיר","Balance and shape your song's sound","موازنة صوت الأغنية وتشكيله","Балансировка и настройка звука песни","Equilibra y da forma al sonido de tu canción","Équilibre et façonne le son de ton morceau","Balance und forme den Klang deines Songs"],
    ["ליטוש והכנה להפצה","Polishing and preparation for release","تحسين الصوت والاستعداد للنشر","Обработка и подготовка к выпуску","Pulido y preparación para publicar","Finition et préparation à la diffusion","Feinschliff und Vorbereitung zur Veröffentlichung"],
    ["דיוק קולי בשליטה שלך","Vocal precision under your control","دقة صوتية تحت تحكمك","Точная настройка вокала под твоим контролем","Precisión vocal bajo tu control","Précision vocale sous ton contrôle","Gesangspräzision unter deiner Kontrolle"],
    ["הקובץ בפרויקט","Project file","ملف المشروع","Файл проекта","Archivo del proyecto","Fichier du projet","Projektdatei"],
    ["עדיין לא הועלה שיר","No song uploaded yet","لم يتم رفع أغنية بعد","Песня ещё не загружена","Todavía no se ha subido ninguna canción","Aucun morceau importé","Noch kein Song hochgeladen"],
    ["העלה קובץ במסך הראשי כדי לעבוד איתו כאן.","Upload a file on the home screen to work with it here.","ارفع ملفاً من الصفحة الرئيسية للعمل عليه هنا.","Загрузи файл на главной странице, чтобы работать с ним здесь.","Sube un archivo en la página principal para trabajar con él aquí.","Importe un fichier depuis l’accueil pour travailler dessus ici.","Lade auf der Startseite eine Datei hoch, um hier damit zu arbeiten."],
    ["העלאת שיר","Upload a song","رفع أغنية","Загрузить песню","Subir una canción","Importer un morceau","Song hochladen"],
    ["העבודה שלך","Your workspace","مساحة عملك","Твоё рабочее пространство","Tu espacio de trabajo","Ton espace de travail","Dein Arbeitsbereich"],
    ["קודם נעלה שיר","First, upload a song","ارفع أغنية أولاً","Сначала загрузи песню","Primero sube una canción","Importe d’abord un morceau","Lade zuerst einen Song hoch"],
    ["אותו קובץ יהיה זמין בכל כלי הסטודיו.","The same file will be available in every studio tool.","سيكون الملف نفسه متاحاً في جميع أدوات الاستوديو.","Этот файл будет доступен во всех инструментах студии.","El mismo archivo estará disponible en todas las herramientas del estudio.","Le même fichier sera disponible dans tous les outils du studio.","Dieselbe Datei steht in allen Studiowerkzeugen zur Verfügung."],
    ["הפרויקטים שלך שמורים בחשבון וניתנים לפתיחה מכל מכשיר.","Your projects are saved to your account and can be opened from any device.","مشاريعك محفوظة في حسابك ويمكن فتحها من أي جهاز.","Твои проекты сохранены в аккаунте и доступны с любого устройства.","Tus proyectos se guardan en tu cuenta y puedes abrirlos desde cualquier dispositivo.","Tes projets sont enregistrés dans ton compte et accessibles depuis n’importe quel appareil.","Deine Projekte werden in deinem Konto gespeichert und sind von jedem Gerät aus verfügbar."],
    ["עדיין אין פרויקטים שמורים","No saved projects yet","لا توجد مشاريع محفوظة بعد","Пока нет сохранённых проектов","Todavía no hay proyectos guardados","Aucun projet enregistré pour le moment","Noch keine gespeicherten Projekte"],
    ["ללא קובץ","No file","بدون ملف","Без файла","Sin archivo","Aucun fichier","Keine Datei"],
    ["פתיחה","Open","فتح","Открыть","Abrir","Ouvrir","Öffnen"],
    ["חזרה למסך הראשי","Back to Home","العودة إلى الرئيسية","Вернуться на главную","Volver al inicio","Retour à l’accueil","Zurück zur Startseite"],
    ["העלה שיר במסך הראשי כדי ליצור פרויקט ראשון. הוא יישמר בחשבון שלך.","Upload a song on the home screen to create your first project. It will be saved to your account.","ارفع أغنية من الصفحة الرئيسية لإنشاء مشروعك الأول. سيتم حفظه في حسابك.","Загрузи песню на главной странице, чтобы создать первый проект. Он будет сохранён в аккаунте.","Sube una canción en la página principal para crear tu primer proyecto. Se guardará en tu cuenta.","Importe un morceau depuis l’accueil pour créer ton premier projet. Il sera enregistré dans ton compte.","Lade auf der Startseite einen Song hoch, um dein erstes Projekt zu erstellen. Es wird in deinem Konto gespeichert."],
    ["איך מתחילים?","How to get started?","كيف تبدأ؟","Как начать?","¿Cómo empezar?","Comment commencer ?","Wie fängt man an?"],
    ["האם ה-AI כבר מחובר?","Is AI connected yet?","هل الذكاء الاصطناعي متصل؟","Подключён ли уже ИИ?","¿La IA ya está conectada?","L’IA est-elle déjà connectée ?","Ist die KI bereits verbunden?"],
    ["האם הפרויקטים פרטיים?","Are projects private?","هل المشاريع خاصة؟","Проекты приватные?","¿Los proyectos son privados?","Les projets sont-ils privés ?","Sind die Projekte privat?"],
    ["חשבון מחובר","Account connected","الحساب متصل","Аккаунт подключён","Cuenta conectada","Compte connecté","Konto verbunden"],
    ["עדיין לא נבחר שיר","No song selected yet","لم يتم اختيار أغنية بعد","Песня ещё не выбрана","Todavía no hay ninguna canción seleccionada","Aucun morceau sélectionné","Noch kein Song ausgewählt"],
    ["העלה קובץ כדי להתחיל","Upload a file to get started","ارفع ملفاً للبدء","Загрузи файл, чтобы начать","Sube un archivo para empezar","Importe un fichier pour commencer","Lade eine Datei hoch, um zu beginnen"],
    ["ממתין לקובץ","Waiting for a file","في انتظار ملف","Ожидание файла","Esperando un archivo","En attente d’un fichier","Warte auf eine Datei"],
    ["ייצוא","Export","تصدير","Экспорт","Exportar","Exporter","Exportieren"],
    ["ייצוא השיר","Export song","تصدير الأغنية","Экспорт песни","Exportar canción","Exporter le morceau","Song exportieren"],
    ["בחר פורמט להורדת קובץ האודיו שהעלית.","Choose a format to download your uploaded audio file.","اختر تنسيقاً لتنزيل ملف الصوت الذي رفعته.","Выбери формат для скачивания загруженного аудиофайла.","Elige un formato para descargar el archivo de audio que subiste.","Choisis un format pour télécharger ton fichier audio importé.","Wähle ein Format zum Herunterladen deiner Audiodatei."],
    ["פורמט קובץ","File format","تنسيق الملف","Формат файла","Formato de archivo","Format du fichier","Dateiformat"],
    ["איכות MP3","MP3 quality","جودة MP3","Качество MP3","Calidad MP3","Qualité MP3","MP3-Qualität"],
    ["הורדת הקובץ","Download file","تنزيل الملف","Скачать файл","Descargar archivo","Télécharger le fichier","Datei herunterladen"],
    ["שליחה","Send","إرسال","Отправить","Enviar","Envoyer","Senden"],
    ["כתוב לאיצקו מה תרצה לשפר...","Tell ITZKO what you'd like to improve...","اكتب لإيتسكو ما الذي تريد تحسينه...","Напиши ITZKO, что ты хочешь улучшить...","Escribe a ITZKO qué quieres mejorar...","Dis à ITZKO ce que tu souhaites améliorer...","Schreibe ITZKO, was du verbessern möchtest..."],
    ["איצקו חושב...","ITZKO is thinking...","إيتسكو يفكر...","ITZKO думает...","ITZKO está pensando...","ITZKO réfléchit...","ITZKO denkt nach..."],
    ["מוכן לניגון ולייצוא","Ready to play and export","جاهز للتشغيل والتصدير","Готово к воспроизведению и экспорту","Listo para reproducir y exportar","Prêt à lire et exporter","Bereit zum Abspielen und Exportieren"],
    ["הקובץ נטען, אך לא נשמר בענן","File loaded, but not saved to cloud","تم تحميل الملف لكنه لم يُحفظ في السحابة","Файл загружен, но не сохранён в облаке","Archivo cargado, pero no guardado en la nube","Fichier chargé, mais non enregistré dans le cloud","Datei geladen, aber nicht in der Cloud gespeichert"],
    ["שומר פרויקט בענן...","Saving project to cloud...","جارٍ حفظ المشروع في السحابة...","Сохранение проекта в облаке...","Guardando el proyecto en la nube...","Enregistrement du projet dans le cloud...","Projekt wird in der Cloud gespeichert..."],
    ["הפרויקט נשמר בענן","Project saved to cloud","تم حفظ المشروع في السحابة","Проект сохранён в облаке","Proyecto guardado en la nube","Projet enregistré dans le cloud","Projekt in der Cloud gespeichert"],
    ["טוען פרויקט מהענן...","Loading project from cloud...","جارٍ تحميل المشروع من السحابة...","Загрузка проекта из облака...","Cargando proyecto desde la nube...","Chargement du projet depuis le cloud...","Projekt wird aus der Cloud geladen..."],
    ["התחברות","Sign in","تسجيل الدخول","Войти","Iniciar sesión","Connexion","Anmelden"],
    ["הרשמה","Sign up","إنشاء حساب","Регистрация","Registrarse","Inscription","Registrieren"],
    ["ברוך הבא לאולפן שלך","Welcome to your studio","مرحباً بك في الاستوديو","Добро пожаловать в твою студию","Bienvenido a tu estudio","Bienvenue dans ton studio","Willkommen in deinem Studio"],
    ["כתובת אימייל","Email address","عنوان البريد الإلكتروني","Адрес электронной почты","Correo electrónico","Adresse e-mail","E-Mail-Adresse"],
    ["סיסמה","Password","كلمة المرور","Пароль","Contraseña","Mot de passe","Passwort"],
    ["המשך עם Google","Continue with Google","المتابعة باستخدام Google","Продолжить с Google","Continuar con Google","Continuer avec Google","Weiter mit Google"],
    ["או","OR","أو","ИЛИ","O","OU","ODER"],
    ["לפחות 8 תווים","At least 8 characters","8 أحرف على الأقل","Не менее 8 символов","Al menos 8 caracteres","Au moins 8 caractères","Mindestens 8 Zeichen"],
    ["האולפן שלי","My Studio","الاستوديو الخاص بي","Моя студия","Mi estudio","Mon studio","Mein Studio"],
    ["גרסה ראשונית","Initial version","الإصدار الأولي","Начальная версия","Versión inicial","Version initiale","Erste Version"],
    ["כלי הסטודיו","Studio Tools","أدوات الاستوديو","Инструменты студии","Herramientas del estudio","Outils du studio","Studio-Werkzeuge"],
    ["ביטול","Cancel","إلغاء","Отмена","Cancelar","Annuler","Abbrechen"],
    ["סגור","Close","إغلاق","Закрыть","Cerrar","Fermer","Schließen"]
    ,["לחץ על ITZIK SOUND כדי להיכנס","Click ITZIK SOUND to enter"]
    ,["התחבר כדי לשמור את הפרויקטים שלך בענן.","Sign in to save your projects in the cloud."]
    ,["אין לך חשבון? ","Don't have an account? "]
    ,["אין לך חשבון?","Don't have an account?"]
    ,["חיבור החשבון עדיין לא הוגדר בשרת. בדוק את משתני Supabase ב-Render.","Account connection is not configured on the server. Check the Supabase settings in Render."]
    ,["🔒 הפרויקטים וקובצי האודיו שלך פרטיים לחשבון שלך.","🔒 Your projects and audio files are private to your account."]
    ,["שפת הממשק","Interface language"]
    ,["YOUR PERSONAL MUSIC SPACE","YOUR PERSONAL MUSIC SPACE"]
    ,["🔊 צליל פתיחה אוטומטי","🔊 Automatic startup sound"]
  ];

  const TRANSLATIONS = {
    he: { language:"שפה", save:"שמור", cancel:"ביטול", close:"סגור", loading:"טוען...", settings:"הגדרות", home:"ראשי", projects:"הפרויקטים שלי", newProject:"פרויקט חדש", mix:"מיקס AI", mastering:"מאסטרינג AI", pitch:"תיקון זיופים", ideas:"רעיונות מוזיקליים", reference:"סטודיו רפרנסים", assistant:"איצקו AI", help:"עזרה", signOut:"התנתקות", languageSaved:"השפה עודכנה בהצלחה" },
    en: { language:"Language", save:"Save", cancel:"Cancel", close:"Close", loading:"Loading...", settings:"Settings", home:"Home", projects:"My Projects", newProject:"New Project", mix:"AI Mixing", mastering:"AI Mastering", pitch:"Pitch Correction", ideas:"Musical Ideas", reference:"Reference Studio", assistant:"ITZKO AI", help:"Help", signOut:"Sign out", languageSaved:"Language updated successfully" },
    ar: { language:"اللغة", save:"حفظ", cancel:"إلغاء", close:"إغلاق", loading:"جارٍ التحميل...", settings:"الإعدادات", home:"الرئيسية", projects:"مشاريعي", newProject:"مشروع جديد", mix:"المزج بالذكاء الاصطناعي", mastering:"إتقان الصوت بالذكاء الاصطناعي", pitch:"تصحيح النغمات", ideas:"أفكار موسيقية", reference:"استوديو المقارنة", assistant:"إيتسكو AI", help:"مساعدة", signOut:"تسجيل الخروج", languageSaved:"تم تحديث اللغة بنجاح" },
    ru: { language:"Язык", save:"Сохранить", cancel:"Отмена", close:"Закрыть", loading:"Загрузка...", settings:"Настройки", home:"Главная", projects:"Мои проекты", newProject:"Новый проект", mix:"AI-микширование", mastering:"AI-мастеринг", pitch:"Коррекция высоты тона", ideas:"Музыкальные идеи", reference:"Студия сравнения", assistant:"ITZKO AI", help:"Помощь", signOut:"Выйти", languageSaved:"Язык успешно обновлён" },
    es: { language:"Idioma", save:"Guardar", cancel:"Cancelar", close:"Cerrar", loading:"Cargando...", settings:"Configuración", home:"Inicio", projects:"Mis proyectos", newProject:"Nuevo proyecto", mix:"Mezcla con IA", mastering:"Masterización con IA", pitch:"Corrección de tono", ideas:"Ideas musicales", reference:"Estudio de referencia", assistant:"ITZKO AI", help:"Ayuda", signOut:"Cerrar sesión", languageSaved:"Idioma actualizado correctamente" },
    fr: { language:"Langue", save:"Enregistrer", cancel:"Annuler", close:"Fermer", loading:"Chargement...", settings:"Paramètres", home:"Accueil", projects:"Mes projets", newProject:"Nouveau projet", mix:"Mixage IA", mastering:"Mastering IA", pitch:"Correction de tonalité", ideas:"Idées musicales", reference:"Studio de référence", assistant:"ITZKO AI", help:"Aide", signOut:"Déconnexion", languageSaved:"Langue mise à jour avec succès" },
    de: { language:"Sprache", save:"Speichern", cancel:"Abbrechen", close:"Schließen", loading:"Laden...", settings:"Einstellungen", home:"Startseite", projects:"Meine Projekte", newProject:"Neues Projekt", mix:"KI-Mixing", mastering:"KI-Mastering", pitch:"Tonhöhenkorrektur", ideas:"Musikalische Ideen", reference:"Referenzstudio", assistant:"ITZKO AI", help:"Hilfe", signOut:"Abmelden", languageSaved:"Sprache erfolgreich aktualisiert" }
  };

  let currentLanguage = "he";
  const reverse = new Map();

  ROWS.forEach(row => {
    row.forEach((phrase, index) => {
      if (phrase) reverse.set(phrase, row);
    });
  });

  function translate(value) {
    const row = reverse.get(value);
    if (!row) return value;
    const index = ["he","en","ar","ru","es","fr","de"].indexOf(currentLanguage);
    return row[index] || row[0];
  }

  function translateDocument(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const original = node.nodeValue;
      const trimmed = original.trim();
      if (!trimmed) return;
      const result = translate(trimmed);
      if (result !== trimmed) {
        node.nodeValue = original.replace(trimmed, result);
      }
    });

    root.querySelectorAll?.("[placeholder],[title],[aria-label]").forEach(el => {
      ["placeholder","title","aria-label"].forEach(attr => {
        const value = el.getAttribute(attr);
        if (value) el.setAttribute(attr, translate(value));
      });
    });

    const title = document.querySelector("title");
    if (title) title.textContent = translate(title.textContent);
  }

  function getSavedLanguage() {
    try {
      return localStorage.getItem("itzik_language") || "he";
    } catch {
      return "he";
    }
  }

  function applyLanguage(language) {
    currentLanguage = LANGUAGES[language] ? language : "he";

    try {
      localStorage.setItem("itzik_language", currentLanguage);
    } catch (error) {
      console.warn("Could not save language preference:", error);
    }

    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = LANGUAGES[currentLanguage].direction;
    document.documentElement.style.setProperty("--page-direction", LANGUAGES[currentLanguage].direction);

    translateDocument();

    document.dispatchEvent(new CustomEvent("itzik:language-changed", {
      detail: { language: currentLanguage }
    }));

    return currentLanguage;
  }

  function t(key) {
    return TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.he[key] || key;
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat(currentLanguage, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const original = node.nodeValue;
          const trimmed = original.trim();
          if (trimmed) {
            const result = translate(trimmed);
            if (result !== trimmed) node.nodeValue = original.replace(trimmed, result);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          translateDocument(node);
        }
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ITZIK_I18N = {
    languages: LANGUAGES,
    translations: TRANSLATIONS,
    t,
    applyLanguage,
    getLanguage: () => currentLanguage,
    getLanguageInfo: () => LANGUAGES[currentLanguage],
    formatDate
  };

  applyLanguage(getSavedLanguage());
})();
