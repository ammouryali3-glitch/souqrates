import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_swiperush_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.swiperush;
const DIRS = ["up","down","left","right"] as const;
type Dir = typeof DIRS[number];
const DIR_COLOR:Record<Dir,string> = {up:"#4dff91",down:"#ff4da6",left:"#ffdd00",right:"#00d4ff"};
const DIR_ARROW:Record<Dir,string> = {up:"↑",down:"↓",left:"←",right:"→"};

export default function SwipeRushGame() {
  const TICKETS = useGameTickets("swiperush", RAW_TICKETS);
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
  const onUpRef = useRef<((x:number,y:number)=>void)|null>(null);
  const gsRef = useRef({
    dir:"up" as Dir, showT:0, maxShowT:2.2, score:0, combo:0, time:60, maxTime:60, target:150,
    flash:"none" as "ok"|"wrong"|"none", flashT:0, downX:0, downY:0,
  });

  const finishGame = useCallback((won:boolean,fs:number)=>{
    if(finishedRef.current) return; finishedRef.current=true; cancelAnimationFrame(rafRef.current);
    if(!ticket) return;
    if(won){const nb=balance-ticket.price+ticket.prize;setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));if(fs>best){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));}}
    else{const nb=Math.max(0,balance-ticket.price);setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));}
    setScoreDisp(fs);setPhase(won?"won":"lost");
  },[ticket,balance,best]);

  const startGame = useCallback((t:Ticket)=>{
    if(startingRef.current) return;
    if(!canvasRef.current){rafRef.current=requestAnimationFrame(()=>startGame(t));return;}
    if(canvasRef.current.offsetWidth===0){rafRef.current=requestAnimationFrame(()=>startGame(t));return;}
    startingRef.current=true; finishedRef.current=false;
    const g=gsRef.current;
    g.dir=DIRS[Math.floor(Math.random()*4)]; g.showT=0; g.maxShowT=2.2;
    g.score=0; g.combo=0; g.time=t.time; g.maxTime=t.time; g.target=t.target;
    g.flash="none"; g.flashT=0;
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width, H=canvas.height;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    function nextDir(){
      const prev=g.dir;
      let nd:Dir; do{nd=DIRS[Math.floor(Math.random()*4)];}while(nd===prev);
      g.dir=nd; g.showT=0; g.maxShowT=Math.max(0.8,2.2-g.score*0.0008);
    }

    onDownRef.current=(px,py)=>{g.downX=px;g.downY=py;};
    onUpRef.current=(px,py)=>{
      if(finishedRef.current) return;
      const dx=px-g.downX, dy=py-g.downY;
      if(Math.abs(dx)<18&&Math.abs(dy)<18) return;
      let swped:Dir;
      if(Math.abs(dx)>Math.abs(dy)) swped=dx>0?"right":"left";
      else swped=dy>0?"down":"up";
      if(swped===g.dir){
        const pts=10+g.combo*3; g.score+=pts; g.combo++; g.flash="ok"; g.flashT=0.35;
        setScoreDisp(g.score);
        if(g.score>=g.target){finishGame(true,g.score);return;}
      } else { g.combo=0; g.flash="wrong"; g.flashT=0.3; }
      nextDir();
    };

    let last=performance.now();
    function loop(now:number){
      if(finishedRef.current) return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#f59e0b,#ef4444)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      g.showT+=dt;
      if(g.showT>=g.maxShowT){g.combo=0;nextDir();}
      if(g.flashT>0) g.flashT-=dt*3;

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H);
      const col=DIR_COLOR[g.dir];
      // BG gradient
      const bg=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.8);
      bg.addColorStop(0,col+"18"); bg.addColorStop(1,"#060010");
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      // Flash overlay
      if(g.flashT>0){ctx.fillStyle=g.flash==="ok"?`rgba(77,255,145,${g.flashT*0.3})`:`rgba(255,77,106,${g.flashT*0.35})`;ctx.fillRect(0,0,W,H);}

      const cx=W/2, cy=H/2;
      // Countdown arc
      const pct=1-g.showT/g.maxShowT;
      const urgency=pct<0.3;
      ctx.beginPath();ctx.arc(cx,cy,88,-Math.PI/2,-Math.PI/2+2*Math.PI*pct);
      ctx.strokeStyle=urgency?"#ef4444":col;ctx.lineWidth=5;ctx.shadowColor=urgency?"#ef4444":col;ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;

      // Pulsing outer ring
      const pulse=0.85+Math.sin(now/200)*0.15;
      ctx.beginPath();ctx.arc(cx,cy,92*pulse,0,Math.PI*2);
      ctx.strokeStyle=col+"33";ctx.lineWidth=2;ctx.stroke();

      // Arrow (giant glyph)
      ctx.font=`bold ${urgency?"140":"120"}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.shadowColor=col;ctx.shadowBlur=40;ctx.fillStyle=col;
      ctx.fillText(DIR_ARROW[g.dir],cx,cy+(urgency?Math.sin(now/80)*4:0));ctx.shadowBlur=0;

      // Combo counter
      if(g.combo>1){
        ctx.font="bold 28px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
        ctx.fillStyle="#ffdd00";ctx.shadowColor="#ffdd00";ctx.shadowBlur=15;
        ctx.fillText(`×${g.combo} COMBO`,cx,H*0.78);ctx.shadowBlur=0;
      }

      // Direction label
      ctx.font="bold 13px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";
      ctx.fillStyle="rgba(255,255,255,0.3)";
      ctx.fillText("SWIPE  "+g.dir.toUpperCase(),cx,H*0.75);

      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#060010"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(6,0,16,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">⚡</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-yellow-400"/><span className="text-[11px] tracking-[0.4em] text-yellow-400/60 uppercase">Swipe Rush</span></div>
            <h1 className="font-display font-black text-2xl text-yellow-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">A glowing arrow appears — swipe in that direction before the countdown ring collapses! Build combos for massive bonus points!</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-yellow-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">SCORE {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-yellow-300 text-lg flex items-center gap-1"><Coins size={13} className="text-yellow-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-yellow-500/30 flex items-center justify-center text-yellow-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-yellow-500/20"><div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 shadow-[0_0_8px_rgba(234,179,8,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative touch-none"
            onPointerDown={e=>{onDownRef.current?.(e.clientX,e.clientY);}}
            onPointerUp={e=>{onUpRef.current?.(e.clientX,e.clientY);}}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"/>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"⚡":"😵"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-yellow-400":"text-red-400"}`}>{phase==="won"?"BLAZING!":"TOO SLOW!"}</div><div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-yellow-500/20 border border-yellow-500/40"><Coins size={16} className="text-yellow-400"/><span className="font-display font-bold text-yellow-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-yellow-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> TRY AGAIN</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
