import React from 'react'

export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="tabs-container" role="tablist">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {Icon && <Icon size={15} style={{ flexShrink: 0 }} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isActive ? 'var(--primary-subtle)' : 'rgba(255, 255, 255, 0.06)',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                marginLeft: 4,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
