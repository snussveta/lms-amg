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
        // Requested Corporate Palette
        accent: {
          DEFAULT: '#E30613',
          50: '#FEF2F2',
          100: '#FDE8E9',
          200: '#FBD0D3',
          300: '#F8A1A7',
          400: '#F1525C',
          500: '#E30613',
          600: '#C70510',
          700: '#A8040E',
          800: '#8A040B',
          900: '#72030A',
        },
        navy: {
          DEFAULT: '#003B73',
          50: '#F0F5FA',
          100: '#E1EDF7',
          200: '#B8D5ED',
          300: '#8EBDE3',
          400: '#4F96D1',
          500: '#1A72BE',
          600: '#0052A3',
          700: '#004385',
          800: '#003B73',
          900: '#002F5C',
          950: '#002040',
        },
        brand: {
          50: '#F0F5FA',
          100: '#E1EDF7',
          200: '#B8D5ED',
          300: '#8EBDE3',
          400: '#4F96D1',
          500: '#003B73',
          600: '#002F5C',
          700: '#002548',
          800: '#001C38',
          900: '#001326',
        },
        // Semantic corporate tokens
        main: '#212529',
        secondary: '#6C757D',
        divider: '#E0E0E0',
        surface: '#F4F5F7',
        card: '#FFFFFF',
        // Slate mapping to maintain light-theme elegance across legacy classes
        slate: {
          50: '#FFFFFF',
          100: '#212529',
          200: '#2B3035',
          300: '#495057',
          400: '#6C757D',
          500: '#868E96',
          600: '#ADB5BD',
          700: '#CED4DA',
          750: '#DEE2E6',
          800: '#E0E0E0',
          850: '#F0F2F5',
          900: '#FFFFFF',
          950: '#F4F5F7',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        '2xs': '0 1px 1px 0 rgba(0, 0, 0, 0.04)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        'accent-glow': '0 4px 14px 0 rgba(227, 6, 19, 0.25)',
        'navy-glow': '0 4px 14px 0 rgba(0, 59, 115, 0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
}
