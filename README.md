# 🎮 Emuste — Nintendo DS Emulator PWA

Application web progressive pour jouer à vos ROMs Nintendo DS depuis n'importe quel appareil, avec sauvegarde cloud automatique.

---

## Stack

| Couche | Techno |
|---|---|
| Frontend | React 18 + Vite |
| Style | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL) |
| Stockage fichiers | Supabase Storage |
| Émulation | EmulatorJS · core **melonDS** |
| PWA | vite-plugin-pwa + Workbox |

---

## Fonctionnalités

- 🔒 **PIN gate** — accès protégé par code à 4 chiffres (session)
- 📚 **Bibliothèque** — grille de ROMs avec aperçu du dernier save state
- ⬆️ **Upload chunké** — fichiers découpés en blocs de 5 Mo et uploadés 4 en parallèle (contourne la limite 50 Mo du plan gratuit Supabase)
- ▶️ **Émulation DS** — melonDS via EmulatorJS, DirectBoot activé (pas de BIOS requis pour la majorité des jeux)
- ☁️ **Save states cloud** — synchronisation automatique à chaque sauvegarde, chargement cross-device au démarrage
- 📱 **PWA installable** — fonctionne comme une app native, EmulatorJS mis en cache pour les sessions suivantes

---

## Prérequis

- Node.js ≥ 18
- Un compte [Supabase](https://supabase.com) (plan gratuit suffisant)

---

## Installation

```bash
git clone <repo>
cd emuste
npm install
cp .env.example .env   # puis remplir les variables
```

### Variables d'environnement

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Disponibles dans **Supabase Dashboard → Project Settings → API**.

---

## Setup Supabase

Dans **SQL Editor → New Query**, coller et exécuter l'intégralité de [`supabase-setup.sql`](./supabase-setup.sql).

Ce script crée :
- Les tables `roms` et `save_states`
- Les buckets Storage `roms` (1 Go max/fichier) et `saves` (20 Mo max)
- Toutes les policies d'accès public
- Désactive le RLS (app sans authentification)

> **Si la base existait déjà**, exécuter en plus :
> ```sql
> alter table roms add column if not exists chunk_count integer not null default 1;
> alter table roms        disable row level security;
> alter table save_states disable row level security;
> ```

---

## Lancement

```bash
npm run dev      # développement → http://localhost:5173
npm run build    # production (dossier dist/)
npm run preview  # prévisualiser le build
```

---

## Déploiement (Netlify)

```bash
npm run build
# déployer le dossier dist/
```

Ou connecter le repo GitHub à Netlify avec :
- **Build command** : `npm run build`
- **Publish directory** : `dist`

Penser à ajouter les variables d'environnement dans **Netlify → Site settings → Environment variables**.

---

## Architecture

```
src/
├── main.jsx                 # Entrée — enveloppe PinGate + App
├── App.jsx                  # Routage simple Library ↔ Emulator
├── lib/supabase.js          # Client Supabase + helpers URL publiques
└── components/
    ├── PinGate.jsx          # Écran de protection PIN (sessionStorage)
    ├── Library.jsx          # Grille de ROMs, fetch Supabase
    ├── RomCard.jsx          # Carte jeu : aperçu, taille, date save
    ├── UploadModal.jsx      # Upload chunké + parallèle avec progression
    └── Emulator.jsx         # iframe + réception save state via postMessage

public/
└── emulator.html            # Page isolée chargée dans l'iframe
                             # Télécharge les chunks → assemble en Blob URL
                             # Gère save/load state ↔ parent via postMessage
```

### Flux upload

```
Fichier .nds  →  découpe en blocs de 5 Mo
              →  upload 4 blocs en parallèle → Supabase Storage (bucket roms)
              →  INSERT roms { id, name, chunk_count, … }
```

### Flux lecture cross-device

```
Clic "Jouer"  →  iframe /emulator.html?romId=…&chunks=N&supabase=…
              →  télécharge N blocs en parallèle (6 connexions simultanées)
              →  assemble ArrayBuffers → Blob → URL.createObjectURL()
              →  si save cloud existant → EJS_saveStateURL (chargement auto)
              →  EmulatorJS (melonDS) démarre
```

### Flux save state

```
Bouton Save (dans EmulatorJS)
              →  EJS_onSaveState(e) intercepté dans l'iframe
              →  postMessage { state: Uint8Array, screenshot } → parent
              →  upload binaire → saves/{romId}/auto.state  (upsert)
              →  upsert save_states en base
```

---

## Limitations connues

| Limite | Détail |
|---|---|
| BIOS DS | Certains jeux NDSi-enhanced nécessitent les fichiers BIOS officiels (non distribués légalement) |
| Load state cross-device | Nécessite de relancer le jeu pour charger le save depuis le cloud |
| Battery save (.sav) | Stocké localement par EmulatorJS (IndexedDB), non synchronisé cloud |
| Supabase Free | 500 Mo de storage total · 2 Go de bande passante/mois |

---

## PIN

Pour le changer : constante `PIN` dans `src/components/PinGate.jsx`.  
Le PIN est vérifié côté client et mémorisé en `sessionStorage` (reset à la fermeture de l'onglet).
