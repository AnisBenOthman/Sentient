import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// WHY: Prisma 7 no longer auto-loads .env before executing prisma.config.ts.
// We load it explicitly so HR_CORE_DATABASE_URL is available in process.env.
loadEnv({ path: path.join(__dirname, '.env') })

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env['HR_CORE_DATABASE_URL'],
  },
})
