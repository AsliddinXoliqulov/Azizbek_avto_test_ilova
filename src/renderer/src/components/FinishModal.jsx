import { useNavigate } from 'react-router-dom'
import { useUi } from '../i18n'

function ringColor(pct) {
  if (pct >= 90) return 'var(--good)'
  if (pct >= 60) return 'var(--warn)'
  return 'var(--bad)'
}

export default function FinishModal({ result, title, onRetry }) {
  const navigate = useNavigate()
  const t = useUi()
  if (!result) return null
  const { percent, correct, wrong, skipped, total } = result
  const color = ringColor(percent)
  const passed = percent >= 90

  return (
    <div className="modal-overlay">
      <div className="glass modal">
        <div
          className="result-ring"
          style={{ background: `conic-gradient(${color} ${(percent / 100) * 360}deg, var(--stroke) 0deg)` }}
        >
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: '50%',
              background: 'rgb(var(--surface))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div className="pct" style={{ color }}>
              {percent}%
            </div>
            <div className="label">{passed ? t('passed') : t('failed')}</div>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {result.mode === 'section-exam'
              ? `${t('intermediateResult')} · ${title}`
              : `${result.resultNumber ? `${t('result', { count: result.resultNumber })} · ` : ''}${title}`}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{t('total', { count: total })}</div>
        </div>

        <div className="result-stats">
          <div className="item">
            <span className="n" style={{ color: 'var(--good)' }}>
              {correct}
            </span>
            <span className="l">{t('correct')}</span>
          </div>
          <div className="item">
            <span className="n" style={{ color: 'var(--bad)' }}>
              {wrong}
            </span>
            <span className="l">{t('wrong')}</span>
          </div>
          <div className="item">
            <span className="n" style={{ color: 'var(--warn)' }}>
              {skipped}
            </span>
            <span className="l">{t('skipped')}</span>
          </div>
        </div>

        <div className="finish-actions">
          <button className="btn btn-block" onClick={() => navigate('/')}>
            {t('home')}
          </button>
          {['exam', 'section-exam'].includes(result.mode) && (
            <button
              className="btn btn-block"
              onClick={() => navigate('/run', {
                state: { mode: 'review', attemptId: result.id, resultNumber: result.resultNumber },
              })}
            >
              {t('reviewResult')}
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={onRetry}>
            Qayta yechish
          </button>
        </div>
      </div>
    </div>
  )
}
