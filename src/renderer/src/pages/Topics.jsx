import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import MenuCard from '../components/MenuCard'
import { useLanguage, useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'

export default function Topics({ teacher = false }) {
  const [sections, setSections] = useState(null)
  const navigate = useNavigate()
  const { language } = useLanguage()
  const t = useUi()
  const databaseRevision = useDatabaseRevision()

  useEffect(() => {
    window.api.catalog.sections().then(setSections)
  }, [language, databaseRevision])

  return (
    <div>
      <div className="page-header section-page-header">
        <div>
          <h1>
            {teacher ? `${t('teacher')} - ${t('lessons')}` : t('sectionsTitle')}
          </h1>
          <div className="sub">
            {teacher
              ? t('teacherLessonsDesc')
              : sections == null
                ? null
                : t('sectionCount', { count: sections.length })}
          </div>
        </div>
      </div>

      {sections == null ? null : (
        <div className="menu-grid menu-grid-list section-list-cards">
          {sections.length === 0 ? (
            <EmptyState emoji="" title={t('sectionMissing')} />
          ) : (
            sections.map((section) => (
              <div
                key={section.id}
                className="glass menu-card"
                onClick={() =>
                  navigate(
                    `${teacher ? '/teacher/lessons' : '/lessons'}/${section.id}`,
                    { state: { title: section.name } }
                  )
                }
              >
                <h3>{section.name}</h3>
                {!teacher && (
                  <p>
                    {section.lessonCount} ta dars · {section.questionCount} ta
                    savol
                  </p>
                )}
              </div>
            ))
          )}
          {!teacher && <MenuCard to="/custom" title={t('generalTest')} />}
        </div>
      )}
    </div>
  )
}
