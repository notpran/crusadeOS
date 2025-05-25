/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // This should already be there
    // If you have other folders where you use Tailwind, add them here too
    // e.g., "./public/index.html", if you use classes there
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
