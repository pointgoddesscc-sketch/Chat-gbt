const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

admin.initializeApp();

const JWT_SECRET = defineSecret("JWT_SECRET");
const OWNER_EMAIL = defineSecret("OWNER_EMAIL");
const OWNER_PASSWORD = defineSecret("OWNER_PASSWORD");
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const db = admin.firestore();

function mask(value = "") {
  if (!value || value.length < 10) return "not_configured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function logEvent(collection, payload) {
  try {
    await db.collection(collection).add({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(`Failed to write ${collection} log`, error);
  }
}

app.get("/api/status", async (req, res) => {
  res.json({
    success: true,
    service: "PSE Firebase Backend",
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "concise-emitter-491603-b1",
    endpoints: ["POST /api/login", "POST /api/telegram/webhook", "GET|POST /api/meta/webhook"],
  });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  const ownerEmail = OWNER_EMAIL.value();
  const ownerPassword = OWNER_PASSWORD.value();

  if (!ownerEmail || !ownerPassword) {
    return res.status(500).json({
      success: false,
      message: "Owner login is not configured yet. Set OWNER_EMAIL and OWNER_PASSWORD in Firebase secrets.",
    });
  }

  const isEmailValid = email.toLowerCase() === ownerEmail.toLowerCase();
  const passwordHash = bcrypt.hashSync(ownerPassword, 10);
  const isPasswordValid = await bcrypt.compare(password, passwordHash);

  if (!isEmailValid || !isPasswordValid) {
    await logEvent("loginLogs", { email, success: false, ip: req.ip });
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  const token = jwt.sign({ email: ownerEmail, role: "owner" }, JWT_SECRET.value(), { expiresIn: "1h" });
  await logEvent("loginLogs", { email: ownerEmail, success: true, ip: req.ip });

  res.json({
    success: true,
    token,
    user: { email: ownerEmail, role: "owner" },
    tokenPreview: mask(token),
  });
});

app.post("/api/telegram/webhook", async (req, res) => {
  const update = req.body || {};
  await logEvent("telegramLogs", { update });

  const chatId = update.message?.chat?.id;
  const text = update.message?.text || "";
  const firstName = update.message?.from?.first_name || "there";

  if (!chatId) {
    return res.json({ success: true, message: "No chat id found; update logged only." });
  }

  const reply = text.toLowerCase().includes("status")
    ? "PSE system is online. Firebase backend is connected."
    : `Hello ${firstName}, welcome to PSE Secure Assistant. Your message has been received.`;

  const botToken = TELEGRAM_BOT_TOKEN.value();
  if (!botToken) {
    return res.json({ success: true, message: "Telegram token not configured; update logged only." });
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  });

  const telegramJson = await telegramResponse.json().catch(() => ({}));
  res.json({ success: true, telegram: telegramJson });
});

app.get("/api/meta/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === META_VERIFY_TOKEN.value()) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/api/meta/webhook", async (req, res) => {
  await logEvent("metaLogs", { body: req.body || {} });
  res.json({ success: true, message: "Meta webhook received and logged." });
});

exports.api = onRequest(
  {
    region: "us-central1",
    secrets: [JWT_SECRET, OWNER_EMAIL, OWNER_PASSWORD, TELEGRAM_BOT_TOKEN, META_VERIFY_TOKEN],
  },
  app
);
