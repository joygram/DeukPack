/**
 * Minimal linter for .deuk IDL: brace balance, semicolons, and basic structure.
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

export function lintDeuk(text: string): LintResult[] {
  const results: LintResult[] = [];
  const lines = text.split(/\r?\n/);

  let braceDepth = 0;
  let inBlockComment = false;
  let blockCommentStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Block comment
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end !== -1) inBlockComment = false;
      continue;
    }
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) {
      const blockEnd = line.indexOf('*/', blockStart);
      if (blockEnd === -1) {
        inBlockComment = true;
        blockCommentStartLine = lineNum;
      }
    }

    const lineCommentIdx = line.indexOf('//');
    const hashIdx = line.indexOf('#');
    let content = line;
    if (lineCommentIdx !== -1) content = line.slice(0, lineCommentIdx);
    if (hashIdx !== -1 && (lineCommentIdx === -1 || hashIdx < lineCommentIdx)) {
      content = line.slice(0, hashIdx);
    }

    for (let j = 0; j < content.length; j++) {
      const ch = content[j];
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
      }
    }

    // DeukPack IDL: 줄바꿈·세미콜론은 의미 없음. 기본은 세미콜론 생략 → 세미콜론 누락 에러 없음.
    if (braceDepth === 0 && trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
      const isBlockStart = /^\s*(namespace|include|import|struct|enum|meta\s+primitives|linkgroup|linklist|modifier|excel)\b/.test(trimmed) && trimmed.includes('{');
      const isInclude = /^\s*include\s+"/.test(trimmed);
      const isOnlyBrace = /^\s*[{}]\s*$/.test(trimmed);
      // (세미콜론 필수 검사 제거: 기본이 생략)
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

export function getDeukDiagnostics(doc: vscode.TextDocument): vscode.Diagnostic[] {
  if (doc.languageId !== 'deuk') return [];
  const results = lintDeuk(doc.getText());
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
