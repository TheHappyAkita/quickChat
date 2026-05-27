<!-- Copyright (C) 2026 TheHappyAkita - SPDX-License-Identifier: GPL-3.0-only -->
<template>
  <div class="page-scroll">
    <v-container>
      <v-row class="mb-4" align="center">
        <v-col>
          <h1 class="text-h5 font-weight-bold">MCP Servers</h1>
          <div class="text-body-2 text-medium-emphasis">Tools executed in your browser — no server-side access to external services</div>
        </v-col>
        <v-col cols="auto">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Add Server</v-btn>
        </v-col>
      </v-row>

      <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" />

      <v-card v-if="!pending && (!servers || servers.length === 0)" variant="tonal" class="text-center pa-8 mb-4">
        <v-icon size="64" color="medium-emphasis" class="mb-4">mdi-connection</v-icon>
        <div class="text-h6">No MCP servers yet</div>
        <div class="text-body-2 text-medium-emphasis mb-4">Add a built-in tool like Web Search, or connect an external MCP server</div>
        <v-btn color="primary" @click="openCreate">Add Server</v-btn>
      </v-card>

      <v-row v-if="servers && servers.length > 0">
        <v-col v-for="server in servers" :key="server.id" cols="12" md="6" lg="4">
          <v-card rounded="lg" height="100%">
            <v-card-title class="d-flex align-center ga-2">
              <v-icon :color="server.type === 'builtin' ? 'success' : server.type === 'stdio' ? 'primary' : 'secondary'">
                {{ server.type === 'builtin' ? (builtinDef(server.builtinId)?.icon ?? 'mdi-star') : server.type === 'stdio' ? 'mdi-console' : 'mdi-web' }}
              </v-icon>
              {{ server.name }}
            </v-card-title>
            <v-card-subtitle>
              {{ server.type === 'builtin' ? 'Built-in (browser)' : server.type === 'stdio' ? 'stdio process' : 'HTTP/SSE' }}
              · {{ server.tools?.length ?? 0 }} tool{{ (server.tools?.length ?? 0) !== 1 ? 's' : '' }}
            </v-card-subtitle>
            <v-card-text>
              <div v-if="server.type === 'builtin'" class="text-caption text-medium-emphasis">{{ builtinDef(server.builtinId)?.description }}</div>
              <code v-else-if="server.type === 'stdio'" class="text-caption">{{ server.command }} {{ server.args?.join(' ') }}</code>
              <code v-else class="text-caption">{{ server.url }}</code>
              <div v-if="server.builtinConfig && Object.keys(server.builtinConfig).filter(k => server.builtinConfig![k]).length" class="mt-2">
                <v-chip v-for="k in Object.keys(server.builtinConfig).filter(k => server.builtinConfig![k])" :key="k" size="x-small" variant="tonal" color="success" class="mr-1">{{ k }} ✓</v-chip>
              </div>
            </v-card-text>
            <v-card-actions>
              <v-btn variant="text" prepend-icon="mdi-pencil" @click="openEdit(server)">Edit</v-btn>
              <v-spacer />
              <v-btn variant="text" color="error" icon="mdi-delete" @click="confirmDel(server)" />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <v-card rounded="lg" class="mt-6" variant="tonal">
        <v-card-text class="text-body-2">
          <v-icon size="16" class="mr-1">mdi-information-outline</v-icon>
          Enable servers per persona in the <a href="/personas" class="text-primary">Personas</a> page.
          Use a model that supports tool calls (e.g. <strong>llama3.1</strong>, <strong>qwen2.5</strong>, <strong>mistral-nemo</strong>).
          All tool calls are executed in your browser — external requests never go through the server.
        </v-card-text>
      </v-card>
    </v-container>

    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>{{ editing ? 'Edit MCP Server' : 'Add MCP Server' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Name *" variant="outlined" class="mb-3" />
          <v-btn-toggle v-model="form.type" mandatory color="primary" class="mb-4" density="compact">
            <v-btn value="builtin" prepend-icon="mdi-star">Built-in</v-btn>
            <v-btn value="stdio" prepend-icon="mdi-console">stdio</v-btn>
            <v-btn value="http" prepend-icon="mdi-web">HTTP/SSE</v-btn>
          </v-btn-toggle>

          <template v-if="form.type === 'builtin'">
            <v-select
              v-model="form.builtinId"
              :items="builtinOptions"
              item-title="name"
              item-value="id"
              label="Built-in tool *"
              variant="outlined"
              class="mb-3"
            />
            <template v-if="selectedBuiltinDef">
              <div class="text-caption text-medium-emphasis mb-3">{{ selectedBuiltinDef.description }}</div>
              <template v-for="field in selectedBuiltinDef.configFields ?? []" :key="field.key">
                <v-text-field
                  v-model="builtinConfigForm[field.key]"
                  :label="field.label"
                  :hint="field.hint"
                  persistent-hint
                  variant="outlined"
                  class="mb-3"
                />
              </template>
            </template>
          </template>

          <template v-else-if="form.type === 'stdio'">
            <v-text-field v-model="form.command" label="Command *" variant="outlined" class="mb-3" hint="e.g. uvx mcp-server-fetch" persistent-hint />
            <v-text-field v-model="argsStr" label="Extra args (space separated)" variant="outlined" class="mb-3" />
          </template>

          <template v-else>
            <v-text-field v-model="form.url" label="URL *" variant="outlined" class="mb-3" hint="e.g. http://localhost:3001/mcp" persistent-hint />
          </template>

          <template v-if="form.type !== 'builtin'">
            <div class="d-flex align-center mb-2">
              <span class="text-body-2 font-weight-medium">Environment variables</span>
              <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" class="ml-2" @click="addEnvRow">Add</v-btn>
            </div>
            <div v-for="(row, idx) in envRows" :key="idx" class="d-flex ga-2 mb-2">
              <v-text-field v-model="row.key" label="KEY" variant="outlined" density="compact" hide-details style="max-width:160px" />
              <v-text-field v-model="row.value" label="value" variant="outlined" density="compact" hide-details />
              <v-btn icon="mdi-close" size="small" variant="text" @click="envRows.splice(idx, 1)" />
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete MCP Server</v-card-title>
        <v-card-text>Delete "{{ deleting?.name }}"?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="doDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import type { McpServer } from '~/types'
import { BUILTIN_SERVERS } from '~/composables/useBuiltinTools'

definePageMeta({ middleware: 'auth' })

const { data: servers, pending, refresh } = await useFetch<McpServer[]>('/api/mcp', { server: false, lazy: true })

const builtinOptions = BUILTIN_SERVERS.map(b => ({ id: b.id, name: b.name }))
const builtinDef = (id?: string) => id ? BUILTIN_SERVERS.find(b => b.id === id) : undefined

const dialog = ref(false)
const deleteDialog = ref(false)
const saving = ref(false)
const editing = ref<McpServer | null>(null)
const deleting = ref<McpServer | null>(null)

const defaultForm = () => ({
  name: '',
  type: 'builtin' as 'builtin' | 'stdio' | 'http',
  builtinId: BUILTIN_SERVERS[0]?.id ?? '',
  command: '',
  url: '',
  args: [] as string[],
  env: {} as Record<string, string>,
})
const form = ref(defaultForm())
const argsStr = ref('')
const envRows = ref<Array<{ key: string; value: string }>>([])
const builtinConfigForm = ref<Record<string, string>>({})

const selectedBuiltinDef = computed(() => builtinDef(form.value.builtinId))

watch(() => form.value.builtinId, (id) => {
  if (id && !editing.value) {
    const b = builtinDef(id)
    if (b && !form.value.name) form.value.name = b.name
  }
})

function openCreate() {
  editing.value = null
  form.value = defaultForm()
  argsStr.value = ''
  envRows.value = []
  builtinConfigForm.value = {}
  dialog.value = true
}

function openEdit(server: McpServer) {
  editing.value = server
  form.value = {
    name: server.name,
    type: server.type,
    builtinId: server.builtinId ?? '',
    command: server.command ?? '',
    url: server.url ?? '',
    args: server.args ?? [],
    env: server.env ?? {},
  }
  argsStr.value = (server.args ?? []).join(' ')
  envRows.value = Object.entries(server.env ?? {}).map(([key, value]) => ({ key, value: String(value) }))
  builtinConfigForm.value = { ...(server.builtinConfig ?? {}) }
  dialog.value = true
}

function addEnvRow() {
  envRows.value.push({ key: '', value: '' })
}

async function save() {
  if (!form.value.name.trim()) return
  saving.value = true
  try {
    const env: Record<string, string> = {}
    for (const row of envRows.value) { if (row.key.trim()) env[row.key.trim()] = row.value }
    const args = argsStr.value.trim() ? argsStr.value.trim().split(/\s+/) : []
    const bDef = builtinDef(form.value.builtinId)
    const payload: Partial<McpServer> = {
      ...form.value,
      args,
      env,
      builtinConfig: form.value.type === 'builtin' ? { ...builtinConfigForm.value } : undefined,
      tools: form.value.type === 'builtin' && bDef
        ? bDef.tools.map(t => ({ ...t, function: { ...t.function, name: `${t.function.name}` } }))
        : [],
    }
    if (editing.value) {
      await $fetch(`/api/mcp/${editing.value.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/mcp', { method: 'POST', body: payload })
    }
    await refresh()
    dialog.value = false
  } finally {
    saving.value = false
  }
}

function confirmDel(server: McpServer) {
  deleting.value = server
  deleteDialog.value = true
}

async function doDelete() {
  if (!deleting.value) return
  await $fetch(`/api/mcp/${deleting.value.id}`, { method: 'DELETE' })
  await refresh()
  deleteDialog.value = false
}
</script>

<style scoped>
.page-scroll {
  height: calc(100vh - var(--v-layout-top, 64px));
  overflow-y: auto;
}
</style>
