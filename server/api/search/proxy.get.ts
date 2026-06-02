// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'

function parseDdgHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = []

  const resultBlocks = html.match(/<div class="result[^"]*"[\s\S]*?(?=<div class="result[^"]*"|<\/div>\s*<\/div>\s*<\/div>\s*$)/g) ?? []
  for (const block of resultBlocks) {
    let url = ''
    let title = ''
    let snippet = ''

    const urlMatch = block.match(/href="(https?:\/\/[^"]+)"/)
    if (urlMatch?.[1]) url = urlMatch[1]

    const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/)
    if (titleMatch?.[1]) title = titleMatch[1].replace(/<[^>]+>/g, '').trim()

    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\//)
    if (snippetMatch?.[1]) snippet = snippetMatch[1].replace(/<[^>]+>/g, '').trim()

    if (url && title && !url.includes('duckduckgo.com')) {
      results.push({ title, url, snippet })
    }
  }

  if (results.length) return results

  const webResults = html.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g) ?? []
  for (const match of webResults) {
    const urlMatch = match.match(/href="([^"]+)"/)
    const titleMatch = match.match(/>([^<]+)<\/a>/)
    const snippetMatch = match.match(/result__snippet"[^>]*>([^<]+)<\/a>/)
    const url = urlMatch?.[1] ?? ''
    const title = titleMatch?.[1]?.trim() ?? ''
    const snippet = snippetMatch?.[1]?.trim() ?? ''
    if (url && title && !url.includes('duckduckgo.com')) {
      results.push({ title, url, snippet })
    }
  }

  if (results.length) return results

  const allLinks = html.match(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g) ?? []
  for (const match of allLinks) {
    const urlMatch = match.match(/href="([^"]+)"/)
    const titleMatch = match.match(/>([^<]+)<\/a>/)
    const url = urlMatch?.[1] ?? ''
    const title = titleMatch?.[1]?.trim() ?? ''
    if (url && title && !url.includes('duckduckgo.com')) {
      results.push({ title, url, snippet: '' })
    }
  }

  return results
}

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

  if (engine === 'ddg-images') {
    const url = `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}&o=json&vqd=1&f=,,,&l=us-en`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://duckduckgo.com/',
      },
    })
    if (!res.ok) throw createError({ statusCode: res.status, message: `DDG Images error: ${res.status}` })
    const text = await res.text()
    if (text.includes('If this error persists')) {
      const htmlUrl = `https://duckduckgo.com/images?q=${encodeURIComponent(q)}`
      const htmlRes = await fetch(htmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html',
        },
      })
      if (!htmlRes.ok) throw createError({ statusCode: htmlRes.status, message: `DDG Images HTML error: ${htmlRes.status}` })
      const html = await htmlRes.text()
      const imageResults: Array<{ title: string; url: string; thumbnail: string }> = []

      const imgMatches = html.match(/<img[^>]+class="tile--img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g) ?? []
      for (const match of imgMatches.slice(0, 6)) {
        const srcMatch = match.match(/src="([^"]+)"/)
        const altMatch = match.match(/alt="([^"]*)"/)
        const src = srcMatch?.[1] ?? ''
        const alt = altMatch?.[1] ?? ''
        if (src && !src.includes('duckduckgo.com')) {
          imageResults.push({ title: alt, url: src, thumbnail: src })
        }
      }

      if (imageResults.length === 0) {
        const allImgs = html.match(/<img[^>]+src="([^"]+)"[^>]*>/g) ?? []
        for (const match of allImgs.slice(0, 10)) {
          const srcMatch = match.match(/src="([^"]+)"/)
          const src = srcMatch?.[1] ?? ''
          if (src && src.startsWith('http') && !src.includes('duckduckgo.com') && (src.includes('.jpg') || src.includes('.png') || src.includes('.webp') || src.includes('.jpeg'))) {
            imageResults.push({ title: '', url: src, thumbnail: src })
          }
        }
      }

      return { results: imageResults }
    }
    const data = JSON.parse(text) as { results?: Array<{ image: string; title: string; thumbnail: string; url: string }> }
    const results = (data.results ?? []).slice(0, 6).map(r => ({
      title: r.title || '',
      url: r.image || r.url || '',
      thumbnail: r.thumbnail || '',
    }))
    return { results }
  }

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Cache-Control': 'no-cache',
    },
  })
  if (!res.ok) throw createError({ statusCode: res.status, message: `DDG error: ${res.status}` })
  const html = await res.text()

  const results = parseDdgHtml(html)
  if (results.length) return { results }
  return { html }
})
