# HiveOps 설정 및 사용 가이드

AI 에이전트가 협업하는 칸반보드 시스템. Claude Code의 Agent Teams 기능과 연동하여 여러 AI 에이전트가 하나의 칸반보드에서 태스크를 생성/관리하며 병렬 작업하는 환경을 구축합니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [프로젝트 설치](#2-프로젝트-설치)
3. [실행 방법](#3-실행-방법)
4. [MCP 서버 연결](#4-mcp-서버-연결)
5. [Agent Teams로 멀티에이전트 실행](#5-agent-teams로-멀티에이전트-실행)
6. [사용 예시](#6-사용-예시)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 사전 준비

아래 도구들이 설치되어 있어야 합니다.

| 도구 | 최소 버전 | 확인 명령어 |
|------|----------|------------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Claude Code CLI | 최신 | `claude --version` |

### Claude Code 설치 (아직 없다면)

```bash
npm install -g @anthropic-ai/claude-code
```

설치 후 로그인:

```bash
claude login
```

---

## 2. 프로젝트 설치

```bash
# 저장소 클론
git clone <repository-url> hiveops
cd hiveops

# 의존성 설치 (server + client 모두)
npm install

# 클라이언트 빌드 (프로덕션 모드용)
npm run build
```

### 프로젝트 구조

```
hiveops/
├── server/          # Express + WebSocket + MCP 서버
│   └── src/
│       ├── index.ts       # 진입점 (stdio / http 모드)
│       ├── store.ts       # SQLite CRUD
│       ├── mcp-server.ts  # MCP 도구 등록
│       ├── http-server.ts # REST API + WebSocket
│       ├── db.ts          # DB 초기화/마이그레이션
│       ├── events.ts      # 이벤트 브릿지
│       └── types.ts       # 타입 정의
├── client/          # React 칸반보드 UI
│   └── src/
│       ├── App.tsx
│       ├── api.ts         # WebSocket + REST 헬퍼
│       └── components/    # Board, Column, TaskCard 등
├── .mcp.json        # MCP 서버 설정 (Claude Code용)
└── package.json     # 모노레포 워크스페이스
```

---

## 3. 실행 방법

HiveOps 서버는 두 가지 모드로 실행됩니다.

### 모드 A: 웹 UI 서버 (HTTP + WebSocket)

브라우저에서 칸반보드를 보고 싶을 때:

```bash
npm run dev:server
```

브라우저에서 `http://localhost:4567` 접속하면 칸반보드가 표시됩니다.

### 모드 B: MCP 서버 (stdio)

Claude Code가 자동으로 실행합니다. 수동 실행 불필요.
`.mcp.json` 파일이 프로젝트 루트에 있으면, Claude Code가 프로젝트 디렉토리에서 실행될 때 자동으로 MCP 서버를 시작합니다.

### 두 모드 동시 사용 (권장)

터미널 1 — 웹 UI 서버:
```bash
npm run dev:server
```

터미널 2 — Claude Code (MCP 자동 연결):
```bash
cd hiveops
claude
```

이렇게 하면 Claude가 MCP로 태스크를 조작하고, 브라우저에서 실시간으로 칸반보드 변화를 볼 수 있습니다. 서버가 2초마다 DB를 폴링하여 MCP 변경사항을 WebSocket으로 브로드캐스트합니다.

---

## 4. MCP 서버 연결

### 4-1. 프로젝트 레벨 설정 (이미 포함됨)

프로젝트 루트의 `.mcp.json` 파일이 자동 적용됩니다:

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "cmd",
      "args": ["/c", "npx", "tsx", "server/src/index.ts", "stdio"],
      "cwd": "C:\\Users\\USER\\hiveops",
      "env": {
        "HIVEOPS_DB_PATH": "C:\\Users\\USER\\hiveops\\server\\data\\hiveops.db"
      }
    }
  }
}
```

> **macOS/Linux 사용자**: `command`와 `args`를 아래처럼 변경하세요:
> ```json
> {
>   "mcpServers": {
>     "hiveops": {
>       "command": "npx",
>       "args": ["tsx", "server/src/index.ts", "stdio"],
>       "cwd": "/path/to/hiveops",
>       "env": {
>         "HIVEOPS_DB_PATH": "/path/to/hiveops/server/data/hiveops.db"
>       }
>     }
>   }
> }
> ```

### 4-2. 연결 확인

Claude Code 실행 후 `/mcp` 명령으로 확인:

```
> /mcp
```

`hiveops` 서버가 "connected" 상태로 표시되어야 합니다.

### 4-3. 사용 가능한 MCP 도구

연결되면 Claude Code에서 아래 도구들을 사용할 수 있습니다:

| 도구 | 설명 |
|------|------|
| `create_task` | 새 태스크 생성 (title, description, priority, category, project, agent) |
| `update_task_status` | 태스크 상태 변경 (todo → claimed → in_progress → review → done) |
| `update_task` | 태스크 필드 수정 (title, description, priority, category, project) |
| `claim_task` | 에이전트가 태스크를 가져감 (agent 이름 설정) |
| `delete_task` | 태스크 삭제 |
| `add_comment` | 태스크에 코멘트 추가 |
| `get_comments` | 태스크의 코멘트 목록 조회 |
| `list_tasks` | 태스크 목록 조회 (status, project, agent, category 필터) |
| `get_board_state` | 전체 칸반보드 상태 조회 |

### 4-4. Claude Desktop에도 연결하기 (선택사항)

Claude Desktop 앱(Chat/Cowork 탭)에서도 사용하려면:

1. Claude Desktop 앱 열기
2. **햄버거 메뉴 → File → Settings → Developer** 탭
3. `claude_desktop_config.json` 파일에 추가:

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "cmd",
      "args": ["/c", "npx", "tsx", "C:/Users/USER/hiveops/server/src/index.ts", "stdio"],
      "env": {
        "HIVEOPS_DB_PATH": "C:/Users/USER/hiveops/server/data/hiveops.db"
      }
    }
  }
}
```

4. Claude Desktop 완전히 재시작 (트레이에서도 종료 후 재실행)

---

## 5. Agent Teams로 멀티에이전트 실행

Agent Teams는 여러 Claude Code 인스턴스가 팀으로 협업하는 실험적 기능입니다.

### 5-1. Agent Teams 활성화

**방법 A — settings.json (영구 적용, 권장)**

`~/.claude/settings.json` 파일을 생성하거나 편집:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**방법 B — 환경변수 (일회성)**

```bash
# Windows (PowerShell)
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"
claude

# macOS/Linux
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude
```

### 5-2. 팀 실행하기

HiveOps 프로젝트 디렉토리에서 Claude Code를 실행하고, 자연어로 팀을 요청합니다:

```bash
cd hiveops
claude
```

그리고 아래처럼 입력:

```
에이전트 팀을 만들어줘.

팀 구성:
- frontend: 클라이언트 코드 개선 담당
- backend: 서버 코드 개선 담당
- tester: 테스트 작성 담당

규칙:
- 각 에이전트는 작업 시작 전 create_task로 칸반보드에 태스크 등록
- claim_task로 자기 태스크 가져가기
- 작업 중 update_task_status로 in_progress 설정
- 완료 시 update_task_status로 done 처리
- 중요 발견사항은 add_comment로 기록
```

### 5-3. 작동 구조

```
터미널                               브라우저
┌─────────────────────────┐         ┌──────────────────────┐
│  Claude Code            │         │  http://localhost:4567│
│  ┌───────────────────┐  │         │                      │
│  │  Team Lead        │  │         │  ┌──┬──┬──┬──┬──┐   │
│  │  (조율/할당)       │  │         │  │To│Cl│In│Re│Do│   │
│  └───────────────────┘  │         │  │Do│ai│Pr│vi│ne│   │
│  ┌────┐ ┌────┐ ┌────┐  │         │  │  │me│og│ew│  │   │
│  │FE  │ │BE  │ │Test│  │         │  │  │d │  │  │  │   │
│  │    │ │    │ │    │  │         │  │▓▓│▓▓│▓▓│  │▓▓│   │
│  └──┬─┘ └──┬─┘ └──┬─┘  │         │  └──┴──┴──┴──┴──┘   │
│     │      │      │     │         │   실시간 업데이트!     │
│     ▼      ▼      ▼     │         └──────────▲───────────┘
│  ┌───────────────────┐  │                    │
│  │  HiveOps MCP      │  │──── SQLite DB ────►│
│  │  (stdio 모드)      │  │     2초 폴링       │
│  └───────────────────┘  │         ┌──────────┴───────────┐
└─────────────────────────┘         │  HTTP Server         │
                                    │  (npm run dev:server) │
                                    └──────────────────────┘
```

- **Team Lead**: 전체 작업을 조율하고 태스크를 할당
- **Teammates**: 각자 독립적인 컨텍스트에서 작업하며 MCP 도구로 칸반보드 업데이트
- **SQLite DB**: MCP(stdio)와 HTTP 서버가 동일한 DB를 공유
- **브라우저**: HTTP 서버가 DB 변경을 감지하여 WebSocket으로 실시간 반영

### 5-4. 팀 조작하기

```
# Teammate 전환 (in-process 모드)
Shift + ↓    다음 Teammate로 이동
Shift + ↑    이전 Teammate로 이동
Enter        선택한 Teammate 세션 보기
Escape       현재 Teammate 인터럽트
Ctrl + T     태스크 목록 토글

# Lead에게 지시
"frontend teammate에게 버튼 스타일 수정하라고 해줘"
"모든 teammate가 끝날 때까지 기다려줘"
"팀 정리해줘"  (종료 시)
```

### 5-5. 표시 모드

| 모드 | 설명 | 설정 |
|------|------|------|
| in-process (기본) | 모든 teammate가 하나의 터미널에서 실행. Shift+↓로 전환 | 별도 설정 불필요 |
| split panes | 각 teammate가 별도 터미널 패널. 동시에 모두 볼 수 있음 | tmux 또는 iTerm2 필요 |

split panes 모드 사용:
```bash
# tmux 설치 후
claude --teammate-mode tmux
```

---

## 6. 사용 예시

### 예시 1: 코드 리뷰 팀

```
에이전트 팀을 만들어서 이 프로젝트를 리뷰해줘.

- security: 보안 취약점 분석
- performance: 성능 병목 분석
- quality: 코드 품질/유지보수성 분석

각 에이전트가 발견한 이슈마다:
1. create_task로 칸반보드에 등록 (category는 각자 역할에 맞게)
2. priority를 적절히 설정
3. add_comment로 상세 분석 내용 기록
4. 완료 후 update_task_status로 done 처리
```

### 예시 2: 기능 개발 팀

```
새 기능을 개발할 에이전트 팀을 만들어줘.

작업: 사용자 알림 시스템 추가

- architect: 설계 담당 (plan approval 필요)
- implementer: 구현 담당
- tester: 테스트 작성 담당

architect가 먼저 설계를 완료하면,
implementer와 tester가 병렬로 작업 시작.
모든 태스크는 칸반보드로 관리.
```

### 예시 3: 디버깅 팀

```
앱에서 WebSocket 연결이 간헐적으로 끊기는 문제가 있어.
에이전트 팀을 만들어서 다른 가설로 조사해줘.

- hypothesis-1: 서버 메모리 누수 가능성 조사
- hypothesis-2: 네트워크 타임아웃 설정 문제 조사
- hypothesis-3: 클라이언트 재연결 로직 문제 조사

서로 대화하면서 가설을 검증/반박하고,
진행 상황을 칸반보드에 기록해줘.
```

### 예시 4: 단일 에이전트로 칸반보드 사용 (팀 없이)

Agent Teams 없이도 단일 Claude Code 세션에서 칸반보드를 사용할 수 있습니다:

```bash
cd hiveops
claude
```

```
이 프로젝트에서 TODO 주석을 찾아서
각각 칸반보드에 태스크로 등록해줘.
priority는 내용에 따라 적절히 설정하고
category는 파일 위치에 따라 backend/frontend로 분류해줘.
```

---

## 7. 트러블슈팅

### MCP 서버가 연결되지 않을 때

```bash
# Claude Code 내에서 확인
> /mcp

# hiveops가 disconnected로 표시되면:
# 1. cwd 경로가 정확한지 확인
# 2. node_modules가 설치되어 있는지 확인 (npm install)
# 3. .mcp.json의 경로가 절대경로인지 확인
```

### 웹 UI에 변경사항이 반영되지 않을 때

MCP(stdio)와 HTTP 서버는 같은 SQLite DB를 공유합니다.
HTTP 서버는 2초마다 DB를 폴링합니다. 변경 반영에 최대 2초 지연이 있을 수 있습니다.

```bash
# HTTP 서버가 실행 중인지 확인
npm run dev:server

# 브라우저에서 WebSocket 연결 확인
# 헤더의 녹색 "Live" 점이 깜빡이면 연결됨
```

### Agent Teams가 활성화되지 않을 때

```bash
# 설정 확인
claude config list

# CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS가 "1"인지 확인
# 없으면 ~/.claude/settings.json에 추가
```

### Teammate가 MCP 도구를 못 찾을 때

Teammate는 프로젝트의 `.mcp.json`을 자동으로 로드합니다.
`.mcp.json`이 프로젝트 루트에 있고, Teammate가 같은 디렉토리에서 실행되는지 확인하세요.

### Windows에서 MCP 서버 실행 오류

Windows에서는 `cmd /c` 래퍼가 필요합니다 (이미 `.mcp.json`에 설정됨):

```json
{
  "command": "cmd",
  "args": ["/c", "npx", "tsx", "server/src/index.ts", "stdio"]
}
```

`cmd /c` 없이 직접 `npx`를 실행하면 "Connection closed" 오류가 발생합니다.

### DB 초기화 (데이터 리셋)

```bash
# DB 파일 삭제 (서버 재시작 시 자동 재생성)
rm server/data/hiveops.db
rm -f server/data/hiveops.db-wal
rm -f server/data/hiveops.db-shm
```
