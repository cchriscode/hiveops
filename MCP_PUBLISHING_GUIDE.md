# HiveOps MCP Server 퍼블리싱 가이드

로컬 테스트 → npm 배포 → MCP Registry 등록까지의 전체 과정.

---

## 목차

1. [npm 배포용 코드 수정](#1-npm-배포용-코드-수정)
2. [빌드 및 npm 패키지 준비](#2-빌드-및-npm-패키지-준비)
3. [로컬 테스트](#3-로컬-테스트)
4. [npm 배포](#4-npm-배포)
5. [MCP Registry 등록](#5-mcp-registry-등록)
6. [사용자 설치 방법](#6-사용자-설치-방법)

---

## 1. npm 배포용 코드 수정

### 1-1. server/package.json 수정

```json
{
  "name": "hiveops-mcp",
  "version": "1.0.0",
  "description": "AI agent coordination Kanban board - MCP server",
  "type": "module",
  "bin": {
    "hiveops-mcp": "./dist/index.js"
  },
  "files": [
    "dist"
  ],
  "keywords": [
    "mcp",
    "model-context-protocol",
    "kanban",
    "ai-agent",
    "task-management"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/hiveops"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts http",
    "build": "tsc",
    "prepublishOnly": "npm run build",
    "start": "node dist/index.js http",
    "mcp": "tsx src/index.ts stdio"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.0",
    "better-sqlite3": "^12.6.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

변경사항:
- `name`: `hiveops-mcp` (npm에서 고유해야 함, 먼저 `npm search hiveops-mcp`로 확인)
- `bin`: CLI 엔트리포인트 추가
- `files`: `dist` 폴더만 배포
- `keywords`, `license`, `repository` 추가
- `prepublishOnly`: 배포 전 자동 빌드

### 1-2. dist/index.js shebang 추가

빌드된 `dist/index.js` 맨 위에 shebang이 필요합니다. TypeScript 빌드에서 자동으로 추가되지 않으므로 빌드 스크립트를 수정합니다.

**방법 A: 빌드 후 수동 추가 (간단)**

`server/package.json`의 build 스크립트 수정:

```json
"scripts": {
  "build": "tsc && node -e \"const fs=require('fs');const f='dist/index.js';fs.writeFileSync(f,'#!/usr/bin/env node\\n'+fs.readFileSync(f,'utf8'));\""
}
```

**방법 B: 별도 빌드 스크립트 (깔끔)**

`server/scripts/add-shebang.js` 생성:

```js
import { readFileSync, writeFileSync } from "fs";

const file = "dist/index.js";
const content = readFileSync(file, "utf8");
if (!content.startsWith("#!")) {
  writeFileSync(file, "#!/usr/bin/env node\n" + content);
}
```

```json
"scripts": {
  "build": "tsc && node scripts/add-shebang.js"
}
```

### 1-3. DB 경로 수정 (중요)

현재 `db.ts`는 이미 `HIVEOPS_DB_PATH` 환경변수를 지원합니다. npm으로 설치하면 `__dirname` 기반 기본 경로가 `node_modules/` 안을 가리키므로 fallback 경로를 사용자 홈 디렉토리로 변경해야 합니다.

`server/src/db.ts` 수정:

```ts
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const defaultDir = path.join(os.homedir(), ".hiveops");
const dbPath = process.env.HIVEOPS_DB_PATH
  || path.join(defaultDir, "hiveops.db");

// data 디렉토리 자동 생성
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
```

이렇게 하면:
- 환경변수 설정 시: 지정 경로 사용
- 환경변수 없을 때: `~/.hiveops/hiveops.db` 사용

### 1-4. stdio 모드를 기본값으로

현재 `index.ts`에서 `mode`가 없으면 stdio + http 둘 다 시작됩니다. MCP 클라이언트는 stdio만 필요하므로 기본값을 stdio로 명확히 합니다.

현재 코드가 이미 `if (mode === "stdio" || !mode)` 패턴이므로, npx로 실행하면 인자 없이 stdio로 동작합니다. **변경 불필요**.

### 1-5. .npmignore 생성

`server/.npmignore`:

```
src/
tsconfig.json
scripts/
data/
*.ts
!dist/**
```

---

## 2. 빌드 및 npm 패키지 준비

### 2-1. 빌드 확인

```bash
cd server
npm run build
```

`dist/` 폴더에 빌드 결과물이 생성되는지 확인:

```bash
ls dist/
# index.js, db.js, mcp-server.js, store.js, http-server.js, events.js, types.js
```

`dist/index.js` 첫 줄이 `#!/usr/bin/env node`인지 확인:

```bash
head -1 dist/index.js
# #!/usr/bin/env node
```

### 2-2. 패키지 내용 미리보기

```bash
cd server
npm pack --dry-run
```

`dist/` 폴더만 포함되는지 확인합니다. 소스코드(`src/`)나 데이터(`data/`)는 빠져야 합니다.

---

## 3. 로컬 테스트

### 3-1. MCP Inspector로 테스트

MCP Inspector는 공식 디버깅 도구입니다:

```bash
# 프로젝트 루트에서
npx @modelcontextprotocol/inspector node server/dist/index.js stdio
```

브라우저에서 `http://localhost:5173`이 열리면:
- **Tools** 탭: 17개 도구 목록 확인 (create_task, list_tasks, update_task_status 등)
- **Resources** 탭: 3개 리소스 확인
- 도구 실행 테스트: `create_task` → title 입력 → 결과 확인
- `list_tasks` → 방금 생성한 태스크 표시 확인

### 3-2. Claude Desktop에서 테스트

`claude_desktop_config.json` 수정 (위치는 OS에 따라 다름):

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "node",
      "args": ["C:/Users/USER/hiveops/server/dist/index.js", "stdio"]
    }
  }
}
```

Claude Desktop 재시작 후, 채팅에서 "list all tasks" 등으로 동작 확인.

### 3-3. Claude Code에서 테스트

프로젝트의 `.mcp.json`은 이미 설정되어 있으므로 현재 그대로 사용 가능.

빌드된 버전으로 테스트하려면 `.mcp.json` 수정:

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "node",
      "args": ["server/dist/index.js", "stdio"],
      "cwd": "C:\\Users\\USER\\hiveops"
    }
  }
}
```

### 3-4. npx 로컬 설치 시뮬레이션

npm 배포 전에 로컬에서 npx 실행을 시뮬레이션:

```bash
cd server
npm pack
# hiveops-mcp-1.0.0.tgz 생성

# 다른 디렉토리에서 설치 테스트
mkdir /tmp/test-hiveops && cd /tmp/test-hiveops
npm init -y
npm install /path/to/hiveops/server/hiveops-mcp-1.0.0.tgz

# 실행 확인
npx hiveops-mcp stdio
```

MCP Inspector로 이 설치 경로도 테스트:

```bash
npx @modelcontextprotocol/inspector npx hiveops-mcp stdio
```

---

## 4. npm 배포

### 4-1. npm 계정 준비

```bash
# 계정이 없다면
npm adduser

# 이미 있다면 로그인
npm login

# 로그인 확인
npm whoami
```

### 4-2. 패키지명 중복 확인

```bash
npm search hiveops-mcp
# 또는
npm view hiveops-mcp
```

이미 존재하면 다른 이름 사용 (예: `@your-scope/hiveops-mcp`).

### 4-3. 배포

```bash
cd server
npm publish
```

scoped 패키지(`@scope/name`)라면:

```bash
npm publish --access public
```

### 4-4. 배포 확인

```bash
# 즉시 설치 테스트
npx hiveops-mcp stdio
```

---

## 5. MCP Registry 등록

MCP Registry(https://registry.modelcontextprotocol.io)에 등록하면 Claude Desktop, Cursor 등에서 원클릭 설치가 가능합니다.

### 5-1. server.json 생성

`server/server.json`:

```json
{
  "name": "io.github.YOUR_USERNAME/hiveops",
  "description": "AI agent coordination Kanban board with task management, dependencies, timeline tracking, and real-time collaboration",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/hiveops"
  },
  "packages": [
    {
      "registry_name": "npm",
      "name": "hiveops-mcp",
      "version": "1.0.0",
      "runtime": "node",
      "environment_variables": [
        {
          "name": "HIVEOPS_DB_PATH",
          "description": "Custom SQLite database file path (default: ~/.hiveops/hiveops.db)",
          "required": false
        }
      ]
    }
  ]
}
```

**주의사항**:
- `name` 형식: `io.github.{username}/{repo-name}` (GitHub namespace)
- `packages[].name`: npm에 배포한 패키지 이름과 일치해야 함
- `runtime`: `node` (better-sqlite3는 native addon이므로 필요)

### 5-2. mcp-publisher CLI 설치

```bash
# macOS/Linux
brew install nicholasgasior/tap/mcp-publisher

# 또는 직접 다운로드
# https://github.com/nicholasgasior/mcp-publisher/releases
```

Windows에서는 릴리즈 페이지에서 바이너리 다운로드.

### 5-3. GitHub 인증

```bash
mcp-publisher login github
```

브라우저에서 GitHub OAuth 인증 진행. 완료되면 토큰이 로컬에 저장됩니다.

### 5-4. server.json 검증

```bash
cd server
mcp-publisher validate server.json
```

에러가 없으면 준비 완료.

### 5-5. Registry에 퍼블리시

```bash
mcp-publisher publish server.json
```

성공하면 https://registry.modelcontextprotocol.io 에서 검색 가능합니다.

### 5-6. 버전 업데이트 시

1. 코드 수정
2. `server/package.json`의 `version` 올리기
3. `server/server.json`의 `version`과 `packages[].version` 일치시키기
4. `npm publish`
5. `mcp-publisher publish server.json`

---

## 6. 사용자 설치 방법

Registry 등록 후 사용자들이 설치하는 방법:

### Claude Desktop

설정 파일에 추가:

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "npx",
      "args": ["-y", "hiveops-mcp", "stdio"]
    }
  }
}
```

### Claude Code

프로젝트의 `.mcp.json`:

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "npx",
      "args": ["-y", "hiveops-mcp", "stdio"]
    }
  }
}
```

### 커스텀 DB 경로 사용 시

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "npx",
      "args": ["-y", "hiveops-mcp", "stdio"],
      "env": {
        "HIVEOPS_DB_PATH": "/path/to/my/hiveops.db"
      }
    }
  }
}
```

---

## 체크리스트

배포 전 확인 목록:

- [ ] `server/package.json`에 `bin`, `files`, `keywords`, `license`, `repository` 추가
- [ ] `dist/index.js`에 shebang (`#!/usr/bin/env node`) 추가되는지 확인
- [ ] `db.ts` 기본 경로를 `~/.hiveops/hiveops.db`로 변경
- [ ] `.npmignore` 생성하여 소스코드 제외
- [ ] `npm run build` 성공
- [ ] `npm pack --dry-run`으로 포함 파일 확인
- [ ] MCP Inspector로 도구/리소스 동작 테스트
- [ ] `npm pack` → 로컬 설치 → `npx hiveops-mcp stdio` 동작 확인
- [ ] npm 로그인 및 패키지명 중복 확인
- [ ] `npm publish` 성공
- [ ] `npx hiveops-mcp stdio` 원격 설치 동작 확인
- [ ] `server.json` 작성 (GitHub namespace 포함)
- [ ] `mcp-publisher validate` 통과
- [ ] `mcp-publisher publish` 성공
- [ ] Registry 페이지에서 검색 확인
