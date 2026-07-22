#!/usr/bin/env node

/**
 * TK ForgeWorks standard release-notes generator.
 *
 * Builds release-notes markdown from commit subjects since the previous
 * tag. Version-bump commits are filtered out; subjects are split into
 * "Bug Fixes" (subject starts with "fix", or "<TICKET>-N: Fix ...") and
 * "Changes"; Jira ticket keys are linked when configured.
 *
 * A stable release (no prerelease suffix in the tag) diffs against the
 * previous STABLE tag, so final-release notes span all release candidates.
 *
 * Env:
 *  RELEASE_VERSION  tag being released (e.g. v1.1.0-rc.4); defaults to
 *                   GITHUB_REF_NAME, then the newest tag
 *  TICKET_PREFIX    Jira project key for linking/categorization (e.g. CGUI,
 *                   ANV); unset disables ticket handling
 *  JIRA_BASE_URL    e.g. https://tkforgeworks.atlassian.net/browse —
 *                   when set (with TICKET_PREFIX), keys become links
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

function findPreviousTag() {
  try {
    const tags = git('tag --sort=-v:refname').split('\n').filter(Boolean)
    const current = process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || tags[0]
    const idx = tags.indexOf(current)
    if (idx < 0) return tags.length > 0 ? tags[0] : null

    const candidates = tags.slice(idx + 1)
    if (!isPrerelease(current)) {
      const prevStable = candidates.find((t) => !isPrerelease(t))
      if (prevStable) return prevStable
    }
    return candidates.length > 0 ? candidates[0] : null
  } catch {
    return null
  }
}

function getCommits(since) {
  const range = since ? `${since}..HEAD` : 'HEAD'
  const raw = git(`log ${range} --format="%h|||%s"`)
  if (!raw) return []
  return raw.split('\n').map((line) => {
    const [hash, ...rest] = line.split('|||')
    return { hash, message: rest.join('|||') }
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
  const prevTag = findPreviousTag()
  const commits = getCommits(prevTag)
  const filtered = commits.filter((c) => !isReleaseBump(c.message))

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
