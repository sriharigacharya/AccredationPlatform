import React from 'react'

export default function Badge({ variant = 'neutral', icon: Icon, dot = false, children, className = '', style = {} }) {
  const variantClass = `badge-${variant}`

  return (
    <span className={`badge ${variantClass} ${className}`} style={style}>
      {dot && <span className="badge-dot" />}
      {Icon && <Icon size={11} style={{ flexShrink: 0 }} />}
      <span>{children}</span>
    </span>
  )
}
