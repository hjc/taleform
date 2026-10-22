import type { BuildContext, Builder } from "../core/builder";
import { truthy } from "../core/frontmatter";
import type { Note } from "../core/index";
import { setRegion } from "../core/regions";
import { awardsOf, combatOf, fmt, nextLevel, partySize, sequence, status, type Award } from "../core/story";
import { fromLF, toLF } from "../core/vault";
import { selectMissions } from "./navigation";

/**
 * The 🟥 AWARD XP callouts inside each beat, from its typed `awards`. The region goes directly
 * under the H1 unless the note already places it elsewhere. With `party-xp` on the mission,
 * each story award also carries the running total and the next level.
 */
export const awards: Builder = {
  id: "awards",
  description: "AWARD XP callouts in beats, from typed awards",
  run(ctx) {
    for (const mission of selectMissions(ctx.index, ctx.options.missions)) {
      const running = runningTotals(ctx, mission);
      for (const n of sequence(ctx.index, mission)) {
        const list = awardsOf(n, () => undefined); // schema reports malformed awards
        const content = callouts(list, running.get(n.path));
        const raw = ctx.read(n.path)!;
        const { text, crlf } = toLF(raw);
        const lines = text.split("\n");
        const h1 = lines.findIndex((l, i) => i > n.fmEnd && l.startsWith("# "));
        const at = h1 >= 0 ? h1 + (lines[h1 + 1] === "" ? 2 : 1) : undefined;
        const r = setRegion(text, "awards", content, at);
        if (r.text !== text) ctx.emit(n.path, fromLF(r.text, crlf));
      }
    }
  },
};

export interface Running {
  before: number;
  after: number;
}

/**
 * Running XP each through the beats not yet played, starting from the mission's `party-xp`
 * (the party's XP right now). Story awards and combat XP count; optional awards do not.
 */
export function runningTotals(ctx: BuildContext, mission: Note): Map<string, Running> {
  const out = new Map<string, Running>();
  const start = Number(mission.fm["party-xp"]);
  if (!Number.isFinite(start) || mission.fm["party-xp"] === undefined) return out;
  const party = partySize(mission);
  let xp = start;
  for (const n of sequence(ctx.index, mission)) {
    if (status(n) !== "planned" || truthy(n.fm.optional)) continue;
    const story = awardsOf(n, () => undefined).filter((a) => a.type === "story").reduce((s, a) => s + a.xp, 0);
    const combat = party ? Math.floor((combatOf(ctx.index, n, () => undefined)?.total ?? 0) / party) : 0;
    if (!story && !combat) continue;
    out.set(n.path, { before: xp, after: xp + story + combat });
    xp += story + combat;
  }
  return out;
}

export function runningText(r: Running): string {
  const crossed = nextLevel(r.before);
  if (crossed && r.after >= crossed[1]) return `**${fmt(r.after)} · LEVEL ${crossed[0]}.**`;
  const next = nextLevel(r.after);
  return next ? `**${fmt(r.after)} / ${fmt(next[1])}.**` : `**${fmt(r.after)}.**`;
}

function callouts(list: Award[], running: Running | undefined): string[] {
  const out: string[] = [];
  const story = list.filter((a) => a.type === "story");
  if (story.length) {
    const sum = story.reduce((s, a) => s + a.xp, 0);
    let line = story.map((a) => `${a.for ?? "Award"}${story.length > 1 ? ` (${fmt(a.xp)})` : ""}${a.note ? `: ${a.note}` : ""}`).join(" · ");
    if (!/[.!?]\**$/.test(line)) line += ".";
    out.push(`> [!danger] 🟥 AWARD XP NOW — ${fmt(sum)} EACH 🟥`, `> ${line}${running ? ` Running: ${runningText(running)}` : ""}`);
  }
  for (const a of list.filter((x) => x.type === "optional")) {
    if (out.length) out.push("");
    const title = `OPTIONAL XP — ${fmt(a.xp)} EACH${a.per ? ` PER ${a.per.toUpperCase()}` : ""}${a.max ? ` (max ${fmt(a.max)})` : ""}${a.for ? ` — ${a.for.toUpperCase()}` : ""}`;
    out.push(`> [!danger] 🟥 ${title} 🟥`);
    if (a.note) out.push(`> ${a.note}`);
  }
  return out;
}
