import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";

let ready = false;

function ensureFirebase() {
  if (ready) return;
  if (!getApps().length) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    });
  }
  ready = true;
}

function isTrue(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  return String(raw).toLowerCase() === "true";
}

export async function verifyRequestIdentity(req) {
  ensureFirebase();

  const requireAuth = isTrue("REQUIRE_FIREBASE_AUTH", true);
  const requireAppCheck = isTrue("REQUIRE_APP_CHECK", true);

  let uid = null;
  let appId = null;

  if (requireAuth) {
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      const err = new Error("Firebase Auth token manquant");
      err.status = 401;
      err.code = "AUTH_REQUIRED";
      throw err;
    }
    try {
      const decoded = await getAuth().verifyIdToken(match[1], true);
      uid = decoded.uid;
    } catch {
      const err = new Error("Firebase Auth token invalide");
      err.status = 401;
      err.code = "AUTH_INVALID";
      throw err;
    }
  }

  if (requireAppCheck) {
    const token = req.get("x-firebase-appcheck");
    if (!token) {
      const err = new Error("Firebase App Check token manquant");
      err.status = 401;
      err.code = "APPCHECK_REQUIRED";
      throw err;
    }
    try {
      const decoded = await getAppCheck().verifyToken(token);
      appId = decoded.appId || null;
    } catch {
      const err = new Error("Firebase App Check token invalide");
      err.status = 401;
      err.code = "APPCHECK_INVALID";
      throw err;
    }
  }

  return { uid, appId };
}
