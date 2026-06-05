import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationBanner } from "@/components/NotificationBanner";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Wrench } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { ALL_GAMES, getGameById } from "@/lib/games-data";
import { setCurrentGameContext, useTelegramUser } from "@/lib/telegram-user";
import { useEffect, useRef } from "react";

// Pages
import Home from "@/pages/home";
import Games from "@/pages/games";
import Shop from "@/pages/shop";
import Wallet from "@/pages/wallet";
import Referrals from "@/pages/referrals";
import StackGame from "@/pages/stack-game";
import OrbitGame from "@/pages/orbit-game";
import KnifeGame from "@/pages/knife-game";
import SliceGame from "@/pages/slice-game";
import ColorSwitchGame from "@/pages/color-switch-game";
import ZigZagGame from "@/pages/zigzag-game";
import PianoGame from "@/pages/piano-game";
import WhackGame from "@/pages/whack-game";
import BubbleGame from "@/pages/bubble-game";
import ShooterGame from "@/pages/shooter-game";
import BreakoutGame from "@/pages/breakout-game";
import JumperGame from "@/pages/jumper-game";
import CalcBlastGame from "@/pages/calc-blast-game";
import NumSmashGame from "@/pages/num-smash-game";
import ChainSumGame from "@/pages/chain-sum-game";
import FracSortGame from "@/pages/frac-sort-game";
import SpeedMathGame from "@/pages/speed-math-game";
import GridPopGame from "@/pages/gridpop-game";
import NeonLinkGame from "@/pages/neonlink-game";
import QuickSumGame from "@/pages/quicksum-game";
import Match3Game from "@/pages/match3-game";
import PulseTapGame from "@/pages/pulsetap-game";
import SwipeRushGame from "@/pages/swiperush-game";
import BubblePopGame from "@/pages/bubblepop-game";
import ColorRainGame from "@/pages/colorrain-game";
import StackDropGame from "@/pages/stackdrop-game";
import OrbitAimGame from "@/pages/orbitaim-game";
import EchoTapGame from "@/pages/echotap-game";
import MergeBlitzGame from "@/pages/mergeblitz-game";
import NumBlitzGame from "@/pages/numblitz-game";
import CardFlipGame from "@/pages/cardflip-game";
import DetectiveGame from "@/pages/detective-game";
import CipherRushGame from "@/pages/cipher-rush-game";
import HiddenPathGame from "@/pages/hidden-path-game";
import GeniusGridGame from "@/pages/genius-grid-game";
import TruthScaleGame from "@/pages/truth-scale-game";
import Manager from "@/pages/manager";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Page transition wrapper
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 overflow-y-auto pb-28 pt-6 px-4"
    >
      {children}
    </motion.div>
  );
}

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

// Gate a game route: redirect to /games if the game is disabled or its section is off.
// Also shows a loading overlay while the server balance is being confirmed, so the
// ticket-selection screen cannot be interacted with before the authoritative balance arrives.
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
  // This is an optimization — reduces latency for the first credit after
  // entering a play context.  For repeated plays or arena credits, the sync
  // layer automatically requests fresh nonces inline (see telegram-user.ts).
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
                  <GameGate id={g.id}><Comp /></GameGate>
                </Route>
              );
            })}
            <Route path="/shop"><PageWrapper><Shop /></PageWrapper></Route>
            <Route path="/wallet"><PageWrapper><Wallet /></PageWrapper></Route>
            <Route path="/referrals"><PageWrapper><Referrals /></PageWrapper></Route>
            <Route><PageWrapper><NotFound /></PageWrapper></Route>
          </Switch>
        </AnimatePresence>
      </div>
      {!immersive && <BottomNav />}
    </MobileContainer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
