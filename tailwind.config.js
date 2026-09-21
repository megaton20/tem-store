/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs', './public/**/*.js'],
  theme: {
    extend: {
      colors: {
        // TEM Store brand palette: lemon green and gold. Token names kept
        // from the original palette (cocoa/caramel/etc.) so every view
        // that already references them just picks up the new colors.
        cream: '#FCFCF3',       // near-white background
        dough: '#EFF4D8',       // soft lemon-tinted section background
        cocoa: '#233417',       // primary dark text / dark UI (deep green-black)
        'cocoa-light': '#4A5D34', // secondary text (muted green)
        caramel: '#D4AF37',     // primary accent / buttons (gold)
        'caramel-dark': '#B8901F', // hover / darker gold
        forest: '#7CB518',      // lemon green - secondary accent, badges, links
        'forest-light': '#9AD53A',
        vault: '#1B1B22',
        'vault-gold': '#D4AF37',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        floatA: {
          '0%, 100%': { transform: 'translateY(0px) rotate(-2deg)' },
          '50%': { transform: 'translateY(-18px) rotate(1deg)' },
        },
        floatB: {
          '0%, 100%': { transform: 'translateY(-8px) rotate(3deg)' },
          '50%': { transform: 'translateY(10px) rotate(-2deg)' },
        },
        floatC: {
          '0%, 100%': { transform: 'translateY(-14px) rotate(-4deg)' },
          '50%': { transform: 'translateY(4px) rotate(2deg)' },
        },
      },
      animation: {
        floatA: 'floatA 6s ease-in-out infinite',
        floatB: 'floatB 7.5s ease-in-out infinite',
        floatC: 'floatC 5.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
