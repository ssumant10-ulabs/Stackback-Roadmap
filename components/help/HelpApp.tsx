"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ARTICLES, CATEGORIES, CORPUS_BUILT, CORPUS_SOURCE, FLOWS } from "@/lib/help/corpus";
import { APP_NAME, APP_LOCATION, RISK_STATUSES, STATUS_LABEL, type HelpArticle } from "@/lib/help/types";
import { search, stripTags } from "@/lib/help/search";
import { record } from "@/lib/help/log";
import { Logo } from "@/components/icons";
import type { PilotStore } from "@/lib/types";
import { useOptionalAuth } from "./useOptionalAuth";
import ChatDock from "./ChatDock";
import Insights from "./Insights";
import Article from "./Article";
import Brief from "./Brief";
import Internal from "./Internal";
import Faq from "./Faq";
import { FAQ_COUNT, NAV_GROUPS } from "@/lib/help/faq";
import HowTo from "./HowTo";
import References from "./References";
import Simulator from "./Simulator";
import type { LoggedQuery, StoreRecord, StoreSummary } from "@/lib/sanity/queries";
import { helpFont } from "./font";
import "./help.css";

type View =
  | { kind: "faq" }
  | { kind: "home" }
  | { kind: "cat"; id: string }
  | { kind: "search"; q: string }
  | { kind: "insights" }
  | { kind: "queries"; step: number }
  | { kind: "sim" }
  | { kind: "internal" }
  | { kind: "howto" }
  | { kind: "refs" };

/** The Help Centre is two parts, and they answer different questions.
 *  Queries is live and incomplete by nature: what came in, what we answered.
 *  Help Centre is the settled corpus: the FAQs, the order flow, the simulator. */
type Part = "queries" | "refs" | "howto" | "help" | "internal";

/** Topics where the question underneath is usually "what would that actually do", which
 *  a simulator answers and a paragraph does not. */
const SIM_TOPICS = ["flows", "orders", "plans", "pay", "widget"];

const COUNTS = CATEGORIES.map((c) => ({ ...c, n: ARTICLES.filter((a) => a.cat === c.id).length }));

/** A link to one answer carries both the page and the article: `#/cat/orders#a=some-id`.
 *  location.hash keeps everything after the FIRST hash, so the article half has to come off
 *  before the route is read, or the category id silently becomes "orders#a=some-id". */
function splitHash(): { route: string; article: string | null } {
  const raw = (typeof window === "undefined" ? "" : window.location.hash).replace(/^#\/?/, "");
  const at = raw.indexOf("#a=");
  if (at < 0) return { route: raw, article: null };
  return { route: raw.slice(0, at), article: decodeURIComponent(raw.slice(at + 3)) };
}

function parseHash(): View {
  const { route } = splitHash();
  if (route.startsWith("cat/")) return { kind: "cat", id: decodeURIComponent(route.slice(4)) };
  if (route.startsWith("search/")) return { kind: "search", q: decodeURIComponent(route.slice(7)) };
  if (route === "insights") return { kind: "insights" };
  if (route.startsWith("queries")) {
    // #/queries/2 is step two. Without the step in the address a client cannot be sent
    // straight to their plans, and neither can a screenshot.
    const n = parseInt(route.split("/")[1] || "1", 10);
    return { kind: "queries", step: n >= 1 && n <= 3 ? n : 1 };
  }
  if (route === "sim") return { kind: "sim" };
  if (route === "faq") return { kind: "faq" };
  if (route === "internal") return { kind: "internal" };
  if (route === "howto") return { kind: "howto" };
  if (route === "refs") return { kind: "refs" };
  /* The FAQs are the landing. The overview is the 236-answer index you go to when the FAQ
     did not have it, which is the second thing you want, not the first. */
  return { kind: "faq" };
}

export default function HelpApp({
  answered, openQueries, store, stores, sanityConnected, theme: initialTheme, embedded,
  onExit, exitLabel, pilots,
}: {
  answered: LoggedQuery[];
  openQueries: LoggedQuery[];
  store: StoreRecord | null;
  stores: StoreSummary[];
  sanityConnected: boolean;
  theme: "light" | "dark";
  /** Rendered inside another screen, which already has a header, a theme control and a
   *  signed-in user. Dropping our own chrome is the difference between a tab and an app
   *  bolted inside an app. */
  embedded?: boolean;
  /** The way out, shown beside the parts. Somebody who came here to look something up is
   *  still in the middle of whatever they were doing in the host, and the lit button up in
   *  the header is a long way from where their eyes are. */
  onExit?: () => void;
  exitLabel?: string;
  /** The pilot rows the host already holds, so the suggester can name stores on the same
   *  setup instead of only quoting a category average. Absent on the standalone route. */
  pilots?: PilotStore[];
}) {
  const auth = useOptionalAuth();
  /* Inside the pilots screen the host is already behind AuthGate, so anyone looking at this
     is signed in on a ULABS account and asking them to sign in again inside their own admin
     is how the internal checklist ended up invisible to the team it was written for. */
  const internal = auth.internal || Boolean(embedded);
  /* Whose page this is. `/help` with no store in the path is ours, the link we hand somebody
     who is not a store record yet; `/help/<slug>` is a merchant's. The Internal tab shows on
     ours whether or not anybody has signed in, because a tab that only appears once you are
     signed in is indistinguishable from a tab that is gone, which is how it went missing.
     Its CONTENTS stay gated on `internal`, which is the line D2026-0925-05 drew. */
  const ourSurface = Boolean(embedded) || !store;
  const [view, setView] = useState<View>({ kind: "faq" });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  /* null: follow whatever is open. A string: the group the reader picked, "" for none. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  useEffect(() => { if (embedded) setTheme(initialTheme); }, [embedded, initialTheme]);
  const boxRef = useRef<HTMLInputElement>(null);

  /* The hash is the address of what you are reading, so a merchant can send a colleague a
   * link to one answer rather than "search for shipping and scroll". */
  useEffect(() => {
    const sync = () => {
      let v = parseHash();
      /* A leftover #/insights or #/internal from a previous visit opened the Help Centre on a
         locked empty state. The front door is the questions, so a route nobody on this page
         can open falls back to them rather than to a sign-in notice. */
      if ((v.kind === "insights" || v.kind === "internal") && !internal && !ourSurface) v = { kind: "faq" };
      setView(v);
      if (v.kind === "search") setQ(v.q);
      const { article } = splitHash();
      if (article) {
        setOpen(article);
        // The article is already in the list this render puts up, so scroll after paint.
        requestAnimationFrame(() => document.getElementById(article)?.scrollIntoView({ block: "center" }));
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internal, ourSurface]);

  const go = useCallback((v: View) => {
    const h = v.kind === "home" ? "#/" : v.kind === "cat" ? `#/cat/${v.id}`
      : v.kind === "search" ? `#/search/${encodeURIComponent(v.q)}`
      : v.kind === "queries" ? (v.step > 1 ? `#/queries/${v.step}` : "#/queries")
      : v.kind === "sim" ? "#/sim"
      : v.kind === "internal" ? "#/internal"
      : v.kind === "howto" ? "#/howto"
      : v.kind === "refs" ? "#/refs" : "#/insights";
    if (window.location.hash !== h) window.location.hash = h; else setView(v);
    setNavOpen(false);
    // Back to following the view: arriving at a topic from a search result or a card should
    // open the group that holds it, not leave the rail pointing at the last one picked.
    setOpenGroup(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setOpen(null);
  }, []);

  /* A cookie, not localStorage, because the server reads it to render the right palette
     on the first byte. A year is long enough that nobody re-picks, and it carries nothing
     but the word light or dark. */
  const flipTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.cookie = `sb-help-theme=${next};path=/;max-age=31536000;samesite=lax`;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName || "");
      if (((e.metaKey || e.ctrlKey) && e.key === "k") || (e.key === "/" && !typing)) {
        e.preventDefault(); boxRef.current?.focus(); boxRef.current?.select();
      }
      if (e.key === "Escape" && document.activeElement === boxRef.current) boxRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => (view.kind === "search" && view.q.trim() ? search(view.q, 40) : []), [view]);
  /* Forty results to a question with one answer is the wall the search box was meant to
     replace. Anything under a third of the top hit's score is a word in common, not an
     answer, so it is held back rather than listed and the count is what is worth reading. */
  const shown = useMemo(() => {
    if (!hits.length) return hits;
    const near = hits.filter((h) => h.score >= hits[0].score * 0.35);
    return near.length >= 3 ? near : hits.slice(0, Math.min(6, hits.length));
  }, [hits]);

  /* Logged once the typing has settled, so one question is one row rather than one per
   * keystroke, and only when there was something to find or conspicuously nothing. */
  useEffect(() => {
    if (view.kind !== "search" || view.q.trim().length < 3) return;
    const t = setTimeout(() => {
      record({ q: view.q, hit: hits[0]?.art.id ?? null, kind: hits.length ? "answer" : "miss", at: Date.now() },
        auth.user?.email);
    }, 1200);
    return () => clearTimeout(t);
  }, [view, hits, auth.user]);

  const submit = (e: React.FormEvent) => { e.preventDefault(); go(q.trim() ? { kind: "search", q: q.trim() } : { kind: "faq" }); };

  /** Which of the two jobs the reader is on. Internal is its own, and only ours. */
  const group: "setup" | "help" | "internal" =
    view.kind === "queries" || view.kind === "refs" ? "setup"
      : view.kind === "internal" || view.kind === "insights" ? "internal"
      : "help";

  const part: Part = view.kind === "queries" ? "queries"
    : view.kind === "refs" ? "refs"
    : view.kind === "howto" ? "howto"
    : view.kind === "internal" ? "internal" : "help";
  const cat = view.kind === "cat" ? COUNTS.find((c) => c.id === view.id) : undefined;
  const risky = ARTICLES.filter((a) => RISK_STATUSES.includes(a.status)).length;

  return (
    <div className={`hc ${helpFont.variable}` + (embedded ? " embedded" : "")} data-hc-theme={theme} data-hc-part={part}>
      {/* Stays a link for the semantics, but never lets the browser follow it: the document
          hash is this app's router, so "#hc-main" was an unknown route and the skip link sent
          a keyboard user to the FAQ instead of past the header. Same fault as the Internal
          tab's phase pills. */}
      <a className="hc-skip" href="#hc-main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById("hc-main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}>Skip to the answers</a>
      {/* The bar is full-bleed and its CONTENTS sit in the same column as the page, so the
          logo lines up with the rail and the sign-out lines up with the right edge of the
          answers. They used to be two different measures: a 22px-padded bar over a centred
          1240px body, which on any wide screen read as the page having no right margin. */}
      <header className="hc-top"><div className="hc-topin">
        {!embedded && (
          <a className="hc-brand" href="#/" aria-label="StackBack Help Centre, overview"
            onClick={(e) => { e.preventDefault(); go({ kind: "home" }); }}>
            <Logo />
            <span className="hc-brandname"><b>{APP_NAME}</b><span className="hc-brandsuffix"> Help Centre</span></span>
          </a>
        )}

        {onExit && (
          <div className="hc-parts hc-partsback">
            <button type="button" className="hc-part hc-partback" onClick={onExit}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6L8.5 12l6 6" /></svg>
              {exitLabel || "Back"}
            </button>
          </div>
        )}

        {/* Two jobs, two groups. Setting a store up is work you do once with us on a call;
            the Help Centre is what a merchant opens six weeks later on their own. They were
            five flat tabs, so the two were the same distance apart as the two halves of each
            one. The group is the choice; the row under it is the choice within it. */}
        <div className="hc-parts" role="tablist" aria-label="Sections">
          <button role="tab" aria-selected={group === "setup"} className={"hc-part" + (group === "setup" ? " on" : "")}
            onClick={() => go({ kind: "queries", step: 1 })}>Setup StackBack</button>
          <button role="tab" aria-selected={group === "help"} className={"hc-part" + (group === "help" ? " on" : "")}
            onClick={() => go({ kind: "faq" })}>Help Centre</button>
          {ourSurface && (
            <button role="tab" aria-selected={group === "internal"} className={"hc-part hc-partint" + (group === "internal" ? " on" : "")}
              onClick={() => go({ kind: "internal" })}>Internal</button>
          )}
        </div>

        <form className="hc-searchwrap" onSubmit={submit} role="search">
          <svg className="hc-mag" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input
            ref={boxRef} className="hc-search" type="search" value={q} placeholder={`Search ${ARTICLES.length} answers`}
            aria-label="Search the Help Centre"
            /* Search as you type past two characters, which is where the ranking stops being
               noise. Clearing the box returns to the overview rather than leaving a dead
               result page behind. React's onChange already fires per keystroke. */
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              if (!v.trim()) go({ kind: "faq" });
              else if (v.trim().length > 2) go({ kind: "search", q: v.trim() });
            }}
          />
          <kbd className="hc-kbd">/</kbd>
        </form>

        {!embedded && (
          <div className="hc-topright">
            <button className="hc-btn ghost hc-theme" onClick={flipTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
              {theme === "light"
                ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
                : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" /></svg>}
            </button>
            {internal && <button className="hc-btn hc-int" onClick={() => go({ kind: "insights" })}>Insights</button>}
            {auth.available && (auth.internal
              ? <button className="hc-btn ghost" onClick={auth.signOut} title={auth.user?.email || ""}>Internal · sign out</button>
              : <button className="hc-btn ghost" onClick={auth.signIn}>ULABS sign in</button>)}
          </div>
        )}

        {/* The topic rail only exists on the Help Centre part, so neither does its toggle. */}
        {part === "help" && (
          <button className="hc-navtoggle hc-btn ghost" onClick={() => setNavOpen((v) => !v)} aria-expanded={navOpen}>
            {navOpen ? "Close" : "Topics"}
          </button>
        )}
      </div></header>

      {/* The row under the group: which half of it. Only where a group has two. */}
      {group !== "internal" && (
        <div className="hc-subrow">
          <div className="hc-subin">
            {group === "setup" ? (
              <>
                <button className={"hc-sub" + (part === "queries" ? " on" : "")}
                  onClick={() => go({ kind: "queries", step: 1 })}>Your plans</button>
                <button className={"hc-sub" + (part === "refs" ? " on" : "")}
                  onClick={() => go({ kind: "refs" })}>References</button>
              </>
            ) : (
              <>
                <button className={"hc-sub" + (view.kind === "faq" ? " on" : "")}
                  onClick={() => go({ kind: "faq" })}>FAQs</button>
                <button className={"hc-sub" + (part === "howto" ? " on" : "")}
                  onClick={() => go({ kind: "howto" })}>How to guides</button>
                <button className={"hc-sub" + (view.kind === "home" || view.kind === "cat" || view.kind === "search" ? " on" : "")}
                  onClick={() => go({ kind: "home" })}>Every answer</button>
                <button className={"hc-sub" + (view.kind === "sim" ? " on" : "")}
                  onClick={() => go({ kind: "sim" })}>Simulate</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={"hc-body" + (part !== "help" ? " solo" : "")}>
        {/* One list, two zones, and only one group open at a time.
            It was three ways in (FAQs, Overview, Simulate) stacked on seventeen topics under
            five headings: twenty-five rows before a merchant has read one, which is a list you
            read rather than scan. The topics collapse to their five headings with a count, and
            the group holding whatever is open expands itself. Eight rows, and the counts say
            where the mass is before you click into it. */}
        <nav className={"hc-nav" + (navOpen ? " open" : "") + (part !== "help" ? " hidden" : "")} aria-label="Topics">
          {/* FAQs, Every answer and Simulate moved to the row under the tabs, where they are
              siblings of How to rather than three entries above seventeen topics. The rail is
              the topics now, which is the one thing it was always for. */}
          <p className="hc-navrule hc-navfirst">Browse by topic</p>

          {NAV_GROUPS.map((grp) => {
            const items = grp.ids.map((id) => COUNTS.find((c) => c.id === id)).filter(Boolean) as typeof COUNTS;
            if (!items.length) return null;
            const total = items.reduce((n, c) => n + c.n, 0);
            const holdsView = view.kind === "cat" && grp.ids.includes(view.id);
            const isOpen = openGroup === grp.title || (openGroup === null && holdsView);
            return (
              <div key={grp.title} className={"hc-navgroup" + (isOpen ? " open" : "")}>
                <button type="button" className={"hc-navgrouph" + (holdsView ? " holds" : "")}
                  aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? "" : grp.title)}>
                  <svg className="hc-navcaret" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  <span>{grp.title}</span><em>{total}</em>
                </button>
                {isOpen && items.map((c) => (
                  <button key={c.id} className={"hc-navitem hc-navsub" + (view.kind === "cat" && view.id === c.id ? " on" : "")}
                    aria-label={`${c.name}, ${c.n} answers`} aria-current={view.kind === "cat" && view.id === c.id ? "page" : undefined}
                    onClick={() => go({ kind: "cat", id: c.id })}>
                    <span>{c.name}</span><em>{c.n}</em>
                  </button>
                ))}
              </div>
            );
          })}
          {internal && (
            <button className={"hc-navitem hc-navint" + (view.kind === "insights" ? " on" : "")}
              aria-label={`Insights, ${risky} answers carrying support risk`} onClick={() => go({ kind: "insights" })}>
              <span>Insights</span><em aria-hidden="true">{risky}</em>
            </button>
          )}
        </nav>

        <main className="hc-main" id="hc-main" tabIndex={-1}>
          {view.kind === "queries" && (
            <Brief store={store} open={openQueries} answered={answered} connected={sanityConnected} pilots={pilots}
              step={view.step} onStep={(n) => go({ kind: "queries", step: n })} />
          )}
          {view.kind === "internal" && (internal
            ? <Internal store={store} stores={stores} connected={sanityConnected} getToken={auth.getToken} />
            : <div className="hc-empty">
                <p>The internal tab needs a ULABS account.</p>
                {auth.available
                  ? <button className="hc-btn primary" onClick={auth.signIn}>Sign in</button>
                  : <p className="hc-note">Sign-in is not configured on this build, so it cannot be opened here.</p>}
              </div>)}
          {view.kind === "refs" && <References pilots={pilots} />}
          {view.kind === "sim" && <Simulator />}
          {view.kind === "howto" && <HowTo internal={internal} />}
          {view.kind === "faq" && (
            <Faq onOpen={(a) => go({ kind: "cat", id: a.cat })}
              onJump={(step) => go({ kind: "queries", step })} />
          )}
          {view.kind === "home" && <Home go={go} internal={internal} onAsk={setChatSeed} answered={answered.length} />}
          {view.kind === "cat" && cat && (
            <section>
              <p className="hc-eyebrow">{cat.n} answers</p>
              <h1 className="hc-h1">{cat.name}</h1>
              <p className="hc-blurb">{cat.blurb}</p>
              {cat.flow && FLOWS[cat.flow] && <Flow html={FLOWS[cat.flow]} />}
              {SIM_TOPICS.includes(cat.id) && (
                <button className="hc-simlink" onClick={() => go({ kind: "sim" })}>
                  <b>Try it instead of reading it</b>
                  <span>Set a frequency, a discount and a run length, and watch the widget, the checkout and every order move together.</span>
                </button>
              )}
              <ArticleList list={ARTICLES.filter((a) => a.cat === cat.id)} open={open} setOpen={setOpen} internal={false} />
            </section>
          )}
          {view.kind === "search" && (
            <section>
              <p className="hc-eyebrow">
                {shown.length ? `${shown.length} answer${shown.length === 1 ? "" : "s"}` : "No match"}
              </p>
              <h1 className="hc-h1">&ldquo;{view.q}&rdquo;</h1>
              {hits.length === 0 && (
                <div className="hc-empty">
                  <p>Nothing in the {ARTICLES.length} answers matches that. Try a merchant word rather than ours: COD, mandate, pincode, Shiprocket and BOGO all work.</p>
                  <button className="hc-btn primary" onClick={() => setChatSeed(view.q)}>Ask support instead</button>
                </div>
              )}
              <ArticleList list={shown.map((h) => h.art)} open={open} setOpen={setOpen} internal={false} showCat />
              {hits.length > shown.length && (
                <p className="hc-note hc-searchmore">
                  {hits.length - shown.length} more answers mention these words without being about
                  them. Narrow the search, or <button type="button" className="hc-linkish"
                    onClick={() => setChatSeed(view.q)}>ask the chat</button>.
                </p>
              )}
            </section>
          )}
          {view.kind === "insights" && (internal
            ? <Insights />
            : <div className="hc-empty"><p>Insights is the internal layer. Sign in with a ULABS account to open it.</p></div>)}

          <footer className="hc-foot">
            <span>{ARTICLES.length} answers across {CATEGORIES.length} topics, written from what 32 pilot stores asked.</span>
            <span>{APP_LOCATION}</span>
            <span>Built {CORPUS_BUILT} from {CORPUS_SOURCE}.</span>
          </footer>
        </main>
      </div>

      {/* The chat answers as the Help Centre, not as the internal one. A merchant reading an
          answer that tells them to talk to their account owner about commercials is reading a
          note we wrote for ourselves. */}
      <ChatDock seed={chatSeed} onSeedUsed={() => setChatSeed(null)} email={auth.user?.email} internal={false} />
    </div>
  );
}

function Home({ go, internal, onAsk, answered }: {
  go: (v: View) => void; internal: boolean; onAsk: (q: string) => void; answered: number;
}) {
  const start = ARTICLES.filter((a) => a.cat === "start").slice(0, 6);
  const asked = [...ARTICLES].sort((a, b) => b.asked - a.asked).slice(0, 8);
  return (
    <section>
      <p className="hc-eyebrow">StackBack</p>
      <h1 className="hc-h1 hc-hero">Everything pilot stores asked, answered once.</h1>
      <p className="hc-blurb hc-lede">
        {ARTICLES.length} answers mined from 32 store conversations, onboarding and go-live calls, and the
        codebase itself. Search it, browse it, or ask the chat in the corner the way you would ask on a call.
      </p>

      <div className="hc-stats">
        <Stat n={String(ARTICLES.length)} l="answers" />
        <Stat n={String(CATEGORIES.length)} l="topics" />
        <Stat n="32" l="stores mined" />
        <Stat n={String(Math.max(...ARTICLES.map((a) => a.asked)))} l="most-asked, in stores" />
      </div>

      <h2 className="hc-h2">Start here</h2>
      <div className="hc-cards">
        {start.map((a) => (
          <button key={a.id} className="hc-card" onClick={() => go({ kind: "cat", id: a.cat })}>
            <span className={"hc-pill p-" + a.status}>{STATUS_LABEL[a.status]}</span>
            <h3>{a.q}</h3>
            <p>{stripTags(a.a).slice(0, 150)}…</p>
          </button>
        ))}
      </div>

      <h2 className="hc-h2">Asked most often</h2>
      <ol className="hc-top10">
        {asked.map((a) => (
          <li key={a.id}>
            <button onClick={() => { window.location.hash = `#/cat/${a.cat}#a=${a.id}`; }}>
              <span className="hc-top10q">{a.q}</span>
              <span className="hc-top10n">{a.asked} stores</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="hc-simhero">
        <div>
          <h2>See it before you sell it</h2>
          <p>
            Pick a frequency, a discount and a run length. The product page, the checkout and every
            order {APP_NAME} creates in Shopify all move together, including the parent order and the
            child order per delivery.
          </p>
        </div>
        <button className="hc-btn primary" onClick={() => go({ kind: "sim" })}>Simulate a subscription</button>
      </div>

      <div className="hc-askrow">
        <p>Not finding it?</p>
        <button className="hc-btn primary" onClick={() => onAsk("")}>Ask the chat</button>
        <button className="hc-btn" onClick={() => go({ kind: "queries", step: 1 })}>
          {answered > 0 ? `Raise a query, or read ${answered} answered` : "See your plans"}
        </button>
      </div>
      {internal && <p className="hc-intnote">Internal layer is on. Ask counts, answer risk and the question log are in Insights.</p>}
    </section>
  );
}

const Stat = ({ n, l }: { n: string; l: string }) => (
  <div className="hc-stat"><b>{n}</b><span>{l}</span></div>
);

/** The diagrams are authored SVG from the deliverable and theme off the same CSS variables,
 *  so they are injected rather than rebuilt. The source is a file in this repo, not input. */
function Flow({ html }: { html: string }) {
  return <div className="hc-flow" dangerouslySetInnerHTML={{ __html: html }} />;
}

function ArticleList({ list, open, setOpen, internal, showCat }: {
  list: HelpArticle[]; open: string | null; setOpen: (id: string | null) => void; internal: boolean; showCat?: boolean;
}) {
  return (
    <div className="hc-list">
      {list.map((a) => (
        <Article key={a.id} art={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)}
          internal={internal} showCat={showCat} />
      ))}
    </div>
  );
}
