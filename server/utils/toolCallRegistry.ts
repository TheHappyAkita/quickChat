// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

interface PendingCall {
  resolve: (result: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingCall>()

export function waitForToolResult(callId: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(callId)
      reject(new Error(`Tool call ${callId} timed out`))
    }, timeoutMs)
    pending.set(callId, { resolve, reject, timer })
  })
}

export function resolveToolCall(callId: string, result: string): boolean {
  const entry = pending.get(callId)
  if (!entry) return false
  clearTimeout(entry.timer)
  pending.delete(callId)
  entry.resolve(result)
  return true
}
