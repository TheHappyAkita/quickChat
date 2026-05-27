// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

interface Job {
  abortController: AbortController
  clients: Set<(data: string) => void>
}

const jobs = new Map<string, Job>()

export function registerJob(chatId: string): AbortController {
  const ac = new AbortController()
  jobs.set(chatId, { abortController: ac, clients: new Set() })
  return ac
}

export function abortJob(chatId: string): boolean {
  const job = jobs.get(chatId)
  if (!job) return false
  job.abortController.abort()
  jobs.delete(chatId)
  return true
}

export function getJob(chatId: string): Job | undefined {
  return jobs.get(chatId)
}

export function subscribeToJob(chatId: string, send: (data: string) => void): (() => void) | null {
  const job = jobs.get(chatId)
  if (!job) return null
  job.clients.add(send)
  return () => job.clients.delete(send)
}

export function broadcastToJob(chatId: string, data: string) {
  const job = jobs.get(chatId)
  if (!job) return
  for (const send of job.clients) {
    try { send(data) } catch {}
  }
}

export function finishJob(chatId: string) {
  jobs.delete(chatId)
}
