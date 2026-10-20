// Deterministic character "genome" from agent.id. The six demo agents are hand-tuned.
export function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

export const SKIN = ["#f3d5c0", "#eac3a4", "#dcaa86", "#c89070", "#a86f4f", "#8a5538", "#6b3f2a", "#4f2e20"];
export const HAIR_COL = ["#141110", "#2a1d16", "#4a3223", "#6e4a2e", "#9a6a3e", "#c79a5e", "#b04a26", "#8d8a86", "#d8d4cc", "#3b2f2c"];
export const EYE_COL = ["#3d2a1c", "#5a3a22", "#6b8e5a", "#4f7fa6", "#7a9bb3", "#2b1d15", "#8a7040"];
export const HAIR_STYLES = ["short", "buzz", "sidepart", "bun", "long", "bob", "curly", "ponytail", "undercut", "bald"];
export const TOPS = ["tee", "henley", "shirt", "sweater", "hoodie", "polo"];
export const OUTERS = ["none", "none", "none", "vest", "puffer"];
export const PANTS = ["#262c35", "#2f3440", "#3a3530", "#4a4a45", "#1d2a3d", "#5a5244", "#6b6758", "#2a2a2c"];
export const OUTER_COL = ["#34383c", "#4b4d45", "#5d4a3a", "#2c3440", "#7a7468", "#3f3a36", "#6a5a48"];
export const SHOES = ["sneaker", "leather", "boot"];

const pick = (r, a) => a[Math.floor(r() * a.length)];

export function genome(agent) {
  const r = rngFrom(hash(agent.id));
  const fem = r() < 0.5;
  const g = {
    fem,
    height: fem ? 1.62 + r() * 0.14 : 1.72 + r() * 0.16,
    build: 0.9 + r() * 0.25,          // shoulder/chest width
    belly: r() * 0.6,
    skin: pick(r, SKIN), eye: pick(r, EYE_COL),
    hair: pick(r, HAIR_STYLES), hairCol: pick(r, HAIR_COL),
    beard: !fem && r() < 0.45 ? pick(r, ["stubble", "full", "goatee", "moustache"]) : "none",
    face: { jaw: 0.85 + r() * 0.35, cheek: 0.85 + r() * 0.3, chin: 0.8 + r() * 0.4, nose: 0.8 + r() * 0.45, noseW: 0.85 + r() * 0.35,
      lips: 0.8 + r() * 0.4, eyeSize: 0.9 + r() * 0.2, brow: 0.8 + r() * 0.4, long: 0.94 + r() * 0.12, ears: 0.85 + r() * 0.3 },
    top: pick(r, TOPS), outer: pick(r, OUTERS), outerCol: pick(r, OUTER_COL),
    pants: pick(r, PANTS), denim: r() < 0.35, shoes: pick(r, SHOES), shoeCol: pick(r, ["#1c1b1a", "#e9e6e0", "#6a4a32", "#3a3a3c"]),
    glasses: r() < 0.35 ? pick(r, ["round", "rect", "thick"]) : "none",
    watch: r() < 0.55, lanyard: r() < 0.4, earrings: fem && r() < 0.5, headphones: r() < 0.12,
    brows: 0, // filled below
  };
  if (g.fem && g.hair === "buzz" && r() < 0.6) g.hair = "bob";
  if (!g.fem && ["long", "bun", "ponytail"].includes(g.hair) && r() < 0.5) g.hair = "short";
  return Object.assign(g, PRESETS[agent.id] || {});
}

// Hand-picked looks for the demo cast so they are clearly distinct.
const PRESETS = {
  ada: { fem: true, height: 1.68, build: 0.92, belly: 0.05, skin: SKIN[1], eye: EYE_COL[3], hair: "bun", hairCol: HAIR_COL[6], beard: "none",
    face: { jaw: 0.86, cheek: 1.12, chin: 0.9, nose: 0.88, noseW: 0.86, lips: 1.1, eyeSize: 1.06, brow: 0.9, long: 1.0, ears: 0.9 },
    top: "shirt", outer: "none", pants: PANTS[4], denim: false, shoes: "leather", shoeCol: "#3a2a20", glasses: "round", watch: true, lanyard: true, earrings: true, headphones: false },
  milo: { fem: false, height: 1.84, build: 1.02, belly: 0.1, skin: SKIN[4], eye: EYE_COL[0], hair: "curly", hairCol: HAIR_COL[0], beard: "stubble",
    face: { jaw: 1.05, cheek: 1.0, chin: 1.0, nose: 1.05, noseW: 1.15, lips: 1.2, eyeSize: 1.0, brow: 1.1, long: 1.02, ears: 1.0 },
    top: "hoodie", outer: "none", pants: PANTS[7], denim: true, shoes: "sneaker", shoeCol: "#e9e6e0", glasses: "none", watch: false, lanyard: false, earrings: false, headphones: true },
  heiko: { fem: false, height: 1.79, build: 1.12, belly: 0.45, skin: SKIN[0], eye: EYE_COL[4], hair: "sidepart", hairCol: HAIR_COL[7], beard: "full",
    face: { jaw: 1.18, cheek: 0.95, chin: 1.1, nose: 1.25, noseW: 1.05, lips: 0.85, eyeSize: 0.94, brow: 1.2, long: 1.06, ears: 1.12 },
    top: "sweater", outer: "vest", outerCol: OUTER_COL[1], pants: PANTS[2], denim: false, shoes: "boot", shoeCol: "#5a3a24", glasses: "thick", watch: true, lanyard: false, earrings: false, headphones: false },
  mike: { fem: false, height: 1.75, build: 0.98, belly: 0.2, skin: SKIN[6], eye: EYE_COL[5], hair: "buzz", hairCol: HAIR_COL[0], beard: "goatee",
    face: { jaw: 1.08, cheek: 1.1, chin: 1.15, nose: 1.0, noseW: 1.2, lips: 1.25, eyeSize: 1.02, brow: 1.0, long: 1.0, ears: 1.0 },
    top: "henley", outer: "puffer", outerCol: OUTER_COL[3], pants: PANTS[5], denim: false, shoes: "leather", shoeCol: "#1c1b1a", glasses: "none", watch: true, lanyard: true, earrings: false, headphones: false },
  juno: { fem: true, height: 1.64, build: 0.9, belly: 0.1, skin: SKIN[2], eye: EYE_COL[2], hair: "bob", hairCol: HAIR_COL[1], beard: "none",
    face: { jaw: 0.9, cheek: 1.05, chin: 0.85, nose: 0.85, noseW: 0.95, lips: 1.05, eyeSize: 1.1, brow: 0.85, long: 0.96, ears: 0.9 },
    top: "tee", outer: "none", outerCol: OUTER_COL[6], pants: PANTS[0], denim: true, shoes: "sneaker", shoeCol: "#e9e6e0", glasses: "rect", watch: false, lanyard: true, earrings: true, headphones: false },
  sam: { fem: true, height: 1.71, build: 0.95, belly: 0.15, skin: SKIN[5], eye: EYE_COL[1], hair: "long", hairCol: HAIR_COL[2], beard: "none",
    face: { jaw: 0.92, cheek: 1.15, chin: 0.92, nose: 0.95, noseW: 1.05, lips: 1.15, eyeSize: 1.04, brow: 0.95, long: 1.02, ears: 0.92 },
    top: "polo", outer: "none", outerCol: OUTER_COL[4], pants: PANTS[3], denim: false, shoes: "boot", shoeCol: "#1c1b1a", glasses: "none", watch: true, lanyard: false, earrings: true, headphones: false },
};
