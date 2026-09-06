import React from 'react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      background: 'var(--bg-surface)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      width: '100%',
    }}>
      {Icon && (
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          marginBottom: 16,
        }}>
          <Icon size={20} />
        </div>
      )}

      {title && (
        <h3 style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}>
          {title}
        </h3>
      )}

      {description && (
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          maxWidth: '420px',
          lineHeight: 1.5,
          marginBottom: action ? 18 : 0,
        }}>
          {description}
        </p>
      )}

      {action && (
        <div style={{ marginTop: 4 }}>
          {action}
        </div>
      )}
    </div>
  )
}
