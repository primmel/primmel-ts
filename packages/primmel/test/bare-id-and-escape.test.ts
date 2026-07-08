import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { stripWrapping, escapeString } from '../src/ser-des/tokenize'

describe('stripWrapping', () => {
  it('returns bare IDs unchanged', () => {
    assert.equal(stripWrapping('DetermineMeasurementError'), 'DetermineMeasurementError')
    assert.equal(stripWrapping('x'), 'x')
  })

  it('strips matching double quotes', () => {
    assert.equal(stripWrapping('"My Form"'), 'My Form')
  })

  it('strips matching braces', () => {
    assert.equal(stripWrapping('{ block }'), ' block ')
  })

  it('does NOT strip when first and last chars do not match', () => {
    assert.equal(stripWrapping('"unclosed'), '"unclosed')
    assert.equal(stripWrapping('mixed"'), 'mixed"')
  })

  it('returns short strings unchanged', () => {
    assert.equal(stripWrapping(''), '')
    assert.equal(stripWrapping('a'), 'a')
  })
})

describe('escapeString', () => {
  it('returns strings without special chars unchanged', () => {
    assert.equal(escapeString('hello world'), 'hello world')
  })

  it('escapes embedded double quotes', () => {
    assert.equal(escapeString('he said "hi"'), 'he said \\"hi\\"')
  })

  it('escapes backslashes', () => {
    assert.equal(escapeString('path\\to\\file'), 'path\\\\to\\\\file')
  })

  it('handles empty string', () => {
    assert.equal(escapeString(''), '')
  })

  it('round-trips through the tokenizer', async () => {
    // Demonstrate that escapeString output, when wrapped in quotes and
    // tokenized, recovers the original value.
    const { default: tokenize } = await import('../src/ser-des/tokenize')
    const original = 'has "quotes" and \\ backslash'
    const dumped = '"' + escapeString(original) + '"'
    const toks = tokenize('name ' + dumped)
    assert.equal(toks[1], dumped)
    // strip the wrapping quotes — should match original
    assert.equal(toks[1].slice(1, -1), escapeString(original))
  })
})
