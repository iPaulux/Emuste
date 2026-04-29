import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import RomCard from './RomCard.jsx'
import UploadModal from './UploadModal.jsx'

export default function Library({ onPlay }) {
  const [roms, setRoms]         = useState([])
  const [saves, setSaves]       = useState({})   // { [romId]: saveState }
  const [loading, setLoading]   = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError]       = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [{ data: romsData, error: e1 }, { data: savesData, error: e2 }] = await Promise.all([
        supabase.from('roms').select('*').order('created_at', { ascending: false }),
        supabase.from('save_states').select('*').eq('slot', 0)
      ])
      if (e1) throw e1
      if (e2) throw e2

      setRoms(romsData ?? [])

      const map = {}
      for (const s of (savesData ?? [])) map[s.rom_id] = s
      setSaves(map)
    } catch (err) {
      setError(err.message ?? 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePlay = (rom) => {
    onPlay({ ...rom, save: saves[rom.id] ?? null })
  }

  const handleDelete = async (rom) => {
    if (!window.confirm(`Supprimer « ${rom.name} » et toutes ses sauvegardes ?`)) return
    try {
      // Supprime tous les chunks du bucket roms
      const count = rom.chunk_count ?? 1
      const romPaths = count > 1
        ? Array.from({ length: count }, (_, i) => `${rom.id}/chunk_${String(i).padStart(4, '0')}`)
        : [rom.file_path]
      await supabase.storage.from('roms').remove(romPaths)

      if (saves[rom.id]) {
        await supabase.storage.from('saves').remove([`${rom.id}/auto.state`])
      }
      await supabase.from('roms').delete().eq('id', rom.id)
      fetchData()
    } catch (err) {
      alert('Erreur lors de la suppression : ' + err.message)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-violet-400">Emuste</span>
            <span className="text-zinc-500 text-sm font-normal ml-2">Nintendo DS</span>
          </h1>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Ajouter une ROM
        </button>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-6">
        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="max-w-md mx-auto mt-16 bg-red-900/30 border border-red-800 text-red-300 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">⚠</p>
            <p className="font-medium">Erreur de connexion Supabase</p>
            <p className="text-sm mt-1 text-red-400">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-800/50 hover:bg-red-800 rounded-lg text-sm transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && roms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center text-4xl mb-6">
              🕹️
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">Bibliothèque vide</h2>
            <p className="text-zinc-500 text-sm max-w-xs">
              Ajoutez vos ROMs Nintendo DS (.nds) pour commencer à jouer depuis n'importe quelle machine.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              + Ajouter une ROM
            </button>
          </div>
        )}

        {!loading && !error && roms.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {roms.map(rom => (
              <RomCard
                key={rom.id}
                rom={rom}
                save={saves[rom.id] ?? null}
                onPlay={() => handlePlay(rom)}
                onDelete={() => handleDelete(rom)}
              />
            ))}
          </div>
        )}
      </main>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchData() }}
        />
      )}
    </div>
  )
}
