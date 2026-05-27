// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'

function getStorageDir(): string {
  const config = useRuntimeConfig()
  const base = config.storageDir || join(homedir(), '.quickChat')
  return base
}

export async function ensureStorageDir(subdir?: string): Promise<string> {
  const base = getStorageDir()
  const dir = subdir ? join(base, subdir) : base
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

export async function writeJsonFile(subdir: string, filename: string, data: unknown): Promise<void> {
  const dir = await ensureStorageDir(subdir)
  const filepath = join(dir, filename)
  await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readJsonFile<T>(subdir: string, filename: string): Promise<T | null> {
  const dir = await ensureStorageDir(subdir)
  const filepath = join(dir, filename)
  try {
    const content = await readFile(filepath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export async function listJsonFiles(subdir: string): Promise<string[]> {
  const dir = await ensureStorageDir(subdir)
  const files = await readdir(dir)
  return files.filter((f: string) => f.endsWith('.json'))
}

export async function deleteJsonFile(subdir: string, filename: string): Promise<boolean> {
  const dir = await ensureStorageDir(subdir)
  const filepath = join(dir, filename)
  try {
    await unlink(filepath)
    return true
  } catch {
    return false
  }
}

export async function writeChatMarkdown(chatId: string, markdown: string): Promise<void> {
  const dir = await ensureStorageDir('chats')
  const filepath = join(dir, `${chatId}.md`)
  await writeFile(filepath, markdown, 'utf-8')
}

export async function readChatMarkdown(chatId: string): Promise<string | null> {
  const dir = await ensureStorageDir('chats')
  const filepath = join(dir, `${chatId}.md`)
  try {
    return await readFile(filepath, 'utf-8')
  } catch {
    return null
  }
}

export async function deleteChatMarkdown(chatId: string): Promise<void> {
  const dir = await ensureStorageDir('chats')
  const filepath = join(dir, `${chatId}.md`)
  try {
    await unlink(filepath)
  } catch {
  }
}

export async function listChatMarkdownFiles(): Promise<string[]> {
  const dir = await ensureStorageDir('chats')
  const files = await readdir(dir)
  return files.filter((f: string) => f.endsWith('.md')).map((f: string) => f.replace('.md', ''))
}
