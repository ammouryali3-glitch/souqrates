import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";

type Phase = "select" | "playing" | "won" | "lost";
type GamePhase = "showing" | "input" | "correct" | "wrong";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_echotap_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = [
  { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 5,  time: 90 },
  { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 10, time: 80 },
  { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 17, time: 70 },
  { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 26, time: 60 },
  { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 40, time: 60 },
];
const TILE_COLORS = ["#ff4da6","#00d4ff","#ffdd00","#4dff91","#cc88ff","#ff7a00","#ff6b6b","#44ddff","#aaff44"];
const TILE_EMOJIS = ["⭐","💎","🔥","❄️","⚡","🌙","♥","🎯","✦"];

export default function EchoTapGame() {
  const TICKETS = useGameTickets("echotap", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const [litTile, setLitTile] = useState(-1);
  const [inputTile, setInputTile] = useState(-1);
  const [gPhase, setGPhase] = useState<GamePhase>("showing");
  const [patternLen, setPatternLen] = useState(3);
  const [wrongIdx, setWrongIdx] = useState(-1);

  const timerBarRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const finishedRef = useRef(false);
  const pendingTicketRef = useRef<Ticket | null>(null);
  const patternRef = useRef<number[]>([]);
  const inputRef = useRef<number[]>([]);
  const scoreRef = useRef(0);
  const patternLenRef = useRef(3);
  const gPhaseRef = useRef<GamePhase>("showing");

  const clearTimers = useCallback(()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    if(showTimeoutRef.current)clearTimeout(showTimeoutRef.current);
  },[]);

  const finishGame = useCallback((won:boolean)=>{
    if(finishedRef.current)return; finishedRef.current=true; clearTimers();
    if(!ticket)return;
    const fs=scoreRef.current;
    if(won){const nb=balance-ticket.price+ticket.prize;setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));const b=parseInt(localStorage.getItem(BEST_KEY)||"0");if(fs>b){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));}}
    else{setBalance(b2=>{const nb=Math.max(0,b2-ticket.price);localStorage.setItem(BALANCE_KEY,String(nb));return nb;});}
    setScoreDisp(fs);setPhase(won?"won":"lost");
  },[ticket,balance,clearTimers]);

  const showPattern = useCallback((pattern:number[], onDone:()=>void)=>{
    setGPhase("showing"); gPhaseRef.current="showing"; setLitTile(-1);
    let i=0;
    function showNext(){
      if(finishedRef.current)return;
      if(i>=pattern.length){setLitTile(-1);showTimeoutRef.current=setTimeout(onDone,400);return;}
      setLitTile(pattern[i]); i++;
      showTimeoutRef.current=setTimeout(()=>{setLitTile(-1);showTimeoutRef.current=setTimeout(showNext,200);},600);
    }
    showTimeoutRef.current=setTimeout(showNext,300);
  },[]);

  const startRound = useCallback((len:number)=>{
    patternLenRef.current=len; setPatternLen(len);
    const pattern=Array.from({length:len},()=>Math.floor(Math.random()*9));
    patternRef.current=pattern; inputRef.current=[];
    setInputTile(-1); setWrongIdx(-1);
    showPattern(pattern,()=>{setGPhase("input");gPhaseRef.current="input";});
  },[showPattern]);

  const handleTile = useCallback((idx:number)=>{
    if(gPhaseRef.current!=="input"||finishedRef.current) return;
    const expected=patternRef.current[inputRef.current.length];
    setInputTile(idx);
    if(idx===expected){
      inputRef.current.push(idx);
      if(inputRef.current.length===patternRef.current.length){
        setGPhase("correct"); gPhaseRef.current="correct";
        scoreRef.current++; setScoreDisp(scoreRef.current);
        if(scoreRef.current>=((ticket?.target)??99)){finishGame(true);return;}
        const nextLen=patternLenRef.current+1;
        showTimeoutRef.current=setTimeout(()=>startRound(nextLen),600);
      }
    } else {
      setWrongIdx(idx); setGPhase("wrong"); gPhaseRef.current="wrong";
      showTimeoutRef.current=setTimeout(()=>startRound(patternLenRef.current),700);
    }
  },[ticket,finishGame,startRound]);

  const startGamePlay = useCallback((t:Ticket)=>{
    finishedRef.current=false; scoreRef.current=0; patternLenRef.current=3;
    setScoreDisp(0); setTimeLeft(t.time); setWrongIdx(-1); setInputTile(-1);
    clearTimers();
    let rem=t.time;
    timerRef.current=setInterval(()=>{
      rem--; setTimeLeft(rem);
      if(timerBarRef.current){timerBarRef.current.style.width=`${(rem/t.time)*100}%`;timerBarRef.current.style.background=rem<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#8b5cf6,#ec4899)";}
      if(rem<=0){clearInterval(timerRef.current!);finishGame(scoreRef.current>=(t.target));}
    },1000);
    startRound(3);
  },[clearTimers,finishGame,startRound]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGamePlay(t);}},[phase,startGamePlay]);
  useEffect(()=>()=>{clearTimers();},[clearTimers]);

  return (
    <div className="flex-1 relative flex flex-col h-full overflow-hidden select-none" style={{background:"#0a0020"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(10,0,32,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🧠</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-purple-400"/><span className="text-[11px] tracking-[0.4em] text-purple-400/60 uppercase">Echo Tap</span></div>
            <h1 className="font-display font-black text-2xl text-purple-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Watch the sequence of glowing tiles — then tap them in the EXACT same order from memory. Each success adds another tile to the pattern!</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-purple-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">ROUNDS {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-purple-300 text-lg flex items-center gap-1"><Coins size={13} className="text-purple-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
            {balance<TICKETS[0].price&&<button onClick={()=>{setBalance(1000);localStorage.setItem(BALANCE_KEY,"1000");}} className="mt-4 text-xs text-purple-400/60 underline">Refill balance (demo)</button>}
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-purple-500/30 flex items-center justify-center text-purple-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-purple-500/20"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400 transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-5 pt-16 pb-6 gap-5">
            <div className={`text-sm font-display font-bold tracking-widest uppercase px-4 py-1.5 rounded-full border transition-all ${gPhase==="showing"?"bg-purple-500/30 border-purple-400/60 text-purple-200":gPhase==="correct"?"bg-green-500/30 border-green-400/60 text-green-200":gPhase==="wrong"?"bg-red-500/30 border-red-400/60 text-red-200":"bg-white/10 border-white/20 text-white/70"}`}>
              {gPhase==="showing"?"WATCH CAREFULLY":gPhase==="correct"?"✓ CORRECT!":gPhase==="wrong"?"✗ WRONG":"TAP THE PATTERN"}
            </div>
            <div className="text-xs text-white/30 font-display">SEQUENCE LENGTH: {patternLen}</div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-[290px]">
              {Array.from({length:9},(_,i)=>{
                const isLit=litTile===i;
                const isWrong=wrongIdx===i;
                const isInput=inputTile===i&&gPhase==="input";
                const col=TILE_COLORS[i];
                return (
                  <motion.button key={i} whileTap={gPhase==="input"?{scale:0.9}:{scale:1}}
                    onClick={()=>handleTile(i)}
                    className={`h-[82px] rounded-2xl flex items-center justify-center text-2xl transition-all duration-100 ${isLit?"border-2 scale-105":"border"} ${isWrong?"border-red-500 bg-red-500/30":""}`}
                    style={{background:isLit?col+"55":isInput?col+"33":"rgba(255,255,255,0.05)",borderColor:isLit?col:isWrong?"#ef4444":"rgba(255,255,255,0.1)",boxShadow:isLit?`0 0 20px ${col}88`:"none"}}>
                    <span className={`${isLit?"opacity-100":"opacity-40"} transition-opacity`}>{TILE_EMOJIS[i]}</span>
                  </motion.button>
                );
              })}
            </div>
            <div className="text-xs text-white/20 font-display">COMPLETED {scoreDisp} / {ticket?.target}</div>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🧠":"😵"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-purple-400":"text-red-400"}`}>{phase==="won"?"GENIUS!":"FORGOT!"}</div><div className="text-white/60 text-sm mt-1">Rounds: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-500/20 border border-purple-500/40"><Coins size={16} className="text-purple-400"/><span className="font-display font-bold text-purple-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">Lost {ticket.price} SKZ entry fee</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-purple-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{finishedRef.current=false;pendingTicketRef.current=ticket;setScoreDisp(0);setTimeLeft(ticket.time);setLitTile(-1);setGPhase("showing");setPhase("playing");}} className="w-full py-3 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> TRY AGAIN</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
