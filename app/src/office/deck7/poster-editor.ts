import { POSTER_COLORS, drawPoster, shrinkImage, type PosterCfg } from "./posters";
import { cue } from "./sound";

// Click a poster on Deck 7's wall → this dialog: write your own text in a poster colour, or upload an
// image with a caption. Live preview; "Back to original" restores the default poster.

interface Board { get(id: string): PosterCfg; def(id: string): PosterCfg; aspect(id: string): number; set(id: string, cfg: PosterCfg | null): boolean }

export function openPosterEditor(board: Board, id: string, onMessage: (text: string) => void) {
  let cfg: PosterCfg = JSON.parse(JSON.stringify(board.get(id)));
  const dialog = document.createElement("dialog");
  dialog.className = "deck7-creator deck7-poster";
  dialog.innerHTML = `
    <form method="dialog" class="dc-wrap">
      <div class="dc-stage dp-stage"><canvas></canvas></div>
      <div class="dc-form">
        <p class="dc-kicker">Facilities · wall notice</p>
        <h2>Make a poster</h2>
        <p class="dc-sub">Motivate the crew. Or don't. Text, or an image with a caption.</p>
        <div class="dp-tabs"><button type="button" data-kind="text">Text</button><button type="button" data-kind="image">Image</button></div>
        <label class="dp-text">Text<textarea name="text" rows="4" maxlength="120" placeholder="Line breaks make new lines"></textarea></label>
        <div class="dp-image">
          <label>Image<input type="file" name="file" accept="image/*"></label>
          <label>Caption<input name="caption" maxlength="60" placeholder="Optional"></label>
        </div>
        <label>Colours<span class="dp-colors">${POSTER_COLORS.map(([bg, fg], i) => `<button type="button" data-c="${i}" style="background:${bg};color:${fg}" aria-label="Colour ${i + 1}">Aa</button>`).join("")}</span></label>
        <p class="dc-note dp-error" hidden></p>
        <div class="dc-actions"><button type="button" data-reset class="dp-reset">Back to original</button><span class="dc-desk"></span><button type="button" data-cancel>Cancel</button><button type="submit" class="dc-primary">Hang it up</button></div>
      </div>
    </form>`;
  document.body.append(dialog);
  const $ = <E extends Element>(s: string) => dialog.querySelector(s) as E;
  const canvas = $<HTMLCanvasElement>("canvas");
  canvas.width = 512; canvas.height = Math.round(512 * board.aspect(id));
  const err = $<HTMLElement>(".dp-error");
  const show = (msg: string) => { err.textContent = msg; err.hidden = !msg; };
  function render() {
    dialog.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === cfg.kind)));
    $<HTMLElement>(".dp-text").hidden = cfg.kind !== "text";
    $<HTMLElement>(".dp-image").hidden = cfg.kind !== "image";
    drawPoster(canvas, cfg.kind === "image" && !cfg.src ? { kind: "text", text: "Choose an image", bg: cfg.bg, fg: cfg.fg } : cfg);
  }
  $<HTMLTextAreaElement>("[name=text]").value = cfg.kind === "text" ? cfg.text : "";
  $<HTMLInputElement>("[name=caption]").value = cfg.kind === "image" ? cfg.caption : "";
  dialog.querySelectorAll<HTMLButtonElement>("[data-kind]").forEach(b => (b.onclick = () => {
    const text = $<HTMLTextAreaElement>("[name=text]").value, caption = $<HTMLInputElement>("[name=caption]").value;
    cfg = b.dataset.kind === "text" ? { kind: "text", text: text || "YOUR TEXT", bg: cfg.bg, fg: cfg.fg } : { kind: "image", src: cfg.kind === "image" ? cfg.src : "", caption, bg: cfg.bg, fg: cfg.fg };
    render();
  }));
  $<HTMLTextAreaElement>("[name=text]").oninput = e => { if (cfg.kind === "text") { cfg.text = (e.target as HTMLTextAreaElement).value; render(); } };
  $<HTMLInputElement>("[name=caption]").oninput = e => { if (cfg.kind === "image") { cfg.caption = (e.target as HTMLInputElement).value; render(); } };
  $<HTMLInputElement>("[name=file]").onchange = async e => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f || cfg.kind !== "image") return;
    try { cfg.src = await shrinkImage(f); show(""); render(); } catch (x) { show(String((x as Error).message)); }
  };
  dialog.querySelectorAll<HTMLButtonElement>("[data-c]").forEach(b => (b.onclick = () => { const [bg, fg] = POSTER_COLORS[+b.dataset.c!]; cfg.bg = bg; cfg.fg = fg; render(); }));
  const close = () => { dialog.close(); dialog.remove(); };
  $<HTMLButtonElement>("[data-cancel]").onclick = close;
  dialog.addEventListener("cancel", close);
  $<HTMLButtonElement>("[data-reset]").onclick = () => { board.set(id, null); cue("click"); close(); onMessage("Poster restored. Morale returns to its usual level."); };
  $<HTMLFormElement>("form").onsubmit = e => {
    e.preventDefault();
    if (cfg.kind === "image" && !cfg.src) { show("Choose an image first."); return; }
    if (!board.set(id, cfg)) { show("Not enough room to save this image here. Try a smaller one."); return; }
    cue("done");
    close();
    onMessage("A new poster went up. The robots pretend not to notice.");
  };
  render();
  dialog.showModal();
}
