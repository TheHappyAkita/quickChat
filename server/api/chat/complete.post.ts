// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { encryptForUser, decryptForUser } from '../../utils/dbInit'
import {
  needsSummarization,
  splitForSummary,
  summarizeMessages,
  buildOllamaMessages,
} from '../../utils/summarize'
import { registerJob, subscribeToJob, broadcastToJob, finishJob } from '../../utils/jobRegistry'
import { waitForToolResult } from '../../utils/toolCallRegistry'
import type { ChatMessage, ChatSession, McpServer, McpToolDef } from '../../../shared/types'

type OllamaTool = McpToolDef

const TC_JSON_RE = /\[\s*\{\s*"name"\s*:\s*"[^"]+__[^"]+"/

function looksLikeToolCallJson(text: string): boolean {
  return TC_JSON_RE.test(text)
}

function parseTextToolCalls(text: string): Array<{ function: { name: string; arguments: Record<string, unknown> } }> {
  const match = text.match(/(\[[\s\S]*?\}[\s\S]*?\])/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[1]!) as Array<{ name?: string; arguments?: Record<string, unknown> }>
    if (!Array.isArray(arr)) return []
    return arr
      .filter(tc => typeof tc.name === 'string' && tc.name.includes('__'))
      .map(tc => ({ function: { name: tc.name!, arguments: tc.arguments ?? {} } }))
  } catch {
    return []
  }
}

function stripToolCallJson(text: string): string {
  return text.replace(/\s*\[[\s\S]*?\{[\s\S]*?"name"[\s\S]*?\}[\s\S]*?\]\s*$/, '').trimEnd()
}

interface CompletionRequest {
  chatId: string
  messages: ChatMessage[]
  model: string
  systemPrompt?: string
  temperature?: number
  contextSummary?: string | null
  summarizedUpTo?: number | null
  enabledMcpServerIds?: string[]
}

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CompletionRequest>(event)
  const config = useRuntimeConfig()
  const baseUrl = config.public.ollamaBaseUrl
  const chatId = body.chatId

  const res = event.node.res
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendToClient = (data: string) => { try { res.write(`data: ${data}\n\n`) } catch {} }

  let contextSummary = body.contextSummary ?? null
  let summarizedUpTo = body.summarizedUpTo ?? null
  let messages = body.messages

  if (needsSummarization(messages, summarizedUpTo)) {
    const { toSummarize, toKeep } = splitForSummary(messages, summarizedUpTo)
    try {
      contextSummary = await summarizeMessages(toSummarize, body.model, contextSummary)
      summarizedUpTo = toSummarize[toSummarize.length - 1]?.timestamp ?? summarizedUpTo
      messages = toKeep

      const db = useDatabase()
      const { rows } = await db.sql`SELECT payload FROM chats WHERE id = ${chatId} AND user_id = ${userId}`
      const row = (rows ?? [])[0] as Record<string, unknown> | undefined
      if (row) {
        const session = JSON.parse(decryptForUser(userId, row.payload as string)) as ChatSession
        session.contextSummary = contextSummary
        session.summarizedUpTo = summarizedUpTo
        session.messages = [...toKeep]
        session.updatedAt = Date.now()
        const payload = encryptForUser(userId, JSON.stringify(session))
        await db.sql`UPDATE chats SET payload = ${payload}, updated_at = ${session.updatedAt} WHERE id = ${chatId} AND user_id = ${userId}`
      }
    } catch {}
  }

  const ollamaMessages = buildOllamaMessages(messages, body.systemPrompt, contextSummary)

  let ollamaTools: OllamaTool[] = []
  if (body.enabledMcpServerIds?.length) {
    try {
      const db = useDatabase()
      const { rows } = await db.sql`SELECT payload FROM mcp_servers WHERE user_id = ${userId}`
      const allServers = ((rows ?? []) as Record<string, unknown>[]).map((row) => {
        try { return JSON.parse(decryptForUser(userId, row.payload as string)) as McpServer } catch { return null }
      }).filter(Boolean) as McpServer[]
      const enabledServers = allServers.filter(s => body.enabledMcpServerIds!.includes(s.id))
      ollamaTools = enabledServers.flatMap(s =>
        ((s.tools ?? []) as OllamaTool[]).map(t => ({
          ...t,
          function: { ...t.function, name: `${s.id}__${t.function.name}` },
        })),
      )
    } catch (e) {
      console.warn('[MCP] Failed to load tool definitions:', e)
    }
  }

  const ac = registerJob(chatId)
  const unsubscribe = subscribeToJob(chatId, sendToClient)

  const broadcast = (data: string) => {
    broadcastToJob(chatId, data)
  }

  event.node.req.on('close', () => {
    if (unsubscribe) unsubscribe()
  })

  ;(async () => {
    try {
      const loopMessages: Array<Record<string, unknown>> = [...ollamaMessages]
      let fullContent = ''
      let stats: { totalDuration?: number; evalCount?: number; evalDuration?: number; promptEvalDuration?: number } = {}
      const hasTools = ollamaTools.length > 0

      for (let iteration = 0; iteration < 10; iteration++) {
        const reqBody: Record<string, unknown> = {
          model: body.model || 'llama3',
          messages: loopMessages,
          stream: true,
          options: { temperature: body.temperature ?? 0.7 },
        }
        if (hasTools) reqBody.tools = ollamaTools

        const ollamaRes = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          signal: ac.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        })

        if (!ollamaRes.ok || !ollamaRes.body) {
          broadcast(JSON.stringify({ error: true }))
          finishJob(chatId)
          res.end()
          return
        }

        const reader = ollamaRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let iterContent = ''
        let pendingTokens = ''
        let toolCalls: Array<{ function: { name: string; arguments: Record<string, unknown> } }> = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line) as {
                message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> }
                done?: boolean
                total_duration?: number
                eval_count?: number
                eval_duration?: number
                prompt_eval_duration?: number
              }
              const token = chunk.message?.content ?? ''
              if (token) {
                iterContent += token
                pendingTokens += token
                if (chunk.message?.tool_calls?.length) {
                  pendingTokens = ''
                } else if (!hasTools || !looksLikeToolCallJson(iterContent)) {
                  fullContent += pendingTokens
                  broadcast(JSON.stringify({ token: pendingTokens }))
                  pendingTokens = ''
                }
              }
              if (chunk.message?.tool_calls?.length) {
                toolCalls = chunk.message.tool_calls
              }
              if (chunk.done) {
                stats = {
                  totalDuration: chunk.total_duration ? Math.round(chunk.total_duration / 1e6) : undefined,
                  evalCount: chunk.eval_count,
                  evalDuration: chunk.eval_duration ? Math.round(chunk.eval_duration / 1e6) : undefined,
                  promptEvalDuration: chunk.prompt_eval_duration ? Math.round(chunk.prompt_eval_duration / 1e6) : undefined,
                }
              }
            } catch {}
          }
        }

        if (toolCalls.length === 0 && hasTools) {
          const fallback = parseTextToolCalls(iterContent)
          if (fallback.length > 0) {
            toolCalls = fallback
            const stripped = stripToolCallJson(iterContent)
            const delta = stripped.length - fullContent.length
            if (delta < 0) {
              fullContent = fullContent.slice(0, fullContent.length + delta)
              broadcast(JSON.stringify({ stripTokens: -delta }))
            }
          }
        }

        if (toolCalls.length === 0) break

        loopMessages.push({ role: 'assistant', content: iterContent, tool_calls: toolCalls })

        for (const tc of toolCalls) {
          const toolName = tc.function.name
          const toolArgs = tc.function.arguments ?? {}
          const callId = `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`
          broadcast(JSON.stringify({ toolCallRequest: { callId, name: toolName, args: toolArgs } }))
          let toolResult: string
          try {
            toolResult = await waitForToolResult(callId)
          } catch {
            toolResult = `Tool execution timed out: ${toolName}`
          }
          broadcast(JSON.stringify({ toolResult: { callId, name: toolName, result: toolResult } }))
          loopMessages.push({ role: 'tool', content: toolResult })
        }
      }

      const assistantMessage: ChatMessage = { role: 'assistant', content: fullContent, timestamp: Date.now() }
      const doneFrame = JSON.stringify({ done: true, content: fullContent, contextSummary, summarizedUpTo, trimmedMessages: messages, stats })

      try {
        const db = useDatabase()
        const { rows } = await db.sql`SELECT payload FROM chats WHERE id = ${chatId} AND user_id = ${userId}`
        const row = (rows ?? [])[0] as Record<string, unknown> | undefined
        if (row) {
          const session = JSON.parse(decryptForUser(userId, row.payload as string)) as ChatSession
          if (summarizedUpTo !== body.summarizedUpTo) {
            session.messages = [...messages, assistantMessage]
            session.contextSummary = contextSummary
            session.summarizedUpTo = summarizedUpTo
          } else {
            session.messages.push(assistantMessage)
          }
          session.updatedAt = Date.now()
          const payload = encryptForUser(userId, JSON.stringify(session))
          await db.sql`UPDATE chats SET payload = ${payload}, updated_at = ${session.updatedAt} WHERE id = ${chatId} AND user_id = ${userId}`
        }
      } catch {}

      broadcast(doneFrame)
      finishJob(chatId)
      res.end()
    } catch (e) {
      if (!ac.signal.aborted) {
        broadcast(JSON.stringify({ error: true }))
      }
      finishJob(chatId)
      res.end()
    }
  })()
})
