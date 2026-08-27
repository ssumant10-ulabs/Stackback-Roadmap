"use client";
import { useRef } from "react";
import type { Node } from "@/lib/types";
import { Avatar } from "./bits";
import { IcPlus } from "./icons";
import { useAppUi } from "./appui";

/** Owner avatars plus the "assign" affordance. Lives on its own so the Board and any other
 *  editable surface share one implementation. */
export function Assignees({ node, small }: { node: Node; small?: boolean }) {
  const ui = useAppUi();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      {(node.assignees || []).map((a, i) => <Avatar key={i} a={a} small={small} />)}
      <button ref={ref} type="button" className="assign-add" data-assign-anchor aria-label="Assign owners"
        onClick={() => ref.current && ui.openAssignee(node.id, ref.current)}><IcPlus /></button>
    </>
  );
}
