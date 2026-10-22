import type { Builder } from "../core/builder";
import { str } from "../core/frontmatter";
import { SEQ_KINDS, type Note, type StoryIndex } from "../core/index";
import { parseLink } from "../core/links";
import { fromLF, toLF } from "../core/vault";

/**
 * The two-line header above each beat's H1 and its `## Next` footer, from `mission`/`prev`/`next`:
 *
 *     [[<Mission>]]
 *     ← [[<prev>|<prev H1>]] • **<this H1>** • [[<next>|<next H1>]] →
 *
 * Labels are each target's own H1, so a beat's run-sheet symbol (▶ ◆ ⚔ ⚙) travels with it.
 * A link that leaves the mission is labelled with its #heading, or its name.
 */
export const navigation: Builder = {
  id: "navigation",
  description: "Beat header and Next footer from mission / prev / next",
  run(ctx) {
    const { index } = ctx;
    for (const mission of selectMissions(index, ctx.options.missions)) {
      const members = index.members(mission);
      const inMission = new Set([mission, ...members]);
      const acts = new Map<string, Note>();
      for (const n of members) if (n.kind === "act") acts.set(String(n.fm.act), n);

      const label = (value: unknown): string | null => {
        const l = parseLink(value);
        if (!l) return null;
        const hit = index.resolve(l);
        const text = hit && inMission.has(hit) && !l.subpath ? hit.title : (l.subpath?.slice(1) ?? l.target);
        const dest = l.target + (l.subpath ?? "");
        return text === dest ? `[[${dest}]]` : `[[${dest}|${text}]]`;
      };

      for (const n of [...members].sort((a, b) => a.basename.localeCompare(b.basename))) {
        if (!n.kind || !SEQ_KINDS.has(n.kind)) continue;
        const raw = ctx.read(n.path);
        if (raw === undefined) continue;
        const { text, crlf } = toLF(raw);
        const lines = text.split("\n");
        const end = n.fmEnd;
        const h1 = lines.findIndex((l, i) => i > end && l.startsWith("# "));
        if (h1 < 0) {
          ctx.problem("error", "no H1, so the header has nowhere to go", n.path);
          continue;
        }
        const between = lines.slice(end + 1, h1).filter((l) => l.trim());
        // an old header, or the Story Beat template's placeholder and its %% instructions %%
        if (between.some((l) => !/^\*?\[\[|^← |^%%/.test(l))) {
          ctx.problem("warning", "unexpected text above the H1, so the header was left alone", n.path);
          continue;
        }
        const m = label(n.fm.mission), prev = label(n.fm.prev), next = label(n.fm.next);
        if (!m || !prev || !next) {
          ctx.problem("error", "`mission`, `prev` and `next` must all be whole links", n.path);
          continue;
        }
        const title = lines[h1]!.slice(2).trim();
        const header = [m, `← ${prev} • **${title}** • ${next} →`, ""];
        const back = [`← ${prev}`];
        const act = acts.get(String(n.fm.act));
        if (n.kind !== "act" && act) back.push(`[[${act.basename}|Act ${str(n.fm.act)}]]`);
        if (prev !== m) back.push(m); // the first act's prev is the mission itself
        const footer = ["## Next", "", `> [!tip] Next → ${next}`, "> " + back.join(" • ")];

        let nx = -1;
        lines.forEach((l, i) => {
          if (l.trim() === "## Next") nx = i;
        });
        const body = nx >= 0 ? lines.slice(h1, nx) : lines.slice(h1);
        if (nx < 0) {
          while (body.length && !body[body.length - 1]!.trim()) body.pop();
          body.push("", "---", "");
        }
        const out = [...lines.slice(0, end + 1), ...header, ...body, ...footer, ""].join("\n");
        ctx.emit(n.path, fromLF(out, crlf));
      }
    }
  },
};

export function selectMissions(index: StoryIndex, names?: string[]): Note[] {
  const all = index.missions();
  return names?.length ? all.filter((m) => names.includes(m.basename)) : all;
}
