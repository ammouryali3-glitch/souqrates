import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Expand Telegram Mini App to full screen immediately
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  tg.ready?.();
  tg.expand();
  tg.disableVerticalSwipes?.();
}

createRoot(document.getElementById("root")!).render(<App />);
