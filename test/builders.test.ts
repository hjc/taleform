import { describe, expect, it } from "vitest";
import { BUILDERS } from "../src/builders/index";
import { parseCanvas } from "../src/core/canvas";
import { build } from "../src/core/engine";
import { MemoryVault, note } from "./memoryVault";

const MISSION = "Missions/Job/Job.md";
const seq = (n: string, kind: string, act: number, beat: number, prev: string, next: string, extra: Record<string, string | number | boolean> = {}, body = "**Trigger:** x.\n**Lands when:** y. ^card\n") =>
  note({ mission: "[[Job]]", kind, act, beat, "beat-status": "planned", prev: `[[${prev}]]`, next: `[[${next}]]`, ...extra }, `# ${n.split(" — ")[1]}\n\n${body}`);

function vault() {
  return new MemoryVault({
    [MISSION]: note({ kind: "mission", resume: "[[Job 1.01 — Start]]" }, "# Job\n"),
    "Missions/Job/Act 1/Job Act 1 — Opening.md": seq("Job Act 1 — Act 1 — Opening", "act", 1, 0, "Job", "Job 1.01 — Start"),
    "Missions/Job/Act 1/Job 1.01 — Start.md": seq("Job 1.01 — ▶ Start", "beat", 1, 1, "Job Act 1 — Opening", "Job 1.02 — Side", { "beat-status": "played" }),
    "Missions/Job/Act 1/Job 1.02 — Side.md": seq("Job 1.02 — ◆ Side", "scene", 1, 2, "Job 1.01 — Start", "Job 1.03 — End", { optional: true }),
    "Missions/Job/Act 1/Job 1.03 — End.md": seq("Job 1.03 — ▶ End", "beat", 1, 3, "Job 1.02 — Side", "Elsewhere#Arrival", { "xp-award": 2000 }),
    "Elsewhere.md": "# Elsewhere\n## Arrival\n",
    "Unrelated.md": note({ kind: "beat", mission: "[[Other]]" }, "# Not ours\n"),
  });
}

describe("navigation", () => {
  it("writes the two-line header and the Next footer from prev/next", async () => {
    const v = vault();
    const r = await build(v, BUILDERS);
    expect(r.problems.filter((p) => p.severity === "error")).toEqual([]);
    const text = v.files["Missions/Job/Act 1/Job 1.02 — Side.md"]!;
    expect(text).toContain("[[Job]]\n← [[Job 1.01 — Start|▶ Start]] • **◆ Side** • [[Job 1.03 — End|▶ End]] →\n\n# ◆ Side");
    expect(text).toContain("> [!tip] Next → [[Job 1.03 — End|▶ End]]\n> ← [[Job 1.01 — Start|▶ Start]] • [[Job Act 1 — Opening|Act 1]] • [[Job]]");
    // a link that leaves the mission is labelled with its heading
    expect(v.files["Missions/Job/Act 1/Job 1.03 — End.md"]).toContain("[[Elsewhere#Arrival|Arrival]] →");
    expect(v.files["Unrelated.md"]).not.toContain("←");
  });

  it("is idempotent: a second build changes nothing", async () => {
    const v = vault();
    await build(v, BUILDERS);
    expect((await build(v, BUILDERS, {}, false)).changes).toEqual([]);
  });

  it("preserves CRLF line endings", async () => {
    const v = vault();
    const p = "Missions/Job/Act 1/Job 1.01 — Start.md";
    v.files[p] = v.files[p]!.replace(/\n/g, "\r\n");
    await build(v, BUILDERS);
    expect(v.files[p]).toContain("\r\n");
    expect(v.files[p]!.replace(/\r\n/g, "")).not.toContain("\n");
  });
});

describe("adventure map", () => {
  it("draws one card per beat, the optional bypass, XP, resume and the hand-off", async () => {
    const v = vault();
    await build(v, BUILDERS);
    const map = parseCanvas(v.files["Missions/Job/Job — Adventure Map.canvas"]);
    const texts = map.nodes.map((n) => String(n.text ?? n.file ?? n.label));
    expect(texts.filter((t) => t.includes("#^card]]"))).toHaveLength(4);
    expect(texts.some((t) => t.includes("RESUME HERE"))).toBe(true);
    expect(texts.some((t) => t.includes("2,000 each"))).toBe(true);
    expect(map.nodes.some((n) => n.file === "Elsewhere.md" && n.subpath === "#Arrival")).toBe(true);
    expect(map.edges.some((e) => e.label === "skip — optional")).toBe(true);
    expect(map.nodes.every((n) => n.generated === "adventure-map")).toBe(true);
  });

  it("keeps hand-made nodes and dragged positions", async () => {
    const v = vault();
    await build(v, BUILDERS);
    const path = "Missions/Job/Job — Adventure Map.canvas";
    const map = parseCanvas(v.files[path]);
    map.nodes[1]!.x = 999;
    map.nodes.push({ id: "mine", type: "text", text: "my note", x: 0, y: 0, width: 10, height: 10 });
    v.files[path] = JSON.stringify(map);
    const r = await build(v, BUILDERS, {}, false);
    expect(r.changes).toEqual([]);
    await build(v, BUILDERS, { relayout: true });
    const after = parseCanvas(v.files[path]);
    expect(after.nodes.some((n) => n.id === "mine")).toBe(true);
    expect(after.nodes.some((n) => n.x === 999)).toBe(false);
  });

  it("fails a beat without exactly one ^card", async () => {
    const v = vault();
    const p = "Missions/Job/Act 1/Job 1.03 — End.md";
    v.files[p] = v.files[p]!.replace(" ^card", "");
    const r = await build(v, BUILDERS, {}, false);
    expect(r.problems.some((x) => x.severity === "error" && x.path === p && /\^card/.test(x.message))).toBe(true);
  });
});
