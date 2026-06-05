import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_numblitz_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 30,  time: 60 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 60,  time: 55 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 100, time: 50 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 160, time: 45 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 250, time: 40 },
];
interface NumNode { n: number; x: number; y: number; tapped: boolean; }

export default function NumBlitzGame() {
  const TICKETS = useGameTickets("numblitz", RAW_TICKETS);
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
  const onTapRef = useRef<((x:number,y:number)=>void)|null>(null);
  const gsRef = useRef({
    nodes:[] as NumNode[], nextExpected:1, score:0, time:60, maxTime:60, target:30,
    roundN:12, wrongFlash:0, correctFlash:0, combo:0,
  });

  const finishGame = useCallback((won:boolean,fs:number)=>{
    if(finishedRef.current)return; finishedRef.current=true; cancelAnimationFrame(rafRef.current);
    if(!ticket)return;
    if(won){const nb=balance-ticket.price+ticket.prize;setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));if(fs>best){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));}}
    else{const nb=Math.max(0,balance-ticket.price);setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));}
    setScoreDisp(fs);setPhase(won?"won":"lost");
  },[ticket,balance,best]);

  const startGame = useCallback((t:Ticket)=>{
    if(startingRef.current)return;
    if(!canvasRef.current){rafRef.current=requestAnimationFrame(()=>startGame(t));return;}
    if(canvasRef.current.offsetWidth===0){rafRef.current=requestAnimationFrame(()=>startGame(t));return;}
    startingRef.current=true; finishedRef.current=false;
    const g=gsRef.current;
    g.score=0; g.time=t.time; g.maxTime=t.time; g.target=t.target;
    g.roundN=12; g.nextExpected=1; g.wrongFlash=0; g.correctFlash=0; g.combo=0;
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width, H=canvas.height;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    const NODE_R=26, TOP=90, BOTTOM=H-30;

    function spawnRound(n:number){
      const nodes:NumNode[]=[];
      const tries=80;
      for(let num=1;num<=n;num++){
        let x=0,y=0,ok=false,att=0;
        while(!ok&&att<tries){
          x=NODE_R+10+Math.random()*(W-NODE_R*2-20);
          y=TOP+NODE_R+Math.random()*(BOTTOM-TOP-NODE_R*2);
          ok=!nodes.some(nd=>Math.hypot(nd.x-x,nd.y-y)<NODE_R*2.6);
          att++;
        }
        nodes.push({n:num,x,y,tapped:false});
      }
      g.nodes=nodes; g.nextExpected=1;
    }
    spawnRound(g.roundN);

    onTapRef.current=(px,py)=>{
      if(finishedRef.current)return;
      const rect=canvas.getBoundingClientRect();
      const tx=px-rect.left, ty=py-rect.top;
      const hit=g.nodes.find(nd=>!nd.tapped&&Math.hypot(nd.x-tx,nd.y-ty)<NODE_R+8);
      if(!hit)return;
      if(hit.n===g.nextExpected){
        hit.tapped=true; g.nextExpected++; g.score++; g.combo++; g.correctFlash=0.25;
        setScoreDisp(g.score);
        if(g.score>=g.target){finishGame(true,g.score);return;}
        if(g.nextExpected>g.roundN){g.roundN+=3;spawnRound(g.roundN);}
      } else { g.wrongFlash=0.35; g.combo=0; }
    };

    let last=performance.now();
    function loop(now:number){
      if(finishedRef.current)return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#06b6d4,#22c55e)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      if(g.wrongFlash>0)g.wrongFlash-=dt*3;
      if(g.correctFlash>0)g.correctFlash-=dt*4;

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H);
      const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#020c0f");bg.addColorStop(1,"#010508");
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      if(g.wrongFlash>0){ctx.fillStyle=`rgba(255,60,60,${g.wrongFlash*0.25})`;ctx.fillRect(0,0,W,H);}
      if(g.correctFlash>0){ctx.fillStyle=`rgba(77,255,145,${g.correctFlash*0.2})`;ctx.fillRect(0,0,W,H);}

      // Next number indicator
      if(g.nextExpected<=g.roundN){
        ctx.font="bold 11px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
        ctx.fillStyle="rgba(255,255,255,0.3)";ctx.fillText(`TAP  →  ${g.nextExpected}`,W/2,12);
      }

      g.nodes.forEach(nd=>{
        if(nd.tapped)return;
        const isNext=nd.n===g.nextExpected;
        const pulse=isNext?(0.85+Math.sin(now/300)*0.15):1;
        const col=isNext?"#00d4ff":"rgba(255,255,255,0.5)";
        ctx.save();
        if(isNext){ctx.shadowColor="#00d4ff";ctx.shadowBlur=20;}
        ctx.beginPath();ctx.arc(nd.x,nd.y,NODE_R*pulse,0,Math.PI*2);
        ctx.fillStyle=isNext?"#00d4ff22":"rgba(255,255,255,0.06)";ctx.fill();
        ctx.strokeStyle=col;ctx.lineWidth=isNext?2.5:1.5;ctx.stroke();
        if(isNext){ctx.shadowBlur=0;ctx.beginPath();ctx.arc(nd.x,nd.y,NODE_R+6,0,Math.PI*2);ctx.strokeStyle="#00d4ff44";ctx.lineWidth=1;ctx.stroke();}
        ctx.font=`bold ${nd.n>=10?"18":"22"}px 'Orbitron',sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillStyle=isNext?"#00d4ff":"rgba(255,255,255,0.65)";ctx.fillText(String(nd.n),nd.x,nd.y);
        ctx.shadowBlur=0;ctx.restore();
      });

      // Combo
      if(g.combo>2){ctx.font="bold 13px 'Orbitron',sans-serif";ctx.textAlign="right";ctx.textBaseline="top";ctx.fillStyle="#ffdd00";ctx.shadowColor="#ffdd00";ctx.shadowBlur=10;ctx.fillText(`×${g.combo}`,W-12,90);ctx.shadowBlur=0;}

      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#020c0f"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(2,12,15,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🔢</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-cyan-400"/><span className="text-[11px] tracking-[0.4em] text-cyan-400/60 uppercase">Number Blitz</span></div>
            <h1 className="font-display font-black text-2xl text-cyan-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Numbers 1, 2, 3... are scattered all over the screen. Tap them in ORDER as fast as possible! Each round adds 3 more numbers to find.</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-cyan-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">TAPS {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-cyan-300 text-lg flex items-center gap-1"><Coins size={13} className="text-cyan-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
            {balance<TICKETS[0].price&&<button onClick={()=>{setBalance(1000);localStorage.setItem(BALANCE_KEY,"1000");}} className="mt-4 text-xs text-cyan-400/60 underline">Refill balance (demo)</button>}
          </motion.div>
        </motion.div>)}
        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-cyan-500/30 flex items-center justify-center text-cyan-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-cyan-500/20"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-400 transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-green-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative" onPointerDown={e=>onTapRef.current?.(e.clientX,e.clientY)}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none"/>
          </div>
        </motion.div>)}
        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🔢":"⌛"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-cyan-400":"text-red-400"}`}>{phase==="won"?"LIGHTNING!":"TIME'S UP!"}</div><div className="text-white/60 text-sm mt-1">Taps: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40"><Coins size={16} className="text-cyan-400"/><span className="font-display font-bold text-cyan-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-cyan-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> TRY AGAIN</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
