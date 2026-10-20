import { createServer, request } from "node:http";
import { connect, isIP } from "node:net";
import { lookup } from "node:dns/promises";

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  // Only global unicast IPv6; exclude documentation and transition ranges.
  const ip = address.toLowerCase();
  return isIP(ip) === 6 && /^[23]/.test(ip) && !/^(2001:(db8|0|0000):|2002:)/.test(ip);
}

export function publicUrl(value) {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port)) || host === "localhost" ||
      /\.(localhost|local|internal|test|invalid)$/.test(host) || !host.includes(".") && !isIP(host) ||
      (isIP(host) && !isPublicAddress(host)))
    throw new Error("This research browser only opens public HTTP and HTTPS pages on standard ports.");
  return url;
}

async function resolvePublic(host) {
  host = host.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) throw new Error("Private network destinations are not available to agents.");
  return addresses.find((a) => a.family === 4) || addresses[0];
}

// DNS is resolved and checked at the actual socket connection, then pinned to
// that IP. Page redirects cannot use a second DNS lookup to reach a private host.
export async function publicProxy() {
  const sockets = new Set();
  const server = createServer((req, res) => {
    void (async () => {
      if (!["GET", "HEAD"].includes(req.method)) throw new Error("Research requests are read only.");
      const url = publicUrl(req.url);
      if (url.protocol !== "http:") throw new Error("Use CONNECT for HTTPS.");
      const address = await resolvePublic(url.hostname);
      const headers = { ...req.headers, host: url.host };
      delete headers["proxy-authorization"]; delete headers["proxy-connection"];
      const upstream = request({ hostname: address.address, family: address.family, port: Number(url.port) || 80, method: req.method, path: url.pathname + url.search, headers }, (response) => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      upstream.setTimeout(20000, () => upstream.destroy());
      upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      res.on("close", () => upstream.destroy());
      upstream.end();
    })().catch(() => { if (!res.headersSent) res.writeHead(403); res.end("Worklive blocked this destination."); });
  });
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  server.on("connect", (req, client, head) => {
    void (async () => {
      const url = publicUrl("https://" + req.url);
      const address = await resolvePublic(url.hostname);
      if (client.destroyed) return;
      const upstream = connect({ host: address.address, family: address.family, port: Number(url.port) || 443 });
      sockets.add(upstream); upstream.on("close", () => sockets.delete(upstream));
      upstream.setTimeout(30000, () => upstream.destroy());
      upstream.on("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(client); client.pipe(upstream);
      });
      upstream.on("error", () => client.destroy());
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
    })().catch(() => client.end("HTTP/1.1 403 Forbidden\r\n\r\n"));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => { for (const s of sockets) s.destroy(); server.close(); } };
}
