// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import type { ChatSession, ChatMessage } from '../../shared/types'

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/

function parseFrontmatter(content: string): Record<string, string> {
  const match = FRONTMATTER_RE.exec(content)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return result
}

export function chatToMarkdown(session: ChatSession): string {
  const fm = [
    '---',
    `id: ${session.id}`,
    `title: ${session.title}`,
    `personaId: ${session.personaId ?? ''}`,
    `personaName: ${session.personaName ?? ''}`,
    `createdAt: ${session.createdAt}`,
    `updatedAt: ${session.updatedAt}`,
    '---',
    '',
    `# ${session.title}`,
    '',
  ].join('\n')

  const messages = session.messages.map((msg: ChatMessage) => {
    const header = msg.role === 'user' ? '## 👤 User' : '## 🤖 Assistant'
    const ts = new Date(msg.timestamp).toISOString()
    return `${header}\n*${ts}*\n\n${msg.content}`
  }).join('\n\n---\n\n')

  return fm + messages
}

export function markdownToChat(content: string): ChatSession | null {
  const fm = parseFrontmatter(content)
  if (!fm.id) return null

  const body = content.replace(FRONTMATTER_RE, '')
  const messages: ChatMessage[] = []

  const sections = body.split(/\n---\n/)
  for (const section of sections) {
    const userMatch = /^## 👤 User\n\*([^*]+)\*\n\n([\s\S]*)$/.exec(section.trim())
    const assistantMatch = /^## 🤖 Assistant\n\*([^*]+)\*\n\n([\s\S]*)$/.exec(section.trim())
    if (userMatch) {
      messages.push({
        role: 'user',
        content: userMatch[2].trim(),
        timestamp: new Date(userMatch[1]).getTime(),
      })
    } else if (assistantMatch) {
      messages.push({
        role: 'assistant',
        content: assistantMatch[2].trim(),
        timestamp: new Date(assistantMatch[1]).getTime(),
      })
    }
  }

  return {
    id: fm.id,
    title: fm.title || 'Untitled',
    personaId: fm.personaId || null,
    personaName: fm.personaName || null,
    messages,
    createdAt: parseInt(fm.createdAt) || Date.now(),
    updatedAt: parseInt(fm.updatedAt) || Date.now(),
  }
}
