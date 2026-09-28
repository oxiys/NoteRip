/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        crimson: {
          bg: '#0E1116',
          sidebar: '#131720',
          surface: '#171B22',
          card: '#171B22',
          cardHover: '#1C212B',
          border: '#272C36',
          borderStrong: '#3A4150',
          text: '#F3F4F6',
          secondary: '#9CA3AF',
          muted: '#6B7280',
          accent: '#E5484D',
          accentHover: '#F05D62',
          accentSubtle: 'rgba(229, 72, 77, 0.12)',
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '14px',
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "Courier New",
          "monospace"
        ]
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'menu': '0 4px 16px -2px rgba(0, 0, 0, 0.5)',
        'popover': '0 8px 24px -4px rgba(0, 0, 0, 0.6)',
        'apple-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'apple-md': '0 4px 12px 0 rgba(0, 0, 0, 0.4)',
        'apple-lg': '0 8px 20px 0 rgba(0, 0, 0, 0.5)',
        'apple-popover': '0 8px 24px -4px rgba(0, 0, 0, 0.6)',
      }
    },
  },
  plugins: [],
}
