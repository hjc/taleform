import type { Builder, BuildContext } from "../core/builder";
import { list, str } from "../core/frontmatter";
import { SEQ_KINDS, type Note } from "../core/index";
import { parseLink } from "../core/links";
import { awardsOf, STATUSES } from "../core/story";

/**
 * The type system. Frontmatter stays the source; this is the contract it is held to. It emits
 * nothing and runs first, so every other builder can trust what it reads.
 */
const KINDS = new Set(["mission", ...SEQ_KINDS, "reference", "bench"]);

/**
 * Properties an earlier version used, and what replaced them. Lists of objects stay at the top
 * level on purpose: Obsidian, make.md and Nested Properties all edit them there, but a list
 * nested inside an object renders as "[object Object]" and is one keystroke from being lost.
 */
const RETIRED: Record<string, string> = {
  "map-label": "entry",
  "map-branches": "branches (a list of {to, label})",
  "map-if": "outcomes (a list of {if, then, to})",
  "map-handoff": "handoff",
  map: "top-level entry / branches / outcomes / handoff",
  "xp-award": "awards (a list of {xp, for, …})",
  resume: "nothing: resume is derived from beat-status",
};

export const schema: Builder = {
  id: "schema",
  description: "Validates mission and beat frontmatter against Taleform's types",
  run(ctx) {
    const { index } = ctx;
    for (const n of index.notes.values()) {
      const err = (m: string) => ctx.problem("error", m, n.path);
      if (n.fmError) err(n.fmError);
      if (!n.kind || !(n.kind === "mission" || n.fm.mission !== undefined)) continue; // not story data
      if (!KINDS.has(n.kind)) err(`kind \`${n.kind}\` is not one of ${[...KINDS].join(", ")}`);
      for (const [old, now] of Object.entries(RETIRED)) if (n.fm[old] !== undefined) err(`\`${old}\` is retired; use ${now}`);
      if (n.kind === "mission") mission(ctx, n);
      else member(ctx, n);
    }
  },
};

function mission(ctx: BuildContext, n: Note) {
  for (const key of ["party-size", "party-xp"]) {
    const v = n.fm[key];
    if (v !== undefined && !(Number.isFinite(Number(v)) && Number(v) >= 0)) ctx.problem("error", `\`${key}\` must be a number`, n.path);
  }
  text(ctx, n, "handoff");
}

function member(ctx: BuildContext, n: Note) {
  const err = (m: string) => ctx.problem("error", m, n.path);
  const m = ctx.index.link(n.fm.mission);
  if (!m) return err(`\`mission\` ${String(n.fm.mission)} does not link to a note`);
  if (m.kind !== "mission") err(`\`mission\` links to ${m.basename}, which is not \`kind: mission\``);
  if (!n.kind || !SEQ_KINDS.has(n.kind)) return;

  for (const key of ["act", "beat"]) if (!Number.isInteger(Number(n.fm[key]))) err(`\`${key}\` must be a whole number`);
  const st = str(n.fm["beat-status"]) ?? "planned";
  if (!(STATUSES as readonly string[]).includes(st)) err(`\`beat-status\` ${st} is not one of ${STATUSES.join(", ")}`);
  for (const key of ["prev", "next"]) {
    const l = parseLink(n.fm[key]);
    if (!l) err(`\`${key}\` must be a whole link`);
    else if (!ctx.index.resolve(l)) ctx.problem("warning", `\`${key}\` ${l.target} does not resolve yet`, n.path);
  }
  awardsOf(n, err);
  text(ctx, n, "entry");
  storyLinks(ctx, n);
}

function text(ctx: BuildContext, n: Note, key: string) {
  const v = n.fm[key];
  if (v !== undefined && v !== null && typeof v !== "string") ctx.problem("error", `\`${key}\` must be text`, n.path);
}

/** `branches` and `outcomes`: top-level lists of objects whose links are whole values. */
function storyLinks(ctx: BuildContext, n: Note) {
  const err = (m: string) => ctx.problem("error", m, n.path);
  const objects = (key: string) =>
    list(n.fm[key]).map((v, i) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) err(`${key}[${i}] must be an object`);
      return [i, (v ?? {}) as Record<string, unknown>] as const;
    });
  for (const [i, b] of objects("branches")) {
    if (!parseLink(b.to)) err(`branches[${i}].to must be a whole link`);
    if (b.label !== undefined && typeof b.label !== "string") err(`branches[${i}].label must be text`);
  }
  for (const [i, o] of objects("outcomes")) {
    if (!str(o.then)) err(`outcomes[${i}] needs \`then\``);
    if (o.to !== undefined && !parseLink(o.to)) err(`outcomes[${i}].to must be a whole link`);
  }
}
