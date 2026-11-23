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

export async function getText(url: string, cap: number, timeoutMs = 8000): Promise<string> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: {
        // Identify honestly. A storefront that blocks us should be able to see who we are.
        "user-agent": "StackBackBrandReader/1.0 (+https://stackback.ai)",
        accept: "text/html,text/css,application/json,*/*",
      },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = await r.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf.slice(0, cap));
  } finally {
    clearTimeout(timer);
  }
}
