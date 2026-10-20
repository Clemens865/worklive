import { PROVIDER } from "../../layout.js";
import { hash, rng, pick } from "./toon.js";

// Deterministic appearance from agent.id. The 6 demo agents are hand-picked.
export const SKINS = ["#f6d7c3", "#efc3a4", "#e2a986", "#c98c67", "#a86e4c", "#8a5638", "#6b4029", "#f1cdb0", "#d89f7c"];
export const HAIR_COLORS = ["#2a1c17", "#4a2d1d", "#7a4a2a", "#b5773f", "#e0b25c", "#c24d2c", "#8f8f96", "#1c1c28", "#f0e2c0", "#5b3a6e"];
export const HAIRSTYLES = ["spikes", "quiff", "afro", "bob", "bun", "ponytail", "bald", "curly", "mohawk", "side", "pigtails", "buzz"];
export const PANTS = ["#2f3d5c", "#3c3a44", "#6b5a45", "#384b3a", "#524064", "#2b2b30", "#7a6d5a"];
export const SHOES = ["#f4f1ea", "#e8594a", "#3a73c9", "#f2c94c", "#2c2c30", "#8e5ac8"];
export const ACCENTS = ["#f2c94c", "#5b7fd6", "#e8594a", "#9b6ad6", "#f4f1ea", "#3a3a44", "#e98bb0"];

const DEMO = {
  ada: { body: "tall", head: "egg", skin: 1, hair: "bun", hairColor: 4, eyes: "almond", nose: "button", top: "cardigan", glasses: "round", earrings: true, pants: 0, shoes: 2, freckles: true, brows: 0.8 },
  milo: { body: "lanky", head: "long", skin: 4, hair: "spikes", hairColor: 0, eyes: "round", nose: "long", top: "hoodie", headset: true, pants: 5, shoes: 1, brows: 1.1 },
  heiko: { body: "round", head: "wide", skin: 0, hair: "bald", hairColor: 3, beard: "full", eyes: "round", nose: "bulb", top: "overalls", glasses: "square", pants: 2, shoes: 4, brows: 1.3 },
  mike: { body: "short", head: "round", skin: 6, hair: "afro", hairColor: 0, moustache: true, eyes: "wide", nose: "wide", top: "tie", pants: 1, shoes: 0, brows: 1.0 },
  juno: { body: "average", head: "round", skin: 2, hair: "ponytail", hairColor: 5, eyes: "almond", nose: "pointy", top: "tee", cap: true, freckles: true, pants: 3, shoes: 3, brows: 0.9 },
  sam: { body: "average", head: "square", skin: 3, hair: "quiff", hairColor: 9, eyes: "sleepy", nose: "button", top: "polo", earrings: true, pants: 4, shoes: 5, brows: 1.0 },
};

const BODIES = {
  tall: { height: 1.08, width: 0.95, belly: 0.0, leg: 1.1, head: 0.98 },
  short: { height: 0.9, width: 1.05, belly: 0.25, leg: 0.88, head: 1.08 },
  round: { height: 0.98, width: 1.18, belly: 0.9, leg: 0.92, head: 1.0 },
  lanky: { height: 1.1, width: 0.86, belly: 0.0, leg: 1.16, head: 0.95 },
  average: { height: 1.0, width: 1.0, belly: 0.15, leg: 1.0, head: 1.0 },
};

// Limits for fine-tuned proportions. Seated poses, desk clearance and the crowd test hold inside these.
export const PROPORTION_RANGE = { height: [0.86, 1.12], width: [0.82, 1.22], belly: [0, 1], leg: [0.85, 1.18], head: [0.9, 1.15] };
export const FINISHES = ["comic", "clay"];

// Choices the hire dialog offers. Swatch fields store an index into the colour list.
export const LOOK_OPTIONS = {
  body: Object.keys(BODIES), head: ["round", "egg", "wide", "long", "square", "pear"],
  skin: SKINS, hair: HAIRSTYLES, hairColor: HAIR_COLORS,
  eyes: ["round", "almond", "wide", "sleepy"], eyeColor: ["#4a3222", "#2f5f8a", "#3f6e3a", "#6a4a2a", "#222"],
  nose: ["button", "long", "bulb", "pointy", "wide"], top: ["tee", "hoodie", "cardigan", "polo", "tie", "overalls"],
  glasses: [null, "round", "square"], beard: [null, "full", "goatee"],
  moustache: [false, true], freckles: [false, true], earrings: [false, true], headset: [false, true], cap: [false, true],
  pants: PANTS, shoes: SHOES,
};

// agent.lookSeed (reroll) replaces the id as the random seed; agent.look (saved choices) overrides single fields.
// Saved looks never change when the generator changes — that's what gets stored per agent.
export function lookFor(agent) {
  const r = rng(hash(agent.lookSeed || agent.id));
  const base = {
    body: pick(r, Object.keys(BODIES)), head: pick(r, ["round", "egg", "wide", "long", "square", "pear"]),
    skin: Math.floor(r() * SKINS.length), hair: pick(r, HAIRSTYLES), hairColor: Math.floor(r() * HAIR_COLORS.length),
    eyes: pick(r, ["round", "almond", "wide", "sleepy"]), nose: pick(r, ["button", "long", "bulb", "pointy", "wide"]),
    top: pick(r, ["tee", "hoodie", "cardigan", "polo", "tie", "overalls"]),
    glasses: r() < 0.3 ? pick(r, ["round", "square"]) : null, headset: r() < 0.15, cap: r() < 0.12,
    beard: r() < 0.18 ? pick(r, ["full", "goatee"]) : null, moustache: r() < 0.15, freckles: r() < 0.3, earrings: r() < 0.25,
    pants: Math.floor(r() * PANTS.length), shoes: Math.floor(r() * SHOES.length), brows: 0.8 + r() * 0.5,
    accent: Math.floor(r() * ACCENTS.length), eyeColor: pick(r, ["#4a3222", "#2f5f8a", "#3f6e3a", "#6a4a2a", "#222"]),
  };
  const demo = !agent.lookSeed && DEMO[agent.id];
  const l = demo ? { ...base, glasses: null, headset: false, cap: false, beard: null, moustache: false, freckles: false, earrings: false, ...demo } : base;
  Object.assign(l, agent.look || {});
  // Body proportions: the preset, optionally fine-tuned per agent (workbench sliders), kept in the range the poses fit.
  l.B = { ...(BODIES[l.body] || BODIES.average) };
  for (const [k, [lo, hi]] of Object.entries(PROPORTION_RANGE)) if (typeof l.shape?.[k] === "number") l.B[k] = Math.min(hi, Math.max(lo, l.shape[k]));
  l.finish = l.finish === "clay" ? "clay" : "comic";
  l.skinColor = SKINS[l.skin % SKINS.length];
  l.hairColorHex = HAIR_COLORS[l.hairColor % HAIR_COLORS.length];
  l.pantsColor = PANTS[l.pants % PANTS.length];
  l.shoeColor = SHOES[l.shoes % SHOES.length];
  l.accentColor = ACCENTS[l.accent % ACCENTS.length];
  l.shirt = PROVIDER[agent.provider].color;
  if (demo && agent.id === "ada") l.accentColor = "#f4ead8";
  if (demo && agent.id === "heiko") l.accentColor = "#f2c94c";
  if (demo && agent.id === "mike") l.accentColor = "#f2c94c";
  if (demo && agent.id === "juno") l.accentColor = "#5b7fd6";
  l.seed = hash((agent.lookSeed || agent.id) + "!");
  return l;
}
