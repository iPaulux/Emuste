import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

const CHUNK_SIZE  = 5 * 1024 * 1024   // 5 MB par chunk
const CONCURRENCY = 4                  // uploads simultanés

export default function UploadModal({ onClose, onSuccess }) {
  const [file, setFile]     = useState(null)
  const [name, setName]     = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState({ done: 0, total: 0 })
  const [error, setError]   = useState('')
  const fileRef = useRef(null)
  const abortRef = useRef(false)

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!name) setName(f.name.replace(/\.nds$/i, '').replace(/[_\-.]+/g, ' ').trim())
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && /\.nds$/i.test(f.name)) {
      setFile(f)
      if (!name) setName(f.name.replace(/\.nds$/i, '').replace(/[_\-.]+/g, ' ').trim())
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !name.trim()) return
    setUploading(true)
    setError('')
    abortRef.current = false

    try {
      const romId       = crypto.randomUUID()
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      let   done        = 0

      setProgress({ done: 0, total: totalChunks })

      // ── Upload d'un chunk individuel ──────────────────────────────
      const uploadChunk = async (index) => {
        if (abortRef.current) throw new Error('Annulé')
        const start = index * CHUNK_SIZE
        const end   = Math.min(start + CHUNK_SIZE, file.size)
        const blob  = file.slice(start, end)
        const path  = `${romId}/chunk_${String(index).padStart(4, '0')}`

        const { error: upErr } = await supabase.storage
          .from('roms')
          .upload(path, blob)
        if (upErr) throw new Error(`Chunk ${index} : ${upErr.message}`)

        done++
        setProgress({ done, total: totalChunks })
      }

      // ── Upload par vagues de CONCURRENCY ─────────────────────────
      const indices = Array.from({ length: totalChunks }, (_, i) => i)
      for (let i = 0; i < indices.length; i += CONCURRENCY) {
        await Promise.all(indices.slice(i, i + CONCURRENCY).map(uploadChunk))
        if (abortRef.current) throw new Error('Annulé')
      }

      // ── Entrée en base ────────────────────────────────────────────
      const { error: dbErr } = await supabase.from('roms').insert({
        id:          romId,
        name:        name.trim(),
        file_name:   file.name,
        file_path:   `${romId}/chunk_0000`,
        file_size:   file.size,
        chunk_count: totalChunks,
      })
      if (dbErr) throw dbErr

      onSuccess()
    } catch (err) {
      if (err.message !== 'Annulé') setError(err.message ?? 'Erreur inconnue')
      setUploading(false)
    }
  }

  const handleCancel = () => {
    if (uploading) { abortRef.current = true; return }
    onClose()
  }

  const pct = progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <h2 className="text-lg font-bold">Ajouter une ROM</h2>
          <button onClick={handleCancel} className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${file ? 'border-violet-500 bg-violet-900/10' : 'border-zinc-700 hover:border-zinc-500'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".nds,.NDS" onChange={handleFileChange} className="hidden" />
            {file ? (
              <div>
                <p className="text-3xl mb-2">📁</p>
                <p className="text-violet-400 font-medium text-sm">{file.name}</p>
                <p className="text-zinc-500 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(1)} Mo</p>
              </div>
            ) : (
              <div>
                <p className="text-4xl mb-3">📂</p>
                <p className="text-zinc-300 font-medium text-sm">Cliquez ou déposez un fichier .nds</p>
                <p className="text-zinc-500 text-xs mt-1">Nintendo DS ROM · découpé en chunks de 5 Mo</p>
              </div>
            )}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Nom du jeu</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Pokémon Noir"
              disabled={uploading}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-600 outline-none transition-colors text-sm disabled:opacity-50"
              required
            />
          </div>

          {/* Barre de progression */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin inline-block" />
                  Upload en cours…
                </span>
                <span className="font-mono">
                  {progress.done} / {progress.total} chunks · {pct}%
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-violet-500 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-zinc-500 text-xs text-center">
                {Math.ceil(file.size / 1024 / 1024)} Mo découpés en {progress.total} × 5 Mo
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
              ⚠ {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-sm"
            >
              {uploading ? 'Annuler' : 'Fermer'}
            </button>
            <button
              type="submit"
              disabled={!file || !name.trim() || uploading}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
            >
              {uploading ? `${pct}%…` : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
