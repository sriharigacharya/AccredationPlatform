import React from 'react'

export default function StatCard({ label, value, subtext, icon: Icon, variant = 'default', change, isPositive, onClick }) {
  const variantStyles = {
    default: { iconBg: 'var(--primary-subtle)', iconColor: 'var(--primary)' },
    primary: { iconBg: 'var(--primary-subtle)', iconColor: 'var(--primary)' },
    success: { iconBg: 'var(--success-subtle)', iconColor: 'var(--success)' },
    warning: { iconBg: 'var(--warning-subtle)', iconColor: 'var(--warning)' },
    danger:  { iconBg: 'var(--danger-subtle)',  iconColor: 'var(--danger)' },
    purple:  { iconBg: 'var(--purple-subtle)',  iconColor: 'var(--purple)' },
  }

  const vStyle = variantStyles[variant] || variantStyles.default

  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div
            className="stat-icon"
            style={{ backgroundColor: vStyle.iconBg, color: vStyle.iconColor }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>

      <div className="stat-value tabular-nums">{value ?? '—'}</div>

      {(subtext || change) && (
        <div className="stat-subtext" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {change && (
            <span style={{
              fontWeight: 600,
              color: isPositive ? 'var(--success)' : isPositive === false ? 'var(--danger)' : 'var(--text-muted)'
            }}>
              {change}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  )
}
