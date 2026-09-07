import type { FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  Check,
  CircleStop,
  Clock3,
  Diamond,
  Eye,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Radio,
  RefreshCw,
  ScanFace,
  Send,
  Sparkles,
  SunMedium,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  formatDuration,
  getPostLiveRecommendations,
  type PostLiveReport,
} from '../../capabilities/postlive/postLiveReview'
import type { LiveMetricSummary } from '../../capabilities/postlive/liveSessionMetrics'

interface PostLiveMessage {
  role: 'user' | 'assistant'
  text: string
}

interface PostLiveReviewProps {
  report: PostLiveReport
  aiSummary: string
  messages: PostLiveMessage[]
  input: string
  requestStatus: 'idle' | 'loading' | 'cancelled' | 'timeout' | 'error'
  error: string
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onRetry: () => void
  onStartNext: () => void
  onBackHome: () => void
}

const quickQuestions = [
  '下一场开场怎么优化？',
  '帮我设计互动节奏',
  '哪些设置值得复用？',
] as const

export function PostLiveReview({
  report,
  aiSummary,
  messages,
  input,
  requestStatus,
  error,
  onInputChange,
  onSubmit,
  onCancel,
  onRetry,
  onStartNext,
  onBackHome,
}: PostLiveReviewProps) {
  const recommendations = getPostLiveRecommendations(report)
  const metrics = [
    { label: '总观看', value: report.totalViews.toLocaleString(), icon: Eye },
    { label: '峰值在线', value: report.peakViewers.toLocaleString(), icon: Users },
    { label: '新增粉丝', value: `+${report.newFollowers}`, icon: UserPlus },
    { label: '评论数', value: report.commentCount.toLocaleString(), icon: MessageCircle },
    { label: '礼物', value: report.giftCount.toLocaleString(), icon: Diamond },
    { label: '新观众留存', value: `${report.retention}%`, icon: TrendingUp },
  ]
  const monitoringMetrics = [
    {
      label: '画面亮度',
      value: formatMonitoringValue(report.monitoring.brightness),
      summary: report.monitoring.brightness,
      icon: SunMedium,
    },
    {
      label: '麦克风电平',
      value: formatMonitoringValue(report.monitoring.microphone),
      summary: report.monitoring.microphone,
      icon: AudioLines,
    },
    {
      label: '人脸画面占比',
      value: formatMonitoringValue(report.monitoring.framing),
      summary: report.monitoring.framing,
      icon: ScanFace,
    },
  ]

  return (
    <main className="postlive-shell">
      <header className="postlive-topbar">
        <div className="postlive-brand">
          <span><Radio size={17} /></span>
          <strong>TikTok LIVE Studio</strong>
          <i />
          <b>播后复盘</b>
        </div>
        <div className="postlive-actions">
          <button type="button" className="postlive-ghost-button" onClick={onBackHome}>
            <ArrowLeft size={15} />返回首页
          </button>
          <button type="button" className="postlive-primary-button" onClick={onStartNext}>
            准备下一场<ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      <div className="postlive-layout">
        <section className="postlive-main">
          <div className="postlive-hero">
            <div className="postlive-success-mark"><Check size={24} /></div>
            <div>
              <span className="postlive-kicker">LIVE COMPLETED · AI REVIEW READY</span>
              <h1>做得不错，继续保持</h1>
              <p>{report.topic} · {report.strategyLabel}</p>
            </div>
            <div className="postlive-duration">
              <Clock3 size={16} />
              <span>本场时长</span>
              <b>{formatDuration(report.durationSeconds)}</b>
            </div>
          </div>

          <section className="postlive-section" aria-labelledby="postlive-data-title">
            <div className="postlive-section-heading">
              <div>
                <span>LIVE DATA</span>
                <h2 id="postlive-data-title">直播数据复盘</h2>
              </div>
              <small>观众指标为 Demo 数据</small>
            </div>
            <div className="postlive-metric-grid">
              {metrics.map(({ label, value, icon: Icon }) => (
                <article className="postlive-metric" key={label}>
                  <span><Icon size={15} /></span>
                  <small>{label}</small>
                  <b>{value}</b>
                </article>
              ))}
            </div>
            <div className="postlive-score-row">
              <div className="postlive-score">
                <span>直播表现指数</span>
                <b>{report.performanceScore}</b>
                <small>/ 100</small>
              </div>
              <div className="postlive-score-track">
                <i style={{ width: `${report.performanceScore}%` }} />
              </div>
              <p>本场已采纳 <b>{report.appliedSuggestionCount}</b> 项 Genie 建议，画面、互动与观众反馈已纳入复盘。</p>
            </div>
            <div className="postlive-monitoring-heading">
              <div>
                <span>REAL MONITORING</span>
                <h3>整场真实监控</h3>
              </div>
              <small>仅统计直播期间的有效浏览器采样</small>
            </div>
            <div className="postlive-monitoring-grid">
              {monitoringMetrics.map(({ label, value, summary, icon: Icon }) => (
                <article className="postlive-monitoring-metric" key={label}>
                  <span><Icon size={16} /></span>
                  <div>
                    <small>{label}</small>
                    <b>{value}</b>
                  </div>
                  {summary.available ? (
                    <dl>
                      <div><dt>平均评分</dt><dd>{summary.averageScore}</dd></div>
                      <div><dt>最低评分</dt><dd>{summary.minimumScore}</dd></div>
                      <div><dt>异常占比</dt><dd>{summary.issueRate}%</dd></div>
                      <div><dt>有效样本</dt><dd>{summary.sampleCount}</dd></div>
                    </dl>
                  ) : (
                    <p>本场未获得有效设备样本</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="postlive-section" aria-labelledby="postlive-advice-title">
            <div className="postlive-section-heading">
              <div>
                <span>NEXT LIVE</span>
                <h2 id="postlive-advice-title">下一场经营建议</h2>
              </div>
              <small><Sparkles size={12} />Genie 智能排序</small>
            </div>
            <div className="postlive-recommendation-list">
              {recommendations.map((recommendation, index) => (
                <article className="postlive-recommendation" key={recommendation.id}>
                  <span className="postlive-recommendation-index">0{index + 1}</span>
                  <div>
                    <small>{recommendation.label}</small>
                    <h3>{recommendation.title}</h3>
                    <p>{recommendation.detail}</p>
                  </div>
                  <em>{recommendation.impact}</em>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="postlive-genie">
          <div className="postlive-genie-heading">
            <div className="postlive-genie-icon"><Sparkles size={18} /></div>
            <div>
              <span>GENIE · POST-LIVE</span>
              <h2>AI 深度复盘</h2>
            </div>
            <i className={requestStatus === 'loading' ? 'is-working' : ''} />
          </div>

          <div className="postlive-ai-summary">
            <span><BarChart3 size={14} />本场洞察</span>
            <p>{aiSummary}</p>
          </div>

          <div className="postlive-conversation" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`postlive-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === 'assistant' ? 'Genie' : '你'}</span>
                <p>{message.text}</p>
              </article>
            ))}
            {messages.length === 0 && (
              <div className="postlive-empty-conversation">
                <Lightbulb size={18} />
                <p>告诉我你对本场直播的感受，或希望下一场重点优化什么。</p>
              </div>
            )}
          </div>

          {requestStatus === 'loading' && (
            <div className="postlive-request-state" role="status">
              <LoaderCircle size={14} className="loading-icon" />
              <span>Genie 正在结合本场数据分析…</span>
              <button type="button" onClick={onCancel}><CircleStop size={13} />取消</button>
            </div>
          )}
          {error && requestStatus !== 'loading' && (
            <div className="postlive-request-state is-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={onRetry}><RefreshCw size={13} />重试</button>
            </div>
          )}

          <div className="postlive-quick-questions">
            {quickQuestions.map((question) => (
              <button type="button" key={question} onClick={() => onInputChange(question)}>
                {question}
              </button>
            ))}
          </div>

          <form className="postlive-composer" onSubmit={onSubmit}>
            <textarea
              aria-label="向 Genie 描述本场感受或下一场优化目标"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="聊聊本场直播感受，或希望下一场提供什么优化…"
              maxLength={500}
              rows={4}
            />
            <div>
              <span>{input.length} / 500</span>
              <button
                type="submit"
                disabled={!input.trim() || requestStatus === 'loading'}
              >
                {requestStatus === 'loading'
                  ? <LoaderCircle size={15} className="loading-icon" />
                  : <Send size={15} />}
                发送给 Genie
              </button>
            </div>
          </form>
        </aside>
      </div>
    </main>
  )
}

function formatMonitoringValue(metric: LiveMetricSummary): string {
  if (!metric.available || metric.averageValue === null) return '--'
  return metric.unit === '/ 100'
    ? `${metric.averageValue} / 100`
    : `${metric.averageValue}${metric.unit}`
}
