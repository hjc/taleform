import type { Builder } from "../core/builder";
import { setRegion } from "../core/regions";
import { awardsOf, combatOf, fmt, linkTo, nextLevel, partySize, sequence, status } from "../core/story";
import { fromLF, toLF } from "../core/vault";
import { runningTotals, runningText } from "./awards";
import { selectMissions } from "./navigation";

/**
 * The mission XP ledger: every award and fight in the mission, in play order, with totals and
 * the running XP. A list, not a table, so the Linter never re-pads it into a false change.
 * Opt-in: it fills a `%% taleform:xp %%` region on the mission note.
 *
 * It also cross-checks combat: when a beat's **Encounter:** line states an XP figure that the
 * encounter block's creatures do not add up to, that is a warning. Prose and data disagree.
 */
export const ledger: Builder = {
  id: "ledger",
  description: "XP ledger on the mission note; checks Encounter lines against encounter blocks",
  run(ctx) {
    for (const mission of selectMissions(ctx.index, ctx.options.missions)) {
      const seq = sequence(ctx.index, mission);
      if (!seq.length) continue;
      const party = partySize(mission);
      const running = runningTotals(ctx, mission);
      const rows: string[] = [];
      let earned = 0, optionalMax = 0;

      for (const n of seq) {
        const mark = status(n) === "played" ? "✓" : status(n) === "partial" ? "◐" : status(n) === "skipped" ? "✗" : "○";
        const bits: string[] = [];
        const combat = combatOf(ctx.index, n, (m) => ctx.problem("warning", m, n.path));
        if (combat) {
          const each = party ? Math.floor(combat.total / party) : undefined;
          bits.push(`⚔ ${fmt(combat.total)}${each !== undefined ? ` ÷ ${party} = **${fmt(each)} each**` : " (set `party-size` for XP each)"}`);
          earned += each ?? 0;
          const stated = /^\*\*Encounter:\*\*.*?([\d,]+) XP/m.exec(n.text);
          if (stated && Number(stated[1]!.replace(/,/g, "")) !== combat.total) {
            ctx.problem("warning", `the Encounter line says ${stated[1]} XP, but the encounter block adds up to ${fmt(combat.total)} (${combat.lines.map((l) => `${l.count} × ${l.creature}`).join(" + ")})`, n.path);
          }
        }
        for (const a of awardsOf(n, () => undefined)) {
          if (a.type === "story") {
            bits.push(`${a.for ?? "award"} **${fmt(a.xp)}**`);
            earned += a.xp;
          } else {
            bits.push(`optional ${fmt(a.xp)}${a.per ? ` per ${a.per}` : ""}${a.max ? ` (max ${fmt(a.max)})` : ""}`);
            optionalMax += a.xp * (a.max ?? 1); // max counts uses, so the cap is xp × max
          }
        }
        if (!bits.length) continue;
        const r = running.get(n.path);
        rows.push(`> - ${mark} ${linkTo(n, n.title)} — ${bits.join(" · ")}${r ? ` → ${runningText(r)}` : ""}`);
      }

      const lines = [`> [!abstract]- XP ledger — ${fmt(earned)} each${optionalMax ? `, plus up to ${fmt(optionalMax)} optional` : ""}`];
      const partyXp = Number(mission.fm["party-xp"]);
      if (mission.fm["party-xp"] !== undefined && Number.isFinite(partyXp)) {
        const last = [...running.values()].pop();
        const end = last?.after ?? partyXp;
        const next = nextLevel(end);
        lines.push(`> **Party now:** ${fmt(partyXp)} each · **after this mission:** ${fmt(end)}${next ? ` · level ${next[0]} at ${fmt(next[1])}` : ""}`);
      }
      lines.push(">", ...rows, ">", "> ✓ played · ◐ partial · ○ planned · ✗ skipped. Story and combat XP count toward the running total; optional XP does not.");

      const { text, crlf } = toLF(ctx.read(mission.path)!);
      const r = setRegion(text, "xp", lines);
      if (!r.found) {
        ctx.problem("warning", "no `%% taleform:xp %%` region on the mission note, so the XP ledger is not shown", mission.path);
        continue;
      }
      ctx.emit(mission.path, fromLF(r.text, crlf));
    }
  },
};
