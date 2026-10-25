#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   check-tooling — does the wayfinding skill still agree with itself?

   Run:  node .claude/skills/wayfinding/check-tooling.js
   Exits 1 if any check fails.

   WHY THIS EXISTS
   The wayfinding tooling states every rule in three to six places by design —
   a template comment ships into every generated document, and a session that
   never opens the template still needs the rule in SKILL.md. The redundancy is
   the feature, and it is also the hazard: a patch author who sees one copy
   relocates an inconsistency instead of reducing it.

   This file checks what can be EXECUTED, and deliberately does not police
   prose.

   VALIDATED BY MUTATION, AND SHOULD BE AGAIN
   A green suite that has never been shown to go red proves nothing. Every
   check here was verified by breaking the thing it guards and confirming that
   check — and only that check — failed. If you add a check, break its rule on
   purpose and watch it fail before you trust it.

   Do that on scratch copies. The obvious approach — mutate the tracked file,
   run, then `git checkout --` to revert — will discard a colleague's
   uncommitted work in the same file if the run dies partway.

   IT ALSO GUARDS THE REPO'S ARTIFACT LIFECYCLE
   The checks are no longer only about wayfinding. `pr-tidying` Category H
   audits the whole instruction/context/plan surface, and the mechanically
   decidable half of that audit belongs here rather than in a human's reading
   pass — auditing prose by reading has no fixed point, because every fix
   writes new prose the next audit flags. So this file also asserts the
   lifecycle rules `docs/sdlc.md` §4e and `issue-creating` state: TDD plans are
   never tracked (`tddplans`) and nothing tracked cites one (`tddcites`), an
   issue doc has no `implemented` end state (`issuedocs`), and every
   `.claude/agent-memory/` index pointer resolves with no topic file orphaned
   (`memindex`) — plus the inventory join, where `docs/sdlc.md`'s agent, skill
   and context tables must match the tree both ways (`sdlcinv`). Each was a
   hand-found finding in a tidy pass before it was a check here.

   TRACKED VS COMMITTABLE
   The lifecycle checks ask what git TRACKS (`tddplans`: a TDD plan must never
   be). The citation checks ask what a fresh checkout WILL have, and answer
   with the committable set — tracked, plus untracked files `.gitignore` does
   not exclude — so a doc and the file it cites can land in the same commit.
   The dead pointer a fresh checkout really gets is a citation of something
   gitignored or absent, and that is what they flag.

   WHAT BELONGS IN HERE
   An entry earns its place only if it carries a live assertion. A list of
   "rule X lives in files A, B, C" with nothing that runs rots silently and is
   consulted with confidence. Judgement rules (a register is greppable not
   readable; the horizon/ticket phraseability test; each site states a rule at
   its own altitude) are NOT here and should not be added. They live as prose
   in SKILL.md, and a human reviewer is the only thing that can check them.
   ═══════════════════════════════════════════════════════════ */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync, spawnSync } = require('child_process');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..', '..');
const PLANR = path.join(REPO, '.claude', 'skills', 'html-planning', 'planr.js');
/* The wayfinding templates are this repo's own, so they live in planr's
   consumer template directory rather than the synced skill folder. */
const TEMPLATES = path.join(REPO, '.claude', 'planr-templates');
const SHIPPED_TEMPLATES = path.join(REPO, '.claude', 'skills', 'html-planning', 'templates');

const SKILL = path.join(HERE, 'SKILL.md');
const CLOSING = path.join(HERE, 'references', 'closing.md');
const DOMAIN_MODELING = path.join(REPO, '.claude', 'skills', 'domain-modeling', 'SKILL.md');
const PR_TIDY_REF = (f) => path.join(REPO, '.claude', 'skills', 'pr-tidying', 'references', f);
const PR_TIDYING_LIFECYCLE = PR_TIDY_REF('plan-lifecycle.md');
const PR_TIDYING_DOCS_SYNC = PR_TIDY_REF('docs-sync.md');
const SDLC = path.join(REPO, 'docs', 'sdlc.md');
const HTML_PLANNING = path.join(REPO, '.claude', 'skills', 'html-planning', 'SKILL.md');
const ISSUE_CREATING = path.join(REPO, '.claude', 'skills', 'issue-creating', 'SKILL.md');
const FEATURES = path.join(REPO, 'docs', 'features');
const ISSUES = path.join(REPO, 'docs', 'issues');
/* The planning trees: a feature's artifacts and the issue docs. Both are
   branch-local and deleted on completion (docs/sdlc.md §4e). */
const PLANNING = /^docs\/(?:features|issues)\//;
const AGENT_MEMORY = path.join(REPO, '.claude', 'agent-memory');

/* The restatement map. Each invariant names the files that must agree about
   it, and each has an assertion below. Adding an entry without an assertion
   defeats the purpose of the file — see the header. */
const RESTATED = {
  W15: ['SKILL.md', 'planr-templates/wayfinding-map.html'],
  W19: ['SKILL.md'],
  W26: ['SKILL.md', 'planr-templates/wayfinding-vocabulary.html', 'domain-modeling/SKILL.md'],
  W29: ['SKILL.md', 'planr-templates/wayfinding-*.html'],
  W54: ['SKILL.md', 'planr-templates/wayfinding-ticket.html'],
  W62: ['references/closing.md'],
  W68: ['pr-tidying/references/docs-sync.md'],
  W69: ['html-planning/templates/', 'planr-templates/', 'html-planning/SKILL.md', 'docs/sdlc.md'],
  W70: ['pr-tidying/references/plan-lifecycle.md', 'features/*/wayfinding/map.html', 'the specs it links'],
  W71: ['references/closing.md', 'features/*/wayfinding/', 'the docs that survive the close'],
};

/* ── harness ─────────────────────────────────────────────── */

const results = [];
let tmp = null;

/* Normalise CRLF on the way in. This is a Windows repo, so a tool that
   rewrites one of these files can flip its line endings; every regex below
   that anchors on \n would then quietly match nothing. Any check that
   extracts a set from a file must therefore assert the set is non-empty, or
   a flipped line ending reads as a pass. */
function read(f) {
  return fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
}

function planr(args) {
  return execFileSync(process.execPath, [PLANR, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function check(id, what, fn) {
  const sites = RESTATED[id] ? ` [${RESTATED[id].join(' · ')}]` : '';
  try {
    const note = fn();
    results.push({ id, what, sites, ok: true, note: note || '' });
  } catch (err) {
    results.push({ id, what, sites, ok: false, note: err.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ── fixtures ────────────────────────────────────────────── */

function scaffold() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-check-'));
  const at = (n) => path.join(tmp, n);

  planr(['new', at('map.html'), '--title', 'Fixture Map', '--template', 'wayfinding-map', '--set', 'header.status=draft']);
  planr(['new', at('q01.html'), '--title', 'Fixture Ticket', '--template', 'wayfinding-ticket', '--set', 'header.status=draft']);
  planr(['new', at('decisions.html'), '--title', 'Fixture Register', '--template', 'wayfinding-decisions', '--set', 'header.status=draft']);
  planr(['new', at('vocabulary.html'), '--title', 'Fixture Vocab', '--template', 'wayfinding-vocabulary', '--set', 'header.status=draft']);
  planr(['new', at('evidence.html'), '--title', 'Fixture Evidence', '--template', 'wayfinding-evidence', '--set', 'header.status=draft']);
  return at;
}

function cleanup() {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}

/* Source of one named section. These templates do not nest sections, so the
   next <plan-section is the end. */
function sectionSrc(templateName, sectionId) {
  const src = read(path.join(TEMPLATES, templateName));
  const start = src.indexOf(`<plan-section id="${sectionId}"`);
  if (start < 0) return null;
  const next = src.indexOf('<plan-section id=', start + 20);
  return src.slice(start, next < 0 ? undefined : next);
}

/* Visible text of a section's <thead> row, in order. Scoped to the section on
   purpose: several of these templates carry more than one table, and taking
   the file's first <thead> silently compares the wrong one. */
function theadCellsIn(templateName, sectionId) {
  const s = sectionSrc(templateName, sectionId);
  assert(s, `${templateName} has no '${sectionId}' section`);
  const m = s.match(/<thead>[\s\S]*?<\/thead>/);
  assert(m, `${templateName} '${sectionId}' has no <thead>`);
  return [...m[0].matchAll(/<th>(.*?)<\/th>/g)].map((x) => x[1].trim());
}

/* The marker a doc uses to label a deliberate counter-example — a command
   shown so a reader can recognise the WRONG form. `cmds` asserts planr REFUSES
   every such line, rather than demanding it run clean, which would force the
   counter-example to be corrected into the very thing it warns against. Named
   because it is a contract between the docs and this file, not an incidental
   word. */
const COUNTEREXAMPLE = 'WRONG';

/* Header statuses a MAP can never hold, because the map is deleted when the
   effort closes. Deny-list rather than allow-list: which states a map may
   legitimately pass through is an open set, and only these are ruled out by
   the artifact's own lifecycle. */
const UNREACHABLE_MAP_STATUS = ['implemented'];

/* Paths a wayfinding doc may cite that are legitimately not committed. Keep
   this short: every entry is a citation a fresh checkout cannot follow. */
/* Each mirrors a `.gitignore` entry: `dist/` is build output (`dist/cli.cjs`
   is cited constantly and exists only after `npm run check`), `.claude/reviews/`
   and `.claude/handoffs/` are per-machine agent output, and the rest are
   scratch or personal config (docs/sdlc.md §4f, §5a). */
const UNTRACKED_BY_DESIGN = [/^\.tmp\//, /^\.llm-resources\//, /(^|\/)CLAUDE\.local\.md$/, /^dist\//,
  /^\.claude\/reviews\//, /^\.claude\/handoffs\//, /^\.claude\/settings\.local\.json$/];

/* Paths the instruction docs cite inside a DM's VAULT, not in this repo: the
   plugin folder `npm run deploy` fills (`.obsidian/plugins/taleform/cli.cjs`,
   `claude-hook.mjs`). They read as repo-rooted paths, so without this list
   every one reports as dead. Generic vault layout only: a path from one
   particular vault belongs in `CLAUDE.local.md`, never in a tracked doc. */
const IN_THE_VAULT = [/^\.obsidian\//];

/* Header statuses meaning "this document is not yet agreed". A slice row whose
   badge claims the work shipped cannot sit over one of these. Deny-list, and
   deliberately NOT including `approved`: a doc can be reviewed and agreed and
   never have its own header flipped — an operator guide written for a shipped
   slice and not yet run is the standing example, and it is a real state, not
   drift. `implemented` under a non-shipped badge is caught from the other
   side, which is where that direction is unambiguous. */
const NOT_YET_AGREED = ['draft', 'review', 'rejected'];

/* A citation the checker can resolve without reading the sentence around it. */
const ROOTED = /^(?:\.claude|src|test|docs)\//;
/* `scripts/` is a real top-level directory (`scripts/deploy.mjs`) AND a common
   relative segment (`scripts/review.py` inside a skill means that skill's own
   scripts/), so a citation starting with it is ambiguous and is left alone. */

/* Files whose prose the intra-document anchor check reads: the always-loaded
   root `CLAUDE.md`, `docs/sdlc.md` (the authority every skill cites for the
   loop) and every context doc. Matched against the committable set so a new
   context doc is covered the day it lands and `CLAUDE.local.md` — gitignored
   by design — is not. */
const ANCHOR_FILES = [/^CLAUDE\.md$/, /^docs\/sdlc\.md$/, /^docs\/context\/[^/]+\.md$/];

/* Files whose OUTBOUND citations `instrpaths` follows. A superset of
   ANCHOR_FILES: every skill body and reference, and every agent definition.
   Those are not always-loaded, but they are loaded on invoke, they cite the
   codebase at least as heavily as a CLAUDE.md does, and they rot the same way
   — a skill ported from another repo, or a `src/` file renamed under it,
   leaves a pointer that reads as authoritative and resolves nowhere.
   `anchors` is deliberately NOT widened with it: that check is about the
   intra-document pointer style of the always-loaded files, which is a
   different population and a different question. */
/* Also every markdown file under `.claude/agent-memory/`, on the same
   argument. A topic file there is loaded on every dispatch of the agent that
   owns it, and a memory note exists precisely to say "the trap is in
   src/core/x.ts", so citations are most of its content. The planning-tree
   exemption inside the check carries the one difference between this
   population and the others. */
const CITING_FILES = [...ANCHOR_FILES, /^\.claude\/skills\/.+\.md$/, /^\.claude\/agents\/[^/]+\.md$/,
  /^\.claude\/agent-memory\/.+\.md$/];

/* A path that names a TDD plan: anything in a `tdds/` directory (the one
   place plans live, `docs/features/<feature>/tdds/`), plus the legacy
   `tdd-<slug>.html` spelling so an old citation is still recognised. */
const TDD_PLAN = (rel) => /(^|\/)tdds?\//.test(rel) || /^tdd[-.]/.test(rel.split('/').pop());

/* What makes a "see X below" pointer NAME something rather than gesture at
   whatever follows. A phrase with none of these is a generic pointer (`see
   below`, `see the table below`) that resolves by position and cannot dangle;
   only a phrase carrying one of these makes a claim that can be checked. */
const DISTINCTIVE = [
  /`([^`\n]{2,60})`/g,                          // a code span
  /["“]([^"”\n]{2,60})["”]/g,    // a quoted name
  /\b([A-Z][\w]+(?:\s+[A-Z][\w]+)+)\b/g,        // a Title Case heading name
  /\b([a-z]{2,}(?:-[a-z]{2,})+)\b/g,            // a hyphenated compound
];

/* The id spaces a wayfinding effort defines in artifacts its close DELETES —
   contract rules (`C15`), decisions (`D37`, `d75`), tickets (`q08`), evidence
   (`E01`) and a slice spec's open questions (`OQ-5`). Every one of them is
   defined by a document that is gone the moment the effort closes, which is
   why closing.md says to graduate a rule's TEXT and never its id. */
const EFFORT_ID = /(?:C\d+|D\d+|q\d+|d\d+|E\d+|OQ-\d+)/;

/* A citation counts only when it is CODE — `<code>C12</code>` or a backtick
   span whose ENTIRE content is the token. Requiring the whole span is what
   keeps ordinary prose out, and it also disposes structurally of the shapes
   that merely look like ids: a hex colour (`#E01`), a CSS value, a version
   (`v2.1`) and a test name all carry something else inside the span. */
const CITED_ID = /<code>([^<>]+)<\/code>|`([^`\n]+)`/g;

/* Tokens that fill a whole code span, match an id shape, and are not ids.
   Deliberately tiny: every entry is a real collision observed in this repo's
   vocabulary, not a shape someone might one day write. */
const NOT_AN_ID = new Set(['d3']);

/* Trees the dangling-id sweep does not read, and why each one is out:

     docs/features/           is itself deleted at close (docs/sdlc.md §4e), so
                              nothing in it is a SURVIVING document — and a
                              sibling effort keeps its own private id space,
                              which this effort's vocabulary knows nothing of
     .claude/handoffs/        archived session state, historical by design
     .claude/reviews/         the same; closing.md notes these two outnumber
                              the real hits roughly eight to one
     .claude/skills/          the tooling's own documentation, which must name
                              id SHAPES as examples to state the rule at all —
                              closing.md's own `C15, D37, q08` and the register
                              templates' scaffolded `D01`/`q01`/`E01` rows
     .tmp/                    scratch output                                  */
const NOT_A_SURVIVING_DOC = [
  /^docs\/features\//,
  /^\.claude\/handoffs\//,
  /^\.claude\/reviews\//,
  /^\.claude\/skills\//,
  /^\.tmp\//,
];

/* One `git ls-files` rather than a spawn per citation. */
const gitFiles = (args) => new Set(
  execFileSync('git', ['ls-files', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean));
let _tracked = null;
function trackedSet() {
  if (!_tracked) _tracked = gitFiles([]);
  return _tracked;
}

/* Tracked, plus untracked files `.gitignore` does not exclude — what the next
   `git add -A` would commit. See TRACKED VS COMMITTABLE in the header. A file
   deleted from disk but still tracked stays in, because the callers already
   skip a path that is not on disk. */
let _committable = null;
function committableSet() {
  if (!_committable) _committable = new Set([...trackedSet(), ...gitFiles(['--others', '--exclude-standard'])]);
  return _committable;
}

/* Every live wayfinding map on disk. Driven off the directory, never off a
   list: an effort that starts wayfinding is covered without editing this file,
   and an effort that closes takes its map with it (a map is DELETED at close),
   so an empty result is a legitimate state and not a reason to fail. */
function liveMaps() {
  if (!fs.existsSync(FEATURES)) return [];
  return fs.readdirSync(FEATURES)
    .map((d) => path.join(FEATURES, d, 'wayfinding', 'map.html'))
    .filter((p) => fs.existsSync(p));
}

/* Every effort that still has a wayfinding directory. Broader than liveMaps()
   on purpose: the registers outlive the map within a close (the map goes with
   the tickets, and the graduation check reads the register afterwards), so the
   id vocabulary is keyed on the directory, not on map.html. */
function liveEfforts() {
  if (!fs.existsSync(FEATURES)) return [];
  return fs.readdirSync(FEATURES)
    .map((d) => path.join(FEATURES, d))
    .filter((p) => fs.existsSync(path.join(p, 'wayfinding')));
}

function htmlUnder(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlUnder(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/* The id a fragment DEFINES, which is the id it LEADS with. A register row's
   first cell, an evidence row's first cell, a PRD contract row's first cell and
   an `<strong>OQ-5</strong>` lead-in all announce their id before saying
   anything else; an id in the middle of a sentence is citing one, not minting
   it. Anchoring on the lead is what keeps the vocabulary from swallowing the
   register's own `Decided in` column — which cites `q07` and defines nothing. */
function leadId(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').trim();
  const m = text.match(new RegExp(`^(${EFFORT_ID.source})\\b`));
  return m ? m[1] : null;
}

/* Every id one effort's SURVIVING artifacts still define. Read off definition
   POSITIONS rather than off a list of known register filenames: an effort that
   adds a register this file has never heard of is covered the day it lands,
   and one that renames a column is not silently reduced to an empty
   vocabulary. Ticket ids come from the filenames, because the ticket file is
   the only thing that defines them. */
function definedIds(effortDir) {
  const ids = new Set();
  const add = (t) => { if (t) ids.add(t.toLowerCase()); };

  const wf = path.join(effortDir, 'wayfinding');
  if (fs.existsSync(wf)) {
    for (const f of fs.readdirSync(wf)) {
      const m = f.match(/^(q\d+)[-.]/);
      if (m) add(m[1]);
    }
  }

  for (const file of htmlUnder(effortDir)) {
    const src = read(file);
    for (const row of src.matchAll(/<tr>[\s\S]*?<\/tr>/g)) {
      const cell = row[0].match(/<t[dh]>([\s\S]*?)<\/t[dh]>/);
      if (cell) add(leadId(cell[1]));
    }
    /* Not every id space is tabular. A slice spec numbers its open questions
       as a list, and `OQ-5` is then defined by an `<strong>` lead-in. */
    for (const m of src.matchAll(/<(strong|dt|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)) add(leadId(m[2]));
  }
  return ids;
}

/* Section ids a template actually scaffolds. */
function templateIds(templateName) {
  const src = read(path.join(TEMPLATES, templateName));
  return [...src.matchAll(/<plan-section id="([^"]+)"/g)].map((x) => x[1]);
}

/* ═══════════════════════════════════════════════════════════
   THE CHECKS
   ═══════════════════════════════════════════════════════════ */

function runChecks() {
  const at = scaffold();

  /* W62 — the graduation check is the sole gate before irreversibly deleting
     an effort's entire reasoning record, and its two tables have OPPOSITE
     contracts. Extract the snippet closing.md actually ships and run it
     against a register built to fail both ways. */
  check('W62', 'the graduation check catches both contract violations', () => {
    const rowsFile = path.join(tmp, 'reg.html');
    fs.writeFileSync(rowsFile,
      '<tr><td><code>D02</code></td><td>clean</td><td><code>q02</code></td><td><code>E01</code></td><td>a slice</td><td><code>context/foo.md</code></td></tr>\n' +
      '<tr><td><code>D03</code></td><td>UNGRADUATED</td><td><code>q03</code></td><td><code>user call</code></td><td>a slice</td><td>&mdash;</td></tr>\n');
    const supFile = path.join(tmp, 'sup.html');
    fs.writeFileSync(supFile,
      '<tr><td><code>D04</code></td><td>corrected</td><td><code>D09</code></td><td>a probe</td><td>Yes</td></tr>\n' +
      '<tr><td><code>D05</code></td><td>NAMES-ITS-BLOCKER</td><td><code>D10</code></td><td>a probe</td><td><code>crm-pipeline.md</code></td></tr>\n');
    planr(['append', at('decisions.html'), 'register', '--into', 'tbody', '--file', rowsFile]);
    planr(['append', at('decisions.html'), 'superseded', '--into', 'tbody', '--file', supFile]);

    /* Pick the block by its CONTENT, not by position. closing.md ships more
       than one bash fence, so "the first one" silently starts running a
       different snippet the moment a fence is added above this one. */
    const blocks = [...read(CLOSING).matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
    const graduation = blocks.filter((b) => /rows\s+register\b/.test(b) && /rows\s+superseded\b/.test(b));
    assert(graduation.length === 1,
      `closing.md holds ${graduation.length} bash blocks checking both registers, expected exactly 1 ` +
      `(${blocks.length} bash blocks in the file). The graduation check may have been split or reworded away.`);

    /* Both assignments must actually be replaced. As plain .replace() calls
       they are no-ops when the pattern is absent, and the snippet then runs
       against an unset $P or a literal `<effort>` path — failing with an
       opaque shell error that reads as a defect in the check it is running. */
    let substituted = 0;
    const sub = (src, re, to) => {
      assert(re.test(src), `the graduation snippet no longer assigns ${re.source} — this check cannot point it at a fixture`);
      substituted++;
      return src.replace(re, to);
    };
    let snippet = sub(graduation[0], /^P=.*$/m, `P="${PLANR.replace(/\\/g, '/')}"`);
    snippet = sub(snippet, /^D=.*$/m, `D="${at('decisions.html').replace(/\\/g, '/')}"`);
    assert(substituted === 2, 'expected to rebind both P and D before running the snippet');
    snippet = snippet.replace(/\$P /g, `"${process.execPath.replace(/\\/g, '/')}" $P `);

    let out, status = 0;
    try {
      out = execSync(snippet, { shell: 'bash', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
      status = e.status;
    }

    assert(status === 0, `a run that found blockers exited ${status} — closing.md's snippet has the inverted exit code back`);
    assert(/UNGRADUATED/.test(out), 'did not flag the register row with an empty Graduated to');
    assert(/NAMES-ITS-BLOCKER/.test(out),
      'did not flag the superseded row naming a doc — that cell is NON-EMPTY, so an empty-cell regex passes it silently');
    assert(!/\| clean \|/.test(out) && !/\| corrected \|/.test(out), 'flagged a row that satisfies its contract');

    return 'flags the ungraduated row AND the doc-named superseded row; exits 0';
  });

  /* W15 — a field an instruction acts on has to be readable off the map, or
     the low-resolution map has stopped doing its job. "Dispatch every research
     ticket" is unanswerable without Type on the map. */
  check('W15', 'the map carries every field an instruction acts on', () => {
    const cells = theadCellsIn('wayfinding-map.html', 'tickets');
    assert(cells.includes('Type'),
      `map Tickets table has no Type column (${cells.join(' | ')}) but SKILL.md still says "dispatch every research ticket"`);
    return `Tickets: ${cells.join(' | ')}`;
  });

  /* W26 — vocabulary.html IS domain-modeling's glossary. Not a paraphrase of
     it. Compare against that skill's own table rather than a copy. */
  check('W26', 'vocabulary.html implements domain-modeling verbatim', () => {
    const dm = read(DOMAIN_MODELING).match(/^\|\s*Term\s*\|.*\|$/m);
    assert(dm, 'domain-modeling no longer declares a glossary header row');
    const want = dm[0].split('|').map((s) => s.trim()).filter(Boolean);
    const got = theadCellsIn('wayfinding-vocabulary.html', 'terms');
    assert(JSON.stringify(want) === JSON.stringify(got),
      `columns drifted — domain-modeling says [${want.join(' | ')}], template scaffolds [${got.join(' | ')}]`);

    const ids = templateIds('wayfinding-vocabulary.html');
    for (const opt of ['states', 'relationships']) {
      assert(ids.includes(opt), `domain-modeling requires ${opt} "where the domain has them"; template scaffolds no '${opt}' section`);
    }
    return `[${got.join(' | ')}] + optional ${['states', 'relationships'].join('/')}`;
  });

  /* W29 — every section id a session is told to write to must be documented
     with its id. ONE DIRECTION ONLY: this catches a scaffolded id that no
     prose names, and does NOT catch a documented id no template scaffolds. */
  check('W29', 'documented section ids and scaffolded ids agree', () => {
    const skill = read(SKILL);
    const missing = [];
    const templates = fs.readdirSync(TEMPLATES).filter((f) => f.startsWith('wayfinding-'));
    for (const t of templates) {
      for (const id of templateIds(t)) {
        if (!new RegExp('`' + id + '`').test(skill)) missing.push(`${id} (${t})`);
      }
    }
    assert(missing.length === 0, `scaffolded but never named in SKILL.md: ${missing.join(', ')}`);
    return `${templates.length} templates, every scaffolded id documented`;
  });

  /* W54 — no command the skill prescribes may destroy a structure another
     prescribed command addresses. `set-body` on a ticket's resolution wipes the
     <h3>s that `insert --before-heading` targets.

     Runs the destructive sequence on a fixture and asserts the anchor is
     genuinely gone afterwards, rather than grepping for the warning's wording.
     If planr ever makes set-body preserve headings, this goes red and tells us
     the warning can be retired. */
  check('W54', 'set-body really does destroy the anchors insert addresses', () => {
    const anchors = ['For the register', 'What would change this answer'];
    const listed = planr(['list', at('q01.html')]);
    for (const h of anchors) {
      assert(listed.includes(h),
        `the scaffolded ticket has no "${h}" heading, but SKILL.md addresses it with insert --before-heading`);
    }

    /* A resolution body written from scratch, as an author would compose one. */
    const scratch = path.join(tmp, 'res-body.html');
    fs.writeFileSync(scratch, '<p>A resolution composed without the scaffolded anchors.</p>');
    planr(['set-body', at('q01.html'), 'resolution', '--file', scratch]);

    let survived = true;
    try {
      planr(['insert', at('q01.html'), 'resolution', '--before-heading', anchors[0], '--file', scratch]);
    } catch (e) {
      survived = false;
    }
    assert(!survived,
      'set-body no longer destroys the resolution headings — planr may have been fixed, in which case ' +
      "SKILL.md's set-body warning and this check can both be retired");
    return 'hazard reproduces on a fixture; the warning is still earning its place';
  });

  /* W19 — no prescribed step may set a status the artifact cannot hold. A map
     is DELETED at effort close, so any state meaning "the build shipped" is
     unreachable by construction and prescribing it tells a session to do
     something that can never be true.

     Derived from the COMMANDS the skill prescribes, not from the sentence that
     describes them. The set of statuses that ARE legitimate is deliberately not
     pinned: adding a `review` step is a normal change, and a check that
     snapshots today's set turns that into a failure whose message is false —
     which trains the next author to edit the checker green.

     The prose half is deliberately unchecked: whether a sentence accurately
     describes this set is a judgement call, and judgement calls are not in this
     file (see the header). */
  check('W19', 'no prescribed command sets a map status the map cannot hold', () => {
    const skill = read(SKILL);
    const reachable = new Map();
    skill.split('\n').forEach((line, i) => {
      if (!/\bmap\.html\b/.test(line)) return;
      for (const m of line.matchAll(/header\.status=(\w+)/g)) {
        if (!reachable.has(m[1])) reachable.set(m[1], i + 1);
      }
    });
    assert(reachable.size > 0, 'no prescribed command sets a map header status — the extractor has drifted');

    const violations = [...reachable].filter(([s]) => UNREACHABLE_MAP_STATUS.includes(s));
    assert(violations.length === 0,
      violations.map(([s, n]) => `SKILL.md:${n} prescribes header.status=${s}`).join('; ') +
      '. A map is deleted at effort close, so that state can never be observed on one.');
    return `reachable by a prescribed command: ${[...reachable.keys()].sort().join(', ')}`;
  });

  /* W68 — this checker has to be REGISTERED in pr-tidying's Category H table
     or that pass never runs it, and the omission is invisible because
     everything still passes.

     Partial by construction, and worth being honest about: if the row is
     missing, Category H does not run this file, so this assertion does not
     fire there. It fires when someone runs the checker directly, which
     SKILL.md's Maintaining section tells them to do after editing any
     wayfinding artifact. That is the window it guards. */
  check('W68', 'this checker is registered in pr-tidying Category H', () => {
    assert(/^\|.*check-tooling\.js.*\|$/m.test(read(PR_TIDYING_DOCS_SYNC)),
      "pr-tidying's Category H checker table has no ROW for check-tooling.js — that pass will silently stop running it. "
      + 'Matched on a table row deliberately: prose mentioning the filename is not registration.');
    return 'listed in the Category H checker registry';
  });

  /* W69 — the template inventory is stated in four places and a new template
     reaches only one of them by itself: `planr templates` reads both template
     directories, so an added template is live immediately while both prose
     tables and the spelled-out count in sdlc go quietly stale. Nothing else
     notices, because every document still validates.

     Two directories since planr 1.2.0: the skill ships `basic`, `tdd` and
     `issue` in its own `templates/`, and this repo's `wayfinding-*` bodies
     live in `.claude/planr-templates/` so a sync of the skill folder is a
     plain overwrite. html-planning's table documents the shipped set only;
     sdlc documents both. */
  check('W69', 'the template inventory agrees across all four of its homes', () => {
    const WORDS = { four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

    const sdlc = read(SDLC);
    const namesIn = (dir) => fs.readdirSync(dir)
      .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
      .map((f) => f.replace(/\.html$/, ''))
      .sort();
    const shipped = namesIn(SHIPPED_TEMPLATES);
    const consumer = namesIn(TEMPLATES);
    assert(shipped.length > 0 && consumer.length > 0,
      `expected templates in both directories — shipped [${shipped}], consumer [${consumer}]`);
    const onDisk = [...shipped, ...consumer].sort();

    const listing = planr(['templates']);
    const listed = [...listing.matchAll(/^([\w-]+)\s{2,}\S/gm)].map((m) => m[1]).sort();
    assert(JSON.stringify(listed) === JSON.stringify(onDisk),
      `planr templates lists [${listed}] but the two template directories hold [${onDisk}]`);
    const unmarked = consumer.filter((n) => !new RegExp(`^${n}\\s{2,}\\[consumer\\]`, 'm').test(listing));
    assert(unmarked.length === 0,
      `planr templates does not mark [${unmarked}] as consumer templates — planr is not reading .claude/planr-templates/`);
    assert(!/Template problems:/.test(listing),
      `planr templates reports template problems:\n      ${listing.slice(listing.indexOf('Template problems:'))}`);

    const tableNames = (src) =>
      [...src.matchAll(/^\|\s*`([\w-]+)`\s*\|/gm)].map((m) => m[1]).filter((n) => onDisk.includes(n)).sort();

    const hp = [...new Set(tableNames(read(HTML_PLANNING)))];
    assert(JSON.stringify(hp) === JSON.stringify(shipped),
      `html-planning's template table lists [${hp}]; the skill's templates/ holds [${shipped}]`);

    const sd = [...new Set(tableNames(sdlc))];
    assert(JSON.stringify(sd) === JSON.stringify(onDisk),
      `docs/sdlc.md's template table lists [${sd}]; the two template directories hold [${onDisk}]`);

    /* The spelled-out count is the one nothing derives, so it is the one that
       rots first. */
    const spelled = sdlc.match(/\b(\w+)(?: templates)? are selectable\b/i);
    assert(spelled, 'docs/sdlc.md no longer states a spelled-out selectable-template count');
    const claimed = WORDS[spelled[1].toLowerCase()];
    assert(claimed !== undefined,
      `docs/sdlc.md says "${spelled[1]} are selectable" and WORDS cannot read that number — add it, or this check ` +
      'reports a self-contradicting message on exactly the event it exists for');
    assert(claimed === onDisk.length,
      `docs/sdlc.md says "${spelled[1]} are selectable" but ${onDisk.length} templates exist`);

    return `${shipped.length} shipped + ${consumer.length} consumer templates, agreeing in both directories, planr, html-planning and sdlc`;
  });

  /* The same failure as W69, one level up and three times over. `docs/sdlc.md`
     §4b, §4c and §4d are the only inventories of what this repo's AI
     infrastructure actually holds, and nothing derives any of them: an agent,
     a skill or a context doc is live the moment its file lands, while the
     table that describes the surface to a reader goes quietly stale. Every
     document still validates, so nothing notices — which is why these three
     joins were a hand pass on every `/pr-tidying` until this check existed.

     Both directions, because they rot into different defects. A file with no
     row is a capability nobody knows to reach for. A row with no file is a
     pointer to something renamed or deleted, and it reads as authoritative.

     Located by header row rather than by offset: these tables move whenever a
     section is added above them, and an offset would silently start reading
     the wrong table instead of failing. */
  check('sdlcinv', "docs/sdlc.md's agent, skill and context inventories match the tree", () => {
    const lines = read(SDLC).split('\n');

    /* Rows run from the separator to the first line that is not a table row.
       That boundary is what keeps the §4c skills table from swallowing the
       plan-templates table immediately below it. */
    /* Returns null when the table is absent. An absent table is legitimate
       only while its population is empty (§4d has no table until the first
       context doc lands; §4b's table has no rows until the first agent does),
       so the join below decides, not this reader. */
    const tableNames = (headerRe) => {
      const i = lines.findIndex((l) => headerRe.test(l));
      if (i < 0) return null;
      const names = [];
      for (let n = i + 2; n < lines.length && /^\|/.test(lines[n]); n++) {
        const m = lines[n].match(/^\|\s*`([^`]+)`\s*\|/);
        if (m) names.push(m[1]);
      }
      return names.sort();
    };

    const dirents = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []);
    const joins = [
      { label: 'agent', home: '.claude/agents/', section: '§4b', header: 'Agent | Role',
        disk: dirents(path.join(REPO, '.claude', 'agents'))
          .filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name.replace(/\.md$/, '')).sort(),
        table: tableNames(/^\|\s*Agent\s*\|\s*Role\s*\|\s*$/) },
      /* The one population that can never legitimately be empty: this file
         lives in it. An empty walk means the walker has drifted. */
      { label: 'skill', home: '.claude/skills/', section: '§4c', header: 'Skill | Purpose', required: true,
        disk: dirents(path.join(REPO, '.claude', 'skills'))
          .filter((e) => e.isDirectory()).map((e) => e.name).sort(),
        table: tableNames(/^\|\s*Skill\s*\|\s*Purpose\s*\|\s*$/) },
      /* Context docs keep their extension in the table, agents and skills do
         not — compare each population in the spelling its own table uses. */
      { label: 'context doc', home: 'docs/context/', section: '§4d', header: 'Doc | Covers',
        disk: dirents(path.join(REPO, 'docs', 'context'))
          .filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort(),
        table: tableNames(/^\|\s*Doc\s*\|\s*Covers\s*\|\s*$/) },
    ];

    const bad = [];
    for (const j of joins) {
      if (j.required) {
        assert(j.disk.length > 0, `${j.home} holds nothing — the walker has drifted from the tree`);
        assert(j.table && j.table.length > 0,
          `docs/sdlc.md ${j.section} no longer carries a '${j.header}' table naming anything in a code span — ` +
          'this check locates its tables by header, so a reworded one reads as an absent one');
      }
      if (j.table === null) {
        if (j.disk.length > 0) {
          bad.push(`${j.home} holds ${j.disk.length} file(s) but docs/sdlc.md ${j.section} has no '${j.header}' table to list them`);
        }
        j.table = [];
        continue;
      }
      const undocumented = j.disk.filter((n) => !j.table.includes(n));
      const dangling = j.table.filter((n) => !j.disk.includes(n));
      for (const n of undocumented) bad.push(`${j.home}${n}: on disk, no row in docs/sdlc.md ${j.section}`);
      for (const n of dangling) bad.push(`docs/sdlc.md ${j.section} has a row for ${j.label} \`${n}\`, which is not in ${j.home}`);
    }

    assert(bad.length === 0,
      `docs/sdlc.md's inventories disagree with the tree:\n      ${bad.join('\n      ')}\n      ` +
      'Add the row, or drop it. Nothing derives these tables, so a missing row is an undocumented ' +
      'capability and a stale row is an authoritative-looking pointer to nothing.');

    return joins.map((j) => `${j.disk.length} ${j.label}s`).join(', ') + ' — each inventory matching both ways '
      + '(an empty population with no table counts as matching)';
  });

  /* W70 — a slice's shipped-ness is recorded in TWO artifacts and pr-tidying
     prescribes flipping both in one pass: the spec's header status, and the
     map row's badge. Nothing joins them, so flipping one and forgetting the
     other is invisible — `planr check` validates structure and never compares
     a header against a table cell in a different file.

     Both halves of the vocabulary are EXTRACTED from the commands pr-tidying
     prescribes rather than spelled out here. If that pass ever adopts a
     different label or a different terminal status, this check follows it
     instead of contradicting it — and if the commands are reworded out of
     recognition, the extraction fails loudly rather than checking nothing.

     Scoped to the rows the map's own `slices` table LINKS. Config specs,
     operator guides and checklists live alongside the slice specs and are not
     rows; they are the pass's judgement call, not this file's. */
  check('W70', 'every map slice badge agrees with the status of the spec it links', () => {
    const tidy = read(PR_TIDYING_LIFECYCLE);
    const badgeCmd = tidy.match(/planr badge <map> --match "<slice name>" --set (\w+) --text "([^"]+)"/);
    assert(badgeCmd, 'pr-tidying no longer prescribes the slice-badge flip in a form this check can read a label off');
    const statusCmd = tidy.match(/planr set <spec> header\.status=(\w+)/);
    assert(statusCmd, 'pr-tidying no longer prescribes the slice-spec status flip in a form this check can read a status off');
    const shippedLabel = badgeCmd[2].toLowerCase();
    const shippedStatus = statusCmd[1].toLowerCase();

    const maps = liveMaps();
    const bad = [];
    let joined = 0;
    let unlinked = 0;

    for (const mapPath of maps) {
      const rel = path.relative(REPO, mapPath).split(path.sep).join('/');
      const sec = read(mapPath).match(/<plan-section id="slices"[\s\S]*?<\/plan-section>/);
      assert(sec, `${rel} has no \`slices\` section — this check addresses it by that id`);

      for (const rowM of sec[0].matchAll(/<tr>[\s\S]*?<\/tr>/g)) {
        const row = rowM[0];
        if (/<th>/.test(row)) continue;                       // the header row
        const href = row.match(/href="([^"]+\.html)"/);
        if (!href) { unlinked++; continue; }                  // a row whose Spec cell is still &mdash;

        /* The row's own name, entity-decoded so the failure message reads the
           way the rendered table does rather than the way the source does. */
        const name = (row.match(/<td>([^<]+)<\/td>/) || [, '(unnamed row)'])[1]
          .replace(/&mdash;/g, '—').replace(/&amp;/g, '&').trim();
        const specPath = path.resolve(path.dirname(mapPath), href[1]);
        if (!fs.existsSync(specPath)) {
          bad.push(`${rel}: "${name}" links ${href[1]}, which does not exist`);
          continue;
        }

        const badge = row.match(/<plan-badge type="([a-z]+)">([^<]*)<\/plan-badge>/);
        if (!badge) { bad.push(`${rel}: "${name}" carries no badge to compare`); continue; }
        /* A badge authored empty renders its TYPE as the label, so the rendered
           text is what a reader sees either way — compare that, not the raw
           child node, or every unlabelled row reads as blank and passes. */
        const claim = (badge[2].trim() || badge[1]).toLowerCase();

        const hdr = read(specPath).match(/<plan-header[\s\S]*?>/);
        assert(hdr, `${href[1]} has no <plan-header> — it is linked as a slice spec but is not one`);
        const st = hdr[0].match(/status="(\w+)"/);
        assert(st, `${href[1]}'s <plan-header> declares no status`);
        const status = st[1].toLowerCase();
        joined++;

        if (claim === shippedLabel && NOT_YET_AGREED.includes(status)) {
          bad.push(`${rel}: "${name}" badge reads "${badge[2].trim() || badge[1]}" but ${href[1]} is still \`${status}\``);
        }
        if (status === shippedStatus && claim !== shippedLabel) {
          bad.push(`${rel}: ${href[1]} is \`${status}\` but "${name}" badge still reads "${badge[2].trim() || badge[1]}"`);
        }
      }
    }

    assert(bad.length === 0,
      `map and spec disagree — pr-tidying flips BOTH in one pass:\n      ${bad.join('\n      ')}`);
    return `${maps.length} live map(s), ${joined} row(s) joined to a spec, ${unlinked} row(s) with no spec linked ` +
      `(shipped reads "${badgeCmd[2]}" / \`${shippedStatus}\`)`;
  });

  /* W71 — closing.md's "graduate a rule's TEXT, never its id" is the one close
     rule nothing executes. `paths` sweeps citations that name a FILE; a bare
     `C12` names a row in a register, and when the close deletes that register
     the citing document is left pointing at nothing while still reading as a
     precise reference — and `paths` passes clean over every one.

     ONLY POSSIBLE AT CLOSE TIME, which is also the only time it matters: the
     vocabulary is defined by the artifacts being deleted, so once they are
     gone nothing can distinguish a dangling id from one that never existed.
     With no live effort there is no vocabulary, and the check passes rather
     than flagging every id the repo has ever cited.

     Sweeps COMMITTABLE docs only, and only the ones that survive a close — see
     NOT_A_SURVIVING_DOC for the trees that are out and why. */
  check('W71', 'no surviving doc cites a wayfinding id no live effort defines', () => {
    const efforts = liveEfforts();
    if (efforts.length === 0) {
      return '0 live effort(s); no id vocabulary exists to check citations against';
    }

    const vocab = new Set();
    for (const e of efforts) for (const id of definedIds(e)) vocab.add(id);
    /* An empty vocabulary across live efforts means the harvest matched
       nothing, not that the efforts define nothing — every register scaffolds
       at least its own example row. Fail loudly rather than sweep against an
       empty set, which would flag every citation in the repo. */
    assert(vocab.size > 0,
      `${efforts.length} live effort(s) but not one defines an id — the harvest has drifted from the register format`);

    const shape = new RegExp(`^(?:${EFFORT_ID.source})$`);
    const docs = [...committableSet()]
      .filter((p) => /\.(?:md|html)$/.test(p) && !NOT_A_SURVIVING_DOC.some((re) => re.test(p))
        && fs.existsSync(path.join(REPO, p)))
      .sort();

    const bad = [];
    let cited = 0;
    for (const rel of docs) {
      const src = read(path.join(REPO, rel));
      for (const m of src.matchAll(CITED_ID)) {
        const tok = (m[1] !== undefined ? m[1] : m[2]).trim();
        if (!shape.test(tok) || NOT_AN_ID.has(tok.toLowerCase())) continue;
        cited++;
        if (vocab.has(tok.toLowerCase())) continue;
        const line = src.slice(0, m.index).split('\n').length;
        bad.push(`${rel}:${line}  ${tok}`);
      }
    }

    assert(bad.length === 0,
      `citations to ids no live effort defines — graduate the rule's TEXT, never its id ` +
      `(closing.md):\n      ${bad.join('\n      ')}`);
    return `${efforts.length} live effort(s) defining ${vocab.size} id(s); ${cited} citation(s) across ` +
      `${docs.length} surviving doc(s) all resolve`;
  });

  /* Every planr invocation the skill prints must actually run. Commands
     carrying placeholders we cannot resolve are SKIPPED and COUNTED — report
     the skip count, or a check that narrowed to nothing still reads green. */
  check('cmds', 'every planr command quoted in SKILL.md runs', () => {
    const sample = "The ticket's title";
    /* `new` scaffolds into its own dir so it cannot collide with the shared
       fixtures. Resolving these placeholders rather than skipping them is the
       point: the scaffolding commands are the ones most worth exercising, and
       they all carry <Effort>-style placeholders. */
    const fresh = path.join(tmp, 'new');
    fs.mkdirSync(fresh, { recursive: true });
    /* `$W/<file>` resolves filename and all, in ONE rule. Substituting the
       directory alone leaves a bare `map.html` inside the new path, which the
       bare-name rules below then match and nest a second path inside the
       first. The lookbehind on those rules is the same guard from the other
       side: only a filename standing alone is a filename. */
    const bare = (name) => new RegExp(`(?<![\\\\/\\w-])${name.replace('.', '\\.')}\\b`, 'g');
    const subs = [
      [/\bnode \.claude\/skills\/html-planning\/planr\.js\b/g, ''],
      [/\$W\/([\w-]*)<slug>\.html/g, (_m, p) => path.join(fresh, `${p}fixture.html`)],
      [/\$W\/([\w.-]+)/g, (_m, f) => path.join(fresh, f)],
      [/"<Effort>[^"]*"/g, '"Fixture"'],
      [/"<Ticket title>"/g, '"Fixture Ticket"'],
      [/<ticket>\.html|q07\.html|<ticket>/g, at('q01.html')],
      [bare('map.html'), at('map.html')],
      [bare('decisions.html'), at('decisions.html')],
      [bare('vocabulary.html'), at('vocabulary.html')],
      [bare('evidence.html'), at('evidence.html')],
      [/"<ticket title>"/g, `"${sample}"`],
      [/"…"/g, `"${sample}"`],
    ];

    /* One pass over fences, language tag optional. Matching plain and tagged
       fences with two separate regexes makes them overlap: the second regex
       pairs one block's closing fence with the next block's opening one and
       captures the prose between them as if it were code. */
    const lines = [];
    for (const m of read(SKILL).matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
      /* Join shell line-continuations first. Splitting on \n alone feeds the
         trailing backslash in as an argument and truncates the command at the
         break — the scaffolding commands are the ones written that way. */
      lines.push(...m[1].replace(/\\\n\s*/g, ' ').split('\n'));
    }

    let ran = 0;
    let refused = 0;
    const skipped = [];
    const failed = [];
    for (let raw of lines) {
      /* Read the marker off the RAW line: it sits in the trailing comment,
         which the next statement strips. */
      const counterexample = raw.includes(COUNTEREXAMPLE);
      let line = raw.replace(/#.*$/, '').trim();
      if (/^[A-Z]+=/.test(line)) continue;                 // P=, W=, D= shell assignments
      for (const [re, to] of subs) line = line.replace(re, to);
      /* Strip the $P alias BEFORE deciding whether this is a command. Testing
         first drops every `$P …` line silently — not skipped, invisible. */
      line = line.replace(/^\$P\s*/, '').trim();
      if (!/^(new|badge|set|set-body|append|prepend|insert|check|list|read|tasks|add-section|rm-section|move-section|templates|rm-item|strike|replace)\b/.test(line)) continue;
      if (/[<>]/.test(line) || /--file|--body-file/.test(line)) { skipped.push(raw.trim()); continue; }

      const args = line.match(/"[^"]*"|\S+/g).map((a) => a.replace(/^"|"$/g, ''));
      /* A counter-example is the form the doc tells a reader never to run.
         planr refuses it, and that refusal is what this line asserts. */
      if (counterexample) {
        let ranClean = true;
        try { planr(args); } catch (e) { ranClean = false; }
        if (ranClean) failed.push(`${raw.trim()}\n        -> marked ${COUNTEREXAMPLE}, but planr ran it clean — the doc warns against a form that works`);
        else refused++;
        continue;
      }
      try {
        planr(args);
        ran++;
      } catch (e) {
        /* planr's real complaint is the LAST stderr line; the first is a stack
           frame that says nothing about what was wrong with the command. */
        const why = (e.stderr || e.message).trim().split('\n').filter(Boolean).pop();
        failed.push(`${raw.trim()}\n        -> ${why}\n        -> as run: ${line}`);
      }
    }
    assert(failed.length === 0, `commands that do not run:\n      ${failed.join('\n      ')}`);
    assert(ran > 0, 'extracted no runnable commands — the extractor has drifted from the doc format');
    return `${ran} ran clean, ${refused} counter-example(s) refused, ${skipped.length} skipped (placeholders or --file)`;
  });

  /* Every concrete path the wayfinding docs cite must resolve AND BE TRACKED.
     Existence is the weaker property: a file sitting untracked on the author's
     disk satisfies it while a fresh checkout gets a dead pointer. Some paths
     are untracked by design; those are allowlisted above, and the allowlist is
     deliberately short so it cannot become the escape hatch. */
  check('paths', 'every path cited by the wayfinding docs is committable', () => {
    const bad = [];
    const tracked = committableSet();
    for (const [label, file] of [['SKILL.md', SKILL], ['closing.md', CLOSING]]) {
      for (const m of read(file).matchAll(/`([\w./-]+\.(?:md|html|js|json|yml))`/g)) {
        const p = m[1];
        if (/^(map|decisions|vocabulary|evidence|body|rows?|hunk|amendment|slices|findings|obligations|q\d+)/.test(p)) continue;
        /* A cited path may be repo-relative or relative to the citing doc —
           both forms are idiomatic here, so try both before calling it dead. */
        const candidates = [path.join(REPO, p), path.join(HERE, p), path.join(path.dirname(file), p)];
        /* Allowlist FIRST. These paths are untracked by design, so on a
           fresh checkout or in CI they do not exist either — gating on
           existence first makes the allowlist unreachable exactly where it
           matters, and green only on a machine that happens to have them. */
        if (UNTRACKED_BY_DESIGN.some((re) => re.test(p))) continue;
        /* Branch-local by design, for the reason `instrpaths` states. */
        if (PLANNING.test(p)) continue;
        const hit = candidates.find((c) => fs.existsSync(c));
        if (!hit) { bad.push(`${label}: ${p} (does not exist)`); continue; }
        const rel = path.relative(REPO, hit).split(path.sep).join('/');
        if (!tracked.has(rel)) bad.push(`${label}: ${p} (exists but is GITIGNORED — a fresh checkout gets a dead pointer)`);
      }
    }
    assert(bad.length === 0, `dangling:
      ${bad.join('\n      ')}`);
    return `${tracked.size} committable files consulted; every citation resolves`;
  });

  /* `paths` follows citations out of the wayfinding docs; `anchors` parses the
     always-loaded instruction files. Nothing joined the two, so a dead path
     cited by `CLAUDE.md` or a context doc passed every check — a skill rename
     leaves exactly that behind. Same committability rule as `paths`: existing
     on the author's disk is the weaker property.

     Scoped to CITING_FILES, which now includes every skill and agent
     definition — see that constant for why. */
  check('instrpaths', 'every path cited by an instruction, context, skill or agent doc is committable', () => {
    const bad = [];
    const tracked = committableSet();
    let examined = 0;
    const files = [...tracked].filter((p) => CITING_FILES.some((re) => re.test(p))).sort();
    assert(files.length > 0, 'matched no citing files at all — CITING_FILES has drifted from the tree');
    for (const rel of files) {
      /* Tracked but not on disk is a `git rm` in progress, not a citation
         defect. Reading it throws and takes the whole harness down with an
         exit 2 that names no check. */
      if (!fs.existsSync(path.join(REPO, rel))) continue;
      for (const m of read(path.join(REPO, rel)).matchAll(/`((?:[\w.-]+\/)+[\w.-]+\.(?:md|html|js|mjs|cjs|ts|json|yml|py|canvas|base))`/g)) {
        const cited = m[1];
        if (UNTRACKED_BY_DESIGN.some((re) => re.test(cited))) continue;
        if (IN_THE_VAULT.some((re) => re.test(cited))) continue;
        /* A glob or a placeholder segment names a shape, not a file. */
        if (/[*<>]|\{|\}/.test(cited)) continue;
        /* REPO-ROOTED ONLY. `builders/schema.ts` and `references/x.md` are relative
           to a directory the surrounding sentence names, not to the repo —
           resolving them means reading the prose, and guessing a root instead
           reports files that are perfectly fine. Noise is how a checker gets
           ignored, so this deliberately sees only the unambiguous form, which
           is also the form that rots on a rename. */
        if (!ROOTED.test(cited)) continue;
        /* The planning trees (`docs/features/`, `docs/issues/`) are branch-local by design: a PRD lives on its own
           branch until it merges, and an issue doc is DELETED when its fix
           ships (pr-tidying Category K). Asserting either exists here fails on
           correct citations, so plans are out of scope for this check — which
           is also why the reference files cite the issues FOLDER and never a
           filename. Re-measured when this check widened to skills and agents,
           and the exemption is if anything MORE necessary there: the agent
           definitions cite `docs/features/foo/foo.html` as a worked example, and
           a skill may cite a PRD that lives on another branch. Enforcing plan citations here would report all of those as
           defects, and noise is how a checker gets ignored. The cost is real
           and is stated so nobody re-derives it: a `git mv` of a PRD to
           another feature folder still breaks a skill's citation silently.

           Re-measured a second time when the set widened to agent memory, and
           it is load-bearing there rather than merely convenient: an agent's
           memory legitimately names the in-flight plan a finding came off,
           while that plan is in flight and therefore untracked by design
           (`tddplans`). Without this line, that correct citation and the
           tracked-file rule contradict each other, and the citation a memory
           note cannot legally make is instead the subject of `tddcites`. */
        if (PLANNING.test(cited)) continue;
        examined++;
        const abs = path.join(REPO, cited);
        if (!fs.existsSync(abs)) { bad.push(`${rel}: ${cited} (does not exist)`); continue; }
        if (!tracked.has(cited)) bad.push(`${rel}: ${cited} (exists but is GITIGNORED — a fresh checkout gets a dead pointer)`);
      }
    }
    assert(bad.length === 0, `dangling:
      ${bad.join('\n      ')}`);
    return `${examined} path citation(s) across ${files.length} instruction, context, skill and agent doc(s) resolve and are committable`;
  });
  /* `refcite` — a skill that splits its rules out of SKILL.md into
     `references/` breaks every external citation of SKILL.md that was really
     citing one of those rules, and NOTHING notices: `instrpaths` asserts a
     cited path EXISTS, and SKILL.md still does. A split leaves stale
     citations in issue docs and decision registers that are found by hand,
     much later, if at all.

     Two joins, both keyed off the cited skill's own files so the check follows
     any skill that adopts the pattern rather than naming pr-tidying:

       A. ID table.  If SKILL.md maps an ID to a reference file in a table row
          (`| K | … | `references/plan-lifecycle.md` | …`), a citer that names
          `Category K` must point at that reference, not at SKILL.md.
       B. Flag literal.  A CLI flag quoted beside the citation that SKILL.md
          does NOT contain, and that exactly ONE reference file does, means the
          rule moved and the pointer did not.

     Deliberately silent when it cannot attribute: a token absent from every
     reference, or present in several, is not evidence of a stale pointer. A
     checker that guesses gets ignored, and being ignored is the failure mode
     this whole file exists to avoid. */
  check('refcite', 'external citations of a split skill point at the file holding the rule', () => {
    const SKILLS = path.join(REPO, '.claude', 'skills');
    /* Only skills that HAVE split. A skill with no references/ cannot have a
       stale pointer of this shape. */
    const split = fs.readdirSync(SKILLS).filter(
      (s) => fs.existsSync(path.join(SKILLS, s, 'references')) && fs.existsSync(path.join(SKILLS, s, 'SKILL.md')));

    /* Per skill: its SKILL.md body, its reference bodies, and the ID→reference
       map parsed out of whatever table SKILL.md uses to route its sections. */
    const meta = new Map();
    for (const s of split) {
      const dir = path.join(SKILLS, s);
      const body = read(path.join(dir, 'SKILL.md'));
      const refs = new Map();
      for (const f of fs.readdirSync(path.join(dir, 'references')).filter((f) => f.endsWith('.md'))) {
        refs.set(f, read(path.join(dir, 'references', f)));
      }
      const ids = new Map();
      for (const m of body.matchAll(/^\|\s*([A-Z](?:\+[A-Z])*)\s*\|[^\n]*?`references\/([\w.-]+\.md)`/gm)) {
        /* `C+D` is one reference serving two ids; both must resolve. */
        for (const id of m[1].split('+')) ids.set(id, m[2]);
      }
      meta.set(s, { refs, body, ids });
    }
    assert(meta.size > 0, 'no skill under .claude/skills has a references/ directory — this check has lost its subject');

    /* A table row is its own record; anything else is its blank-line-delimited
       block. Widening a row to its neighbours would join a citation to another
       row's category letter and report a file that is perfectly correct. */
    const windowAt = (lines, i) => {
      if (/<tr[\s>]/.test(lines[i])) return lines[i];
      let a = i; let b = i;
      while (a > 0 && lines[a - 1].trim() !== '') a--;
      while (b < lines.length - 1 && lines[b + 1].trim() !== '') b++;
      return lines.slice(a, b + 1).join('\n');
    };

    const bad = [];
    const tracked = committableSet();
    let examined = 0;
    for (const rel of [...tracked].filter((p) => /\.(md|html|js)$/.test(p)).sort()) {
      if (!fs.existsSync(path.join(REPO, rel))) continue;   // a `git rm` in progress
      const src = read(path.join(REPO, rel));
      if (!src.includes('/SKILL.md')) continue;
      const lines = src.split('\n');
      for (const s of split) {
        /* A skill citing its own SKILL.md is citing the file it lives in. */
        if (rel.startsWith(`.claude/skills/${s}/`)) continue;
        if (!src.includes(`${s}/SKILL.md`)) continue;
        const { refs, body, ids } = meta.get(s);
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].includes(`${s}/SKILL.md`)) continue;
          const win = windowAt(lines, i);
          examined++;

          /* A — the citer names an ID the skill routes to a reference file. */
          for (const m of win.matchAll(/\bCategor(?:y|ies)\s+([A-Z])\b/g)) {
            const want = ids.get(m[1]);
            if (!want) continue;
            if (win.includes(`references/${want}`)) continue;
            bad.push(`${rel}:${i + 1}: cites ${s}/SKILL.md for Category ${m[1]}, whose rules live in ${s}/references/${want}`);
          }

          /* B — a flag quoted beside the citation that SKILL.md does not carry
             and exactly one reference does. Flags only: an ordinary word can
             sit in one reference by coincidence, a flag cannot. */
          const spans = [...win.matchAll(/`([^`\n]+)`/g), ...win.matchAll(/<code>([^<\n]+)<\/code>/g)];
          for (const m of spans) {
            const flag = (m[1].match(/^(--[\w-]{2,})/) || [])[1];
            if (!flag || body.includes(flag)) continue;
            const holders = [...refs].filter(([, r]) => r.includes(flag)).map(([f]) => f);
            if (holders.length !== 1) continue;
            if (win.includes(`references/${holders[0]}`)) continue;
            bad.push(`${rel}:${i + 1}: cites ${s}/SKILL.md for \`${flag}\`, which appears only in ${s}/references/${holders[0]}`);
          }
        }
      }
    }
    assert(bad.length === 0, `stale pointers into a split skill:
      ${[...new Set(bad)].join('\n      ')}`);
    return `${examined} citation(s) of a split skill's SKILL.md, across ${split.length} split skill(s), point at the file that holds the rule`;
  });

  /* The mirror of `paths`, pointed INWARD. `paths` follows a citation out to
     another file; nothing follows a "see the X below" back to the X. A section
     rewritten out from under such a pointer leaves the sentence reading fine
     and pointing at nothing, and no amount of re-reading the citing paragraph
     reveals it — the evidence is elsewhere in the file.

     Covers the always-loaded root `CLAUDE.md`, `docs/sdlc.md` and
     `docs/context/*.md`. Deliberately narrow on
     BOTH axes: only these files, and only pointers that NAME something (see
     DISTINCTIVE). A generic `see below` gestures at whatever follows and
     cannot dangle, so flagging it would be noise, and noise is how a checker
     gets ignored. Report the skip count, or a matcher that has narrowed to
     nothing still reads green. */
  check('anchors', 'every "see … below/above" pointer resolves inside its own file', () => {
    const bad = [];
    let examined = 0;
    let generic = 0;
    const POINTER = /\bsee\s+([^.;:()\n]{0,70}?)\s*\b(below|above)\b/gi;

    /* Zero named pointers is a legitimate steady state for a small doc set,
       so the tree cannot tell a working matcher from a drifted one. Prove the
       matcher on a fixture instead: one named pointer it must see, one generic
       one it must skip. */
    const named = (s) => [...s.matchAll(POINTER)].filter((m) =>
      DISTINCTIVE.some((re) => [...m[1].matchAll(re)].length > 0)).length;
    assert(named('see the `Landing the stack` rules below') === 1 && named('see below') === 0,
      'the pointer matcher no longer separates a named pointer from a generic one — fix it before trusting a green run');

    for (const rel of [...committableSet()].filter((p) => ANCHOR_FILES.some((re) => re.test(p))).sort()) {
      if (!fs.existsSync(path.join(REPO, rel))) continue;
      const src = read(path.join(REPO, rel));
      for (const m of src.matchAll(POINTER)) {
        /* Bold/italic markers are render chrome around the name, not part of
           it — a pointer written `**the X guard**` names the same X. */
        const phrase = m[1].replace(/\*+/g, '').trim();
        /* A path or a filename is an EXTERNAL citation; `paths` owns that
           direction, and looking for it inside this file would flag every
           correct one. */
        if (/[/\\]|\.(?:md|html|js|mjs|py|json|yml)\b/.test(phrase)) { generic++; continue; }

        const named = [];
        for (const re of DISTINCTIVE) for (const t of phrase.matchAll(re)) named.push(t[1].trim());
        if (named.length === 0) { generic++; continue; }
        examined++;

        /* Search the file MINUS the pointer itself. Leave the phrase in and
           every pointer resolves to its own text, which is a check that can
           never fail. */
        const rest = (src.slice(0, m.index) + src.slice(m.index + m[0].length)).toLowerCase();
        const dead = named.filter((t) => !rest.includes(t.toLowerCase()));
        if (dead.length === 0) continue;

        const line = src.slice(0, m.index).split('\n').length;
        bad.push(`${rel}:${line}  "see ${phrase} ${m[2]}" — nothing else in the file mentions ${dead.map((d) => `"${d}"`).join(', ')}`);
      }
    }

    assert(bad.length === 0, `dangling internal pointers:\n      ${bad.join('\n      ')}`);
    return `${examined} named pointer(s) resolve, ${generic} generic or external skipped; matcher self-test passes`;
  });

  /* A TDD plan is the one planning artifact that is NEVER committed. It is
     working scratch for one branch, it is superseded by the code the moment
     that code lands, and nobody maintains it afterwards — so a tracked one is
     thousands of lines of permanently-wrong prose that greps will keep
     surfacing. The failure mode is not a considered policy change, it is a
     careless `git add -A`, or a `.gitignore` entry that stops matching.

     Reads the policy off sdlc rather than restating it, so a DELIBERATE
     reversal fails with "retire this check" instead of with a false
     violation. */
  check('tddplans', 'no TDD plan under docs/features/ is tracked', () => {
    const row = read(SDLC).match(/^\|\s*TDD plan\s*\|([^|]*)\|/m);
    assert(row, 'docs/sdlc.md §4e no longer carries a `TDD plan` lifecycle row — this check reads the policy off it '
      + 'rather than restating it, so it cannot run against a table that has moved or been reworded');
    assert(/never tracked/i.test(row[1]),
      `docs/sdlc.md §4e now says a TDD plan's fate is "${row[1].trim()}". If the never-tracked policy was `
      + 'deliberately reversed, RETIRE this check — do not edit it green.');

    const onDisk = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else onDisk.push(path.relative(REPO, f).split(path.sep).join('/'));
      }
    };
    if (fs.existsSync(FEATURES)) walk(FEATURES);

    const tracked = trackedSet();
    const violations = [...onDisk, ...[...tracked].filter((p) => p.startsWith('docs/features/'))]
      .filter((p) => TDD_PLAN(p) && tracked.has(p));
    assert(violations.length === 0,
      `TDD plan(s) committed against docs/sdlc.md §4e:\n      ${[...new Set(violations)].join('\n      ')}\n      `
      + '`git rm --cached` them. They stay on disk and stay out of the repo.');

    const untracked = onDisk.filter((p) => TDD_PLAN(p) && !tracked.has(p));
    return `${untracked.length} TDD plan(s) on disk, none tracked`;
  });

  /* `tddplans` guarantees a TDD plan is never committed. That guarantee has a
     consequence nothing enforced: a citation of one is dangling BY
     CONSTRUCTION the moment its branch closes. Not eventually, not if someone
     forgets — the plan is deleted or left untracked on one machine, so every
     other checkout has never had it and never will.

     `instrpaths` cannot catch this, and must not try: it exempts
     the planning trees wholesale, because a citation of an IN-FLIGHT plan is
     legitimate while the branch is open. This is the complement — the subset
     of that exemption that can never become resolvable, whoever cites it and
     however correct it was on the day it was written.

     The finding is about the CITATION FORM, not the file. There is nothing to
     fix at the other end. */
  check('tddcites', 'no tracked doc cites a TDD plan, which is never tracked and always dies at branch close', () => {
    const tracked = committableSet();
    const docs = [...tracked].filter((p) => /\.(?:md|html)$/.test(p)).sort();
    assert(docs.length > 0, 'matched no committable .md or .html docs at all — the file filter has drifted');

    /* The three forms a plan path is written in here: a markdown code span, an
       HTML <code> element, and an unwrapped repo-rooted path. Each is anchored
       so the WHOLE citation is the path — `node planr.js tdd-x.html` is a
       command, not a pointer, and a prose provenance line ("From: the security
       review of tdd-arc-map") names no file at all. Both stay
       out, deliberately: only a thing shaped like a plan path is one. */
    const FORMS = [
      /`((?:[\w.-]+\/)*tdd[\w.-]*\.html|(?:[\w.-]+\/)*tdds?\/[\w.-]+\.html)`/g,
      /<code>((?:[\w.-]+\/)*tdd[\w.-]*\.html|(?:[\w.-]+\/)*tdds?\/[\w.-]+\.html)<\/code>/g,
      /(docs\/features\/[\w./-]+\.html)/g,
    ];
    /* Metasyntactic segments. Agent definitions may teach the memory-filename
       convention with a table row mapping `docs/features/bar/tdds/bar.html`
       to its slug — that names a SHAPE, the same way `instrpaths` treats a
       glob or an angle-bracket placeholder, and flagging it would demand the
       worked example be rewritten into something that no longer teaches. */
    const PLACEHOLDER = /(^|\/)(foo|bar|baz|example)(\/|\.|$)/;

    /* The steady state of this check is ZERO matches, so nothing in the tree
       can tell a working matcher from one that has narrowed to nothing. Run it
       over a fixture first: three citations it must see, three near-misses it
       must not. Without this, deleting the last violation and breaking the
       regex look identical. */
    const hits = (s) => {
      const out = [];
      for (const re of FORMS) for (const m of s.matchAll(re)) {
        if (TDD_PLAN(m[1]) && !PLACEHOLDER.test(m[1])) out.push(m[1]);
      }
      return out;
    };
    for (const [probe, want] of [
      ['see `docs/features/x/tdds/1-x.html` for it', true],
      ['<code>tdd-x.html</code> moved the check', true],
      ['`docs/features/e/tdds/3-slice.html` §4', true],
      ['From: the review of tdd-arc-map', false],
      ['`node .claude/skills/html-planning/planr.js check tdd-x.html`', false],
      ['`docs/features/bar/tdds/bar.html` names the shape', false],
    ]) {
      assert((hits(probe).length > 0) === want,
        `the matcher no longer ${want ? 'sees' : 'ignores'} ${JSON.stringify(probe)} — fix it before trusting a green run`);
    }

    const bad = [];
    for (const rel of docs) {
      if (!fs.existsSync(path.join(REPO, rel))) continue;   // a `git rm` in progress
      const src = read(path.join(REPO, rel));
      const seen = new Set();
      for (const re of FORMS) {
        for (const m of src.matchAll(re)) {
          const cited = m[1];
          if (!TDD_PLAN(cited) || PLACEHOLDER.test(cited)) continue;
          const line = src.slice(0, m.index).split('\n').length;
          const key = `${line}:${cited}`;
          if (seen.has(key)) continue;                      // the same citation, matched by two forms
          seen.add(key);
          bad.push(`${rel}:${line}  ${cited}`);
        }
      }
    }

    assert(bad.length === 0,
      `citation(s) of a TDD plan, which \`tddplans\` guarantees is never committed:\n      ${bad.join('\n      ')}\n      ` +
      'These do not dangle later — they die the moment the branch closes, on every checkout but the author\'s. ' +
      'The fix is a DIFFERENT CITATION, not a different file: name the branch and commit the plan lived on, ' +
      'or cite what survived it — the symbol, test or context doc the plan produced.');

    return `${docs.length} committable .md/.html doc(s) scanned, no TDD-plan citation; matcher self-test passes`;
  });

  /* An issue doc is a debt record, and `issue-creating` is explicit that there
     is no `implemented` end state for one: the commit that DELETES it is the
     record that it was resolved. A doc flipped to implemented and left on disk
     is therefore a half-retired issue — it reads as an open defect to every
     future search while claiming to be closed, and it survives indefinitely
     because nothing looks at issue statuses in aggregate.

     The forbidden status is read off issue-creating's own sentence, for the
     same reason tddplans reads sdlc: if that lifecycle changes, this fails
     saying so rather than enforcing a rule the docs no longer state. */
  check('issuedocs', 'no issue doc carries a status the issue lifecycle has no end state for', () => {
    const m = read(ISSUE_CREATING).match(/there is no `(\w+)` end state for an issue/);
    assert(m, 'issue-creating/SKILL.md no longer states which end state an issue doc cannot hold, in a form this '
      + 'check can read off. Restate it, or retire this check — do not guess the status here.');
    const forbidden = m[1];

    if (!fs.existsSync(ISSUES)) return `no issues directory on this branch (forbidden status: ${forbidden})`;
    const docs = fs.readdirSync(ISSUES).filter((f) => f.endsWith('.html'));

    const bad = [];
    let read_ = 0;
    for (const f of docs) {
      const hdr = read(path.join(ISSUES, f)).match(/<plan-header[\s\S]*?>/);
      if (!hdr) continue;
      const st = hdr[0].match(/status="(\w+)"/);
      if (!st) continue;
      read_++;
      if (st[1].toLowerCase() === forbidden) bad.push(f);
    }
    /* A header the extractor cannot read is indistinguishable from a clean one,
       so say how many were actually inspected rather than how many exist. */
    assert(docs.length === 0 || read_ > 0,
      `${docs.length} issue doc(s) present and a status could be read off none of them — the extractor has drifted`);

    assert(bad.length === 0,
      `issue doc(s) marked \`${forbidden}\` and not deleted:\n      ${bad.join('\n      ')}\n      `
      + 'docs/sdlc.md §4e: an issue doc is DELETED when its fix ships. `git rm` each one — the removing commit '
      + 'is the record that it was resolved. If a fix did NOT ship, the status is wrong, not the file.');
    return `${read_} issue doc(s) inspected, none \`${forbidden}\``;
  });

  /* issue-triaging §1a: `reach=none` exactly when `class=latent`. The rule lives in
     issue-triaging/scripts/review.py (one home, read off the corpus through
     `planr query`); this only invokes it. A repo with no Python on PATH fails
     rather than skipping, since a skipped check reads as a clean one. */
  check('issuemeta', 'issue docs obey the issue-triaging field rules (review.py check)', () => {
    if (!fs.existsSync(ISSUES)) return 'no issues directory on this branch';
    if (!fs.readdirSync(ISSUES).some((f) => f.endsWith('.html'))) return 'no issue docs filed — nothing to check';
    const script = path.join(REPO, '.claude', 'skills', 'issue-triaging', 'scripts', 'review.py');
    const tried = [];
    for (const [cmd, pre] of [['py', []], ['python3', []], ['python', []]]) {
      const r = spawnSync(cmd, [...pre, script, 'check'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
      if (r.error) { tried.push(cmd); continue; }
      assert(r.status === 0, `review.py check exited ${r.status}:\n      ${(r.stderr || r.stdout).trim().split('\n').join('\n      ')}`);
      return r.stdout.trim();
    }
    throw new Error(`no Python interpreter found (tried ${tried.join(', ')}) — issuemeta runs .claude/skills/issue-triaging/scripts/review.py`);
  });

  /* Agent memory is loaded through its index and only through its index, so
     the two ways it breaks are both silent. A pointer to a file that is gone
     costs a read; a topic file NOTHING points at is never loaded at all — it
     sits on disk looking like retained knowledge and is dead weight. Neither
     shows up in any diff review, because the defect is the RELATION between
     two files rather than the content of either.

     Deliberately not an opinion about how much memory an agent should carry —
     that is `agent-memory-compacting`'s judgement call. This only asserts the
     index and the directory describe each other. */
  check('memindex', 'every agent-memory index pointer resolves and no topic file is orphaned', () => {
    if (!fs.existsSync(AGENT_MEMORY)) return 'no agent-memory directory on this branch';
    const dirs = fs.readdirSync(AGENT_MEMORY, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort();

    const bad = [];
    let pointers = 0;
    let topics = 0;

    let empty = 0;
    for (const d of dirs) {
      const dir = path.join(AGENT_MEMORY, d);
      const index = path.join(dir, 'MEMORY.md');
      /* An empty directory is what an agent with `memory: project` leaves
         behind when a dispatch learned nothing worth keeping. Git does not
         track it and nothing reads it, so it is not a defect. */
      if (fs.readdirSync(dir).length === 0) { empty++; continue; }
      if (!fs.existsSync(index)) {
        /* Topic files with no MEMORY.md have a home that can never be read. */
        bad.push(`${d}/ holds files but no MEMORY.md — nothing indexes them, so nothing will ever load them`);
        continue;
      }
      const src = read(index);
      /* Sibling topic files only. A pointer carrying a `/` is a citation into
         the repo, which is `instrpaths`' direction, not this one. */
      const cited = new Set();
      for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
        const t = m[1];
        if (t.includes('/') || !t.endsWith('.md')) continue;
        pointers++;
        cited.add(t);
        if (!fs.existsSync(path.join(dir, t))) bad.push(`${d}/MEMORY.md indexes ${t}, which does not exist`);
      }
      for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md')) {
        topics++;
        if (!cited.has(f)) {
          bad.push(`${d}/${f} is not indexed by ${d}/MEMORY.md — nothing will ever load it`);
        }
      }
    }

    assert(dirs.length > 0, 'agent-memory holds no agent directories at all — the walker has drifted');
    assert(bad.length === 0,
      `agent memory index and directory disagree:\n      ${bad.join('\n      ')}\n      `
      + 'Index it, or drop it (`agent-memory-compacting`). A pointer and a topic file are only useful as a pair.');
    return `${dirs.length - empty} agent(s), ${pointers} index pointer(s) resolve, ${topics} topic file(s) all indexed`
      + (empty ? `; ${empty} empty dir(s) skipped` : '');
  });

}

/* ── report ──────────────────────────────────────────────── */

try {
  runChecks();
} catch (err) {
  console.error(`\n  harness error: ${err.message}\n`);
  cleanup();
  process.exit(2);
}
cleanup();

const failed = results.filter((r) => !r.ok);
console.log('\n  wayfinding tooling — self-consistency\n');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(6)} ${r.what}`);
  if (r.sites) console.log(`              ${r.sites}`);
  if (r.note) console.log(`              ${r.ok ? '' : '! '}${r.note}`);
}
console.log(
  failed.length === 0
    ? `\n  ${results.length} checks, all pass\n`
    : `\n  ${failed.length} of ${results.length} FAILED\n`
);
process.exit(failed.length === 0 ? 0 : 1);
