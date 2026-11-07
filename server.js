const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/vendor/lame.min.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "lamejs", "lame.min.js"));
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "ITZIK SOUND", aiConnected: false });
});

// AI connection point. Real provider and audio engine will be connected here.
app.post("/api/assistant", (_req, res) => {
  res.status(503).json({
    error: "AI_NOT_CONNECTED",
    message: "איצקו עדיין לא מחובר למנוע AI. נחבר ספק AI ומנוע אודיו אמיתי בשלב הבא."
  });
});

app.listen(PORT, () => {
  console.log(`ITZIK SOUND is running at http://localhost:${PORT}`);
});