import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_stackdrop_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.stackdrop;
const BLOCK_COLORS = ["#ff4da6","#00d4ff","#ffdd00","#4dff91","#cc88ff","#ff7a00","#44ffee","#ff6677"];
const BH = 36;

interface Block { x:number; width:number; color:string; }
interface CutPiece { x:number; width:number; y:number; vy:number; color:string; }

export default function StackDropGame() {
  const TICKETS = useGameTickets("stackdrop", RAW_TICKETS);
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
    stack:[] as Block[], platform:{x:0,width:140,dir:1,speed:150},
    cutPiece:null as CutPiece|null, score:0, time:60, maxTime:60, target:8, colorIdx:0,
    missFlash:0, perfectFlash:0,
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
    const canvas=canvasRef.current!; canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
    const W=canvas.width;
    const initW=Math.min(180,W*0.45);
    g.stack=[{x:(W-initW)/2,width:initW,color:BLOCK_COLORS[0]}];
    g.platform={x:(W-initW)/2,width:initW,dir:1,speed:150};
    g.cutPiece=null; g.score=0; g.time=t.time; g.maxTime=t.time; g.target=t.target;
    g.colorIdx=1; g.missFlash=0; g.perfectFlash=0;
    lastSecRef.current=Date.now(); setScoreDisp(0); setTimeLeft(t.time); startingRef.current=false;

    onTapRef.current=()=>{
      if(finishedRef.current) return;
      const p=g.platform, top=g.stack[g.stack.length-1];
      const left=Math.max(p.x,top.x), right=Math.min(p.x+p.width,top.x+top.width);
      const overlap=right-left;
      if(overlap<=4){
        // Miss - penalty: -3 seconds
        g.missFlash=0.5;
        g.time=Math.max(1,g.time-3); setTimeLeft(g.time);
        if(timerBarRef.current)timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;
        // reset platform to current top width
        g.platform={x:top.x,width:top.width,dir:Math.random()<0.5?1:-1,speed:Math.min(350,150+g.score*12)};
        return;
      }
      const newBlock:Block={x:left,width:overlap,color:BLOCK_COLORS[g.colorIdx%BLOCK_COLORS.length]};
      // Cut piece
      if(p.x<top.x){g.cutPiece={x:p.x,width:top.x-p.x,y:0,vy:0,color:BLOCK_COLORS[(g.colorIdx-1)%BLOCK_COLORS.length]};}
      else if(p.x+p.width>top.x+top.width){g.cutPiece={x:top.x+top.width,width:p.x+p.width-(top.x+top.width),y:0,vy:0,color:BLOCK_COLORS[(g.colorIdx-1)%BLOCK_COLORS.length]};}
      const perfect=overlap/top.width>0.9;
      if(perfect)g.perfectFlash=0.5;
      g.stack.push(newBlock);
      g.score++; g.colorIdx++;
      setScoreDisp(g.score);
      g.platform={x:newBlock.x-(W*0.4),width:newBlock.width,dir:1,speed:Math.min(350,150+g.score*12)};
      if(g.score>=g.target){finishGame(true,g.score);}
    };

    let last=performance.now();
    function loop(now:number){
      if(finishedRef.current)return;
      const dt=Math.min((now-last)/1000,0.05); last=now;
      const n2=Date.now();
      if(n2-lastSecRef.current>=1000){
        lastSecRef.current=n2; g.time=Math.max(0,g.time-1); setTimeLeft(g.time);
        if(timerBarRef.current){timerBarRef.current.style.width=`${(g.time/g.maxTime)*100}%`;timerBarRef.current.style.background=g.time<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#06b6d4,#a855f7)";}
        if(g.time<=0){finishGame(g.score>=g.target,g.score);return;}
      }
      const W2=canvas.width, H=canvas.height;
      const p=g.platform;
      p.x+=p.dir*p.speed*dt;
      if(p.x+p.width>W2){p.x=W2-p.width;p.dir=-1;}
      if(p.x<0){p.x=0;p.dir=1;}
      if(g.cutPiece){g.cutPiece.y+=g.cutPiece.vy*dt;g.cutPiece.vy+=400*dt;if(g.cutPiece.y>H+80)g.cutPiece=null;}
      if(g.missFlash>0)g.missFlash-=dt*2;
      if(g.perfectFlash>0)g.perfectFlash-=dt*2;

      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W2,H);
      const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#030a1a");bg.addColorStop(1,"#010208");
      ctx.fillStyle=bg;ctx.fillRect(0,0,W2,H);
      if(g.missFlash>0){ctx.fillStyle=`rgba(255,60,60,${g.missFlash*0.3})`;ctx.fillRect(0,0,W2,H);}
      if(g.perfectFlash>0){ctx.fillStyle=`rgba(255,220,50,${g.perfectFlash*0.25})`;ctx.fillRect(0,0,W2,H);}

      // PLAT_Y = 140 on screen, block i screen Y = 140 + BH + (n-1-i)*BH
      const PLAT_Y=140;
      const n=g.stack.length;

      // Draw stack
      g.stack.forEach((blk,i)=>{
        const sy=PLAT_Y+BH+(n-1-i)*BH;
        if(sy>H+BH||sy<-BH)return;
        const col=blk.color;
        ctx.beginPath();ctx.roundRect(blk.x,sy,blk.width,BH,4);
        ctx.fillStyle=col+"cc";ctx.fill();
        ctx.beginPath();ctx.roundRect(blk.x+3,sy+4,blk.width-6,BH*0.3,3);
        ctx.fillStyle="rgba(255,255,255,0.25)";ctx.fill();
        ctx.shadowColor=col;ctx.shadowBlur=8;
        ctx.beginPath();ctx.roundRect(blk.x,sy,blk.width,BH,4);
        ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
      });

      // Platform
      const pcol=BLOCK_COLORS[g.colorIdx%BLOCK_COLORS.length];
      ctx.beginPath();ctx.roundRect(p.x,PLAT_Y,p.width,BH,4);
      ctx.fillStyle=pcol+"cc";ctx.fill();
      ctx.beginPath();ctx.roundRect(p.x+3,PLAT_Y+4,p.width-6,BH*0.3,3);
      ctx.fillStyle="rgba(255,255,255,0.3)";ctx.fill();
      ctx.shadowColor=pcol;ctx.shadowBlur=15;
      ctx.beginPath();ctx.roundRect(p.x,PLAT_Y,p.width,BH,4);
      ctx.strokeStyle=pcol;ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
      // Arrow indicator
      ctx.font="bold 12px 'Orbitron',sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
      ctx.fillStyle="rgba(255,255,255,0.5)";ctx.fillText("TAP TO DROP",W2/2,PLAT_Y-22);

      // Cut piece
      if(g.cutPiece){
        const cp=g.cutPiece;
        ctx.save();ctx.globalAlpha=0.6;
        ctx.beginPath();ctx.roundRect(cp.x,PLAT_Y+BH+cp.y,cp.width,BH*0.6,3);
        ctx.fillStyle=cp.color+"88";ctx.fill();ctx.restore();
      }

      // Ground line
      const gndY=PLAT_Y+BH+n*BH;
      if(gndY<H){ctx.beginPath();ctx.moveTo(0,gndY);ctx.lineTo(W2,gndY);ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.lineWidth=1;ctx.stroke();}

      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGame(t);}},[phase,startGame]);
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);},[]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#030a1a"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(3,10,26,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🏗️</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-cyan-400"/><span className="text-[11px] tracking-[0.4em] text-cyan-400/60 uppercase">Stack Drop</span></div>
            <h1 className="font-display font-black text-2xl text-cyan-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">A sliding block sweeps left and right — tap to drop it! Align perfectly for a PERFECT bonus. Miss = −3 seconds penalty. Build the tower!</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-cyan-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">BLOCKS {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-cyan-300 text-lg flex items-center gap-1"><Coins size={13} className="text-cyan-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-cyan-500/30 flex items-center justify-center text-cyan-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-cyan-500/20"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-400 shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative" onPointerDown={()=>onTapRef.current?.()}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none"/>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🏗️":"💥"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-cyan-400":"text-red-400"}`}>{phase==="won"?"STACKED!":"COLLAPSED!"}</div><div className="text-white/60 text-sm mt-1">Blocks: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40"><Coins size={16} className="text-cyan-400"/><span className="font-display font-bold text-cyan-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-cyan-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{pendingTicketRef.current=ticket;startingRef.current=false;finishedRef.current=false;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> {gt[getLang()].gamePlayAgain}</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
