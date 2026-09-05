import { stopMediaStream } from '../media/browserMedia'

export interface AudioProcessor {
  stream: MediaStream
  setGainDb: (gainDb: number) => void
  close: () => void
}

export function dbToLinearGain(gainDb: number): number {
  return 10 ** (gainDb / 20)
}

export function createAudioProcessor(inputStream: MediaStream): AudioProcessor | null {
  const audioTracks = inputStream.getAudioTracks()
  if (audioTracks.length === 0) return null

  const audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks))
  const gainNode = audioContext.createGain()
  const destination = audioContext.createMediaStreamDestination()
  source.connect(gainNode)
  gainNode.connect(destination)
  void audioContext.resume()

  return {
    stream: destination.stream,
    setGainDb: (gainDb) => {
      const linearGain = dbToLinearGain(gainDb)
      gainNode.gain.setTargetAtTime(linearGain, audioContext.currentTime, 0.04)
    },
    close: () => {
      source.disconnect()
      gainNode.disconnect()
      stopMediaStream(destination.stream)
      void audioContext.close()
    },
  }
}
