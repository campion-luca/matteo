/**
 * progression.ts
 * Logiche di progressione per la webapp di allenamento.
 *
 * - Top set + back-off con RIR  → multiarticolari (panca, squat, stacco...)
 * - Doppia progressione          → monoarticolari (laterali, curl...)
 *   con fallback opzionale a tripla progressione (aggiunta serie)
 *
 * Tutte le funzioni sono pure: ricevono stato + log della seduta
 * e restituiscono il nuovo stato. Nessun side effect, facili da testare.
 */

/* =========================================================
 * TIPI COMUNI
 * ======================================================= */

/** Come si sale/scende di carico per un esercizio. */
export type LoadSteps =
  /** Incremento fisso (bilanciere, macchine a perno): es. 2.5 kg */
  | { kind: "increment"; step: number; min?: number }
  /** Lista di carichi disponibili (manubri, pacco pesi): es. [4, 6, 8, 10, 12] */
  | { kind: "list"; values: number[] };

/** Una serie registrata dall'utente. */
export interface SetLog {
  weight: number;
  reps: number;
  /** Ripetizioni in riserva dichiarate (opzionale per la doppia progressione). */
  rir?: number;
}

/** Prescrizione di una serie mostrata all'utente. */
export interface SetPrescription {
  weight: number;
  /** Ripetizioni target (singolo valore o range). */
  reps: number | { min: number; max: number };
  rir?: number;
  label?: "top" | "backoff" | "work";
}

export type ProgressionEvent =
  | "increase"
  | "hold"
  | "decrease"
  | "deload"
  | "revert"
  | "add_set";

export interface ProgressionResult<S> {
  state: S;
  event: ProgressionEvent;
  /** Messaggio breve da mostrare in UI. */
  message: string;
}

/* =========================================================
 * GESTIONE CARICHI
 * ======================================================= */

/** Arrotonda al carico realmente disponibile più vicino. */
export function roundLoad(weight: number, steps: LoadSteps): number {
  if (steps.kind === "increment") {
    const rounded = Math.round(weight / steps.step) * steps.step;
    const min = steps.min ?? 0;
    return Math.max(min, +rounded.toFixed(2));
  }
  const values = [...steps.values].sort((a, b) => a - b);
  return values.reduce((best, v) =>
    Math.abs(v - weight) < Math.abs(best - weight) ? v : best
  );
}

/** Carico successivo (direction = 1) o precedente (direction = -1). */
export function shiftLoad(
  weight: number,
  steps: LoadSteps,
  direction: 1 | -1,
  times = 1
): number {
  if (steps.kind === "increment") {
    return roundLoad(weight + direction * steps.step * times, steps);
  }
  const values = [...steps.values].sort((a, b) => a - b);
  const idx = values.indexOf(roundLoad(weight, steps));
  const next = Math.min(values.length - 1, Math.max(0, idx + direction * times));
  return values[next];
}

/** Salto relativo al prossimo carico (es. 0.25 = +25%). */
export function relativeJump(weight: number, steps: LoadSteps): number {
  const next = shiftLoad(weight, steps, 1);
  return weight > 0 ? (next - weight) / weight : 0;
}

/**
 * Suggerisce un range di ripetizioni in base al salto di carico disponibile:
 * più il salto è grande, più il range deve essere ampio per assorbirlo.
 */
export function suggestRepRange(
  weight: number,
  steps: LoadSteps
): { min: number; max: number } {
  const jump = relativeJump(weight, steps);
  if (jump <= 0.05) return { min: 6, max: 10 };
  if (jump <= 0.1) return { min: 8, max: 12 };
  if (jump <= 0.18) return { min: 10, max: 15 };
  return { min: 12, max: 20 };
}

/** 1RM stimato (Epley), utile per statistiche e grafici. */
export function estimate1RM(weight: number, reps: number, rir = 0): number {
  const totalReps = reps + rir;
  if (totalReps <= 1) return weight;
  return +(weight * (1 + totalReps / 30)).toFixed(1);
}

/* =========================================================
 * 1) TOP SET + BACK-OFF CON RIR  (multiarticolari)
 * ======================================================= */

export interface TopSetConfig {
  topReps: number;        // es. 5
  targetRir: number;      // es. 2
  backoffSets: number;    // es. 3
  backoffReps: number;    // es. 8
  backoffPct: number;     // es. 0.10 → back-off al -10%
  missReductionPct: number; // es. 0.025 → -2.5% se manchi le rep
  stallLimit: number;     // es. 3 mancati consecutivi → deload
  deloadPct: number;      // es. 0.10
  steps: LoadSteps;
}

export interface TopSetState {
  topWeight: number;
  missCount: number;
}

export const TOP_SET_DEFAULT: Omit<TopSetConfig, "steps"> = {
  topReps: 5,
  targetRir: 2,
  backoffSets: 3,
  backoffReps: 8,
  backoffPct: 0.1,
  missReductionPct: 0.025,
  stallLimit: 3,
  deloadPct: 0.1,
};

/** Cosa fare oggi. */
export function prescribeTopSet(
  state: TopSetState,
  cfg: TopSetConfig
): SetPrescription[] {
  const backoffWeight = roundLoad(
    state.topWeight * (1 - cfg.backoffPct),
    cfg.steps
  );
  return [
    { label: "top", weight: state.topWeight, reps: cfg.topReps, rir: cfg.targetRir },
    ...Array.from({ length: cfg.backoffSets }, () => ({
      label: "backoff" as const,
      weight: backoffWeight,
      reps: cfg.backoffReps,
    })),
  ];
}

/**
 * Aggiorna lo stato dopo la seduta, guardando SOLO il top set.
 * Le back-off seguono automaticamente perché sono una % del top set.
 */
export function progressTopSet(
  state: TopSetState,
  topSet: SetLog,
  cfg: TopSetConfig
): ProgressionResult<TopSetState> {
  const rir = topSet.rir ?? cfg.targetRir;
  const hitReps = topSet.reps >= cfg.topReps;

  // Ripetizioni mancate
  if (!hitReps) {
    const missCount = state.missCount + 1;
    if (missCount >= cfg.stallLimit) {
      return {
        event: "deload",
        message: `Stallo: deload del ${cfg.deloadPct * 100}%`,
        state: {
          topWeight: roundLoad(state.topWeight * (1 - cfg.deloadPct), cfg.steps),
          missCount: 0,
        },
      };
    }
    const reduced = roundLoad(
      state.topWeight * (1 - cfg.missReductionPct),
      cfg.steps
    );
    // garantisce almeno uno step in meno
    const topWeight =
      reduced < state.topWeight ? reduced : shiftLoad(state.topWeight, cfg.steps, -1);
    return {
      event: "decrease",
      message: "Ripetizioni mancate: carico leggermente ridotto",
      state: { topWeight, missCount },
    };
  }

  const surplus = rir - cfg.targetRir;

  // Molto più facile del previsto → doppio incremento
  if (surplus >= 3) {
    return {
      event: "increase",
      message: "Molto facile: doppio incremento",
      state: { topWeight: shiftLoad(state.topWeight, cfg.steps, 1, 2), missCount: 0 },
    };
  }

  // Più facile del previsto → incremento
  if (surplus >= 1) {
    return {
      event: "increase",
      message: "Obiettivo superato: si sale di carico",
      state: { topWeight: shiftLoad(state.topWeight, cfg.steps, 1), missCount: 0 },
    };
  }

  // In target o più duro del previsto → stesso carico
  return {
    event: "hold",
    message:
      surplus === 0
        ? "In target: stesso carico, punta a farlo più facile"
        : "Più duro del previsto: stesso carico",
    state: { ...state, missCount: 0 },
  };
}

/* =========================================================
 * 2) DOPPIA PROGRESSIONE  (monoarticolari)
 *    + fallback opzionale a tripla progressione
 * ======================================================= */

export interface DoubleProgressionConfig {
  repMin: number;   // es. 8 (curl) / 12 (laterali)
  repMax: number;   // es. 12 (curl) / 20 (laterali)
  baseSets: number; // es. 3
  /**
   * Se impostato, quando il carico nuovo è troppo pesante si torna indietro
   * e si aggiunge una serie (tripla progressione) fino a maxSets.
   */
  maxSets?: number;
  /** Se true basta che la PRIMA serie arrivi a repMax per salire. */
  firstSetOnly?: boolean;
  steps: LoadSteps;
}

export interface DoubleProgressionState {
  weight: number;
  sets: number;
  /** Carico precedente, valorizzato subito dopo un aumento. */
  previousWeight?: number;
}

export const DOUBLE_PRESETS = {
  /** Monoarticolari "grandi": curl, french press, leg curl... */
  isolationLarge: { repMin: 8, repMax: 12, baseSets: 3, maxSets: 4 },
  /** Monoarticolari "piccole": alzate laterali, rear delt, polpacci... */
  isolationSmall: { repMin: 12, repMax: 20, baseSets: 3, maxSets: 5 },
} satisfies Record<string, Omit<DoubleProgressionConfig, "steps">>;

export function prescribeDouble(
  state: DoubleProgressionState,
  cfg: DoubleProgressionConfig
): SetPrescription[] {
  return Array.from({ length: state.sets }, () => ({
    label: "work" as const,
    weight: state.weight,
    reps: { min: cfg.repMin, max: cfg.repMax },
  }));
}

export function progressDouble(
  state: DoubleProgressionState,
  sets: SetLog[],
  cfg: DoubleProgressionConfig
): ProgressionResult<DoubleProgressionState> {
  const workSets = sets.slice(0, state.sets);
  const reachedMax = cfg.firstSetOnly
    ? (workSets[0]?.reps ?? 0) >= cfg.repMax
    : workSets.length >= state.sets && workSets.every((s) => s.reps >= cfg.repMax);
  const belowMin = workSets.some((s) => s.reps < cfg.repMin);

  // 1. Prima seduta dopo un aumento e non si arriva al minimo → torna indietro
  if (state.previousWeight !== undefined && belowMin) {
    const canAddSet = cfg.maxSets !== undefined && state.sets < cfg.maxSets;
    return {
      event: canAddSet ? "add_set" : "revert",
      message: canAddSet
        ? "Carico troppo alto: torni al precedente con una serie in più"
        : "Carico troppo alto: torni al precedente",
      state: {
        weight: state.previousWeight,
        sets: canAddSet ? state.sets + 1 : state.sets,
      },
    };
  }

  // 2. Range completato → si sale di carico, serie riportate alla base
  if (reachedMax) {
    const next = shiftLoad(state.weight, cfg.steps, 1);
    if (next === state.weight) {
      // carico massimo disponibile: si progredisce con le serie
      const canAddSet = cfg.maxSets !== undefined && state.sets < cfg.maxSets;
      return {
        event: canAddSet ? "add_set" : "hold",
        message: canAddSet
          ? "Carico massimo raggiunto: aggiungi una serie"
          : "Carico e serie al massimo: valuta una variante più difficile",
        state: { weight: state.weight, sets: canAddSet ? state.sets + 1 : state.sets },
      };
    }
    return {
      event: "increase",
      message: `Range completato: passi a ${next} kg e riparti da ${cfg.repMin} rep`,
      state: { weight: next, sets: cfg.baseSets, previousWeight: state.weight },
    };
  }

  // 3. Altrimenti stesso carico, si cercano più ripetizioni
  return {
    event: "hold",
    message: "Stesso carico: aggiungi ripetizioni dove puoi",
    state: { weight: state.weight, sets: state.sets }, // previousWeight azzerato
  };
}

/* =========================================================
 * ESEMPI D'USO
 * ======================================================= */

/*
// --- Panca piana ---
const panca: TopSetConfig = {
  ...TOP_SET_DEFAULT,
  steps: { kind: "increment", step: 2.5, min: 20 },
};
let s1: TopSetState = { topWeight: 80, missCount: 0 };
prescribeTopSet(s1, panca);
// → top 80 kg × 5 @RIR2, back-off 3 × 8 @ 72.5 kg
const r1 = progressTopSet(s1, { weight: 80, reps: 5, rir: 3 }, panca);
// → increase, topWeight 82.5

// --- Alzate laterali ---
const manubri: LoadSteps = { kind: "list", values: [4, 6, 8, 10, 12, 14, 16] };
const laterali: DoubleProgressionConfig = {
  ...DOUBLE_PRESETS.isolationSmall,
  steps: manubri,
};
let s2: DoubleProgressionState = { weight: 8, sets: 3 };
progressDouble(s2, [{ weight: 8, reps: 20 }, { weight: 8, reps: 20 }, { weight: 8, reps: 20 }], laterali);
// → increase, weight 10, previousWeight 8

// --- Curl martello ---
const curl: DoubleProgressionConfig = {
  ...DOUBLE_PRESETS.isolationLarge,
  steps: { kind: "list", values: [8, 10, 12, 14, 16, 18, 20] },
};
*/
