// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { readdirSync, statSync } from 'node:fs'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)
  const dirPath = String(query.path ?? '').trim()
  if (!dirPath) throw createError({ statusCode: 400, message: 'path required' })

  let stat
  try {
    stat = statSync(dirPath)
  } catch {
    throw createError({ statusCode: 404, message: `Path not found: ${dirPath}` })
  }
  if (!stat.isDirectory()) throw createError({ statusCode: 400, message: 'Not a directory' })

  const raw = readdirSync(dirPath, { withFileTypes: true })
  const entries = raw.slice(0, 500).map((e) => {
    const isDir = e.isDirectory()
    let size: number | undefined
    if (!isDir) {
      try { size = statSync(`${dirPath}/${e.name}`).size } catch {}
    }
    return { name: e.name, type: isDir ? 'dir' as const : 'file' as const, size }
  })

  return { path: dirPath, entries }
})
