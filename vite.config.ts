import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const defaultModelBaseUrl = 'https://aidp-i18ntt-sg.byteintl.net'

function genieProxy(apiKey: string | undefined, baseUrl: string): Plugin {
  return {
    name: 'genie-model-proxy',
    configureServer(server) {
      server.middlewares.use('/api/genie/chat', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('Method not allowed')
          return
        }

        if (!apiKey) {
          response.statusCode = 503
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: '未配置 GENIE_MODEL_AK，请检查 .env.local。' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))

        try {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as { prompt?: string }
          if (!body.prompt?.trim()) throw new Error('Prompt is required')

          const upstream = await fetch(
            `${baseUrl.replace(/\/$/, '')}/api/modelhub/online/v2/crawl?ak=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-TT-LOGID': randomUUID(),
              },
              body: JSON.stringify({
                stream: false,
                model: 'gpt-5.4-2026-03-05',
                max_tokens: 500,
                messages: [{ role: 'user', content: [{ type: 'text', text: body.prompt }] }],
              }),
            },
          )
          const payload = await upstream.json()
          response.statusCode = upstream.status
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(payload))
        } catch (error) {
          response.statusCode = 502
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Genie 请求失败。',
          }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), genieProxy(env.GENIE_MODEL_AK, env.GENIE_MODEL_BASE_URL || defaultModelBaseUrl)],
  }
})
