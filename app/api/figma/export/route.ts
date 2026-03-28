import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Figma Export API – 프로젝트 무관 라우트
 * deuk-ui.config.json 경로를 사용하며, 패키지 공통 핸들러로 저장만 수행합니다.
 * (코드 생성 등 파이프라인 후처리는 프로젝트에서 선택적으로 바인딩)
 */
function getCorsHeaders() {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Content-Type', 'application/json');
  return headers;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/** config 파일이 있는 디렉터리를 projectRoot로 반환 (모노레포 시 상위 탐색) */
function loadConfig(cwd: string): { projectRoot: string; webRoot: string; publicExport: string } {
  let dir = resolve(cwd);
  const maxUp = 6;
  for (let i = 0; i < maxUp; i++) {
    const paths = [
      resolve(dir, 'deuk-ui.config.json'),
      resolve(dir, 'export.config.json'),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        try {
          const raw = readFileSync(p, 'utf-8');
          const config = JSON.parse(raw);
          const pathConfig = config.paths || {};
          return {
            projectRoot: dir,
            webRoot: pathConfig.webRoot ?? '.',
            publicExport: pathConfig.publicExport ?? 'public/export',
          };
        } catch {
          /* ignore */
        }
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return { projectRoot: resolve(cwd), webRoot: '.', publicExport: 'public/export' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, data, images } = body;

    if (!data && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: 'export 데이터 또는 이미지가 필요합니다.' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const cwd = process.cwd();
    const { projectRoot, webRoot, publicExport } = loadConfig(cwd);

    const { handleExport } = require('deuk-ui/server/export-handler');
    const result = await handleExport(body, {
      projectRoot,
      webRoot,
      publicExport,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Export 실패' },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        exportName: result.exportName,
        directory: '/export',
        files: result.savedFiles,
        jsonCount: result.jsonCount,
        imageCount: result.imageCount,
      },
      { headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error('Export save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export 저장 실패' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
