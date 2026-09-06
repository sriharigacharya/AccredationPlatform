import React from 'react'

export default function PageHeader({ title, description, badge, actions, category }) {
  return (
    <header className="page-header">
      <div className="page-header-top">
        <div>
          {category && (
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--primary)',
              marginBottom: 4
            }}>
              {category}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title">{title}</h1>
            {badge && (
              <span className="badge badge-neutral" style={{ fontWeight: 600, fontSize: '11.5px' }}>
                {badge}
              </span>
            )}
          </div>
        </div>

        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>

      {description && (
        <p className="page-desc">{description}</p>
      )}
    </header>
  )
}
