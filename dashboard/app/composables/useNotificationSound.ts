/**
 * ==========================================================
 * Fichier :
 * useNotificationSound.ts
 * 
 * Description :
 * Composable gérant l'alarme de notification en réutilisant un seul AudioContext.
 * Évite les fuites de mémoire et respecte les règles de sécurité de lecture audio des navigateurs.
 * 
 * Projet :
 * Zemy
 * ==========================================================
 */

let audioCtx: AudioContext | null = null

export function useNotificationSound() {
  const playAlarm = () => {
    if (typeof window === 'undefined') return

    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          audioCtx = new AudioContextClass()
        }
      }

      if (audioCtx) {
        // Reprendre le contexte s'il a été suspendu par le navigateur (politique d'autoplay)
        if (audioCtx.state === 'suspended') {
          audioCtx.resume()
        }

        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()

        osc.type = 'square'
        osc.frequency.setValueAtTime(600, audioCtx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1)

        gain.gain.setValueAtTime(0, audioCtx.currentTime)
        gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05)
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4)

        osc.connect(gain)
        gain.connect(audioCtx.destination)

        osc.start()
        osc.stop(audioCtx.currentTime + 0.4)
      }
    } catch (e) {
      console.warn('Impossible de jouer le son de notification:', e)
    }
  }

  return {
    playAlarm
  }
}
