
(function () {
  "use strict";

  const LANGUAGES = {
    he: { name: "עברית", direction: "rtl" },
    en: { name: "English", direction: "ltr" },
    ar: { name: "العربية", direction: "rtl" },
    ru: { name: "Русский", direction: "ltr" },
    es: { name: "Español", direction: "ltr" },
    fr: { name: "Français", direction: "ltr" },
    de: { name: "Deutsch", direction: "ltr" }
  };

  const TRANSLATIONS = {
    he: {
      language: "שפה",
      save: "שמור",
      cancel: "ביטול",
      close: "סגור",
      loading: "טוען...",
      settings: "הגדרות",
      home: "ראשי",
      projects: "הפרויקטים שלי",
      newProject: "פרויקט חדש",
      mix: "מיקס AI",
      mastering: "מאסטרינג AI",
      pitch: "תיקון זיופים",
      ideas: "רעיונות מוזיקליים",
      reference: "אולפן השוואה",
      assistant: "איצקו AI",
      help: "עזרה",
      signOut: "התנתקות",
      languageSaved: "השפה עודכנה בהצלחה"
    },
    en: {
      language: "Language",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      loading: "Loading...",
      settings: "Settings",
      home: "Home",
      projects: "My Projects",
      newProject: "New Project",
      mix: "AI Mixing",
      mastering: "AI Mastering",
      pitch: "Pitch Correction",
      ideas: "Musical Ideas",
      reference: "Reference Studio",
      assistant: "ITZKO AI",
      help: "Help",
      signOut: "Sign out",
      languageSaved: "Language updated successfully"
    },
    ar: {
      language: "اللغة",
      save: "حفظ",
      cancel: "إلغاء",
      close: "إغلاق",
      loading: "جارٍ التحميل...",
      settings: "الإعدادات",
      home: "الرئيسية",
      projects: "مشاريعي",
      newProject: "مشروع جديد",
      mix: "المزج بالذكاء الاصطناعي",
      mastering: "إتقان الصوت بالذكاء الاصطناعي",
      pitch: "تصحيح النغمات",
      ideas: "أفكار موسيقية",
      reference: "استوديو المقارنة",
      assistant: "إيتسكو AI",
      help: "مساعدة",
      signOut: "تسجيل الخروج",
      languageSaved: "تم تحديث اللغة بنجاح"
    },
    ru: {
      language: "Язык",
      save: "Сохранить",
      cancel: "Отмена",
      close: "Закрыть",
      loading: "Загрузка...",
      settings: "Настройки",
      home: "Главная",
      projects: "Мои проекты",
      newProject: "Новый проект",
      mix: "AI-микширование",
      mastering: "AI-мастеринг",
      pitch: "Коррекция высоты тона",
      ideas: "Музыкальные идеи",
      reference: "Студия сравнения",
      assistant: "ITZKO AI",
      help: "Помощь",
      signOut: "Выйти",
      languageSaved: "Язык успешно обновлён"
    },
    es: {
      language: "Idioma",
      save: "Guardar",
      cancel: "Cancelar",
      close: "Cerrar",
      loading: "Cargando...",
      settings: "Configuración",
      home: "Inicio",
      projects: "Mis proyectos",
      newProject: "Nuevo proyecto",
      mix: "Mezcla con IA",
      mastering: "Masterización con IA",
      pitch: "Corrección de tono",
      ideas: "Ideas musicales",
      reference: "Estudio de referencia",
      assistant: "ITZKO AI",
      help: "Ayuda",
      signOut: "Cerrar sesión",
      languageSaved: "Idioma actualizado correctamente"
    },
    fr: {
      language: "Langue",
      save: "Enregistrer",
      cancel: "Annuler",
      close: "Fermer",
      loading: "Chargement...",
      settings: "Paramètres",
      home: "Accueil",
      projects: "Mes projets",
      newProject: "Nouveau projet",
      mix: "Mixage IA",
      mastering: "Mastering IA",
      pitch: "Correction de tonalité",
      ideas: "Idées musicales",
      reference: "Studio de référence",
      assistant: "ITZKO AI",
      help: "Aide",
      signOut: "Déconnexion",
      languageSaved: "Langue mise à jour avec succès"
    },
    de: {
      language: "Sprache",
      save: "Speichern",
      cancel: "Abbrechen",
      close: "Schließen",
      loading: "Laden...",
      settings: "Einstellungen",
      home: "Startseite",
      projects: "Meine Projekte",
      newProject: "Neues Projekt",
      mix: "KI-Mixing",
      mastering: "KI-Mastering",
      pitch: "Tonhöhenkorrektur",
      ideas: "Musikalische Ideen",
      reference: "Referenzstudio",
      assistant: "ITZKO AI",
      help: "Hilfe",
      signOut: "Abmelden",
      languageSaved: "Sprache erfolgreich aktualisiert"
    }
  };

  let currentLanguage = "he";

  function getSavedLanguage() {
    try {
      return localStorage.getItem("itzik_language") || "he";
    } catch {
      return "he";
    }
  }

  function applyLanguage(language) {
    const selected = LANGUAGES[language] ? language : "he";
    currentLanguage = selected;

    try {
      localStorage.setItem("itzik_language", selected);
    } catch (error) {
      console.warn("Could not save language preference:", error);
    }

    document.documentElement.lang = selected;
    document.documentElement.dir = LANGUAGES[selected].direction;

    document.dispatchEvent(
      new CustomEvent("itzik:language-changed", {
        detail: { language: selected }
      })
    );

    return selected;
  }

  function t(key) {
    return (
      TRANSLATIONS[currentLanguage]?.[key] ||
      TRANSLATIONS.he[key] ||
      key
    );
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
