// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const SALT_LEN = 16
const TAG_LEN = 16

export async function initDb(): Promise<void> {
  const db = useDatabase()
  await db.sql`CREATE TABLE IF NOT EXISTS users (
    username      TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
  )`

  await db.sql`CREATE TABLE IF NOT EXISTS chats (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    payload     BLOB    NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`
  await db.sql`CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id)`

  await db.sql`CREATE TABLE IF NOT EXISTS personas (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    payload     BLOB    NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`
  await db.sql`CREATE INDEX IF NOT EXISTS idx_personas_user ON personas(user_id)`

  await db.sql`CREATE TABLE IF NOT EXISTS mcp_servers (
    id          TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL,
    payload     BLOB    NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`
  await db.sql`CREATE INDEX IF NOT EXISTS idx_mcp_servers_user ON mcp_servers(user_id)`
}

function deriveKey(userId: string): Buffer {
  const config = useRuntimeConfig()
  const secret = config.sessionSecret as string
  return pbkdf2Sync(secret + userId, 'quickchat-salt-v1', 100_000, 32, 'sha256')
}

export function encryptForUser(userId: string, plaintext: string): string {
  const key = deriveKey(userId)
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

export function decryptForUser(userId: string, ciphertext: string): string {
  const key = deriveKey(userId)
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const data = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}
