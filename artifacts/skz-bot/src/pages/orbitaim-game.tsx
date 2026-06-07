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
const BEST_KEY = "skz_orbitaim_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.orbitaim;
const TARGET_COLS = ["#ff4da6","#00d4ff","#ffdd00","#4dff91","#cc88ff"];
interface OTarget { id:number; angle:number; life:number; hit:boolean; hitT:number; color:string; }
interface Burst { x:number; y:number; life:number; color:string; }

export default function OrbitAimGame() {
  const TICKETS = useGameTickets("orbitaim", RAW_TICKETS);
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
  const onTapRef = useRef<(()=>void)|null>(null);
  const gsRef = useRef({
    gunAngle:0, rotSpeed:2.2, targets:[] as OTarget[], bursts:[] as Burst[],
    score:0, combo:0, time:60, maxTime:60, target:8,
    spawnT:0, spawnInterval:1.8, nextId:0, shotFlash:0, shotOk:false,
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
    g.gunAngle=0; g.rotSpeed=2.2; g.targets=[]; g.bursts=[];
    g.score=0; g.combo=0; g.time=t.time; g.maxTime=t.time; g.target=t.target;
    g.spawnT=0; g.spawnInterval=1.8; g.nextId=0; g.shotFlash=0; g.shotOk=false;
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    const W=canvas.width, H=canvas.height;
    const cx=W/2, cy=H/2+20, ORBIT_R=Math.min(W,H)*0.36, GUN_R=24, TGT_R=18;

    function spawnTarget(){
      const occupied=g.targets.map(t2=>t2.angle);
      let a:number; let tries=0;
      do{a=Math.random()*Math.PI*2; tries++;}
      while(tries<20&&occupied.some(o=>Math.abs(a-o)<0.5));
      g.targets.push({id:g.nextId++,angle:a,life:3.5,hit:false,hitT:0,color:TARGET_COLS[Math.floor(Math.random()*TARGET_COLS.length)]});
    }

    onTapRef.current=()=>{
      if(finishedRef.current)return;
      let hit=false;
      for(const tgt of g.targets){
        if(tgt.hit) continue;
        let diff=Math.abs(tgt.angle-g.gunAngle)%(Math.PI*2);
        if(diff>Math.PI) diff=Math.PI*2-diff;
        if(diff<0.27){
          tgt.hit=true; tgt.hitT=0.8;
          const tx=cx+Math.cos(tgt.angle)*ORBIT_R, ty=cy+Math.sin(tgt.angle)*ORBIT_R;
          g.bursts.push({x:tx,y:ty,life:1,color:tgt.color});
          g.score++; g.combo++; hit=true;
          g.shotOk=true; g.shotFlash=0.4;
          g.rotSpeed=Math.min(5.5,2.2+g.score*0.06);
          setScoreDisp(g.score);
          if(g.score>=g.target){finishGame(true,g.score);return;}
          break;
        }
      }
      if(!hit){g.combo=0;g.shotOk=false;g.shotFlash=0.3;}
    };

    let last=performance.now();
    function loop(now:number){
      if(finishedRef.current)return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#f97316,#ef4444)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      g.gunAngle=(g.gunAngle+g.rotSpeed*dt)%(Math.PI*2);
      g.targets.forEach(t2=>{if(!t2.hit)t2.life-=dt;else t2.hitT-=dt*2.5;});
      g.targets=g.targets.filter(t2=>t2.life>0||t2.hitT>0);
      g.bursts.forEach(b=>b.life-=dt*2); g.bursts=g.bursts.filter(b=>b.life>0);
      if(g.shotFlash>0)g.shotFlash-=dt*3;
      g.spawnT-=dt;
      if(g.spawnT<=0&&g.targets.filter(t2=>!t2.hit).length<4){spawnTarget();g.spawnT=Math.max(0.8,g.spawnInterval-g.score*0.02);}

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H);
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,W*0.7);
      bg.addColorStop(0,"#100008");bg.addColorStop(1,"#03000a");
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      if(g.shotFlash>0){ctx.fillStyle=g.shotOk?`rgba(77,255,145,${g.shotFlash*0.2})`:`rgba(255,60,60,${g.shotFlash*0.25})`;ctx.fillRect(0,0,W,H);}

      // Orbit ring
      ctx.beginPath();ctx.arc(cx,cy,ORBIT_R,0,Math.PI*2);
      ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,ORBIT_R,0,Math.PI*2);
      ctx.strokeStyle="rgba(255,255,255,0.04)";ctx.lineWidth=12;ctx.stroke();

      // Targets
      g.targets.forEach(tgt=>{
        const tx=cx+Math.cos(tgt.angle)*ORBIT_R, ty=cy+Math.sin(tgt.angle)*ORBIT_R;
        const a=tgt.hit?Math.max(0,tgt.hitT/0.8):Math.min(1,tgt.life/0.5);
        ctx.save();ctx.globalAlpha=a;
        ctx.shadowColor=tgt.color;ctx.shadowBlur=tgt.hit?0:20;
        const scale=tgt.hit?1+0.5*(1-tgt.hitT/0.8):1;
        ctx.beginPath();ctx.arc(tx,ty,TGT_R*scale,0,Math.PI*2);
        ctx.fillStyle=tgt.hit?"transparent":tgt.color+"cc";ctx.fill();
        ctx.strokeStyle=tgt.color;ctx.lineWidth=2;ctx.stroke();
        ctx.shadowBlur=0;
        if(!tgt.hit){
          // Pulsing inner dot
          ctx.beginPath();ctx.arc(tx,ty,6,0,Math.PI*2);ctx.fillStyle=tgt.color;ctx.fill();
          // Life indicator arc
          const lifeA=-Math.PI/2+2*Math.PI*(1-tgt.life/3.5);
          ctx.beginPath();ctx.arc(tx,ty,TGT_R+6,-Math.PI/2,lifeA);
          ctx.strokeStyle=tgt.color+"66";ctx.lineWidth=3;ctx.stroke();
        }
        ctx.restore();
      });

      // Bursts
      g.bursts.forEach(b=>{
        for(let i=0;i<8;i++){
          const a=(i/8)*Math.PI*2, r=(1-b.life)*40;
          ctx.beginPath();ctx.arc(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r,3*b.life,0,Math.PI*2);
          ctx.fillStyle=b.color+Math.floor(b.life*200).toString(16).padStart(2,"0");
          ctx.shadowColor=b.color;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
        }
      });

      // Gun line + gun circle
      const gx=cx+Math.cos(g.gunAngle)*GUN_R, gy=cy+Math.sin(g.gunAngle)*GUN_R;
      const gex=cx+Math.cos(g.gunAngle)*(ORBIT_R-TGT_R-8), gey=cy+Math.sin(g.gunAngle)*(ORBIT_R-TGT_R-8);
      ctx.shadowColor="#ff7a00";ctx.shadowBlur=15;
      ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gex,gey);
      ctx.strokeStyle="#ff7a00cc";ctx.lineWidth=3;ctx.stroke();ctx.shadowBlur=0;
      // Center
      ctx.shadowColor="#ff7a00";ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(cx,cy,GUN_R,0,Math.PI*2);
      ctx.fillStyle="#1a0800";ctx.fill();ctx.strokeStyle="#ff7a00";ctx.lineWidth=2.5;ctx.stroke();
      ctx.fillStyle="#ff7a00";ctx.font="bold 18px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("🎯",cx,cy);ctx.shadowBlur=0;

      // Combo
      if(g.combo>1){ctx.font="bold 14px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";ctx.fillStyle="#ffdd00";ctx.shadowColor="#ffdd00";ctx.shadowBlur=10;ctx.fillText(`×${g.combo} COMBO`,cx,H*0.82);ctx.shadowBlur=0;}
      ctx.font="bold 11px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";ctx.fillStyle="rgba(255,255,255,0.3)";ctx.fillText("TAP TO FIRE",cx,H*0.82);

      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#100008"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(16,0,8,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🎯</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-orange-400"/><span className="text-[11px] tracking-[0.4em] text-orange-400/60 uppercase">Orbit Aim</span></div>
            <h1 className="font-display font-black text-2xl text-orange-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">A rotating gun sweeps around the orbit ring. Targets appear at random angles — tap to fire exactly when the gun aligns with a target!</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-orange-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={() => requestEntry(tk)} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">HITS {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-orange-300 text-lg flex items-center gap-1"><Coins size={13} className="text-orange-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
          </motion.div>
        </motion.div>)}
        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={requestExit} className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-orange-500/30 flex items-center justify-center text-orange-300"><ArrowLeft size={15}/></button>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-orange-500/20"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-400 transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative" onPointerDown={()=>onTapRef.current?.()}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none"/>
          </div>
        </motion.div>)}
        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🎯":"💫"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-orange-400":"text-red-400"}`}>{phase==="won"?"LOCKED ON!":"MISSED!"}</div><div className="text-white/60 text-sm mt-1">Hits: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-500/20 border border-orange-500/40"><Coins size={16} className="text-orange-400"/><span className="font-display font-bold text-orange-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-orange-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> {gt[getLang()].gamePlayAgain}</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
      {overlays}
    </div>
  );
}
