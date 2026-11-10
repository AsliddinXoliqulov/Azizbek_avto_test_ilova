import MenuCard from '../components/MenuCard'
import { useUi } from '../i18n'
import lessonsIcon from '../../../dars.svg'
import examIcon from '../../../imtihon-thin.svg'

export default function Home() {
  const t = useUi()

  return (
    <div className="home-page">
      <div className="menu-grid menu-grid-list">
        <MenuCard
          to="/topics"
          title={t('lessons')}
          icon={<img className="home-icon-image" src={lessonsIcon} alt="" />}
        />
        <MenuCard
          to="/exam"
          title={t('realExam')}
          icon={<img className="home-icon-image" src={examIcon} alt="" />}
        />
        <MenuCard
          to="/question-practice"
          title={t('questions')}
          className="home-practice-group"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5h12M9 12h12M9 19h12" />
              <circle cx="4" cy="5" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="19" r="1" />
            </svg>
          }
        />
        <MenuCard
          to="/variants"
          title={t('variants')}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="8" height="7" rx="1.5" />
              <rect x="13" y="4" width="8" height="7" rx="1.5" />
              <rect x="3" y="13" width="8" height="7" rx="1.5" />
              <rect x="13" y="13" width="8" height="7" rx="1.5" />
            </svg>
          }
        />
      </div>
    </div>
  )
}
