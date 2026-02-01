import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Three.js and 3D libraries into separate chunk
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          // Split React into separate chunk
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Split Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Increase warning limit slightly since we're code-splitting
    chunkSizeWarningLimit: 600,
  },
})
