/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './script.js'],
  theme: {
    extend: {
      colors: {
        navy: '#2f3744', navydeep: '#232a35', steel: '#30475e',
        gold: '#c1a57b', goldlight: '#e9dfcc', golddim: '#a68a61',
        olive: '#6c6753', olivedeep: '#4f4a3a', olivelight: '#8f886c',
        paper: '#ffffff', paperdim: '#f2f2f2', ink: '#1c2129',
        inksoft: '#565f6c', line: '#ddd7ca'
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: []
};
