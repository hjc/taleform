import type { BuildContext, Builder } from "../core/builder";
import { formatCanvas, parseCanvas, sameCanvas, type CanvasEdge, type CanvasNode } from "../core/canvas";
import { list, str, truthy } from "../core/frontmatter";
import { SEQ_KINDS, type Note } from "../core/index";
import { parseLink } from "../core/links";
import { sha1 } from "../core/sha1";
import { dirname } from "../core/vault";
import { awardsOf, combatOf, fmt, partySize, resumeBeat, sequence } from "../core/story";
import { selectMissions } from "./navigation";


/**
 * The Adventure Map: `<Mission> — Adventure Map.canvas` beside the mission note. One card per
 * beat (its linked H1 over its live `^card` block), top to bottom in act/beat order, with
 * optional beats, branches, IF cards, XP awards, the resume marker and the hand-off.
 *
 * Every generated node and edge carries `generated: "adventure-map"`; anything without it was
 * added by hand and is kept. Positions of generated nodes survive unless `relayout`.
 */
export const MARK = { generated: "adventure-map" } as const;

const STATUS_COLOR: Record<string, string> = { played: "4", partial: "3", skipped: "1" };
const BRANCH = "2", RED = "1", RESUME = "6";
const W = 360, H = 240;
const YS = H + 100; // row step: the adventure runs top to bottom
const SIDE = W + 100; // optional beats step right; IF cards go two steps right
const LW = 280; // left margin: XP awards, resume marker, long-jump labels
const LX = -(LW + 60);
const HX = LX - 40 - 80 - (W + 40); // mission, references and legend column
const CARD = /\s\^card[ \t]*$/gm;

export const nid = (...parts: string[]) => sha1(parts.join("|")).slice(0, 16);

export const adventureMap: Builder = {
  id: "adventure-map",
  description: "One Adventure Map canvas per mission",
  run(ctx) {
    for (const mission of selectMissions(ctx.index, ctx.options.missions)) buildMap(ctx, mission);
  },
};

interface Beat {
  note: Note;
  act: number;
  beat: number;
  cards: number;
}

function buildMap(ctx: BuildContext, mission: Note) {
  const { index, options } = ctx;
  const out = `${mission.folder ? mission.folder + "/" : ""}${mission.basename} — Adventure Map.canvas`;
  const fm = mission.fm;
  const bad = (msg: string, path?: string) => ctx.problem("error", msg, path ?? out);

  const members = index.members(mission).sort((a, b) => a.path.localeCompare(b.path));
  const refs = members.filter((n) => n.kind === "reference");
  const beats = new Map<string, Beat>();
  for (const n of members) {
    if (!n.kind || !SEQ_KINDS.has(n.kind)) continue;
    const cards = (n.text.match(CARD) ?? []).length;
    if (cards !== 1) bad(`${cards} \`^card\` blocks (needs exactly one): end the Trigger / Lands when paragraph with \` ^card\``, n.path);
    beats.set(n.basename, { note: n, act: Number(n.fm.act ?? 0), beat: Number(n.fm.beat ?? 0), cards });
  }
  if (!beats.size) return;
  const resume = resumeBeat(sequence(index, mission))?.basename;

  const old = parseCanvas(ctx.read(out));
  const keep = new Map(options.relayout ? [] : old.nodes.map((n) => [n.id, n]));
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  const node = (id: string, kw: Omit<CanvasNode, "id">) => {
    const k = keep.get(id);
    const n = { id, ...kw, ...MARK } as unknown as CanvasNode;
    if (k) Object.assign(n, { x: k.x, y: k.y, width: k.width, height: k.height });
    nodes.push(n);
  };
  const edge = (a: string, b: string, label: string | null = null, color: string | null = null,
                fs = "right", ts = "left", end = "arrow") => {
    const e: CanvasEdge = { id: nid("e", a, b, label ?? ""), fromNode: a, fromSide: fs, toNode: b, toSide: ts };
    if (end !== "arrow") e.toEnd = end; // arrow is the default, and Obsidian drops it on save
    if (label) e.label = label;
    if (color) e.color = color;
    edges.push({ ...e, ...MARK });
  };
  const colored = (c: string | null | undefined) => (c ? { color: c } : {});

  // ---- one top-to-bottom line; each act a group down it ----------------------------------
  const order = [...beats.keys()].sort((a, b) => beats.get(a)!.act - beats.get(b)!.act || beats.get(a)!.beat - beats.get(b)!.beat);
  const acts = [...new Set(order.map((s) => beats.get(s)!.act))];
  const pos = new Map<string, { x: number; y: number; side: boolean }>();
  let row = 0;
  for (const act of acts) {
    const seq = order.filter((s) => beats.get(s)!.act === act);
    const first = row;
    for (const s of seq) {
      const side = truthy(beats.get(s)!.note.fm.optional);
      pos.set(s, { x: side ? SIDE : 0, y: Math.trunc(row * YS), side });
      row += 1;
    }
    const actNote = seq.find((s) => beats.get(s)!.note.kind === "act");
    const status = (actNote && str(beats.get(actNote)!.note.fm["beat-status"])) || "planned";
    const title = actNote ? (actNote.includes(" — ") ? actNote.slice(actNote.indexOf(" — ") + 3) : actNote) : "";
    node(nid("g", String(act)), {
      type: "group", x: LX - 40, y: Math.trunc(first * YS) - 60,
      width: -LX + 2 * SIDE + W + 80, height: Math.trunc((row - first) * YS) + 20,
      label: `Act ${act} — ${title} · ${status}`, ...colored(STATUS_COLOR[status]),
    });
    row += 0.4; // a gutter between acts
  }

  for (const s of order) {
    const b = beats.get(s)!;
    const p = pos.get(s)!;
    const kw = b.cards
      ? { type: "text" as const, text: `## [[${s}|${b.note.title}]]\n![[${s}#^card]]` }
      : { type: "file" as const, file: b.note.path };
    node(nid("n", s), { ...kw, x: p.x, y: p.y, width: W, height: H, ...colored(STATUS_COLOR[str(b.note.fm["beat-status"]) ?? ""]) });
  }

  // The left margin: each beat's resume marker, long-jump labels, XP awards and combat, queued
  // here and laid out last, down one column in beat order, so no card lands on another.
  const margin: Array<{ s: string; id: string; height: number; color: string; text: string }> = [];
  const left = (s: string, id: string, height: number, color: string, text: string) => margin.push({ s, id, height, color, text });

  // ---- mission, references and legend to the left; resume marker -------------------------
  const hubId = nid("hub");
  node(hubId, { type: "file", file: mission.path, x: HX, y: 0, width: W + 40, height: H + 160 });
  refs.forEach((r, i) => node(nid("ref", r.basename), { type: "file", file: r.path, x: HX, y: H + 220 + i * (H + 60), width: W + 40, height: H }));
  edge(hubId, nid("n", order[0]!));
  if (resume && beats.has(resume)) {
    const rid = nid("resume");
    const why = str(beats.get(resume)!.note.fm["beat-status"]) === "partial"
      ? "the table stopped partway through this beat"
      : "the first planned beat after the furthest one played";
    left(resume, rid, 90, RESUME, `## ▶ RESUME HERE\n${why}`);
    edge(rid, nid("n", resume), null, RESUME);
  }
  node(nid("legend"), {
    type: "text", x: HX, y: -360, width: W + 40, height: 300,
    text:
      "## Legend\n" +
      "**Cards** 🟩 played · 🟨 partial · ⬜ planned · 🟥 skipped\n" +
      "**Stepped right** optional or alternative beat\n" +
      "**Arrows** grey = sequence · 🟩 = the path the table took · 🟧 = branch\n" +
      "**Red cards** IF states (far right) and XP: 🟥 awards, ⚔ combat (left)\n\n" +
      "Generated by Taleform from beat frontmatter: edit the notes, not these cards. " +
      "Drag freely — positions survive a regenerate, and anything you add by hand is kept.",
  });

  // ---- sequence ---------------------------------------------------------------------------
  const played = (s: string) => ["played", "partial"].includes(str(beats.get(s)?.note.fm["beat-status"]) ?? "");
  for (const s of order) {
    const b = beats.get(s)!;
    const nxt = parseLink(b.note.fm.next)?.target;
    if (!nxt || !beats.has(nxt)) continue;
    const s1 = pos.get(s)!.side, s2 = pos.get(nxt)!.side;
    const [fs, ts] = s2 && !s1 ? ["right", "top"] : s1 && !s2 ? ["bottom", "right"] : ["bottom", "top"];
    const into = beats.get(nxt)!.note.fm;
    const label = parseLink(into.prev)?.target === s ? str(beats.get(nxt)!.note.fm.entry) ?? null : null;
    edge(nid("n", s), nid("n", nxt), label, played(s) && played(nxt) ? "4" : null, fs, ts);
  }

  const jump = (f: string, t: string): [string, string] => {
    const [lo, hi] = [pos.get(f)!.y, pos.get(t)!.y].sort((a, b) => a - b) as [number, number];
    const between = order.filter((s) => lo < pos.get(s)!.y && pos.get(s)!.y < hi);
    return between.every((s) => pos.get(s)!.side) ? ["bottom", "top"] : ["left", "left"];
  };

  const branches: Array<[string, string, string | undefined]> = [];
  for (const s of order) {
    for (const item of list(beats.get(s)!.note.fm.branches)) {
      const b = item as { to?: unknown; label?: unknown } | null;
      const l = parseLink(b?.to);
      if (!l || !beats.has(l.target)) {
        bad(`branches: ${String(b?.to)} is not a beat of this mission`, beats.get(s)!.note.path);
        continue;
      }
      branches.push([s, l.target, str(b?.label)]);
    }
  }

  for (let i = 0; i < order.length; ) {
    if (!pos.get(order[i]!)!.side) {
      i++;
      continue;
    }
    let j = i;
    while (j < order.length && pos.get(order[j]!)!.side) j++;
    if (i > 0 && j < order.length) {
      const a = order[i - 1]!, z = order[j]!;
      if (!branches.some(([f, t]) => f === a && t === z)) {
        const took = played(a) && played(z) && !order.slice(i, j).some(played);
        edge(nid("n", a), nid("n", z), "skip — optional", took ? "4" : null, ...jump(a, z));
      }
    }
    i = j;
  }

  for (const [f, t, label] of branches) {
    const color = played(f) && played(t) ? "4" : BRANCH;
    const sides = jump(f, t);
    if (sides[0] === "left" && label) {
      // a long jump's label lands mid-curve, on whatever is there: pin it at the source
      const lid = nid("jump", f, t);
      left(f, lid, 120, color, label);
      edge(nid("n", f), lid, null, color, "left", "right");
      edge(lid, nid("n", t), null, color, "left", "left");
    } else {
      edge(nid("n", f), nid("n", t), label ?? null, color, ...sides);
    }
  }

  if (options.threads) {
    const seen = new Set<string>();
    for (const s of order) {
      const fmS = beats.get(s)!.note.fm;
      for (const r of list(fmS.related)) {
        const t = parseLink(r)?.target;
        if (!t || !beats.has(t) || t === s) continue;
        const key = [s, t].sort().join("|");
        if (seen.has(key) || [parseLink(fmS.next)?.target, parseLink(fmS.prev)?.target].includes(t)) continue;
        seen.add(key);
        const [a, z] = [s, t].sort((x, y) => order.indexOf(x) - order.indexOf(y)) as [string, string];
        edge(nid("n", a), nid("n", z), null, "5", "right", "right", "none");
      }
    }
  }

  // ---- IF cards (right), XP awards (left), hand-off (below) -------------------------------
  let freeRight = -Infinity; // IF cards stack down their column, as the left margin does
  for (const s of order) {
    list(beats.get(s)!.note.fm.outcomes).forEach((item, k) => {
      const o = (item ?? {}) as { if?: unknown; then?: unknown; to?: unknown };
      let to = parseLink(o.to)?.target;
      if (to && !beats.has(to)) {
        bad(`outcomes[${k}].to ${to} is not a beat of this mission`, beats.get(s)!.note.path);
        to = undefined;
      }
      const cond = str(o.if);
      const color = cond ? RED : null;
      const tid = nid("if", s, String(k));
      const y = Math.max(pos.get(s)!.y + 50, freeRight);
      freeRight = y + 150;
      node(tid, { type: "text", x: 2 * SIDE, y, width: W, height: 140,
                  text: cond ? `**IF ${cond}**\n${str(o.then) ?? ""}` : str(o.then) ?? "", ...colored(color) });
      edge(nid("n", s), tid, null, color);
      if (to) edge(tid, nid("n", to), null, color, "bottom", "right");
    });
  }

  const party = partySize(mission);
  for (const s of order) {
    const b = beats.get(s)!;
    const list_ = awardsOf(b.note, () => undefined); // schema reports malformed awards
    const story = list_.filter((a) => a.type === "story").reduce((t, a) => t + a.xp, 0);
    const optional = list_.filter((a) => a.type === "optional")
      .map((a) => `🟥 OPTIONAL ${fmt(a.xp)} each${a.per ? ` per ${a.per}` : ""}${a.max ? ` (max ${fmt(a.max)})` : ""}`);
    if (story || optional.length) {
      const xid = nid("xp", s);
      const text = [story ? `## 🟥 AWARD XP\n**${fmt(story)} each**` : "", ...optional].filter(Boolean).join("\n");
      left(s, xid, 120, RED, text);
      edge(xid, nid("n", s), null, RED);
    }
    const combat = combatOf(index, b.note, () => undefined); // the ledger reports unreadable blocks
    if (combat?.total) {
      const cid = nid("combat", s);
      const each = party ? ` · **${fmt(Math.floor(combat.total / party))} each**` : "";
      left(s, cid, 120, RED, `## ⚔ COMBAT XP\n${fmt(combat.total)}${each}`);
      edge(cid, nid("n", s), null, RED);
    }
  }

  let free = -Infinity;
  for (const s of order) {
    for (const m of margin.filter((m) => m.s === s)) {
      const y = Math.max(pos.get(s)!.y + 60, free);
      node(m.id, { type: "text", x: LX, y, width: LW, height: m.height, color: m.color, text: m.text });
      free = y + m.height + 10;
    }
  }

  const last = order[order.length - 1]!;
  const handoff = parseLink(beats.get(last)!.note.fm.next);
  if (handoff && !beats.has(handoff.target)) {
    const hit = index.resolve(handoff);
    if (hit) {
      const hid = nid("handoff", handoff.target);
      const hy = pos.get(last)!.y + YS + 80;
      node(hid, { type: "file", file: hit.path, ...(handoff.subpath ? { subpath: handoff.subpath } : {}), x: 0, y: hy, width: W + 40, height: H + 60 });
      edge(nid("n", last), hid, "hands off to", null, "bottom", "top");
      const note = str(mission.fm.handoff);
      if (note) {
        const tid = nid("handoff-note");
        node(tid, { type: "text", x: SIDE, y: hy, width: W + 40, height: 140, color: RED, text: note });
        edge(hid, tid, null, RED);
      }
    } else {
      bad(`\`next\` ${handoff.target} does not resolve to a note`, beats.get(last)!.note.path);
    }
  }

  // ---- keep what the DM added by hand; assemble ------------------------------------------
  const genNodes = new Set(nodes.map((n) => n.id));
  const genEdges = new Set(edges.map((e) => e.id));
  const handNodes = old.nodes.filter((n) => n.generated !== MARK.generated && !genNodes.has(n.id));
  const knownIds = new Set([...genNodes, ...handNodes.map((n) => n.id)]);
  const handEdges = old.edges.filter((e) => e.generated !== MARK.generated && !genEdges.has(e.id) && knownIds.has(e.fromNode) && knownIds.has(e.toNode));
  const allNodes = [...nodes.filter((n) => n.type === "group"), ...nodes.filter((n) => n.type !== "group"), ...handNodes];
  const allEdges = [...edges, ...handEdges];
  const ids = [...allNodes, ...allEdges].map((x) => x.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) return bad(`duplicate ids ${[...new Set(dup)].join(", ")}: two map items resolve to the same thing`);
  if (dirname(out) !== mission.folder) bad("map path outside the mission folder"); // defensive: never write elsewhere
  ctx.emit(out, formatCanvas({ nodes: allNodes, edges: allEdges }), { same: sameCanvas });
}
