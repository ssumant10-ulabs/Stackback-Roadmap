#!/usr/bin/env python3
"""Generate lib/seed.ts for the StackBack roadmap app from the Roadmap tab TSV.

Source of truth: the `Roadmap` tab of StackBack_Roadmap_Tasks_Updated.xlsx
(Drive id 1tHa3FtlnUOaCg5kH7zmUgkV2IfiUDmSb).

To refresh the app after the team edits the sheet:
  1. Update data/roadmap_tab.tsv to match the Roadmap tab (tab-separated, same 9 columns).
  2. python3 data/gen_seed.py            # dry run, prints the counts to eyeball
  3. python3 data/gen_seed.py --write    # rewrites lib/seed.ts
  4. Bump SEED_VERSION in lib/seed.ts so saved browsers pick the new tree up.
"""
import csv, json, os, re, sys
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
TSV = os.path.join(HERE, "roadmap_tab.tsv")
OUT = os.path.join(HERE, os.pardir, "lib", "seed.ts")

PRIORITY = {"Now": 1, "Next": 2, "Then": 3, "Later": 4, "Future": 5}
STATUS = {"Done": "done", "In Progress": "progress", "Planned": "planned", "": "planned"}
TEAMS = {"Engineering", "Design", "PM"}
ROSTER = {
    "Engineering": ["Shubham", "Mansi", "Sachin", "Yogesh"],
    "Design": ["Rohan", "Neel", "Anshuman"],
    "PM": ["Sumant", "Ishita", "Shreya"],
}
KNOWN_PEOPLE = {p for v in ROSTER.values() for p in v}


def parse_owners(raw):
    """'Engineering Team & Sumant' -> [team Engineering, person Sumant]. '~X' -> person X."""
    raw = (raw or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in re.split(r",|&|\band\b", raw) if p.strip()]
    out, seen = [], set()
    for p in parts:
        p = p.lstrip("~").strip()
        if not p:
            continue
        m = re.match(r"^(Engineering|Design|PM)\s+Team$", p)
        entry = {"name": m.group(1), "isTeam": True} if m else {"name": p}
        key = ("T" if m else "P") + entry["name"]
        if key not in seen:
            seen.add(key)
            out.append(entry)
    return out


def read_rows():
    rows = []
    with open(TSV, newline="") as f:
        r = csv.reader(f, delimiter="\t")
        header = next(r)
        for raw in r:
            raw = raw + [""] * (9 - len(raw))
            ms, sub, subsub, pri, owners, team, status, handover, deadline = [c.strip() for c in raw[:9]]
            if not (ms or sub or subsub):
                continue
            rows.append(dict(ms=ms, sub=sub, subsub=subsub, pri=pri, owners=owners,
                             team=team, status=status, handover=handover, deadline=deadline))
    return rows


def node(title, row, own_row):
    n = OrderedDict()
    n["title"] = title
    n["status"] = STATUS[row["status"]] if own_row else "planned"
    n["assignees"] = parse_owners(row["owners"]) if own_row else []
    n["team"] = row["team"] if (own_row and row["team"] in TEAMS) else None
    n["handover"] = (row["handover"] or None) if own_row else None
    n["deadline"] = (row["deadline"] or None) if own_row else None
    n["children"] = []
    return n


def build(rows):
    milestones = []
    ms = sub = None
    for row in rows:
        if row["ms"]:
            own = not row["sub"] and not row["subsub"]
            ms = node(row["ms"], row, own)
            ms["priority"] = PRIORITY[row["pri"]]
            ms["_ownRow"] = own
            milestones.append(ms)
            sub = None
        if row["sub"]:
            own = not row["subsub"]
            sub = node(row["sub"], row, own)
            sub["_ownRow"] = own
            ms["children"].append(sub)
        if row["subsub"]:
            parent = sub if sub is not None else ms
            parent["children"].append(node(row["subsub"], row, True))
    return milestones


def subtree_teams(n):
    out = []
    def rec(x):
        if x["team"] and x["team"] not in out:
            out.append(x["team"])
        for c in x["children"]:
            rec(c)
    rec(n)
    return [t for t in ("Engineering", "Design", "PM") if t in out]


def infer(n):
    """A milestone/subtask with no row of its own (the sheet declared it on the same
    line as a deeper item) gets TEAM badges from its subtree, never inherited people:
    inheriting people upward would double-count them in the per-person load views."""
    for c in n["children"]:
        infer(c)
    if n.get("_ownRow", True) or not n["children"]:
        return
    n["assignees"] = [{"name": t, "isTeam": True} for t in subtree_teams(n)]
    tally = Counter(c["team"] for c in n["children"] if c["team"])
    n["team"] = tally.most_common(1)[0][0] if tally else None


def strip_meta(n):
    n.pop("_ownRow", None)
    for c in n["children"]:
        strip_meta(c)


def emit(nodes):
    def esc(s):
        return json.dumps(s, ensure_ascii=False)

    def owners(a):
        if not a:
            return "[]"
        return "[" + ", ".join(('T(%s)' if x.get("isTeam") else 'P(%s)') % esc(x["name"]) for x in a) + "]"

    def extra(n):
        bits = []
        if n.get("priority") is not None:
            bits.append("priority: %d" % n["priority"])
        if n.get("team"):
            bits.append("team: %s" % esc(n["team"]))
        if n.get("handover"):
            bits.append("handover: %s" % esc(n["handover"]))
        if n.get("deadline"):
            bits.append("deadline: %s" % esc(n["deadline"]))
        return "{ " + ", ".join(bits) + " }" if bits else ""

    def render(n, ind):
        pad = "  " * ind
        ex = extra(n)
        if not n["children"]:
            args = [esc(n["title"]), esc(n["status"]), owners(n["assignees"])]
            if ex:
                args += ["[]", ex]
            return pad + "N(" + ", ".join(args) + ")"
        kids = ",\n".join(render(c, ind + 1) for c in n["children"])
        head = pad + "N(%s, %s, %s, [\n%s\n%s]" % (esc(n["title"]), esc(n["status"]), owners(n["assignees"]), kids, pad)
        return head + (", " + ex + ")" if ex else ")")

    body = ",\n\n".join(render(n, 2) for n in nodes)
    return """import type { Assignee, Node, Status } from "./types";
import { uid } from "./id";

/** Bumped whenever the seed data below is regenerated from the roadmap sheet.
 *  A bump invalidates saved browser/Supabase state so everyone picks up the new tree. */
export const SEED_VERSION = 2;

/** Source of truth: the `Roadmap` tab of StackBack_Roadmap_Tasks_Updated.xlsx
 *  (Google Drive 1tHa3FtlnUOaCg5kH7zmUgkV2IfiUDmSb, last modified 2026-07-31).
 *  Generated, do not hand-edit: re-run the generator when the sheet changes. */
export const SEED_SOURCE = "Roadmap tab, StackBack_Roadmap_Tasks_Updated.xlsx (2026-07-31)";

function N(
  title: string,
  status: Status,
  assignees: Assignee[] = [],
  children: Node[] = [],
  extra: Partial<Node> = {},
): Node {
  return { id: uid("n_"), title, status, assignees, children, ...extra };
}
const P = (name: string): Assignee => ({ name });
const T = (name: string): Assignee => ({ name, isTeam: true });

export function stampIds(node: Node): Node {
  if (!node.id) node.id = uid("n_");
  if (!node.children) node.children = [];
  if (!node.assignees) node.assignees = [];
  node.children.forEach(stampIds);
  return node;
}

export function seed(): Node[] {
  return [
%s,
  ];
}
""" % body


def stats(nodes):
    horizon = {1: "Now", 2: "Next", 3: "Then", 4: "Later", 5: "Future"}
    tot = Counter()
    st = Counter()
    team = Counter()
    people = Counter()

    def walk(n, h):
        tot[h] += 1
        st[n["status"]] += 1
        team[n["team"] or "(none)"] += 1
        for a in n["assignees"]:
            people[a["name"] + (" [team]" if a.get("isTeam") else "")] += 1
        for c in n["children"]:
            walk(c, h)

    for m in nodes:
        walk(m, horizon[m["priority"]])
    print("milestones:", len(nodes))
    print("nodes total:", sum(tot.values()))
    print("by horizon:", dict(tot))
    print("by status:", dict(st))
    print("by team:", dict(team))
    print("owners:", dict(people))


if __name__ == "__main__":
    rows = read_rows()
    print("data rows:", len(rows))
    tree = build(rows)
    for m in tree:
        infer(m)
    stats(tree)
    for m in tree:
        strip_meta(m)
    src = emit(tree)
    if "--write" in sys.argv:
        with open(OUT, "w") as f:
            f.write(src)
        print("wrote", OUT, len(src), "bytes")
