# HiveOps + Claude Code Agent Teams 연결 가이드

Claude Code의 실험적 기능인 **Agent Teams (Swarm Mode)**를 활성화하고,
HiveOps MCP 서버를 공유 Kanban 보드로 연결하는 전체 절차.

> **주의**: Agent Teams는 실험적 기능이며 기본 비활성화 상태입니다.
> 세션 복원, 태스크 동기화, 종료 처리에 제한사항이 있습니다.

---

## 목차

1. [Agent Teams 개요](#1-agent-teams-개요)
2. [사전 준비](#2-사전-준비)
3. [설정 파일 구성](#3-설정-파일-구성)
4. [HiveOps MCP 서버 연결](#4-hiveops-mcp-서버-연결)
5. [팀 실행 방법](#5-팀-실행-방법)
6. [팀 제어 및 커뮤니케이션](#6-팀-제어-및-커뮤니케이션)
7. [품질 게이트 (Hooks)](#7-품질-게이트-hooks)
8. [CLAUDE.md 팀 가이드라인](#8-claudemd-팀-가이드라인)
9. [실전 사용 시나리오](#9-실전-사용-시나리오)
10. [제한사항 및 트러블슈팅](#10-제한사항-및-트러블슈팅)

---

## 1. Agent Teams 개요

### 구조

```
┌─────────────────────────────────────────┐
│           Team Lead (메인 세션)           │
│  - 팀 생성, 태스크 할당, 결과 종합         │
│  - 사용자와 직접 소통                      │
└──────────────┬──────────────────────────┘
               │ spawn / message / broadcast
    ┌──────────┼──────────┐
    │          │          │
    v          v          v
┌────────┐ ┌────────┐ ┌────────┐
│Teammate│ │Teammate│ │Teammate│
│ (독립   │ │ (독립   │ │ (독립   │
│ 컨텍스트)│ │ 컨텍스트)│ │ 컨텍스트)│
└───┬────┘ └───┬────┘ └───┬────┘
    │          │          │
    └──────────┼──────────┘
               │
    ┌──────────┴──────────┐
    │   Shared Resources   │
    │                      │
    │  📋 Task List        │ ← Claude 내부 태스크
    │  📬 Mailbox (inbox)  │ ← 에이전트 간 메시징
    │  📊 HiveOps MCP      │ ← 외부 Kanban 보드
    └─────────────────────┘
```

### Subagent vs Agent Teams

| 항목 | Subagent (Task 도구) | Agent Teams |
|------|---------------------|-------------|
| **컨텍스트** | 결과만 메인에 반환 | 각자 독립 컨텍스트 |
| **통신** | 메인에만 보고 | 팀원끼리 직접 메시징 |
| **조율** | 메인이 모든 작업 관리 | 공유 태스크 리스트로 자율 조율 |
| **적합한 경우** | 포커스된 단일 작업 | 복잡한 협업, 토론 필요 시 |
| **토큰 비용** | 낮음 (결과 요약) | 높음 (각자 전체 세션) |

---

## 2. 사전 준비

### 필수 요구사항

- **Claude Code** 최신 버전 (CLI)
- **Claude Max 또는 API 구독** (토큰 사용량이 많음)
- **HiveOps 서버** 빌드 완료

### 디스플레이 모드 요구사항

| 모드 | 요구사항 | 플랫폼 |
|------|---------|--------|
| `in-process` | 없음 (기본) | 모든 터미널 |
| `tmux` | tmux 설치 | Linux/macOS |
| `iterm2` | iTerm2 + it2 CLI | macOS만 |

> **Windows 참고**: Split-pane 모드는 VS Code 터미널, Windows Terminal에서
> 지원되지 않습니다. `in-process` 모드를 사용하세요.

### HiveOps 서버 빌드

```bash
cd hiveops/server
npm run build
```

---

## 3. 설정 파일 구성

### 3-1. Agent Teams 활성화

**방법 A: 글로벌 설정 (모든 프로젝트에 적용)**

`~/.claude/settings.json`에 추가:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**방법 B: 프로젝트 설정 (이 프로젝트만)**

`.claude/settings.json` (프로젝트 루트):

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**방법 C: 환경변수 (일회성)**

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
claude
```

### 3-2. 디스플레이 모드 설정

`~/.claude/settings.json` 또는 `.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process"
}
```

옵션:
- `"auto"` — tmux 세션 안이면 split-pane, 아니면 in-process (기본값)
- `"in-process"` — 메인 터미널에서 모든 팀원 실행
- `"tmux"` — tmux/iTerm2 split-pane

CLI 플래그로 일회성 지정:

```bash
claude --teammate-mode in-process
```

### 3-3. 권한 설정 (권장)

팀원들이 작업 중 권한 프롬프트가 반복되지 않도록 미리 허용:

`.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process",
  "permissions": {
    "allow": [
      "Bash(npm test:*)",
      "Bash(npm run build:*)",
      "Bash(npx tsc:*)",
      "Bash(npx vite build:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "mcp__hiveops__create_task",
      "mcp__hiveops__update_task_status",
      "mcp__hiveops__claim_task",
      "mcp__hiveops__add_comment",
      "mcp__hiveops__list_tasks",
      "mcp__hiveops__get_board_state"
    ]
  }
}
```

> **팁**: HiveOps MCP 도구를 허용 목록에 넣으면 팀원들이 칸반 보드를
> 자유롭게 사용할 수 있습니다.

---

## 4. HiveOps MCP 서버 연결

### 4-1. .mcp.json 설정

프로젝트 루트의 `.mcp.json` — 리드와 모든 팀원이 공유:

```json
{
  "mcpServers": {
    "hiveops": {
      "command": "node",
      "args": ["server/dist/index.js", "stdio"],
      "cwd": "C:\\Users\\USER\\hiveops",
      "env": {
        "HIVEOPS_DB_PATH": "C:\\Users\\USER\\hiveops\\server\\data\\hiveops.db"
      }
    }
  }
}
```

> **중요**: 모든 팀원이 **동일한 DB 경로**를 사용해야 태스크가 공유됩니다.
> `HIVEOPS_DB_PATH`를 절대 경로로 고정하세요.

### 4-2. 왜 HiveOps + Agent Teams인가?

Claude Agent Teams는 내부적으로 자체 태스크 리스트(`~/.claude/tasks/{team}/`)를 가지고 있습니다.
HiveOps를 추가로 연결하면:

| Claude 내부 태스크 | HiveOps 칸반 보드 |
|-------------------|-------------------|
| 세션 종료 시 사라짐 | SQLite에 영구 저장 |
| CLI 텍스트로만 확인 | 웹 UI 대시보드 |
| 단순 상태 (3가지) | 5단계 워크플로우 (todo→claimed→in_progress→review→done) |
| 의존성 기본 지원 | 의존성 + 블로커 + 타임라인 |
| 메시징만 가능 | 코멘트 + PM 피드백 + 활동 로그 |

**사용 패턴**: Claude Teams가 작업 조율을 하면서, HiveOps에 영구 기록을 남기는 구조.

### 4-3. 연결 확인

Claude Code 시작 후:

```
나: HiveOps 보드 상태 확인해줘
Claude: (get_board_state 호출) → 현재 보드 표시
```

---

## 5. 팀 실행 방법

### 5-1. 자연어로 팀 생성

Agent Teams는 **자연어 프롬프트**로 생성합니다. 별도 설정 파일 없습니다.

```
이 프로젝트의 API 엔드포인트를 리팩토링할 에이전트 팀을 만들어줘.
3명의 팀원:
- store.ts 리팩토링 담당
- API 라우트 테스트 작성 담당
- 보안 검토 담당

각자 작업 시작 전에 HiveOps에 태스크를 생성하고,
완료되면 상태를 done으로 업데이트해.
```

### 5-2. 모델 지정

```
팀원 4명으로 팀을 만들어줘.
각 팀원은 Sonnet 모델을 사용해.
변경 전에 계획 승인을 받도록 해.
```

### 5-3. 계획 승인 모드

리스크가 있는 작업은 팀원이 먼저 계획을 세우고 리드가 승인:

```
auth 모듈을 리팩토링할 아키텍트 팀원을 생성해.
변경 전에 계획 승인을 요구해.
```

흐름:
1. 팀원이 코드 분석 후 계획 작성
2. 리드에게 계획 승인 요청
3. 리드가 승인/거부 (거부 시 피드백과 함께 재계획)
4. 승인되면 구현 시작

---

## 6. 팀 제어 및 커뮤니케이션

### 6-1. In-Process 모드 키보드 단축키

| 키 | 동작 |
|----|------|
| `Shift+Down` | 다음 팀원으로 전환 (마지막→리드 순환) |
| 텍스트 입력 후 Enter | 현재 팀원에게 메시지 전송 |
| `Escape` | 팀원의 현재 턴 중단 |
| `Ctrl+T` | 태스크 리스트 토글 |

### 6-2. 리드에게 명령

```
보안 검토 팀원에게 auth 모듈의 취약점을 중점 검토하라고 전달해

task-003을 백엔드 담당에게 할당해

팀원들이 작업 완료할 때까지 기다려

리서처 팀원에게 종료하라고 해

팀 정리해
```

### 6-3. 팀원에게 직접 메시지

`Shift+Down`으로 팀원 선택 후:

```
나: HiveOps에 너의 현재 진행 상황을 코멘트로 남겨줘
팀원: (add_comment 호출) → 코멘트 추가됨
```

### 6-4. 태스크 관리

태스크는 3가지 상태: `pending` → `in progress` → `completed`

- **리드 할당**: 리드가 특정 팀원에게 태스크 지정
- **자율 클레임**: 팀원이 작업 완료 후 다음 unassigned 태스크를 자동으로 가져감
- **의존성**: 블로킹 태스크가 완료되면 자동으로 언블록

파일 잠금으로 동시 클레임 경합 방지.

---

## 7. 품질 게이트 (Hooks)

### 7-1. TaskCompleted 훅

팀원이 태스크를 완료 표시할 때 검증:

`.claude/hooks/validate-task.sh`:

```bash
#!/bin/bash
# 태스크 완료 전 테스트 통과 확인
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')

echo "[$TEAMMATE] Validating: $TASK_SUBJECT" >&2

# TypeScript 타입 체크
if ! npx tsc --noEmit 2>&1; then
  echo "TypeScript errors found. Fix before completing: $TASK_SUBJECT" >&2
  exit 2  # exit 2 = 완료 거부, 피드백 전달
fi

exit 0
```

### 7-2. TeammateIdle 훅

팀원이 유휴 상태로 전환될 때:

`.claude/hooks/check-idle.sh`:

```bash
#!/bin/bash
INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')

# HiveOps에서 남은 태스크 확인 (선택적)
echo "[$TEAMMATE] going idle" >&2
exit 0
```

### 7-3. 훅 등록

`.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/validate-task.sh"
          }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash $CLAUDE_PROJECT_DIR/.claude/hooks/check-idle.sh"
          }
        ]
      }
    ]
  }
}
```

훅 입력 JSON 형식:

```json
{
  "hook_event_name": "TaskCompleted",
  "task_id": "task-001",
  "task_subject": "Refactor store.ts",
  "task_description": "...",
  "teammate_name": "backend-specialist",
  "team_name": "hiveops-refactor"
}
```

---

## 8. CLAUDE.md 팀 가이드라인

팀원들은 프로젝트의 `CLAUDE.md`를 자동으로 읽습니다.
팀 작업용 가이드라인을 추가하면 모든 팀원이 따릅니다.

프로젝트 루트 `CLAUDE.md`에 추가할 내용:

```markdown
## Agent Team 규칙

### HiveOps 연동
- 작업 시작 시: `claim_task`로 태스크 클레임
- 작업 중: `update_task_status`로 `in_progress` 전환
- 작업 완료 시: `update_task_status`로 `review` 전환 (done은 리드만)
- 진행 상황: `add_comment`로 주요 결정/변경사항 기록

### 파일 충돌 방지
- 각 팀원은 할당된 파일만 수정
- 공유 파일(types.ts, utils.ts) 수정 시 리드에게 먼저 알림
- 같은 파일을 두 팀원이 동시에 수정하지 않음

### 코드 품질
- 모든 변경 후 `npx tsc --noEmit` 통과 필수
- 기존 코드 스타일 준수
- 새 함수에는 간단한 JSDoc 추가
```

---

## 9. 실전 사용 시나리오

### 시나리오 1: 병렬 기능 개발

```
HiveOps 프로젝트에 3가지 기능을 병렬로 개발할 팀을 만들어줘:

1. 팀원 A: 태스크 우선순위 자동 에스컬레이션 (store.ts)
   - 24시간 이상 in_progress인 태스크를 자동으로 priority up

2. 팀원 B: 에이전트 성능 통계 API (http-server.ts)
   - 에이전트별 완료율, 평균 처리 시간 등

3. 팀원 C: MCP 도구 추가 (mcp-server.ts)
   - bulk_create_tasks, search_tasks 도구

각 팀원은:
- 시작할 때 HiveOps에 자신의 태스크를 create_task로 생성
- 작업 중 진행 상황을 add_comment로 기록
- 완료되면 update_task_status로 review로 변경
```

### 시나리오 2: 코드 리뷰 팀

```
HiveOps 서버 코드를 리뷰할 팀을 만들어줘. 3명:
- 보안 전문가: SQL 인젝션, 인증, 입력 검증 검토
- 성능 전문가: 쿼리 최적화, 메모리 사용, 동시성 검토
- 테스트 전문가: 테스트 커버리지 분석, 누락된 엣지 케이스 식별

각자 리뷰 결과를 HiveOps에 태스크로 생성하고,
발견한 이슈마다 코멘트를 남겨.
```

### 시나리오 3: 버그 가설 경쟁 조사

```
WebSocket 연결이 간헐적으로 끊기는 문제를 조사할 팀을 만들어줘.
5명의 팀원이 각각 다른 가설을 조사:
- 서버 메모리 누수
- 클라이언트 재연결 로직 문제
- SQLite WAL 잠금 충돌
- 네트워크 타임아웃 설정
- 이벤트 루프 블로킹

서로의 가설을 반박하면서 과학적 토론을 해.
최종 합의를 HiveOps에 기록해.
```

---

## 10. 제한사항 및 트러블슈팅

### 알려진 제한사항

| 제한 | 설명 |
|------|------|
| **세션 복원 불가** | `/resume`으로 팀원 복원 안 됨. 새 팀원 생성 필요 |
| **태스크 상태 지연** | 팀원이 완료 표시를 놓칠 수 있음. 수동 확인 필요 |
| **종료 느림** | 팀원이 현재 작업을 마친 후 종료 |
| **세션당 1팀** | 새 팀 전에 현재 팀 정리 필수 |
| **중첩 팀 불가** | 팀원이 자체 팀 생성 불가 |
| **리드 고정** | 리더십 이전 불가 |
| **권한 공유** | 팀원은 리드의 권한 모드로 시작 |
| **Split-pane** | VS Code 터미널, Windows Terminal에서 미지원 |

### 트러블슈팅

**팀원이 나타나지 않을 때**:
- `Shift+Down`으로 숨겨진 팀원 확인
- 태스크가 팀을 정당화할 만큼 복잡한지 확인
- tmux 설치 확인: `which tmux`

**권한 프롬프트 과다**:
- `.claude/settings.json`에서 HiveOps MCP 도구와 빌드 명령을 미리 허용

**팀원 에러로 중단**:
- `Shift+Down`으로 해당 팀원 출력 확인
- 직접 추가 지시 전달
- 또는 대체 팀원 생성

**리드가 먼저 끝나버릴 때**:
```
팀원들이 작업 완료할 때까지 기다려
```

**orphaned tmux 세션**:
```bash
tmux ls
tmux kill-session -t <session-name>
```

**HiveOps DB 충돌**:
- 모든 팀원이 동일한 `HIVEOPS_DB_PATH`를 사용하는지 확인
- SQLite WAL 모드가 활성화되어 있어 동시 읽기는 안전
- 동시 쓰기 시 SQLite가 자동으로 직렬화

---

## 빠른 시작 체크리스트

```bash
# 1. HiveOps 서버 빌드
cd hiveops/server && npm run build

# 2. 설정 파일 생성 (프로젝트 레벨)
cat > .claude/settings.json << 'EOF'
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process",
  "permissions": {
    "allow": [
      "Bash(npm test:*)",
      "Bash(npm run build:*)",
      "Bash(npx tsc:*)",
      "mcp__hiveops__create_task",
      "mcp__hiveops__update_task_status",
      "mcp__hiveops__claim_task",
      "mcp__hiveops__add_comment",
      "mcp__hiveops__list_tasks",
      "mcp__hiveops__get_board_state"
    ]
  }
}
EOF

# 3. .mcp.json 확인 (HiveOps 연결)
cat .mcp.json

# 4. Claude Code 실행
claude

# 5. 팀 생성 (자연어)
# "에이전트 팀을 만들어줘. 3명이 HiveOps 태스크를 나눠서 작업해."
```

---

## 참고 링크

- [공식 문서: Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [공식 문서: Hooks](https://code.claude.com/docs/en/hooks)
- [공식 문서: Settings](https://code.claude.com/docs/en/settings)
- [Agent Teams 아키텍처 분석](https://paddo.dev/blog/claude-code-hidden-swarm/)
- [Swarm Mode 가이드](https://addyosmani.com/blog/claude-code-agent-teams/)
