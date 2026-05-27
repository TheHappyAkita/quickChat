// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface UserConfig {
  username: string
  passwordHash: string
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

function getDefaultUsers(): UserConfig[] {
  const config = useRuntimeConfig()
  const usersEnv = process.env.QUICKCHAT_USERS
  if (usersEnv) {
    try {
      return JSON.parse(usersEnv) as UserConfig[]
    } catch {
    }
  }
  return [
    {
      username: (config.adminUsername as string) || 'admin',
      passwordHash: hashPassword((config.adminPassword as string) || 'admin'),
    },
  ]
}

export async function validateCredentials(username: string, password: string): Promise<boolean> {
  const hash = hashPassword(password)

  try {
    const db = useDatabase()
    const { rows } = await db.sql`SELECT password_hash FROM users WHERE username = ${username}`
    const row = (rows ?? [])[0] as Record<string, unknown> | undefined
    if (row) return row.password_hash === hash
  } catch {
  }

  const defaults = getDefaultUsers()
  const user = defaults.find(u => u.username === username)
  return !!user && user.passwordHash === hash
}

const SESSION_COOKIE = 'qc_session'
const sessions = new Map<string, { username: string; expiresAt: number }>()

export function createSession(username: string): string {
  const token = createHash('sha256')
    .update(`${username}:${Date.now()}:${Math.random()}`)
    .digest('hex')
  sessions.set(token, {
    username,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })
  return token
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=')
    if (idx < 0) continue
    const key = pair.slice(0, idx).trim()
    const val = decodeURIComponent(pair.slice(idx + 1).trim())
    if (key) result[key] = val
  }
  return result
}

function getNodeReqRes(event: { node?: { req: IncomingMessage; res: ServerResponse } } | { req: IncomingMessage; res: ServerResponse }): { req: IncomingMessage; res: ServerResponse } {
  if ('node' in event && event.node) return event.node
  return event as { req: IncomingMessage; res: ServerResponse }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSessionUser(event: any): string | null {
  const { req } = getNodeReqRes(event)
  const cookieHeader = (req.headers['cookie'] as string) ?? ''
  const cookies = parseCookieHeader(cookieHeader)
  const token = cookies[SESSION_COOKIE]
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessions.delete(token)
    return null
  }
  return session.username
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setSessionCookie(event: any, token: string): void {
  const { res } = getNodeReqRes(event)
  const maxAge = 7 * 24 * 60 * 60
  const cookieStr = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`
  const existing = res.getHeader('Set-Cookie')
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr])
  } else if (existing) {
    res.setHeader('Set-Cookie', [existing as string, cookieStr])
  } else {
    res.setHeader('Set-Cookie', cookieStr)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clearSessionCookie(event: any, token?: string): void {
  if (token) sessions.delete(token)
  const { res } = getNodeReqRes(event)
  const cookieStr = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
  res.setHeader('Set-Cookie', cookieStr)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireAuth(event: any): string {
  const username = getSessionUser(event)
  if (!username) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return username
}
