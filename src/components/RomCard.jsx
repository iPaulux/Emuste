function fmtSize(bytes) {
  if (!bytes) return '?'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} Mo`
  return `${(bytes / 1024).toFixed(0)} Ko`
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RomCard({ rom, save, onPlay, onDelete }) {
  return (
    <div className="group flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-violet-600/60 transition-all duration-200">
      {/* Thumbnail / preview */}
      <div className="relative aspect-video bg-zinc-800 flex items-center justify-center overflow-hidden">
        {save?.screenshot ? (
          <img
            src={save.screenshot}
            alt={`Preview ${rom.name}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <span className="text-5xl">🎮</span>
            <span className="text-xs font-mono">NDS</span>
          </div>
        )}

        {/* Badge sauvegarde cloud */}
        {save && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/80 backdrop-blur text-white text-xs font-medium px-2 py-0.5 rounded-full">
            ☁ Sauvegarde
          </span>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 px-4 pt-3 pb-1">
        <h3 className="font-semibold text-zinc-100 truncate text-sm" title={rom.name}>
          {rom.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-zinc-500 text-xs">{fmtSize(rom.file_size)}</span>
          {save ? (
            <span className="text-green-500 text-xs" title={`Sauvegardé le ${fmtDate(save.updated_at)}`}>
              ✓ {fmtDate(save.updated_at)}
            </span>
          ) : (
            <span className="text-zinc-600 text-xs">{fmtDate(rom.created_at)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4 pt-2">
        <button
          onClick={onPlay}
          className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium py-2 rounded-xl transition-colors"
        >
          <span>▶</span> Jouer
        </button>
        <button
          onClick={onDelete}
          title="Supprimer ce jeu"
          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-red-900/60 text-zinc-500 hover:text-red-400 transition-colors text-sm"
        >
          🗑
        </button>
      </div>
    </div>
  )
}
