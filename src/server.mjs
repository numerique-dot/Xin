import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { verifyRequestIdentity } from "./auth.mjs";
import { RequestBody, TASKS } from "./schemas.mjs";
import { runTask, runtimeInfo } from "./vertex.mjs";

const app = express();
const port = Number(process.env.PORT || 8080);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // same-origin/server-to-server
    if (allowedOrigins.has(origin)) return callback(null, true);
    const err = new Error("Origin non autorisee");
    err.status = 403;
    err.code = "ORIGIN_FORBIDDEN";
    return callback(err);
  },
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck", "X-Request-Id"],
  maxAge: 3600,
}));

// Base64 inline uploads expand by ~33%; 24 MB JSON still keeps the API bounded.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "24mb" }));

app.use((req, res, next) => {
  const requestId = req.get("x-request-id") || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.get("/healthz", (req, res) => {
  res.json({ ok: true, service: "360-relance-ai", ...runtimeInfo() });
});

app.post("/api/relance/ai", async (req, res, next) => {
  const started = Date.now();
  try {
    await verifyRequestIdentity(req);
    const body = RequestBody.parse(req.body);

    if (body.task === TASKS.EXTRACTION && !(body.text || body.files?.length)) {
      const err = new Error("EXTRACTION exige au moins un document ou un texte");
      err.status = 400;
      err.code = "EMPTY_EXTRACTION_INPUT";
      throw err;
    }

    const data = await runTask(body);

    // Deliberately do not log request bodies, document content, names, addresses,
    // AGDREF numbers, model prompts, or model outputs.
    console.log(JSON.stringify({
      severity: "INFO",
      requestId: req.requestId,
      task: body.task,
      status: 200,
      durationMs: Date.now() - started,
    }));

    res.json({ ok: true, requestId: req.requestId, data });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, _next) => {
  let status = Number(err.status || 500);
  let code = err.code || "INTERNAL_ERROR";
  let message = status >= 500 ? "Erreur interne du service AI" : err.message;

  if (err instanceof ZodError) {
    status = 400;
    code = "INVALID_REQUEST";
    message = "Requete invalide";
  }

  if (err?.type === "entity.too.large") {
    status = 413;
    code = "REQUEST_TOO_LARGE";
    message = "Requete trop volumineuse";
  }

  console.error(JSON.stringify({
    severity: status >= 500 ? "ERROR" : "WARNING",
    requestId: req.requestId || null,
    status,
    code,
    // Do not log err.message: upstream errors may echo document content.
  }));

  res.status(status).json({
    ok: false,
    requestId: req.requestId || null,
    error: { code, message },
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ severity: "INFO", event: "server_started", port }));
});
