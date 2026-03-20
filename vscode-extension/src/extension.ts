/**
 * Deuk IDL - VS Code extension
 * 득팩(DeukPack) IDL: 문법 하이라이트, 린트, 포매터. .deuk 기본, .thrift 호환.
 */

import * as vscode from 'vscode';
import { getDeukDiagnostics } from './deukLinter';
import { getThriftDiagnostics } from './thriftLinter';
import { registerDeukPackFormatter } from './deukFormatter';

export function activate(context: vscode.ExtensionContext): void {
  const deukDiag = vscode.languages.createDiagnosticCollection('deuk');
  const thriftDiag = vscode.languages.createDiagnosticCollection('thrift');
  context.subscriptions.push(deukDiag, thriftDiag);

  // 득팩 포매터: .deuk, .thrift 문서/영역 포맷 (들여쓰기, 공백 정리)
  registerDeukPackFormatter(context, ['deuk', 'thrift']);

  function updateDiagnostics(doc: vscode.TextDocument): void {
    if (doc.languageId === 'deuk') {
      deukDiag.set(doc.uri, getDeukDiagnostics(doc));
    } else if (doc.languageId === 'thrift') {
      thriftDiag.set(doc.uri, getThriftDiagnostics(doc));
    }
  }

  function clearDiagnostics(doc: vscode.TextDocument): void {
    if (doc.languageId === 'deuk') deukDiag.delete(doc.uri);
    else if (doc.languageId === 'thrift') thriftDiag.delete(doc.uri);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'deuk' || e.document.languageId === 'thrift') {
        updateDiagnostics(e.document);
      }
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'deuk' || doc.languageId === 'thrift') {
        updateDiagnostics(doc);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      clearDiagnostics(doc);
    })
  );

  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === 'deuk' || doc.languageId === 'thrift') {
      updateDiagnostics(doc);
    }
  }
}

export function deactivate(): void {}
