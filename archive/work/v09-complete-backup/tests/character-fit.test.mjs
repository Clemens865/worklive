// Every character combination must fit: outfit details on the body, glasses and ears on the head, no hands in the body,
// feet on the floor, and nothing cutting into the desk or chair when seated (src/office/styles/comic/fitcheck.js).
// New looks, outfits or proportions are covered automatically as soon as they are added to LOOK_OPTIONS / PROPORTION_RANGE.
import test from "node:test";
import assert from "node:assert/strict";
import { checkCharacter } from "../src/office/styles/comic/fitcheck.js";
import { LOOK_OPTIONS, PROPORTION_RANGE } from "../src/office/styles/comic/looks.js";

const fmt = (label, issues) => `${label}: ` + issues.map(i => `${i.what} (${i.amount} ${i.unit}, ${i.pose})`).join("; ");
const extras = i => ({
  glasses: LOOK_OPTIONS.glasses[i % LOOK_OPTIONS.glasses.length], beard: LOOK_OPTIONS.beard[(i >> 1) % LOOK_OPTIONS.beard.length],
  earrings: i % 2 === 0, headset: i % 5 === 1, cap: i % 7 === 3, moustache: i % 3 === 2,
});

for (const body of LOOK_OPTIONS.body) {
  test(`${body} body: every top × head shape fits`, () => {
    const bad = []; let i = 0;
    for (const top of LOOK_OPTIONS.top) for (const head of LOOK_OPTIONS.head) {
      const look = { body, top, head, hair: LOOK_OPTIONS.hair[i % LOOK_OPTIONS.hair.length], ...extras(i++) };
      const issues = checkCharacter({ id: `fit-${body}-${top}-${head}`, provider: i % 2 ? "claude" : "codex", look });
      if (issues.length) bad.push(fmt(`${top}/${head}`, issues));
    }
    assert.deepEqual(bad, [], "\n" + bad.join("\n"));
  });
}

// Proportion sliders at their limits: everything in between is a blend of these.
const lo = k => PROPORTION_RANGE[k][0], hi = k => PROPORTION_RANGE[k][1];
const SHAPES = {
  "all minimum": Object.fromEntries(Object.keys(PROPORTION_RANGE).map(k => [k, lo(k)])),
  "all maximum": Object.fromEntries(Object.keys(PROPORTION_RANGE).map(k => [k, hi(k)])),
  "tall and thin": { height: hi("height"), width: lo("width"), belly: 0, leg: hi("leg"), head: lo("head") },
  "short and round": { height: lo("height"), width: hi("width"), belly: hi("belly"), leg: lo("leg"), head: hi("head") },
};
for (const [name, shape] of Object.entries(SHAPES)) {
  test(`proportions at the limits (${name}) fit with every top`, () => {
    const bad = []; let i = 3;
    for (const top of LOOK_OPTIONS.top) for (const head of ["round", "long", "wide"]) {
      const look = { body: "average", shape, top, head, hair: LOOK_OPTIONS.hair[i % LOOK_OPTIONS.hair.length], ...extras(i++) };
      const issues = checkCharacter({ id: `fit-${name}-${top}-${head}`, provider: "codex", look });
      if (issues.length) bad.push(fmt(`${top}/${head}`, issues));
    }
    assert.deepEqual(bad, [], "\n" + bad.join("\n"));
  });
}
