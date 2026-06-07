import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationBanner } from "@/components/NotificationBanner";
import { SplashScreen } from "@/components/SplashScreen";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Wrench, AlertTriangle } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { ALL_GAMES, getGameById } from "@/lib/games-data";
import { setCurrentGameContext, useTelegramUser } from "@/lib/telegram-user";
import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";

// Non-game pages — loaded eagerly (they're small)
import Home from "@/pages/home";
import Games from "@/pages/games";
import Shop from "@/pages/shop";
import Wallet from "@/pages/wallet";
import Referrals from "@/pages/referrals";
import Manager from "@/pages/manager";
import Contact from "@/pages/contact";
import Policies from "@/pages/policies";
import NotFound from "@/pages/not-found";

// Games — lazy-loaded so they don't bloat the initial bundle.
// Each game chunk is only fetched when the user actually navigates to that route.
const StackGame      = lazy(() => import("@/pages/stack-game"));
const OrbitGame      = lazy(() => import("@/pages/orbit-game"));
const KnifeGame      = lazy(() => import("@/pages/knife-game"));
const SliceGame      = lazy(() => import("@/pages/slice-game"));
const ColorSwitchGame = lazy(() => import("@/pages/color-switch-game"));
const ZigZagGame     = lazy(() => import("@/pages/zigzag-game"));
const PianoGame      = lazy(() => import("@/pages/piano-game"));
const WhackGame      = lazy(() => import("@/pages/whack-game"));
const BubbleGame     = lazy(() => import("@/pages/bubble-game"));
const ShooterGame    = lazy(() => import("@/pages/shooter-game"));
const BreakoutGame   = lazy(() => import("@/pages/breakout-game"));
const JumperGame     = lazy(() => import("@/pages/jumper-game"));
const CalcBlastGame  = lazy(() => import("@/pages/calc-blast-game"));
const NumSmashGame   = lazy(() => import("@/pages/num-smash-game"));
const ChainSumGame   = lazy(() => import("@/pages/chain-sum-game"));
const FracSortGame   = lazy(() => import("@/pages/frac-sort-game"));
const SpeedMathGame  = lazy(() => import("@/pages/speed-math-game"));
const GridPopGame    = lazy(() => import("@/pages/gridpop-game"));
const NeonLinkGame   = lazy(() => import("@/pages/neonlink-game"));
const QuickSumGame   = lazy(() => import("@/pages/quicksum-game"));
const Match3Game     = lazy(() => import("@/pages/match3-game"));
const PulseTapGame   = lazy(() => import("@/pages/pulsetap-game"));
const SwipeRushGame  = lazy(() => import("@/pages/swiperush-game"));
const BubblePopGame  = lazy(() => import("@/pages/bubblepop-game"));
const ColorRainGame  = lazy(() => import("@/pages/colorrain-game"));
const StackDropGame  = lazy(() => import("@/pages/stackdrop-game"));
const OrbitAimGame   = lazy(() => import("@/pages/orbitaim-game"));
const EchoTapGame    = lazy(() => import("@/pages/echotap-game"));
const MergeBlitzGame = lazy(() => import("@/pages/mergeblitz-game"));
const NumBlitzGame   = lazy(() => import("@/pages/numblitz-game"));
const CardFlipGame   = lazy(() => import("@/pages/cardflip-game"));
const DetectiveGame  = lazy(() => import("@/pages/detective-game"));
const CipherRushGame = lazy(() => import("@/pages/cipher-rush-game"));
const HiddenPathGame = lazy(() => import("@/pages/hidden-path-game"));
const GeniusGridGame = lazy(() => import("@/pages/genius-grid-game"));
const TruthScaleGame = lazy(() => import("@/pages/truth-scale-game"));

const GAME_COMPONENTS: Record<string, React.ComponentType> = {
  stack: StackGame, orbit: OrbitGame, knife: KnifeGame, slice: SliceGame,
  color: ColorSwitchGame, zigzag: ZigZagGame, piano: PianoGame, whack: WhackGame,
  bubble: BubbleGame, striker: ShooterGame, breakout: BreakoutGame, hopper: JumperGame,
  calcblast: CalcBlastGame, numsmash: NumSmashGame, chainsum: ChainSumGame, fracsort: FracSortGame,
  speedmath: SpeedMathGame, gridpop: GridPopGame, neonlink: NeonLinkGame, quicksum: QuickSumGame,
  match3: Match3Game, pulsetap: PulseTapGame, swiperush: SwipeRushGame, bubblepop: BubblePopGame,
  colorrain: ColorRainGame, stackdrop: StackDropGame, orbitaim: OrbitAimGame, echotap: EchoTapGame,
  mergeblitz: MergeBlitzGame, numblitz: NumBlitzGame, cardflip: CardFlipGame,
  detective: DetectiveGame, cipher: CipherRushGame, hiddenpath: HiddenPathGame,
  geniusgrid: GeniusGridGame, truthscale: TruthScaleGame,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Error Boundary ────────────────────────────────────────────────────────────
// Catches crashes in individual game components so the rest of the app stays alive.

interface EBState { hasError: boolean; error?: Error }

class GameErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GameErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center"
          dir="rtl"
        >
          <AlertTriangle size={44} className="text-amber-400" />
          <h2 className="text-lg font-display font-bold text-white">
            حدث خطأ في تحميل اللعبة
          </h2>
          <p className="text-sm text-white/50">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <button
            className="mt-2 px-5 py-2 rounded-full text-sm font-semibold text-black"
            style={{ background: "var(--color-primary, #f5b301)" }}
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Loading fallback shown while a lazy game chunk is being fetched ───────────
function GameLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-white/50 font-display">جارٍ تحميل اللعبة…</span>
      </div>
    </div>
  );
}

// ── Page transition wrapper ───────────────────────────────────────────────────
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex-1 overflow-y-auto pb-28 pt-6 px-4"
    >
      {children}
    </motion.div>
  );
}

// ── Game route guard ──────────────────────────────────────────────────────────
// Redirects if game/section is disabled. Shows a loading overlay while the
// authoritative balance is still being confirmed from the server.
function GameGate({ id, children }: { id: string; children: React.ReactNode }) {
  const { gameOverrides, settings } = useAdmin();
  const { loading: balanceLoading } = useTelegramUser();
  const game = getGameById(id);
  const enabled = gameOverrides[id]?.enabled !== false;
  const sectionOn = game?.type === "arena" ? settings.arenaEnabled : settings.skillEnabled;
  if (!game || !enabled || !sectionOn) return <Redirect to="/games" />;
  return (
    <div className="relative flex-1 flex flex-col h-full">
      {children}
      {balanceLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-white/60 font-display">جارٍ تحميل الرصيد…</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenanceScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center" dir="rtl">
      <div className="w-24 h-24 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
        <Wrench size={42} className="text-amber-400" />
      </div>
      <div>
        <h1 className="text-xl font-display font-black text-white">التطبيق قيد الصيانة</h1>
        <p className="text-sm text-white/45 font-display mt-2 leading-relaxed">
          نعمل على تحسينات سريعة. يرجى العودة بعد قليل.
        </p>
      </div>
    </div>
  );
}

function BanScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center" dir="rtl">
      <div className="w-24 h-24 rounded-3xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
        <Ban size={44} className="text-red-400" />
      </div>
      <div>
        <h1 className="text-xl font-display font-black text-white">تم حظر حسابك</h1>
        <p className="text-sm text-white/45 font-display mt-2 leading-relaxed">
          تم تعليق وصولك إلى التطبيق. يرجى التواصل مع الدعم لمزيد من المعلومات.
        </p>
      </div>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const { banned, settings } = useAdmin();
  const isManager = location === "/manager";

  // Pre-fetch a game-session nonce on every game or arena route entry.
  const lastContextRoute = useRef<string | null>(null);
  useEffect(() => {
    const gameMatch = location.match(/^\/games\/(\w+)/);
    const arenaMatch = location.match(/^\/arena\/(\w+)/);
    const contextId = gameMatch?.[1] ?? arenaMatch?.[1] ?? null;
    if (contextId && location !== lastContextRoute.current) {
      lastContextRoute.current = location;
      setCurrentGameContext(contextId).catch(() => {/* ignore */});
    } else if (!gameMatch && !arenaMatch) {
      lastContextRoute.current = null;
    }
  }, [location]);

  const immersive = isManager || (location.startsWith("/games/") && location !== "/games") || location.startsWith("/arena/");

  // Lock document touchmove on game/arena routes so the Telegram WebView
  // doesn't scroll the page during gameplay.
  useEffect(() => {
    if (!immersive) return;
    const prevent = (e: TouchEvent) => { e.preventDefault(); };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [immersive]);

  if (banned && !isManager) {
    return (
      <MobileContainer hideHeader>
        <BanScreen />
      </MobileContainer>
    );
  }

  if (isManager) {
    return <Manager />;
  }

  if (settings.maintenance) {
    return (
      <MobileContainer hideHeader>
        <MaintenanceScreen />
      </MobileContainer>
    );
  }

  return (
    <MobileContainer hideHeader={immersive}>
      <div className="flex-1 relative flex flex-col h-full overflow-hidden">
        {!immersive && <NotificationBanner />}
        <AnimatePresence mode="wait">
          <Switch>
            <Route path="/"><PageWrapper><Home /></PageWrapper></Route>
            <Route path="/games"><PageWrapper><Games /></PageWrapper></Route>
            {ALL_GAMES.map((g) => {
              const Comp = GAME_COMPONENTS[g.id];
              if (!Comp) return null;
              return (
                <Route key={g.id} path={g.route}>
                  <GameGate id={g.id}>
                    <GameErrorBoundary>
                      <Suspense fallback={<GameLoader />}>
                        <Comp />
                      </Suspense>
                    </GameErrorBoundary>
                  </GameGate>
                </Route>
              );
            })}
            <Route path="/shop"><PageWrapper><Shop /></PageWrapper></Route>
            <Route path="/wallet"><PageWrapper><Wallet /></PageWrapper></Route>
            <Route path="/referrals"><PageWrapper><Referrals /></PageWrapper></Route>
            <Route path="/contact"><PageWrapper><Contact /></PageWrapper></Route>
            <Route path="/policies"><PageWrapper><Policies /></PageWrapper></Route>
            <Route><PageWrapper><NotFound /></PageWrapper></Route>
          </Switch>
        </AnimatePresence>
      </div>
      {!immersive && <BottomNav />}
    </MobileContainer>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
