import { useState, useRef, useEffect } from 'react'

const PIN    = '1158'
const KEY    = 'emuste_unlocked'
const DIGITS = 4

export default function PinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(KEY) === '1')
  const [digits, setDigits]     = useState(['', '', '', ''])
  const [shake, setShake]       = useState(false)
  const inputs = useRef([])

  useEffect(() => { if (!unlocked) inputs.current[0]?.focus() }, [unlocked])

  if (unlocked) return children

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < DIGITS - 1) inputs.current[i + 1]?.focus()

    // Vérifie dès que les 4 chiffres sont remplis
    if (next.every(d => d !== '') ) {
      const entered = next.join('')
      if (entered === PIN) {
        sessionStorage.setItem(KEY, '1')
        setUnlocked(true)
      } else {
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setDigits(['', '', '', ''])
          inputs.current[0]?.focus()
        }, 600)
      }
    }
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">🎮</span>
        <h1 className="text-2xl font-bold text-violet-400 tracking-tight">Emuste</h1>
        <p className="text-zinc-500 text-sm">Entrez le code PIN</p>
      </div>

      {/* Champs PIN */}
      <div className={`flex gap-4 ${shake ? 'animate-shake' : ''}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => inputs.current[i] = el}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-14 h-16 text-center text-2xl font-bold rounded-2xl border-2 bg-zinc-900 text-zinc-100 outline-none transition-all
              ${d ? 'border-violet-500' : 'border-zinc-700'}
              ${shake ? 'border-red-500 bg-red-900/20' : ''}
              focus:border-violet-400`}
          />
        ))}
      </div>

      <p className="text-zinc-700 text-xs">Session sécurisée · accès personnel</p>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease; }
      `}</style>
    </div>
  )
}
