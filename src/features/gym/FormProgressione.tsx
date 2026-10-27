// La progressione di una riga, nel form della scheda (vedi progressioneScheda).
// Tre preset — multiarticolare, mono grande, mono piccola — che sono il
// suggerimento; i carichi che ci sono davvero (un passo fisso, o la lista dei
// manubri e del pacco pesi); e «Personalizza» per cambiare modello e numeri.
import { useEffect, useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { Interruttore } from '@/components/ui/NucComponents'
import { useT } from '@/lib/i18n'
import type { ProgressioneRiga } from '@/store/useJarvisStore'
import type { LoadSteps } from './progression'
import { fmtNum, parseNum } from './gymModel'
import { conPreset, conModello, rangeConsigliato, leggiLista, PASSO_FISSO, LISTA_MANUBRI, PRESET_FISSI, type PresetFisso } from './progressioneScheda'

const ETICHETTA: CSSProperties = {
  fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 6,
}
const SPIEGA: CSSProperties = { fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.45, color: 'var(--fg-mute)', marginTop: 6 }

/** Una fila di scelte col bordo d'inchiostro: quella accesa è piena. Le
 *  larghezze seguono le parole: a 320px «Multiarticolare», che non va a capo,
 *  in un terzo di riga non ci stava. */
function Scelte<T extends string>({ valori, etichette, attivo, onScegli, etichetta }: {
  valori: readonly T[]; etichette: Record<T, string>; attivo: T | null; onScegli: (v: T) => void; etichetta: string
}) {
  return (
    <div role="group" aria-label={etichetta} className="flex" style={{ border: 'var(--bordo)' }}>
      {valori.map((v, i) => (
        <button key={v} type="button" onClick={() => onScegli(v)} aria-pressed={attivo === v} className="j-focus" style={{
          flex: '1 1 auto', minWidth: 0, minHeight: 44, padding: '4px 5px', cursor: 'pointer', border: 'none', borderLeft: i === 0 ? 'none' : 'var(--bordo)',
          background: attivo === v ? 'var(--ink)' : 'var(--surface)', color: attivo === v ? 'var(--surface)' : NUC.ink,
          fontFamily: NUC.display, fontSize: 'clamp(11px, 3.4vw, 13px)', fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', lineHeight: 1.1,
        }}>
          {etichette[v]}
        </button>
      ))}
    </div>
  )
}

/** Un numero da scrivere a mano. Il testo resta com'è battuto ("2," a metà di
 *  "2,5"); al resto del form arriva il numero, e solo quando è un numero. */
function CampoNumero({ etichetta, valore, onChange, facoltativo }: {
  etichetta: string; valore: number | undefined; onChange: (n: number | undefined) => void; facoltativo?: boolean
}) {
  const [testo, setTesto] = useState(valore === undefined ? '' : fmtNum(valore))
  // Cambiato da fuori (un preset scelto): il campo si riallinea.
  useEffect(() => {
    setTesto(tt => (parseNum(tt) === valore || (tt === '' && valore === undefined) ? tt : valore === undefined ? '' : fmtNum(valore)))
  }, [valore])
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <div style={{ ...ETICHETTA, marginBottom: 4, fontSize: 11 }}>{etichetta}</div>
      <input
        value={testo}
        inputMode="decimal"
        aria-label={etichetta}
        onChange={e => {
          const v = e.target.value.replace('.', ',')
          setTesto(v)
          if (v.trim() === '') { if (facoltativo) onChange(undefined); return }
          const n = parseNum(v)
          if (Number.isFinite(n) && n >= 0) onChange(n)
        }}
        // Uscendo, il campo dice il numero che vale davvero: uno svuotato, o
        // uno che la config non accetta (0 colpi), tornerebbe a mentire.
        onBlur={() => setTesto(valore === undefined ? '' : fmtNum(valore))}
        className="j-field"
        style={{ height: 44 }}
      />
    </label>
  )
}

export function CampoProgressione({ valore, onChange, pesoRiferimento }: {
  valore: ProgressioneRiga | undefined
  onChange: (p: ProgressioneRiga) => void
  /** L'ultimo peso dell'esercizio collegato, se c'è: da lì si misura il salto
   *  al carico successivo, e il range consigliato. */
  pesoRiferimento?: number
}) {
  const t = useT()
  const [personalizza, setPersonalizza] = useState(valore?.preset === 'personalizzata')
  const [testoLista, setTestoLista] = useState(() => (valore?.steps.kind === 'list' ? valore.steps.values.map(fmtNum).join(', ') : LISTA_MANUBRI.join(', ')))

  const nomiPreset: Record<PresetFisso, string> = { multi: t('Multiarticolare'), monoGrande: t('Mono grande'), monoPiccola: t('Mono piccola') }

  if (!valore) {
    return (
      <div style={{ marginTop: 14 }}>
        <div style={ETICHETTA}>{t('Progressione')}</div>
        <Scelte valori={PRESET_FISSI} etichette={nomiPreset} attivo={null} onScegli={v => onChange(conPreset(v))} etichetta={t('Progressione')}/>
        <div style={SPIEGA}>{t('Multiarticolare: top set e back-off col RIR. Mono grande e piccola: doppia progressione. È un suggerimento: da «Personalizza» si cambia tutto.')}</div>
      </div>
    )
  }

  const p = valore
  const cambiaCfg = (cfg: Partial<ProgressioneRiga['cfg']>) => onChange({ ...p, preset: 'personalizzata', cfg: { ...p.cfg, ...cfg } } as ProgressioneRiga)
  const cambiaCarichi = (steps: LoadSteps) => onChange({ ...p, steps })

  const descrizione = p.modello === 'topSet'
    ? t('Top set da {top} a RIR {rir}, poi {serie} × {colpi} al −{pct}%. Si sale quando il top set riesce con RIR più alto dell’obiettivo.', {
      top: p.cfg.topReps, rir: p.cfg.targetRir, serie: p.cfg.backoffSets, colpi: p.cfg.backoffReps, pct: fmtNum(p.cfg.backoffPct * 100),
    })
    : t('Doppia progressione: {serie} × {min}–{max}. Arrivato a {max} su tutte, sale il carico e si riparte da {min}.', {
      serie: p.cfg.baseSets, min: p.cfg.repMin, max: p.cfg.repMax,
    })

  // Il range che il salto di carico consiglia: lo si propone, non lo si impone.
  const consigliato = p.modello === 'doppia' ? rangeConsigliato(p.steps, pesoRiferimento) : null
  const diverso = consigliato && p.modello === 'doppia' && (consigliato.min !== p.cfg.repMin || consigliato.max !== p.cfg.repMax)

  return (
    <div style={{ marginTop: 14 }}>
      <div style={ETICHETTA}>{t('Progressione')}</div>
      <Scelte
        valori={PRESET_FISSI} etichette={nomiPreset}
        attivo={p.preset === 'personalizzata' ? null : p.preset}
        onScegli={v => onChange(conPreset(v, p.steps))}
        etichetta={t('Progressione')}
      />
      <div style={SPIEGA}>
        {p.preset === 'personalizzata' && <strong style={{ color: NUC.ink }}>{t('Personalizzata')} · </strong>}
        {descrizione}
      </div>

      <div style={{ ...ETICHETTA, marginTop: 14 }}>{t('Carichi')}</div>
      <Scelte
        valori={['increment', 'list'] as const}
        etichette={{ increment: t('Incremento fisso'), list: t('Lista carichi') }}
        attivo={p.steps.kind}
        onScegli={k => cambiaCarichi(k === 'increment' ? (p.steps.kind === 'increment' ? p.steps : PASSO_FISSO) : { kind: 'list', values: leggiLista(testoLista) })}
        etichetta={t('Carichi')}
      />
      {p.steps.kind === 'increment' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
            <CampoNumero etichetta={t('Passo (kg)')} valore={p.steps.step} onChange={n => n !== undefined && n > 0 && cambiaCarichi({ ...p.steps as Extract<LoadSteps, { kind: 'increment' }>, step: n })}/>
            <CampoNumero etichetta={t('Minimo (kg) · facoltativo')} valore={p.steps.min} facoltativo onChange={n => {
              const { step } = p.steps as Extract<LoadSteps, { kind: 'increment' }>
              cambiaCarichi(n === undefined ? { kind: 'increment', step } : { kind: 'increment', step, min: n })
            }}/>
          </div>
          <div style={SPIEGA}>{t('Bilanciere e macchine a dischi: di quanto sale il carico ogni volta. Il minimo è il bilanciere scarico.')}</div>
        </>
      ) : (
        <>
          <input
            value={testoLista}
            onChange={e => { setTestoLista(e.target.value); cambiaCarichi({ kind: 'list', values: leggiLista(e.target.value) }) }}
            aria-label={t('Carichi disponibili')}
            placeholder="2, 4, 6, 8, 10"
            inputMode="decimal"
            className="j-field"
            style={{ marginTop: 10 }}
          />
          <div style={SPIEGA}>
            {p.steps.values.length === 0
              ? <span style={{ color: 'var(--danger)' }}>{t('Scrivi almeno un carico.')}</span>
              : t('Manubri e pacco pesi: i carichi che ci sono davvero, separati da virgole.')}
          </div>
        </>
      )}

      {diverso && consigliato && (
        <div className="flex items-center justify-between" style={{ gap: 10, marginTop: 10, padding: '8px 10px', border: '2px solid var(--j-accent)' }}>
          <span style={{ fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.4, color: NUC.ink }}>
            {t('Da {peso} kg il carico dopo è +{salto}%: range consigliato {min}–{max}.', { peso: fmtNum(consigliato.peso), salto: Math.round(consigliato.salto * 100), min: consigliato.min, max: consigliato.max })}
          </span>
          <button type="button" onClick={() => cambiaCfg({ repMin: consigliato.min, repMax: consigliato.max })} className="j-hard j-focus" style={{
            flexShrink: 0, minHeight: 40, padding: '0 12px', cursor: 'pointer', background: 'var(--surface)', border: 'var(--bordo)', color: NUC.ink,
            fontFamily: NUC.display, fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
          }}>{t('Usa')}</button>
        </div>
      )}

      <button type="button" onClick={() => setPersonalizza(v => !v)} aria-expanded={personalizza} className="j-focus flex items-center" style={{
        gap: 6, minHeight: 44, marginTop: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: NUC.display, fontSize: 13.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: NUC.ink,
      }}>
        <span style={{ display: 'flex', transform: personalizza ? 'rotate(90deg)' : 'none', transition: 'transform var(--motion-fast) var(--ease)' }}><Icons.chev size={13} stroke={2.2}/></span>
        {t('Personalizza')}
      </button>

      {personalizza && (
        <div style={{ paddingTop: 4 }}>
          <Scelte
            valori={['topSet', 'doppia'] as const}
            etichette={{ topSet: t('Top set + back-off'), doppia: t('Doppia progressione') }}
            attivo={p.modello}
            onScegli={m => onChange(conModello(p, m))}
            etichetta={t('Modello')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
            {p.modello === 'topSet' ? (
              <>
                <CampoNumero etichetta={t('Colpi top set')} valore={p.cfg.topReps} onChange={n => n !== undefined && cambiaCfg({ topReps: Math.max(1, Math.round(n)) })}/>
                <CampoNumero etichetta={t('RIR obiettivo')} valore={p.cfg.targetRir} onChange={n => n !== undefined && cambiaCfg({ targetRir: Math.min(10, Math.round(n)) })}/>
                <CampoNumero etichetta={t('Serie back-off')} valore={p.cfg.backoffSets} onChange={n => n !== undefined && cambiaCfg({ backoffSets: Math.min(10, Math.round(n)) })}/>
                <CampoNumero etichetta={t('Colpi back-off')} valore={p.cfg.backoffReps} onChange={n => n !== undefined && cambiaCfg({ backoffReps: Math.max(1, Math.round(n)) })}/>
                <CampoNumero etichetta={t('Back-off: − %')} valore={Math.round(p.cfg.backoffPct * 1000) / 10} onChange={n => n !== undefined && n < 100 && cambiaCfg({ backoffPct: n / 100 })}/>
              </>
            ) : (
              <>
                <CampoNumero etichetta={t('Colpi minimo')} valore={p.cfg.repMin} onChange={n => n !== undefined && cambiaCfg({ repMin: Math.max(1, Math.round(n)) })}/>
                <CampoNumero etichetta={t('Colpi massimo')} valore={p.cfg.repMax} onChange={n => n !== undefined && cambiaCfg({ repMax: Math.max(1, Math.round(n)) })}/>
                <CampoNumero etichetta={t('Serie')} valore={p.cfg.baseSets} onChange={n => n !== undefined && cambiaCfg({ baseSets: Math.min(10, Math.max(1, Math.round(n))) })}/>
                <CampoNumero etichetta={t('Serie massime · facoltativo')} valore={p.cfg.maxSets} facoltativo onChange={n => cambiaCfg({ maxSets: n === undefined ? undefined : Math.min(10, Math.max(1, Math.round(n))) })}/>
              </>
            )}
          </div>
          {p.modello === 'doppia' && (
            <div className="flex items-center" style={{ gap: 12, padding: '12px 0 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 600, color: NUC.ink, lineHeight: 1.25 }}>{t('Basta la prima serie')}</div>
                <div style={{ fontFamily: NUC.font, fontSize: 12.5, color: 'var(--fg-mute)', lineHeight: 1.35, marginTop: 2 }}>{t('Si sale quando la prima serie arriva al massimo dei colpi')}</div>
              </div>
              <Interruttore acceso={!!p.cfg.firstSetOnly} onClick={() => cambiaCfg({ firstSetOnly: !p.cfg.firstSetOnly || undefined })} etichetta={t('Basta la prima serie')}/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
