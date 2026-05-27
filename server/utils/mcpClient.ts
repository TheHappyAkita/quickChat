// Copyright (C) 2026 TheHappyAkita
// SPDX-License-Identifier: GPL-3.0-only

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpServer } from '../../shared/types'

export interface McpTool {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

async function createClient(server: McpServer): Promise<Client> {
  const client = new Client({ name: 'quickchat', version: '1.0.0' })

  if (server.type === 'stdio') {
    if (!server.command) throw new Error(`MCP server "${server.name}" has no command`)
    const parts = server.command.split(' ')
    const transport = new StdioClientTransport({
      command: parts[0]!,
      args: [...(parts.slice(1)), ...(server.args ?? [])],
      env: { ...process.env, ...(server.env ?? {}) } as Record<string, string>,
    })
    await client.connect(transport)
  } else if (server.type === 'http') {
    if (!server.url) throw new Error(`MCP server "${server.name}" has no URL`)
    const transport = new StreamableHTTPClientTransport(new URL(server.url))
    await client.connect(transport)
  }

  return client
}

export async function fetchMcpTools(servers: McpServer[]): Promise<{
  tools: OllamaTool[]
  serverClients: Map<string, Client>
}> {
  const serverClients = new Map<string, Client>()
  const tools: OllamaTool[] = []

  for (const server of servers) {
    try {
      const client = await createClient(server)
      serverClients.set(server.id, client)
      const result = await client.listTools()
      for (const tool of result.tools) {
        tools.push({
          type: 'function',
          function: {
            name: `${server.id}__${tool.name}`,
            description: tool.description,
            parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
          },
        })
      }
    } catch (e) {
      console.warn(`[MCP] Failed to connect to "${server.name}":`, e)
    }
  }

  return { tools, serverClients }
}

export async function callMcpTool(
  serverClients: Map<string, Client>,
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<string> {
  const sep = toolName.indexOf('__')
  if (sep === -1) return `Unknown tool: ${toolName}`
  const serverId = toolName.slice(0, sep)
  const actualTool = toolName.slice(sep + 2)
  const client = serverClients.get(serverId)
  if (!client) return `MCP server not connected for tool: ${toolName}`

  try {
    const result = await client.callTool({ name: actualTool, arguments: toolArgs })
    const content = result.content
    if (Array.isArray(content)) {
      return content.map((c: { type?: string; text?: string }) => c.text ?? '').join('\n')
    }
    return JSON.stringify(result)
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function closeMcpClients(serverClients: Map<string, Client>) {
  for (const client of serverClients.values()) {
    try { await client.close() } catch {}
  }
}
