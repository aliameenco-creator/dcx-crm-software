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
        bg: {
          base: '#f8fafc',        // Clean slate-50 background
          surface: '#ffffff',     // Pure white card surfaces
          elevated: '#f1f5f9',    // Light slate-100 hover / active
          subtle: '#e2e8f0',      // slate-200 dividers
          border: '#e2e8f0'       // slate-200 border
        },
        text: {
          primary: '#0f172a',     // slate-900 high contrast dark text
          secondary: '#334155',   // slate-700 readable body text
          muted: '#64748b',       // slate-500 secondary labels
          dim: '#94a3b8'          // slate-400 subtle text
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
