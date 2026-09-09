// Ricerca globale (modale dalla home): un solo campo su esercizi e schede.
//
// L'indice è piatto e ricostruito solo quando cambia lo store, non a ogni tasto:
// filtrare un array già pronto è immediato, ricostruirlo no. `norm` toglie
// accenti e maiuscole, così "perche" trova "perché".
// Ogni risultato porta con sé la propria azione (`run`), quindi la lista non
// deve sapere nulla dei tipi che contiene.
import { useState, useMemo, useEffect, useRef } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { JModal } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useT, useTData } from '@/lib/i18n'

interface Result {
  label: string
  sub?: string
  run: () => void
}

// Normalizza per una ricerca tollerante ad accenti e maiuscole.
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
  onOpenGym: () => void
}

export function GlobalSearch({ open, onClose, onOpenGym }: GlobalSearchProps) {
  const t = useT()
  const tData = useTData()
  const s = useJarvisStore(useShallow(st => ({
    palestra: st.palestraExercises, hyrox: st.hyroxExercises, schede: st.gymSchede,
  })))
  const isDesktop = useIsDesktop()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 60) } }, [open])

  // Indice piatto di tutto il ricercabile nell'app.
  const index = useMemo<Result[]>(() => {
    const out: Result[] = []
    // Nomi ed etichette si traducono qui, all'indicizzazione: la ricerca lavora
    // sul testo che l'utente VEDE, quindi in tedesco "Brust" deve trovare gli
    // esercizi di petto. `t` e `tData` fra le dipendenze rifanno l'indice al
    // cambio lingua.
    s.palestra.forEach(e => out.push({ label: tData(e.n), sub: tData(e.muscle), run: () => onOpenGym() }))
    s.hyrox.forEach(e => out.push({ label: tData(e.n), sub: t('Hyrox'), run: () => onOpenGym() }))
    s.schede.forEach(sc => out.push({ label: sc.title, sub: t('Scheda'), run: () => onOpenGym() }))
    return out
  }, [s, onOpenGym, t, tData])

  const results = useMemo(() => {
    const nq = norm(q.trim())
    if (!nq) return []
    return index.filter(r => norm(r.label).includes(nq) || (r.sub && norm(r.sub).includes(nq))).slice(0, 40)
  }, [q, index])

  const pick = (r: Result) => { r.run(); onClose() }

  return (
    <JModal open={open} onClose={onClose} title={t('Ricerca globale')} width={isDesktop ? 520 : 340}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: NUC.faint, pointerEvents: 'none', display: 'flex' }}>
            <Icons.search size={15} stroke={1.8}/>
          </span>
          <input
            ref={inputRef}
            className="j-field"
            style={{ paddingLeft: 36 }}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('Cerca esercizi, schede…')}
          />
        </div>

        <div style={{ maxHeight: isDesktop ? 420 : 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {q.trim() && results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0', fontFamily: NUC.font, fontSize: 13, color: NUC.faint }}>
              {t('Nessun risultato per “{q}”', { q: q.trim() })}
            </div>
          )}
          {!q.trim() && (
            <div style={{ textAlign: 'center', padding: '28px 12px', fontFamily: NUC.font, fontSize: 13, color: NUC.faint, lineHeight: 1.6 }}>
              {t('Scrivi per cercare in tutta l’app —')}<br/>{t('esercizi e schede d’allenamento.')}
            </div>
          )}
          {results.map((r, i) => (
              <button
                key={`${r.label}-${i}`}
                onClick={() => pick(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
                  padding: '9px 10px', borderRadius: 0, cursor: 'pointer',
                  background: 'var(--surface)', border: `1px solid ${NUC.hairline}`,
                  transition: 'background var(--motion-fast) var(--ease)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim }}>
                  <Icons.weight size={15} stroke={1.7}/>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 14, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  {r.sub && <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: NUC.faint, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</span>}
                </span>
                <Icons.chev size={14} stroke={1.8} color={NUC.faint}/>
              </button>
          ))}
        </div>
      </div>
    </JModal>
  )
}
