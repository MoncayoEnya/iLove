/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        paper: '#fdf8f6',
        ink: '#2e2030',
        peach: '#f2a68c',
        peachsoft: '#f8cdb8',
        gold: '#eec36b',
        plum: '#6b4468',
        plumdeep: '#3d2340',
        blush: '#f8e7e6',
        ok: '#6fae7a',
      },
    },
  },
  plugins: [],
}
