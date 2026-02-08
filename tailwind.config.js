/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        'mac-small': '11px',
        'mac-body': '13px',
        'mac-emphasis': '14px',
        'mac-heading': '16px',
      },
      colors: {
        'mac-separator': 'rgba(0, 0, 0, 0.1)',
        'mac-selection': 'rgba(0, 122, 255, 0.15)',
        'mac-accent': 'rgb(0, 122, 255)',
      },
      boxShadow: {
        'mac': '0 0 0 0.5px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
