import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['@zama-fhe/relayer-sdk', 'ethers'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext'
  },
  define: {
    global: 'globalThis'
  }
})