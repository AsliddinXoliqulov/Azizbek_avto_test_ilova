import { Link } from 'react-router-dom'
import { useUi } from '../i18n'
import { IconArrowRight, IconBook, IconExam, IconGrid, IconList } from '../components/Icons'
import heroCar from '../../../hero-car.webp'

export default function Home() {
  const t = useUi()

  const tiles = [
    { to: '/topics', tone: 'lessons', Icon: IconBook, title: t('lessons') },
    { to: '/exam', tone: 'exam', Icon: IconExam, title: t('realExam') },
    { to: '/question-practice', tone: 'practice', Icon: IconList, title: t('questions') },
    { to: '/variants', tone: 'variants', Icon: IconGrid, title: t('variants') },
  ]

  return (
    <div className="home-page hm">
      <section className="hm-hero" aria-labelledby="hm-title">
        <div className="hm-hero-media">
          <img src={heroCar} alt="" width="960" height="492" decoding="async" />
          <span className="hm-beam hm-beam-l" aria-hidden="true" />
          <span className="hm-beam hm-beam-r" aria-hidden="true" />
        </div>
        <div className="hm-hero-copy">
          <h1 id="hm-title">{t('heroTitle')}</h1>
          <p>{t('heroSub')}</p>
        </div>
      </section>

      <nav className="hm-tiles" aria-label={t('mainMenu')}>
        {tiles.map(({ to, tone, Icon, title }) => (
          <Link key={to} to={to} className={`hm-tile hm-tile-${tone}`}>
            <span className="hm-tile-icon">
              <Icon />
            </span>
            <span className="hm-tile-copy">
              <strong>{title}</strong>
            </span>
            <IconArrowRight className="hm-tile-go" />
          </Link>
        ))}
      </nav>
    </div>
  )
}
