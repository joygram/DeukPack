# DeukPack OSS — 릴리즈·배포

## OSS 첫 배포 전 확인

첫 번째 OSS(GitHub/DeukPackOSS) 배포 전에 아래를 한 번씩 확인한다.

| 항목 | 확인 방법 |
|------|-----------|
| **버전 일치** | `package.json` · `package-lock.json` 동일 (예: 1.0.5). `npm run release:check` 실행 |
| **CHANGELOG** | 릴리스마다 루트 [CHANGELOG.md](CHANGELOG.ko.md)·[CHANGELOG.ko.md](CHANGELOG.ko.md)에 **그 버전**에서 바뀐 점을 적는다(추가·수정·호환 참고). [DEUKPACK_V1_RELEASE_SCOPE.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_V1_RELEASE_SCOPE.ko.md) §0 표와 내용이 어긋나지 않게 한다 |
| **deukpack.app · 키츠 노티** | 배너·홈 랜딩·**제품군 노티 집계** 정본은 루트 [release-notice.json](release-notice.json)(`version` = `package.json`, `product_notices` 배열). `npm run release-notice:apply` 또는 deukpack.app CI(`--product-notices`)가 `_includes` 스니펫·배너를 갱신. [릴리스·뉴스](https://deukpack.app/ko/releases/)는 날짜 역순 집계, 각 제품 페이지는 해당 `products` 태그만 표시 |
| **빌드·테스트** | `npm ci && npm run build && npm test` 성공 |
| **패키지 목록** | `npm pack --dry-run` 으로 포함 파일 확인 (internal 제외) |
| **저장소·사이트 URL** | `repository` / `bugs` → 공개 GitHub URL. **`homepage` → 제품 사이트 `https://deukpack.app/`** (npm·영문 진입; 한국어는 README.ko·루트 `https://deukpack.app/ko/`) (상세 문서는 저장소 README가 아님) |
| **태그와 버전** | 배포할 커밋에 `package.json` 버전이 반영된 뒤, 태그 `vX.Y.Z` 를 그 커밋에 붙임 |

**한 번에 검사**: `npm run release:check` (버전 검사 + 빌드 + 테스트 + pack --dry-run).

버전을 올린 뒤에는 `npm install` 한 번 실행해 `package-lock.json` 이 갱신되었는지 확인한 다음 커밋한다.

## v1.0.0 공개 스펙

**1.0.0 태그·npm 공개 시 “지원한다”고 말할 수 있는 범위**는 [docs/DEUKPACK_V1_RELEASE_SCOPE.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_V1_RELEASE_SCOPE.ko.md)에 고정한다.  

## 사전 확인

1. **`package.json`의 `repository` / `bugs` / `homepage`**  
   `repository`·`bugs` → 공개 GitHub. **`homepage` → `https://deukpack.app/`** (npm·레지스트리 “Homepage”; 한국어 안내는 README.ko).

2. **빌드·테스트 (로컬)**

   ```bash
   npm ci
   npm run build
   npm test
   npm pack --dry-run
   ```

3. **CLI**

   - 전역: `npm i -g deukpack` 후 `deukpack <args>`  
   - 일회: `npx deukpack <args>`  
   - 저장소 클론 시: `node scripts/build_deukpack.js` (동일 인자)

## npm 버전과 OSS 태그 동기화

**npm 배포 버전과 OSS 소스 버전은 동일하게 유지한다.** 기준은 **`package.json`의 `version`** 이다.

- 태그는 **이미 해당 버전이 반영된 커밋**에 붙인다. (태그 `v1.0.6` 이면 그 커밋의 `package.json` 은 `"version": "1.0.6"` 이어야 함.)
- 릴리스 워크플로는 태그와 `package.json` 버전이 다르면 **실패**한다. 먼저 버전을 올리고 커밋한 뒤 태그를 붙여야 한다.

## GitHub Release (바이너리 = npm tarball)

1. **버전 올리기** (한 가지만 사용)
   - **권장**: `npm version patch` (또는 `minor` / `major`) → `package.json` 갱신 + 커밋 + 태그 생성까지 한 번에.
   - 또는 수동: `package.json` 의 `version` 수정 후 커밋, 그 다음 `git tag vX.Y.Z` 로 같은 커밋에 태그.

2. **푸시**

   ```bash
   git push origin main
   git push origin v1.0.6
   ```

태그 푸시 시 **GitHub Actions → Release** 가 실행되고 **`deukpack-x.y.z.tgz`** 가 릴리즈 자산으로 붙는다.

공지·뉴스: 위 표의 **deukpack.app** 항목대로 상단 배너와 릴리스·뉴스 페이지를 맞추면, GitHub Releases와 사이트 노티가 같은 릴리스를 가리킨다.

- 워크플로: `.github/workflows/release.yml`  
- **검증**: 태그 `v1.2.3` 이면 해당 커밋의 `package.json` 이 `"1.2.3"` 이어야 함. 불일치 시 빌드 실패.

사용자는 Release 페이지에서 `.tgz` 받아 `npm install ./deukpack-1.0.0.tgz` 로 설치 가능.

## npm registry (선택)

1. [npm](https://www.npmjs.com/) 계정·토큰 생성.  
2. GitHub 저장소 **Settings → Secrets** 에 `NPM_TOKEN` 추가.  
3. `.github/workflows/release.yml` 맨 아래 **Publish to npm** 단계 주석 해제.  
4. 또는 로컬에서:

   ```bash
   npm run build && npm test
   npm publish --access public
   ```

`prepublishOnly` 가 publish·`npm pack` 직전에 **`CHANGELOG.release.md` / `CHANGELOG.release.ko.md`**(현재 `package.json` 버전만 발췌)를 생성한 뒤 **`build`** 와 **`bundle:vscode`**( **`bundled/deuk-idl.vsix`** )를 돌린다. 두 CHANGELOG.release 파일은 **저장소에 커밋하지 않는다** (`.gitignore`). tarball·레지스트리에는 **전체 CHANGELOG**·**해당 버전 요약**·**동봉 VSIX**가 함께 포함된다.

## CI

- **push / PR**: `.github/workflows/ci.yml` — Ubuntu·Windows, Node 18·20, `build` + `test` + **example IDL codegen smoke**.
- **push to main/master**: 동일 워크플로에서 `build-artifact` job이 `npm pack` 실행 후 **Artifact**로 `.tgz` 업로드 (90일 보관). GitHub 저장소 **Actions** → 해당 워크플로 run 선택 → **Artifacts**에서 `deukpack-npm-tarball-<sha>` 다운로드 후 `npm install ./deukpack-*.tgz` 로 사용 가능.
- **배포본 수동 생성(태그 없이)**: **Actions** → **Build release package** → **Run workflow**. 빌드·테스트 후 `deukpack-*.tgz` 가 Artifact로 올라감 (90일). 태그 푸시 없이 배포본만 필요할 때 사용.
- **릴리스 CI 실패 시**: (1) **버전 불일치** — 태그 `v1.0.5` 이면 해당 커밋의 `package.json` 이 `"1.0.5"` 여야 함. `npm version patch` 후 푸시·태그 푸시. (2) **빌드/테스트 실패** — Actions 로그에서 실패 단계 확인. 위 **Build release package** 로 같은 빌드·테스트를 수동 실행해 보면 원인 파악에 도움 됨.
- 소비자 파이프라인·샘플: [docs/DEUKPACK_CI_CD_AND_DEV_PIPELINE.md](https://github.com/joygram/DeukPack/blob/main/docs/DEUKPACK_CI_CD_AND_DEV_PIPELINE.md).

## npm 반영 및 버전 변경 (OSS 릴리스와 함께)

**관련 수정(네이티브 Wire 전환, 문서 등)이 npm·GitHub Release에 반영되려면 버전을 올린 뒤 OSS에 동기화하고, OSS에서 태그 푸시해야 한다.**


### 권장 순서 (버전 올린 뒤 npm/Release 반영)

1. **DeukPack** (내부)에서  
   - `npm version patch` (또는 `minor` — 아래 버전 정책 참고)  
   - `npm install` → `package-lock.json` 갱신 후 커밋  
   - (선택) `npm version`이 만든 로컬 태그는 릴리스용이 아니므로 `git tag -d vX.Y.Z` 로 삭제해 두거나, DeukPack 원격에는 태그를 푸시하지 않는다.  
   - `npm run sync:oss:apply` → OSS 디렉터리까지 동기화 (갱신된 `package.json` 포함)
2. **DeukPackOSS**에서  
   - `git add -A` · `git status` 확인  
   - `git commit -m "release: vX.Y.Z"` (또는 [OSS_SYNC_COMMIT_MESSAGES.md](https://github.com/joygram/DeukPack/blob/main/docs/OSS_SYNC_COMMIT_MESSAGES.ko.md) 형식)  
   - `git push origin main`
3. **같은 버전으로 태그 푸시** (DeukPackOSS에서)  
   - `git tag vX.Y.Z` (이미 푸시한 커밋에 붙일 경우 `git tag vX.Y.Z` 만, 새 커밋이면 그 커밋에서)  
   - `git push origin vX.Y.Z`  
   → GitHub Actions **Release** 워크플로 실행 → `deukpack-X.Y.Z.tgz` 자산 생성.  
   (npm 자동 배포를 쓰면 Release 성공 후 `npm publish` 단계 실행.)

이 순서를 지키면 **package.json 버전 = OSS 태그 = npm/Release 버전**이 일치해 버전 이슈가 나지 않는다.

### 네이티브(Wire/thrift 리네임) 변경과 버전·릴리스 이슈

- **네이티브 addon**은 **선택 사항**이며, 기본 설치 시 빌드하지 않고(`gypfile` 없음), 런타임도 TS 경로만 사용한다.  
  따라서 **thrift → Wire 리네임은 공개 API 변경이 아니며**, CLI·TypeScript·코드젠 사용자에게는 **breaking change가 아니다.**
- **버전**: 이번 종류의 변경은 **patch**(예: 1.0.5 → 1.0.6)로 올리면 충분하다.  
  (선택적으로 “구현 상세 변경”을 강조하고 싶으면 **minor** 1.1.0 도 가능.)
- **OSS/npm 쪽에서 이슈로 번지지 않게 하려면**  
  GitHub Release 또는 npm 버전 설명에 아래를 명시하는 것을 권장한다.  
  - *"No breaking changes for CLI or TypeScript API. Optional native addon implementation was renamed (Wire only); not built on install."*  
  - 이렇게 적어두면 “thrift 관련 변경이 호환성을 깼다”는 오해로 인한 이슈를 줄일 수 있다.

### 릴리스 노트 권장 문구 (네이티브 리네임 포함 시)

```
## v1.0.6

- No breaking changes for CLI or TypeScript API.
- Optional native addon: implementation renamed to Wire-only (no Thrift naming in OSS). Not built on `npm install`; use `npm run build:native` if needed.
- Docs/CI: release workflow, OSS sync and version policy.
```

---

## DeukPack → DeukPackOSS 동기화 (배포)

공개용 저장소(DeukPackOSS)에 배포할 때는 **동기화 스크립트**로 내부 전용 경로를 제외한 뒤 복사한다.

1. `npm run sync:oss` — dry-run으로 변경 목록 확인  
2. `npm run sync:oss:apply` — **`npm run build`**·**`bundle:vscode`**(동봉 **`bundled/deuk-idl.vsix`**) 후 `../DeukPackOSS` 로 동기화; 적용 후 OSS 쪽에서도 **`npm run build`**·**`bundle:vscode`** 가 다시 실행됨 (**버전 올린 뒤** 실행 권장)  
3. `cd ../DeukPackOSS` → `git add` · `git commit` · `git push`  
4. npm/Release 반영 시: 위 **npm 반영 및 버전 변경** 절의 순서대로 태그 푸시.

상세·제외 규칙·커밋 메시지: [docs/OSS_PUBLISH_SCOPE.md](https://github.com/joygram/DeukPack/blob/main/docs/OSS_PUBLISH_SCOPE.ko.md) §로컬 DeukPackOSS · [OSS_SYNC_COMMIT_MESSAGES.md](https://github.com/joygram/DeukPack/blob/main/docs/OSS_SYNC_COMMIT_MESSAGES.ko.md).

## 공개(OSS) vs 내부 (GitLab 정본)

| 구분 | 경로 | npm / 공개 GitHub |
|------|------|-------------------|
| **코어 CLI·코드젠** | `bin/`, `scripts/build_deukpack.js`, `dist/` | **포함** |


**형제 클론**: `i/DeukPack` · `i/DeukPackOSS` 구조일 때 동기화 → [docs/OSS_PUBLISH_SCOPE.md](https://github.com/joygram/DeukPack/blob/main/docs/OSS_PUBLISH_SCOPE.ko.md) §로컬 DeukPackOSS.
