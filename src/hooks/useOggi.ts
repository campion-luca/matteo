import { useEffect, useState } from 'react'
import { todayISO } from '@/lib/isoDate'

// Il giorno di oggi, che cambia da solo.
//
// Una PWA sul telefono non si riavvia: resta in secondo piano per giorni e
// torna davanti. Chi leggeva `todayISO()` dentro un `useMemo` che dipendeva
// solo dai dati restava al giorno in cui era stato calcolato: martedì mattina
// la home diceva ancora "Oggi · A · fatta" di lunedì sera, e la settimana
// evidenziava lunedì — mentre la data in testata, che si ridisegna da sé, era
// già martedì. Messo fra le dipendenze, questo fa ricalcolare chi lo usa.
//
// Si rilegge tornando in primo piano (è lì che di solito il giorno è cambiato)
// e a mezzanotte, per chi ha l'app aperta davanti in quel momento.
export function useOggi(): string {
  const [oggi, setOggi] = useState(todayISO)
  useEffect(() => {
    const rileggi = () => setOggi(todayISO())
    const alRitorno = () => { if (document.visibilityState === 'visible') rileggi() }
    document.addEventListener('visibilitychange', alRitorno)
    // Fino alla mezzanotte locale, più un secondo di margine; poi si ripianifica.
    let timer: ReturnType<typeof setTimeout>
    const pianifica = () => {
      const ora = new Date()
      const domani = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() + 1)
      timer = setTimeout(() => { rileggi(); pianifica() }, domani.getTime() - ora.getTime() + 1000)
    }
    pianifica()
    return () => { document.removeEventListener('visibilitychange', alRitorno); clearTimeout(timer) }
  }, [])
  return oggi
}
