// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  personaId: string | null
  personaName: string | null
  messages: ChatMessage[]
  contextSummary?: string | null
  summarizedUpTo?: number | null
  createdAt: number
  updatedAt: number
}

export interface AiPersona {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  enabledMcpServerIds: string[]
  createdAt: number
  updatedAt: number
}

export interface McpToolDef {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface McpServer {
  id: string
  name: string
  type: 'stdio' | 'http' | 'builtin'
  builtinId?: string
  builtinConfig?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  tools: McpToolDef[]
  createdAt: number
  updatedAt: number
}

export interface OllamaModel {
  name: string
  modified_at: string
  size: number
}

export interface ChatListItem {
  id: string
  title: string
  personaName: string | null
  updatedAt: number
  messageCount: number
}
