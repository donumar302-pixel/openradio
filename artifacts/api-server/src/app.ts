import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPgSimple(session);

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production");
}

const app: Express = express();

// Behind the Replit reverse proxy: required so express-session trusts
// X-Forwarded-Proto and will set the `secure` session cookie.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Production is single-origin (API serves the frontend), so no cross-origin
// access is needed there. Reflecting every origin with credentials would let
// malicious sites make authenticated requests — only allow it in development.
const isProduction = process.env.NODE_ENV === "production";
if (!isProduction) {
  app.use(cors({ origin: true, credentials: true }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
    secret: SESSION_SECRET || "dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      // Production is same-origin → "lax" blocks CSRF. Dev runs inside the
      // Replit HTTPS iframe preview, which requires "none".
      sameSite: isProduction ? "lax" : "none",
    },
  }),
);

import { renderIndexHtml } from "./lib/seo-meta";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const audioDir = path.resolve(workspaceRoot, "artifacts/api-server/audio");
app.use("/api/audio", express.static(audioDir));

app.use("/api", router);

// Serve frontend static files whenever a built frontend exists
// (works on Railway even if NODE_ENV is not explicitly set)
const frontendDir = path.resolve(workspaceRoot, "artifacts/voiceover-tool/dist/public");
if (fs.existsSync(path.join(frontendDir, "index.html"))) {
  app.use(express.static(frontendDir, { index: false }));
  // SPA fallback — all non-API GET routes serve index.html with per-route
  // SEO metadata injected server-side (crawlers must not need JS for meta).
  const rawIndexHtml = fs.readFileSync(path.join(frontendDir, "index.html"), "utf8");
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.type("html").send(renderIndexHtml(rawIndexHtml, req.path));
  });
}

// JSON error handler for API routes — without this, thrown errors fall through
// to Express's default HTML error page and the frontend shows
// "Unexpected token '<' ... is not valid JSON" instead of the real message.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled API error");
  if (res.headersSent) return;
  const message = typeof err?.message === "string" && err.message ? err.message : "Internal server error";
  res.status(err?.status ?? err?.statusCode ?? 500).json({ error: message });
});

export default app;
