/* Vanilla port of ThreeUI's GlassAiButton wrapper
   (src/shaders/glass-ai-button/GlassAiButton.tsx, SHA-256 1a11cd58…).
   Behaviour kept 1:1: the exact canonical document
   (sources/glass-ai-button.html, SHA-256 a484571de316…) runs in a sandboxed
   srcdoc iframe that mounts only while the host is near the viewport and the
   tab is visible, and fades in over 240ms once loaded.
   ThreeUI Community — MIT, see ./LICENSE. */
const SOURCE_URL = new URL("./glass-ai-button.html", import.meta.url);
let sourceDocument = null;
const loadSource = () => (sourceDocument ??= fetch(SOURCE_URL).then((r) => {
  if (!r.ok) throw new Error(`GlassAiButton source unavailable (${r.status})`);
  return r.text();
}));

export function mountGlassAiButton(container, { className = "", style = {} } = {}) {
  const host = document.createElement("div");
  host.className = `threeui-background glass-ai-button${className ? ` ${className}` : ""}`;
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "Interactive glass AI button");
  Object.assign(host.style, { position: "relative", overflow: "hidden", background: "#a8b0bd", pointerEvents: "auto" }, style);
  container.appendChild(host);

  let documentVisible = !document.hidden, hostVisible = false, frame = null, disposed = false;

  const sync = async () => {
    const mounted = hostVisible && documentVisible && !disposed;
    if (!mounted) {
      host.dataset.state = "paused";
      frame?.remove(); frame = null;
      return;
    }
    if (frame) return;
    host.dataset.state = "loading";
    const iframe = document.createElement("iframe");
    frame = iframe;
    iframe.title = "Glass AI Button";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.loading = "eager";
    Object.assign(iframe.style, {
      position: "absolute", inset: "0", display: "block", width: "100%", height: "100%",
      border: "0", background: "#a8b0bd", opacity: "0", pointerEvents: "none", transition: "opacity 240ms ease-out",
    });
    iframe.addEventListener("load", () => {
      if (frame !== iframe) return;
      host.dataset.state = "ready";
      iframe.style.opacity = "1"; iframe.style.pointerEvents = "auto";
    });
    const html = await loadSource();
    if (frame !== iframe) return; // unmounted while fetching
    iframe.srcdoc = html;
    host.appendChild(iframe);
  };

  const io = typeof IntersectionObserver === "undefined" ? null
    : new IntersectionObserver(([entry]) => { hostVisible = entry?.isIntersecting ?? true; sync(); }, { rootMargin: "80px" });
  if (io) io.observe(host); else { hostVisible = true; sync(); }
  const onVisibility = () => { documentVisible = !document.hidden; sync(); };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    host,
    destroy() {
      disposed = true; io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      frame?.remove(); frame = null; host.remove();
    },
  };
}
