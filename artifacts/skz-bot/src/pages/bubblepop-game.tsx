import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_bubblepop_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 20,  time: 60 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 40,  time: 55 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 70,  time: 50 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 110, time: 45 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 170, time: 40 },
];
const BCOLS = ["#ff4da6","#00d4ff","#ffdd00","#4dff91","#cc88ff"];
const BNAMES = ["PINK","CYAN","GOLD","MINT","VIOLET"];
const LANES = 6;
interface Bubble { id:number; lane:number; x:number; y:number; vy:number; color:number; r:number; popping:boolean; popT:number; }

export default function BubblePopGame() {
  const TICKETS = useGameTickets("bubblepop", RAW_TICKETS);
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
    bubbles:[] as Bubble[], score:0, time:60, maxTime:60, target:20,
    targetColor:0, popCount:0, spawnT:0, spawnInterval:1.8, nextId:0,
    wrongFlash:0, combo:0,
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
    g.bubbles=[]; g.score=0; g.time=t.time; g.maxTime=t.time; g.target=t.target;
    g.targetColor=Math.floor(Math.random()*BCOLS.length); g.popCount=0;
    g.spawnT=0; g.spawnInterval=1.8; g.nextId=0; g.wrongFlash=0; g.combo=0;
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width, H=canvas.height;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    const laneW=W/LANES;
    function spawnBubble(){
      const lane=Math.floor(Math.random()*LANES);
      const color=g.targetColor+((Math.random()<0.4&&g.bubbles.filter(b=>b.color===g.targetColor&&!b.popping).length<2)?0:Math.floor(1+Math.random()*(BCOLS.length-1)))%(BCOLS.length);
      g.bubbles.push({id:g.nextId++,lane,x:lane*laneW+laneW/2,y:H+28,vy:-(55+g.score*0.3),color,r:22,popping:false,popT:0});
    }

    onTapRef.current=(px,py)=>{
      if(finishedRef.current)return;
      const rect=canvas.getBoundingClientRect();
      const tx=px-rect.left, ty=py-rect.top;
      const hit=g.bubbles.reduce<Bubble|null>((acc,b)=>{
        if(b.popping||Math.hypot(tx-b.x,ty-b.y)>=b.r+10) return acc;
        if(acc===null||b.y>acc.y) return b;
        return acc;
      },null);
      if(hit!==null){
        if(hit.color===g.targetColor){
          hit.popping=true; hit.popT=0.5; g.score++; g.combo++;
          g.popCount++;
          setScoreDisp(g.score);
          if(g.score>=g.target){finishGame(true,g.score);return;}
          if(g.popCount>=6){g.popCount=0;g.targetColor=(g.targetColor+1+Math.floor(Math.random()*(BCOLS.length-1)))%BCOLS.length;}
          g.spawnInterval=Math.max(0.7,1.8-g.score*0.01);
        } else { g.wrongFlash=0.3; g.combo=0; }
      }
    };

    let last=performance.now();
    function loop(now:number){
      if(finishedRef.current)return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#ec4899,#a855f7)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      g.bubbles.forEach(b=>{if(!b.popping)b.y+=b.vy*dt;else b.popT-=dt*2.5;});
      g.bubbles=g.bubbles.filter(b=>b.y>-40&&(!b.popping||b.popT>0));
      g.spawnT-=dt;
      if(g.spawnT<=0){spawnBubble();g.spawnT=g.spawnInterval;}
      if(g.wrongFlash>0)g.wrongFlash-=dt*3;

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H);
      const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#0a0018");bg.addColorStop(1,"#040010");
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      if(g.wrongFlash>0){ctx.fillStyle=`rgba(255,50,50,${g.wrongFlash*0.3})`;ctx.fillRect(0,0,W,H);}

      // Lane guides
      for(let i=1;i<LANES;i++){ctx.beginPath();ctx.moveTo(i*laneW,80);ctx.lineTo(i*laneW,H);ctx.strokeStyle="rgba(255,255,255,0.05)";ctx.lineWidth=1;ctx.stroke();}

      // Target color indicator at top
      const tcol=BCOLS[g.targetColor];
      ctx.save();
      ctx.shadowColor=tcol;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(W/2,50,22,0,Math.PI*2);ctx.fillStyle=tcol;ctx.fill();
      ctx.strokeStyle="#ffffff44";ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
      ctx.font="bold 11px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
      ctx.fillStyle="rgba(255,255,255,0.5)";ctx.fillText("POP "+BNAMES[g.targetColor],W/2,76);
      ctx.restore();

      // Bubbles
      g.bubbles.forEach(b=>{
        const col=BCOLS[b.color];
        const a=b.popping?b.popT*2:1;
        const r=b.popping?b.r*(1+0.5*(0.5-b.popT)):b.r;
        ctx.save();ctx.globalAlpha=Math.min(1,a);
        ctx.shadowColor=col;ctx.shadowBlur=b.color===g.targetColor?18:8;
        ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);
        ctx.fillStyle=col+(b.popping?"66":"cc");ctx.fill();
        if(!b.popping){
          // Shine
          ctx.beginPath();ctx.arc(b.x-b.r*0.25,b.y-b.r*0.3,b.r*0.38,0,Math.PI*2);
          ctx.fillStyle="rgba(255,255,255,0.35)";ctx.fill();
          // Pulse ring for target color
          if(b.color===g.targetColor){
            const pulse=0.6+Math.sin(now/300)*0.4;
            ctx.beginPath();ctx.arc(b.x,b.y,r+5*pulse,0,Math.PI*2);
            ctx.strokeStyle=col+"88";ctx.lineWidth=2;ctx.stroke();
          }
        }
        ctx.shadowBlur=0;ctx.restore();
      });

      // Combo
      if(g.combo>1){
        ctx.font="bold 14px 'Orbitron',sans-serif";ctx.textAlign="right";ctx.textBaseline="top";
        ctx.fillStyle="#ffdd00";ctx.shadowColor="#ffdd00";ctx.shadowBlur=10;
        ctx.fillText(`×${g.combo}`,W-14,90);ctx.shadowBlur=0;
      }

      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#0a0018"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(10,0,24,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🫧</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-pink-400"/><span className="text-[11px] tracking-[0.4em] text-pink-400/60 uppercase">Bubble Pop</span></div>
            <h1 className="font-display font-black text-2xl text-pink-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Colorful bubbles float upward — tap ONLY the color shown at the top. Pop 6 correct → color changes! Speed builds as you score.</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-pink-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">POPS {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-pink-300 text-lg flex items-center gap-1"><Coins size={13} className="text-pink-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
            {balance<TICKETS[0].price&&<button onClick={()=>{setBalance(1000);localStorage.setItem(BALANCE_KEY,"1000");}} className="mt-4 text-xs text-pink-400/60 underline">Refill balance (demo)</button>}
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-pink-500/30 flex items-center justify-center text-pink-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-pink-500/20"><div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-400 shadow-[0_0_8px_rgba(236,72,153,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative" onPointerDown={e=>onTapRef.current?.(e.clientX,e.clientY)}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none"/>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🫧":"💨"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-pink-400":"text-red-400"}`}>{phase==="won"?"POPPED!":"ESCAPED!"}</div><div className="text-white/60 text-sm mt-1">Pops: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-pink-500/20 border border-pink-500/40"><Coins size={16} className="text-pink-400"/><span className="font-display font-bold text-pink-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-pink-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-pink-500/20 border border-pink-500/40 text-pink-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> TRY AGAIN</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
