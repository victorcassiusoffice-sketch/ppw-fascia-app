/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:     '#0a1628',
        accent: '#f5b845',
        cream:  '#f0e8d8',
        teal:   '#4a9eb8',
        ink:    '#f0e8d8',
        muted:  '#7b8eaa',
        'ppw-bg':    '#0a1628',
        'ppw-gold':  '#f5b845',
        'ppw-cream': '#f0e8d8',
        'ppw-teal':  '#4a9eb8',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
