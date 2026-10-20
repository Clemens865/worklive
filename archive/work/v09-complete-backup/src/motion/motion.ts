// Small helpers for the motion recipes in motion.css (toasts, dialogs, sliding tabs, panel reveal).
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let stack: HTMLElement | null = null;
export type ToastKind = "info" | "success" | "error";
/** Stacked toast with an optional title; closes itself (errors stay a little longer). */
export function toast(message: string, detail = "", kind: ToastKind = "info") {
  stack ||= Object.assign(document.createElement("div"), { className: "toast-stack" });
  if (!stack.isConnected) document.body.append(stack);
  const el = document.createElement("div");
  el.className = `t-toast toast toast-${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  const title = Object.assign(document.createElement("strong"), { textContent: message });
  el.append(title);
  if (detail) el.append(Object.assign(document.createElement("span"), { textContent: detail }));
  const close = Object.assign(document.createElement("button"), { className: "toast-close", type: "button", textContent: "×" });
  close.setAttribute("aria-label", "Dismiss");
  el.append(close);
  stack.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-open")));
  const dismiss = () => {
    el.classList.remove("is-open");
    setTimeout(() => el.remove(), reduced() ? 0 : 260);
  };
  close.onclick = dismiss;
  setTimeout(dismiss, kind === "error" ? 7000 : 4200);
  while (stack.children.length > 4) stack.firstElementChild?.remove();
}

/** Open a native dialog with the modal recipe. */
export function openDialog(d: HTMLDialogElement) {
  d.classList.add("t-modal");
  d.classList.remove("is-closing");
  if (!d.open) d.showModal();
}
/** Close with the faster exit animation (native close once it finished). */
export function closeDialog(d: HTMLDialogElement) {
  if (!d.open || d.classList.contains("is-closing")) return;
  if (reduced()) return d.close();
  d.classList.add("is-closing");
  setTimeout(() => { d.classList.remove("is-closing"); d.close(); }, 160);
}

/** Sliding pill for a group of buttons; `selected(btn)` says which is active. */
export function slidingTabs(group: HTMLElement, selected: (b: HTMLElement) => boolean) {
  group.classList.add("t-tabs");
  let pill = group.querySelector<HTMLElement>(":scope > .t-tabs-pill");
  if (!pill) { pill = Object.assign(document.createElement("span"), { className: "t-tabs-pill" }); pill.setAttribute("aria-hidden", "true"); group.prepend(pill); }
  const place = (animate: boolean) => {
    const active = Array.from(group.children).find(c => c !== pill && selected(c as HTMLElement)) as HTMLElement | undefined;
    if (!active) { pill!.style.width = "0"; return; }
    if (!animate) pill!.style.transition = "none";
    pill!.style.transform = `translateX(${active.offsetLeft}px)`;
    pill!.style.width = `${active.offsetWidth}px`;
    if (!animate) { void pill!.offsetWidth; pill!.style.transition = ""; }
  };
  new ResizeObserver(() => place(false)).observe(group);
  place(false);
  return { update: () => place(true) };
}

/** Replay the panel reveal on an element (e.g. the inspector when another agent is selected). */
export function reveal(el: HTMLElement, cls = "t-panel-reveal") {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
