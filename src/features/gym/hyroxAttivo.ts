// ── Hyrox, spento ──────────────────────────────────────────────
// Dal 6 ottobre 2026 Hyrox non si vede: l'app è solo palestra finché la sua
// parte non trova una forma che convince. È spento, non tolto — il codice
// (GymHyrox, hyroxStima, i modali) resta com'è e le sue prove continuano a
// girare accendendo questo interruttore (`vi.mock` di questo file).
//
// Spento vuol dire che Hyrox non compare da nessuna parte: niente «Pesi | Hyrox»
// in home, niente stazioni nella ricerca, e le sessioni già registrate non
// contano più come giorni allenati (settimana, calendario, riepilogo, vista
// dell'allenatore). I dati NON si toccano: `hyroxExercises` e `hyroxGare`
// restano nello store e nel cloud, e riaccendendo tornano tutti.
//
// Per riaccendere basta questa riga.
import type { HyroxExercise } from '@/store/useJarvisStore'

// `boolean` e non `false`: col tipo letterale TypeScript darebbe per morto ogni
// ramo che lo guarda.
export const HYROX_ATTIVO: boolean = false

// Sempre la STESSA lista vuota: finisce dentro i selettori dello store, e una
// lista nuova a ogni lettura lo farebbe sembrare cambiato ogni volta.
const NESSUNA: HyroxExercise[] = []

/** Le stazioni Hyrox che il resto dell'app può vedere: tutte, o nessuna. */
export function hyroxVisibili(lista: HyroxExercise[] | undefined): HyroxExercise[] {
  return HYROX_ATTIVO ? lista ?? NESSUNA : NESSUNA
}
