import { describe, expect, it } from "vitest";
import { BUILDERS } from "../src/builders/index";
import { parseCanvas } from "../src/core/canvas";
import { build } from "../src/core/engine";
import { StoryIndex } from "../src/core/index";
import { setRegion } from "../src/core/regions";
import { resumeBeat, sequence } from "../src/core/story";
import { MemoryVault } from "./memoryVault";

/** A small mission written the way a DM would, YAML and all. */
function mission(beats: Array<{ id: string; kind?: string; status?: string; optional?: boolean; extra?: string; body?: string }>, missionExtra = "") {
  const files: Record<string, string> = {
    "statblocks/Wolf.md": "---\nstatblock: true\nname: Wolf\ncr: \"1/4\"\n---\n",
    "statblocks/Ogre.md": "---\nstatblock: true\nname: Ogre\ncr: \"2\"\n---\n",
    "Job/Job.md": `---\nkind: mission\n${missionExtra}---\n# Job\n\n%% taleform:resume %%\n%% /taleform:resume %%\n\n%% taleform:xp %%\n%% /taleform:xp %%\n`,
  };
  beats.forEach((b, i) => {
    const prev = i ? `Job ${beats[i - 1]!.id}` : "Job";
    const next = i < beats.length - 1 ? `Job ${beats[i + 1]!.id}` : "Job";
    files[`Job/Job ${b.id}.md`] =
      `---\nmission: "[[Job]]"\nkind: ${b.kind ?? "beat"}\nact: 1\nbeat: ${i + 1}\nbeat-status: ${b.status ?? "planned"}\n` +
      `${b.optional ? "optional: true\n" : ""}prev: "[[${prev}]]"\nnext: "[[${next}]]"\n${b.extra ?? ""}---\n# ▶ ${b.id}\n\n${b.body ?? "**Trigger:** t. ^card\n"}`;
  });
  return new MemoryVault(files);
}

const resumeOf = async (v: MemoryVault) => {
  const idx = await StoryIndex.load(v);
  return resumeBeat(sequence(idx, idx.missions()[0]!))?.basename;
};

describe("resume is derived from beat status", () => {
  it("is the first planned beat after the furthest one played, ignoring earlier partials", async () => {
    const v = mission([{ id: "A", status: "played" }, { id: "B", status: "partial" }, { id: "C", status: "played" }, { id: "D" }, { id: "E" }]);
    expect(await resumeOf(v)).toBe("Job D");
  });
  it("stays inside a beat the session stopped in", async () => {
    expect(await resumeOf(mission([{ id: "A", status: "played" }, { id: "B", status: "partial" }, { id: "C" }]))).toBe("Job B");
  });
  it("skips optional beats", async () => {
    expect(await resumeOf(mission([{ id: "A", status: "played" }, { id: "B", optional: true }, { id: "C" }]))).toBe("Job C");
  });
  it("is nothing once every beat is played", async () => {
    expect(await resumeOf(mission([{ id: "A", status: "played" }]))).toBeUndefined();
  });
  it("fills the mission note's region", async () => {
    const v = mission([{ id: "A", status: "played" }, { id: "B" }]);
    await build(v, BUILDERS);
    expect(v.files["Job/Job.md"]).toContain("> [!tip] ▶ Resume here → [[Job B|▶ B]]\n> ![[Job B#^card]]");
  });
});

describe("awards", () => {
  const awards = 'awards:\n  - xp: 1000\n    for: Immi up alive\n  - xp: 1000\n    for: Ottick up alive\n    note: "**nobody asked.**"\n';
  it("writes the callout under the H1 with the running total from party-xp", async () => {
    const v = mission([{ id: "A", status: "played" }, { id: "B", extra: awards }], "party-xp: 42250\nparty-size: 6\n");
    await build(v, BUILDERS);
    expect(v.files["Job/Job B.md"]).toContain(
      "# ▶ B\n\n%% taleform:awards %%\n> [!danger] 🟥 AWARD XP NOW — 2,000 EACH 🟥\n" +
        "> Immi up alive (1,000) · Ottick up alive (1,000): **nobody asked.** Running: **44,250 / 48,000.**\n%% /taleform:awards %%\n",
    );
  });
  it("announces a level when the running total crosses one", async () => {
    const v = mission([{ id: "B", extra: "awards:\n  - xp: 5750\n    for: Done\n" }], "party-xp: 42250\n");
    await build(v, BUILDERS);
    expect(v.files["Job/Job B.md"]).toContain("Running: **48,000 · LEVEL 9.**");
  });
  it("counts combat XP from the encounter block, split across the party", async () => {
    const fight = "```encounter\nname: x\ncreatures:\n  - 2: Ogre\n  - 4: Wolf\n```\n**Encounter:** 2 ogres and 4 wolves — 1,100 XP. ^card\n";
    const v = mission([{ id: "A", kind: "combat", body: fight }], "party-size: 4\n");
    await build(v, BUILDERS);
    expect(v.files["Job/Job.md"]).toContain("⚔ 1,100 ÷ 4 = **275 each**");
    const map = parseCanvas(v.files["Job/Job — Adventure Map.canvas"]);
    expect(map.nodes.some((n) => String(n.text).includes("⚔ COMBAT XP\n1,100 · **275 each**"))).toBe(true);
  });
  it("warns when an Encounter line's XP disagrees with its encounter block", async () => {
    const fight = "```encounter\nname: x\ncreatures:\n  - 1: Ogre\n```\n**Encounter:** one ogre — 900 XP. ^card\n";
    const r = await build(mission([{ id: "A", kind: "combat", body: fight }]), BUILDERS, {}, false);
    expect(r.problems.some((p) => p.severity === "warning" && /says 900 XP.*adds up to 450/.test(p.message))).toBe(true);
  });
});

describe("schema", () => {
  const errors = async (v: MemoryVault) => (await build(v, BUILDERS, {}, false)).problems.filter((p) => p.severity === "error").map((p) => p.message);
  it("rejects malformed awards and retired properties", async () => {
    const v = mission([{ id: "A", extra: "xp-award: 2000\nawards:\n  - xp: -5\n  - xp: 10\n    type: bonus\n" }]);
    const errs = await errors(v);
    expect(errs.some((m) => /xp-award.*retired/.test(m))).toBe(true);
    expect(errs.some((m) => /awards\[0\]\.xp must be a positive number/.test(m))).toBe(true);
    expect(errs.some((m) => /awards\[1\]\.type/.test(m))).toBe(true);
  });
  it("requires mission to link to a kind: mission note", async () => {
    const v = mission([{ id: "A" }]);
    v.files["Stray.md"] = '---\nmission: "[[Nowhere]]"\nkind: beat\n---\n# x\n';
    expect((await errors(v)).some((m) => /does not link to a note/.test(m))).toBe(true);
  });
  it("accepts a clean mission", async () => {
    const clean = 'entry: came in quiet\nbranches:\n  - to: "[[Job A]]"\n    label: loop\noutcomes:\n  - if: they lose\n    then: retreat\n';
    expect(await errors(mission([{ id: "A", extra: clean }]))).toEqual([]);
  });
  it("rejects a nested map object, which editors render as [object Object]", async () => {
    const v = mission([{ id: "A", extra: "map:\n  outcomes:\n    - if: x\n      then: y\n" }]);
    expect((await errors(v)).some((m) => /`map` is retired/.test(m))).toBe(true);
  });
});

describe("regions", () => {
  it("replaces, inserts and removes", () => {
    const t = "a\n%% taleform:x %%\nold\n%% /taleform:x %%\nb";
    expect(setRegion(t, "x", ["new"]).text).toBe("a\n%% taleform:x %%\nnew\n%% /taleform:x %%\nb");
    expect(setRegion("a\nb", "x", ["new"], 1).text).toBe("a\n%% taleform:x %%\nnew\n%% /taleform:x %%\n\nb");
    expect(setRegion("a\n%% taleform:x %%\nold\n%% /taleform:x %%\n\nb", "x", []).text).toBe("a\nb");
  });
});
