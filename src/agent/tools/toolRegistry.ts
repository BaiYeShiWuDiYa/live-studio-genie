import { z } from 'zod'

export interface ToolResult {
  name: string
  detail: string
}

export interface RegisteredTool<TContext> {
  name: string
  description: string
  requiresConfirmation: boolean
  execute: (input: unknown, context: TContext) => ToolResult
}

interface ToolDefinition<TSchema extends z.ZodType, TContext> {
  name: string
  description: string
  inputSchema: TSchema
  requiresConfirmation?: boolean
  execute: (input: z.infer<TSchema>, context: TContext) => ToolResult
}

export function defineTool<TSchema extends z.ZodType, TContext>(
  definition: ToolDefinition<TSchema, TContext>,
): RegisteredTool<TContext> {
  return {
    name: definition.name,
    description: definition.description,
    requiresConfirmation: definition.requiresConfirmation ?? false,
    execute: (input, context) => definition.execute(definition.inputSchema.parse(input), context),
  }
}

export class ToolRegistry<TContext> {
  private readonly tools = new Map<string, RegisteredTool<TContext>>()

  register(tool: RegisteredTool<TContext>): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`)
    }
    this.tools.set(tool.name, tool)
    return this
  }

  execute(name: string, input: unknown, context: TContext): ToolResult {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool "${name}".`)
    return tool.execute(input, context)
  }

  list(): Array<Pick<RegisteredTool<TContext>, 'name' | 'description' | 'requiresConfirmation'>> {
    return [...this.tools.values()].map(({ name, description, requiresConfirmation }) => ({
      name,
      description,
      requiresConfirmation,
    }))
  }
}
