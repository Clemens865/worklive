// Each agent has a separate lane. Ownership changes acknowledge only after the
// current action finishes; queued automation is invalidated immediately.
export class ControlLane {
  owner = "agent";
  epoch = 0;
  tail = Promise.resolve();
  enqueue(action) {
    const result = this.tail.then(action);
    this.tail = result.catch(() => {});
    return result;
  }
  invalidate() {
    return ++this.epoch;
  }
  handoff(owner) {
    if (!["agent", "user"].includes(owner))
      throw new Error("Invalid control owner");
    this.invalidate();
    return this.enqueue(() => {
      this.owner = owner;
    });
  }
  automation(epoch, action) {
    return this.enqueue(async () => {
      if (this.owner !== "agent" || epoch !== this.epoch) return false;
      await action();
      return true;
    });
  }
  user(action) {
    return this.enqueue(() => {
      if (this.owner !== "user")
        throw new Error("Take control before interacting with this browser.");
      return action();
    });
  }
}
