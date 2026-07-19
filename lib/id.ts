let n = 1;

/** Stable-enough client id for tasks/subtasks. */
export function uid(prefix = "n_"): string {
  return prefix + n++ + "_" + Math.random().toString(36).slice(2, 7);
}

export function newRoadmapId(): string {
  return "rm_" + Math.random().toString(36).slice(2, 9);
}
