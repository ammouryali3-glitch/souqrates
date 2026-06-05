// Single source of truth for skill-game ticket tiers.
// Edited live by the manager via per-ticket overrides (see admin-store + game-economy).
// Each game imports its array from here so the manager and gameplay share one source.

export interface BaseTicket {
  id: string;
  name: string;
  price: number; // entry cost in SKZ
  prize: number; // payout on win
  target: number; // score needed to win
  time: number; // seconds allowed
  preKnives?: number; // knife-game only
  targetSum?: number; // chain-sum only
}

export const GAME_TICKETS = {
  breakout: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 50,  time: 50 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 80,  time: 48 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 110, time: 45 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 150, time: 42 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 200, time: 40 },
  ],
  bubble: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 40,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 65,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 90,  time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 120, time: 48 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 160, time: 45 },
  ],
  bubblepop: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 20,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 40,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 70,  time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 110, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 170, time: 40 },
  ],
  calcblast: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 12, time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 20, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 32, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 48, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 68, time: 40 },
  ],
  cardflip: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 16, time: 60 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 28, time: 60 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 44, time: 60 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 68, time: 60 },
  ],
  chainsum: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 6,  time: 60, targetSum: 10 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 10, time: 55, targetSum: 12 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 15, time: 50, targetSum: 15 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 22, time: 45, targetSum: 18 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 30, time: 40, targetSum: 20 },
  ],
  color: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
  ],
  colorrain: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 20,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 40,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 70,  time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 110, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 170, time: 40 },
  ],
  echotap: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 5,  time: 90 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 10, time: 80 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 17, time: 70 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 26, time: 60 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 40, time: 60 },
  ],
  fracsort: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 12, time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 20, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 30, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 45, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 65, time: 40 },
  ],
  gridpop: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 200,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 450,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 850,  time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 1500, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 2500, time: 40 },
  ],
  hopper: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 20, time: 50 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 35, time: 48 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 55, time: 45 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 80, time: 42 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 120, time: 40 },
  ],
  knife: [
    { id: "rookie", name: "Rookie", price: 30, prize: 55, target: 8, time: 35, preKnives: 2 },
    { id: "bronze", name: "Bronze", price: 75, prize: 140, target: 11, time: 33, preKnives: 2 },
    { id: "silver", name: "Silver", price: 150, prize: 320, target: 14, time: 31, preKnives: 3 },
    { id: "gold", name: "Gold", price: 350, prize: 800, target: 17, time: 30, preKnives: 4 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 20, time: 28, preKnives: 5 },
  ],
  match3: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 150,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 300,  time: 60 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 550,  time: 60 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 900,  time: 55 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 1400, time: 55 },
  ],
  mergeblitz: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 500,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 1000, time: 60 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 2000, time: 55 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 4000, time: 50 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 8000, time: 45 },
  ],
  neonlink: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 6,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 20, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 30, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 45, time: 40 },
  ],
  numblitz: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 30,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 60,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 100, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 160, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 250, time: 40 },
  ],
  numsmash: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 15, time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 25, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 38, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 55, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 75, time: 40 },
  ],
  orbit: [
    { id: "rookie", name: "Rookie", price: 25, prize: 45, target: 6, time: 30 },
    { id: "bronze", name: "Bronze", price: 50, prize: 95, target: 9, time: 32 },
    { id: "silver", name: "Silver", price: 120, prize: 255, target: 12, time: 34 },
    { id: "gold", name: "Gold", price: 300, prize: 680, target: 16, time: 36 },
    { id: "diamond", name: "Diamond", price: 750, prize: 1850, target: 20, time: 40 },
  ],
  orbitaim: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 16, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 27, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 42, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 64, time: 40 },
  ],
  piano: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
  ],
  pulsetap: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 400,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 800,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 1400, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 2200, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 3500, time: 40 },
  ],
  quicksum: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 15, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 25, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 38, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 55, time: 40 },
  ],
  slice: [
    { id: "rookie", name: "Rookie", price: 30, prize: 55, target: 8, time: 35 },
    { id: "bronze", name: "Bronze", price: 75, prize: 140, target: 12, time: 33 },
    { id: "silver", name: "Silver", price: 150, prize: 320, target: 16, time: 31 },
    { id: "gold", name: "Gold", price: 350, prize: 800, target: 20, time: 30 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 26, time: 28 },
  ],
  speedmath: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 100, time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 180, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 280, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 420, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 600, time: 40 },
  ],
  stack: [
    { id: "rookie", name: "Rookie", price: 25, prize: 45, target: 8, time: 24 },
    { id: "bronze", name: "Bronze", price: 50, prize: 95, target: 12, time: 26 },
    { id: "silver", name: "Silver", price: 120, prize: 255, target: 16, time: 28 },
    { id: "gold", name: "Gold", price: 300, prize: 680, target: 22, time: 30 },
    { id: "diamond", name: "Diamond", price: 750, prize: 1850, target: 30, time: 32 },
  ],
  stackdrop: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 15, time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 25, time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 40, time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 60, time: 40 },
  ],
  striker: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 20, time: 40 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 35, time: 38 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 55, time: 36 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 80, time: 34 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 120, time: 32 },
  ],
  swiperush: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 150,  time: 60 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 300,  time: 55 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 500,  time: 50 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 800,  time: 45 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 1200, time: 40 },
  ],
  whack: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
  ],
  zigzag: [
    { id: "rookie",  name: "Rookie",  price: 30,  prize: 55,   target: 8,  time: 35 },
    { id: "bronze",  name: "Bronze",  price: 75,  prize: 140,  target: 12, time: 33 },
    { id: "silver",  name: "Silver",  price: 150, prize: 320,  target: 16, time: 31 },
    { id: "gold",    name: "Gold",    price: 350, prize: 800,  target: 20, time: 30 },
    { id: "diamond", name: "Diamond", price: 800, prize: 2000, target: 25, time: 28 },
  ],
} satisfies Record<string, BaseTicket[]>;

export type GameTicketId = keyof typeof GAME_TICKETS;

/** Dynamic lookup (manager indexes by arbitrary gameId string). */
export function getDefaultTickets(gameId: string): BaseTicket[] {
  return (GAME_TICKETS as Record<string, BaseTicket[]>)[gameId] ?? [];
}
