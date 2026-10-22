import { parse } from "yaml";
import { list, str, truthy } from "./frontmatter";
import { SEQ_KINDS, type Note, type StoryIndex } from "./index";
import { parseLink, type WikiLink } from "./links";

/** The domain model every builder shares: sequence, status, resume, awards, combat XP. */

export const STATUSES = ["planned", "played", "partial", "skipped"] as const;
export const status = (n: Note) => str(n.fm["beat-status"]) ?? "planned";
const touched = (n: Note) => ["played", "partial", "skipped"].includes(status(n));

/** A mission's sequence notes in `act`/`beat` order. */
export function sequence(index: StoryIndex, mission: Note): Note[] {
  return index
    .members(mission)
    .filter((n) => n.kind && SEQ_KINDS.has(n.kind))
    .sort((a, b) => Number(a.fm.act ?? 0) - Number(b.fm.act ?? 0) || Number(a.fm.beat ?? 0) - Number(b.fm.beat ?? 0));
}

/**
 * Where the table picks up, derived from beat status alone. Find the furthest beat the table
 * has touched (played, partial or skipped). If it is `partial`, the session stopped inside it;
 * otherwise resume at the first planned, non-optional beat after it. Act notes never count.
 * `partial` earlier in the line means "ran, but only half landed", not "in progress".
 */
export function resumeBeat(seq: Note[]): Note | undefined {
  const beats = seq.filter((n) => n.kind !== "act");
  let furthest = -1;
  beats.forEach((n, i) => {
    if (touched(n)) furthest = i;
  });
  if (furthest >= 0 && status(beats[furthest]!) === "partial") return beats[furthest];
  return beats.find((n, i) => i > furthest && status(n) === "planned" && !truthy(n.fm.optional));
}

// ---- awards ---------------------------------------------------------------------------------

export interface Award {
  xp: number;
  type: "story" | "optional";
  /** What earns it: "Immi up alive". */
  for?: string;
  /** For a repeatable optional award: "egg sac burned". */
  per?: string;
  max?: number;
  /** An extra line for the DM, shown under the callout. */
  note?: string;
}

/** Typed `awards` from a note; malformed entries are reported, not guessed at. */
export function awardsOf(n: Note, problem: (msg: string) => void): Award[] {
  const out: Award[] = [];
  list(n.fm.awards).forEach((raw, i) => {
    const where = `awards[${i}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return problem(`${where} must be an object with at least \`xp\``);
    const a = raw as Record<string, unknown>;
    const xp = Number(a.xp);
    if (!Number.isFinite(xp) || xp <= 0) return problem(`${where}.xp must be a positive number`);
    const type = str(a.type) ?? "story";
    if (type !== "story" && type !== "optional") return problem(`${where}.type must be story or optional, not ${type}`);
    const known = new Set(["xp", "type", "for", "per", "max", "note"]);
    for (const k of Object.keys(a)) if (!known.has(k)) problem(`${where}.${k} is not an award field (${[...known].join(", ")})`);
    const award: Award = { xp, type };
    for (const k of ["for", "per", "note"] as const) if (str(a[k])) award[k] = str(a[k])!;
    if (a.max !== undefined) award.max = Number(a.max);
    if (type === "story" && (award.per || award.max)) problem(`${where}: per / max only make sense on an optional award`);
    out.push(award);
  });
  return out;
}

// ---- combat ---------------------------------------------------------------------------------

/** 2024 XP by challenge rating (the same table as the vault's xp-budget.py). */
const XP_BY_CR: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000,
  "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000,
  "28": 120000, "29": 135000, "30": 155000,
};

export interface Combat {
  total: number;
  lines: Array<{ count: number; creature: string; cr: string; xp: number }>;
}

/**
 * Combat XP from a note's ```encounter block (the Initiative Tracker format) and each
 * creature's stat block (`statblock: true` notes with `name` and `cr`).
 */
export function combatOf(index: StoryIndex, n: Note, problem: (msg: string) => void): Combat | null {
  const m = /^```encounter\n([\s\S]*?)\n```/m.exec(n.text);
  if (!m) return null;
  let block: { creatures?: unknown[] };
  try {
    block = parse(m[1]!) ?? {};
  } catch (e) {
    problem(`the encounter block is not valid YAML: ${(e as Error).message.split("\n")[0]}`);
    return null;
  }
  const result: Combat = { total: 0, lines: [] };
  for (const entry of list(block.creatures)) {
    let count = 1, creature: string | undefined;
    if (typeof entry === "string") creature = entry;
    else if (entry && typeof entry === "object") {
      const [k, v] = Object.entries(entry)[0] ?? [];
      count = Number(k);
      creature = typeof v === "string" ? v : str((v as Record<string, unknown> | undefined)?.creature);
    }
    if (!creature || !Number.isFinite(count)) {
      problem(`could not read encounter entry ${JSON.stringify(entry)}`);
      continue;
    }
    const sb = statblock(index, creature);
    const cr = sb ? str(sb.fm.cr) : undefined;
    const xp = cr !== undefined ? XP_BY_CR[cr] : undefined;
    if (xp === undefined) {
      problem(`no stat block with a known CR for "${creature}", so its XP is not counted`);
      continue;
    }
    result.lines.push({ count, creature, cr: cr!, xp });
    result.total += count * xp;
  }
  return result;
}

function statblock(index: StoryIndex, name: string): Note | undefined {
  for (const n of index.notes.values()) if (truthy(n.fm.statblock) && str(n.fm.name) === name) return n;
  const byName = index.resolve(name);
  return byName && truthy(byName.fm.statblock) ? byName : undefined;
}

// ---- levels ---------------------------------------------------------------------------------

/** 2024 character advancement: XP needed to reach each level. */
const LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** The next level threshold above `xp`, as [level, threshold], or null at level 20. */
export function nextLevel(xp: number): [number, number] | null {
  const i = LEVELS.findIndex((t) => t > xp);
  return i < 0 ? null : [i + 1, LEVELS[i]!];
}

export const fmt = (n: number) => n.toLocaleString("en-US");

export function partySize(mission: Note): number | undefined {
  const n = Number(mission.fm["party-size"]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const linkTo = (n: Note, label?: string) => `[[${n.basename}${label && label !== n.basename ? `|${label}` : ""}]]`;
export const target = (v: unknown): WikiLink | null => parseLink(v);
