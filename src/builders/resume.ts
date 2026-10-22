import type { Builder } from "../core/builder";
import { setRegion } from "../core/regions";
import { linkTo, resumeBeat, sequence } from "../core/story";
import { fromLF, toLF } from "../core/vault";
import { selectMissions } from "./navigation";

/**
 * The mission note's "Resume here", derived from beat status: no hand-kept `resume` property.
 * Opt-in: it fills a `%% taleform:resume %%` region wherever the mission note places one.
 */
export const resume: Builder = {
  id: "resume",
  description: "Resume-here callout on the mission note, derived from beat-status",
  run(ctx) {
    for (const mission of selectMissions(ctx.index, ctx.options.missions)) {
      const seq = sequence(ctx.index, mission);
      if (!seq.length) continue;
      const at = resumeBeat(seq);
      const content = at
        ? [`> [!tip] ▶ Resume here → ${linkTo(at, at.title)}`, `> ![[${at.basename}#^card]]`]
        : ["> [!success] Mission complete: every beat on the line has been played."];
      const raw = ctx.read(mission.path)!;
      const { text, crlf } = toLF(raw);
      const r = setRegion(text, "resume", content);
      if (!r.found) {
        ctx.problem("warning", "no `%% taleform:resume %%` region on the mission note, so Resume here is not shown", mission.path);
        continue;
      }
      ctx.emit(mission.path, fromLF(r.text, crlf));
    }
  },
};
