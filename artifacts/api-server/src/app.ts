import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Global error handler — must be the last middleware registered
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
