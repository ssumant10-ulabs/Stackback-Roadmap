"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_CLIPS, CLIP_GROUPS, type Clip } from "@/lib/help/videos";
import { APP_NAME } from "@/lib/help/types";

const WATCHED = "sb-help-watched";

/** The how-to library, played here rather than linked away.
 *
 *  A help centre that links out to a video host is a tab somebody does not come back from,
 *  and they lose their place in the process. So the list and the player sit side by side:
 *  pick a chapter, it plays, the list stays visible, and the next one is one click away.
 *
 *  What has been watched is remembered on the device, because sixteen videos is more than
 *  anybody finishes in a sitting and "where was I" is the question that stops them returning. */
export default function HowTo() {
  const [current, setCurrent] = useState<Clip>(ALL_CLIPS[0]);
  const [watched, setWatched] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try { setWatched(JSON.parse(localStorage.getItem(WATCHED) || "[]")); }
    catch { /* private window: the library works, it just will not remember */ }
  }, []);

  const mark = (id: string) => {
    setWatched((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { localStorage.setItem(WATCHED, JSON.stringify(next)); } catch { /* nothing to do */ }
      return next;
    });
  };

  /* A new source on the same element needs an explicit load, or the player keeps the old
     buffer and the wrong video plays under the right title. */
  useEffect(() => {
    setFailed(false);
    const v = videoRef.current;
    if (!v) return;
    v.load();
  }, [current]);

  const flat = useMemo(() => CLIP_GROUPS.flatMap((g) => g.clips.map((c) => ({ ...c, group: g.title }))), []);
  const index = flat.findIndex((c) => c.id === current.id);
  const next = flat[index + 1];

  return (
    <section>
      <p className="hc-eyebrow">How to</p>
      <h1 className="hc-h1">Watch someone do it</h1>
      <p className="hc-blurb">
        {ALL_CLIPS.length} recordings covering {APP_NAME} end to end, from creating the store to
        managing a live subscription. They play here, so you keep your place.
        {watched.length > 0 && ` You have watched ${watched.length}.`}
      </p>

      <div className="hc-htgrid">
        <div className="hc-htplayer">
          <div className="hc-htstage">
            {failed ? (
              <div className="hc-htfail">
                <b>This one will not play here.</b>
                <p>
                  {current.local
                    ? "The file is a QuickTime recording, which some browsers refuse. Try Chrome or Safari."
                    : "The video host did not return the file. It may have been moved or unshared."}
                </p>
              </div>
            ) : (
              <video
                ref={videoRef}
                key={current.id}
                controls
                playsInline
                preload="metadata"
                onEnded={() => mark(current.id)}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  // Most of the way through counts as watched. Nobody sits through the outro.
                  if (v.duration && v.currentTime / v.duration > 0.9) mark(current.id);
                }}
                onError={() => setFailed(true)}
              >
                <source src={current.src} />
              </video>
            )}
          </div>

          <div className="hc-htnow">
            <div>
              <p className="hc-htnowt">{current.title}</p>
              {current.note && <p className="hc-htnote">{current.note}</p>}
            </div>
            {next && (
              <button className="hc-btn" onClick={() => setCurrent(next)}>
                Next: {next.title}
              </button>
            )}
          </div>
        </div>

        <nav className="hc-htlist" aria-label="Recordings">
          {CLIP_GROUPS.map((g) => (
            <div key={g.id} className="hc-htgroup">
              <p className="hc-htgrouph">{g.title}</p>
              <p className="hc-htgroupb">{g.blurb}</p>
              <ul>
                {g.clips.map((c) => {
                  const on = c.id === current.id;
                  const done = watched.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button className={"hc-htitem" + (on ? " on" : "")} onClick={() => setCurrent(c)}
                        aria-current={on ? "true" : undefined}>
                        <span className={"hc-htmark" + (done ? " done" : "")} aria-hidden="true">
                          {done ? "✓" : on ? "▶" : ""}
                        </span>
                        <span className="hc-htname">{c.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </section>
  );
}
