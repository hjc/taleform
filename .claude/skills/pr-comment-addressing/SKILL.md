---
name: pr-comment-addressing
description: Pull reviewer comments off one or more GitHub PRs with the `gh` CLI, apply them as a work list, and reply to each thread with the commit that fixed it. Use when acting on review feedback that has come back on a PR or a stack of PRs.
---

# PR Comment Addressing

Reviewer feedback has come back. This skill fetches it without missing any, turns it into a work list, applies it, and closes the loop by replying to each thread with a link to the commit that fixed it.

It is the third phase of the PR lifecycle and is deliberately separate from its neighbours:

| Skill | When |
|---|---|
| `pr-tidying` | Before the PR — clean the branch |
| `pr-review-writing` | Opening the PR — describe it to reviewers |
| **`pr-comment-addressing`** | After review — act on what came back |

## The two rules that are not yours to change

1. **Reply, never resolve.** Post a reply on each thread naming the commit that fixed it. **The human resolves the thread.** Do not call `resolveReviewThread`, and do not ask for permission to — resolving is how the reviewer confirms the fix satisfies them, and taking it from them destroys the signal.
2. **Commit AND push before replying.** A reply links a commit SHA. An unpushed SHA 404s for everyone but you, which is worse than no link — it reads as a fix that exists. Push first, verify the link resolves, then reply.

## Phase 1: Fetch — the surfaces, and what silently omits them

### `gh pr view --comments` DOES NOT SHOW INLINE COMMENTS

It prints review *summary* bodies only. On a PR with eleven inline comments it returned one line — "Pretty clean refactor, if you ask me." — and looked like a complete answer. **Never use it to enumerate feedback.** The failure is silent — it does not error.

Three separate APIs back the three surfaces. Query each:

```bash
OWNER=<owner>; REPO=<repo>; PR=<number>

# 1. Inline comments on code — nearly always the real payload
gh api repos/$OWNER/$REPO/pulls/$PR/comments --paginate

# 2. Conversation tab (top-level, not anchored to code)
gh api repos/$OWNER/$REPO/issues/$PR/comments --paginate

# 3. Review summary bodies (the text attached to approve / request-changes)
gh api repos/$OWNER/$REPO/pulls/$PR/reviews --paginate
```

Note surface 2 is under `issues/`, not `pulls/` — a PR is an issue to that endpoint.

### Resolved state is GraphQL-only

REST review comments carry **no** `isResolved`. A comment already dealt with looks identical to a live one, so REST alone means redoing settled work. Measured case: a PR with 5 inline comments had only 3 unresolved threads.

```bash
gh api graphql -f query='
query($owner:String!, $repo:String!, $pr:Int!) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$pr) {
      reviewThreads(first:100) {
        nodes {
          id isResolved isOutdated path line
          comments(first:20) { nodes { databaseId author{login} body } }
        }
      }
    }
  }
}' -f owner=$OWNER -f repo=$REPO -F pr=$PR
```

`reviewThreads.nodes[].id` is the **node ID** (`PRRT_…`), not the numeric comment id. `comments.nodes[].databaseId` is the numeric id the REST reply endpoint wants. Carry both.

**`isOutdated: true`** means the anchored lines have changed since the comment. Treat it as "verify before acting", not "skip" — the concern often survives the code move.

### The single-comment endpoint drops the PR number

```bash
gh api repos/$OWNER/$REPO/pulls/comments/<comment_id>    # correct
gh api repos/$OWNER/$REPO/pulls/$PR/comments/<comment_id>  # 404s
```

The 404 reads like a permissions or id problem and is neither.

### Other fetch details

| Field / flag | What it means |
|---|---|
| `--paginate` | The default page is 30 and the cap is 100. A busy PR silently truncates without it. |
| `in_reply_to_id` | Non-null means the comment is a reply within a thread, not a new one. Group by it or you will treat one conversation as several findings. |
| `start_line` | Non-null means the comment anchors to a multi-line range (`start_line`..`line`). |
| `diff_hunk` | The code the reviewer was looking at. Read it when the comment's referent is ambiguous. |

Bodies come back whole; no truncation to work around.

### Across a stack

Feedback on a stack is one work list, not N. Tally every PR first so nothing is discovered halfway through.

**Derive the stack from the PR base chain; never from a handed-down list of numbers.** A stacked PR targets the branch below it rather than the trunk, so the chain is in the API and a list in a handoff doc or a ticket is a snapshot that silently omits whichever PR was quiet. Measured case: a five-PR inventory was one short, because the missing PR had every thread resolved and so never appeared in a comment tally.

```bash
gh pr list --repo $OWNER/$REPO --state open \
  --json number,headRefName,baseRefName \
  --jq '.[] | "\(.number) \(.headRefName) -> \(.baseRefName)"'
```

Read the chain off that: the PR whose base is the trunk is the bottom, and each one above targets the branch below it. Then tally:

```bash
for PR in <numbers from the chain>; do
  inline=$(gh api repos/$OWNER/$REPO/pulls/$PR/comments --paginate --jq 'length')
  convo=$(gh api repos/$OWNER/$REPO/issues/$PR/comments --paginate --jq 'length')
  live=$(gh api graphql -f query='query($o:String!,$r:String!,$p:Int!){repository(owner:$o,name:$r){pullRequest(number:$p){reviewThreads(first:100){nodes{isResolved}}}}}' \
    -f o=$OWNER -f r=$REPO -F p=$PR --jq '[.data.repository.pullRequest.reviewThreads.nodes[]|select(.isResolved==false)]|length')
  echo "PR #$PR: inline=$inline conversation=$convo unresolved=$live"
done
```

**A fix lands on the branch whose PR carries the review comment.** Rebase the branches above it onto the fix.

## Phase 2: Triage into a work list

Build the list before touching anything. For each live thread record: PR, thread node ID, numeric comment id, file, line range, what the reviewer asked, and what you intend to do.

- **Group by theme, not by PR or file.** Reviewers repeat themselves across files; one theme is one decision applied N times, and deciding it N times invites N different answers. A real batch resolved into three themes across nine files.
- **Re-read the code before believing the comment.** The branch has moved since the review. A comment may be stale, already fixed, or now wrong.
- **Flag disagreements in the list; do not silently skip.** If a comment should not be actioned, say so with the reason and let the human rule. Silence reads as done.
- **A comment that is a question gets an answer, not a code change.**
- **Stop and ask when a comment admits two genuinely different fixes.** Not every ambiguity — pick the obvious reading and move. But when a plausible misreading would send you down an orthogonal, non-trivial path, and most of all when the comment could be asking for an architectural refactor, name both readings and let the human pick. Building the wrong one costs more than the question does.

## Phase 3: Apply

Work theme by theme. Follow the repo's own conventions for the code being changed, and its test commands.

Keep commits reviewable against the feedback: a commit per theme reads far better than one per comment or one for everything. **Every commit message states what the reviewer asked and what changed** — the reviewer's next read is the diff against their own comment.

Run the relevant suites before committing. If a fix breaks something, that is part of this work, not a follow-up.

## Phase 4: Commit, push, then reply

**Push before replying** (rule 2). Then, per thread:

```bash
gh api --method POST \
  repos/$OWNER/$REPO/pulls/$PR/comments/<comment_id>/replies \
  -f body='Fixed in <sha>. <one line on what changed.>'
```

`<comment_id>` is the numeric id of the thread's **first** comment (`databaseId` from GraphQL, or a REST comment whose `in_reply_to_id` is null). Replying to a reply is an error.

A commit URL renders as a rich link and survives better than a bare SHA:

```
https://github.com/$OWNER/$REPO/commit/<full-sha>
```

Reply content:

- **What changed and where, in one or two sentences.** The reviewer already knows what they asked.
- **State it plainly when you did something different** from what was asked, and why. A reply implying compliance where there was none is worse than no reply.
- **Do not thank, apologise, or narrate the process.** No "great catch", no "you're absolutely right".
- **One reply per thread.** Do not re-reply on a thread that already carries your answer.

Then **stop**. The human resolves.

**A rebase after replying strands every SHA you posted.** Rewritten commits stay reachable from the PR, so the links do not 404 — they point at commits that are no longer on any branch. Not worth re-posting a batch of replies over, but say so when it happens rather than letting a reviewer find it. If a rebase onto the trunk is already planned, do it **before** the reply pass, not after.

## Phase 5: Report

State per PR: threads addressed with their commits, threads deliberately not actioned and why, anything that turned out already fixed or stale, and any comment needing a decision you could not make. Name the threads left open for the human to resolve.

## Verification gates

- Every live thread on every PR in scope is either addressed or explicitly listed as not-actioned. No thread silently dropped.
- Comment enumeration came from the three API surfaces, never `gh pr view --comments`.
- Resolved state came from GraphQL, and resolved threads were skipped.
- Every replied SHA is pushed and its URL resolves.
- No thread was resolved by you.
- Test suites for the changed areas are green.

## `gh` setup

`gh auth status` must show an account with the **`repo`** scope; that covers reading every surface here and posting replies.
