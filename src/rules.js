// A small WCAG rules engine. It runs on a live document (the preview iframe) so computed styles are real.
export const IMPACT_WEIGHT = { critical: 12, serious: 7, moderate: 3, minor: 1 }
export const scoreOf = (issues) => Math.round(100 * Math.exp(-issues.reduce((s, i) => s + IMPACT_WEIGHT[i.impact], 0) / 142))
export const grade = (n) => (n >= 90 ? 'A' : n >= 75 ? 'B' : n >= 60 ? 'C' : n >= 40 ? 'D' : 'F')

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
const snippet = (el) => {
  const clone = el.cloneNode(false)
  clone.removeAttribute('data-ac')
  let s = clone.outerHTML.replace(/<\/[^>]+>$/, '')
  const inner = text(el)
  if (inner && !/^<(img|input|br|hr|meta)/i.test(s)) s += inner.length > 40 ? inner.slice(0, 40) + '...' : inner
  return s.length > 140 ? s.slice(0, 140) + '...' : s
}

function accessibleName(el, doc) {
  const aria = el.getAttribute('aria-label')
  if (aria && aria.trim()) return aria.trim()
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const t = by.split(/\s+/).map((id) => doc.getElementById(id)).filter(Boolean).map(text).join(' ').trim()
    if (t) return t
  }
  const imgAlt = [...el.querySelectorAll('img[alt]')].map((i) => i.getAttribute('alt')).join(' ').trim()
  return text(el) || imgAlt || (el.getAttribute('title') || '').trim()
}

function parseColor(s) {
  const m = s && s.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat)
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined || isNaN(p[3]) ? 1 : p[3] }
}
const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
const lum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
export const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

function backgroundOf(el, win) {
  let stack = [], n = el
  while (n && n.nodeType === 1) {
    const c = parseColor(win.getComputedStyle(n).backgroundColor)
    if (c && c.a > 0) { stack.push(c); if (c.a === 1) break }
    n = n.parentElement
  }
  let bg = { r: 255, g: 255, b: 255, a: 1 }
  for (const c of stack.reverse()) bg = blend(c, bg)
  return bg
}

// Pick the nearest color from the same hue family that reaches the target ratio, for the suggested fix.
export function suggestColor(fg, bg, target) {
  const dark = lum(bg) > 0.4
  for (let i = 0; i <= 100; i++) {
    const t = i / 100
    const c = dark
      ? { r: fg.r * (1 - t), g: fg.g * (1 - t), b: fg.b * (1 - t), a: 1 }
      : { r: fg.r + (255 - fg.r) * t, g: fg.g + (255 - fg.g) * t, b: fg.b + (255 - fg.b) * t, a: 1 }
    if (ratio(c, bg) >= target) return hex(c)
  }
  return dark ? '#000000' : '#ffffff'
}

export function audit(doc) {
  const win = doc.defaultView
  const issues = []
  const all = [...doc.querySelectorAll('*')]
  const add = (rule, el, extra = {}) => issues.push({ ...rule, el, idx: all.indexOf(el), snippet: el ? snippet(el) : '', ...extra })

  const R = {
    imgAlt: { id: 'image-alt', impact: 'critical', wcag: '1.1.1', title: 'Image has no alt text', why: 'Screen reader users hear the file name or nothing at all.', fix: 'Describe the image in alt="...". If it is purely decorative, use alt="".', ask: { kind: 'alt', label: 'Alt text', ph: 'Describe the image', skip: 'Mark decorative' } },
    label: { id: 'form-label', impact: 'critical', wcag: '1.3.1, 4.1.2', title: 'Form field has no label', why: 'Without a label, assistive tech cannot tell the user what to type, and placeholders disappear.', fix: 'Add a <label for="id"> that points at the field, or an aria-label.', ask: { kind: 'aria-label', label: 'Label', ph: 'What is this field for?' } },
    btn: { id: 'button-name', impact: 'critical', wcag: '4.1.2', title: 'Button has no accessible name', why: 'An icon-only button is announced as just "button".', fix: 'Add visible text or aria-label="What it does".', ask: { kind: 'aria-label', label: 'Name', ph: 'What does it do?' } },
    link: { id: 'link-name', impact: 'serious', wcag: '2.4.4', title: 'Link has no accessible name', why: 'Screen readers read out the raw URL instead of where the link goes.', fix: 'Add link text or aria-label to describe the destination.', ask: { kind: 'aria-label', label: 'Link name', ph: 'Where does it go?' } },
    contrast: { id: 'color-contrast', impact: 'serious', wcag: '1.4.3', title: 'Text contrast is too low', why: 'People with low vision or in bright light cannot read this text.', fix: '', auto: 'contrast' },
    lang: { id: 'html-lang', impact: 'serious', wcag: '3.1.1', title: 'Page language is not set', why: 'Screen readers pick the wrong pronunciation rules without a language.', fix: 'Add lang="en" (or your language) to the <html> tag.', auto: 'lang' },
    title: { id: 'document-title', impact: 'serious', wcag: '2.4.2', title: 'Page has no title', why: 'The title is the first thing a screen reader announces and the tab label.', fix: 'Add a short, unique <title> in the <head>.', auto: 'title' },
    h1: { id: 'page-has-h1', impact: 'moderate', wcag: '1.3.1', title: 'Page has no main heading', why: 'An h1 tells users what the page is about and is a landmark for navigation.', fix: 'Add one <h1> that names the page.' },
    order: { id: 'heading-order', impact: 'moderate', wcag: '1.3.1', title: 'Heading levels skip', why: 'Skipped levels break the outline that screen reader users navigate by.', fix: 'Use heading levels in order (h1, then h2, then h3). Style size with CSS instead.' },
    dup: { id: 'duplicate-id', impact: 'serious', wcag: '4.1.1', title: 'Duplicate id', why: 'Labels and ARIA references point at the first match only, so the others break.', fix: 'Make every id unique.', auto: 'dup' },
    tab: { id: 'tabindex-positive', impact: 'serious', wcag: '2.4.3', title: 'Positive tabindex', why: 'It overrides the natural tab order and makes keyboard navigation jump around.', fix: 'Use tabindex="0" or remove it, and order elements properly in the HTML.', auto: 'tab' },
    vague: { id: 'link-purpose', impact: 'moderate', wcag: '2.4.4', title: 'Vague link text', why: 'Screen reader users often list all links. "Click here" says nothing out of context.', fix: 'Say where it goes, for example "Read the pricing guide".' },
    zoom: { id: 'meta-viewport', impact: 'critical', wcag: '1.4.4', title: 'Pinch zoom is disabled', why: 'Low-vision users on phones need to zoom in.', fix: 'Remove user-scalable=no and maximum-scale from the viewport meta tag.', auto: 'zoom' },
    table: { id: 'table-headers', impact: 'serious', wcag: '1.3.1', title: 'Data table has no header cells', why: 'Screen readers cannot tell which column or row a cell belongs to.', fix: 'Use <th scope="col"> for the header row.', auto: 'table' },
    media: { id: 'no-autoplay', impact: 'serious', wcag: '1.4.2', title: 'Media autoplays without controls', why: 'Sudden sound blocks screen readers and cannot be stopped.', fix: 'Remove autoplay, or add controls and muted.', auto: 'media' },
    hidden: { id: 'aria-hidden-focus', impact: 'serious', wcag: '4.1.2', title: 'Hidden element can still be focused', why: 'Keyboard users land on something that screen readers cannot see.', fix: 'Remove aria-hidden, or add tabindex="-1" to the focusable content.', auto: 'hidden' },
    main: { id: 'landmark-main', impact: 'minor', wcag: '1.3.1', title: 'No <main> landmark', why: 'Landmarks let keyboard users skip straight to the content.', fix: 'Wrap the primary content in <main>.' },
  }

  const $$ = (s) => [...doc.querySelectorAll(s)]

  $$('img:not([alt])').forEach((el) => add(R.imgAlt, el))
  $$('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea').forEach((el) => {
    const id = el.id
    const lab = (id && doc.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest('label')
    if (!(lab && text(lab)) && !accessibleName(el, doc)) add(R.label, el)
  })
  $$('button, [role=button]').forEach((el) => { if (!accessibleName(el, doc) && !(el.value || '').trim()) add(R.btn, el) })
  $$('a[href]').forEach((el) => {
    const name = accessibleName(el, doc)
    if (!name) add(R.link, el)
    else if (/^(click here|here|read more|more|learn more|link|this)$/i.test(name)) add(R.vague, el)
  })

  const seen = new Map()
  $$('[id]').forEach((el) => { const id = el.id; if (seen.has(id)) add(R.dup, el, { title: `Duplicate id "${id}"` }); else seen.set(id, el) })
  $$('[tabindex]').forEach((el) => { if (parseInt(el.getAttribute('tabindex'), 10) > 0) add(R.tab, el) })
  $$('[aria-hidden=true]').forEach((el) => {
    const focusable = el.matches('a[href],button,input,select,textarea,[tabindex]') || el.querySelector('a[href],button,input,select,textarea,[tabindex]')
    if (focusable && el.getAttribute('tabindex') !== '-1') add(R.hidden, el)
  })
  $$('table').forEach((el) => { if (!el.querySelector('th')) add(R.table, el) })
  $$('video[autoplay], audio[autoplay]').forEach((el) => { if (!el.hasAttribute('controls') && !el.muted && !el.hasAttribute('muted')) add(R.media, el) })

  const vp = doc.querySelector('meta[name=viewport]')
  if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*(0?\.\d+|1(\.0)?)\b/i.test(vp.getAttribute('content') || '')) add(R.zoom, vp)
  if (!doc.documentElement.getAttribute('lang')) add(R.lang, doc.documentElement)
  if (!text(doc.querySelector('title') || { textContent: '' })) add(R.title, doc.head || doc.documentElement)

  const heads = $$('h1,h2,h3,h4,h5,h6')
  if (!heads.some((h) => h.tagName === 'H1')) add(R.h1, doc.body)
  let prev = 0
  heads.forEach((h) => {
    const lv = +h.tagName[1]
    if (prev && lv > prev + 1) add(R.order, h, { title: `Heading jumps from h${prev} to h${lv}` })
    prev = lv
  })
  if (!doc.querySelector('main, [role=main]') && doc.body.children.length > 2) add(R.main, doc.body)

  // Contrast: only elements that own text.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const done = new Set()
  while (walker.nextNode()) {
    const n = walker.currentNode, el = n.parentElement
    if (!el || done.has(el) || !n.textContent.trim() || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue
    done.add(el)
    const cs = win.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const fg0 = parseColor(cs.color), bg = backgroundOf(el, win)
    if (!fg0) continue
    const fg = blend({ ...fg0, a: fg0.a * parseFloat(cs.opacity || 1) }, bg)
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const need = large ? 3 : 4.5
    const r = ratio(fg, bg)
    if (r < need) {
      const sug = suggestColor(fg, bg, need)
      add(R.contrast, el, {
        title: `Text contrast is ${r.toFixed(2)}:1, needs ${need}:1`,
        fix: `Change the text color from ${hex(fg)} to ${sug} (or darker/lighter) on the ${hex(bg)} background.`,
        meta: { fg: hex(fg), bg: hex(bg), r, need, sug },
      })
    }
  }

  const score = scoreOf(issues)
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  issues.forEach((i) => counts[i.impact]++)
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 }
  issues.sort((a, b) => order[a.impact] - order[b.impact])
  return { issues, score, counts }
}

// One-click fixes. `list` is a snapshot of the document's elements taken once, so several fixes can run on one
// document without the indexes shifting. `value` is the text the user typed for fixes that need words.
const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]'
export function applyFix(doc, issue, value, list = [...doc.querySelectorAll('*')]) {
  const el = list[issue.idx]
  const kind = issue.auto || issue.ask?.kind
  switch (kind) {
    case 'lang': doc.documentElement.setAttribute('lang', 'en'); return true
    case 'title': { const t = doc.createElement('title'); t.textContent = 'Page title'; (doc.head || doc.documentElement).prepend(t); return true }
    case 'tab': el.setAttribute('tabindex', '0'); return true
    case 'dup': { let n = 2; while (doc.getElementById(el.id + '-' + n)) n++; el.id = el.id + '-' + n; return true }
    case 'zoom': el.setAttribute('content', (el.getAttribute('content') || '').replace(/,?\s*(user-scalable|maximum-scale)\s*=\s*[^,]+/gi, '').replace(/^,\s*/, '')); return true
    case 'contrast': if (!issue.meta) return false; el.style.color = issue.meta.sug; return true
    case 'media': el.setAttribute('controls', ''); el.setAttribute('muted', ''); el.muted = true; return true
    case 'hidden': (el.matches(FOCUSABLE) ? [el] : [...el.querySelectorAll(FOCUSABLE)]).forEach((e) => e.setAttribute('tabindex', '-1')); return true
    case 'table': {
      const row = el.querySelector('tr'); if (!row) return false
      ;[...row.children].forEach((c) => { if (c.tagName !== 'TD') return; const th = doc.createElement('th'); th.setAttribute('scope', 'col'); th.innerHTML = c.innerHTML; row.replaceChild(th, c) })
      return true
    }
    case 'alt': if (value == null) return false; el.setAttribute('alt', value); return true
    case 'aria-label': if (!value || !value.trim()) return false; el.setAttribute('aria-label', value.trim()); return true
    default: return false
  }
}
export const serialize = (doc) => '<!doctype html>\n' + doc.documentElement.outerHTML

/** Apply every fix that needs no typing. Returns the new source and how many fixes ran. */
export function applyAllMechanical(source, issues) {
  const doc = new DOMParser().parseFromString(source, 'text/html')
  const list = [...doc.querySelectorAll('*')]
  let n = 0
  for (const i of issues) if (i.auto && applyFix(doc, i, undefined, list)) n++
  return { source: serialize(doc), count: n }
}

export function toMarkdown(result, name = 'page') {
  const L = [`# Accessibility report: ${name}`, '', `Score ${result.score}/100 (grade ${grade(result.score)}). ${result.issues.length} issues: ${Object.entries(result.counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`, '']
  for (const i of result.issues) {
    L.push(`## [${i.impact}] ${i.title}`, `WCAG ${i.wcag} (${i.id})`, '', '```html', i.snippet, '```', '', `Why: ${i.why}`, `Fix: ${i.fix}`, '')
  }
  L.push('Automated checks find only part of the problems. Test with a keyboard and a screen reader too.')
  return L.join('\n')
}
