import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Expand Telegram Mini App to full screen immediately.
// The script tag in index.html ensures window.Telegram is already initialised.
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready?.();
  tg.expand();                  // expand to full height (all Telegram versions)
  try { tg.requestFullscreen(); } catch { /* unsupported in older Telegram versions */ }
  try { tg.disableVerticalSwipes(); } catch { /* unsupported in older Telegram versions */ }
}

createRoot(document.getElementById("root")!).render(<App />);
