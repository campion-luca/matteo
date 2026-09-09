# Bonifica colori → palette "Journal"

> **Documento storico.** Censimento colori del passaggio alla palette "Journal".
> Diversi token elencati qui — quelli del ciclo, delle priorità dei lavori, delle
> streak — sono stati rimossi insieme alle feature che li usavano. Per i token
> vivi fa fede [src/styles/globals.css](src/styles/globals.css).

Obiettivo: nessun colore renderizzato fuori dai token Journal. Nessuna modifica a
layout, spaziature, logica o testi. Censimento del working tree e mappa di
sostituzione per ruolo semantico.

## Token nuovi introdotti (globals.css, light + dark)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--danger-rgb` | `174,63,37` | `236,129,104` | tinte danger inline `rgba(var(--danger-rgb),α)` |
| `--knob` | `#faf7ef` | `#e9e2cf` | pomello dei toggle (disco chiaro in entrambi i temi) |
| `--cycle-dot` | `#c0304a` | `#ff8a9a` | marker vivido dei giorni di ciclo |
| `--cat-1…14` | set caldo | set caldo | palette categorica (muscoli, categorie, picker) |

## Mappa per ruolo

| Valore fuori-palette | Ruolo | → Token |
|---|---|---|
| `#EF4444`, `rgba(239,68,68,α)` | elimina / distruttivo | `--danger`, `rgba(var(--danger-rgb),α)` |
| `#4ade80`, `rgba(74,222,128,α)`, stroke `#14532d` | fatto / completato (stato attivo) | `--j-accent`, `rgba(var(--j-rgb),α)`, `--j-accent-fg` |
| `#fff` / `white` (pomelli toggle) | bianco puro | `--knob` |
| `#fff` (check su fill accent) | bianco su accent | `--j-accent-fg` |
| `white` (ring selezione swatch) | bordo selezione | `--fg` |
| `rgba(0,0,0,α)` ombre card/pop/FAB | ombra fredda | `rgba(42,36,24,α)` (scrim modali restano scuri) |
| `#F59E0B`, `#d97706`, `#c08a2e` | warning / pending / bozza | `--warn` |
| `#e05`, `#c0392b` | errore | `--danger` |
| budget `#6fae8f`/`#3f6b57`, `#e58a7e`/`#a8342a` | pos / neg finanziario | `--ok` / `--danger` |
| `#c94f63`, `#e11d48` (ciclo/rose) | salute · ciclo | invariati: già caldi + alpha-append `${x}99` (no `var()`) |
| `#c0622a` (streak) | streak | invariato: già caldo + alpha-append `${x}55` |
| idratazione `#7e5a7a` (viola) | scala idratazione | `#8a5a6e` (unico outlier freddo; resto scala già caldo) |
| `#EF4444` (highlight Panatta) | evidenziazione attiva | `--j-accent` (il rosso non è più associato a Panatta) |
| linee grafico `#60A5FA`/`#A78BFA` | trend serie singola | carico → `--j-accent`, volume → `--brass` |
| muscoli/categorie/picker (blu/viola/teal freddi) | dati categorici | hex caldi del set `--cat-1…14` (alpha-append/persistenza → hex, non `var()`) |

## Decisioni sui casi ambigui (confermate)

1. **Palette categoriche** → riarmonizzate su set caldo on-brand (non lasciate come dati grezzi).
2. **Linee grafici a serie singola** → due tinte calde (accent + ottone).
3. **Rosso Panatta** → rimosso: l'evidenziazione usa l'accent come ogni stato attivo.

## Set categorico caldo (`--cat-N`) — visibilità ≥2.0:1 su carta e copertina

`#3f7357` `#2f7a6b` `#6e7a38` `#557a3a` `#b0873f` `#c08a2e` `#b0562f` `#9e4a2c`
`#a2687a` `#8a5a6e` `#b07a5e` `#5f7e86` `#8a7440` `#a5442a`
