import { useState, useCallback, useEffect } from 'react'
import { fsSet, fsGet, fsList, fsDel } from './firebase.js'

// ─── PALETTE ────────────────────────────────────────────────────────────────
const P = {
  navy:     '#1A2B5F',
  red:      '#C0282C',
  cream:    '#F8F9FC',
  gray:     '#E8ECF4',
  dGray:    '#6B7A99',
  white:    '#FFFFFF',
  green:    '#22C55E',
  amber:    '#F59E0B',
  blue:     '#3B82F6',
  purple:   '#8B5CF6',
  dark:     '#0F172A',
  darkCard: '#1E293B',
  darkBrd:  '#334155',
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function seatLabel(idx, cols) {
  return `${String.fromCharCode(65 + Math.floor(idx / cols))}${(idx % cols) + 1}`
}

function fmtMonth(m) {
  return new Date(m + '-15').toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

function zone(seat, rows) {
  const r = seat.charCodeAt(0) - 65
  return r === 0 ? 'Frente' : r >= rows - 1 ? 'Fondo' : 'Centro'
}

// ─── SMALL COMPONENTS ───────────────────────────────────────────────────────
function Spinner({ value, onChange, min, max, label, dark }) {
  const c   = dark ? P.white    : P.navy
  const bg2 = dark ? P.darkCard : P.cream
  const brd = dark ? P.darkBrd  : P.gray
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: P.dGray, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: bg2, borderRadius: 10, border: `1.5px solid ${brd}`, overflow: 'hidden' }}>
        <button onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 34, height: 34, background: 'none', border: 'none', fontSize: 18, fontWeight: 700, color: c, cursor: value <= min ? 'not-allowed' : 'pointer', opacity: value <= min ? 0.3 : 1 }}>−</button>
        <div style={{ width: 38, textAlign: 'center', fontSize: 19, fontWeight: 800, color: c, lineHeight: '34px' }}>{value}</div>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width: 34, height: 34, background: 'none', border: 'none', fontSize: 18, fontWeight: 700, color: c, cursor: value >= max ? 'not-allowed' : 'pointer', opacity: value >= max ? 0.3 : 1 }}>+</button>
      </div>
    </div>
  )
}

function Btn({ onClick, color, textColor, children, disabled, small, outline, dark }) {
  return (
    <button onClick={!disabled ? onClick : undefined} style={{
      padding:     small ? '7px 13px' : '10px 18px',
      background:  outline ? 'transparent' : disabled ? P.gray : color || P.navy,
      color:       outline ? (dark ? P.white : P.navy) : disabled ? P.dGray : textColor || P.white,
      border:      outline ? `1.5px solid ${dark ? P.darkBrd : P.gray}` : 'none',
      borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{children}</button>
  )
}

// ─── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const now      = new Date()
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [dark,        setDark]        = useState(false)
  const [tab,         setTab]         = useState('config')
  const [rows,        setRows]        = useState(5)
  const [cols,        setCols]        = useState(6)
  const [month,       setMonth]       = useState(curMonth)
  const [namesRaw,    setNamesRaw]    = useState('')
  const [groups,      setGroups]      = useState({ 'Grupo Principal': { rows: 5, cols: 6, names: '' } })
  const [activeGrp,   setActiveGrp]   = useState('Grupo Principal')
  const [newGrpName,  setNewGrpName]  = useState('')
  const [disabled,    setDisabled]    = useState(new Set())
  const [locked,      setLocked]      = useState({})
  const [assignment,  setAssignment]  = useState(null)
  const [history,     setHistory]     = useState({})
  const [highlighted, setHighlighted] = useState(null)
  const [search,      setSearch]      = useState('')
  const [editMode,    setEditMode]    = useState(false)
  const [toast,       setToast]       = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [delConfirm,  setDelConfirm]  = useState(null)

  // ── theme shortcuts ──
  const bg   = dark ? P.dark     : P.cream
  const card = dark ? P.darkCard : P.white
  const brd  = dark ? P.darkBrd  : P.gray
  const txt  = dark ? P.white    : P.navy
  const sub  = dark ? '#94A3B8'  : P.dGray

  // ── derived ──
  const total        = rows * cols
  const names        = namesRaw.split('\n').map(n => n.trim()).filter(Boolean)
  const activeSeatCt = total - disabled.size
  const diff         = names.length - activeSeatCt

  const searchIdx = search.trim().length > 1 && assignment
    ? assignment.findIndex(s => s.student?.toLowerCase().includes(search.toLowerCase()))
    : -1
  const hlIdx = searchIdx >= 0 ? searchIdx : highlighted

  const seatH   = cols <= 5 ? 66 : cols <= 7 ? 58 : cols <= 9 ? 50 : 44
  const nameFsz = cols <= 6 ? 9 : 8

  // ── toast ──
  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  // ── Load from Firestore ──
  useEffect(() => {
    ;(async () => {
      try {
        const cfg = await fsGet('config/classroom')
        if (cfg) {
          if (cfg.groups)    setGroups(cfg.groups)
          if (cfg.activeGrp) setActiveGrp(cfg.activeGrp)
          if (cfg.rows)      setRows(cfg.rows)
          if (cfg.cols)      setCols(cfg.cols)
          if (cfg.namesRaw)  setNamesRaw(cfg.namesRaw)
          if (cfg.dark != null) setDark(cfg.dark)
          if (cfg.locked)    setLocked(cfg.locked)
          if (cfg.disabled)  setDisabled(new Set(cfg.disabled))
        }
        const histDocs = await fsList('history')
        const h = {}
        histDocs.forEach(d => { h[d.id] = d.seats })
        setHistory(h)
      } catch (e) {
        showToast('Error al conectar con Firebase', 'err')
      }
      setLoading(false)
    })()
  }, [])

  // ── Save config ──
  async function saveConfig(extra = {}) {
    setSaving(true)
    try {
      await fsSet('config/classroom', {
        groups, activeGrp, rows, cols, namesRaw, dark,
        locked, disabled: [...disabled], ...extra,
      })
      showToast('Configuración guardada ☁️')
    } catch {
      showToast('Error al guardar', 'err')
    }
    setSaving(false)
  }

  // ── Assign ──
  const assign = useCallback(async () => {
    const available = Array.from({ length: total }, (_, i) => i).filter(i => !disabled.has(i))
    const lockedSeats = {}, lockedNames = new Set()
    available.forEach(i => {
      const lbl = seatLabel(i, cols)
      if (locked[lbl] && names.includes(locked[lbl])) {
        lockedSeats[i] = locked[lbl]
        lockedNames.add(locked[lbl])
      }
    })
    const freeSlots = available.filter(i => !lockedSeats[i])
    const freeNames = shuffle(names.filter(n => !lockedNames.has(n)))
    const result = Array.from({ length: total }, (_, i) => ({
      seat:    seatLabel(i, cols),
      student: disabled.has(i) ? '__disabled__' : lockedSeats[i] || null,
    }))
    freeSlots.forEach((slotIdx, fi) => { result[slotIdx].student = freeNames[fi] || null })

    setAssignment(result)
    setTab('result')
    setHighlighted(null)
    setSearch('')

    setSaving(true)
    try {
      await fsSet(`history/${month}`, {
        seats: result, group: activeGrp, savedAt: new Date().toISOString(),
      })
      setHistory(prev => ({ ...prev, [month]: result }))
      showToast('Guardado en Firebase ☁️')
    } catch {
      showToast('Error al guardar asignación', 'err')
    }
    setSaving(false)
  }, [names, total, cols, disabled, locked, month, activeGrp])

  // ── Delete history ──
  async function deleteHistory(m) {
    setSaving(true)
    try {
      await fsDel(`history/${m}`)
      setHistory(prev => { const n = { ...prev }; delete n[m]; return n })
      showToast('Registro eliminado')
    } catch {
      showToast('Error al eliminar', 'err')
    }
    setSaving(false)
    setDelConfirm(null)
  }

  // ── Copy list ──
  function copyList() {
    if (!assignment) return
    const text = assignment
      .filter(s => s.student && s.student !== '__disabled__')
      .map(s => `${s.seat}\t${s.student}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => showToast('Lista copiada 📋'))
  }

  // ── CSV import ──
  function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split(/\r?\n/).map(l => l.split(',')[0].trim()).filter(Boolean)
      setNamesRaw(lines.join('\n'))
      showToast(`${lines.length} nombres importados ✓`)
    }
    reader.readAsText(file); e.target.value = ''
  }

  // ── Status label ──
  let statusColor = sub, statusMsg = 'Agrega estudiantes a la lista'
  if (names.length > 0 && diff > 0)  { statusColor = P.red;   statusMsg = `⚠ ${diff} estudiante(s) sin asiento` }
  else if (names.length > 0 && diff < 0) { statusColor = P.amber; statusMsg = `ℹ ${Math.abs(diff)} asiento(s) vacíos` }
  else if (names.length > 0)          { statusColor = P.green; statusMsg = '✓ Lista completa' }

  // ─── LOADING SCREEN ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: P.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🏫</div>
      <div style={{ color: P.white, fontSize: 18, fontWeight: 700 }}>Cargando datos...</div>
      <div style={{ color: '#94A3B8', fontSize: 13 }}>Conectando con Firebase</div>
      <div style={{ width: 200, height: 4, background: '#1E293B', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ height: '100%', background: P.red, borderRadius: 4, animation: 'loadbar 1.5s infinite' }} />
      </div>
    </div>
  )

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: bg, color: txt, transition: 'background 0.2s' }}>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', top: 18, right: 18, zIndex: 9999,
          background: toast.type === 'ok' ? P.green : P.red,
          color: P.white, padding: '11px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          animation: 'fadein 0.2s',
        }}>{toast.msg}</div>
      )}

      {/* DELETE MODAL */}
      {delConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: card, borderRadius: 16, padding: 28, maxWidth: 340, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: txt, marginBottom: 8 }}>¿Eliminar registro?</div>
            <div style={{ fontSize: 13, color: sub, marginBottom: 20 }}>
              Se eliminará la asignación de <strong>{fmtMonth(delConfirm)}</strong> de Firebase. No se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn color={P.red} onClick={() => deleteHistory(delConfirm)}>Sí, eliminar</Btn>
              <Btn outline dark={dark} onClick={() => setDelConfirm(null)}>Cancelar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: P.navy, padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `4px solid ${P.red}` }}>
        <div>
          <div style={{ color: P.red, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 2 }}>
            UNIROMANA · Ingeniería en Sistemas
          </div>
          <div style={{ color: P.white, fontSize: 19, fontWeight: 700 }}>Asignación de Asientos</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: P.green, boxShadow: `0 0 6px ${P.green}` }} />
            <span style={{ color: P.white, fontSize: 11, fontWeight: 600 }}>Firebase</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: P.white, fontWeight: 600, fontSize: 14 }}>{fmtMonth(month)}</div>
            <div style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>{rows}×{cols} · {activeSeatCt} activos</div>
          </div>
          <button onClick={() => setDark(d => !d)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 12px', color: P.white, cursor: 'pointer', fontSize: 16 }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: card, borderBottom: `1px solid ${brd}`, display: 'flex', padding: '0 26px' }}>
        {[['config', '⚙ Configurar'], ['result', '🗺 Mapa'], ['history', '📅 Historial']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '13px 18px', border: 'none',
            borderBottom: tab === id ? `3px solid ${P.red}` : '3px solid transparent',
            background: 'transparent', color: tab === id ? P.red : sub,
            fontWeight: tab === id ? 700 : 500, fontSize: 13, cursor: 'pointer',
          }}>
            {label}
            {id === 'history' && Object.keys(history).length > 0 && (
              <span style={{ marginLeft: 6, background: P.red, color: P.white, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                {Object.keys(history).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '22px 18px' }}>

        {/* ══════════════════ CONFIG ══════════════════ */}
        {tab === 'config' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* GROUPS */}
              <div style={{ background: card, borderRadius: 14, padding: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Grupos / Materias</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {Object.keys(groups).map(g => (
                    <button key={g} onClick={() => {
                      setGroups(prev => ({ ...prev, [activeGrp]: { rows, cols, names: namesRaw } }))
                      setActiveGrp(g); setRows(groups[g].rows); setCols(groups[g].cols)
                      setNamesRaw(groups[g].names); setDisabled(new Set()); setAssignment(null)
                    }} style={{
                      padding: '5px 12px', borderRadius: 20,
                      border: `1.5px solid ${g === activeGrp ? P.red : brd}`,
                      background: g === activeGrp ? P.red : 'transparent',
                      color: g === activeGrp ? P.white : txt,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>{g}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newGrpName} onChange={e => setNewGrpName(e.target.value)}
                    placeholder="Nuevo grupo..."
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: `1.5px solid ${brd}`, background: bg, color: txt, fontSize: 12 }} />
                  <Btn small color={P.blue} onClick={() => {
                    if (!newGrpName.trim()) return
                    const g = newGrpName.trim()
                    setGroups(prev => ({ ...prev, [activeGrp]: { rows, cols, names: namesRaw }, [g]: { rows: 5, cols: 6, names: '' } }))
                    setActiveGrp(g); setRows(5); setCols(6); setNamesRaw('')
                    setNewGrpName(''); setDisabled(new Set()); setAssignment(null)
                  }}>+ Agregar</Btn>
                </div>
              </div>

              {/* GRID SIZE */}
              <div style={{ background: card, borderRadius: 14, padding: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Tamaño del Aula</div>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                  <Spinner dark={dark} value={rows} onChange={v => { setRows(v); setDisabled(new Set()); setAssignment(null) }} min={1} max={10} label="Filas" />
                  <div style={{ fontSize: 22, color: brd, fontWeight: 300, marginTop: 14 }}>×</div>
                  <Spinner dark={dark} value={cols} onChange={v => { setCols(v); setDisabled(new Set()); setAssignment(null) }} min={1} max={12} label="Columnas" />
                </div>
                <div style={{ marginTop: 14, padding: '9px 12px', background: bg, borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: 20, color: P.navy }}>{total}</span>
                  <span style={{ color: sub, marginLeft: 6, fontSize: 13 }}>asientos totales</span>
                  {disabled.size > 0 && <span style={{ color: P.red, marginLeft: 8, fontSize: 12 }}>({disabled.size} bloqueados)</span>}
                </div>
              </div>

              {/* PERIOD */}
              <div style={{ background: card, borderRadius: 14, padding: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Período</div>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${brd}`, fontSize: 14, color: txt, background: bg, boxSizing: 'border-box' }} />
              </div>

              {/* NAMES */}
              <div style={{ background: card, borderRadius: 14, padding: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.07)', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 1 }}>Estudiantes</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: diff > 0 ? '#FEE2E2' : diff < 0 ? '#FEF3C7' : names.length === 0 ? P.gray : '#DCFCE7',
                      color: diff > 0 ? P.red : diff < 0 ? '#92400E' : names.length === 0 ? P.dGray : '#166534',
                    }}>{names.length} / {activeSeatCt}</span>
                    <label style={{ fontSize: 11, fontWeight: 700, color: P.blue, cursor: 'pointer' }}>
                      📂 CSV
                      <input type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
                <textarea value={namesRaw} onChange={e => setNamesRaw(e.target.value)}
                  rows={Math.max(8, Math.min(18, names.length + 2))}
                  placeholder={'Un nombre por línea:\nAna García\nLuis Martínez\n...'}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${brd}`, fontSize: 13, color: txt, background: bg, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.8, fontFamily: 'inherit' }} />
                <div style={{ marginTop: 6, fontSize: 12, color: statusColor }}>{statusMsg}</div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn color={P.red} disabled={names.length === 0} onClick={assign}>
                    {saving ? '⏳ Guardando...' : '🎲 Asignar Aleatoriamente'}
                  </Btn>
                  <Btn small outline dark={dark} onClick={() => saveConfig()}>💾 Guardar config</Btn>
                </div>
              </div>
            </div>

            {/* PREVIEW */}
            <div style={{ background: card, borderRadius: 14, padding: 22, boxShadow: '0 2px 14px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 1 }}>Vista Previa · {rows}×{cols}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setEditMode(e => !e)} style={{
                    padding: '5px 14px', borderRadius: 20,
                    background: editMode ? P.purple : bg,
                    color: editMode ? P.white : sub,
                    border: `1.5px solid ${editMode ? P.purple : brd}`,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>{editMode ? '✏ Bloqueando...' : '✏ Editar asientos'}</button>
                  {disabled.size > 0 && (
                    <button onClick={() => setDisabled(new Set())} style={{ padding: '5px 12px', borderRadius: 20, background: 'transparent', color: P.red, border: `1.5px solid ${P.red}`, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Desbloquear todo
                    </button>
                  )}
                </div>
              </div>

              <div style={{ background: P.navy, color: P.white, borderRadius: 8, textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, marginBottom: 14, letterSpacing: 2 }}>
                ▲ PIZARRA / FRENTE
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `22px repeat(${cols},1fr)`, gap: 4, marginBottom: 3 }}>
                <div />
                {Array.from({ length: cols }, (_, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: sub, background: dark ? '#1E293B' : '#EEF1F8', borderRadius: 4, padding: '2px 0' }}>{i + 1}</div>
                ))}
              </div>
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: `22px repeat(${cols},1fr)`, gap: 4, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: sub, background: dark ? '#1E293B' : '#EEF1F8', borderRadius: 4 }}>
                    {String.fromCharCode(65 + r)}
                  </div>
                  {Array.from({ length: cols }, (_, c) => {
                    const idx = r * cols + c, isOff = disabled.has(idx)
                    return (
                      <div key={c} onClick={() => editMode && setDisabled(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })}
                        style={{ background: isOff ? (dark ? '#374151' : '#CBD5E1') : (dark ? '#1E3A5F' : '#EEF2FF'), borderRadius: 6, height: seatH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: editMode ? `1.5px dashed ${P.purple}` : `1.5px solid ${dark ? '#334155' : '#D4DAF0'}`, cursor: editMode ? 'pointer' : 'default', opacity: isOff ? 0.45 : 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: dark ? P.white : P.navy }}>{String.fromCharCode(65 + r)}{c + 1}</div>
                        {isOff && <div style={{ fontSize: 8, color: P.red, marginTop: 1 }}>✕</div>}
                      </div>
                    )
                  })}
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, color: sub, textAlign: 'center' }}>
                {editMode ? 'Clic en un asiento para bloquearlo / desbloquearlo' : `${activeSeatCt} disponibles · ${disabled.size} bloqueados`}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ RESULT ══════════════════ */}
        {tab === 'result' && (
          !assignment ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: sub }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗺</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Sin asignación activa</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Ve a Configurar y presiona "Asignar"</div>
            </div>
          ) : (
            <div>
              <div style={{ background: card, borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: txt }}>Asignación — {fmtMonth(month)}</div>
                  <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>{names.length} estudiantes · {activeGrp} · ☁️ guardado en Firebase</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Buscar estudiante..."
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${brd}`, background: bg, color: txt, fontSize: 12, width: 180 }} />
                  <Btn small color={P.amber} onClick={assign}>{saving ? '⏳' : '🔀'} Re-asignar</Btn>
                  <Btn small outline dark={dark} onClick={() => setTab('config')}>← Config</Btn>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 18 }}>
                {/* MAP */}
                <div style={{ background: card, borderRadius: 14, padding: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.07)' }}>
                  <div style={{ background: P.navy, color: P.white, borderRadius: 8, textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, marginBottom: 14, letterSpacing: 2 }}>▲ PIZARRA / FRENTE</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `22px repeat(${cols},1fr)`, gap: 4, marginBottom: 3 }}>
                    <div />
                    {Array.from({ length: cols }, (_, i) => (
                      <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: sub, background: dark ? '#1E293B' : '#EEF1F8', borderRadius: 4, padding: '2px 0' }}>{i + 1}</div>
                    ))}
                  </div>
                  {Array.from({ length: rows }, (_, r) => (
                    <div key={r} style={{ display: 'grid', gridTemplateColumns: `22px repeat(${cols},1fr)`, gap: 4, marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: sub, background: dark ? '#1E293B' : '#EEF1F8', borderRadius: 4 }}>
                        {String.fromCharCode(65 + r)}
                      </div>
                      {Array.from({ length: cols }, (_, c) => {
                        const idx = r * cols + c, seat = assignment[idx]
                        const isOff = seat?.student === '__disabled__'
                        const isSearchHL = searchIdx === idx, isHL = hlIdx === idx
                        const hasStudent = seat?.student && !isOff
                        let bg2 = dark ? '#1E3A5F' : '#EEF2FF'
                        if (isOff) bg2 = dark ? '#374151' : '#CBD5E1'
                        else if (isSearchHL) bg2 = P.blue
                        else if (isHL) bg2 = P.red
                        else if (hasStudent) bg2 = P.navy
                        return (
                          <div key={c} onClick={() => !isOff && setHighlighted(isHL ? null : idx)}
                            style={{ background: bg2, borderRadius: 7, height: seatH, cursor: isOff ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3px 2px', boxSizing: 'border-box', border: isSearchHL ? `2px solid ${P.blue}` : isHL ? `2px solid ${P.red}` : '2px solid transparent', transition: 'all 0.12s', opacity: isOff ? 0.35 : 1 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: hasStudent ? 'rgba(255,255,255,0.55)' : sub }}>{seat?.seat}</div>
                            {hasStudent ? (
                              <div style={{ fontSize: nameFsz, color: P.white, textAlign: 'center', lineHeight: 1.2, marginTop: 2, wordBreak: 'break-word' }}>
                                {seat.student.split(' ')[0]} {seat.student.split(' ')[1] || ''}
                              </div>
                            ) : isOff ? <div style={{ fontSize: 9, color: '#94A3B8' }}>✕</div> : <div style={{ fontSize: 8, color: '#BCC5DC' }}>—</div>}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: sub, flexWrap: 'wrap' }}>
                    {[[P.navy, 'Asignado'], [P.red, 'Seleccionado'], [P.blue, 'Búsqueda'], [dark ? '#374151' : '#CBD5E1', 'Bloqueado']].map(([c, l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 12, height: 12, background: c, borderRadius: 3 }} />{l}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SIDE LIST */}
                <div style={{ background: card, borderRadius: 14, padding: 18, boxShadow: '0 2px 14px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[['Asignados', names.length, P.navy], ['Vacíos', activeSeatCt - names.length, P.amber], ['Bloqueados', disabled.size, P.red], ['Total', total, P.blue]].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center', padding: '8px 4px', background: bg, borderRadius: 8 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: c }}>{v}</div>
                        <div style={{ fontSize: 10, color: sub, marginTop: 1 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 1 }}>Lista por fila</div>
                  <div style={{ overflowY: 'auto', flex: 1, maxHeight: 340 }}>
                    {Array.from({ length: rows }, (_, r) => {
                      const rowSeats = assignment.slice(r * cols, (r + 1) * cols).filter(s => s.student && s.student !== '__disabled__')
                      if (!rowSeats.length) return null
                      return (
                        <div key={r}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: P.red, marginBottom: 3, marginTop: r > 0 ? 8 : 0 }}>Fila {String.fromCharCode(65 + r)}</div>
                          {rowSeats.map((s, i) => {
                            const idx2 = assignment.findIndex(a => a.seat === s.seat), isHL2 = hlIdx === idx2
                            return (
                              <div key={i} onClick={() => setHighlighted(isHL2 ? null : idx2)}
                                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 7px', borderRadius: 8, marginBottom: 2, background: isHL2 ? `${P.red}18` : 'transparent', cursor: 'pointer' }}>
                                <div style={{ minWidth: 32, height: 32, background: isHL2 ? P.red : P.navy, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: P.white }}>
                                  {s.seat}
                                </div>
                                <div style={{ fontSize: 12, color: txt, fontWeight: 500 }}>{s.student}</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                  <Btn color={P.green} onClick={copyList}>📋 Copiar lista</Btn>
                </div>
              </div>
            </div>
          )
        )}

        {/* ══════════════════ HISTORY ══════════════════ */}
        {tab === 'history' && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: txt, marginBottom: 16 }}>Historial guardado en Firebase ☁️</div>
            {Object.keys(history).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: sub }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Sin historial aún</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Las asignaciones se guardan automáticamente</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {Object.entries(history).sort(([a], [b]) => b.localeCompare(a)).map(([m, seats]) => {
                  const assigned = seats.filter(s => s.student && s.student !== '__disabled__')
                  return (
                    <div key={m} style={{ background: card, borderRadius: 14, padding: 20, boxShadow: '0 2px 14px rgba(0,0,0,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: txt }}>{fmtMonth(m)}</div>
                          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{assigned.length} estudiantes</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn small color={P.navy} onClick={() => { setAssignment(seats); setTab('result') }}>Ver mapa</Btn>
                          <Btn small color={P.red} onClick={() => setDelConfirm(m)}>🗑 Eliminar</Btn>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 3 }}>
                        {seats.map((s, i) => {
                          const isOff = s.student === '__disabled__', has = s.student && !isOff
                          return (
                            <div key={i} title={has ? `${s.seat}: ${s.student}` : s.seat}
                              style={{ background: isOff ? '#CBD5E1' : has ? P.navy : '#EEF2FF', borderRadius: 4, height: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: isOff ? 0.35 : 1 }}>
                              <div style={{ fontSize: 7, fontWeight: 700, color: has ? 'rgba(255,255,255,0.6)' : sub }}>{s.seat}</div>
                              {has && <div style={{ fontSize: 6, color: P.white }}>{s.student.split(' ')[0].slice(0, 5)}</div>}
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                        {['Frente', 'Centro', 'Fondo'].map(z => {
                          const count = seats.filter(s => s.student && s.student !== '__disabled__' && zone(s.seat, rows) === z).length
                          return (
                            <div key={z} style={{ flex: 1, background: bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: txt }}>{count}</div>
                              <div style={{ fontSize: 10, color: sub }}>{z}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
