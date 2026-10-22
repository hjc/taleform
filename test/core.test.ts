import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nid } from "../src/builders/adventureMap";
import { sameCanvas } from "../src/core/canvas";
import { splitFrontmatter } from "../src/core/frontmatter";
import { parseLink } from "../src/core/links";
import { sha1 } from "../src/core/sha1";

describe("sha1", () => {
  it("matches the standard vectors", () => {
    expect(sha1("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    for (const s of ["é — ▶ 🟥", "x".repeat(55), "x".repeat(64), "x".repeat(1000)]) {
      expect(sha1(s)).toBe(createHash("sha1").update(s, "utf8").digest("hex"));
    }
  });
  it("gives the ids the Python prototype gave, so existing maps keep their layout", () => {
    expect(nid("legend")).toBe("a4097e080c550462");
  });
});

describe("parseLink", () => {
  it("reads a whole-value link with subpath and alias", () => {
    expect(parseLink('[[The Residency#The Long Table|Long Table]]')).toEqual({ target: "The Residency", subpath: "#The Long Table", alias: "Long Table" });
  });
  it("refuses a link inside a longer string", () => {
    expect(parseLink("IF x → [[Road 2.01]]")).toBeNull();
  });
});

describe("frontmatter", () => {
  it("folds an unquoted [[link]] back into a link", () => {
    expect(splitFrontmatter("---\nmission: [[The Road]]\n---\nbody").fm.mission).toBe("[[The Road]]");
  });
  it("keeps lists of objects", () => {
    const fm = splitFrontmatter("---\nawards:\n  - type: optional\n    xp: 150\n---\n").fm;
    expect(fm.awards).toEqual([{ type: "optional", xp: 150 }]);
  });
  it("reports invalid YAML instead of throwing", () => {
    expect(splitFrontmatter("---\na: [\n---\n").error).toMatch(/invalid YAML/);
  });
});

describe("sameCanvas", () => {
  it("ignores formatting, key order and Obsidian's dropped default arrow", () => {
    const a = '{"nodes":[{"id":"1","type":"text","x":0,"y":0,"width":1,"height":1}],"edges":[{"id":"e","fromNode":"1","toNode":"1","toEnd":"arrow"}]}';
    const b = '{\n\t"edges":[{"toNode":"1","fromNode":"1","id":"e"}],\n\t"nodes":[{"height":1,"width":1,"y":0,"x":0,"type":"text","id":"1"}]}';
    expect(sameCanvas(a, b)).toBe(true);
    expect(sameCanvas(a, b.replace('"x":0', '"x":5'))).toBe(false);
  });
});
