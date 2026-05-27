// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif', '.avif'])
const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.cs', '.cpp', '.c', '.h',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.xml', '.csv', '.sql', '.env', '.gitignore', '.dockerfile',
  '.lock', '.log',
])
const MAX_TEXT_BYTES = 256 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.tiff': 'image/tiff', '.tif': 'image/tiff', '.avif': 'image/avif',
}

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)
  const filePath = String(query.path ?? '').trim()
  if (!filePath) throw createError({ statusCode: 400, message: 'path required' })

  let stat
  try {
    stat = statSync(filePath)
  } catch {
    throw createError({ statusCode: 404, message: `File not found: ${filePath}` })
  }

  if (!stat.isFile()) throw createError({ statusCode: 400, message: 'Not a file' })

  const ext = extname(filePath).toLowerCase()

  if (IMAGE_EXTS.has(ext)) {
    if (stat.size > MAX_IMAGE_BYTES) {
      throw createError({ statusCode: 413, message: `Image too large (${(stat.size / 1024 / 1024).toFixed(1)} MB, max 8 MB)` })
    }
    const buf = readFileSync(filePath)
    const mime = MIME[ext] ?? 'application/octet-stream'
    const b64 = buf.toString('base64')
    return { type: 'image', mime, base64: b64, size: stat.size, path: filePath }
  }

  if (TEXT_EXTS.has(ext) || ext === '') {
    if (stat.size > MAX_TEXT_BYTES) {
      const buf = readFileSync(filePath)
      return { type: 'text', content: buf.toString('utf8', 0, MAX_TEXT_BYTES) + `\n\n[... file truncated at ${MAX_TEXT_BYTES / 1024}KB ...]`, size: stat.size, path: filePath }
    }
    const content = readFileSync(filePath, 'utf8')
    return { type: 'text', content, size: stat.size, path: filePath }
  }

  throw createError({ statusCode: 415, message: `Unsupported file type: ${ext || 'unknown'}` })
})
