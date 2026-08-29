/** @type {import('tailwindcss').Config} */

export default {
    content: [
        './src/**/*.{html,js,svelte,ts}',
    ],
    theme: {
        extend: {
            keyframes: {
                'glitch': {
                    '0%': { opacity: '0' },
                    '33.33%': { opacity: '1' },
                    '66.66%': { opacity: '0' },
                    '100%': { opacity: '1' },
                }
            },
            animation: {
                'glitch': 'glitch 0.2s ease-in-out forwards',
            }
        }
    }
}