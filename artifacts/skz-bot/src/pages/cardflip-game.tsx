import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameTickets } from "@/lib/game-economy";
import { getLang, t as gt } from "@/lib/i18n";
import { GAME_TICKETS } from "@/lib/tickets-data";

type Phase = "select" | "playing" | "won" | "lost";
interface Ticket { id: string; name: string; price: number; prize: number; target: number; time: number; }
const BEST_KEY = "skz_cardflip_best", BALANCE_KEY = "skz_balance";
const RAW_TICKETS: Ticket[] = GAME_TICKETS.cardflip;
const ICONS = ["🌟","💎","🔥","❄️","⚡","🌙","🎯","🚀"];
const ICON_COLORS = ["#ffdd00","#00d4ff","#ff7a00","#88ddff","#ffee44","#cc88ff","#ff4da6","#4dff91"];

interface Card { id:number; icon:string; color:string; faceUp:boolean; matched:boolean; }

function makeBoard(): Card[] {
  const cards: Card[] = [];
  ICONS.forEach((ic,i)=>{
    cards.push({id:i*2,icon:ic,color:ICON_COLORS[i],faceUp:false,matched:false});
    cards.push({id:i*2+1,icon:ic,color:ICON_COLORS[i],faceUp:false,matched:false});
  });
  for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}

export default function CardFlipGame() {
  const TICKETS = useGameTickets("cardflip", RAW_TICKETS);
  const [phase, setPhase] = useState<Phase>("select");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [balance, setBalance] = useState(() => parseInt(localStorage.getItem(BALANCE_KEY) || "1000"));
  const [best, setBest] = useState(() => parseInt(localStorage.getItem(BEST_KEY) || "0"));
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [matched, setMatched] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [correctFlash, setCorrectFlash] = useState(false);

  const timerBarRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const finishedRef = useRef(false);
  const pendingTicketRef = useRef<Ticket | null>(null);
  const scoreRef = useRef(0);
  const flippedRef = useRef<number[]>([]);
  const lockRef = useRef(false);

  const clearTimers = useCallback(()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    if(flipTimeoutRef.current)clearTimeout(flipTimeoutRef.current);
  },[]);

  const finishGame = useCallback((won:boolean)=>{
    if(finishedRef.current)return; finishedRef.current=true; clearTimers();
    if(!ticket)return;
    const fs=scoreRef.current;
    if(won){const nb=balance-ticket.price+ticket.prize;setBalance(nb);localStorage.setItem(BALANCE_KEY,String(nb));const b=parseInt(localStorage.getItem(BEST_KEY)||"0");if(fs>b){setBest(fs);localStorage.setItem(BEST_KEY,String(fs));}}
    else{setBalance(b2=>{const nb=Math.max(0,b2-ticket.price);localStorage.setItem(BALANCE_KEY,String(nb));return nb;});}
    setScoreDisp(fs);setPhase(won?"won":"lost");
  },[ticket,balance,clearTimers]);

  const newBoard = useCallback(()=>{
    const b=makeBoard(); setCards(b); flippedRef.current=[]; lockRef.current=false;
  },[]);

  const handleCard = useCallback((cardIdx:number)=>{
    if(lockRef.current||finishedRef.current)return;
    setCards(prev=>{
      const card=prev[cardIdx];
      if(card.faceUp||card.matched)return prev;
      const next=[...prev];
      next[cardIdx]={...card,faceUp:true};
      flippedRef.current.push(cardIdx);
      if(flippedRef.current.length===2){
        lockRef.current=true;
        const [a,b2]=flippedRef.current;
        if(next[a].icon===next[b2].icon){
          // Match!
          flipTimeoutRef.current=setTimeout(()=>{
            setCards(c=>{const n=[...c];n[a]={...n[a],matched:true};n[b2]={...n[b2],matched:true};return n;});
            scoreRef.current++; setScoreDisp(scoreRef.current);
            setCorrectFlash(true); setTimeout(()=>setCorrectFlash(false),300);
            flippedRef.current=[]; lockRef.current=false;
            setMatched(m=>{
              const nm=m+1;
              if(nm>=8){// Board complete → new board
                setMatched(0);
                setTimeout(()=>newBoard(),400);
              }
              return nm;
            });
            if(scoreRef.current>=(ticket?.target??99)){finishGame(true);}
          },300);
        } else {
          // No match
          flipTimeoutRef.current=setTimeout(()=>{
            setCards(c=>{const n=[...c];n[a]={...n[a],faceUp:false};n[b2]={...n[b2],faceUp:false};return n;});
            setWrongFlash(true); setTimeout(()=>setWrongFlash(false),300);
            flippedRef.current=[]; lockRef.current=false;
          },700);
        }
      }
      return next;
    });
  },[ticket,finishGame,newBoard]);

  const startGamePlay = useCallback((t:Ticket)=>{
    finishedRef.current=false; scoreRef.current=0; flippedRef.current=[]; lockRef.current=false;
    setScoreDisp(0); setTimeLeft(t.time); setMatched(0);
    newBoard(); clearTimers();
    let rem=t.time;
    timerRef.current=setInterval(()=>{
      rem--; setTimeLeft(rem);
      if(timerBarRef.current){timerBarRef.current.style.width=`${(rem/t.time)*100}%`;timerBarRef.current.style.background=rem<=8?"linear-gradient(to right,#ef4444,#dc2626)":"linear-gradient(to right,#10b981,#06b6d4)";}
      if(rem<=0){clearInterval(timerRef.current!);finishGame(scoreRef.current>=t.target);}
    },1000);
  },[clearTimers,finishGame,newBoard]);

  useEffect(()=>{const t=pendingTicketRef.current;if(phase==="playing"&&t){pendingTicketRef.current=null;startGamePlay(t);}},[phase,startGamePlay]);
  useEffect(()=>()=>{clearTimers();},[clearTimers]);

  return (
    <div className={`flex-1 relative flex flex-col h-full overflow-hidden select-none transition-colors duration-200 ${wrongFlash?"bg-red-950":correctFlash?"bg-green-950":""}` } style={{background:wrongFlash?"#1a0505":correctFlash?"#051a08":"#030d0a"}}>
      <AnimatePresence mode="wait">
        {phase==="select"&&(<motion.div key="sel" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-40 flex flex-col px-6 pt-10 pb-6 overflow-y-auto" style={{background:"rgba(3,13,10,0.97)"}}>
          <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} className="flex flex-col items-center text-center w-full max-w-[340px] mx-auto">
            <Link href="/games"><button className="self-start mb-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ArrowLeft size={18} className="text-white/70"/></button></Link>
            <div className="text-4xl mb-2">🃏</div>
            <div className="flex items-center gap-2 mb-2"><Trophy size={14} className="text-emerald-400"/><span className="text-[11px] tracking-[0.4em] text-emerald-400/60 uppercase">Card Flip</span></div>
            <h1 className="font-display font-black text-2xl text-emerald-300 mb-3">CHOOSE YOUR TICKET</h1>
            <p className="text-xs text-white/50 mb-4 max-w-[260px]">Flip cards to find matching pairs from memory! Complete the full board → it resets with all cards reshuffled. How many pairs can you match?</p>
            <div className="flex items-center gap-2 mb-6 bg-white/5 rounded-full px-4 py-2"><Coins size={14} className="text-emerald-400"/><span className="font-display font-bold text-white">{balance.toLocaleString()} SKZ</span></div>
            <div className="flex flex-col gap-3 w-full">{TICKETS.map(tk=>(
              <button key={tk.id} disabled={balance<tk.price} onClick={()=>{setTicket(tk);pendingTicketRef.current=tk;setPhase("playing");}} className="flex items-center justify-between px-5 py-3.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
                <div className="text-left"><div className="font-display font-bold text-white text-base">{tk.name}</div><div className="text-xs text-white/40">PAIRS {tk.target} · {tk.time}S</div></div>
                <div className="text-right"><div className="font-display font-bold text-emerald-300 text-lg flex items-center gap-1"><Coins size={13} className="text-emerald-400"/>{tk.prize}</div><div className="text-xs text-white/40">ENTRY {tk.price}</div></div>
              </button>
            ))}</div>
          </motion.div>
        </motion.div>)}

        {phase==="playing"&&(<motion.div key="play" initial={{opacity:0}} animate={{opacity:1}} className="relative flex-1 flex flex-col h-full">
          <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/games"><button className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-emerald-500/30 flex items-center justify-center text-emerald-300"><ArrowLeft size={15}/></button></Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-emerald-500/20"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-[width] duration-300" style={{width:`${ticket?Math.min(100,(scoreDisp/ticket.target)*100):0}%`}}/></div>
                <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden"><div ref={timerBarRef} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-none" style={{width:"100%"}}/></div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-4 gap-3">
            <div className="text-xs text-white/30 font-display">PAIRS {scoreDisp} / {ticket?.target}</div>
            <div className="grid grid-cols-4 gap-2.5 w-full max-w-[320px]">
              {cards.map((card,i)=>(
                <motion.button key={i} onClick={()=>handleCard(i)}
                  animate={{rotateY:card.faceUp||card.matched?0:180,scale:card.matched?0.92:1}}
                  transition={{duration:0.2}}
                  className={`h-[72px] rounded-2xl flex items-center justify-center text-2xl font-bold border transition-colors duration-200 ${card.matched?"opacity-50 scale-95":""}`}
                  style={{background:card.faceUp||card.matched?card.color+"33":"rgba(255,255,255,0.07)",borderColor:card.faceUp||card.matched?card.color+"66":"rgba(255,255,255,0.1)",boxShadow:card.faceUp&&!card.matched?`0 0 16px ${card.color}66`:"none",transformStyle:"preserve-3d"}}>
                  {(card.faceUp||card.matched)?card.icon:""}
                </motion.button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/20 font-display">
              <span>BOARD: {matched}/8</span><span>·</span><span>{timeLeft}S LEFT</span>
            </div>
          </div>
        </motion.div>)}

        {(phase==="won"||phase==="lost")&&ticket&&(<motion.div key="res" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="flex flex-col items-center justify-center h-full px-6 gap-5">
          <div className="text-7xl">{phase==="won"?"🃏":"⌛"}</div>
          <div className="text-center"><div className={`font-display font-black text-4xl uppercase ${phase==="won"?"text-emerald-400":"text-red-400"}`}>{phase==="won"?"MATCHED!":"TIME'S UP!"}</div><div className="text-white/60 text-sm mt-1">Pairs: {scoreDisp} / {ticket.target}</div></div>
          {phase==="won"?<div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40"><Coins size={16} className="text-emerald-400"/><span className="font-display font-bold text-emerald-300 text-lg">+{ticket.prize} SKZ</span></div>:<div className="text-white/40 text-sm">{gt[getLang()].gameEntryLost(ticket.price)}</div>}
          <div className="text-xs text-white/30 font-display">Balance: {balance.toLocaleString()} SKZ</div>
          {best>0&&<div className="text-xs text-emerald-400/50 font-display flex items-center gap-1"><Trophy size={11}/>Best: {best}</div>}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={()=>{finishedRef.current=false;pendingTicketRef.current=ticket;setScoreDisp(0);setTimeLeft(ticket.time);setPhase("playing");}} className="w-full py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-display font-bold tracking-wide text-sm flex items-center justify-center gap-2"><RotateCcw size={16}/> {gt[getLang()].gamePlayAgain}</button>
            <Link href="/games"><button className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-display font-bold tracking-wide text-sm">← BACK</button></Link>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
