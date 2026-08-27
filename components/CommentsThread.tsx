"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Node } from "@/lib/types";
import { relTime } from "@/lib/reltime";
import { initials } from "@/lib/derive";
import { IcTrash } from "./icons";

export function CommentsThread({ node }: { node: Node }) {
  const s = useStore();
  const [v, setV] = useState("");
  const list = node.comments || [];
  const send = () => { if (s.addComment(node.id, v)) setV(""); };
  return (
    <div className="cmt-thread">
      {list.map((c) => (
        <div className="cmt" key={c.id}>
          <span className="cmt-av">{initials(c.who)}</span>
          <div className="cmt-body">
            <div className="cmt-meta"><b>{c.who}</b><span>{relTime(c.at)}</span></div>
            <div className="cmt-text">{c.body}</div>
          </div>
          <button type="button" className="icon-btn danger cmt-del" aria-label="Delete comment"
            onClick={() => s.delComment(node.id, c.id)}><IcTrash /></button>
        </div>
      ))}
      <div className="cmt-add">
        <input type="text" placeholder={s.me ? "Add a comment…" : "Add a comment (set your name in Settings)…"}
          value={v} onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} />
        <button type="button" onClick={send}>Post</button>
      </div>
    </div>
  );
}
