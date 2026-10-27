// La barra laterale del desktop (ott 2026): il marchio, le sezioni
// dell'allenamento e quelle del coaching, e in fondo chi sta usando l'app.
// Nera a tutta altezza, come la card della scheda di oggi: è la cornice fissa,
// il resto della finestra è il foglio su cui si lavora.
//
// Ogni voce porta in una sezione (vedi navDesktop); il numero accanto dice
// quante cose ci sono dentro, o quante aspettano — i messaggi da leggere.
import { useEffect, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useNonLetti } from '@/lib/messaggiLive'
import { fmtNum } from '@/features/gym/gymModel'
import { useSchedeVisibili } from '@/features/gym/gymHooks'
import { useNavDesktop, type SezioneDesktop } from './navDesktop'
import { caricaAllievi, useAllievi } from './allieviDesktop'

const LARGHEZZA_BARRA = 208

export function BarraLaterale({ userId, onUtente, onImpostazioni }: {
  userId: string
  onUtente: () => void
  onImpostazioni: () => void
}) {
  const t = useT()
  const sezione = useNavDesktop(s => s.dove.sezione)
  const vai = useNavDesktop(s => s.vai)
  const { esercizi, userName, userWeight, userHeight } = useJarvisStore(useShallow(st => ({
    esercizi: st.palestraExercises.length,
    userName: st.userName,
    userWeight: st.userWeight,
    userHeight: st.userHeight,
  })))
  const schede = useSchedeVisibili().filter(sc => !sc.draft).length
  const allievi = useAllievi(s => s.allievi.length)
  const daLeggere = useNonLetti()

  // Gli allievi si rileggono all'apertura e tornando sulla finestra: un allievo
  // nuovo, collegato col codice dal suo telefono, compare senza ricaricare.
  useEffect(() => {
    void caricaAllievi(userId)
    const alRitorno = () => { if (document.visibilityState === 'visible') void caricaAllievi(userId) }
    document.addEventListener('visibilitychange', alRitorno)
    return () => document.removeEventListener('visibilitychange', alRitorno)
  }, [userId])

  const voce = (id: SezioneDesktop, nome: string, conta?: number) => {
    const attiva = sezione === id
    return (
      <button key={id} type="button" onClick={() => vai(id)} aria-current={attiva ? 'page' : undefined} className="j-focus" style={{
        width: '100%', minHeight: 38, padding: '0 12px 0 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        // Un velo del colore della scritta: chiaro sulla barra nera, scuro
        // sulla barra che nello scuro diventa chiara.
        background: attiva ? 'color-mix(in srgb, var(--surface) 10%, transparent)' : 'transparent', border: 'none',
        boxShadow: attiva ? 'inset 3px 0 0 var(--j-accent)' : 'none',
        color: 'var(--surface)', textAlign: 'left',
        fontFamily: NUC.display, fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
      }}>
        <span>{nome}</span>
        {!!conta && <span style={{ fontSize: 13, color: 'var(--muted-dark)', fontVariantNumeric: 'tabular-nums' }}>{conta}</span>}
      </button>
    )
  }

  const gruppo = (titolo: string, voci: ReactNode) => (
    <div style={{ marginTop: 18 }}>
      <div style={{ padding: '0 16px 6px', fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted-dark)' }}>{titolo}</div>
      {voci}
    </div>
  )

  const misure = [userWeight ? `${fmtNum(userWeight)} kg` : '', userHeight ? `${fmtNum(userHeight)} cm` : ''].filter(Boolean).join(' · ')

  return (
    <nav aria-label={t('Sezioni')} style={{
      width: LARGHEZZA_BARRA, flexShrink: 0, height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--ink)', color: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 4px' }}>
        <img src="/icon-192.png" alt="" width={30} height={30} style={{ display: 'block', outline: '1px solid var(--line-dark)' }}/>
        <span style={{ fontFamily: NUC.display, fontSize: 19, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Matteo</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {gruppo(t('Allenamento'), <>
          {voce('oggi', t('Oggi'))}
          {voce('schede', t('Schede'), schede)}
          {voce('esercizi', t('Esercizi'), esercizi)}
          {voce('calendario', t('Calendario'))}
          {voce('statistiche', t('Statistiche'))}
        </>)}
        {gruppo(t('Coaching'), <>
          {voce('allievi', t('Allievi'), allievi)}
          {voce('messaggi', t('Messaggi'), daLeggere)}
          {voce('coach', t('Il mio coach'))}
        </>)}
      </div>

      {/* Chi sta usando l'app: toccandolo si apre il profilo, la rotella le
          impostazioni — le stesse due porte del saluto sul telefono. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 10px 12px 12px', borderTop: '1px solid var(--line-dark)' }}>
        <button type="button" onClick={onUtente} aria-label={t('Profilo')} className="j-focus" style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: 4,
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--surface)',
        }}>
          <span aria-hidden style={{
            width: 34, height: 34, flexShrink: 0, background: 'var(--surface)', color: NUC.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: NUC.display, fontSize: 17, fontWeight: 800, textTransform: 'uppercase',
          }}>{(userName.trim()[0] ?? '?')}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName.trim() || t('Profilo')}</span>
            {misure && <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 12, color: 'var(--muted-dark)', marginTop: 1, whiteSpace: 'nowrap' }}>{misure}</span>}
          </span>
        </button>
        <button type="button" onClick={onImpostazioni} aria-label={t('Impostazioni')} title={t('Impostazioni')} className="j-focus" style={{
          width: 36, height: 36, flexShrink: 0, padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', color: 'var(--surface)',
        }}><Icons.settings size={18} stroke={1.8}/></button>
      </div>
    </nav>
  )
}
