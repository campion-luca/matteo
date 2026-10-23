// La foto del profilo, ridotta prima di partire.
//
// Una foto del telefono pesa 3-5 MB e ha quattromila pixel di lato. Nel
// profilo la si vede al massimo grande quanto un pollice: un quadrato di 256 px
// basta anche su uno schermo retina, e compresso pesa una ventina di kB — meno
// di una sola richiesta dei messaggi. È questo che rende le foto gratis per
// l'app: non è il server a rimpicciolirle, arrivano già piccole.
import { t } from '@/lib/i18n'

export const LATO_FOTO = 256

/** Ritaglia il quadrato centrale, lo riduce a `lato` pixel e lo restituisce come
 *  data URL. WebP dove il browser lo sa scrivere (pesa un terzo in meno), JPEG
 *  altrove — Safari, fino a poco fa, scriveva un PNG enorme al posto del WebP. */
export async function fotoDaFile(file: File, lato = LATO_FOTO): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(t('Scegli un’immagine.'))
  const img = await carica(file)
  const w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) throw new Error(t('Questa immagine non si apre.'))

  // Il quadrato centrale: in una foto fatta a qualcuno la faccia sta lì.
  let fonte: CanvasImageSource = img
  let lato0 = Math.min(w, h)
  let x = (w - lato0) / 2, y = (h - lato0) / 2
  // A metà per volta finché non si è vicini: ridurre di quindici volte in un
  // colpo solo, su Safari, dà un'immagine sgranata.
  while (lato0 > lato * 2) {
    const meta = Math.round(lato0 / 2)
    const c = tela(meta)
    c.ctx.drawImage(fonte, x, y, lato0, lato0, 0, 0, meta, meta)
    fonte = c.canvas
    lato0 = meta
    x = 0; y = 0
  }
  const finale = tela(lato)
  finale.ctx.drawImage(fonte, x, y, lato0, lato0, 0, 0, lato, lato)

  const webp = finale.canvas.toDataURL('image/webp', 0.82)
  return webp.startsWith('data:image/webp') ? webp : finale.canvas.toDataURL('image/jpeg', 0.85)
}

function tela(lato: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = lato
  canvas.height = lato
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(t('Questa immagine non si apre.'))
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

function carica(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error(t('Questa immagine non si apre.'))) }
    img.src = url
  })
}
