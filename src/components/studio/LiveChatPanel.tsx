import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Activity, Camera, Check, Gift, MessageCircle, Mic, Send } from 'lucide-react'
import type { AudienceComment, AudienceSnapshot } from '../../capabilities/audience/audienceEvents'
import type { LiveDiagnostics } from '../../capabilities/monitoring/liveDiagnostics'

type LiveChatPanelProps = {
  isLive: boolean
  cameraEnabled: boolean
  isMicMuted: boolean
  audience: AudienceSnapshot
  diagnostics?: LiveDiagnostics
  hostComments: AudienceComment[]
  onSendComment: (text: string) => void
}

const chatTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function LiveChatPanel({
  isLive,
  cameraEnabled,
  isMicMuted,
  audience,
  diagnostics,
  hostComments,
  onSendComment,
}: LiveChatPanelProps) {
  const [draft, setDraft] = useState('')
  const commentListRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const comments = [...audience.comments, ...hostComments]
    .sort((left, right) => left.occurredAt - right.occurredAt)
  const lastCommentId = comments.at(-1)?.id

  useEffect(() => {
    const list = commentListRef.current
    if (list && stickToBottomRef.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [lastCommentId, isLive])

  const submitComment = () => {
    const text = draft.trim()
    if (!isLive || !text) return
    onSendComment(text)
    setDraft('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitComment()
  }

  const devices = [
    { icon: <Camera size={13} />, name: '摄像头', status: cameraEnabled ? '已连接' : '演示画面', ok: cameraEnabled },
    { icon: <Mic size={13} />, name: '麦克风', status: isMicMuted ? '已静音' : '正常', ok: !isMicMuted },
    { icon: <Activity size={13} />, name: '网络', status: '稳定 · 42ms', ok: true },
  ]
  const monitorSignals = diagnostics
    ? [...diagnostics.goodSignals, ...diagnostics.improvements]
    : []

  return (
    <div className={`live-chat-panel${isLive ? ' is-live' : ''}`}>
      <div
        className={`live-chat-devices${isLive ? ' is-monitoring' : ''}`}
        aria-label={isLive ? '实时监控指标' : '设备状态'}
      >
        {isLive
          ? monitorSignals.map((signal) => (
            <span
              className={`live-chat-device live-monitor-tag tone-${signal.tone}`}
              key={signal.id}
              title={`${signal.label} ${signal.value} ${signal.trendLabel}`}
            >
              <b>{signal.label}</b>
              <i aria-label={signal.direction === 'up' ? '上升' : '下降'}>
                {signal.direction === 'up' ? '↑' : '↓'}
              </i>
            </span>
          ))
          : devices.map((device) => (
            <span className="live-chat-device" key={device.name}>
              {device.icon}
              <b>{device.name}</b>
              <i className={device.ok ? 'is-ok' : 'is-warn'}>
                {device.ok && <Check size={10} strokeWidth={3} />}
                {device.status}
              </i>
            </span>
          ))}
      </div>

      <section className="live-chat-gifts" aria-label="礼物区">
        <h2 className="live-chat-title">LIVE Chat</h2>
        {isLive && audience.gifts.length > 0 ? (
          <div className="live-chat-gift-list">
            {audience.gifts.slice(0, 3).map((gift) => (
              <div className="live-chat-gift-row" key={gift.id}>
                <i>{gift.icon}</i>
                <span><b>{gift.userName}</b> 送出 <em>{gift.giftName}</em> ×{gift.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="live-chat-empty live-chat-gift-empty">
            <Gift size={34} strokeWidth={1.4} />
            <p>Gifts and subscriptions will appear here.</p>
          </div>
        )}
      </section>

      <section className="live-chat-comments" aria-label="评论区">
        {isLive && comments.length > 0 ? (
          <div
            className="prototype-comment-list live-chat-comment-list"
            ref={commentListRef}
            role="log"
            aria-label="实时评论列表"
            aria-live="polite"
            tabIndex={0}
            onScroll={(event) => {
              const list = event.currentTarget
              stickToBottomRef.current =
                list.scrollHeight - list.scrollTop - list.clientHeight < 24
            }}
          >
            <div className="live-chat-comment-content">
              {comments.map((comment, index) => (
                <div className="prototype-comment" key={comment.id}>
                  <i className={`avatar avatar-${(index % 4) + 1}`}>{comment.userName.slice(0, 1)}</i>
                  <span><b>{comment.userName}:</b> {comment.text}</span>
                  <time dateTime={new Date(comment.occurredAt).toISOString()}>
                    {chatTimeFormatter.format(comment.occurredAt)}
                  </time>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="live-chat-empty live-chat-comment-empty">
            <MessageCircle size={42} strokeWidth={1.4} />
            <p>Messages and gifts would be shown<br />when you start streaming.</p>
          </div>
        )}

        <form
          className={`live-chat-input${isLive ? '' : ' is-disabled'}`}
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            value={draft}
            disabled={!isLive}
            maxLength={120}
            placeholder="Add comment..."
            title={isLive ? undefined : 'Available when you go live.'}
            aria-label="评论输入框"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="live-chat-send"
            disabled={!isLive || !draft.trim()}
            aria-label="发送评论"
          >
            <Send size={15} />
          </button>
        </form>
      </section>
    </div>
  )
}
