import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import '@/styles/globals.css'
import { avviaTema } from '@/lib/tema'

// L'aggiornamento del service worker è gestito dal pattern 'prompt' (UpdateToast):
// niente più reload automatico su controllerchange (interrompeva l'utente a ogni deploy).

avviaTema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
