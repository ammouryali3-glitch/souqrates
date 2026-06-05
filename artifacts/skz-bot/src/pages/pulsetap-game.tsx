import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_pulsetap_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 400,  time: 60 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 800,  time: 55 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 1400, time: 50 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 2200, time: 45 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 3500, time: 40 },
];
const RING_COLS = ["#ff4da6","#00d4ff","#ffdd00","#4dff91","#cc88ff","#ff7a00"];
const TARGET_R = 55, MAX_R = 85;
interface Ring { id:number; x:number; y:number; r:number; color:string; hit:boolean; hitT:number; hitScore:number; }

export default function PulseTapGame() {
  const TICKETS = useGameTickets("pulsetap", RAW_TICKETS);
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
  const gsRef = useRef({ rings:[] as Ring[], score:0, time:60, maxTime:60, target:400, nextT:1.5, nextId:0 });

  const finishGame = useCallback((won:boolean, fs:number) => {
    if (finishedRef.current) return; finishedRef.current = true; cancelAnimationFrame(rafRef.current);
    if (!ticket) return;
    if (won) { const nb=balance-ticket.price+ticket.prize; setBalance(nb); localStorage.setItem(BALANCE_KEY,String(nb)); if(fs>best){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));} }
    else { const nb=Math.max(0,balance-ticket.price); setBalance(nb); localStorage.setItem(BALANCE_KEY,String(nb)); }
    setScoreDisp(fs); setPhase(won?"won":"lost");
  }, [ticket, balance, best]);

  const startGame = useCallback((t:Ticket) => {
    if (startingRef.current) return;
    if (!canvasRef.current) { rafRef.current=requestAnimationFrame(()=>startGame(t)); return; }
    if (canvasRef.current.offsetWidth===0) { rafRef.current=requestAnimationFrame(()=>startGame(t)); return; }
    startingRef.current=true; finishedRef.current=false;
    const g=gsRef.current;
    g.rings=[]; g.score=0; g.time=t.time; g.maxTime=t.time; g.target=t.target; g.nextT=1.5; g.nextId=0;
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width, H=canvas.height;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    function spawn() {
      const mx=60,tp=95;
      g.rings.push({id:g.nextId++,x:mx+Math.random()*(W-mx*2),y:tp+mx+Math.random()*(H-tp-mx*2),r:0,color:RING_COLS[Math.floor(Math.random()*RING_COLS.length)],hit:false,hitT:0,hitScore:0});
    }

    onTapRef.current = (px,py) => {
      if (finishedRef.current) return;
      const rect=canvas.getBoundingClientRect(), tx=px-rect.left, ty=py-rect.top;
      const best2 = g.rings.reduce<Ring|null>((acc,r)=>{
        if(r.hit) return acc;
        const d=Math.hypot(tx-r.x,ty-r.y);
        if(d<MAX_R+25&&(acc===null||d<Math.hypot(tx-acc.x,ty-acc.y))) return r;
        return acc;
      },null);
      if (best2 !== null) {
        const diff=Math.abs(best2.r-TARGET_R);
        const pts=diff<8?100:diff<20?50:diff<35?20:5;
        best2.hit=true; best2.hitT=1.2; best2.hitScore=pts;
        g.score+=pts; setScoreDisp(g.score);
        if(g.score>=g.target) finishGame(true,g.score);
      }
    };

    let last=performance.now();
    function loop(now:number) {
      if(finishedRef.current) return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#22c55e,#06b6d4)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      const grow=MAX_R/1.8;
      g.rings.forEach(r=>{if(!r.hit)r.r=Math.min(MAX_R,r.r+grow*dt);else r.hitT-=dt*2;});
      g.rings=g.rings.filter(r=>(!r.hit&&r.r<MAX_R)||(r.hit&&r.hitT>0));
      g.nextT-=dt;
      if(g.nextT<=0&&g.rings.filter(r=>!r.hit).length<3){spawn();g.nextT=Math.max(0.65,1.8-g.score*0.00015);}

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#020b14"; ctx.fillRect(0,0,W,H);
      for(let i=0;i<35;i++){const sx=((i*157.3)%1)*W,sy=((i*211.7)%1)*H;ctx.beginPath();ctx.arc(sx,sy,0.6,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,0.2)";ctx.fill();}

      g.rings.forEach(ring=>{
        if(!ring.hit){
          ctx.beginPath();ctx.arc(ring.x,ring.y,TARGET_R,0,Math.PI*2);
          ctx.strokeStyle=ring.color+"33";ctx.lineWidth=2;ctx.setLineDash([4,6]);ctx.stroke();ctx.setLineDash([]);
          const fade=Math.max(0.1,1-ring.r/MAX_R*0.6);
          ctx.shadowColor=ring.color;ctx.shadowBlur=22;
          ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2);
          ctx.strokeStyle=ring.color+Math.floor(fade*230).toString(16).padStart(2,"0");
          ctx.lineWidth=4.5;ctx.stroke();ctx.shadowBlur=0;
          // Inner glow dot
          const ir=Math.max(0,ring.r-16);
          ctx.beginPath();ctx.arc(ring.x,ring.y,ir<4?4:ir,0,Math.PI*2);
          ctx.fillStyle=ring.color+"22";ctx.fill();
        } else {
          const a=Math.max(0,ring.hitT/1.2);
          ctx.globalAlpha=a;
          ctx.shadowColor=ring.color;ctx.shadowBlur=30;
          ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r*(2-a),0,Math.PI*2);
          ctx.strokeStyle=ring.color;ctx.lineWidth=3;ctx.stroke();ctx.shadowBlur=0;
          ctx.font="bold 20px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
          const label=ring.hitScore>=100?"PERFECT!":ring.hitScore>=50?"GREAT!":ring.hitScore>=20?"GOOD":"OK";
          ctx.fillStyle=ring.hitScore>=100?"#ffdd00":ring.hitScore>=50?"#4dff91":"#ffffff";
          ctx.shadowColor=ring.color;ctx.shadowBlur=12;
          ctx.fillText(`+${ring.hitScore}`, ring.x, ring.y-(30*(1-a)));
          ctx.fillText(label,ring.x,ring.y-(60*(1-a)));
          ctx.shadowBlur=0;ctx.globalAlpha=1;
        }
      });
      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  }, [finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  const TicketList = () => <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
    <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
      <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">SCORE {tk.target} · {tk.time}S</div></div>
      <div className="text-right"><div className="font-display font-bold text-green-300 text-lg flex items-center gap-1"><Coins size={13} className="text-green-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
    </button>
  ))}</div>;

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#020b14"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(2,11,20,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🎯</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-green-400"/><span className="text-[11px] tracking-[0.4em] text-green-400/60 uppercase">Pulse Tap</span></div>
            <h1 className="font-display font-black text-2xl text-green-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Neon rings pulse and expand — tap each ring exactly when it reaches the target size for PERFECT 100pts! Timing is everything.</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-green-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <TicketList/>
            {balance<TICKETS[0].price&&<button onClick={()=>{setBalance(1000);localStorage.setItem(BALANCE_KEY,"1000");}} className="mt-4 text-xs text-green-400/60 underline">Refill balance (demo)</button>}
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-green-500/30 flex items-center justify-center text-green-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-green-500/20"><div className="h-full rounded-full bg-gradient-to-r from-green-500 to-cyan-400 shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-green-400 to-cyan-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative" onPointerDown={e=>onTapRef.current?.(e.clientX,e.clientY)}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none"/>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🎯":"⭕"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-green-400":"text-red-400"}`}>{phase==="won"?"PERFECT!":"MISSED IT!"}</div><div className="text-white/60 text-sm mt-1">Score: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-500/20 border border-green-500/40"><Coins size={16} className="text-green-400"/><span className="font-display font-bold text-green-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-green-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> TRY AGAIN</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
