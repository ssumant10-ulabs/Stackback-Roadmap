#!/usr/bin/env python3
"""Generate lib/seed.ts for the StackBack roadmap app from the Roadmap tab TSV.

Source of truth: the `Roadmap` tab of StackBack_Roadmap_Tasks_Updated.xlsx
(Drive id 1tHa3FtlnUOaCg5kH7zmUgkV2IfiUDmSb).

To refresh the app after the team edits the sheet:
  1. Update data/roadmap_tab.tsv to match the Roadmap tab (tab-separated; the 9 original
     columns, optionally followed by start / end / tat).
  2. python3 data/gen_seed.py --diff     # what would change vs the committed snapshot
  3. python3 data/gen_seed.py --write    # rewrites lib/seed.ts, bumps SEED_VERSION,
                                         # and refreshes data/roadmap_snapshot.json

SEED_VERSION is bumped automatically on --write: forgetting step 4 by hand is exactly how
a saved browser ends up pinned to a superseded copy of the sheet.

Columns are matched by HEADER NAME, not position, so adding a column to the sheet does not
silently shift the data by one.
"""
import csv, datetime, json, os, re, sys
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
TSV = os.path.join(HERE, "roadmap_tab.tsv")
OUT = os.path.join(HERE, os.pardir, "lib", "seed.ts")
SNAP = os.path.join(HERE, "roadmap_snapshot.json")

# The app has four states: Now, Next, Future and Done. Done is derived from the work being
# checked off, never authored, so only three priorities are written. The sheet still uses
# five words, so Then folds into Next and Later folds into Future.
PRIORITY = {"Now": 1, "Next": 2, "Then": 2, "Later": 3, "Future": 3}
STATE_WORD = {1: "Now", 2: "Next", 3: "Future"}
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


# Sheet header -> internal field. Matched case-insensitively on the header row so a
# reordered or extended sheet cannot shift every value one column to the left.
COLMAP = {
    "milestone": "ms", "subtask": "sub", "subsub": "subsub", "priority": "pri",
    "owners": "owners", "team": "team", "status": "status",
    "handover": "handover", "deadline": "deadline",
    "start": "start", "end": "end", "tat": "tat",
}
FIELDS = ["ms", "sub", "subsub", "pri", "owners", "team", "status", "handover", "deadline",
          "start", "end", "tat"]


def read_rows(path=None):
    rows = []
    with open(path or TSV, newline="") as f:
        r = csv.reader(f, delimiter="\t")
        header = [h.strip().lower() for h in next(r)]
        idx = {}
        for i, h in enumerate(header):
            key = COLMAP.get(h)
            if key and key not in idx:
                idx[key] = i
        missing = [k for k in ("ms", "sub", "subsub", "pri") if k not in idx]
        if missing:
            sys.exit("TSV header is missing required column(s): %s (found: %s)" % (missing, header))
        for raw in r:
            get = lambda k: (raw[idx[k]].strip() if k in idx and idx[k] < len(raw) else "")
            row = {k: get(k) for k in FIELDS}
            if not (row["ms"] or row["sub"] or row["subsub"]):
                continue
            rows.append(row)
    return rows


ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def norm_day(v):
    """Accepts yyyy-mm-dd and dd/mm/yyyy, the two shapes the sheet actually uses."""
    v = (v or "").strip()
    if not v:
        return None
    if ISO_RE.match(v):
        return v
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", v)
    if m:
        d, mo, y = m.groups()
        return "%s-%s-%s" % (y, mo.zfill(2), d.zfill(2))
    print("  ! unparseable date, ignoring: %r" % v)
    return None


def norm_tat(v):
    v = (v or "").strip()
    if not v:
        return None
    m = re.match(r"^(\d+)", v)
    return int(m.group(1)) if m and int(m.group(1)) > 0 else None


def node(title, row, own_row):
    n = OrderedDict()
    n["title"] = title
    n["status"] = (STATUS.get(row["status"], "planned") if own_row else "planned")
    n["assignees"] = parse_owners(row["owners"]) if own_row else []
    n["team"] = row["team"] if (own_row and row["team"] in TEAMS) else None
    n["handover"] = (row["handover"] or None) if own_row else None
    n["deadline"] = (row["deadline"] or None) if own_row else None
    n["start"] = (norm_day(row.get("start")) if own_row else None)
    n["end"] = (norm_day(row.get("end")) if own_row else None)
    n["tat"] = (norm_tat(row.get("tat")) if own_row else None)
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


def emit(nodes, version):
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
        if n.get("start"):
            bits.append("start: %s" % esc(n["start"]))
        if n.get("end"):
            bits.append("end: %s" % esc(n["end"]))
        if n.get("tat"):
            bits.append("tat: %d" % n["tat"])
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
export const SEED_VERSION = %d;

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
""" % (version, body)


# ---------------------------------------------------------------- diff vs snapshot

TRACKED = ("status", "priority", "team", "handover", "deadline", "start", "end", "tat")


def flatten(nodes, parent="", out=None):
    """Path-keyed map of every node, so a diff can name what moved rather than just
    reporting a count. The path is milestone/subtask/subsub, which is how the sheet
    identifies a row anyway."""
    if out is None:
        out = {}
    for n in nodes:
        path = (parent + " / " if parent else "") + n["title"]
        rec = {k: n.get(k) for k in TRACKED}
        rec["owners"] = ", ".join(
            (a["name"] + (" [team]" if a.get("isTeam") else "")) for a in n.get("assignees", [])
        )
        out[path] = rec
        flatten(n.get("children", []), path, out)
    return out


def load_snapshot():
    if not os.path.exists(SNAP):
        return None
    try:
        with open(SNAP) as f:
            return json.load(f)
    except (ValueError, OSError) as e:
        print("  ! snapshot unreadable (%s), treating as first run" % e)
        return None


def compute_diff(tree):
    """(added, removed, changed, prev) against the committed snapshot, or None for prev
    when there is no snapshot to compare with yet."""
    now = flatten(tree)
    prev = load_snapshot()
    if prev is None:
        return [], [], [], None
    old = prev.get("nodes", {})
    added = [k for k in now if k not in old]
    removed = [k for k in old if k not in now]
    changed = []
    for k in now:
        if k not in old:
            continue
        for f in list(TRACKED) + ["owners"]:
            a, b = old[k].get(f), now[k].get(f)
            if (a or None) != (b or None):
                changed.append((k, f, a, b))
    return added, removed, changed, prev


def show_diff(tree):
    added, removed, changed, prev = compute_diff(tree)
    now = flatten(tree)
    if prev is None:
        print("\nNo snapshot at data/roadmap_snapshot.json: nothing to diff against.")
        print("Run --snapshot-only to record the current tree as the baseline.")
        return True

    print("\n=== diff vs snapshot %s ===" % prev.get("generated", "(undated)"))
    if not (added or removed or changed):
        print("No changes. lib/seed.ts already matches this TSV.")
        return False

    if added:
        print("\nADDED (%d):" % len(added))
        for k in added:
            print("  + %s  [%s]" % (k, now[k].get("status")))
    if removed:
        print("\nREMOVED (%d):" % len(removed))
        for k in removed:
            print("  - %s" % k)
    if changed:
        print("\nCHANGED (%d field%s):" % (len(changed), "" if len(changed) == 1 else "s"))
        for k, f, a, b in changed:
            print("  ~ %s\n      %s: %r -> %r" % (k, f, a, b))
    print("\n%d added, %d removed, %d field change%s. Re-run with --write to apply."
          % (len(added), len(removed), len(changed), "" if len(changed) == 1 else "s"))
    return True


def current_seed_version():
    try:
        with open(OUT) as f:
            m = re.search(r"export const SEED_VERSION = (\d+)", f.read())
            return int(m.group(1)) if m else 1
    except OSError:
        return 1


def write_snapshot(tree, version):
    with open(SNAP, "w") as f:
        json.dump({
            "seedVersion": version,
            "generated": datetime.date.today().isoformat(),
            "source": os.path.basename(TSV),
            "nodes": flatten(tree),
        }, f, indent=1, sort_keys=True)
        f.write("\n")


def stats(nodes):
    tot = Counter()
    state = Counter()
    ms_state = Counter()
    st = Counter()
    team = Counter()
    people = Counter()

    def all_done(n):
        kids = n["children"]
        return all(c["status"] == "done" and all_done(c) for c in kids) if kids else n["status"] == "done"

    def walk(n, h):
        tot[h] += 1
        # Done wins over the horizon, matching lib/derive.ts nodeState().
        state["Done" if n["status"] == "done" else h] += 1
        st[n["status"]] += 1
        team[n["team"] or "(none)"] += 1
        for a in n["assignees"]:
            people[a["name"] + (" [team]" if a.get("isTeam") else "")] += 1
        for c in n["children"]:
            walk(c, h)

    for m in nodes:
        h = STATE_WORD[m["priority"]]
        walk(m, h)
        ms_state["Done" if all_done(m) else h] += 1
    print("milestones:", len(nodes), dict(ms_state))
    print("nodes total:", sum(tot.values()))
    print("by horizon (ignoring done):", dict(tot))
    print("by state (done wins):", dict(state), "sum:", sum(state.values()))
    print("by status:", dict(st))
    print("by team:", dict(team))
    print("owners:", dict(people))


def arg_value(flag):
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return None


if __name__ == "__main__":
    tsv = arg_value("--tsv")
    if tsv:
        TSV = os.path.abspath(tsv)
        print("source:", TSV)
    rows = read_rows(TSV)
    print("data rows:", len(rows))
    tree = build(rows)
    for m in tree:
        infer(m)
    stats(tree)
    for m in tree:
        strip_meta(m)

    if "--snapshot-only" in sys.argv:
        v = current_seed_version()
        write_snapshot(tree, v)
        print("recorded baseline snapshot at SEED_VERSION %d: %s" % (v, SNAP))
        sys.exit(0)

    if "--diff" in sys.argv:
        show_diff(tree)
        if "--write" not in sys.argv:
            sys.exit(0)

    if "--write" in sys.argv:
        added, removed, changed, prev = compute_diff(tree)
        moved = bool(added or removed or changed) or prev is None
        cur = current_seed_version()
        # Bumping SEED_VERSION forces every saved browser and the shared Supabase row to
        # re-seed, which throws away whatever the team has edited on the board. So bump
        # only when the sheet actually moved: a no-op regeneration must stay a no-op.
        version = cur + 1 if moved else cur
        src = emit(tree, version)
        with open(OUT, "w") as f:
            f.write(src)
        write_snapshot(tree, version)
        if moved:
            print("wrote %s (%d bytes), SEED_VERSION %d -> %d" % (OUT, len(src), cur, version))
            print("Saved browsers and the Supabase row will re-seed on next load.")
        else:
            print("wrote %s (%d bytes), SEED_VERSION held at %d (no content change)" % (OUT, len(src), cur))
        print("wrote %s" % SNAP)
    else:
        print("\nDry run. --diff to see what would change, --write to apply.")
