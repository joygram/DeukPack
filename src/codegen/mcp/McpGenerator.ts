/**
 * DeukPack MCP Server Generator
 * Generates an MCP (Model Context Protocol) server from DeukPack IDL.
 */

import {
  DeukPackAST,
  GenerationOptions,
  DeukPackService,
  DeukPackMethod,
  DeukPackStruct,
  DeukPackType,
} from '../../types/DeukPackTypes';
import { CodeGenerator } from '../CodeGenerator';
import { CodegenTemplateHost } from '../codegenTemplateHost';

export class McpGenerator extends CodeGenerator {
  private readonly host: CodegenTemplateHost;

  constructor() {
    super();
    this.host = new CodegenTemplateHost('mcp');
  }

  async generate(ast: DeukPackAST, _options: GenerationOptions): Promise<{ [filename: string]: string }> {
    const out: { [filename: string]: string } = {};
    
    const mcpText = this.host.render('JsMcpServer.js.tpl', {
      //@ts-ignore
      NAMESPACE: (ast.namespaces ?? []).find((n) => n.language === 'ts')?.name || 'DeukPack',
      RESOURCES_SECTION: this.emitResources(ast).join('\n'),
      TOOLS_SECTION: this.emitTools(ast).join('\n'),
    });

    out['mcp-server.ts'] = mcpText;
    return out;
  }

  private emitResources(ast: DeukPackAST): string[] {
    const resourceLines: string[] = [];
    for (const struct of ast.structs ?? []) {
      if (this.isHidden(struct.annotations)) continue;
      resourceLines.push(...this.emitResource(struct));
      resourceLines.push('');
    }
    return resourceLines;
  }

  private emitTools(ast: DeukPackAST): string[] {
    const toolLines: string[] = [];
    for (const service of ast.services ?? []) {
      if (this.isHidden(service.annotations)) continue;
      for (const method of service.methods ?? []) {
        if (this.isHidden(method.annotations)) continue;
        toolLines.push(...this.emitTool(service, method));
        toolLines.push('');
      }
    }
    return toolLines;
  }

  private isHidden(annotations?: { [key: string]: string }): boolean {
    if (!annotations) return false;
    // 지원하는 히든 태그 패턴: mcp.hidden, mcp:hidden, hidden
    return !!(annotations['mcp.hidden'] || annotations['mcp:hidden'] || annotations['hidden']);
  }

  private emitResource(struct: DeukPackStruct): string[] {
    const lines: string[] = [];
    const name = struct.name;
    const desc = struct.docComment ? struct.docComment.replace(/\n/g, ' ') : `Structure: ${name}`;
    
    lines.push(`// Resource: ${name}`);
    lines.push(`server.resource(`);
    lines.push(`  "${name}",`);
    lines.push(`  "deukpack://${name}",`);
    lines.push(`  { description: ${JSON.stringify(desc)} },`);
    lines.push(`  async (uri) => ({`);
    lines.push(`    contents: [{`);
    lines.push(`      uri: uri.href,`);
    lines.push(`      text: ${JSON.stringify(this.getStructSummary(struct))}`);
    lines.push(`    }]`);
    lines.push(`  })`);
    lines.push(`);`);
    return lines;
  }

  private getStructSummary(struct: DeukPackStruct): string {
    const fields = (struct.fields ?? []).map(f => `${f.name}: ${this.typeToString(f.type)}`).join(', ');
    return `${struct.name} { ${fields} }`;
  }

  private emitTool(service: DeukPackService, method: DeukPackMethod): string[] {
    const lines: string[] = [];
    const toolName = `${service.name}_${method.name}`;
    const desc = method.docComment ? method.docComment.replace(/\n/g, ' ') : `Call ${service.name}.${method.name}`;

    lines.push(`// Tool: ${toolName}`);
    lines.push(`server.tool(`);
    lines.push(`  "${toolName}",`);
    lines.push(`  ${JSON.stringify(desc)},`);
    
    // Input Schema (Zod)
    lines.push(`  {`);
    for (const param of method.parameters ?? []) {
      lines.push(`    ${param.name}: ${this.toZodType(param.type, param.required)},`);
    }
    lines.push(`  },`);

    // Handler
    lines.push(`  async (args) => {`);
    lines.push(`    const instance = serviceRegistry.get("${service.name}");`);
    lines.push(`    if (!instance) {`);
    lines.push(`      return { content: [{ type: "text", text: "Service ${service.name} is not registered on this MCP server." }] };`);
    lines.push(`    }`);
    lines.push(`    try {`);
    lines.push(`      const params = [${(method.parameters ?? []).map(p => `args.${p.name}`).join(', ')}];`);
    lines.push(`      const result = await instance.${method.name}(...params);`);
    lines.push(`      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };`);
    lines.push(`    } catch (err) {`);
    lines.push(`      return { content: [{ type: "text", text: \`Error calling ${service.name}.${method.name}: \${err.message}\` }] };`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`);`);
    return lines;
  }

  private typeToString(type: DeukPackType): string {
    if (typeof type === 'string') return type;
    if (typeof type === 'object') {
      if (type.type === 'list') return `${this.typeToString(type.elementType)}[]`;
      if (type.type === 'map') return `Map<${this.typeToString(type.keyType)}, ${this.typeToString(type.valueType)}>`;
      return type.type;
    }
    return 'unknown';
  }

  private toZodType(type: DeukPackType, required: boolean): string {
    let zod = 'z.any()';
    if (typeof type === 'string') {
      switch (type) {
        case 'bool': zod = 'z.boolean()'; break;
        case 'byte': case 'int8': case 'int16': case 'int32':
          zod = 'z.number()'; break;
        case 'int64':
          // int64 can exceed JS safe integer. Use string or number with coercion.
          zod = 'z.union([z.number(), z.string()])'; break; 
        case 'float': case 'double': case 'decimal': case 'numeric':
          zod = 'z.number()'; break;
        case 'string': zod = 'z.string()'; break;
        case 'binary': zod = 'z.instanceof(Uint8Array)'; break;
        case 'datetime': case 'timestamp': zod = 'z.string().describe("ISO8601")'; break;
        default: zod = 'z.any()'; // Could be struct/enum
      }
    } else if (typeof type === 'object') {
      switch (type.type) {
        case 'list': zod = `z.array(${this.toZodType(type.elementType, true)})`; break;
        case 'map': zod = `z.record(z.string(), z.any())`; break; // Simple map mapping
      }
    }
    
    if (!required) zod += '.optional()';
    return zod;
  }
}
