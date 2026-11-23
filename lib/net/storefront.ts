import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";

/** Fetching a merchant's storefront from our server, safely.
 *
 *  A URL here is user input and the fetch runs on our server, so anything that is not a public
 *  web host is refused: otherwise the route is an internal port scanner. Shared by the brand
 *  colour reader and the Widget lab's product page loader. */

/** Reject anything that is not a public web host. Blocks the obvious SSRF shapes. */
export function safeUrl(raw: string): URL | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  /* A literal IP never reaches the DNS check below (Node connects to it directly), so every
     private range is refused here, not just the common four. */
  const lit = h.replace(/^\[|\]$/g, "");
  if (isIP(lit) && isPrivateAddress(lit)) return null;
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h) && (
      h.startsWith("10.") || h.startsWith("127.") || h.startsWith("0.") ||
      h.startsWith("169.254.") || h.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    ) ||
    h.includes(":")
  ) return null;
  return u;
}

/* ---- the fetch itself ------------------------------------------------------------------
   The hostname check above is not enough on its own: a public-looking name can resolve to
   10.x or 127.0.0.1 (or to a public address first and a private one on the next lookup), and a
   public page can redirect to an internal one. So every connection goes through a DNS lookup
   that refuses non-public addresses, and the socket uses the address that lookup vetted;
   redirects are followed by hand, each hop checked again. */


/** Loopback, private, link-local, CGNAT, multicast, reserved and documentation ranges. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPrivateAddress(mapped[1]);
    return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x) || x.startsWith("64:ff9b:");
  }
  return true;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
function publicLookup(hostname: string, options: { all?: boolean; family?: number }, cb: LookupCb) {
  dnsLookup(hostname, { all: true, family: options.family || 0 }, (err, addrs) => {
    if (err) return cb(err, "");
    const list = (addrs as LookupAddress[]) || [];
    if (!list.length || list.some((x) => isPrivateAddress(x.address))) {
      return cb(Object.assign(new Error("Refused: " + hostname + " is not a public host"), { code: "EBLOCKED" }), "");
    }
    if (options.all) cb(null, list); else cb(null, list[0].address, list[0].family);
  });
}

function once(url: URL, cap: number, deadline: number): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "http:" ? http : https;
    const req = mod.request(url, {
      method: "GET", agent: false, lookup: publicLookup as never,
      timeout: Math.max(1, deadline - Date.now()),
      headers: {
        // Identify honestly. A storefront that blocks us should be able to see who we are.
        "user-agent": "StackBackBrandReader/1.0 (+https://stackback.ai)",
        accept: "text/html,text/css,application/json,*/*",
        "accept-encoding": "gzip, deflate, br",
      },
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ status, location: String(res.headers.location), body: "" });
      }
      const enc = String(res.headers["content-encoding"] || "").toLowerCase();
      const stream = enc === "gzip" ? res.pipe(zlib.createGunzip()) : enc === "deflate" ? res.pipe(zlib.createInflate())
        : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (c: Buffer) => {
        size += c.length;
        if (size <= cap) chunks.push(c);
        else { chunks.push(c.subarray(0, c.length - (size - cap))); req.destroy(); finish(); }
      });
      let done = false;
      const finish = () => { if (done) return; done = true; resolve({ status, body: Buffer.concat(chunks).toString("utf-8") }); };
      stream.on("end", finish);
      stream.on("error", (e) => { if (!done) reject(e); });
    });
    req.on("timeout", () => req.destroy(new Error("aborted: timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** GET a public storefront URL as text, at most `cap` bytes. Throws "HTTP <status>" on a
 *  non-2xx answer, like fetch callers expect. */
export async function getText(url: string, cap: number, timeoutMs = 8000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let u = safeUrl(url);
  if (!u) throw new Error("Refused: not a public web address");
  for (let hop = 0; hop <= 4; hop++) {
    const r = await once(u, cap, deadline);
    if (r.location) {
      const next = safeUrl(new URL(r.location, u).toString());
      if (!next) throw new Error("Refused: redirect to a non-public address");
      u = next;
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw new Error("HTTP " + r.status);
    return r.body;
  }
  throw new Error("HTTP 310 too many redirects");
}
