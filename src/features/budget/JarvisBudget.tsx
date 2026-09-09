// Budget: entrate, spese e "il sogno da raggiungere".
//
// La schermata è tre liste (fisse, variabili, grosse imminenti) più il pannello
// del sogno; tutto il calcolo — quanto avanza al mese, in quanti mesi arrivi
// all'obiettivo, quante spese grosse copri — sta in budgetMath.ts, che è puro e
// testato. Qui dentro c'è solo come lo si mostra.
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { BudgetDream, BudgetItem, BudgetState } from '@/store/useJarvisStore'
import { computeBudget, computeDream, fmtEur } from './budgetMath'
import { useT, t } from '@/lib/i18n'
// I nomi dei mesi vivono in un posto solo (@/lib/dateFormat): erano la quarta copia.
import { fmtMonthYear } from '@/lib/dateFormat'
import { uid } from '@/lib/uid'

type ListKey = 'fixed' | 'variable' | 'big'

// ── Store helpers ──────────────────────────────────────────────
function patchBudget(patch: Partial<BudgetState>) {
  useJarvisStore.setState(st => ({ budget: { ...st.budget, ...patch } }))
}
function addItem(key: ListKey) {
  useJarvisStore.setState(st => ({
    budget: { ...st.budget, [key]: [...st.budget[key], { id: uid('b'), name: '', amount: 0 }] },
  }))
}
function updateItem(key: ListKey, id: string, patch: Partial<BudgetItem>) {
  useJarvisStore.setState(st => ({
    budget: { ...st.budget, [key]: st.budget[key].map(i => i.id === id ? { ...i, ...patch } : i) },
  }))
}
function removeItem(key: ListKey, id: string) {
  useJarvisStore.setState(st => ({
    budget: { ...st.budget, [key]: st.budget[key].filter(i => i.id !== id) },
  }))
}
const EMPTY_DREAM: BudgetDream = { name: '', amount: 0, saved: 0 }
function patchDream(patch: Partial<BudgetDream>) {
  useJarvisStore.setState(st => ({
    budget: { ...st.budget, dream: { ...EMPTY_DREAM, ...st.budget.dream, ...patch } },
  }))
}
function clearDream() {
  useJarvisStore.setState(st => ({ budget: { ...st.budget, dream: undefined } }))
}

// Fuori da un componente: usa `t` diretto. Chi lo stampa è dentro `DreamPanel`,
// che si iscrive alla lingua con `useT` e quindi ricalcola la frase al cambio.
const fmtMonths = (n: number) => {
  if (n === 0) return t('subito')
  if (n === 1) return t('1 mese')
  if (n < 12) return t('{n} mesi', { n })
  const anni = Math.floor(n / 12)
  const resto = n % 12
  const parteAnni = anni === 1 ? t('1 anno') : t('{n} anni', { n: anni })
  return resto ? `${parteAnni} ${t('e {n} mesi', { n: resto })}` : parteAnni
}

// ── Riga di spesa (nome + importo + elimina) ───────────────────
function ExpenseRow({ item, listKey, suffix }: { item: BudgetItem; listKey: ListKey; suffix: string }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        className="j-field" style={{ flex: 1, minWidth: 0 }}
        value={item.name}
        placeholder={t('Descrizione')}
        onChange={e => updateItem(listKey, item.id, { name: e.target.value })}
      />
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <input
          className="j-field" style={{ width: 104, textAlign: 'right', paddingRight: 42 }}
          type="number" inputMode="decimal" min="0"
          value={item.amount === 0 ? '' : item.amount}
          placeholder="0"
          onChange={e => updateItem(listKey, item.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontFamily: NUC.label, fontSize: 10, color: NUC.faint, pointerEvents: 'none',
        }}>€{suffix}</span>
      </div>
      <button className="j-btn-del" onClick={() => removeItem(listKey, item.id)} style={{ flexShrink: 0 }}>
        <Icons.trash size={11} stroke={1.6}/>
      </button>
    </div>
  )
}

// ── Pannello lista spese ───────────────────────────────────────
// collapsible = mobile: card sottile che si apre al tap (accordion). Su desktop
// (collapsible false) resta sempre aperta perché lo spazio a colonne lo consente.
function ExpenseListPanel({ title, hint, listKey, items, total, suffix, accent, collapsible }: {
  title: string; hint: string; listKey: ListKey; items: BudgetItem[]
  total: number; suffix: string; accent: string; collapsible: boolean
}) {
  const [open, setOpen] = useState(false)
  const showBody = !collapsible || open

  return (
    <section style={S.panel}>
      {/* Header — tappabile solo su mobile (accordion) */}
      <button
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left',
          cursor: collapsible ? 'pointer' : 'default',
          marginBottom: showBody ? 4 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {collapsible && (
            <Icons.chev size={14} stroke={2} style={{ flexShrink: 0, color: NUC.faint, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 180ms' }}/>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={S.panelLabel}>{title}</div>
            {collapsible && !open && (
              <div style={{ fontFamily: NUC.font, fontSize: 11, color: NUC.faint, marginTop: 3 }}>
                {items.length === 0 ? t('Nessuna voce · tocca per aggiungere') : items.length === 1 ? t('1 voce') : t('{n} voci', { n: items.length })}
              </div>
            )}
          </div>
        </div>
        {/* A zero il totale non è un allarme: zero spese è una buona notizia, e il
            rosso fisso la faceva leggere come un problema. */}
        <div style={{ fontFamily: NUC.label, fontSize: 13, fontWeight: 700, color: total > 0 ? accent : 'var(--fg-mute)', flexShrink: 0 }}>{fmtEur(total)}</div>
      </button>

      {showBody && (
        <>
          <div style={{ fontFamily: NUC.font, fontSize: 11.5, color: NUC.faint, margin: '6px 0 12px', lineHeight: 1.4 }}>{hint}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => <ExpenseRow key={item.id} item={item} listKey={listKey} suffix={suffix}/>)}
          </div>
          {items.length === 0 && (
            <div style={{ fontFamily: NUC.font, fontSize: 12, color: NUC.faint, padding: '4px 0 10px', fontStyle: 'italic' }}>
              {t('Nessuna voce ancora.')}
            </div>
          )}

          <button onClick={() => addItem(listKey)} style={S.addBtn}>
            <Icons.plus size={14} stroke={2}/> {t('Aggiungi voce')}
          </button>
        </>
      )}
    </section>
  )
}

// ── Il sogno da raggiungere ────────────────────────────────────
// Una sola cosa desiderata alla volta: nome, costo, quanto hai già da parte e —
// se vuoi — entro quando. Dice se col risparmio attuale sei sulla giusta strada.
function DreamPanel({ dream, monthlyLeft, POS, NEG }: {
  dream: BudgetDream | undefined; monthlyLeft: number; POS: string; NEG: string
}) {
  const t = useT()
  const d = useMemo(() => dream && computeDream(dream, monthlyLeft), [dream, monthlyLeft])

  if (!dream) {
    return (
      <section style={S.panel}>
        <div style={S.panelLabel}>{t('Il sogno da raggiungere')}</div>
        <div style={{ fontFamily: NUC.font, fontSize: 12.5, color: NUC.faint, margin: '8px 0 12px', lineHeight: 1.5 }}>
          {t('Una cosa che vuoi comprare: scrivi quanto costa e scopri se, col tuo risparmio, sei sulla giusta strada.')}
        </div>
        <button onClick={() => patchDream({})} style={S.addBtn}>
          <Icons.plus size={14} stroke={2}/> {t('Imposta un sogno')}
        </button>
      </section>
    )
  }
  if (!d) return null

  const barColor = d.done ? POS : d.onTrack === false ? NEG : 'var(--j-accent)'

  // Frase di verdetto: prima il caso "già preso", poi l'irraggiungibilità, poi
  // il confronto con la data desiderata, infine la sola stima temporale.
  const verdict = (() => {
    // Le frasi sono spezzate attorno alla parte in grassetto: il tedesco non mette
    // le stesse parole nello stesso ordine, quindi ogni pezzo è una chiave a sé e
    // il grassetto resta agganciato al NUMERO, che è quello che deve saltare
    // all'occhio in tutte e due le lingue.
    if (d.done) return <>{t('Ci sei: hai da parte tutto il necessario.')} <b style={{ color: POS }}>{t('Puoi permettertelo.')}</b></>
    if (d.monthsNeeded === null) return <>{t('Ogni mese non ti avanza nulla:')} <b style={{ color: NEG }}>{t('così non lo raggiungerai mai')}</b>. {t('Riduci le spese o aumenta le entrate.')}</>
    if (d.onTrack === true) return <>{t('Al ritmo di {somma} al mese lo raggiungi in', { somma: fmtEur(monthlyLeft) })} <b style={{ color: POS }}>{fmtMonths(d.monthsNeeded)}</b>, {t('in tempo per la data che hai scelto.')} <b style={{ color: POS }}>{t('Sei sulla giusta strada.')}</b></>
    if (d.onTrack === false) return <>{t('Ti servono')} <b style={{ color: NEG }}>{fmtMonths(d.monthsNeeded)}</b> {t('ma ne hai {quanti}: per arrivarci dovresti mettere da parte', { quanti: fmtMonths(d.monthsToTarget ?? 0) })} <b style={{ color: NEG }}>{fmtEur(d.requiredPerMonth ?? 0)}</b> {t('al mese invece di {somma}.', { somma: fmtEur(monthlyLeft) })}</>
    return <>{t('Al ritmo di {somma} al mese lo raggiungi in', { somma: fmtEur(monthlyLeft) })} <b style={{ color: 'var(--j-accent-ink)' }}>{fmtMonths(d.monthsNeeded)}</b>, {t('verso {mese}.', { mese: fmtMonthYear(d.readyOn!) })}</>
  })()

  return (
    <section style={{ ...S.panel, borderColor: `${barColor}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={S.panelLabel}>{t('Il sogno da raggiungere')}</div>
        <button className="j-btn-del" onClick={clearDream} style={{ flexShrink: 0 }}>
          <Icons.trash size={11} stroke={1.6}/>
        </button>
      </div>

      <input
        className="j-field"
        style={{ width: '100%', marginTop: 10, fontSize: 16, fontWeight: 600, boxSizing: 'border-box' }}
        value={dream.name}
        placeholder={t('Es. Moto, viaggio in Giappone, casa…')}
        onChange={e => patchDream({ name: e.target.value })}
      />

      {/* Costo · già da parte · entro quando — griglia fluida: due colonne se ci sta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 8 }}>
        <DreamField label={t('Costo')} value={dream.amount} onChange={v => patchDream({ amount: v })}/>
        <DreamField label={t('Già da parte')} value={dream.saved} onChange={v => patchDream({ saved: v })}/>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...S.panelLabel, fontSize: 9.5 }}>{t('Entro il')}</span>
          <input
            className="j-field" style={{ width: '100%', boxSizing: 'border-box' }}
            type="date"
            value={dream.targetDate ?? ''}
            onChange={e => patchDream({ targetDate: e.target.value || undefined })}
          />
        </label>
      </div>

      {dream.amount > 0 && (
        <>
          {/* Progresso */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '16px 0 6px' }}>
            <span style={{ fontFamily: NUC.label, fontSize: 22, fontWeight: 800, color: barColor, lineHeight: 1 }}>{d.pct}%</span>
            <span style={{ fontFamily: NUC.font, fontSize: 12, color: NUC.faint }}>
              {d.done ? t('obiettivo raggiunto') : t('mancano {somma}', { somma: fmtEur(d.remaining) })}
            </span>
          </div>
          <div className="j-progress-track">
            <div style={{ width: `${d.pct}%`, height: '100%', background: barColor, transition: 'width 540ms' }}/>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontFamily: NUC.font, fontSize: 12.5, color: NUC.dim, lineHeight: 1.55 }}>
            {verdict}
          </div>
        </>
      )}
    </section>
  )
}

function DreamField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ ...S.panelLabel, fontSize: 9.5 }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          className="j-field" style={{ width: '100%', textAlign: 'right', paddingRight: 30, boxSizing: 'border-box' }}
          type="number" inputMode="decimal" min="0"
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: NUC.label, fontSize: 11, color: NUC.faint, pointerEvents: 'none' }}>€</span>
      </div>
    </label>
  )
}

// ── Schermata Budget ───────────────────────────────────────────
export function JarvisBudget({ onBack }: { onBack: () => void }) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const budget = useJarvisStore(useShallow(st => st.budget))
  // Verdi/rossi "finanza" (positivo = risparmio, negativo = deficit): token
  // semantici Journal, già sensibili al tema (schiariti in dark per la leggibilità).
  const POS = 'var(--ok)'
  const NEG = 'var(--danger)'
  const r = useMemo(() => computeBudget(budget), [budget])

  const savingColor = r.monthlyLeft >= 0 ? POS : NEG

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 97,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      display: 'flex', flexDirection: 'column',
      fontFamily: NUC.font, color: NUC.ink, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px', flexShrink: 0,
        borderBottom: `1px solid var(--hairline)`, background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} className="j-btn-back" style={{ width: 34, height: 34 }}>
          <Icons.chevL size={15}/>
        </button>
        <div className="j-eyebrow" style={{ letterSpacing: '.18em' }}>{t('Budget')}</div>
        <div style={{ width: 34 }}/>
      </div>

      <div style={{ padding: isDesktop ? '24px 24px 120px' : '18px 16px 120px', width: '100%', maxWidth: isDesktop ? 960 : '100%', alignSelf: 'center', boxSizing: 'border-box' }}>
        {(() => {

        // Stipendio mensile
        const salaryCard = (
          <section style={S.panel} key="salary">
            <div style={S.panelLabel}>{t('Stipendio mensile netto')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <input
                className="j-field"
                style={{ flex: 1, fontSize: 22, fontWeight: 700, height: 52, textAlign: 'right', paddingRight: 44, color: NUC.ink }}
                type="number" inputMode="decimal" min="0"
                value={budget.salary === 0 ? '' : budget.salary}
                placeholder="0"
                onChange={e => patchBudget({ salary: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span style={{ fontFamily: NUC.label, fontSize: 15, color: NUC.faint, position: 'relative', right: 34, pointerEvents: 'none' }}>€</span>
            </div>
          </section>
        )

        // Riepilogo mensile
        const summaryCard = (
          <section style={{ ...S.panel, background: 'var(--surface-2)' }} key="summary">
            <div style={S.panelLabel}>{t('Ogni mese')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14, marginTop: 10 }}>
              <SummaryRow label={t('Entrate')} value={fmtEur(r.income)} color={NUC.ink}/>
              <SummaryRow label={t('Spese fisse')} value={`− ${fmtEur(r.fixedTotal)}`} color={NUC.dim}/>
              <SummaryRow label={t('Spese variabili')} value={`− ${fmtEur(r.variableTotal)}`} color={NUC.dim}/>
            </div>
            <div style={{ height: 1, background: 'var(--hairline)', marginBottom: 14 }}/>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: NUC.faint }}>
                  {r.monthlyLeft >= 0 ? t('Ti resta al mese') : t('Sforo mensile')}
                </div>
                <div style={{ fontFamily: NUC.font, fontSize: 12, color: NUC.faint, marginTop: 2 }}>
                  {t('{somma} di uscite totali', { somma: fmtEur(r.monthlyExpenses) })}
                </div>
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 30, fontWeight: 800, color: savingColor, lineHeight: 1 }}>
                {fmtEur(r.monthlyLeft)}
              </div>
            </div>
          </section>
        )

        const fixedCard = (
          <ExpenseListPanel key="fixed" collapsible={!isDesktop}
            title={t('Spese fisse')} hint={t('Ciò che paghi ogni mese: affitto, bollette, abbonamenti, rate…')}
            listKey="fixed" items={budget.fixed} total={r.fixedTotal} suffix={t('/mese')} accent={NEG}
          />
        )

        const variableCard = (
          <ExpenseListPanel key="variable" collapsible={!isDesktop}
            title={t('Spese variabili')} hint={t('Spese eccezionali medie al mese: cinema, mangiare fuori, svago…')}
            listKey="variable" items={budget.variable} total={r.variableTotal} suffix={t('/mese')} accent={NEG}
          />
        )

        const bigCard = (
          <ExpenseListPanel key="big" collapsible={!isDesktop}
            title={t('Spese grosse imminenti')} hint={t('Uscite una tantum in arrivo: tagliando auto, vacanza estiva, elettrodomestici…')}
            listKey="big" items={budget.big} total={r.bigTotal} suffix={` ${t('tot')}`} accent={NUC.ink}
          />
        )

        const dreamCard = (
          <DreamPanel key="dream" dream={budget.dream} monthlyLeft={r.monthlyLeft} POS={POS} NEG={NEG}/>
        )

        // Proiezione a 12 mesi
        const projectionCard = (
          <section style={{ ...S.panel, borderColor: `${savingColor}55` }} key="projection">
          <div style={S.panelLabel}>{t('Fra 12 mesi')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <div style={{ fontFamily: NUC.label, fontSize: 34, fontWeight: 800, color: savingColor, lineHeight: 1 }}>
              {fmtEur(r.yearlySaved)}
            </div>
            <div style={{ fontFamily: NUC.font, fontSize: 12.5, color: NUC.faint }}>
              {r.yearlySaved >= 0 ? t('messi da parte') : t('di debito accumulato')}
            </div>
          </div>

          {budget.big.length > 0 && (
            <>
              <div style={{ marginTop: 16, marginBottom: 10, fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: NUC.faint }}>
                {t('Spese grosse sostenibili')} · {r.coveredCount}/{budget.big.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {r.coverage.map(c => (
                  <div key={c.item.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 0, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: c.covered ? POS : 'transparent',
                      border: `1px solid ${c.covered ? POS : NUC.hairline}`,
                    }}>
                      {c.covered
                        ? <Icons.check size={11} stroke={2.5} color="var(--j-accent-fg)"/>
                        : <Icons.x size={10} stroke={2} color={NUC.faint}/>}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: c.covered ? NUC.ink : NUC.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.item.name.trim() || t('Senza nome')}
                    </span>
                    <span style={{ fontFamily: NUC.label, fontSize: 12, color: c.covered ? NUC.dim : NUC.faint, flexShrink: 0 }}>
                      {fmtEur(c.item.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid var(--hairline)`, fontFamily: NUC.font, fontSize: 12.5, color: NUC.dim, lineHeight: 1.5 }}>
                {r.yearlySaved <= 0
                  ? t('Con le spese attuali non riesci a mettere da parte nulla: rivedi le uscite prima di pianificare spese grosse.')
                  : r.coveredCount === budget.big.length
                    ? <>{t('Copri')} <b style={{ color: POS }}>{t('tutte')}</b> {t('le spese grosse e ti avanzano')} <b style={{ color: POS }}>{fmtEur(r.bigLeftover)}</b>.</>
                    : <>{t('Con {somma} copri', { somma: fmtEur(r.yearlySaved) })} <b style={{ color: NUC.ink }}>{r.coveredCount}</b> {t('spese su {tot}. Ti mancano', { tot: budget.big.length })} <b style={{ color: NEG }}>{fmtEur(r.bigTotal - r.yearlySaved)}</b> {t('per farle tutte.')}</>}
              </div>
            </>
          )}
          </section>
        )

        // Desktop: due colonne (input a sinistra, riepiloghi a destra). Mobile:
        // colonna unica, con le liste spese come card collassabili (accordion).
        if (isDesktop) {
          return (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {salaryCard}{fixedCard}{variableCard}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {summaryCard}{dreamCard}{bigCard}{projectionCard}
              </div>
            </div>
          )
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {salaryCard}{summaryCard}{dreamCard}{fixedCard}{variableCard}{bigCard}{projectionCard}
          </div>
        )

        })()}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.dim }}>{label}</span>
      <span style={{ fontFamily: NUC.label, fontSize: 13.5, fontWeight: 600, color }}>{value}</span>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  panel:      { background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 0, padding: 16 },
  panelLabel: { fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.16em', color: 'var(--fg-mute)', textTransform: 'uppercase' },
  addBtn: {
    marginTop: 12, width: '100%', height: 38, borderRadius: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: 'var(--surface-2)', border: '1px dashed var(--hairline)',
    color: 'var(--fg-soft)', cursor: 'pointer',
    fontFamily: NUC.label, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
    transition: 'all 160ms',
  },
}
