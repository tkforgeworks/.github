#!/usr/bin/env node

/**
 * TK ForgeWorks standard release-notes generator.
 *
 * Builds release-notes markdown from commit subjects since the previous
 * tag. Version-bump and merge commits are filtered out; subjects are split into
 * "Bug Fixes" (subject starts with "fix", or "<TICKET>-N: Fix ...") and
 * "Changes"; Jira ticket keys are linked when configured. Commits changing only
 * excluded paths are skipped; identical trimmed subjects appear once (first wins).
 *
 * A stable release (no prerelease suffix in the tag) diffs against the
 * previous STABLE tag, so final-release notes span all release candidates.
 * A first stable release has no such tag and covers the whole history.
 *
 * Works for both tag-triggered releases (the current tag already exists)
 * and push-triggered releases (the tag is created after notes generation —
 * pass RELEASE_VERSION explicitly).
 *
 * Env:
 *  RELEASE_VERSION  tag being released (e.g. v1.1.0-rc.4); defaults to
 *                   GITHUB_REF_NAME, then the newest tag
 *  TICKET_PREFIX    Jira project key for linking/categorization (e.g. CGUI,
 *                   ANV); unset disables ticket handling
 *  JIRA_BASE_URL    e.g. https://tkforgeworks.atlassian.net/browse —
 *                   when set (with TICKET_PREFIX), keys become links
 *
 *  EXCLUDE_PATHS    newline-separated globs added to the default excludes
 *  EXCLUDE_DEFAULT_PATHS  false disables defaults (the .claude tree, CLAUDE.md
 *                   at any depth, and root AGENTS.md)
 *
 * Canonical home: tkforgeworks/.github — consume via the release-notes.yml
 * reusable workflow rather than copying this file into repos.
 */

const { execSync } = require('child_process')

const JIRA_BASE = process.env.JIRA_BASE_URL || ''
const TICKET_PREFIX = process.env.TICKET_PREFIX || ''

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim()
}

function isPrerelease(tag) {
  return tag.includes('-')
}

function getAllTags() {
  try {
    return git('tag --sort=-v:refname').split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function currentVersion(tags) {
  return process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || tags[0] || ''
}

function findPreviousTag(current, tags) {
  const idx = tags.indexOf(current)
  // Push-triggered callers run before the release tag is created, so the
  // current version is absent from the list and every existing tag is older.
  const candidates = idx >= 0 ? tags.slice(idx + 1) : tags
  if (current && !isPrerelease(current)) {
    // No earlier stable tag means this is the first stable release: return
    // null so the notes cover the whole history, not just the commits since
    // the last release candidate.
    return candidates.find((t) => !isPrerelease(t)) || null
  }
  return candidates.length > 0 ? candidates[0] : null
}

function getCommits(since) {
  const range = since ? `${since}..HEAD` : 'HEAD'
  const raw = git(`-c core.quotePath=false log ${range} --no-merges --name-only -z --format="%x1e%h%x00%s"`)
  if (!raw) return []
  return raw.split('\x1e').filter(Boolean).map((record) => {
    const [hash, message, ...files] = record.split('\0')
    return { hash, message: message.trim(), files: files.map((file) => file.replace(/^\n/, '')).filter(Boolean) }
  })
}

function globToRegExp(glob) {
  let pattern = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]
    if (char === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        pattern += '(?:.*/)?'
        i += 2
      } else {
        pattern += '.*'
        i++
      }
    } else if (char === '*') {
      pattern += '[^/]*'
    } else if (char === '?') {
      pattern += '[^/]'
    } else {
      pattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${pattern}$`)
}

function excludePatterns() {
  const defaults = process.env.EXCLUDE_DEFAULT_PATHS === 'false'
    ? [] : ['.claude/**', '**/CLAUDE.md', 'AGENTS.md']
  const extra = (process.env.EXCLUDE_PATHS || '').split('\n').map((path) => path.trim()).filter(Boolean)
  return [...defaults, ...extra].map(globToRegExp)
}

function filterCommits(commits) {
  const patterns = excludePatterns()
  const seen = new Set()
  return commits.filter((commit) => {
    if (isReleaseBump(commit.message)) return false
    if (commit.files.length > 0 && commit.files.every((file) => patterns.some((pattern) => pattern.test(file)))) return false
    if (seen.has(commit.message)) return false
    seen.add(commit.message)
    return true
  })
}

function isReleaseBump(msg) {
  return /^Release\b/i.test(msg) || /^\d+\.\d+\.\d+/i.test(msg)
}

function isFix(msg) {
  if (/^fix\b/i.test(msg)) return true
  if (TICKET_PREFIX) {
    return new RegExp(`^${TICKET_PREFIX}-\\d+:\\s*fix\\b`, 'i').test(msg)
  }
  return false
}

function linkTickets(msg) {
  if (!JIRA_BASE || !TICKET_PREFIX) return msg
  const base = JIRA_BASE.replace(/\/$/, '')
  return msg.replace(new RegExp(`\\b(${TICKET_PREFIX}-\\d+)\\b`, 'g'), `[$1](${base}/$1)`)
}

function run() {
  const tags = getAllTags()
  const current = currentVersion(tags)
  const prevTag = findPreviousTag(current, tags)
  const commits = getCommits(prevTag)
  const filtered = filterCommits(commits)

  if (filtered.length === 0) {
    console.log('No notable changes in this release.')
    return
  }

  const fixes = []
  const changes = []
  for (const c of filtered) {
    if (isFix(c.message)) {
      fixes.push(c)
    } else {
      changes.push(c)
    }
  }

  const lines = ["## What's Changed", '']
  if (changes.length > 0) {
    lines.push('### Changes')
    for (const c of changes) lines.push(`- ${linkTickets(c.message)}`)
    lines.push('')
  }
  if (fixes.length > 0) {
    lines.push('### Bug Fixes')
    for (const c of fixes) lines.push(`- ${linkTickets(c.message)}`)
    lines.push('')
  }

  console.log(lines.join('\n'))
}

run()
