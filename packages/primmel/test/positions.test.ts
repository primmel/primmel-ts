import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { tokenizeWithPositions } from '../src/ser-des/tokenize'

describe('tokenizeWithPositions', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(tokenizeWithPositions(''), [])
  })

  it('records 1-based line and column for each token', () => {
    const toks = tokenizeWithPositions('hello world')
    assert.equal(toks[0].value, 'hello')
    assert.equal(toks[0].start.line, 1)
    assert.equal(toks[0].start.col, 1)
    assert.equal(toks[0].start.offset, 0)
    assert.equal(toks[1].value, 'world')
    assert.equal(toks[1].start.line, 1)
    assert.equal(toks[1].start.col, 7)
    assert.equal(toks[1].start.offset, 6)
  })

  it('increments line counter on newlines', () => {
    const toks = tokenizeWithPositions('a\nb\nc')
    assert.equal(toks[1].start.line, 2)
    assert.equal(toks[2].start.line, 3)
  })

  it('treats quoted strings as single tokens with correct start position', () => {
    const toks = tokenizeWithPositions('id "hello world"')
    assert.equal(toks[1].value, '"hello world"')
    assert.equal(toks[1].start.line, 1)
    assert.equal(toks[1].start.col, 4)
    assert.equal(toks[1].start.offset, 3)
  })

  it('treats brace blocks as single tokens', () => {
    const toks = tokenizeWithPositions('id { a b }')
    assert.equal(toks[1].value, '{ a b }')
    assert.equal(toks[1].start.col, 4)
  })

  it('skips comments without affecting token positions', () => {
    const toks = tokenizeWithPositions('// comment\nid value')
    assert.equal(toks[0].value, 'id')
    assert.equal(toks[0].start.line, 2)
    assert.equal(toks[0].start.col, 1)
    assert.equal(toks[0].start.offset, 11)
  })

  it('records end position immediately after the last char of value', () => {
    const toks = tokenizeWithPositions('aaa bbb')
    assert.equal(toks[0].end.line, 1)
    assert.equal(toks[0].end.col, 4)
    assert.equal(toks[0].end.offset, 3)
  })
})
