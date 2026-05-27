// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import type { McpToolDef } from '~/types'

export interface BuiltinServerDef {
  id: string
  name: string
  description: string
  icon: string
  tools: McpToolDef[]
  configFields?: Array<{ key: string; label: string; hint?: string; required?: boolean }>
  execute(toolName: string, args: Record<string, unknown>, config: Record<string, string>): Promise<string>
}

async function webSearch(query: string, config: Record<string, string>): Promise<string> {
  const braveKey = config.braveApiKey
  if (braveKey) {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey } },
    )
    if (res.ok) {
      const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } }
      const results = data.web?.results ?? []
      if (results.length) {
        return results.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`).join('\n\n')
      }
    }
  }

  const ddgRes = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    { headers: { 'Accept': 'application/json' } },
  )
  if (!ddgRes.ok) throw new Error(`Search failed: ${ddgRes.status}`)
  const data = await ddgRes.json() as {
    Answer?: string
    AbstractText?: string
    AbstractURL?: string
    AbstractSource?: string
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>
    Results?: Array<{ Text?: string; FirstURL?: string }>
  }

  const parts: string[] = []
  if (data.Answer) parts.push(`**Answer:** ${data.Answer}`)
  if (data.AbstractText) parts.push(`**${data.AbstractSource ?? 'Summary'}:** ${data.AbstractText}\n${data.AbstractURL ?? ''}`)
  const topics = (data.RelatedTopics ?? []).flatMap(t =>
    t.Topics ? t.Topics : [t],
  ).filter(t => t.Text).slice(0, 5)
  if (topics.length) {
    parts.push('**Related:**\n' + topics.map(t => `- ${t.Text}\n  ${t.FirstURL ?? ''}`).join('\n'))
  }
  const results = (data.Results ?? []).slice(0, 3)
  if (results.length) {
    parts.push('**Results:**\n' + results.map(r => `- ${r.Text}\n  ${r.FirstURL ?? ''}`).join('\n'))
  }
  if (!parts.length) return `No results found for: ${query}`
  return parts.join('\n\n')
}

const IMAGE_MIME_PREFIXES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg', 'image/x-icon', 'image/tiff', 'image/avif']
const IMAGE_URL_EXTS = /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico|tiff|tif|avif)(\?.*)?$/i

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
  const contentType = res.headers.get('content-type') ?? ''
  const isImage = IMAGE_MIME_PREFIXES.some(p => contentType.startsWith(p)) || IMAGE_URL_EXTS.test(url.split('?')[0]!)
  if (isImage) {
    const buf = await res.arrayBuffer()
    const sizeMb = buf.byteLength / 1024 / 1024
    if (sizeMb > 8) return `Image too large to display (${sizeMb.toFixed(1)} MB): ${url}`
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    const mime = contentType.split(';')[0]?.trim() || 'image/jpeg'
    const dataUrl = `data:${mime};base64,${b64}`
    const name = url.split('/').pop()?.split('?')[0] ?? 'image'
    return `[IMAGE:${dataUrl}|${name}|${buf.byteLength}]`
  }
  if (contentType.includes('text/html')) {
    const html = await res.text()
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove())
    return (div.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 8000)
  }
  return (await res.text()).slice(0, 8000)
}

export const BUILTIN_SERVERS: BuiltinServerDef[] = [
  {
    id: 'builtin-websearch',
    name: 'Web Search',
    description: 'Search the web using DuckDuckGo (free, no key) or Brave Search (optional API key for better results)',
    icon: 'mdi-magnify',
    configFields: [
      { key: 'braveApiKey', label: 'Brave Search API Key (optional)', hint: 'Get a free key at search.brave.com/api — 2000 req/month free' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for current information, news, facts, and URLs. Use this when you need up-to-date information not in your training data.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_url',
          description: 'Fetch and read the text content of a web page or URL.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to fetch' },
            },
            required: ['url'],
          },
        },
      },
    ],
    async execute(toolName, args, config) {
      if (toolName === 'web_search') {
        return await webSearch(String(args.query ?? ''), config)
      }
      if (toolName === 'fetch_url') {
        return await fetchUrl(String(args.url ?? ''))
      }
      return `Unknown tool: ${toolName}`
    },
  },
]

const FILE_ACCESS_SERVER: BuiltinServerDef = {
  id: 'builtin-fileaccess',
  name: 'File Access',
  description: 'Read files from your local machine by path. Since quickChat runs locally, the server reads your own files on your behalf. Supports text, code, and images (png, jpg, svg, …).',
  icon: 'mdi-folder-open',
  tools: [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the content of a local file by its absolute path (Windows or Linux/Mac). Supports text files (code, markdown, config, etc.) and images (png, jpg, svg, gif, etc.). For images, returns a special marker that will be displayed in the chat.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute file path. Examples: /home/user/notes.txt, C:\\Users\\user\\doc.md, /tmp/image.png',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'List files and directories at a given path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute directory path to list' },
          },
          required: ['path'],
        },
      },
    },
  ],
  async execute(toolName, args) {
    if (toolName === 'read_file') {
      const path = String(args.path ?? '').trim()
      if (!path) return 'Error: no path provided'
      try {
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText })) as { message?: string }
          return `Error reading file: ${err.message ?? res.statusText}`
        }
        const data = await res.json() as
          | { type: 'text'; content: string; size: number; path: string }
          | { type: 'image'; mime: string; base64: string; size: number; path: string }
        if (data.type === 'image') {
          const dataUrl = `data:${data.mime};base64,${data.base64}`
          return `[IMAGE:${dataUrl}|${data.path}|${data.size}]`
        }
        const ext = path.split('.').pop()?.toLowerCase() ?? ''
        const codeExts = new Set(['ts','tsx','js','jsx','py','rb','go','rs','java','kt','cs','cpp','c','h','vue','svelte','html','css','scss','sh','bash','json','yaml','toml','sql'])
        if (codeExts.has(ext)) {
          return `File: \`${data.path}\` (${(data.size / 1024).toFixed(1)} KB)\n\`\`\`${ext}\n${data.content}\n\`\`\``
        }
        return `File: \`${data.path}\` (${(data.size / 1024).toFixed(1)} KB)\n\n${data.content}`
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    if (toolName === 'list_directory') {
      const path = String(args.path ?? '').trim()
      if (!path) return 'Error: no path provided'
      try {
        const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText })) as { message?: string }
          return `Error listing directory: ${err.message ?? res.statusText}`
        }
        const data = await res.json() as { entries: Array<{ name: string; type: 'file' | 'dir'; size?: number }> }
        if (!data.entries.length) return `Directory is empty: ${path}`
        return `Contents of \`${path}\`:\n` + data.entries.map(e =>
          `${e.type === 'dir' ? '📁' : '📄'} ${e.name}${e.size !== undefined ? ` (${(e.size / 1024).toFixed(1)} KB)` : ''}`,
        ).join('\n')
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    return `Unknown tool: ${toolName}`
  },
}

BUILTIN_SERVERS.push(FILE_ACCESS_SERVER)

export function findBuiltin(builtinId: string): BuiltinServerDef | undefined {
  return BUILTIN_SERVERS.find(b => b.id === builtinId)
}
