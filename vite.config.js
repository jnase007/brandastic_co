import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { writeFeaturePriority } from './server/featurePriority.js'

// Generate a build version for cache busting
const buildVersion = Date.now().toString(36)

// https://vitejs.dev/config/
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function featurePriorityPlugin(env) {
  return {
    name: 'feature-priority-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0]
        if (pathname !== '/api/feature-priority') return next()
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        try {
          const raw = await readRequestBody(req)
          const result = await writeFeaturePriority(env, JSON.parse(raw || '{}'))
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Could not read that priority.' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [
    react(),
    featurePriorityPlugin(env),
    // Generate version.json on build for detecting new deployments
    {
      name: 'generate-version',
      closeBundle() {
        const versionInfo = {
          version: buildVersion,
          buildTime: new Date().toISOString(),
        }
        fs.writeFileSync(
          path.resolve(__dirname, 'dist/version.json'),
          JSON.stringify(versionInfo)
        )
        console.log(`\n✅ Generated version.json: ${buildVersion}\n`)
      }
    }
  ],
  define: {
    // Inject build version into the app
    '__APP_VERSION__': JSON.stringify(buildVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production for faster builds
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Add hash to filenames for better cache busting
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        manualChunks: {
          // Vendor chunks - split large dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // Export libraries - only loaded when needed
          'vendor-export': ['xlsx', 'jspdf', 'jspdf-autotable'],
          'vendor-dnd': ['@hello-pangea/dnd'],
        },
      },
    },
  },
  }
})
