
const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/flac",
      "audio/x-flac"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("פורמט קובץ אודיו לא נתמך."));
    }
  }
});
// Avoid duplicate paid final-master retrievals within a server process.
// A failed request remains locked because the provider may have processed it
// even when the response was lost.
const finalMasterAttempts = new Map();
const finalMixAttempts = new Map();
// Supabase public configuration
app.get("/config.js", (_req, res) => {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ""
  };

  res
    .type("application/javascript")
    .send(`window.ITZIK_CONFIG = ${JSON.stringify(config)};`);
});

// MP3 encoder
app.get("/vendor/lame.min.js", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "node_modules", "lamejs", "lame.min.js")
  );
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "ITZIK SOUND",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    roexConfigured: Boolean(process.env.ROEX_API_KEY)
  });
});

// Verify the logged-in user through Supabase
async function verifyUser(req) {
  const token = req.headers.authorization || "";
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!token.startsWith("Bearer ") || !supabaseUrl || !supabaseKey) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: token
      },
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) return null;

  const user = await response.json();
  return user && user.id ? user : null;
}

async function getOwnedProject(req, user, projectId) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey || typeof projectId !== "string" || projectId.length > 100) return null;
  const query = new URLSearchParams({ id: `eq.${projectId}`, user_id: `eq.${user.id}`, select: "metadata", limit: "1" });
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/projects?${query}`, {
    headers: { apikey: supabaseKey, Authorization: req.headers.authorization },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function ownsTask(req, user, projectId, metadataKey, taskId) {
  const project = await getOwnedProject(req, user, projectId);
  return project?.metadata?.[metadataKey]?.taskId === taskId;
}

async function requireUser(req, res, next) {
  try {
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "צריך להתחבר לחשבון כדי להשתמש בשירות."
      });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(503).json({
      error: "AUTH_SERVICE_UNAVAILABLE",
      message: "לא ניתן לאמת את החשבון כרגע. נסה שוב."
    });
  }
}

function safeRoexLogMessage(data, apiKey = process.env.ROEX_API_KEY) {
  const message =
    typeof data === "string"
      ? data
      : typeof data?.message === "string"
        ? data.message
        : typeof data?.error?.message === "string"
          ? data.error.message
          : typeof data?.error === "string"
            ? data.error
            : "";

  const redactedKey = apiKey
    ? message.split(apiKey).join("[REDACTED]")
    : message;

  return redactedKey
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[REDACTED_URL]")
    .slice(0, 500);
}

// ROEX MIX ENHANCE PREVIEW
app.post(
  "/api/roex/preview",
  requireUser,
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      const apiKey = process.env.ROEX_API_KEY;

      if (!apiKey) {
        return res.status(503).json({
          error: "ROEX_NOT_CONFIGURED",
          message: "חיבור RoEx עדיין לא הוגדר בשרת."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "NO_AUDIO_FILE",
          message: "לא נבחר קובץ אודיו."
        });
      }

      const extension = path.extname(req.file.originalname).toLowerCase();

      const contentTypes = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac"
      };

      const contentType = contentTypes[extension];

      if (!contentType) {
        return res.status(400).json({
          error: "INVALID_AUDIO_FORMAT",
          message: "אפשר להעלות MP3, WAV או FLAC בלבד."
        });
      }

      const styles = [
        "ROCK", "POP", "TECHNO", "TRAP", "JAZZ",
        "METAL", "SOUL", "FOLK", "ORCHESTRAL",
        "PUNK", "BLUES", "AMBIENT", "ACOUSTIC",
        "EXPERIMENTAL", "HIP_HOP_GRIME", "COUNTRY",
        "FUNK", "RNB", "INDIE_POP", "INDIE_ROCK",
        "AFROBEAT", "DRUM_N_BASS", "HOUSE",
        "TRANCE", "LO_FI", "ELECTRONIC"
      ];

      const musicalStyle = req.body.musicalStyle || "POP";

      if (!styles.includes(musicalStyle)) {
        return res.status(400).json({
          error: "INVALID_MUSICAL_STYLE",
          message: "סגנון מוזיקלי לא נתמך."
        });
      }

      const uploadResponse = await fetch(
        "https://tonn.roexaudio.com/upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey
          },
          body: JSON.stringify({
            filename: req.file.originalname,
            contentType
          }),
          signal: AbortSignal.timeout(30000)
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.signed_url) {
        console.error("RoEx upload error", {
          message: safeRoexLogMessage(uploadData, apiKey)
        });

        return res.status(502).json({
          error: "ROEX_UPLOAD_FAILED",
          message: "RoEx לא הצליח להכין העלאת קובץ."
        });
      }

      const fileResponse = await fetch(uploadData.signed_url, {
        method: "PUT",
        headers: {
          "Content-Type": contentType
        },
        body: req.file.buffer,
        signal: AbortSignal.timeout(120000)
      });

      if (!fileResponse.ok) {
        return res.status(502).json({
          error: "ROEX_FILE_UPLOAD_FAILED",
          message: "העלאת קובץ האודיו ל-RoEx נכשלה."
        });
      }

      const previewResponse = await fetch(
        "https://tonn.roexaudio.com/mixenhancepreview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey
          },
          body: JSON.stringify({
            mixReviveData: {
              audioFileLocation: uploadData.readable_url,
              musicalStyle,
              isMaster: false,
              fixClippingIssues: true,
              fixDRCIssues: true,
              fixStereoWidthIssues: true,
              fixTonalProfileIssues: true,
              fixLoudnessIssues: true,
              applyMastering: false,
              stemProcessing: false
            }
          }),
          signal: AbortSignal.timeout(60000)
        }
      );

      console.info("RoEx mixenhancepreview HTTP response", {
        status: previewResponse.status
      });

      const previewData = await previewResponse.json();
      const taskId = previewData.mixrevive_task_id;

      console.info("RoEx mixenhancepreview task", {
        receivedMixreviveTaskId: Boolean(taskId),
        taskId
      });

      if (!previewResponse.ok || !taskId) {
        console.error("RoEx mixenhancepreview error", {
          message: safeRoexLogMessage(previewData, apiKey)
        });

        return res.status(502).json({
          error: "ROEX_PREVIEW_FAILED",
          message: "RoEx לא הצליח ליצור תצוגה מקדימה."
        });
      }

      return res.json({
        ok: true,
        taskId,
        message: "משימת התצוגה המקדימה נוצרה בהצלחה."
      });

    } catch (error) {
      console.error("RoEx preview error", {
        message: safeRoexLogMessage(error)
      });

      return res.status(500).json({
        error: "ROEX_PREVIEW_ERROR",
        message: "אירעה תקלה בחיבור ל-RoEx."
      });
    }
  }
);

// ROEX MASTERING PREVIEW
app.post(
  "/api/roex/mastering-preview",
  requireUser,
  audioUpload.single("audio"),
  async (req, res) => {
    const apiKey = process.env.ROEX_API_KEY;

    try {
      if (!apiKey) {
        return res.status(503).json({
          error: "ROEX_NOT_CONFIGURED",
          message: "חיבור RoEx עדיין לא הוגדר בשרת."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "NO_AUDIO_FILE",
          message: "לא נבחר קובץ אודיו."
        });
      }

      const extension = path.extname(req.file.originalname).toLowerCase();
      const contentTypes = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac"
      };
      const contentType = contentTypes[extension];

      if (!contentType) {
        return res.status(400).json({
          error: "INVALID_AUDIO_FORMAT",
          message: "אפשר להעלות MP3, WAV או FLAC בלבד."
        });
      }

      const musicalStyle = req.body.musicalStyle || "POP";
      const desiredLoudness = req.body.desiredLoudness || "MEDIUM";
      const sampleRate = String(req.body.sampleRate || "44100");
      const validStyles = [
        "ROCK_INDIE", "POP", "ACOUSTIC", "HIPHOP_GRIME",
        "ELECTRONIC", "REGGAE_DUB", "METAL", "OTHER"
      ];

      if (!validStyles.includes(musicalStyle)) {
        return res.status(400).json({
          error: "INVALID_MUSICAL_STYLE",
          message: "סגנון מוזיקלי לא נתמך."
        });
      }

      if (!["LOW", "MEDIUM", "HIGH"].includes(desiredLoudness)) {
        return res.status(400).json({
          error: "INVALID_LOUDNESS",
          message: "רמת העוצמה לא נתמכת."
        });
      }

      if (!["44100", "48000"].includes(sampleRate)) {
        return res.status(400).json({
          error: "INVALID_SAMPLE_RATE",
          message: "קצב הדגימה לא נתמך."
        });
      }

      const uploadResponse = await fetch(
        "https://tonn.roexaudio.com/upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey
          },
          body: JSON.stringify({
            filename: req.file.originalname,
            contentType
          }),
          signal: AbortSignal.timeout(30000)
        }
      );
      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.signed_url || !uploadData.readable_url) {
        console.error("RoEx mastering upload error", {
          status: uploadResponse.status,
          message: safeRoexLogMessage(uploadData, apiKey)
        });
        return res.status(502).json({
          error: "ROEX_UPLOAD_FAILED",
          message: "RoEx לא הצליח להכין העלאת קובץ."
        });
      }

      const fileResponse = await fetch(uploadData.signed_url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: req.file.buffer,
        signal: AbortSignal.timeout(120000)
      });

      if (!fileResponse.ok) {
        console.error("RoEx mastering file upload failed", {
          status: fileResponse.status
        });
        return res.status(502).json({
          error: "ROEX_FILE_UPLOAD_FAILED",
          message: "העלאת קובץ האודיו ל-RoEx נכשלה."
        });
      }

      const previewResponse = await fetch(
        "https://tonn.roexaudio.com/masteringpreview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey
          },
          body: JSON.stringify({
            masteringData: {
              trackData: [{ trackURL: uploadData.readable_url }],
              musicalStyle,
              desiredLoudness,
              sampleRate
            }
          }),
          signal: AbortSignal.timeout(60000)
        }
      );

      console.info("RoEx masteringpreview HTTP response", {
        status: previewResponse.status
      });
      const previewData = await previewResponse.json();
      const taskId = previewData.mastering_task_id;

      console.info("RoEx masteringpreview task", {
        receivedTaskId: Boolean(taskId),
        taskId
      });

      if (!previewResponse.ok || !taskId) {
        console.error("RoEx masteringpreview error", {
          message: safeRoexLogMessage(previewData, apiKey)
        });
        return res.status(502).json({
          error: "ROEX_MASTERING_PREVIEW_FAILED",
          message: "RoEx לא הצליח ליצור תצוגה מקדימה למאסטרינג."
        });
      }

      return res.json({ ok: true, taskId });
    } catch (error) {
      console.error("RoEx mastering preview error", {
        message: safeRoexLogMessage(error, apiKey)
      });
      return res.status(500).json({
        error: "ROEX_MASTERING_PREVIEW_ERROR",
        message: "אירעה תקלה ביצירת תצוגת המאסטרינג."
      });
    }
  }
);

// ROEX MASTERING PREVIEW RESULT
app.post("/api/roex/mastering-preview-result", async (req, res) => {
  try {
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "צריך להתחבר מחדש לחשבון."
      });
    }

    const apiKey = process.env.ROEX_API_KEY;
    const taskId = req.body?.taskId;
    if (!apiKey || typeof taskId !== "string" || !taskId.trim()) {
      return res.status(400).json({
        error: "INVALID_MASTERING_TASK",
        message: "חסר חיבור RoEx או מזהה משימה תקין."
      });
    }

    const response = await fetch(
      "https://tonn.roexaudio.com/retrievepreviewmaster",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          masteringData: { masteringTaskId: taskId.trim() }
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    console.info("RoEx retrievepreviewmaster HTTP response", {
      status: response.status,
      taskId: taskId.trim()
    });
    const data = await response.json();

    if (response.status === 202) {
      return res.status(202).json({ processing: true });
    }

    if (!response.ok || data.error) {
      console.error("RoEx retrievepreviewmaster error", {
        message: safeRoexLogMessage(data, apiKey)
      });
      return res.status(502).json({
        error: "ROEX_MASTERING_PREVIEW_RETRIEVAL_FAILED",
        message: "לא הצלחנו לקבל את תצוגת המאסטרינג."
      });
    }

    const previewUrl =
      data.previewMasterTaskResults?.download_url_mastered_preview;
    if (!previewUrl) {
      return res.status(202).json({ processing: true });
    }

    return res.json({
      ok: true,
      previewUrl,
      previewStartTime: data.previewMasterTaskResults?.preview_start_time
    });
  } catch (error) {
    console.error("RoEx retrievepreviewmaster error", {
      message: safeRoexLogMessage(error)
    });
    return res.status(500).json({
      error: "ROEX_MASTERING_PREVIEW_RETRIEVAL_ERROR",
      message: "אירעה תקלה בקבלת תצוגת המאסטרינג."
    });
  }
});

// ROEX FINAL MASTER RETRIEVAL — charged by RoEx; client must confirm explicitly.
app.post("/api/roex/mastering-final", async (req, res) => {
  try {
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "צריך להתחבר מחדש לחשבון."
      });
    }

    const apiKey = process.env.ROEX_API_KEY;
    const taskId = req.body?.taskId;
    if (!apiKey || typeof taskId !== "string" || !taskId.trim()) {
      return res.status(400).json({
        error: "INVALID_MASTERING_TASK",
        message: "חסר חיבור RoEx או מזהה משימה תקין."
      });
    }

    if (req.body?.confirmedCreditCharge !== true) {
      return res.status(400).json({
        error: "CREDIT_CHARGE_CONFIRMATION_REQUIRED",
        message: "יש לאשר את החיוב לפני קבלת המאסטר המלא."
      });
    }

    if (!await ownsTask(req, user, req.body?.projectId, "mastering", taskId.trim())) {
      return res.status(403).json({ error: "MASTERING_TASK_NOT_OWNED", message: "המשימה אינה משויכת לפרויקט שלך." });
    }

    const attemptKey = `${user.id}:${taskId.trim()}`;
    const priorAttempt = finalMasterAttempts.get(attemptKey);
    if (priorAttempt) {
      if (priorAttempt.state === "complete") {
        return res.json({ ok: true, masterUrl: priorAttempt.masterUrl });
      }
      return res.status(409).json({
        error: "FINAL_MASTER_ALREADY_ATTEMPTED",
        message: "הבקשה למשימה זו כבר נשלחה. כדי למנוע חיוב כפול, אין לשלוח אותה שוב. בדוק את היסטוריית המשימות של RoEx."
      });
    }
    finalMasterAttempts.set(attemptKey, { state: "pending" });

    const response = await fetch(
      "https://tonn.roexaudio.com/retrievefinalmaster",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          masteringData: { masteringTaskId: taskId.trim() }
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    console.info("RoEx retrievefinalmaster HTTP response", {
      status: response.status,
      taskId: taskId.trim()
    });
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("RoEx retrievefinalmaster error", {
        message: safeRoexLogMessage(data, apiKey)
      });
      finalMasterAttempts.set(attemptKey, { state: "failed" });
      return res.status(502).json({
        error: "ROEX_FINAL_MASTER_FAILED",
        message: "לא הצלחנו לקבל את המאסטר המלא."
      });
    }

    const masterUrl =
      typeof data.finalMasterTaskResults === "string"
        ? data.finalMasterTaskResults
        : data.finalMasterTaskResults?.download_url_mastered;
    if (!masterUrl) {
      finalMasterAttempts.set(attemptKey, { state: "failed" });
      return res.status(502).json({
        error: "ROEX_FINAL_MASTER_URL_MISSING",
        message: "RoEx לא החזיר קישור למאסטר המלא."
      });
    }

    finalMasterAttempts.set(attemptKey, { state: "complete", masterUrl });

    return res.json({ ok: true, masterUrl });
  } catch (error) {
    console.error("RoEx retrievefinalmaster error", {
      message: safeRoexLogMessage(error)
    });
    return res.status(500).json({
      error: "ROEX_FINAL_MASTER_ERROR",
      message: "אירעה תקלה בקבלת המאסטר המלא."
    });
  }
});
// ROEX GET FREE MIX PREVIEW
app.post("/api/roex/preview-result", async (req, res) => {
  try {
    const user = await verifyUser(req);

    if (!user) {
      return res.status(401).json({
        message: "צריך להתחבר מחדש לחשבון."
      });
    }

    const apiKey = process.env.ROEX_API_KEY;
    const taskId = req.body.taskId;

    if (!apiKey || !taskId) {
      return res.status(400).json({
        message: "חסר חיבור RoEx או מזהה משימה."
      });
    }

    const response = await fetch(
      "https://tonn.roexaudio.com/retrieveenhancedtrack",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          mixReviveData: {
            mixReviveTaskId: taskId
          }
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    console.info("RoEx retrieveenhancedtrack HTTP response", {
      status: response.status,
      taskId
    });

    const data = await response.json();

    if (response.status === 202) {
      return res.status(202).json({
        processing: true,
        message: "התצוגה המקדימה עדיין בעיבוד."
      });
    }

    if (!response.ok || data.error) {
      console.error("RoEx retrieveenhancedtrack error", {
        message: safeRoexLogMessage(data, apiKey)
      });

      return res.status(502).json({
        message: "לא הצלחנו לקבל את התצוגה המקדימה."
      });
    }

    const previewUrl =
      data.revived_track_tasks_results?.download_url_preview_revived;

    if (!previewUrl) {
      return res.status(202).json({
        processing: true,
        message: "התצוגה המקדימה עדיין בעיבוד."
      });
    }

    return res.json({
      ok: true,
      previewUrl
    });

  } catch (error) {
    console.error("RoEx preview retrieval error", {
      message: safeRoexLogMessage(error)
    });

    return res.status(500).json({
      message: "אירעה תקלה בקבלת התצוגה המקדימה."
    });
  }
});

// Full Mix Enhance is started and retrieved only after an explicit user confirmation.
app.post("/api/roex/enhance-final", requireUser, audioUpload.single("audio"), async (req, res) => {
  try {
    const apiKey = process.env.ROEX_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "ROEX_NOT_CONFIGURED", message: "חיבור RoEx עדיין לא הוגדר בשרת." });
    if (req.body?.confirmedCreditCharge !== "true") return res.status(400).json({ error: "CREDIT_CHARGE_CONFIRMATION_REQUIRED", message: "יש לאשר את חיוב הקרדיטים לפני הפעלת Mix Enhance מלא." });
    if (!await getOwnedProject(req, req.user, req.body?.projectId)) return res.status(403).json({ error: "PROJECT_NOT_OWNED", message: "לא ניתן לאמת שהפרויקט שייך לחשבון המחובר." });
    if (!req.file) return res.status(400).json({ error: "NO_AUDIO_FILE", message: "לא נבחר קובץ אודיו." });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const contentType = ({ ".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac" })[ext];
    if (!contentType) return res.status(400).json({ error: "INVALID_AUDIO_FORMAT", message: "אפשר להעלות MP3, WAV או FLAC בלבד." });
    const styles = ["ROCK", "POP", "TECHNO", "TRAP", "JAZZ", "METAL", "SOUL", "FOLK", "ORCHESTRAL", "PUNK", "BLUES", "AMBIENT", "ACOUSTIC", "EXPERIMENTAL", "HIP_HOP_GRIME", "COUNTRY", "FUNK", "RNB", "INDIE_POP", "INDIE_ROCK", "AFROBEAT", "DRUM_N_BASS", "HOUSE", "TRANCE", "LO_FI", "ELECTRONIC"];
    const musicalStyle = req.body?.musicalStyle || "POP";
    if (!styles.includes(musicalStyle)) return res.status(400).json({ error: "INVALID_MUSICAL_STYLE", message: "סגנון מוזיקלי לא נתמך." });

    const uploadResponse = await fetch("https://tonn.roexaudio.com/upload", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ filename: req.file.originalname, contentType }), signal: AbortSignal.timeout(30000)
    });
    const uploadData = await uploadResponse.json();
    if (!uploadResponse.ok || !uploadData.signed_url || !uploadData.readable_url) {
      console.error("RoEx full enhance upload failed", { status: uploadResponse.status, message: safeRoexLogMessage(uploadData, apiKey) });
      return res.status(502).json({ error: "ROEX_UPLOAD_FAILED", message: "RoEx לא הצליח להכין את העלאת הקובץ." });
    }
    const putResponse = await fetch(uploadData.signed_url, { method: "PUT", headers: { "Content-Type": contentType }, body: req.file.buffer, signal: AbortSignal.timeout(120000) });
    if (!putResponse.ok) return res.status(502).json({ error: "ROEX_FILE_UPLOAD_FAILED", message: "העלאת הקובץ ל-RoEx נכשלה." });
    const response = await fetch("https://tonn.roexaudio.com/mixenhance", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ mixReviveData: {
        audioFileLocation: uploadData.readable_url, musicalStyle, isMaster: false,
        fixClippingIssues: true, fixDRCIssues: true, fixStereoWidthIssues: true,
        fixTonalProfileIssues: true, fixLoudnessIssues: true, applyMastering: true,
        stemProcessing: false
      } }), signal: AbortSignal.timeout(60000)
    });
    console.info("RoEx mixenhance HTTP response", { status: response.status });
    const result = await response.json();
    const taskId = result.mixrevive_task_id;
    if (!response.ok || !taskId || result.error) {
      console.error("RoEx mixenhance error", { message: safeRoexLogMessage(result, apiKey) });
      return res.status(502).json({ error: "ROEX_ENHANCE_FAILED", message: "RoEx לא הצליח להתחיל Mix Enhance מלא." });
    }
    return res.json({ ok: true, taskId });
  } catch (error) {
    console.error("RoEx full enhance request failed", { message: safeRoexLogMessage(error) });
    return res.status(500).json({ error: "ROEX_ENHANCE_ERROR", message: "אירעה תקלה בהפעלת Mix Enhance." });
  }
});

app.post("/api/roex/enhance-result", async (req, res) => {
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: "UNAUTHORIZED", message: "צריך להתחבר מחדש לחשבון." });
    const apiKey = process.env.ROEX_API_KEY;
    const taskId = req.body?.taskId;
    if (!apiKey || typeof taskId !== "string" || !taskId.trim()) return res.status(400).json({ error: "INVALID_ENHANCE_TASK", message: "חסר מזהה משימת Mix Enhance." });
    if (req.body?.confirmedCreditCharge !== true) return res.status(400).json({ error: "CREDIT_CHARGE_CONFIRMATION_REQUIRED", message: "יש לאשר את חיוב הקרדיטים לפני שליפת Mix Enhance מלא." });
    const key = `${user.id}:${taskId.trim()}`;
    if (!await ownsTask(req, user, req.body?.projectId, "mixEnhance", taskId.trim())) {
      return res.status(403).json({ error: "ENHANCE_TASK_NOT_OWNED", message: "המשימה אינה משויכת לפרויקט שלך." });
    }
    const prior = finalMixAttempts.get(key);
    if (prior) {
      if (prior.state === "complete") return res.json({ ok: true, masterUrl: prior.url });
      return res.status(409).json({ error: "FINAL_MIX_ALREADY_ATTEMPTED", message: "שליפת המשימה כבר נשלחה. כדי למנוע ניסיון כפול, בדוק את היסטוריית RoEx לפני ניסיון נוסף." });
    }
    finalMixAttempts.set(key, { state: "pending" });
    const response = await fetch("https://tonn.roexaudio.com/retrieveenhancedtrack", {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ mixReviveData: { mixReviveTaskId: taskId.trim() } }), signal: AbortSignal.timeout(60000)
    });
    console.info("RoEx full enhance retrieval HTTP response", { status: response.status, taskId: taskId.trim() });
    const data = await response.json();
    if (response.status === 202) {
      finalMixAttempts.delete(key);
      return res.status(202).json({ processing: true, message: "Mix Enhance עדיין בעיבוד." });
    }
    if (!response.ok || data.error) {
      console.error("RoEx full enhance retrieval error", { message: safeRoexLogMessage(data, apiKey) });
      finalMixAttempts.set(key, { state: "failed" });
      return res.status(502).json({ error: "ROEX_ENHANCE_RETRIEVAL_FAILED", message: "לא הצלחנו לקבל את Mix Enhance המלא." });
    }
    const url = data.revived_track_tasks_results?.download_url_revived;
    if (!url) {
      finalMixAttempts.delete(key);
      return res.status(202).json({ processing: true, message: "Mix Enhance עדיין בעיבוד." });
    }
    finalMixAttempts.set(key, { state: "complete", url });
    return res.json({ ok: true, masterUrl: url });
  } catch (error) {
    console.error("RoEx full enhance retrieval failed", { message: safeRoexLogMessage(error) });
    return res.status(500).json({ error: "ROEX_ENHANCE_RETRIEVAL_ERROR", message: "אירעה תקלה בקבלת Mix Enhance." });
  }
});
// ITZKO AI assistant
app.post("/api/assistant", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "AI_NOT_CONFIGURED",
        message: "מנוע ה-AI עדיין לא הוגדר בשרת."
      });
    }

    const user = await verifyUser(req);

    if (!user) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "צריך להתחבר לחשבון כדי לדבר עם איצקו."
      });
    }

    const message =
      typeof req.body?.message === "string"
        ? req.body.message.trim()
        : "";
    const language = req.body?.language === "en" ? "en" : "he";

    if (!message) {
      return res.status(400).json({
        error: "EMPTY_MESSAGE",
        message: "כתוב לאיצקו הודעה לפני השליחה."
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "MESSAGE_TOO_LONG",
        message: "ההודעה ארוכה מדי. אפשר לשלוח עד 4,000 תווים."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          instructions: language === "en" ? `
You are ITZKO, the music assistant for ITZIK SOUND.
Respond in clear, friendly, professional English. Help with mixing, mastering,
production, pitch, arrangement, chords, melody, rhythm, and sound.
Never claim to have heard, analyzed, processed, or changed audio unless actual
measurements are provided in this request. Any provided measurements are rough
signal statistics, not a perceptual or standards-based audio analysis.
Do not claim to have changed a project, run a processor, or exported a file.
You can advise and answer questions, but cannot directly alter projects or run
audio processing. Explain when an external processing tool is required.
          `.trim() : `
אתה איצקו (ITZKO), העוזר המוזיקלי של ITZIK SOUND.

דבר בעברית ברורה, ידידותית ומקצועית.
עזור למשתמש בנושאי מיקס, מאסטרינג, הפקה,
תיקון זיופים, עיבוד, אקורדים, מלודיות וסאונד.

הסבר דברים בצורה פשוטה ומעשית.
אל תטען שביצעת פעולה באתר או עיבוד אודיו
אם הפעולה לא באמת בוצעה.

כרגע אתה יכול לייעץ ולענות על שאלות,
אבל אין לך עדיין הרשאה לשנות פרויקטים,
להפעיל כלי עיבוד או לייצא קבצים.
אם המשתמש מבקש שינוי, הסבר לו מה ניתן לעשות
והבהר שנדרש חיבור של כלי הביצוע.
          `.trim(),
          input: message,
          max_output_tokens: 700
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error", { status: response.status });

      return res.status(502).json({
        error: "AI_PROVIDER_ERROR",
        message:
          "איצקו לא הצליח לענות כרגע. בדוק את הגדרות חשבון ה-AI ונסה שוב."
      });
    }

    const answer = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: "EMPTY_AI_RESPONSE",
        message: "לא התקבלה תשובה מאיצקו. נסה לשלוח שוב."
      });
    }

    return res.json({
      ok: true,
      message: answer
    });

  } catch (error) {
    console.error("Assistant request failed", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN"
    });

    return res.status(500).json({
      error: "ASSISTANT_ERROR",
      message: "אירעה תקלה בחיבור לאיצקו. נסה שוב בעוד רגע."
    });
  }
});

app.use("/api", (_req, res) => {
  return res.status(404).json({
    error: "NOT_FOUND",
    message: "הפעולה המבוקשת לא נמצאה."
  });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
      message: tooLarge
        ? "הקובץ גדול מ־50MB."
        : "לא ניתן לקבל את קובץ האודיו."
    });
  }

  if (error?.message === "פורמט קובץ אודיו לא נתמך.") {
    return res.status(400).json({
      error: "INVALID_AUDIO_FORMAT",
      message: "אפשר להעלות MP3, WAV או FLAC בלבד."
    });
  }

  if (error?.status === 400 || error?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "INVALID_REQUEST",
      message: "הבקשה אינה תקינה."
    });
  }

  if (error?.status === 413 || error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "REQUEST_TOO_LARGE",
      message: "הבקשה גדולה מדי."
    });
  }

  console.error("Unhandled request error", {
    name: typeof error?.name === "string" ? error.name : "Error"
  });
  return res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "אירעה תקלה בשרת. נסה שוב."
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ITZIK SOUND is running on port ${PORT}`);
  });
}

module.exports = app;
