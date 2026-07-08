import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { loadWithIssues } from '../src/ser-des/index'

describe('duplicate-ID detection (parse-time)', () => {
  it('returns no issues when IDs are unique within a kind', () => {
    const r = loadWithIssues(`
      role author { name "Author" }
      role reviewer { name "Reviewer" }
    `)
    assert.equal(r.issues.length, 0)
    assert.equal(r.standard.roles.length, 2)
  })

  it('flags an error when two roles share an id', () => {
    const r = loadWithIssues(`
      role author { name "First" }
      role author { name "Second" }
    `)
    assert.equal(r.issues.length, 1)
    assert.equal(r.issues[0].code, 'duplicate-id')
    assert.equal(r.issues[0].construct, 'roles')
    assert.equal(r.issues[0].id, 'author')
    assert.ok(r.issues[0].message.includes('author'))
    // Position should be set and point to second occurrence (line > 1)
    assert.ok(r.issues[0].position && r.issues[0].position.line > 1)
  })

  it('allows the same ID across DIFFERENT kinds', () => {
    // Cross-kind collisions are NOT duplicates — a Role and a Process
    // may share an id without ambiguity.
    const r = loadWithIssues(`
      role widget { name "W" }
      process widget { name "W" }
    `)
    assert.equal(r.issues.length, 0)
  })

  it('reports each duplicate occurrence separately', () => {
    // Three roles with id "x" → 2 duplicate issues (2nd and 3rd)
    const r = loadWithIssues(`
      role x { name "1" }
      role x { name "2" }
      role x { name "3" }
    `)
    assert.equal(r.issues.length, 2)
    assert.ok(r.issues.every(i => i.code === 'duplicate-id'))
  })

  it('detects duplicates across all construct kinds', () => {
    const r = loadWithIssues(`
      process p1 { name "1" }
      process p1 { name "2" }
      form f1 { name "1" }
      form f1 { name "2" }
    `)
    assert.equal(r.issues.length, 2)
    const constructs = new Set(r.issues.map(i => i.construct))
    assert.ok(constructs.has('processes'))
    assert.ok(constructs.has('forms'))
  })
})
