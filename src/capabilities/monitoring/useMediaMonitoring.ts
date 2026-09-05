import { useEffect, type RefObject } from 'react'
import { useStudioStore } from '../../store/studioStore'
import {
  calculateAudioDecibels,
  calculateBrightness,
  createAudioMetric,
  createBrightnessMetric,
} from './mediaAnalysis'
import type { MediaMetric } from './types'

const measuringMetric: MediaMetric = {
  score: 0,
  value: '检测中',
  tone: 'warn',
  status: 'measuring',
  updatedAt: 0,
}

const unavailableMetric: MediaMetric = {
  score: 0,
  value: '设备不可用',
  tone: 'bad',
  status: 'unavailable',
  updatedAt: 0,
}

interface UseMediaMonitoringOptions {
  videoRef: RefObject<HTMLVideoElement>
  stream: MediaStream | null
  cameraEnabled: boolean
  microphoneMuted: boolean
}

export function useMediaMonitoring({
  videoRef,
  stream,
  cameraEnabled,
  microphoneMuted,
}: UseMediaMonitoringOptions) {
  const updateMetric = useStudioStore((state) => state.updateMediaMetric)
  const resetMetric = useStudioStore((state) => state.resetMediaMetric)

  useEffect(() => {
    if (!cameraEnabled) {
      resetMetric('brightness')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      updateMetric('brightness', unavailableMetric)
      return
    }

    let smoothedBrightness: number | null = null
    updateMetric('brightness', measuringMetric)

    const measure = () => {
      const video = videoRef.current
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return

      const sourceWidth = video.videoWidth * 0.6
      const sourceHeight = video.videoHeight * 0.8
      const sourceX = (video.videoWidth - sourceWidth) / 2
      const sourceY = (video.videoHeight - sourceHeight) / 2

      context.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      const brightness = calculateBrightness(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
      )
      smoothedBrightness = smoothedBrightness === null
        ? brightness
        : smoothedBrightness * 0.65 + brightness * 0.35
      updateMetric('brightness', createBrightnessMetric(smoothedBrightness))
    }

    measure()
    const interval = window.setInterval(measure, 900)
    return () => window.clearInterval(interval)
  }, [cameraEnabled, resetMetric, updateMetric, videoRef])

  useEffect(() => {
    if (!stream) {
      resetMetric('microphone')
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      updateMetric('microphone', unavailableMetric)
      return
    }

    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks))
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.7
    source.connect(analyser)

    const samples = new Float32Array(analyser.fftSize)
    let smoothedDecibels = -60
    updateMetric('microphone', measuringMetric)
    void audioContext.resume()

    const measure = () => {
      analyser.getFloatTimeDomainData(samples)
      const decibels = calculateAudioDecibels(samples)
      smoothedDecibels = smoothedDecibels * 0.65 + decibels * 0.35
      updateMetric('microphone', createAudioMetric(smoothedDecibels, microphoneMuted))
    }

    measure()
    const interval = window.setInterval(measure, 250)
    return () => {
      window.clearInterval(interval)
      source.disconnect()
      analyser.disconnect()
      void audioContext.close()
    }
  }, [microphoneMuted, resetMetric, stream, updateMetric])
}
