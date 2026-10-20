import test from "node:test";
import assert from "node:assert/strict";
import { ControlLane } from "./control.mjs";
test("handoff waits for an in-flight action and cancels stale queued automation", async () => {
  const lane = new ControlLane();
  const events = [];
  let finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const token = lane.epoch;
  const current = lane.automation(token, async () => {
    events.push("started");
    await gate;
    events.push("finished");
  });
  await Promise.resolve();
  const stale = lane.automation(token, () => events.push("must not execute"));
  let acknowledged = false;
  const handoff = lane.handoff("user").then(() => {
    acknowledged = true;
  });
  await Promise.resolve();
  assert.equal(acknowledged, false);
  finish();
  await current;
  assert.equal(await stale, false);
  await handoff;
  await lane.user(() => events.push("user input"));
  assert.deepEqual(events, ["started", "finished", "user input"]);
});
test("manual input requires acknowledged ownership and returning control blocks input", async () => {
  const lane = new ControlLane();
  await assert.rejects(
    lane.user(() => {}),
    /Take control/,
  );
  await lane.handoff("user");
  await lane.user(() => {});
  await lane.handoff("agent");
  await assert.rejects(
    lane.user(() => {}),
    /Take control/,
  );
});
test("one agent waiting for an action does not block another agent", async () => {
  const one = new ControlLane(),
    two = new ControlLane();
  let finish;
  const busy = one.automation(
    one.epoch,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  await two.handoff("user");
  assert.equal(two.owner, "user");
  assert.equal(one.owner, "agent");
  finish();
  await busy;
});
