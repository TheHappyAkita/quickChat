// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import type { ChatMessage } from '../../shared/types'

export const SUMMARY_THRESHOLD = 20
export const RECENT_KEEP = 10

export function needsSummarization(messages: ChatMessage[], summarizedUpTo?: number | null): boolean {
  const alreadySummarized = summarizedUpTo ?? 0
  const unsummarized = messages.filter(m => m.timestamp > alreadySummarized && m.role !== 'system')
  return unsummarized.length > SUMMARY_THRESHOLD
}

export function splitForSummary(messages: ChatMessage[], summarizedUpTo?: number | null): {
  toSummarize: ChatMessage[]
  toKeep: ChatMessage[]
} {
  const relevant = messages.filter(m => m.role !== 'system')
  const cutoff = relevant.length - RECENT_KEEP
  const toSummarize = relevant.slice(0, cutoff)
  const toKeep = relevant.slice(cutoff)
  return { toSummarize, toKeep }
}

export async function summarizeMessages(
  messages: ChatMessage[],
  model: string,
  existingSummary?: string | null,
): Promise<string> {
  const config = useRuntimeConfig()
  const baseUrl = config.public.ollamaBaseUrl

  const transcript = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const prompt = existingSummary
    ? `You are a conversation summarizer. Below is a previous summary followed by more conversation. Produce a single updated concise summary (max 300 words) that captures all key topics, decisions and context a future AI assistant would need.\n\nPrevious summary:\n${existingSummary}\n\nNew conversation:\n${transcript}\n\nUpdated summary:`
    : `You are a conversation summarizer. Summarize the following conversation concisely (max 300 words), capturing key topics, decisions and context that a future AI assistant would need to continue helpfully.\n\nConversation:\n${transcript}\n\nSummary:`

  const response = await $fetch<{ message: { content: string } }>(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',
      body: {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.3 },
      },
    },
  )

  return response.message.content.trim()
}

export function buildOllamaMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
  contextSummary?: string | null,
): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = []

  let sysContent = systemPrompt ?? ''
  if (contextSummary) {
    const prefix = `[Earlier conversation summary: ${contextSummary}]\n\n`
    sysContent = sysContent ? prefix + sysContent : prefix.trim()
  }
  if (sysContent) {
    result.push({ role: 'system', content: sysContent })
  }

  for (const msg of messages) {
    if (msg.role !== 'system') {
      result.push({ role: msg.role, content: msg.content })
    }
  }
  return result
}
