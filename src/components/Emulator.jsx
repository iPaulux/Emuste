import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase, getRomPublicUrl, getSavePublicUrl, getBatterySavePublicUrl } from '../lib/supabase.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const MAX_BACKUPS = 6   // nombre de sessions conservées en historique

/** Proportion d'octets « réels » (ni 0x00 ni 0xFF) — détecte une save vierge */
function realDataRatio(buffer) {
  const view = new Uint8Array(buffer)
  if (view.length === 0) return 0
  let blank = 0
  for (let i = 0; i < view.length; i++) {
    if (view[i] === 0x00 || view[i] === 0xff) blank++
  }
  return (view.length - blank) / view.length
}

const STATUS = {
  idle:        null,
  saving:      { label: '☁ Sync état…',       cls: 'text-yellow-400' },
  saved:       { label: '✓ État sauvegardé',   cls: 'text-green-400'  },
  savingBat:   { label: '💾 Sync .sav…',       cls: 'text-blue-400'   },
  savedBat:    { label: '✓ .sav synchronisé',  cls: 'text-green-400'  },
  error:       { label: '✗ Erreur sauvegarde', cls: 'text-red-400'    },
}

export default function Emulator({ rom, onBack }) {
  const [saveStatus, setSaveStatus] = useState('idle')
  const iframeRef = useRef(null)

  // ── Construction de l'URL de l'iframe ───────────────────────────────
  // useMemo obligatoire : si l'URL change entre deux renders (Date.now()),
  // React recharge l'iframe → le jeu redémarre en boucle à chaque sync.
  const iframeSrc = useMemo(() => {
    const url = new URL('/emulator.html', window.location.origin)
    url.searchParams.set('romId',       rom.id)
    url.searchParams.set('romFileName', rom.file_name)
    url.searchParams.set('supabase',    SUPABASE_URL)
    url.searchParams.set('chunks',      String(rom.chunk_count ?? 1))
    url.searchParams.set('batterySave', `${getBatterySavePublicUrl(rom.id)}?t=${Date.now()}`)
    if ((rom.chunk_count ?? 1) <= 1) {
      url.searchParams.set('rom', getRomPublicUrl(rom.file_path))
    }
    if (rom.save) {
      url.searchParams.set('save', `${getSavePublicUrl(rom.id)}?t=${Date.now()}`)
    }
    return url.toString()
  }, [rom])

  // ── Upload save state (snapshot) ────────────────────────────────────
  const uploadSave = useCallback(async (stateBuffer, screenshot) => {
    setSaveStatus('saving')
    try {
      const filePath = `${rom.id}/auto.state`
      const blob = new Blob([stateBuffer], { type: 'application/octet-stream' })

      const { error: upErr } = await supabase.storage
        .from('saves').upload(filePath, blob, { upsert: true })
      if (upErr) throw upErr

      const { error: dbErr } = await supabase.from('save_states').upsert(
        { rom_id: rom.id, slot: 0, file_path: filePath,
          screenshot: screenshot ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'rom_id,slot' }
      )
      if (dbErr) throw dbErr

      setSaveStatus('saved')
    } catch (err) {
      console.error('[Emuste] uploadSave error:', err)
      setSaveStatus('error')
    } finally {
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }, [rom.id])

  // ── Upload battery save (.sav in-game) ──────────────────────────────
  const uploadBatterySave = useCallback(async (buffer) => {
    // Garde-fou : ne JAMAIS écraser la save cloud avec une save quasi vide.
    // Une save Pokémon réelle contient > 5 % de données ; une vierge ~0 %.
    if (realDataRatio(buffer) < 0.02) {
      console.warn('[Emuste] Save quasi vide ignorée (protection anti-écrasement)')
      return
    }
    try {
      setSaveStatus('savingBat')
      const blob = new Blob([buffer], { type: 'application/octet-stream' })
      const { error } = await supabase.storage
        .from('saves')
        .upload(`${rom.id}/battery.sav`, blob, { upsert: true })
      if (error) throw error
      setSaveStatus('savedBat')
    } catch (err) {
      console.error('[Emuste] uploadBatterySave error:', err)
    } finally {
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [rom.id])

  // ── Backup de la save cloud au lancement (avant toute sync) ─────────
  // Copie la battery.sav actuelle dans backups/ AVANT qu'une sync puisse
  // l'écraser. Garantit qu'on peut toujours revenir à la session précédente.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: current, error: dlErr } = await supabase.storage
          .from('saves').download(`${rom.id}/battery.sav`)
        if (dlErr || !current || cancelled) return
        const buf = await current.arrayBuffer()
        if (realDataRatio(buf) < 0.02) return // rien de bon à sauvegarder

        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        await supabase.storage
          .from('saves')
          .upload(`${rom.id}/backups/battery_${stamp}.sav`, new Blob([buf]), { upsert: true })

        // Purge : ne garder que les MAX_BACKUPS plus récents
        const { data: list } = await supabase.storage
          .from('saves').list(`${rom.id}/backups`, { sortBy: { column: 'name', order: 'desc' } })
        if (list && list.length > MAX_BACKUPS) {
          const toDelete = list.slice(MAX_BACKUPS)
            .map(f => `${rom.id}/backups/${f.name}`)
          await supabase.storage.from('saves').remove(toDelete)
        }
        console.log('[Emuste] Backup save cloud créé :', `backups/battery_${stamp}.sav`)
      } catch (err) {
        console.warn('[Emuste] backup au lancement échoué:', err)
      }
    })()
    return () => { cancelled = true }
  }, [rom.id])

  // ── Écoute des messages de l'iframe ─────────────────────────────────
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'ejs_save_state') {
        uploadSave(event.data.state, event.data.screenshot)
      }
      if (event.data?.type === 'ejs_battery_save' && event.data.data) {
        uploadBatterySave(event.data.data)
      }
      if (event.data?.type === 'ejs_debug') {
        console[event.data.level || 'log']('[iframe]', event.data.msg, event.data.src ? `${event.data.src}:${event.data.line}` : '')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [uploadSave, uploadBatterySave])

  // ── Raccourci clavier : Échap ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onBack() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  const status = STATUS[saveStatus]

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* ── Barre de contrôle ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
          title="Retour à la bibliothèque (Échap)"
        >
          <span>←</span>
          <span className="hidden sm:inline">Bibliothèque</span>
        </button>

        <span className="text-zinc-200 font-medium text-sm truncate max-w-[40vw] text-center">
          {rom.name}
        </span>

        <div className="w-44 flex justify-end">
          {status ? (
            <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
          ) : (
            <span className="text-zinc-600 text-xs">
              {rom.save ? '☁ Cloud save actif' : 'Aucune sauvegarde'}
            </span>
          )}
        </div>
      </div>

      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="flex-1 w-full border-0 bg-black"
        allow="gamepad *; fullscreen *"
        title={`Emuste – ${rom.name}`}
      />
    </div>
  )
}
