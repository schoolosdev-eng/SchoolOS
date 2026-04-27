import React from 'react'

type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'dark'
  | 'ghost'

type AppButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant
  fullWidth?: boolean
}

export default function AppButton({
  children,
  variant = 'primary',
  fullWidth = false,
  style,
  ...props
}: AppButtonProps) {
  const baseStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderRadius: 14,
    border: 'none',
    color: '#ffffff',
    fontWeight: 800,
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    fontSize: 15,
    width: fullWidth ? '100%' : undefined,
    transition:
      'transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease',
  }

  const variants: Record<AppButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    },
    secondary: {
      background: '#64748b',
    },
    success: {
      background: '#16a34a',
    },
    danger: {
      background: '#dc2626',
    },
    dark: {
      background: '#0f172a',
    },
    ghost: {
      background: '#ffffff',
      color: '#0f172a',
      border: '1px solid #cbd5e1',
    },
  }

  return (
    <button
      {...props}
      style={{
        ...baseStyle,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}