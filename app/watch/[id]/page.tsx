import { notFound } from "next/navigation";
import { ALL_CLIPS } from "@/lib/help/videos";
import { helpFont } from "@/components/help/font";
import "@/components/help/help.css";

/** One recording, on its own page, and nothing else.
 *
 *  This exists because "copy the link" had nowhere honest to point. A link to the file makes
 *  the browser download it, and a link into the Help Centre needs the recipient to find the
 *  right row. A merchant sent one of these should land on the thing they were sent. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clip = ALL_CLIPS.find((c) => c.id === id);
  return { title: clip ? `${clip.title} — StackBack` : "StackBack" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clip = ALL_CLIPS.find((c) => c.id === id);
  if (!clip || clip.pending) notFound();

  return (
    <div className={`hc ${helpFont.variable} hc-watch`} data-hc-theme="light">
      <main className="hc-watchbox">
        <h1>{clip.title}</h1>
        <video controls playsInline preload="metadata" controlsList="nodownload">
          <source src={clip.src} />
        </video>
        {clip.note && <p className="hc-watchnote">{clip.note}</p>}
        <p className="hc-watchfoot">
          <a href="/help#/howto">All StackBack walkthroughs</a>
        </p>
      </main>
    </div>
  );
}
