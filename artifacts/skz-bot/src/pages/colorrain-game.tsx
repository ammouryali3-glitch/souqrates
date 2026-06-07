import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { useGameFlow } from "@/components/game-flow";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_colorrain_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.colorrain;
const GEM_COLS = ["#ff4da6","#00d4ff","#ffdd00","#4dff91","#cc88ff"];
const LANES = 5;
interface Gem { id:number; lane:number; x:number; y:number; vy:number; color:number; caught:boolean; catchT:number; }

export default function ColorRainGame() {
  const TICKETS = useGameTickets("colorrain", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0); const finishedRef = useRef(false); const startingRef = useRef(false);
  const timerBarRef = useRef<HTMLDivElement>(null); const lastSecRef = useRef(0);
  const pendingTicketRef = useRef<Ticket | null>(null);
  const onDownRef = useRef<((x:number,y:number)=>void)|null>(null);
  const onMoveRef = useRef<((x:number,y:number)=>void)|null>(null);
  const gsRef = useRef({
    gems:[] as Gem[], score:0, time:60, maxTime:60, target:20,
    catcherColor:0, correctCatches:0, catcherX:0, catcherW:60,
    spawnT:0, spawnInterval:1.2, nextId:0, catchFlash:0, wrongFlash:0, combo:0,
  });

  const { requestEntry, requestExit, notifyWin, overlays } = useGameFlow({ ticket, onConfirmedEntry: (tk) => { setTicket(tk as unknown as Ticket); pendingTicketRef.current = tk as unknown as Ticket; setPhase("playing"); } });
  const finishGame = useCallback((won:boolean,fs:number)=>{
    if(finishedRef.current)return; finishedRef.current=true; cancelAnimationFrame(rafRef.current);
    if(!ticket)return;
    if(won){const nb=balance-ticket.price+ticket.prize;setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));if(fs>best){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));}notifyWin(ticket.prize);}
    else{const nb=Math.max(0,balance-ticket.price);setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));}
    setScoreDisp(fs);setPhase(won?"won":"lost");
  },[ticket,balance,best]);

  const startGame = useCallback((t:Ticket)=>{
    if(startingRef.current)return;
    if(!canvasRef.current){rafRef.current=requestAnimationFrame(()=>startGame(t));return;}
    if(canvasRef.current.offsetWidth===0){rafRef.current=requestAnimationFrame(()=>startGame(t));return;}
    startingRef.current=true; finishedRef.current=false;
    const g=gsRef.current;
    g.gems=[]; g.score=0; g.time=t.time; g.maxTime=t.time; g.target=t.target;
    g.catcherColor=0; g.correctCatches=0; g.catcherW=70; g.spawnT=0; g.spawnInterval=1.2;
    g.nextId=0; g.catchFlash=0; g.wrongFlash=0; g.combo=0;
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width, H=canvas.height;
    g.catcherX=W/2;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    const laneW=W/LANES, CATCHER_Y=H-60, CATCHER_H=18, GEM_R=16;
    function spawnGem(){
      const lane=Math.floor(Math.random()*LANES);
      const forcedColor=Math.random()<0.45?g.catcherColor:Math.floor(Math.random()*GEM_COLS.length);
      g.gems.push({id:g.nextId++,lane,x:lane*laneW+laneW/2,y:-GEM_R,vy:130+g.score*1.5,color:forcedColor,caught:false,catchT:0});
    }

    onDownRef.current=(px)=>{if(finishedRef.current)return;const rect=canvas.getBoundingClientRect();g.catcherX=Math.max(g.catcherW/2,Math.min(W-g.catcherW/2,px-rect.left));};
    onMoveRef.current=(px)=>{if(finishedRef.current)return;const rect=canvas.getBoundingClientRect();g.catcherX=Math.max(g.catcherW/2,Math.min(W-g.catcherW/2,px-rect.left));};

    let last=performance.now();
    function loop(now:number){
      if(finishedRef.current)return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#6366f1,#8b5cf6)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      g.gems.forEach(gem=>{if(!gem.caught)gem.y+=gem.vy*dt;else gem.catchT-=dt*3;});
      // Catch check
      g.gems.forEach(gem=>{
        if(gem.caught)return;
        if(gem.y>CATCHER_Y-GEM_R&&gem.y<CATCHER_Y+CATCHER_H&&Math.abs(gem.x-g.catcherX)<g.catcherW/2+GEM_R){
          gem.caught=true;gem.catchT=1;
          if(gem.color===g.catcherColor){
            g.score++;g.combo++;g.correctCatches++;g.catchFlash=0.4;setScoreDisp(g.score);
            if(g.score>=g.target){finishGame(true,g.score);return;}
            if(g.correctCatches>=5){g.correctCatches=0;g.catcherColor=(g.catcherColor+1+Math.floor(Math.random()*(GEM_COLS.length-1)))%GEM_COLS.length;}
            g.catcherW=Math.max(50,70-g.combo*0.5);
          } else {g.wrongFlash=0.3;g.combo=0;}
        }
      });
      g.gems=g.gems.filter(gem=>gem.y<H+40&&(!gem.caught||gem.catchT>0));
      if(g.catchFlash>0)g.catchFlash-=dt*2.5;
      if(g.wrongFlash>0)g.wrongFlash-=dt*3;
      g.spawnT-=dt;if(g.spawnT<=0){spawnGem();g.spawnT=Math.max(0.6,g.spawnInterval-g.score*0.005);}

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H);
      const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#06001a");bg.addColorStop(1,"#02000c");
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      if(g.catchFlash>0){ctx.fillStyle=`rgba(77,255,145,${g.catchFlash*0.25})`;ctx.fillRect(0,0,W,H);}
      if(g.wrongFlash>0){ctx.fillStyle=`rgba(255,77,77,${g.wrongFlash*0.25})`;ctx.fillRect(0,0,W,H);}

      // Lane guides
      for(let i=1;i<LANES;i++){ctx.beginPath();ctx.moveTo(i*laneW,0);ctx.lineTo(i*laneW,H);ctx.strokeStyle="rgba(255,255,255,0.04)";ctx.lineWidth=1;ctx.stroke();}

      // Gem indicator
      const ic=GEM_COLS[g.catcherColor];
      ctx.save();ctx.shadowColor=ic;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(W/2,46,18,0,Math.PI*2);ctx.fillStyle=ic;ctx.fill();
      ctx.beginPath();ctx.arc(W/2-6,40,6,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,0.35)";ctx.fill();
      ctx.strokeStyle="#ffffff44";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,46,18,0,Math.PI*2);ctx.stroke();
      ctx.shadowBlur=0;ctx.restore();
      ctx.font="bold 10px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle="rgba(255,255,255,0.4)";ctx.fillText("CATCH THIS",W/2,70);

      // Gems
      g.gems.forEach(gem=>{
        const col=GEM_COLS[gem.color];const a=gem.caught?gem.catchT:1;
        ctx.save();ctx.globalAlpha=a;ctx.shadowColor=col;ctx.shadowBlur=14;
        // Diamond shape
        ctx.beginPath();ctx.moveTo(gem.x,gem.y-GEM_R);ctx.lineTo(gem.x+GEM_R*0.7,gem.y);ctx.lineTo(gem.x,gem.y+GEM_R);ctx.lineTo(gem.x-GEM_R*0.7,gem.y);ctx.closePath();
        ctx.fillStyle=gem.caught?col+"aa":col+"dd";ctx.fill();
        ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.stroke();
        ctx.beginPath();ctx.moveTo(gem.x,gem.y-GEM_R*0.7);ctx.lineTo(gem.x+GEM_R*0.4,gem.y-GEM_R*0.1);ctx.closePath();
        ctx.strokeStyle="rgba(255,255,255,0.4)";ctx.lineWidth=2;ctx.stroke();
        ctx.shadowBlur=0;ctx.restore();
      });

      // Catcher paddle
      const cc=GEM_COLS[g.catcherColor];
      const cx=g.catcherX, cw=g.catcherW;
      ctx.save();ctx.shadowColor=cc;ctx.shadowBlur=20;
      ctx.beginPath();ctx.roundRect(cx-cw/2,CATCHER_Y,cw,CATCHER_H,9);
      ctx.fillStyle=cc+"44";ctx.fill();
      ctx.strokeStyle=cc;ctx.lineWidth=2.5;ctx.stroke();
      // Catcher color dot center
      ctx.beginPath();ctx.arc(cx,CATCHER_Y+CATCHER_H/2,7,0,Math.PI*2);ctx.fillStyle=cc;ctx.fill();
      ctx.shadowBlur=0;ctx.restore();

      // Combo
      if(g.combo>1){ctx.font="bold 13px 'Orbitron',sans-serif";ctx.textAlign="right";ctx.textBaseline="top";ctx.fillStyle="#ffdd00";ctx.shadowColor="#ffdd00";ctx.shadowBlur=10;ctx.fillText(`×${g.combo}`,W-12,90);ctx.shadowBlur=0;}

      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#06001a"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(6,0,26,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">💎</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-violet-400"/><span className="text-[11px] tracking-[0.4em] text-violet-400/60 uppercase">Color Rain</span></div>
            <h1 className="font-display font-black text-2xl text-violet-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Diamonds rain from above — drag your glowing paddle to catch ONLY the matching color! Catch 5 correct → color changes. Combo shrinks the paddle!</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-violet-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={() => requestEntry(tk)} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">CATCH {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-violet-300 text-lg flex items-center gap-1"><Coins size={13} className="text-violet-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={requestExit} className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-violet-500/30 flex items-center justify-center text-violet-300"><ArrowLeft size={15}/></button>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-violet-500/20"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative touch-none"
            onPointerDown={e=>onDownRef.current?.(e.clientX,e.clientY)}
            onPointerMove={e=>onMoveRef.current?.(e.clientX,e.clientY)}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"/>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"💎":"🌧️"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-violet-400":"text-red-400"}`}>{phase==="won"?"CAUGHT!":"MISSED!"}</div><div className="text-white/60 text-sm mt-1">Catches: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-500/20 border border-violet-500/40"><Coins size={16} className="text-violet-400"/><span className="font-display font-bold text-violet-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-violet-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-violet-500/20 border border-violet-500/40 text-violet-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> {gt[getLang()].gamePlayAgain}</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
      {overlays}
    </div>
  );
}
