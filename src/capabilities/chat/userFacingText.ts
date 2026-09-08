const technicalIdentifierPattern =
  /\b(?:version|type|title|detail|actionLabel|props|settings|signalId|queueId|componentId|analysisSource|cameraEffects|imageDataUrl|GENIE_MODEL_AK|NO_ACTION|camera-effects|visual-adjustment|audio-adjustment|audience-poll|live-goal)\b/i

const technicalValuePattern =
  /(亮度|曝光|对比(?:度)?|色温|饱和度|柔肤|磨皮|美白|红润|清晰度?|口红|腮红|眼影|眼线|高光|麦克风增益|背景音乐增益)\s*[+\-＋－]?\d+(?:\.\d+)?\s*(?:%|dB)?/gi

export function sanitizeUserFacingText(
  content: string,
  fallback = '我已结合当前状态整理好建议，请查看下方可操作内容。',
): string {
  const withoutProtocol = content
    .replace(/<widget\b[^>]*>[\s\S]*?<\/widget>/gi, ' ')
    .replace(/<widget\b[^>]*>[\s\S]*$/gi, ' ')
    .replace(/```(?:json|javascript|typescript|tsx|jsx)?[\s\S]*?```/gi, ' ')
    .replace(/<\/?widget\b[^>]*>/gi, ' ')
    .replace(technicalValuePattern, '$1适度调整')
    .replace(/麦克风增益/g, '麦克风音量')
    .replace(/背景音乐增益/g, '背景音乐音量')
    .replace(/曝光/g, '画面亮度')
    .replace(/对比(?:度)?/g, '画面层次')
    .replace(/参数/g, '效果')
    .replace(/画面亮度微提/g, '适当提亮画面')
    .replace(/把适当提亮画面/g, '适当提亮画面')

  const naturalLines = withoutProtocol
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:#{1,6}|[-*]\s+|\d+[.)]\s+)/, '')
      .replace(/\*\*|__|`/g, '')
      .trim())
    .filter((line) =>
      line &&
      !technicalIdentifierPattern.test(line) &&
      !/[{}[\]]/.test(line) &&
      !/^[A-Za-z_$][\w$.-]*\s*[:=]/.test(line),
    )

  const text = naturalLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。！？；：,.!?;:])/g, '$1')
    .trim()

  return text || fallback
}
