// Facial expressions: damped blend of brows, lids, pupils and mouth parameters + blinking.
const E = {
  happy: { smile: 0.75, open: 0.0, width: 1.0, teeth: 0.5, tongue: 0, browY: 0.02, browTilt: 0.05, lid: -0.95, lowLid: 1.05, pupil: 1 },
  grin: { smile: 1.0, open: 0.45, width: 1.2, teeth: 1, tongue: 0, browY: 0.07, browTilt: 0.12, lid: -1.0, lowLid: 0.8, pupil: 1.05 },
  focused: { smile: 0.1, open: 0.0, width: 0.8, teeth: 0.5, tongue: 0, browY: -0.04, browTilt: -0.2, lid: -0.6, lowLid: 1.0, pupil: 0.9 },
  tongue: { smile: 0.2, open: 0.05, width: 0.85, teeth: 0, tongue: 1, tongueX: 0.35, browY: -0.02, browTilt: -0.24, lid: -0.5, lowLid: 0.95, pupil: 0.9 },
  worried: { smile: -0.8, open: 0.2, width: 0.85, teeth: 0.6, tongue: 0, browY: 0.07, browTilt: 0.45, lid: -1.15, lowLid: 1.15, pupil: 0.8, skew: 0.3 },
  proud: { smile: 0.95, open: 0.12, width: 1.15, teeth: 1, tongue: 0, browY: 0.06, browTilt: -0.05, lid: -0.55, lowLid: 0.85, pupil: 1, skew: -0.35 },
  relaxed: { smile: 0.55, open: 0, width: 0.95, teeth: 0.5, tongue: 0, browY: 0.0, browTilt: 0.05, lid: -0.75, lowLid: 1.05, pupil: 1 },
  sip: { smile: 0.0, open: 0.12, width: 0.55, teeth: 0, tongue: 0, browY: 0.05, browTilt: 0.1, lid: -0.35, lowLid: 1.0, pupil: 1 },
};

export function createExpressions(face, look, seed) {
  const cur = { ...E.relaxed, skew: 0, tongueX: 0 };
  let target = E.relaxed, blinkT = 1 + (seed % 30) / 10, blink = 0, talk = 0;
  const gaze = { yaw: 0, pitch: 0 }, gazeCur = { yaw: 0, pitch: 0 };
  const sleepy = look.eyes === "sleepy" ? 0.35 : 0;

  function update(dt, t) {
    const k = 1 - Math.exp(-dt * 10);
    for (const key of Object.keys(cur)) cur[key] += ((target[key] ?? (key === "skew" || key === "tongueX" ? 0 : cur[key])) - cur[key]) * k;
    // Blink
    blinkT -= dt;
    if (blinkT <= 0) { blink = 0.16; blinkT = 1.8 + ((Math.sin(t * 13.7 + seed) + 1) * 2.2); if (Math.sin(t * 7 + seed) > 0.6) blinkT = 0.25; }
    blink = Math.max(0, blink - dt);
    const closed = blink > 0 ? Math.sin((blink / 0.16) * Math.PI) : 0;
    // Saccades: eyes lead the head
    const kg = 1 - Math.exp(-dt * 22);
    gazeCur.yaw += (gaze.yaw - gazeCur.yaw) * kg; gazeCur.pitch += (gaze.pitch - gazeCur.pitch) * kg;
    for (const [i, eye] of face.eyes.entries()) {
      const s = i === 0 ? -1 : 1;
      const open = cur.lid + sleepy;
      eye.upper.rotation.x = open + (1.55 - open) * closed - gazeCur.pitch * 0.4;
      eye.lower.rotation.x = cur.lowLid - 0.25 * closed;
      eye.ball.rotation.set(-gazeCur.pitch, gazeCur.yaw, 0);
      eye.pupil.scale.set(0.26 * cur.pupil, 0.26 * cur.pupil, 0.06);
      const brow = face.brows[i];
      brow.position.y = 0.46 + cur.browY + closed * -0.02;
      brow.rotation.z = -s * cur.browTilt;
    }
    const P = face.mouth.P;
    P.smile = cur.smile; P.width = cur.width; P.teeth = cur.teeth; P.tongue = cur.tongue; P.skew = cur.skew; P.tongueX = cur.tongueX;
    const chatter = talk > 0 ? (Math.max(0, Math.sin(t * 17) * Math.sin(t * 5.3 + 1)) * 0.5) : 0;
    P.open = Math.max(0, cur.open + chatter);
    face.mouth.update();
  }
  return {
    set(name) { target = E[name] || E.relaxed; },
    setTalk(v) { talk = v; },
    gaze,
    update,
  };
}
