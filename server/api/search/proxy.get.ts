// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const engine = String(query.engine ?? 'ddg').trim()
  const searxngUrl = String(query.searxng ?? '').trim()

  if (!q) throw createError({ statusCode: 400, message: 'q required' })

  if (engine === 'searxng' && searxngUrl) {
    const url = `${searxngUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(q)}&format=json`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw createError({ statusCode: res.status, message: `SearXNG error: ${res.status}` })
    return await res.json()
  }

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw createError({ statusCode: res.status, message: `DDG error: ${res.status}` })
  const html = await res.text()
  return { html }
})
