/**
 * DeukPack IDL Formatter (득팩 포매터)
 * Formats DeukPack IDL (.deuk, .thrift 호환): indent by brace depth, trim trailing spaces, normalize blank lines.
 */

import * as vscode from 'vscode';

const DEFAULT_INDENT = '    '; // 4 spaces
const DEFAULT_INSERT_SPACES = true;
const DEFAULT_TAB_SIZE = 4;

export interface FormatterOptions {
  insertSpaces?: boolean;
  tabSize?: number;
  indentSize?: number;
}

function getIndent(options: FormatterOptions): string {
  if (options.insertSpaces !== false) {
    const size = options.indentSize ?? options.tabSize ?? 4;
    return ' '.repeat(size);
  }
  return '\t';
}

/**
 * Format IDL source: indent by { }, trim trailing whitespace, at most one blank line between blocks.
 */
export function formatIdlDocument(
  text: string,
  options: FormatterOptions = {}
): string {
  const indentStr = getIndent(options);
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let depth = 0;
  let prevBlank = false;
  const trimRight = (s: string) => s.replace(/\s+$/, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const trimmedRight = trimRight(line);

    if (trimmed.length === 0) {
      if (!prevBlank) out.push('');
      prevBlank = true;
      continue;
    }

    // Count braces in line (skip past // and /* */ for simple heuristic)
    let content = trimmedRight;
    const lineComment = content.indexOf('//');
    const blockStart = content.indexOf('/*');
    if (lineComment >= 0) content = content.slice(0, lineComment);
    if (blockStart >= 0 && (lineComment < 0 || blockStart < lineComment)) {
      const blockEnd = content.indexOf('*/', blockStart);
      if (blockEnd >= 0) content = content.slice(blockEnd + 2) + content.slice(0, blockStart);
      else content = content.slice(0, blockStart);
    }
    const isClosingOnly = /^\s*}\s*$/.test(trimmed);
    const indentDepth = isClosingOnly && depth > 0 ? depth - 1 : depth;
    for (const ch of content) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth < 0) depth = 0;

    prevBlank = false;
    const actualIndent = indentStr.repeat(Math.max(0, indentDepth));
    const afterTrim = trimRight(trimmed);
    out.push(actualIndent + afterTrim);
  }

  let result = out.join('\n');
  if (result.length > 0 && !result.endsWith('\n')) result += '\n';
  return result;
}

/**
 * Format document and return a single TextEdit replacing the full document.
 */
export function formatDocument(
  document: vscode.TextDocument,
  options: FormatterOptions = {}
): vscode.TextEdit[] {
  const text = document.getText();
  const formatted = formatIdlDocument(text, options);
  if (formatted === text) return [];
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(text.length)
  );
  return [vscode.TextEdit.replace(fullRange, formatted)];
}

/**
 * Format a range (formats the whole document for simplicity; range formatter could trim to range later).
 */
export function formatDocumentRange(
  document: vscode.TextDocument,
  range: vscode.Range,
  options: FormatterOptions = {}
): vscode.TextEdit[] {
  return formatDocument(document, options);
}

export function registerDeukPackFormatter(
  context: vscode.ExtensionContext,
  languageIds: string[] = ['deuk', 'thrift']
): void {
  for (const languageId of languageIds) {
    const docFormatter = vscode.languages.registerDocumentFormattingEditProvider(
      { language: languageId },
      {
        provideDocumentFormattingEdits(
          document: vscode.TextDocument,
          options: vscode.FormattingOptions
        ): vscode.TextEdit[] {
          return formatDocument(document, {
            insertSpaces: options.insertSpaces ?? DEFAULT_INSERT_SPACES,
            tabSize: options.tabSize ?? DEFAULT_TAB_SIZE,
            indentSize: options.tabSize ?? DEFAULT_TAB_SIZE,
          });
        },
      }
    );
    const rangeFormatter = vscode.languages.registerDocumentRangeFormattingEditProvider(
      { language: languageId },
      {
        provideDocumentRangeFormattingEdits(
          document: vscode.TextDocument,
          range: vscode.Range,
          options: vscode.FormattingOptions
        ): vscode.TextEdit[] {
          return formatDocumentRange(document, range, {
            insertSpaces: options.insertSpaces ?? DEFAULT_INSERT_SPACES,
            tabSize: options.tabSize ?? DEFAULT_TAB_SIZE,
            indentSize: options.tabSize ?? DEFAULT_TAB_SIZE,
          });
        },
      }
    );
    context.subscriptions.push(docFormatter, rangeFormatter);
  }
}
