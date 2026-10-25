#!/usr/bin/env python
"""Render and check the triage review from what the issue corpus actually carries.

    PYTHONUTF8=1 py .claude/skills/issue-triaging/scripts/review.py render > .tmp/body.html
    PYTHONUTF8=1 py .claude/skills/issue-triaging/scripts/review.py check

Reads metadata with `planr query docs/issues --format json` and the
priority matrix and floors/caps by parsing `.claude/skills/issue-triaging/SKILL.md`
section 6, so the rules live there and nowhere else.

`render` prints the `<plan-table>` body of the review page on stdout; splice it in
with `planr set-body <review.html> overview --file .tmp/body.html`.
The "vs matrix" column compares the written priority with impact x urgency and names
the section 6 rule that moved it, read off the document's `class` and `reach`. A row no
field-decidable rule explains reads `<- definitions`.

`check` exits 1 listing every document whose fields contradict a rule the skill states
unambiguously: `reach=none` exactly when `class=latent` (section 1a).
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), *[".."] * 4))
os.chdir(ROOT)
PLANR = ["node", os.path.join(".claude", "skills", "html-planning", "planr.js")]
ISSUES = os.path.join("docs", "issues")
SKILL = os.path.join(".claude", "skills", "issue-triaging", "SKILL.md")

COLUMNS = ["class", "reach", "impact", "urgency", "effort", "reference-paths"]
OWNED = "priority"
HEADS = {"reference-paths": "Paths"}

# Display names for parsed rules, keyed (class, reach, kind). Presentation only;
# the bucket and the condition come from SKILL.md.
LABELS = {
    ("author-data-loss", None, "floor"): "DM-text floor",
    ("feedback-loop", None, "floor"): "invariant floor",
    ("gap", "dm", "floor"): "in-use gap floor",
    ("gap", None, "floor"): "gap floor",
    ("material-bug", "dm", "floor"): "DM-output floor",
    ("interface-break", None, "cap"): "interface cap",
    ("scale", None, "cap"): "scale cap",
    ("portability", None, "cap"): "no-adopter cap",
    ("latent", None, "cap"): "unreachable cap",
}

ARROW = " &larr; "
DOT = " &middot; "


def read_skill():
    with open(SKILL, encoding="utf-8") as fh:
        return fh.read()


def parse_matrix(text):
    """(impact, urgency) -> bucket, from the table whose header row is `| Impact | urgency ...`."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"^\|[^|]*\|\s*urgency\s*`", line):
            urg = re.findall(r"urgency\s*`(\w+)`", line)
            matrix = {}
            for row in lines[i + 2:]:
                m = re.match(r"^\|\s*\*\*`(\w+)`\*\*\s*\|(.*)\|\s*$", row)
                if not m:
                    break
                buckets = re.findall(r"`(p\d)`", m.group(2))
                if len(buckets) != len(urg):
                    raise SystemExit("%s: matrix row for %s has %d cells, header has %d"
                                     % (SKILL, m.group(1), len(buckets), len(urg)))
                for u, b in zip(urg, buckets):
                    matrix[(m.group(1), u)] = b
            if len(matrix) == 12:
                return matrix
    raise SystemExit("%s: could not read the 4x3 priority matrix" % SKILL)


def parse_rules(text):
    """Floors and caps from the numbered list that follows the matrix.

    Each item is `N. **<sentence with a bucket>** (`class=...`) ...`. `at least` is a
    floor, `at most` a cap, and a bare `is`/`are` is a floor at p0 and a cap otherwise.
    A trailing `and `pA` ... when ... (`reach=X`)` clause adds a stronger floor.
    Items naming no class (evidence-only rules) are not field-decidable and are skipped.
    """
    floors, caps = [], []
    for m in re.finditer(r"^\d+\. \*\*(.+?)\*\*(.*)$", text, re.M):
        bold, rest = m.group(1), m.group(2)
        classes = re.findall(r"class=([\w-]+)", bold + rest)
        bucket = re.search(r"`(p\d)`", bold)
        if not classes or not bucket:
            continue
        bucket = bucket.group(1)
        reaches = re.findall(r"reach=([\w-]+)", bold + rest.split(" and `p")[0])
        reach = reaches[0] if reaches else None
        if "at least" in bold:
            kind = "floor"
        elif "at most" in bold:
            kind = "cap"
        else:
            kind = "floor" if bucket == "p0" else "cap"
        for c in classes:
            (floors if kind == "floor" else caps).append((c, reach, bucket, kind))
        extra = re.search(r"and `(p\d)`(?: or `p\d`)? when [^(]*\(`reach=([\w-]+)`\)", rest)
        if extra:
            for c in classes:
                floors.append((c, extra.group(2), extra.group(1), "floor"))
    if not floors or not caps:
        raise SystemExit("%s: could not read the section 6 floors and caps" % SKILL)

    def build(rules):
        out = []
        for c, r, b, k in sorted(rules, key=lambda x: x[2]):
            label = LABELS.get((c, r, k)) or LABELS.get((c, None, k)) or "%s %s" % (c, k)
            out.append((c, r, b, label))
        return out
    return build(floors), build(caps)


def query(fields):
    out = subprocess.run(
        PLANR + ["query", ISSUES, "--format", "json", "--fields", ",".join(fields)],
        capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        sys.stderr.write(out.stderr)
        raise SystemExit("planr query failed")
    sys.stderr.write(out.stderr)
    return json.loads(out.stdout)


def value(fields, key):
    return fields[key].get("value")


def rule(rules, cls, reach):
    for c, r, bucket, label in rules:
        if c == cls and (r is None or r == reach):
            return bucket, label
    return None


def cell(field):
    v = field.get("value")
    if v is None:
        return "&mdash;"
    if isinstance(v, list):
        return html.escape(", ".join(str(x) for x in v), quote=False)
    return html.escape(str(v), quote=False)


def against_matrix(fields, matrix_map, floors, caps):
    """Name what moved the written priority off impact x urgency.

    p0 is the most urgent, so a LOWER string is a HIGHER priority.
    """
    written = value(fields, OWNED)
    matrix = matrix_map.get((value(fields, "impact"), value(fields, "urgency")))
    cls, reach = value(fields, "class"), value(fields, "reach")
    if not matrix:
        return "&mdash;"
    if not written:
        return "unrated" + DOT + "matrix says %s" % matrix
    if not cls:
        return "matches matrix" if written == matrix else "class unset" + DOT + "matrix %s" % matrix
    floor, cap = rule(floors, cls, reach), rule(caps, cls, reach)

    def says(r):
        return "%s says %s" % (r[1], r[0])

    if written == matrix:
        if floor and floor[0] < written:
            return "matches matrix" + DOT + says(floor)
        if cap and cap[0] < written:
            return "matches matrix" + DOT + says(cap)
        return "matches matrix"
    if written < matrix:
        if floor and floor[0] == written:
            text = written + ARROW + floor[1]
        else:
            text = written + ARROW + "definitions" + (DOT + says(floor) if floor else "")
    else:
        if cap and cap[0] == written:
            text = written + ARROW + cap[1]
        elif floor and floor[0] < written:
            text = written + ARROW + "definitions" + DOT + says(floor)
        else:
            text = written + ARROW + "definitions" + (DOT + says(cap) if cap else "")
    return text + DOT + "matrix %s" % matrix


def render():
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    text = read_skill()
    matrix_map = parse_matrix(text)
    floors, caps = parse_rules(text)
    data = query(["path", "title", OWNED] + COLUMNS)

    rows = []
    unset = dict((c, 0) for c in COLUMNS)
    set_priority = off_matrix = by_rule = unexplained = 0
    IMPACTS = ["critical", "high", "medium", "low"]

    def suggested(f):
        return matrix_map.get((value(f, "impact"), value(f, "urgency")))

    def order(r):
        f = r["fields"]
        sug, own, impact = suggested(f), value(f, OWNED), value(f, "impact")
        return (own if own else "zz", sug if sug else "zz",
                IMPACTS.index(impact) if impact in IMPACTS else len(IMPACTS), r["path"])

    for r in sorted(data["results"], key=order):
        path = r["path"].replace("\\", "/")
        fields = r["fields"]
        for c in COLUMNS:
            if value(fields, c) is None:
                unset[c] += 1
        own = value(fields, OWNED)
        if own is not None:
            set_priority += 1
        verdict = against_matrix(fields, matrix_map, floors, caps)
        sug = suggested(fields)
        if sug and own not in (None, sug):
            off_matrix += 1
            if "definitions" in verdict or "class unset" in verdict:
                unexplained += 1
            else:
                by_rule += 1
        name = path.rsplit("/", 1)[-1]
        href = "../../issues/%s" % name
        cells = (
            ["<td><a href=\"%s\"><code>%s</code></a></td>"
             % (html.escape(href, quote=True), html.escape(name, quote=False))]
            + ["<td>%s</td>" % cell(fields[c]) for c in COLUMNS]
            + ["<td>%s</td>" % cell(fields[OWNED])]
            + ["<td class=\"muted\">%s</td>" % verdict]
        )
        rows.append("        <tr>" + "".join(cells) + "</tr>")

    gaps = ", ".join("%s %d" % (c, unset[c]) for c in COLUMNS)
    head = ["Issue"] + [HEADS.get(c, c.capitalize()) for c in COLUMNS] + ["Priority", "vs matrix"]

    print("<p>")
    print("  %d of %d document(s) scanned in <code>%s</code>. Unset by field: %s."
          % (data["matched"], data["scanned"], ISSUES.replace("\\", "/"), gaps))
    print("  Correct a row with <code>planr meta --set</code> on the document, then re-run")
    print("  <code>review.py render</code>.")
    print("</p>")
    print("<plan-callout type=\"warn\">")
    print("  <strong><code>Priority</code> is what the document carries.</strong>")
    print("  <code>vs matrix</code> compares it with impact &times; urgency and names the")
    print("  <code>issue-triaging</code> &sect;6 rule that moved it, read off the document&rsquo;s")
    print("  <code>class</code> and <code>reach</code>: <em>p1 &larr; DM-output floor</em>.")
    print("  <em>&larr; definitions</em> means no field-decidable rule explains it &mdash; the")
    print("  &sect;6 definitions or a vault reproduction did, and the document&rsquo;s <code>open</code>")
    print("  section says which. <em>&hellip; says pN</em> names a rule the written priority")
    print("  departs from. Rows are sorted worst-first by the written priority.")
    print("  <strong>%d document(s) carry a priority; %d sit off the matrix &mdash; %d by a named"
          " rule, %d by the definitions.</strong>"
          % (set_priority, off_matrix, by_rule, unexplained))
    print("</plan-callout>")
    print("<plan-table>")
    print("  <table>")
    print("    <thead><tr>%s</tr></thead>" % "".join("<th>%s</th>" % h for h in head))
    print("    <tbody>")
    for row in rows:
        print(row)
    print("    </tbody>")
    print("  </table>")
    print("</plan-table>")
    for s in data.get("skipped", []):
        sys.stderr.write("skipped: %s - %s\n" % (s.get("path"), s.get("reason")))
    return 0


def check():
    data = query(["path", "class", "reach"])
    bad = []
    for r in data["results"]:
        path = r["path"].replace("\\", "/")
        f = r["fields"]
        cls, reach = value(f, "class"), value(f, "reach")
        if cls is not None and reach is not None and (cls == "latent") != (reach == "none"):
            bad.append("%s: class=%s with reach=%s - reach is none exactly when class is latent"
                       % (path, cls, reach))
    if bad:
        sys.stderr.write("\n".join(bad) + "\n")
        sys.stderr.write("%d problem(s) against issue-triaging section 1a\n" % len(bad))
        return 1
    print("%d issue doc(s) checked, class/reach agree" % len(data["results"]))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="mode", required=True)
    sub.add_parser("render")
    sub.add_parser("check")
    args = ap.parse_args()
    return render() if args.mode == "render" else check()


if __name__ == "__main__":
    sys.exit(main())
