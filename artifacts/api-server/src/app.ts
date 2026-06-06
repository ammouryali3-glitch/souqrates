import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { captureException, isSentryReady } from "./lib/integrations/sentry-node";

const app: Express = express();

// Build allowed CORS origins from deployment config + dev fallbacks
function buildAllowedOrigins(): string[] {
  const replit = (process.env.REPLIT_DOMAINS ?? "").split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);
  return [...replit, "http://localhost:5173", "http://localhost:3000", "http://localhost:5000"];
}

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

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // server-to-server or curl
      const allowed = buildAllowedOrigins();
      const ok =
        allowed.includes(origin) ||
        /^https?:\/\/[^/]+\.replit\.(dev|app|co)$/.test(origin) ||
        /^https?:\/\/[^/]+\.telegram\.org$/.test(origin) ||
        origin === "https://web.telegram.org";
      cb(null, ok);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Admin login: max 10 attempts per 15 minutes (brute-force protection)
app.use("/api/admin/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — try again later" },
}));

// Telegram init endpoint: max 30 requests per minute per IP
app.use("/api/user/init", rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Balance debit endpoint: max 60 debits per minute per IP
app.use("/api/user/balance-event", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

app.use("/api", router);

// Global error handler — captures to Sentry when active, then returns 500
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (isSentryReady()) captureException(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
