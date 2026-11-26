import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { audit, applyFix, applyAllMechanical, serialize, grade, toMarkdown } from './rules.js'
import { SAMPLES } from './sample.js'

const KEY = 'accessicheck:v1'
const IMPACT = {
  critical: { label: 'Critical', color: '#d6264f' },
  serious: { label: 'Serious', color: '#c76a00' },
  moderate: { label: 'Moderate', color: '#3b34c9' },
  minor: { label: 'Minor', color: '#5b6275' },
}
const HL_CSS = `
[data-ac-sev]{outline:3px dashed var(--ac,#d6264f)!important;outline-offset:2px!important}
[data-ac-sel]{outline:4px solid #ffd23f!important;box-shadow:0 0 0 6px #14123a!important;position:relative;z-index:9}
`

const store = {
  get: () => { try { return localStorage.getItem(KEY) } catch { return null } },
  set: (v) => { try { localStorage.setItem(KEY, v) } catch { /* private mode */ } },
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Ring({ score }) {
  const r = 52, c = 2 * Math.PI * r
  const col = score >= 75 ? '#14804a' : score >= 50 ? '#c76a00' : '#d6264f'
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`Accessibility score ${score} out of 100, grade ${grade(score)}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e7e4f5" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style="transition:stroke-dashoffset .6s" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><div className="serif text-4xl font-extrabold leading-none" data-testid="score">{score}</div><div className="text-xs font-semibold mt-1">Grade {grade(score)}</div></div>
      </div>
    </div>
  )
}

export default function App() {
  const names = Object.keys(SAMPLES)
  const [source, setSource] = useState(() => store.get() || SAMPLES[names[0]])
  const [live, setLive] = useState(source)
  const [result, setResult] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState(null)
  const [showAll, setShowAll] = useState(true)
  const frame = useRef(null)
  const fileIn = useRef(null)
  const [undo, setUndo] = useState([])
  const [note, setNote] = useState('')
  const [typed, setTyped] = useState('')
  const prevScore = useRef(null)

  useEffect(() => { const t = setTimeout(() => { setLive(source); store.set(source) }, 500); return () => clearTimeout(t) }, [source])

  const run = () => {
    const doc = frame.current?.contentDocument
    if (!doc || !doc.body) return
    const res = audit(doc)
    const st = doc.createElement('style'); st.textContent = HL_CSS; doc.head.appendChild(st)
    setSel(null)
    setResult(res)
  }

  // paint highlights whenever results, toggle or selection change
  useEffect(() => {
    const doc = frame.current?.contentDocument
    if (!doc || !result) return
    doc.querySelectorAll('[data-ac-sev],[data-ac-sel]').forEach((e) => { e.removeAttribute('data-ac-sev'); e.removeAttribute('data-ac-sel'); e.style.removeProperty('--ac') })
    if (showAll) result.issues.forEach((i) => { if (i.el && i.el !== doc.body && i.el !== doc.documentElement && i.el !== doc.head) { i.el.setAttribute('data-ac-sev', i.impact); i.el.style.setProperty('--ac', IMPACT[i.impact].color) } })
    if (sel !== null) {
      const it = result.issues[sel]
      if (it?.el && it.el !== doc.body && it.el !== doc.documentElement && it.el !== doc.head) { it.el.setAttribute('data-ac-sel', ''); it.el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
    }
  }, [result, showAll, sel])

  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 3500) }
  const change = (next, msg) => {
    setUndo((u) => [...u.slice(-19), source])
    prevScore.current = result ? result.score : null
    setSource(next); setLive(next); store.set(next)
    if (msg) flash(msg)
  }
  const fix = (i, value) => {
    const d = new DOMParser().parseFromString(source, 'text/html')
    if (applyFix(d, i, value)) { change(serialize(d), 'Fix applied.'); setTyped('') }
  }
  const fixAll = () => {
    const r = applyAllMechanical(source, result.issues)
    if (r.count) change(r.source, `${r.count} fixes applied.`)
  }
  const undoLast = () => {
    const prev = undo[undo.length - 1]
    if (prev == null) return
    setUndo(undo.slice(0, -1)); setSource(prev); setLive(prev); store.set(prev); flash('Undone.')
  }
  const load = (txt) => { change(txt); setSel(null); setFilter('all') }
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    if (f.size > 1_000_000) return flash('That file is over 1 MB. Paste a smaller page.')
    load(await f.text()); flash(`Loaded ${f.name}.`)
  }
  const copyHtml = async () => { try { await navigator.clipboard.writeText(source); flash('HTML copied.') } catch { flash('Copy was blocked by the browser.') } }
  const mechanical = result ? result.issues.filter((i) => i.auto).length : 0

  const shown = useMemo(() => (result ? result.issues.map((i, n) => ({ i, n })).filter(({ i }) => filter === 'all' || i.impact === filter) : []), [result, filter])

  return (
    <div className="min-h-screen">
      <a href="#issues" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:bg-hl focus:p-2">Skip to issues</a>
      <header className="bg-night text-white">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-hl text-night text-xl font-extrabold serif">A</span><span className="serif text-2xl font-extrabold">AccessiCheck</span></div>
          <p className="hidden sm:block text-sm text-white/70">Runs entirely in your browser. Nothing is uploaded.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8">
        <h1 className="serif text-4xl md:text-5xl font-extrabold leading-tight max-w-3xl">See exactly where your page fails people, then fix it.</h1>
        <p className="mt-3 max-w-2xl text-night/75">Paste HTML. Every WCAG problem is outlined in the live preview, explained in plain words, and the mechanical ones fix with one click.</p>

        <section className="mt-6 grid gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-night/10 md:grid-cols-[auto_1fr] items-center" aria-label="Summary">
          <Ring score={result ? result.score : 0} />
          <div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by impact">
              <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${filter === 'all' ? 'bg-night text-white border-night' : 'bg-white border-night/20'}`}>All {result ? result.issues.length : 0}</button>
              {Object.entries(IMPACT).map(([k, v]) => (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${filter === k ? 'text-white' : 'bg-white'}`} style={{ borderColor: v.color, background: filter === k ? v.color : undefined, color: filter === k ? undefined : v.color }}>{v.label} {result ? result.counts[k] : 0}</button>
              ))}
            </div>
            <p className="mt-3 text-sm text-night/70">{result ? (result.issues.length === 0 ? 'No problems found by these checks. Automated checks catch roughly a third of issues, so still test with a keyboard.' : `${result.issues.length} problems found. Select one to jump to it in the preview.`) : 'Running the audit...'}</p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 items-start">
          <div className="space-y-6">
            <section aria-label="HTML source">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="src" className="serif text-xl font-extrabold">Your HTML</label>
                <div className="flex gap-2 flex-wrap">
                  {names.map((n) => <button key={n} onClick={() => load(SAMPLES[n])} className="rounded-lg border border-night/20 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-hl/40">{n}</button>)}
                </div>
              </div>
              <textarea id="src" spellcheck={false} value={source} onInput={(e) => setSource(e.target.value)} className="mono mt-2 h-72 w-full resize-y rounded-xl border-2 border-night/20 bg-night p-3 text-[13px] leading-relaxed text-[#e8e6ff]" />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
                <button onClick={fixAll} disabled={!mechanical} className="rounded-lg bg-indigo px-3 py-1.5 text-white disabled:opacity-40">Fix all one-click issues ({mechanical})</button>
                <button onClick={undoLast} disabled={!undo.length} className="rounded-lg border border-night/20 bg-white px-3 py-1.5 disabled:opacity-40">Undo</button>
                <button onClick={copyHtml} className="rounded-lg border border-night/20 bg-white px-3 py-1.5">Copy HTML</button>
                <button onClick={() => download('fixed.html', source, 'text/html')} className="rounded-lg border border-night/20 bg-white px-3 py-1.5">Download HTML</button>
                <button onClick={() => fileIn.current.click()} className="rounded-lg border border-night/20 bg-white px-3 py-1.5">Open file</button>
                <input ref={fileIn} type="file" accept=".html,.htm,text/html" onChange={onFile} className="sr-only" aria-label="Open an HTML file" tabIndex={-1} />
              </div>
              <p role="status" aria-live="polite" className="mt-1 h-5 text-sm font-semibold text-ok">{note}{!note && result && prevScore.current != null && prevScore.current !== result.score ? `Score ${prevScore.current} to ${result.score}.` : ''}</p>
            </section>

            <section id="issues" aria-label="Issues">
              <div className="flex items-center justify-between gap-2"><h2 className="serif text-xl font-extrabold">Issues</h2>{result && result.issues.length > 0 && <button onClick={() => download('accessibility-report.md', toMarkdown(result), 'text/markdown')} className="rounded-lg border border-night/20 bg-white px-3 py-1.5 text-sm font-semibold">Download report</button>}</div>
              {shown.length === 0 && result && <p className="mt-3 rounded-xl bg-white p-4 ring-1 ring-night/10">Nothing to show for this filter.</p>}
              <ul className="mt-3 space-y-3">
                {shown.map(({ i, n }) => (
                  <li key={n + i.id + i.idx} className={`rounded-xl bg-white ring-1 ${sel === n ? 'ring-2 ring-indigo' : 'ring-night/10'}`}>
                    <button onClick={() => { setTyped(''); setSel(sel === n ? null : n) }} aria-expanded={sel === n} className="flex w-full items-start gap-3 p-4 text-left">
                      <span className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: IMPACT[i.impact].color }}>{IMPACT[i.impact].label}</span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold">{i.title}</span><span className="mono mt-0.5 block text-xs text-night/60">WCAG {i.wcag} - {i.id}</span></span>
                    </button>
                    {sel === n && (
                      <div className="border-t border-night/10 px-4 pb-4 pt-3 text-sm space-y-3">
                        <p className="mono break-all rounded-md bg-night/5 p-2 text-xs">{i.snippet}</p>
                        <p><strong>Why it matters.</strong> {i.why}</p>
                        <p><strong>How to fix.</strong> {i.fix}</p>
                        {i.meta && <div className="flex items-center gap-3 text-xs"><span className="rounded px-2 py-1 mono" style={{ background: i.meta.bg, color: i.meta.fg, border: '1px solid #0002' }}>Now {i.meta.r.toFixed(2)}:1</span><span className="rounded px-2 py-1 mono" style={{ background: i.meta.bg, color: i.meta.sug, border: '1px solid #0002' }}>Fixed</span></div>}
                        {i.auto && <button onClick={() => fix(i)} className="rounded-lg bg-indigo px-4 py-2 font-semibold text-white">{i.auto === 'contrast' ? `Use ${i.meta.sug}` : 'Apply fix to my HTML'}</button>}
                        {i.ask && (
                          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) fix(i, typed) }} className="flex flex-wrap items-center gap-2">
                            <label className="font-semibold" htmlFor={`ask-${n}`}>{i.ask.label}</label>
                            <input id={`ask-${n}`} value={typed} onInput={(e) => setTyped(e.target.value)} placeholder={i.ask.ph} className="min-w-0 flex-1 rounded-lg border-2 border-night/20 px-3 py-1.5" />
                            <button disabled={!typed.trim()} className="rounded-lg bg-indigo px-4 py-2 font-semibold text-white disabled:opacity-40">Apply</button>
                            {i.ask.skip && <button type="button" onClick={() => fix(i, '')} className="rounded-lg border border-night/20 px-3 py-2 font-semibold">{i.ask.skip}</button>}
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="lg:sticky lg:top-4" aria-label="Live preview">
            <div className="flex items-center justify-between">
              <h2 className="serif text-xl font-extrabold">Live preview</h2>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 accent-indigo" /> Outline all problems</label>
            </div>
            <iframe ref={frame} title="Preview of your HTML with problems outlined" sandbox="allow-same-origin" srcDoc={live} onLoad={run} className="mt-2 h-[560px] w-full rounded-xl border-2 border-night/20 bg-white" />
            <p className="mt-2 text-xs text-night/60">Scripts are disabled in the preview. Dashed outlines show problems by impact color; the yellow outline is the one you selected.</p>
          </section>
        </div>
      </main>
      <footer className="mt-10 bg-night text-white/70"><p className="max-w-7xl mx-auto px-5 py-4 text-xs">AccessiCheck - a demo by Malak Mohamed. 17 rules covering WCAG 1.1.1 to 4.1.2. Automated testing finds only part of the problems.</p></footer>
    </div>
  )
}
