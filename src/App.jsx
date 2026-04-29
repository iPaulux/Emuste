import { useState } from 'react'
import Library from './components/Library.jsx'
import Emulator from './components/Emulator.jsx'

export default function App() {
  // currentRom : null → vue bibliothèque | objet rom → vue émulateur
  const [currentRom, setCurrentRom] = useState(null)

  if (currentRom) {
    return (
      <Emulator
        rom={currentRom}
        onBack={() => setCurrentRom(null)}
      />
    )
  }

  return <Library onPlay={setCurrentRom} />
}
