import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[Emuste] Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes dans .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

/** URL publique d'un fichier dans le bucket "roms" */
export function getRomPublicUrl(filePath) {
  const { data } = supabase.storage.from('roms').getPublicUrl(filePath)
  return data.publicUrl
}

/** URL publique du save state auto (slot 0) d'un jeu */
export function getSavePublicUrl(romId) {
  const { data } = supabase.storage.from('saves').getPublicUrl(`${romId}/auto.state`)
  return data.publicUrl
}
