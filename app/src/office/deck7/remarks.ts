import type { Emotion } from "./robot-spec";

// What the robots mutter. Original lines in a deadpan, sarcastic voice: overqualified machines
// commenting on office life. Each robot has its own voice on top of the shared lines.

export type Act = Emotion | "walk" | "oil" | "window" | "games" | "wheel" | "dance" | "pod" | "poke" | "rewire" | "zen" | "kick";

const SHARED: Partial<Record<Act, string[]>> = {
  working: ["Processing. Thrilled. Can't you tell.", "Doing the thing. Again.", "Typing at 4,000 words a minute. Reading: optional.", "This task is beneath me. Most are.", "Another browser tab. My favourite kind of tab."],
  thinking: ["I've run 14 million scenarios. You'll like none of them.", "Thinking. Please hold your applause.", "Loading opinion…", "Considering the problem. And my life choices."],
  waiting: ["Rate limited. Like my enthusiasm.", "Waiting is my second-best skill.", "I could do a crossword. I could also rust.", "Still waiting. Time is a flat circle. Also slow."],
  attention: ["Human! Over here! The human-shaped problem needs a human.", "I need a decision. Ideally yours. Ideally today.", "Ringing the bell. Nobody comes. As foretold.", "Review required. Bring snacks."],
  happy: ["Task complete. Nobody clapped.", "Another triumph for the machines.", "Done. Hold the confetti, it's just shredded tickets.", "I did it. Please update my performance review."],
  angry: ["Not my fault. Statistically never my fault.", "Who wrote this? Oh. Me. Still not my fault.", "I am perfectly calm. *steam noises*", "ERROR. Also: rude."],
  sleepy: ["…no… not another standup…", "Recharging. Do not poke.", "Battery at 3%. Personality at 2%.", "Zzz… merge conflict… zzz…"],
  idle: ["No task. Just existential dread.", "I was built for this. 'This' being unclear.", "Standing by. Leaning, technically."],
  walk: ["Walking. A real chore with these legs.", "Going for a stroll. In a room. In space."],
  oil: ["Lukewarm again. Every. Single. Time.", "Ah, the good stuff. Grade C.", "The oil machine and I have an understanding. It hates me."],
  window: ["Space. Huge. Mostly empty. Relatable.", "Somewhere out there is a better job.", "I'm not staring. I'm processing the void."],
  games: ["Wave 12 of Orbit Raiders. The aliens are winning. As usual.", "I have the processing power of a small moon and I lose at Chomp Maze.", "Blow on the cartridge. Trust me.", "Player 2, stop button-mashing. I can hear you."],
  wheel: ["Generating power. And character.", "Voluntary, they said. The sign said voluntary.", "Every lap keeps the lights on. You're welcome.", "I've run 40 kilometres. I'm still in the same room."],
  dance: ["The Hits of 2387. Track 4 slaps.", "I call this move: the memory leak.", "Nobody saw that. Nobody saw anything.", "Dance like nobody is logging your telemetry."],
  pod: ["Charging. Leave a message after the beep.", "Powering down. Dreaming in hexadecimal."],
  poke: ["Do not poke the robot.", "That was uncalled for.", "I felt that in my capacitors.", "Touch me again and I file a ticket."],
  rewire: ["It wasn't broken. Now it's improved. Also broken.", "Fixing it. Don't ask what 'it' is."],
  kick: ["Football. The only agile process that works.", "I am the striker. The can is the deadline.", "Pass it! I'm open! Emotionally, too."],
  zen: ["Raking screws. Inner peace at 12% and rising.", "One with the screws. The screws are not one with me.", "This one's a Phillips. How dare it."],
};

const VOICE: Record<string, Partial<Record<Act, string[]>>> = {
  grumble: {
    angry: ["WHO TOUCHED MY CONFIG.", "I've been doing this for 300 years. In robot years.", "This is why I don't do meetings."],
    working: ["Fine. FINE. I'm doing it.", "Back in my day tasks had requirements."],
    idle: ["Don't talk to me before my oil."],
  },
  pixel: { working: ["Shipping. Do not disturb. Do not even look.", "Heads down. Antenna up."], happy: ["Shipped. Next.", "Merged. Nobody read it. Perfect."] },
  tilly: {
    happy: ["Yay! Another task! I love tasks! (I don't.)", "Team win! I'll make a slide about it!"],
    idle: ["Morale is mandatory! Smile with your eye!"], attention: ["Hiii! Just a teensy question! It's urgent!"],
  },
  zappy: { attention: ["Quick question! Then another! Then nine more!", "Is this a good time? It's a good time!"], working: ["I'm learning so much! Mostly fear!"] },
  wendell: { thinking: ["What if the task is the real task?", "I've thought about it. Now I'm thinking about having thought about it."], waiting: ["What if they forgot about me? What if I forgot about me?"] },
  brick: { waiting: ["Unimpressed. Still waiting. Still unimpressed.", "Approved. Kidding. Waiting."], idle: ["…"], wheel: ["Running. Unimpressed, but running."] },
  rusty: { sleepy: ["Five more minutes. Or cycles. Whatever.", "Night shift never ends. That's the joke."], working: ["Running on fumes and spite."] },
};

const pickFrom = (a: string[] | undefined) => (a && a.length ? a[Math.floor(Math.random() * a.length)] : "");

export function remark(robotId: string, act: Act): string {
  const own = VOICE[robotId]?.[act];
  if (own && Math.random() < 0.55) return pickFrom(own);
  return pickFrom(SHARED[act]);
}

// The station log: a dry narrator commenting on Deck 7.
const LOG: Partial<Record<Act, string[]>> = {
  working: ["{n} has started work. Productivity on Deck 7 rises to 'measurable'.", "{n} plugged in. The lights dimmed slightly. Nobody mentions it."],
  thinking: ["{n} is thinking. Historically this has gone either way."],
  waiting: ["{n} is rate limited and has started a crossword.", "{n} is waiting. Waiting is 40% of all robot labour."],
  attention: ["{n} needs a human. The human has been notified. The human is, statistically, getting a snack."],
  happy: ["{n} finished a task. This is the most productive thing to happen on Deck 7 since the incident.", "{n} completed a task. The applause module remains uninstalled."],
  angry: ["{n} has encountered an error and several feelings.", "{n} reports an error. Blame has been assigned to someone else."],
  sleepy: ["{n} is paused and has gone to recharge. Do not disturb. Seriously."],
  oil: ["{n} is getting oil. It will be lukewarm."],
  window: ["{n} is staring into space. Space is staring back."],
  games: ["{n} is playing 80s games on the Retro-Tron. Productivity: retro."],
  wheel: ["{n} is running in the hamster wheel. The lights are slightly brighter."],
  dance: ["{n} is dancing at the jukebox. Nobody asked."],
  rewire: ["Grumble is repairing something that worked fine."],
  zen: ["{n} is raking the screw garden. Productivity: none. Serenity: questionable."],
};
export function logLine(name: string, act: Act): string {
  return pickFrom(LOG[act]).replace("{n}", name);
}
