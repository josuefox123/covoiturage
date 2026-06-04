import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#EFF6FF',
          DEFAULT: '#3B82F6',
          dark: '#1D4ED8',
        },
        secondary: {
          light: '#E0F2FE',
          DEFAULT: '#0284C7',
          dark: '#0369A1',
        },
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: {
          DEFAULT: '#0F172A',
          light: '#475569',
          muted: '#94A3B8',
        },
        border: '#E2E8F0',
        success: {
          light: '#D1FAE5',
          DEFAULT: '#10B981',
        },
        error: {
          light: '#FEE2E2',
          DEFAULT: '#EF4444',
        },
        warning: {
          light: '#FEF3C7',
          DEFAULT: '#F59E0B',
          dark: '#B45309',
        },
      }
    }
  }
}
