import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { useLanguage, useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'

export default function Variants() {
  const [variants, setVariants] = useState(null)
  const t = useUi()
  const { language } = useLanguage()
  const navigate = useNavigate()
  const databaseRevision = useDatabaseRevision()

  useEffect(() => {
    window.api.catalog.variants().then(setVariants)
  }, [language, databaseRevision])

  return (
    <div className="variants-page">
      <div className="page-header">
        <div>
          <h1>{t('variants')}</h1>
          <div className="sub">{t('variantsDesc')}</div>
        </div>
      </div>
      {variants == null ? null : variants.length === 0 ? (
        <EmptyState
          emoji=""
          title={t('noVariants')}
          hint={t('noVariantsHint')}
        />
      ) : (
        <div className="menu-grid variant-grid">
          {variants.map((variant, index) => (
            <article
              className={`glass menu-card${variant.kind === 'admin-new' ? ' variant-new' : ''}`}
              key={variant.id ?? index}
              onClick={() =>
                navigate('/run', {
                  state: {
                    mode: 'variant',
                    variantKind: variant.kind,
                    variantNumber: variant.variantNumber,
                    variantId: variant.variantId,
                    count: variant.variantIndex,
                  },
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate('/run', {
                    state: {
                      mode: 'variant',
                      variantKind: variant.kind,
                      variantNumber: variant.variantNumber,
                      variantId: variant.variantId,
                      count: variant.variantIndex,
                    },
                  })
                }
              }}
            >
              <h3>
                {variant.kind === 'admin-new' ? (
                  <>
                    Variant{' '}
                    <span className="variant-new-number">
                      {variant.variantNumber}
                    </span>
                  </>
                ) : (
                  variant.title ||
                  variant.name ||
                  `${t('variants')} ${index + 1}`
                )}
              </h3>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
