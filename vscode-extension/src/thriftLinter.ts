/**
 * DeukPack IDL linter for .thrift (Thrift 호환): brace balance and basic structure.
 */

import * as vscode from 'vscode';

export interface LintResult {
  line: number;
  column: number;
  length: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export function lintThrift(text: string): LintResult[] {
  const results: LintResult[] = [];
  const lines = text.split(/\r?\n/);

  let braceDepth = 0;
  let angleDepth = 0;
  let inBlockComment = false;
  let blockCommentStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end !== -1) inBlockComment = false;
      continue;
    }
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1 && line.indexOf('*/', blockStart) === -1) {
      inBlockComment = true;
      blockCommentStartLine = lineNum;
    }

    const lineCommentIdx = line.indexOf('//');
    const hashIdx = line.indexOf('#');
    let content = line;
    if (lineCommentIdx !== -1) content = line.slice(0, lineCommentIdx);
    if (hashIdx !== -1 && (lineCommentIdx === -1 || hashIdx < lineCommentIdx)) {
      content = line.slice(0, hashIdx);
    }

    let inString = false;
    let stringChar = '';
    let j = 0;
    while (j < content.length) {
      const ch = content[j];
      if (inString) {
        if (ch === '\\' && j + 1 < content.length) {
          j += 2;
          continue;
        }
        if (ch === stringChar) inString = false;
        j++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        j++;
        continue;
      }
      if (ch === '{') braceDepth++;
      else if (ch === '}') {
        braceDepth--;
        if (braceDepth < 0) {
          results.push({
            line: lineNum,
            column: j,
            length: 1,
            message: 'Unexpected "}"',
            severity: 'error',
            code: 'unexpected-close-brace',
          });
          braceDepth = 0;
        }
      } else if (ch === '<') angleDepth++;
      else if (ch === '>') {
        angleDepth--;
        if (angleDepth < 0) angleDepth = 0;
      }
      j++;
    }
  }

  if (braceDepth > 0) {
    results.push({
      line: lines.length,
      column: 0,
      length: 1,
      message: `Unclosed "{" (depth ${braceDepth})`,
      severity: 'error',
      code: 'unclosed-brace',
    });
  }

  if (inBlockComment) {
    results.push({
      line: blockCommentStartLine,
      column: 0,
      length: 1,
      message: 'Unclosed block comment "/*"',
      severity: 'warning',
      code: 'unclosed-block-comment',
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0 && /\s$/.test(line)) {
      const lastNonSpace = line.search(/\s+$/);
      const col = lastNonSpace >= 0 ? lastNonSpace : line.length;
      results.push({
        line: i + 1,
        column: col,
        length: line.length - col,
        message: 'Trailing whitespace',
        severity: 'warning',
        code: 'trailing-whitespace',
      });
    }
  }

  return results;
}

export function getThriftDiagnostics(doc: vscode.TextDocument): vscode.Diagnostic[] {
  if (doc.languageId !== 'thrift') return [];
  const results = lintThrift(doc.getText());
  return results.map((r) => {
    const start = new vscode.Position(r.line - 1, r.column);
    const end = new vscode.Position(r.line - 1, r.column + r.length);
    const severity = r.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
    const diag = new vscode.Diagnostic(new vscode.Range(start, end), r.message, severity);
    diag.source = 'DeukPack';
    diag.code = r.code ?? 'deukpack';
    return diag;
  });
}
