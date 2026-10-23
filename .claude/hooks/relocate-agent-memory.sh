#!/usr/bin/env bash
# ============================================================================
# Script:      relocate-agent-memory.sh
# Description: Claude Code SubagentStop hook. Subagents dispatched while the
#              shell cwd is a subdirectory (e.g. src/, test/)
#              write their agent-memory to "<subdir>/.claude/agent-memory/..."
#              instead of the repo-root ".claude/agent-memory/...". This hook
#              relocates that stray drift back to the root: it moves loose
#              topic files into the correct root agent dir (never clobbering),
#              dedup-appends any missing index pointers to the real MEMORY.md,
#              and removes the emptied stray ".claude" dir.
#
#              Deterministic + idempotent. It only RELOCATES files; merging the
#              CONTENT of accumulated topic files is the job of the
#              /agent-memory-compacting skill (judgment, not mechanics).
# Usage:       Invoked by Claude Code on SubagentStop with hook JSON on stdin.
#              Manual: bash .claude/hooks/relocate-agent-memory.sh [--dry-run] [-v]
# Author:      Hayden Chudy
# Created:     2026-06-24
# ============================================================================

# NOTE: `set -e` is intentionally omitted. A hook must never disrupt the
# session: a single failed mv/append should be logged and skipped, not abort
# the run mid-relocation leaving half-moved state. Each fallible operation is
# guarded explicitly, and the script always exits 0 (see cleanup()).
set -uo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_PREFIX="[${SCRIPT_NAME}]"

# Colors disabled unless stderr is a terminal and NO_COLOR is unset.
if [[ -t 2 ]] && [[ -z "${NO_COLOR:-}" ]]; then
    readonly YELLOW='\033[0;33m'; readonly RED='\033[0;31m'
    readonly BLUE='\033[0;34m'; readonly GREEN='\033[0;32m'; readonly NC='\033[0m'
else
    readonly YELLOW=''; readonly RED=''; readonly BLUE=''; readonly GREEN=''; readonly NC=''
fi

VERBOSE=0
DRY_RUN=0

# All logging goes to STDERR. A hook's STDOUT is parsed as JSON by Claude Code,
# so it MUST stay empty (this hook returns no JSON — it just does work).
log_info()  { printf '%b%s %s%b\n'        "$GREEN"  "$LOG_PREFIX" "$*" "$NC" >&2; }
log_warn()  { printf '%b%s WARN: %s%b\n'  "$YELLOW" "$LOG_PREFIX" "$*" "$NC" >&2; }
log_error() { printf '%b%s ERROR: %s%b\n' "$RED"    "$LOG_PREFIX" "$*" "$NC" >&2; }
log_debug() { [[ "$VERBOSE" -ge 1 ]] && printf '%b%s DEBUG: %s%b\n' "$BLUE" "$LOG_PREFIX" "$*" "$NC" >&2 || true; }

# Always exit 0 so a hook hiccup never wedges or fails the session.
cleanup() {
    local code=$?
    [[ $code -ne 0 ]] && log_warn "internal exit code $code suppressed (hook always exits 0)"
    exit 0
}
trap cleanup EXIT
trap 'trap - EXIT; cleanup' INT TERM

usage() {
    cat >&2 <<EOF
Usage: ${SCRIPT_NAME} [--dry-run] [-v|--verbose]

Claude Code SubagentStop hook. Relocates stray "<subdir>/.claude/agent-memory"
drift into the repo-root ".claude/agent-memory", dedup-appends missing MEMORY.md
index pointers, and removes the emptied stray dirs. Reads hook JSON on stdin
(unused beyond draining); resolves the repo root from \$CLAUDE_PROJECT_DIR with a
git fallback. Always exits 0.
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)    usage; exit 0 ;;
            -v|--verbose) VERBOSE=$((VERBOSE + 1)); shift ;;
            --dry-run)    DRY_RUN=1; shift ;;
            --)           shift; break ;;
            -*)           log_warn "unknown option: $1"; shift ;;
            *)            break ;;
        esac
    done
}

# Resolve the repo root: prefer Claude Code's env var, fall back to git.
resolve_root() {
    if [[ -n "${CLAUDE_PROJECT_DIR:-}" && -d "${CLAUDE_PROJECT_DIR}/.claude" ]]; then
        printf '%s\n' "$CLAUDE_PROJECT_DIR"; return 0
    fi
    local top
    if top="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null)" && [[ -d "$top/.claude" ]]; then
        printf '%s\n' "$top"; return 0
    fi
    return 1
}

# Append index-pointer lines from a stray MEMORY.md stub into the real one,
# skipping any whose referenced "(filename.md)" is already indexed. Never
# overwrites; if the real MEMORY.md does not exist, the stub is moved as-is.
merge_memory_stub() {
    local stub="$1" dest="$2"

    if [[ ! -f "$dest" ]]; then
        if [[ "$DRY_RUN" -eq 1 ]]; then
            log_info "[dry-run] would move MEMORY.md stub -> $dest"
        else
            mv -- "$stub" "$dest" && log_info "moved MEMORY.md stub -> $dest" \
                || log_warn "failed to move MEMORY.md stub -> $dest"
        fi
        return 0
    fi

    # Collect stub index lines (markdown bullets that reference a .md file).
    local appended=0 line fname
    while IFS= read -r line; do
        # Extract the first "(....md)" target on the line.
        fname="$(printf '%s\n' "$line" | sed -n 's/.*(\([^()]*\.md\)).*/\1/p' | head -n1)"
        [[ -z "$fname" ]] && continue
        if grep -qF "($fname)" "$dest" 2>/dev/null; then
            log_debug "index already references ($fname); skipping"
            continue
        fi
        if [[ "$DRY_RUN" -eq 1 ]]; then
            log_info "[dry-run] would append index pointer for ($fname) to $dest"
            appended=$((appended + 1)); continue
        fi
        # Ensure a "## Topic Files" section exists, then append the pointer.
        if ! grep -qF "## Topic Files" "$dest" 2>/dev/null; then
            printf '\n## Topic Files\n' >> "$dest" || log_warn "failed to add Topic Files section to $dest"
        fi
        printf '%s\n' "$line" >> "$dest" \
            && { appended=$((appended + 1)); log_debug "appended pointer for ($fname)"; } \
            || log_warn "failed to append pointer for ($fname) to $dest"
    done < <(grep -E '^\s*[-*]\s*\[.*\]\(.*\.md\)' "$stub" 2>/dev/null || true)

    [[ "$appended" -gt 0 ]] && log_info "merged $appended index pointer(s) into $dest"

    # Stub fully consumed — drop it (real MEMORY.md is the source of truth).
    if [[ "$DRY_RUN" -eq 0 ]]; then
        rm -f -- "$stub" || log_warn "failed to remove consumed stub $stub"
    fi
}

# Relocate a single loose topic file into the destination agent dir.
relocate_topic_file() {
    local src="$1" dest_dir="$2" base
    base="$(basename -- "$src")"
    local dest="$dest_dir/$base"

    if [[ ! -e "$dest" ]]; then
        if [[ "$DRY_RUN" -eq 1 ]]; then
            log_info "[dry-run] would move $src -> $dest"
        else
            mv -- "$src" "$dest" && log_info "relocated $base -> $dest_dir/" \
                || log_warn "failed to relocate $src -> $dest"
        fi
        return 0
    fi

    # Destination exists. If identical, the drift copy is redundant — drop it.
    if cmp -s -- "$src" "$dest" 2>/dev/null; then
        log_debug "$base identical to existing; discarding drift copy"
        [[ "$DRY_RUN" -eq 0 ]] && { rm -f -- "$src" || log_warn "failed to remove dup $src"; }
        return 0
    fi

    # Differs — preserve both rather than clobber. The /agent-memory-compacting
    # skill reconciles divergent copies later.
    local alt="$dest_dir/${base%.md}.drift.md"
    local n=1
    while [[ -e "$alt" ]]; do alt="$dest_dir/${base%.md}.drift-${n}.md"; n=$((n + 1)); done
    if [[ "$DRY_RUN" -eq 1 ]]; then
        log_info "[dry-run] would preserve divergent $base as $alt"
    else
        mv -- "$src" "$alt" && log_warn "kept divergent $base as $(basename -- "$alt") (reconcile via /agent-memory-compacting)" \
            || log_warn "failed to preserve divergent $src"
    fi
}

# Process one stray ".claude" directory.
process_stray() {
    local stray="$1" root="$2"
    local stray_am="$stray/agent-memory"
    [[ -d "$stray_am" ]] || { log_debug "no agent-memory under $stray; skipping"; return 0; }

    log_info "found stray agent-memory: $stray_am"

    local agent_dir agent dest_dir entry base
    for agent_dir in "$stray_am"/*/; do
        [[ -d "$agent_dir" ]] || continue
        agent="$(basename -- "$agent_dir")"
        dest_dir="$root/.claude/agent-memory/$agent"
        [[ "$DRY_RUN" -eq 0 ]] && mkdir -p -- "$dest_dir"

        for entry in "$agent_dir"*; do
            [[ -f "$entry" ]] || continue
            base="$(basename -- "$entry")"
            if [[ "$base" == "MEMORY.md" ]]; then
                merge_memory_stub "$entry" "$dest_dir/MEMORY.md"
            else
                relocate_topic_file "$entry" "$dest_dir"
            fi
        done
    done

    # Remove the stray ".claude" tree only if nothing remains under it
    # (i.e. it held nothing but the relocated agent-memory drift).
    if [[ "$DRY_RUN" -eq 1 ]]; then
        log_info "[dry-run] would remove emptied stray dir $stray (if empty)"
        return 0
    fi
    if [[ -z "$(find "$stray" -type f 2>/dev/null)" ]]; then
        rm -rf -- "$stray" && log_info "removed emptied stray dir: $stray" \
            || log_warn "failed to remove stray dir $stray"
    else
        log_warn "stray dir $stray still has non-agent-memory files; left in place"
    fi
}

main() {
    parse_args "$@"

    # Drain stdin (hook JSON). We resolve the root from the env, so the JSON is
    # not parsed — but reading it avoids the writer seeing a broken pipe.
    [[ ! -t 0 ]] && cat >/dev/null 2>&1 || true

    command -v find >/dev/null 2>&1 || { log_error "find not available; cannot scan"; exit 0; }

    local root
    if ! root="$(resolve_root)"; then
        log_debug "could not resolve repo root (no CLAUDE_PROJECT_DIR, no git toplevel); nothing to do"
        exit 0
    fi
    log_debug "repo root: $root"

    # Find stray ".claude" dirs OUTSIDE the managed root ".claude" tree. The
    # entire "$root/.claude" subtree is pruned: the canonical dir itself AND
    # anything nested under it (e.g. archived bundles under .claude/implemented/
    # that may legitimately carry their own .claude/agent-memory snapshot) is
    # off-limits. Genuine drift is "<source-dir>/.claude" (src/, test/,
    # ...) — never inside .claude/. Heavy/irrelevant trees are pruned too.
    local found=0 stray
    while IFS= read -r -d '' stray; do
        # Defensive: never act on anything within the root .claude tree.
        [[ "$stray" == "$root/.claude" || "$stray" == "$root/.claude/"* ]] && continue
        found=$((found + 1))
        process_stray "$stray" "$root"
    done < <(
        find "$root" \
            \( -type d \( -path "$root/.claude" -o -name node_modules -o -name .git -o -name .venv -o -name venv -o -name __pycache__ \) -prune \) -o \
            \( -type d -name .claude -print0 \) 2>/dev/null
    )

    if [[ "$found" -eq 0 ]]; then
        log_debug "no stray .claude drift found"
    else
        log_info "processed $found stray .claude dir(s)"
    fi

    exit 0
}

main "$@"
