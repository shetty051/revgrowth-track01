import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#FFFFFF',
          off: '#F7F8FA',
        },
        text: {
          primary: '#0E1116',
          muted: '#68737D',
        },
        accent: {
          DEFAULT: '#3B5BFF',
          hover: '#2A4AEB',
        },
        border: {
          DEFAULT: '#EEF0F3',
          dark: '#E2E5EA',
        },
        badge: {
          riskBg: '#FFF2F2',
          riskText: '#DC2626',
          successBg: '#F0FDF4',
          successText: '#16A34A',
          neutralBg: '#F3F4F6',
          neutralText: '#4B5563',
        }
      },
      spacing: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
      },
      borderRadius: {
        'card': '12px',
      },
      boxShadow: {
        'card-hover': '0 4px 12px rgba(14, 17, 22, 0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.035em',
        tight: '-0.02em',
      }
    },
  },
  plugins: [],
} satisfies Config;
