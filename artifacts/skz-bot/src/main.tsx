import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Expand Telegram Mini App to full screen.
// expand() is called BEFORE ready() so Telegram opens at full height
// before showing the loading placeholder — this prevents the half-screen flash.
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.expand();
  try { tg.requestFullscreen(); } catch { /* unsupported in Telegram < 7.7 */ }
  try { tg.disableVerticalSwipes(); } catch { /* unsupported in Telegram < 7.0 */ }
  tg.ready?.();
}

createRoot(document.getElementById("root")!).render(<App />);
