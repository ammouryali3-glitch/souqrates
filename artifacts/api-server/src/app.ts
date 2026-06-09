import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { captureException, isSentryReady } from "./lib/integrations/sentry-node";
import { USER_COOKIE, verifyUserToken } from "./lib/user-auth";

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
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

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
//
// Authenticated endpoints use a user-ID key (extracted from the signed JWT
// cookie) so that IP rotation cannot bypass per-user limits. Unauthenticated
// endpoints (login, init) fall back to IP.
//
// NOTE: cookieParser() is registered above, so req.cookies is populated before
// any of these rate-limit middlewares run.

/**
 * For authenticated routes: key = "uid:<tgId>" extracted from the signed JWT
 * cookie. Falls back to IP for unauthenticated / tampered requests.
 */
function userOrIpKey(req: Request): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (req as any).cookies?.[USER_COOKIE] as string | undefined;
    if (token) {
      const payload = verifyUserToken(token);
      if (payload?.tgId) return `uid:${payload.tgId}`;
    }
  } catch {
    // fall through to IP
  }
  return req.ip ?? "unknown";
}

// Admin login: max 10 attempts per 15 minutes (brute-force protection, IP-keyed)
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

// Balance debit: max 60 per minute per authenticated user
app.use("/api/user/balance-event", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Game result (win credit): max 60 per minute per authenticated user
app.use("/api/user/game-result", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Submit score (arena): max 60 per minute per authenticated user
app.use("/api/user/submit-score", rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Withdraw: max 3 per 15 minutes per authenticated user (drain protection)
app.use("/api/user/withdraw", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many withdrawal requests — try again later" },
}));

// Shop purchases: max 20 per minute per authenticated user
app.use("/api/user/shop/buy", rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Check-in: max 5 per minute per authenticated user
app.use("/api/user/checkin", rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Wheel spin: max 10 per hour per authenticated user
app.use("/api/user/wheel/spin", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many spin requests — try again later" },
}));

// Loot box: max 30 per hour per authenticated user
app.use("/api/user/wheel/open-box", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down" },
}));

// Clan create: max 5 per hour per authenticated user
app.use("/api/user/clan/create", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many clan create requests" },
}));

// Challenge create: max 20 per hour per authenticated user
app.use("/api/user/challenge/create", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many challenge requests" },
}));

// Battle pass claim: max 60 per hour per authenticated user
app.use("/api/user/battle-pass/claim", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many claim requests — slow down" },
}));

// Battle pass premium unlock: max 10 per hour per authenticated user
app.use("/api/user/battle-pass/unlock-premium", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: userOrIpKey,
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
