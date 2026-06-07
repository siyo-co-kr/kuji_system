import './load-env.js'
import { buildApp } from './app.js'

const port = Number(process.env.PORT) || 4000
const host = process.env.HOST || '0.0.0.0'

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port, host })
    console.log(`Server running at http://${host}:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
