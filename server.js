
const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

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
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
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
