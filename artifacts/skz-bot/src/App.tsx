import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileContainer } from "@/components/layout/MobileContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { AnimatePresence, motion } from "framer-motion";

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

function Router() {
  const [location] = useLocation();
  const immersive = location.startsWith("/games/") && location !== "/games";

  return (
    <MobileContainer hideHeader={immersive}>
      <div className="flex-1 relative flex flex-col h-full overflow-hidden">
        <AnimatePresence mode="wait">
          <Switch>
            <Route path="/"><PageWrapper><Home /></PageWrapper></Route>
            <Route path="/games"><PageWrapper><Games /></PageWrapper></Route>
            <Route path="/games/stack"><StackGame /></Route>
            <Route path="/games/orbit"><OrbitGame /></Route>
            <Route path="/games/knife"><KnifeGame /></Route>
            <Route path="/games/slice"><SliceGame /></Route>
            <Route path="/games/color"><ColorSwitchGame /></Route>
            <Route path="/games/zigzag"><ZigZagGame /></Route>
            <Route path="/games/piano"><PianoGame /></Route>
            <Route path="/games/whack"><WhackGame /></Route>
            <Route path="/games/bubble"><BubbleGame /></Route>
            <Route path="/games/striker"><ShooterGame /></Route>
            <Route path="/games/breakout"><BreakoutGame /></Route>
            <Route path="/games/hopper"><JumperGame /></Route>
            <Route path="/games/calcblast"><CalcBlastGame /></Route>
            <Route path="/games/numsmash"><NumSmashGame /></Route>
            <Route path="/games/chainsum"><ChainSumGame /></Route>
            <Route path="/games/fracsort"><FracSortGame /></Route>
            <Route path="/games/speedmath"><SpeedMathGame /></Route>
            <Route path="/games/gridpop"><GridPopGame /></Route>
            <Route path="/games/neonlink"><NeonLinkGame /></Route>
            <Route path="/games/quicksum"><QuickSumGame /></Route>
            <Route path="/games/match3"><Match3Game /></Route>
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
