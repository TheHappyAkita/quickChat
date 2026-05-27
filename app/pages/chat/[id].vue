<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <div class="page-scroll d-flex flex-column">
    <v-app-bar density="compact" flat border="b">
      <v-btn icon="mdi-arrow-left" @click="navigateTo('/chats')" />
      <v-app-bar-title>
        <span v-if="session">{{ session.title }}</span>
        <span v-else>New Chat</span>
      </v-app-bar-title>
      <template #append>
        <v-btn v-if="session" icon="mdi-pencil" @click="editTitleDialog = true" />
        <v-btn v-if="session" icon="mdi-delete" color="error" @click="confirmDelete = true" />
      </template>
    </v-app-bar>

    <div ref="messagesContainer" class="flex-grow-1 overflow-y-auto pa-4">
      <div v-if="!session || session.messages.length === 0" class="new-chat-setup">
        <v-icon size="56" color="medium-emphasis" class="mb-3">mdi-chat-processing-outline</v-icon>
        <div class="text-h6 mb-1">New Chat</div>
        <div class="text-body-2 text-medium-emphasis mb-5">Choose a persona and model, then type your first message</div>

        <div class="persona-grid mb-5">
          <div
            class="persona-card"
            :class="{ selected: selectedPersonaId === null }"
            @click="selectedPersonaId = null"
          >
            <v-icon size="28" color="medium-emphasis" class="mb-2">mdi-account-outline</v-icon>
            <div class="persona-card-name">No persona</div>
            <div class="persona-card-desc">Default assistant</div>
          </div>
          <div
            v-for="p in personaItems"
            :key="p.id"
            class="persona-card"
            :class="{ selected: selectedPersonaId === p.id }"
            @click="selectedPersonaId = p.id; onPersonaChange(p.id)"
          >
            <v-icon size="28" color="primary" class="mb-2">mdi-account-circle</v-icon>
            <div class="persona-card-name">{{ p.name }}</div>
            <div class="persona-card-desc">{{ p.description || p.systemPrompt.slice(0, 60) }}</div>
          </div>
        </div>

        <v-select
          v-model="selectedModel"
          :items="modelItems"
          label="Model"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-cube-outline"
          :loading="modelsLoading"
          style="max-width: 320px; width: 100%"
        />
      </div>

      <div v-if="session?.contextSummary" class="summary-banner mb-4">
        <v-icon size="16" class="mr-1">mdi-history</v-icon>
        <span>Earlier context summarized</span>
        <v-tooltip activator="parent" location="bottom" max-width="420">
          <div class="text-body-2">{{ session.contextSummary }}</div>
        </v-tooltip>
      </div>

      <div v-for="(msg, i) in session?.messages ?? []" :key="i" class="mb-3">
        <div :class="msg.role === 'user' ? 'message-row user' : 'message-row assistant'" class="message-row-wrap">
          <v-btn
            v-if="msg.role === 'user'"
            :icon="copiedIndex === i ? 'mdi-check' : 'mdi-content-copy'"
            size="x-small"
            variant="text"
            :color="copiedIndex === i ? 'success' : 'medium-emphasis'"
            class="copy-btn"
            title="Copy message"
            @click="copyMessage(msg.content, i)"
          />
          <v-card
            :color="msg.role === 'user' ? 'primary' : 'surface-variant'"
            rounded="xl"
            class="message-bubble"
            :class="msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'"
          >
            <div class="message-label" :class="msg.role === 'user' ? 'label-user' : 'label-assistant'">
              {{ msg.role === 'user' ? 'You' : (session?.personaName ?? 'Assistant') }}
            </div>
            <div class="message-content" v-html="renderMarkdown(msg.content)" />
          </v-card>
          <v-btn
            v-if="msg.role === 'assistant'"
            :icon="copiedIndex === i ? 'mdi-check' : 'mdi-content-copy'"
            size="x-small"
            variant="text"
            :color="copiedIndex === i ? 'success' : 'medium-emphasis'"
            class="copy-btn"
            title="Copy message"
            @click="copyMessage(msg.content, i)"
          />
        </div>
        <div
          v-if="msg.role === 'assistant' && i === (session?.messages.length ?? 0) - 1 && lastStats"
          class="stats-row"
        >
          <span>{{ lastStats.totalDuration ? (lastStats.totalDuration / 1000).toFixed(1) + 's total' : '' }}</span>
          <span v-if="lastStats.evalCount && lastStats.evalDuration">· {{ Math.round(lastStats.evalCount / (lastStats.evalDuration / 1000)) }} tok/s</span>
          <span v-if="lastStats.promptEvalDuration">· prompt {{ lastStats.promptEvalDuration }}ms</span>
        </div>
        <div
          v-if="msg.role === 'user' && i === (session?.messages.length ?? 0) - 1 && canRetry && !streaming"
          class="d-flex justify-end mt-1"
        >
          <v-btn
            icon="mdi-refresh"
            size="x-small"
            variant="text"
            color="medium-emphasis"
            :title="'Retry: ' + msg.content.slice(0, 60)"
            @click="retryLastMessage"
          />
        </div>
      </div>

      <div v-if="activeToolCalls.length > 0" class="mb-2">
        <v-card
          v-for="(tc, ti) in activeToolCalls"
          :key="ti"
          variant="tonal"
          color="secondary"
          rounded="lg"
          class="tool-call-card mb-1"
        >
          <v-card-text class="pa-2">
            <div class="d-flex align-center ga-2 mb-1">
              <v-icon size="14" color="secondary">mdi-function-variant</v-icon>
              <span class="text-caption font-weight-medium">{{ tc.name.split('__')[1] ?? tc.name }}</span>
              <v-progress-circular v-if="tc.result === null" indeterminate size="12" width="2" color="secondary" class="ml-auto" />
              <v-icon v-else size="14" color="success" class="ml-auto">mdi-check</v-icon>
            </div>
            <div v-if="tc.result" class="text-caption text-medium-emphasis tool-call-result">{{ tc.result.slice(0, 200) }}{{ tc.result.length > 200 ? '…' : '' }}</div>
          </v-card-text>
        </v-card>
      </div>

      <div v-if="streaming" class="message-row assistant mb-3">
        <v-card color="surface-variant" rounded="xl" class="message-bubble bubble-assistant">
          <div class="message-label label-assistant">
            {{ session?.personaName ?? 'Assistant' }}
          </div>
          <div v-if="streamingContent" class="message-content" v-html="renderMarkdown(streamingContent)" />
          <v-progress-circular v-else indeterminate size="20" width="2" color="primary" />
        </v-card>
      </div>
    </div>

    <v-divider />
    <div class="pa-3">
      <div v-if="session && session.messages.length > 0" class="d-flex align-center ga-2 mb-2">
        <v-chip
          size="small"
          variant="tonal"
          color="secondary"
          prepend-icon="mdi-account-circle"
          @click="showSettingsPopover = !showSettingsPopover"
        >
          {{ selectedPersona?.name ?? 'No persona' }}
        </v-chip>
        <v-chip
          size="small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-cube-outline"
          @click="showSettingsPopover = !showSettingsPopover"
        >
          {{ selectedModel }}
        </v-chip>
        <v-expand-transition>
          <div v-if="showSettingsPopover" class="settings-popover">
            <v-select
              v-model="selectedPersonaId"
              :items="personaItems"
              item-title="name"
              item-value="id"
              label="Persona"
              variant="outlined"
              density="compact"
              clearable
              hide-details
              style="min-width: 150px"
              @update:model-value="onPersonaChange"
            />
            <v-select
              v-model="selectedModel"
              :items="modelItems"
              label="Model"
              variant="outlined"
              density="compact"
              hide-details
              style="min-width: 150px"
              :loading="modelsLoading"
            />
          </div>
        </v-expand-transition>
      </div>
      <v-row align="end" no-gutters>
        <v-col>
          <v-textarea
            v-model="prompt"
            label="Message"
            variant="outlined"
            auto-grow
            rows="1"
            max-rows="6"
            hide-details
            :disabled="streaming"
            @keydown.enter.exact.prevent="sendMessage"
          />
        </v-col>
        <v-col cols="auto" class="ml-2 mb-1">
          <v-btn
            v-if="!streaming"
            icon="mdi-send"
            color="primary"
            :disabled="!prompt.trim()"
            @click="sendMessage"
          />
          <v-btn
            v-else
            icon="mdi-stop"
            color="error"
            @click="abortRequest"
          />
        </v-col>
      </v-row>
    </div>

    <v-dialog v-model="editTitleDialog" max-width="400">
      <v-card>
        <v-card-title>Rename Chat</v-card-title>
        <v-card-text>
          <v-text-field v-model="editTitle" label="Title" variant="outlined" autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="editTitleDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveTitle">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDelete" max-width="400">
      <v-card>
        <v-card-title>Delete Chat</v-card-title>
        <v-card-text>Are you sure you want to delete this chat?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmDelete = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteChat">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import type { ChatSession, AiPersona, McpServer } from '~/types'
import { findBuiltin } from '~/composables/useBuiltinTools'
import { renderWithImages } from '~/composables/useImageRenderer'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const chatId = computed(() => route.params.id as string)
const isNew = computed(() => chatId.value === 'new')

const session = ref<ChatSession | null>(null)
const prompt = ref('')
const streaming = ref(false)
const streamingContent = ref('')
const abortController = ref<AbortController | null>(null)
const requestAborted = ref(false)
const lastStats = ref<{ totalDuration?: number; evalCount?: number; evalDuration?: number; promptEvalDuration?: number } | null>(null)
const copiedIndex = ref<number | null>(null)
const activeToolCalls = ref<Array<{ callId: string; name: string; args: Record<string, unknown>; result: string | null }>>([])
const { data: mcpServers } = await useFetch<McpServer[]>('/api/mcp', { server: false, lazy: true })

const messagesContainer = ref<HTMLElement | null>(null)
const editTitleDialog = ref(false)
const editTitle = ref('')
const confirmDelete = ref(false)
const selectedPersonaId = ref<string | null>(null)
const showSettingsPopover = ref(false)

const lastUserPrompt = computed(() => {
  const msgs = session.value?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role === 'user') return msgs[i]!.content
  }
  return null
})

const canRetry = computed(() => {
  if (!session.value || session.value.messages.length === 0) return false
  const msgs = session.value.messages
  const last = msgs[msgs.length - 1]
  return last?.role === 'user' || last?.content?.startsWith('⚠️')
})

const { data: personas } = await useFetch<AiPersona[]>('/api/personas', { server: false, lazy: true })
const personaItems = computed(() => personas.value ?? [])
const selectedPersona = computed(() => personaItems.value.find((p: AiPersona) => p.id === selectedPersonaId.value) ?? null)

watch(personaItems, (items) => {
  if (items.length && selectedPersonaId.value) {
    const persona = items.find((p: AiPersona) => p.id === selectedPersonaId.value)
    if (persona?.model) selectedModel.value = persona.model
  }
}, { once: true })

const modelsLoading = ref(true)
const availableModels = ref<string[]>([])
const selectedModel = ref('llama3')
const modelItems = computed(() => availableModels.value.length ? availableModels.value : [selectedModel.value])

onMounted(async () => {
  scrollToBottom()
  try {
    const result = await $fetch<Array<{ name: string }>>('/api/ollama/models')
    availableModels.value = result.map((m: { name: string }) => m.name)
    const first = availableModels.value[0]
    if (first && !availableModels.value.includes(selectedModel.value) && !selectedPersonaId.value) {
      selectedModel.value = first
    }
  } catch {
  } finally {
    modelsLoading.value = false
  }
})

function onPersonaChange(personaId: string | null) {
  if (personaId) {
    const persona = personaItems.value.find((p: AiPersona) => p.id === personaId)
    if (persona?.model) selectedModel.value = persona.model
  }
}

function renderMarkdown(content: string): string {
  const hasImages = /\[IMAGE:/.test(content)
  if (!hasImages) return marked(content) as string
  const parts = content.split(/\[IMAGE:[^\]]+\]/)
  let result = ''
  const imgMatches = [...content.matchAll(/\[IMAGE:[^\]]+\]/g)]
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]!.trim()) result += marked(parts[i]!) as string
    if (imgMatches[i]) {
      const imgHtml = renderWithImages('', imgMatches[i]![0])
      result += imgHtml
    }
  }
  return result
}

async function executeTool(callId: string, toolName: string, args: Record<string, unknown>) {
  let result = ''
  try {
    const sep = toolName.indexOf('__')
    const serverId = sep !== -1 ? toolName.slice(0, sep) : null
    const actualName = sep !== -1 ? toolName.slice(sep + 2) : toolName
    const server = (mcpServers.value ?? []).find(s => s.id === serverId)
    if (server?.type === 'builtin' && server.builtinId) {
      const builtin = findBuiltin(server.builtinId)
      if (builtin) {
        result = await builtin.execute(actualName, args, server.builtinConfig ?? {})
      } else {
        result = `Unknown builtin: ${server.builtinId}`
      }
    } else {
      result = `Tool server not found or not a builtin: ${toolName}`
    }
  } catch (e) {
    result = `Tool error: ${e instanceof Error ? e.message : String(e)}`
  }
  await $fetch('/api/chat/tool-result', { method: 'POST', body: { callId, result } }).catch(() => {})
}

async function copyMessage(content: string, index: number) {
  await navigator.clipboard.writeText(content)
  copiedIndex.value = index
  setTimeout(() => { copiedIndex.value = null }, 2000)
}

async function loadSession() {
  if (isNew.value) {
    session.value = null
    return
  }
  try {
    session.value = await $fetch<ChatSession>(`/api/chats/${chatId.value}`)
    if (session.value?.personaId) {
      selectedPersonaId.value = session.value.personaId
      const persona = personaItems.value.find((p: AiPersona) => p.id === session.value?.personaId)
      if (persona?.model) selectedModel.value = persona.model
    }
    const lastMsg = session.value?.messages.at(-1)
    if (lastMsg?.role === 'user' && session.value) {
      streaming.value = true
      streamingContent.value = ''
      const reconnectId = session.value.id
      connectStream(reconnectId)
    }
  } catch {
    session.value = null
  }
}

await loadSession()

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function sendMessage() {
  const content = prompt.value.trim()
  if (!content || streaming.value) return

  prompt.value = ''
  streaming.value = true
  streamingContent.value = ''

  const userMessage = { role: 'user' as const, content, timestamp: Date.now() }

  if (!session.value) {
    const persona = selectedPersona.value
    session.value = await $fetch<ChatSession>('/api/chats', {
      method: 'POST',
      body: {
        title: content.slice(0, 50),
        personaId: persona?.id ?? null,
        personaName: persona?.name ?? null,
        messages: [userMessage],
      },
    })
    useRouter().replace(`/chat/${session.value.id}`)
  } else {
    session.value.messages.push(userMessage)
  }

  scrollToBottom()

  const ac = new AbortController()
  abortController.value = ac
  requestAborted.value = false
  const sid = session.value.id
  connectStream(sid, ac.signal, '/api/chat/complete', {
    chatId: sid,
    messages: session.value.messages,
    model: selectedModel.value,
    systemPrompt: selectedPersona.value?.systemPrompt,
    temperature: selectedPersona.value?.temperature,
    contextSummary: session.value.contextSummary,
    summarizedUpTo: session.value.summarizedUpTo,
    enabledMcpServerIds: selectedPersona.value?.enabledMcpServerIds ?? [],
  })
}

async function connectStream(cId: string, signal?: AbortSignal, url = `/api/chat/stream?chatId=${cId}`, postBody?: object) {
  try {
    const fetchOptions: RequestInit = postBody
      ? { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) }
      : { method: 'GET', signal }
    const response = await fetch(url, fetchOptions)

    if (!response.ok || !response.body) throw new Error('stream failed')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.startsWith('data: ') ? part.slice(6) : part
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as {
            token?: string
            done?: boolean
            error?: boolean
            content?: string
            contextSummary?: string | null
            summarizedUpTo?: number | null
            trimmedMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>
            stats?: { totalDuration?: number; evalCount?: number; evalDuration?: number; promptEvalDuration?: number }
            toolCallRequest?: { callId: string; name: string; args: Record<string, unknown> }
            toolResult?: { callId?: string; name: string; result: string }
          }
          if (msg.toolCallRequest) {
            const { callId, name, args } = msg.toolCallRequest
            activeToolCalls.value.push({ callId, name, args, result: null })
            scrollToBottom()
            executeTool(callId, name, args)
          } else if (msg.toolResult) {
            const tc = activeToolCalls.value.find(t => t.callId === msg.toolResult!.callId)
            if (tc) tc.result = msg.toolResult.result
          } else if (msg.token) {
            streamingContent.value += msg.token
            scrollToBottom()
          } else if (msg.done && session.value) {
            activeToolCalls.value = []
            const assistantMessage = { role: 'assistant' as const, content: msg.content ?? streamingContent.value, timestamp: Date.now() }
            if (msg.trimmedMessages) {
              session.value.messages = [...msg.trimmedMessages, assistantMessage]
              session.value.contextSummary = msg.contextSummary ?? null
              session.value.summarizedUpTo = msg.summarizedUpTo ?? null
            } else {
              session.value.messages.push(assistantMessage)
            }
            if (msg.stats) lastStats.value = msg.stats
            streaming.value = false
            streamingContent.value = ''
            scrollToBottom()
          } else if (msg.error && session.value) {
            session.value.messages.push({ role: 'assistant', content: '⚠️ Error: Could not reach Ollama. Please check your connection.', timestamp: Date.now() })
            streaming.value = false
            streamingContent.value = ''
            scrollToBottom()
          }
        } catch {}
      }
    }
  } catch (e: unknown) {
    const is404 = e instanceof Response
      ? e.status === 404
      : (e as { response?: { status?: number } })?.response?.status === 404
    if (!is404 && !requestAborted.value && session.value) {
      session.value.messages.push({
        role: 'assistant',
        content: '⚠️ Error: Could not reach Ollama. Please check your connection.',
        timestamp: Date.now(),
      })
    }
    streaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

async function abortRequest() {
  requestAborted.value = true
  abortController.value?.abort()
  abortController.value = null
  if (session.value) {
    await $fetch(`/api/chat/stop?chatId=${session.value.id}`, { method: 'DELETE' }).catch(() => {})
  }
}

async function retryLastMessage() {
  if (!session.value || !lastUserPrompt.value) return
  const content = lastUserPrompt.value
  const msgs = session.value.messages
  const last = msgs[msgs.length - 1]
  if (last?.role === 'assistant' || last?.content?.startsWith('⚠️')) {
    session.value.messages = msgs.slice(0, -1)
  }
  const secondLast = session.value.messages[session.value.messages.length - 1]
  if (secondLast?.role === 'user') {
    session.value.messages = session.value.messages.slice(0, -1)
  }
  prompt.value = content
  await sendMessage()
}

async function saveTitle() {
  if (!session.value || !editTitle.value.trim()) return
  session.value.title = editTitle.value.trim()
  await $fetch(`/api/chats/${session.value.id}`, { method: 'PUT', body: session.value })
  editTitleDialog.value = false
}

async function deleteChat() {
  if (!session.value) return
  await $fetch(`/api/chats/${session.value.id}`, { method: 'DELETE' })
  navigateTo('/chats')
}

watch(editTitleDialog, (v: boolean) => {
  if (v && session.value) editTitle.value = session.value.title
})
</script>

<style scoped>
.page-scroll {
  height: calc(100vh - var(--v-layout-top, 64px));
  overflow: hidden;
}

.stats-row {
  display: flex;
  gap: 6px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
  padding-left: 4px;
  margin-top: 2px;
}

.message-row-wrap {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.tool-call-card {
  max-width: 480px;
}

.tool-call-result {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.chat-image-figure) {
  margin: 8px 0;
  display: inline-block;
  max-width: 100%;
  position: relative;
}

:deep(.chat-image-full) {
  max-width: 100%;
  max-height: 480px;
  border-radius: 8px;
  display: block;
  object-fit: contain;
}

:deep(.chat-image-thumb) {
  max-width: 320px;
  max-height: 240px;
  border-radius: 8px;
  display: block;
  object-fit: cover;
  cursor: pointer;
  transition: opacity 0.15s;
}

:deep(.chat-image-thumb:hover) {
  opacity: 0.85;
}

:deep(.chat-image-overlay) {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

:deep(.chat-image-figure:hover .chat-image-overlay) {
  opacity: 1;
}

:deep(.chat-image-overlay span) {
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

:deep(.chat-image-caption) {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  margin-top: 4px;
  display: block;
}

.copy-btn {
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.message-row-wrap:hover .copy-btn {
  opacity: 1;
}

.summary-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  gap: 4px;
  cursor: default;
  user-select: none;
}

.persona-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 680px;
  width: 100%;
}

.persona-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 14px 16px;
  width: 150px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.persona-card:hover {
  border-color: rgba(124, 77, 255, 0.5);
  background: rgba(124, 77, 255, 0.08);
}
.persona-card.selected {
  border-color: rgb(124, 77, 255);
  background: rgba(124, 77, 255, 0.15);
}
.persona-card-name {
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 4px;
}
.persona-card-desc {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.new-chat-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px 24px;
  text-align: center;
}
.setup-selectors {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 380px;
}

.settings-popover {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.message-row {
  display: flex;
}
.message-row.user {
  justify-content: flex-end;
}
.message-row.assistant {
  justify-content: flex-start;
}

.message-bubble {
  padding: 10px 14px;
  max-width: min(85%, 760px);
}
.bubble-user {
  max-width: min(70%, 600px);
}
.bubble-assistant {
  max-width: min(92%, 820px);
}

.message-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 5px;
}
.label-assistant {
  color: rgba(0, 0, 0, 0.45);
}
.label-user {
  color: rgba(255, 255, 255, 0.7);
}

/* ── Markdown typography ── */
.message-content :deep(p) {
  margin: 0 0 0.6em 0;
  line-height: 1.6;
}
.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(ol),
.message-content :deep(ul) {
  margin: 0.4em 0 0.6em 0;
  padding-left: 1.6em;
}
.message-content :deep(li) {
  margin-bottom: 0.3em;
  line-height: 1.55;
}
.message-content :deep(li:last-child) {
  margin-bottom: 0;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4) {
  margin: 0.8em 0 0.3em 0;
  font-weight: 600;
  line-height: 1.3;
}
.message-content :deep(h1:first-child),
.message-content :deep(h2:first-child),
.message-content :deep(h3:first-child) {
  margin-top: 0;
}

.message-content :deep(pre) {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0.5em 0;
  font-size: 0.88em;
}
.message-content :deep(code) {
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.88em;
}
.message-content :deep(p code),
.message-content :deep(li code) {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  padding: 0.1em 0.35em;
}

.message-content :deep(blockquote) {
  border-left: 3px solid rgba(255,255,255,0.3);
  margin: 0.5em 0;
  padding: 0.2em 0.8em;
  opacity: 0.85;
}

.message-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.15);
  margin: 0.6em 0;
}

.message-content :deep(strong) {
  font-weight: 700;
}
.message-content :deep(em) {
  font-style: italic;
}

.message-content :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
  font-size: 0.92em;
}
.message-content :deep(th),
.message-content :deep(td) {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 5px 10px;
  text-align: left;
}
.message-content :deep(th) {
  background: rgba(255,255,255,0.08);
  font-weight: 600;
}
</style>
