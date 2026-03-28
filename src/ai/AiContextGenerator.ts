import { DeukPackAST, DeukPackType } from '../types/DeukPackTypes';

export interface AiContextOptions {
  format: 'markdown' | 'json';
  title?: string;
  version?: string;
}

export class AiContextGenerator {
  /**
   * Generates AI-friendly context from DeukPack AST
   */
  generate(ast: DeukPackAST, options: AiContextOptions): string {
    if (options.format === 'json') {
      return this.generateJson(ast, options);
    }
    return this.generateMarkdown(ast, options);
  }

  private generateMarkdown(ast: DeukPackAST, options: AiContextOptions): string {
    const lines: string[] = [];
    const title = options.title || 'DeukPack AI Development Context';
    const version = options.version || '1.0.0';

    lines.push(`# ${title}`);
    lines.push(`> Version: ${version} | Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('## Overview');
    lines.push('This document provides the semantic structure and business intent of the internal interfaces defined in this repository. AI agents should use this as the "Source of Truth" for understanding data structures, constraints, and service contracts.');
    lines.push('');

    // Namespaces
    if (ast.namespaces.length > 0) {
      lines.push('## Namespaces');
      for (const ns of ast.namespaces) {
        lines.push(`- **${ns.name}** (Target: ${ns.language})`);
      }
      lines.push('');
    }

    // Structs / Records / Entities
    if (ast.structs.length > 0) {
      lines.push('## Data Structures (Records & Entities)');
      for (const struct of ast.structs) {
        lines.push(`### \`${struct.name}\``);
        if (struct.declarationKind) {
          lines.push(`- **Kind**: ${struct.declarationKind}`);
        }
        if (struct.docComment) {
          lines.push(`- **Intent**: ${struct.docComment}`);
        }
        if (struct.extends) {
          lines.push(`- **Inherits from**: \`${struct.extends}\``);
        }
        
        lines.push('');
        lines.push('| ID | Name | Type | Required | Description |');
        lines.push('|----|------|------|----------|-------------|');
        for (const field of struct.fields) {
          const typeStr = this.renderType(field.type);
          const reqStr = field.required ? '✅' : '❌';
          const desc = field.docComment || '-';
          lines.push(`| ${field.id} | \`${field.name}\` | \`${typeStr}\` | ${reqStr} | ${desc} |`);
        }
        lines.push('');
      }
    }

    // Enums
    if (ast.enums.length > 0) {
      lines.push('## Enumerations');
      for (const en of ast.enums) {
        lines.push(`### \`${en.name}\``);
        if (en.docComment) {
          lines.push(`- **Description**: ${en.docComment}`);
        }
        lines.push('');
        lines.push('| Member | Value | Description |');
        lines.push('|--------|-------|-------------|');
        for (const [name, value] of Object.entries(en.values)) {
          const desc = (en.valueComments && en.valueComments[name]) || '-';
          lines.push(`| \`${name}\` | ${value} | ${desc} |`);
        }
        lines.push('');
      }
    }

    // Services
    if (ast.services.length > 0) {
      lines.push('## Services & API Contracts');
      for (const service of ast.services) {
        lines.push(`### \`${service.name}\``);
        if (service.docComment) {
          lines.push(`${service.docComment}`);
        }
        lines.push('');
        for (const method of service.methods) {
          const params = method.parameters.map(p => `\`${p.name}\`: ${this.renderType(p.type)}`).join(', ');
          lines.push(`#### Method: \`${method.name}(${params})\``);
          lines.push(`- **Returns**: \`${this.renderType(method.returnType)}\``);
          if (method.oneway) lines.push('- **Oneway**: Yes');
          if (method.docComment) {
            lines.push(`- **Usage Guide**: ${method.docComment}`);
          }
          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push('**Note to AI Agent**: When generating code or queries based on these structures, always respect the "Intent" and "Description" fields. They contain critical business logic that may not be apparent from the types alone.');

    return lines.join('\n');
  }

  private generateJson(ast: DeukPackAST, options: AiContextOptions): string {
    const data = {
      title: options.title || 'DeukPack AI Context',
      version: options.version || '1.0.0',
      generatedAt: new Date().toISOString(),
      entities: ast.structs.map(s => ({
        name: s.name,
        kind: s.declarationKind,
        description: s.docComment,
        fields: s.fields.map(f => ({
          id: f.id,
          name: f.name,
          type: this.renderType(f.type),
          required: f.required,
          description: f.docComment
        }))
      })),
      enums: ast.enums.map(e => ({
        name: e.name,
        description: e.docComment,
        members: Object.entries(e.values).map(([name, value]) => ({
          name,
          value,
          description: (e.valueComments && e.valueComments[name])
        }))
      })),
      services: ast.services.map(s => ({
        name: s.name,
        description: s.docComment,
        methods: s.methods.map(m => ({
          name: m.name,
          returns: this.renderType(m.returnType),
          parameters: m.parameters.map(p => ({
            name: p.name,
            type: this.renderType(p.type)
          })),
          description: m.docComment
        }))
      }))
    };
    return JSON.stringify(data, null, 2);
  }

  private renderType(type: DeukPackType): string {
    if (typeof type === 'string') return type;
    switch (type.type) {
      case 'list': return `list<${this.renderType(type.elementType)}>`;
      case 'set': return `set<${this.renderType(type.elementType)}>`;
      case 'map': return `map<${this.renderType(type.keyType)}, ${this.renderType(type.valueType)}>`;
      case 'array': return `array<${this.renderType(type.elementType)}, ${type.size}>`;
      case 'tablelink': return `tablelink<${type.tableCategory}, ${type.keyField}>`;
      default: return 'unknown';
    }
  }
}
