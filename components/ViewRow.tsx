"use client";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { IcFilter, IcPlus } from "./icons";
import { useAppUi } from "./appui";
import type { ViewId } from "@/lib/types";

/** The board reads the filter itself now, matching a card on who is assigned to it, on the
 *  team it was handed to, or on who raised it. It used to prune the tree, which meant
 *  nothing on this screen, so the control was hidden rather than wrong. */
const FILTERABLE: ViewId[] = ["board"];

export function ViewRow() {
  const s = useStore();
  const ui = useAppUi();
  const filterBtn = useRef<HTMLButtonElement>(null);
  /* Everything that is not the Features backlog renders the board now, including the saved
     "timeline" a browser is still carrying from before the other views came off. Reading the
     stored id literally left the filter and Add card hidden for anyone who had not clicked
     Board since. */
  const onBoard = s.ui.view !== "features";
  const canFilter = onBoard || FILTERABLE.includes(s.ui.view);

  /* Nothing left here. The board carries its own tabs, its own filter and its own Add task,
     all on one row, and this was a third strip of chrome above them with one control in it. */
  return null;
}
