// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { requireAuth } from '../../utils/auth'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

interface OllamaModelEntry {
  name: string
  modified_at: string
  size: number
}

async function getModelsViaCli(): Promise<OllamaModelEntry[]> {
  const { stdout } = await execFileAsync('ollama', ['list'])
  const lines = stdout.trim().split('\n').slice(1)
  return lines
    .filter((l: string) => l.trim())
    .map((l: string) => {
      const parts = l.trim().split(/\s{2,}/)
      return {
        name: (parts[0] ?? '').trim(),
        modified_at: (parts[3] ?? '').trim(),
        size: 0,
      }
    })
    .filter((m: OllamaModelEntry) => m.name)
}

async function getModelsViaApi(baseUrl: string): Promise<OllamaModelEntry[]> {
  const response = await $fetch<{ models: OllamaModelEntry[] }>(`${baseUrl}/api/tags`)
  return response.models || []
}

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const config = useRuntimeConfig()
  const baseUrl = config.public.ollamaBaseUrl

  try {
    const models = await getModelsViaCli()
    return models
  } catch {
    try {
      return await getModelsViaApi(baseUrl)
    } catch {
      return []
    }
  }
})
