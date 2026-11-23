"use client";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { ARTICLES, CATEGORIES } from "@/lib/help/articles";
import { highlight, search } from "@/lib/help/search";

/** Where a suggestion goes. An answer opens in its topic; a topic or a tool is a page. */
export type Pick =
  | { kind: "answer"; id: string; cat: string }
  | { kind: "topic"; id: string }
  | { kind: "tool"; id: "sim" | "widgets" | "howto" }
  | { kind: "all"; q: string };

const TOOLS: { id: "sim" | "widgets" | "howto"; name: string; hint: string; words: string }[] = [
  { id: "sim", name: "Simulate an order", hint: "See what one checkout creates, for both first-delivery flows",
    words: "simulate simulator order orders parent child split single separate first delivery checkout flow" },
  { id: "widgets", name: "Widget lab", hint: "Try every widget on a product page, in your colours",
    words: "widget widgets lab preview colour color colours token tokens theme pdp product page placement share link" },
  { id: "howto", name: "How to guides", hint: "Step by step walkthroughs",
    words: "how to guide guides video walkthrough steps" },
];

/** The search box, with answers as you type.
 *
 *  It used to wait for three characters and then swap the whole page for a results list, so
 *  every keystroke threw away what you were reading. Now the page stays put and the top
 *  answers, topics and tools drop down under the box. Enter or a click opens one; Enter with
 *  nothing highlighted shows every result. */
const SearchBox = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Pick) => void;
}>(function SearchBox({ value, onChange, onPick }, ref) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(-1);
  const wrap = useRef<HTMLFormElement>(null);
  const q = value.trim();

  const { answers, topics, tools } = useMemo(() => {
    if (q.length < 2) return { answers: [], topics: [], tools: [] };
    const lq = q.toLowerCase();
    /* Every word typed starts a word in the name: "cust por" finds Customer portal. */
    const starts = (s: string) => {
      const ws = s.toLowerCase().split(/[^a-z0-9]+/);
      return lq.split(/\s+/).filter(Boolean).every((p) => ws.some((w) => w.startsWith(p)));
    };
    return {
      answers: search(q, 6),
      topics: CATEGORIES.filter((c) => starts(c.name)).slice(0, 2),
      tools: TOOLS.filter((t) => lq.split(/\s+/).some((p) => p.length > 1 && t.words.split(" ").some((w) => w.startsWith(p)))).slice(0, 2),
    };
  }, [q]);

  const rows: Pick[] = [
    ...tools.map((t) => ({ kind: "tool", id: t.id }) as Pick),
    ...answers.map((h) => ({ kind: "answer", id: h.art.id, cat: h.art.cat }) as Pick),
    ...topics.map((c) => ({ kind: "topic", id: c.id }) as Pick),
  ];

  useEffect(() => { setAt(-1); }, [q]);
  useEffect(() => {
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  const choose = (p: Pick) => { setOpen(false); onPick(p); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setAt((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(-1, i - 1)); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (at >= 0 && rows[at]) choose(rows[at]);
    else if (q) choose({ kind: "all", q });
  };

  const show = open && q.length >= 2;
  let i = -1;

  return (
    <form ref={wrap} className="hc-searchwrap" onSubmit={submit} role="search">
      <svg className="hc-mag" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      <input
        ref={ref} className="hc-search" type="search" value={value}
        placeholder={`Search ${ARTICLES.length} answers, or try "cod", "two orders", "widget colours"`}
        aria-label="Search the Help Centre" role="combobox" aria-expanded={show} aria-controls="hc-sugg"
        aria-activedescendant={at >= 0 ? `hc-sugg-${at}` : undefined} autoComplete="off"
        onFocus={() => setOpen(true)} onKeyDown={onKey}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
      />
      <kbd className="hc-kbd">/</kbd>

      {show && (
        <div className="hc-ta" id="hc-sugg" role="listbox">
          {tools.length > 0 && <p className="hc-tah">Tools</p>}
          {tools.map((t) => {
            i++; const k = i;
            return (
              <button type="button" key={t.id} id={`hc-sugg-${k}`} role="option" aria-selected={at === k}
                className={"hc-tarow tool" + (at === k ? " on" : "")} onMouseEnter={() => setAt(k)}
                onClick={() => choose({ kind: "tool", id: t.id })}>
                <b>{t.name}</b><span>{t.hint}</span>
              </button>
            );
          })}
          {answers.length > 0 && <p className="hc-tah">Answers</p>}
          {answers.map((h) => {
            i++; const k = i;
            const cat = CATEGORIES.find((c) => c.id === h.art.cat)?.name;
            return (
              <button type="button" key={h.art.id} id={`hc-sugg-${k}`} role="option" aria-selected={at === k}
                className={"hc-tarow" + (at === k ? " on" : "")} onMouseEnter={() => setAt(k)}
                onClick={() => choose({ kind: "answer", id: h.art.id, cat: h.art.cat })}>
                <b dangerouslySetInnerHTML={{ __html: highlight(h.art.q, q) }} />
                <span dangerouslySetInnerHTML={{ __html: highlight(h.art.short || h.snippet, q) }} />
                <em>{cat}</em>
              </button>
            );
          })}
          {topics.length > 0 && <p className="hc-tah">Topics</p>}
          {topics.map((c) => {
            i++; const k = i;
            return (
              <button type="button" key={c.id} id={`hc-sugg-${k}`} role="option" aria-selected={at === k}
                className={"hc-tarow topic" + (at === k ? " on" : "")} onMouseEnter={() => setAt(k)}
                onClick={() => choose({ kind: "topic", id: c.id })}>
                <b>{c.name}</b><span>{c.blurb}</span>
              </button>
            );
          })}
          {rows.length === 0
            ? <p className="hc-tanone">No answer matches &ldquo;{q}&rdquo;. Press Enter to ask support.</p>
            : <button type="submit" className="hc-taall">See all results for &ldquo;{q}&rdquo; <kbd>Enter</kbd></button>}
        </div>
      )}
    </form>
  );
});

export default SearchBox;
