import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_mergeblitz_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.mergeblitz;

const TILE_COLORS: Record<number, string> = {
  2:"#4a90d9",4:"#5ba3e8",8:"#f5a623",16:"#e8742a",32:"#e84a2a",
  64:"#e82a2a",128:"#d4b84a",256:"#d4a830",512:"#cc8820",1024:"#c07010",2048:"#b85800",
};

function slideRow(row: number[]): { row: number[]; score: number } {
  const nz = row.filter(x => x > 0); let pts = 0; const merged: number[] = []; let i = 0;
  while (i < nz.length) {
    if (i + 1 < nz.length && nz[i] === nz[i + 1]) { const v = nz[i] * 2; merged.push(v); pts += v; i += 2; }
    else { merged.push(nz[i]); i++; }
  }
  while (merged.length < 4) merged.push(0);
  return { row: merged, score: pts };
}

function moveGrid(grid: number[], dir: "left"|"right"|"up"|"down"): { grid: number[]; score: number } {
  const g = [...grid]; let totalScore = 0;
  if (dir === "left" || dir === "right") {
    for (let r = 0; r < 4; r++) {
      let row = g.slice(r*4,(r+1)*4);
      if (dir === "right") row.reverse();
      const res = slideRow(row); totalScore += res.score;
      if (dir === "right") res.row.reverse();
      for (let c = 0; c < 4; c++) g[r*4+c] = res.row[c];
    }
  } else {
    for (let c = 0; c < 4; c++) {
      let col = [g[c],g[4+c],g[8+c],g[12+c]];
      if (dir === "down") col.reverse();
      const res = slideRow(col); totalScore += res.score;
      if (dir === "down") res.row.reverse();
      for (let r = 0; r < 4; r++) g[r*4+c] = res.row[r];
    }
  }
  return { grid: g, score: totalScore };
}

function addRandom(grid: number[]): number[] {
  const empty = grid.map((v,i)=>v===0?i:-1).filter(i=>i>=0);
  if (empty.length === 0) return grid;
  const idx = empty[Math.floor(Math.random()*empty.length)];
  const g = [...grid]; g[idx] = Math.random()<0.85?2:4; return g;
}

function initGrid(): number[] {
  let g = Array(16).fill(0); g = addRandom(g); g = addRandom(g); return g;
}

export default function MergeBlitzGame() {
  const TICKETS = useGameTickets("mergeblitz", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [grid, setGrid] = useState<number[]>(Array(16).fill(0));

  const timerBarRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const finishedRef = useRef(false);
  const pendingTicketRef = useRef<Ticket | null>(null);
  const scoreRef = useRef(0);
  const gridRef = useRef<number[]>(Array(16).fill(0));
  const downRef = useRef<{x:number;y:number}|null>(null);

  const finishGame = useCallback((won:boolean)=>{
    if(finishedRef.current)return; finishedRef.current=true;
    if(timerRef.current)clearInterval(timerRef.current);
    if(!ticket)return;
    const fs=scoreRef.current;
    if(won){const nb=balance-ticket.price+ticket.prize;setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));const b=parseInt(localStorage.getItem(BEST_KEY)||"0");if(fs>b){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));}}
    else{setBalance(b2=>{const nb=Math.max(0,b2-ticket.price);localStorage.setItem(BALANCE_KEY,String(nb));return nb;});}
    setScoreDisp(fs);setPhase(won?"won":"lost");
  },[ticket,balance]);

  const doMove = useCallback((dir:"left"|"right"|"up"|"down")=>{
    if(finishedRef.current)return;
    const {grid:ng,score:pts}=moveGrid(gridRef.current,dir);
    const changed=ng.some((v,i)=>v!==gridRef.current[i]);
    if(!changed)return;
    const final=addRandom(ng);
    scoreRef.current+=pts;
    gridRef.current=final; setGrid(final);
    if(pts>0)setScoreDisp(scoreRef.current);
    if(scoreRef.current>=(ticket?.target??999999)){finishGame(true);return;}
  },[ticket,finishGame]);

  const handleDown = useCallback((x:number,y:number)=>{downRef.current={x,y};},[]);
  const handleUp = useCallback((x:number,y:number)=>{
    if(!downRef.current)return;
    const dx=x-downRef.current.x, dy=y-downRef.current.y;
    downRef.current=null;
    if(Math.abs(dx)<18&&Math.abs(dy)<18)return;
    if(Math.abs(dx)>Math.abs(dy))doMove(dx>0?"right":"left");
    else doMove(dy>0?"down":"up");
  },[doMove]);

  const startGamePlay = useCallback((t:Ticket)=>{
    finishedRef.current=false; scoreRef.current=0;
    const g=initGrid(); gridRef.current=g; setGrid(g);
    setScoreDisp(0); setTimeLeft(t.time);
    if(timerRef.current)clearInterval(timerRef.current);
    let rem=t.time;
    timerRef.current=setInterval(()=>{
      rem--; setTimeLeft(rem);
      if(timerBarRef.current){timerBarRef.current.style.width=`${(rem/t.time)*100}%`;timerBarRef.current.style.background=rem<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#f59e0b,#f97316)";}
      if(rem<=0){clearInterval(timerRef.current!);finishGame(scoreRef.current>=t.target);}
    },1000);
  },[finishGame]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGamePlay(t);}},[phase,startGamePlay]);
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);

  function tileColor(v:number){return TILE_COLORS[v]||(v>2048?"#a06800":"rgba(255,255,255,0.06)");}
  function tileBg(v:number){return v===0?"rgba(255,255,255,0.04)":tileColor(v)+"dd";}

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#0c0800"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(12,8,0,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">2️⃣0️⃣4️⃣8️⃣</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-amber-400"/><span className="text-[11px] tracking-[0.4em] text-amber-400/60 uppercase">Merge Blitz</span></div>
            <h1 className="font-display font-black text-2xl text-amber-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Classic 2048 under extreme time pressure! Swipe to merge matching tiles — reach the score target before the clock hits zero!</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-amber-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">SCORE {tk.target.toLocaleString()} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-amber-300 text-lg flex items-center gap-1"><Coins size={13} className="text-amber-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-amber-500/30 flex items-center justify-center text-amber-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-amber-500/20"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-4 gap-4"
            onPointerDown={e=>handleDown(e.clientX,e.clientY)}
            onPointerUp={e=>handleUp(e.clientX,e.clientY)}>
            <div className="flex items-center gap-3 text-xs font-display text-white/40 uppercase tracking-widest">
              <span>{gt[getLang()].gameScore}</span><span className="text-amber-400 font-bold text-sm">{scoreDisp.toLocaleString()}</span>
              <span className="ml-3">Target</span><span className="text-white/60 font-bold text-sm">{ticket?.target.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 w-full max-w-[320px]">
              {grid.map((v,i)=>(
                <div key={i} className="aspect-square rounded-xl flex items-center justify-center font-display font-black transition-all duration-100"
                  style={{background:tileBg(v),boxShadow:v>0?`0 0 12px ${tileColor(v)}44`:"none",fontSize:v>=1024?"16px":v>=128?"20px":"24px",color:v>=64?"#fff":"#e2d5b8"}}>
                  {v>0?v:""}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/20 font-display tracking-widest">SWIPE TO MERGE</p>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🏆":"⏱️"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-amber-400":"text-red-400"}`}>{phase==="won"?"MERGED!":"TIME'S UP!"}</div><div className="text-white/60 text-sm mt-1">Score: {scoreDisp.toLocaleString()} / {ticket.target.toLocaleString()}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/40"><Coins size={16} className="text-amber-400"/><span className="font-display font-bold text-amber-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-amber-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{finishedRef.current=false;pendingTicketRef.current=ticket;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> {gt[getLang()].gamePlayAgain}</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
