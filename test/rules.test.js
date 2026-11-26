import test from 'node:test'
import assert from 'node:assert/strict'
import { ratio, suggestColor, scoreOf, grade, hex } from '../src/rules.js'

const white = { r: 255, g: 255, b: 255, a: 1 }
const black = { r: 0, g: 0, b: 0, a: 1 }

test('contrast ratio matches the WCAG reference values', () => {
  assert.equal(Math.round(ratio(black, white) * 100) / 100, 21)
  assert.equal(ratio(white, white), 1)
  // #767676 on white is the well-known 4.54:1 pass
  const r = ratio({ r: 0x76, g: 0x76, b: 0x76, a: 1 }, white)
  assert.ok(r > 4.5 && r < 4.6, String(r))
})

test('suggestColor returns a colour that meets the target', () => {
  const fg = { r: 0xaa, g: 0xaa, b: 0xaa, a: 1 } // #aaa on white fails
  assert.ok(ratio(fg, white) < 4.5)
  const sug = suggestColor(fg, white, 4.5)
  const c = { r: parseInt(sug.slice(1, 3), 16), g: parseInt(sug.slice(3, 5), 16), b: parseInt(sug.slice(5, 7), 16), a: 1 }
  assert.ok(ratio(c, white) >= 4.5)
})

test('suggestColor lightens text on a dark background', () => {
  const bg = { r: 0x1b, g: 0x2a, b: 0x41, a: 1 }
  const fg = { r: 0x5a, g: 0x6a, b: 0x80, a: 1 }
  const sug = suggestColor(fg, bg, 4.5)
  const n = parseInt(sug.slice(1), 16)
  assert.ok(ratio({ r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }, bg) >= 4.5)
})

test('score and grade', () => {
  assert.equal(scoreOf([]), 100)
  assert.ok(scoreOf([{ impact: 'critical' }]) < scoreOf([{ impact: 'minor' }]))
  assert.equal(grade(95), 'A'); assert.equal(grade(80), 'B'); assert.equal(grade(60), 'C'); assert.equal(grade(45), 'D'); assert.equal(grade(10), 'F')
})

test('hex pads and rounds', () => assert.equal(hex({ r: 0, g: 15.4, b: 255 }), '#000fff'))
