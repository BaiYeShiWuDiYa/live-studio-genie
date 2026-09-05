import { dbToLinearGain } from './audioProcessor'

const BASE_OUTPUT_GAIN = 0.08
const CHORD_DURATION_MS = 1800
const chordSequence = [
  [261.63, 329.63, 392],
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
]

export interface BackgroundMusicPlayer {
  setGainDb: (gainDb: number) => void
  close: () => void
}

export function dbToBackgroundMusicGain(gainDb: number): number {
  return BASE_OUTPUT_GAIN * dbToLinearGain(gainDb)
}

export function createBackgroundMusicPlayer(gainDb = 0): BackgroundMusicPlayer {
  const audioContext = new AudioContext()
  const masterGain = audioContext.createGain()
  const filter = audioContext.createBiquadFilter()
  const oscillators = chordSequence[0].map((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const voiceGain = audioContext.createGain()
    oscillator.type = index === 0 ? 'sine' : 'triangle'
    oscillator.frequency.value = frequency
    voiceGain.gain.value = index === 0 ? 0.42 : 0.2
    oscillator.connect(voiceGain)
    voiceGain.connect(filter)
    oscillator.start()
    return { oscillator, voiceGain }
  })
  let chordIndex = 0

  filter.type = 'lowpass'
  filter.frequency.value = 900
  filter.Q.value = 0.7
  filter.connect(masterGain)
  masterGain.connect(audioContext.destination)
  masterGain.gain.value = dbToBackgroundMusicGain(gainDb)
  void audioContext.resume()

  const intervalId = globalThis.setInterval(() => {
    chordIndex = (chordIndex + 1) % chordSequence.length
    chordSequence[chordIndex].forEach((frequency, index) => {
      oscillators[index].oscillator.frequency.setTargetAtTime(
        frequency,
        audioContext.currentTime,
        0.08,
      )
    })
  }, CHORD_DURATION_MS)

  return {
    setGainDb: (nextGainDb) => {
      masterGain.gain.setTargetAtTime(
        dbToBackgroundMusicGain(nextGainDb),
        audioContext.currentTime,
        0.04,
      )
    },
    close: () => {
      globalThis.clearInterval(intervalId)
      oscillators.forEach(({ oscillator, voiceGain }) => {
        oscillator.stop()
        oscillator.disconnect()
        voiceGain.disconnect()
      })
      filter.disconnect()
      masterGain.disconnect()
      void audioContext.close()
    },
  }
}
