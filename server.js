
const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20mb" }));
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
// ROEX MIX ENHANCE PREVIEW
app.post(
  "/api/roex/preview",
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      const user = await verifyUser(req);

      if (!user) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "צריך להתחבר לחשבון כדי להשתמש ב-Mix AI."
        });
      }

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
        console.error("RoEx upload error:", uploadData);

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

      const previewData = await previewResponse.json();

      if (!previewResponse.ok || !previewData.mixrevive_task_id) {
        console.error("RoEx preview error:", previewData);

        return res.status(502).json({
          error: "ROEX_PREVIEW_FAILED",
          message: "RoEx לא הצליח ליצור תצוגה מקדימה."
        });
      }

      return res.json({
        ok: true,
        taskId: previewData.mixrevive_task_id,
        message: "משימת התצוגה המקדימה נוצרה בהצלחה."
      });

    } catch (error) {
      console.error("RoEx preview error:", error);

      return res.status(500).json({
        error: "ROEX_PREVIEW_ERROR",
        message: "אירעה תקלה בחיבור ל-RoEx."
      });
    }
  }
);
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

    const data = await response.json();

    if (response.status === 202) {
      return res.status(202).json({
        processing: true,
        message: "התצוגה המקדימה עדיין בעיבוד."
      });
    }

    if (!response.ok || data.error) {
      console.error("RoEx preview retrieval error:", data);

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
    console.error("RoEx preview retrieval error:", error);

    return res.status(500).json({
      message: "אירעה תקלה בקבלת התצוגה המקדימה."
    });
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
          instructions: `
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
      console.error("OpenAI API error:", response.status, data);

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
    console.error("Assistant error:", error);

    return res.status(500).json({
      error: "ASSISTANT_ERROR",
      message: "אירעה תקלה בחיבור לאיצקו. נסה שוב בעוד רגע."
    });
  }
});

app.listen(PORT, () => {
  console.log(`ITZIK SOUND is running on port ${PORT}`);
});
