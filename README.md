# 🏆 LoL 스크림 내전 관리 시스템

> **호낳대 전용** 리그 오브 레전드 내전 팀 자동 밸런싱 & 실력 추적 웹 플랫폼

---

## 📌 프로젝트 개요

TrueSkill™ 알고리즘을 기반으로 **포지션별 MMR**을 자동으로 계산하고, 10명의 참가자를 가장 공정하게 나누는 **황금 밸런스 팀 짜기** 기능을 제공하는 내전 관리 웹 애플리케이션입니다.

승/패 결과만 입력하면 알아서 실력 점수가 업데이트되며, 가상 데이터 입력 기능으로 초기 모델을 빠르게 보정할 수 있습니다.

---

## 🗂 디렉토리 구조

```
01_호낳대/
├── backend/            # FastAPI 백엔드 서버
│   ├── main.py         # API 엔드포인트 정의
│   ├── model.py        # TrueSkill 계산 & 매칭 알고리즘
│   ├── database.py     # DB 모델 & SQLite 연결
│   ├── auth.py         # JWT 인증 & 권한 관리
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/           # React + Vite 프론트엔드
│   ├── src/
│   │   ├── App.jsx         # 라우팅 & 사이드바 레이아웃
│   │   ├── index.css       # 전역 다크테마 스타일
│   │   └── pages/
│   │       ├── Leaderboard.jsx      # 전체 랭킹 페이지
│   │       ├── Login.jsx            # 로그인 / 회원가입
│   │       ├── PlayerManagement.jsx # 선수 등록 관리
│   │       ├── TeamBuilder.jsx      # 10인 자동 팀 배정
│   │       ├── RecordMatch.jsx      # 실전 결과 기록
│   │       ├── VirtualDataEntry.jsx # 가상 데이터 입력
│   │       └── Admin.jsx            # 관리자: 가입 승인
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml  # 전체 서비스 통합 실행
├── 01_code/            # (예비 디렉토리)
└── 02_data/            # (예비 디렉토리)
```

---

## ⚙️ 기술 스택

| 구분 | 기술 |
|------|------|
| **프론트엔드** | React 18, Vite 5, React Router v6, Axios |
| **백엔드** | FastAPI, Python |
| **데이터베이스** | SQLite (SQLAlchemy ORM) |
| **인증** | JWT (python-jose), bcrypt (passlib) |
| **MMR 알고리즘** | TrueSkill™ |
| **컨테이너** | Docker, Docker Compose |

---

## 🧠 핵심 알고리즘

### TrueSkill 기반 포지션별 MMR

각 선수는 **5개 포지션(탑, 정글, 미드, ADC, 서포터)** 각각에 대해 독립적인 TrueSkill 점수 `(mu, sigma)`를 가집니다.

- **초기값**: `mu = 25.0`, `sigma = 8.333`  
- 무승부 확률은 `0.0`으로 설정 (승/패만 존재)
- 매 경기 결과가 반영될 때마다 해당 포지션의 `mu`와 `sigma`가 갱신됩니다
- 표시되는 **평균 MMR** = 5개 포지션 `mu`의 산술 평균

### 황금 밸런스 팀 짜기 (`find_best_matchup`)

10명을 선택하면 가능한 모든 조합과 포지션 배치를 완전 탐색하여 **양 팀 MMR 차이가 최소**인 편성을 찾습니다.

- C(10,5) × 5! × 5! 조합을 완전 탐색
- **불가능 포지션** 제약 조건을 자동으로 필터링
- 결과로 블루/레드팀 각 포지션 배정과 MMR 차이를 반환

---

## 🔐 인증 및 권한 체계

```
비회원 → 랭킹 조회 가능 (읽기 전용)
회원가입 → 관리자 승인 대기
승인된 회원 → 선수 추가, 팀 짜기, 결과 기록, 가상 데이터 입력
관리자 → 위 모든 기능 + 회원 승인/관리
```

- **첫 번째 가입자**는 자동으로 관리자(Admin) + 승인 처리됨
- JWT 토큰 유효기간: **7일**
- 토큰은 `localStorage`에 저장되어 새로고침 후에도 로그인 유지

---

## 🖥️ 페이지 기능 설명

### 👑 랭킹 (Leaderboard) - `/`
- 모든 선수의 포지션별 `mu` 점수와 평균 MMR을 테이블로 표시
- 로그인 없이 누구나 열람 가능
- 상위 3위는 강조 표시

### 🔐 로그인 / 가입 - `/login`
- 로그인과 회원가입 폼을 탭으로 전환
- 회원가입 후 관리자 승인을 받아야 기능 이용 가능

### 👥 선수 관리 - `/players`
- 새 선수 이름/닉네임 등록
- **불가능 포지션** 설정: 해당 포지션에는 팀 배정 시 배치되지 않음
- **초기 점수 복사**: 기존 선수 1~3명을 선택해 평균 MMR로 신규 선수 초기화 (완전 초보 방지)

### ⚖️ 팀 짜기 (10인) - `/teambuilder`
- 등록된 선수 목록에서 10명을 클릭으로 선택
- `황금 밸런스 팀 짜기` 버튼으로 최적 팀 배정 계산
- 블루팀(A) / 레드팀(B) 포지션별 결과와 MMR 차이 표시

### ⚔️ 실전 결과 기록 - `/record`
- 각 팀 5개 포지션에 선수를 드롭다운으로 배치
- `A팀 승리` / `B팀 승리` 버튼으로 결과 입력
- 결과 반영 후 자동으로 TrueSkill 점수 갱신

### 🧪 가상 데이터 입력 - `/virtual`
- 실전 결과 기록과 동일한 UI이지만 `is_virtual: true` 플래그로 저장
- "이 두 팀이 붙으면 누가 이길까?" 시뮬레이션용
- **폼이 초기화되지 않아** 동일 조합으로 연속 입력 가능 → 빠른 초기 모델 보정

### 🛡️ 관리자 - `/admin`
- 전체 유저 목록과 승인 상태 확인
- 대기 중인 회원에게 승인 부여

---

## 🚀 실행 방법

### 1. Docker Compose로 전체 실행 (권장)

```bash
docker-compose up --build
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://localhost:5173 |
| 백엔드 API | http://localhost:8000 |
| API 문서 (Swagger) | http://localhost:8000/docs |

### 2. 로컬 직접 실행

**백엔드:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**프론트엔드:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🗄️ 데이터베이스 스키마

### `users` 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer PK | 고유 ID |
| username | String | 아이디 (유일) |
| hashed_password | String | bcrypt 해시 |
| is_admin | Boolean | 관리자 여부 |
| is_approved | Boolean | 승인 여부 |

### `players` 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer PK | 고유 ID |
| name | String | 닉네임 (유일) |
| top/jungle/mid/adc/support _mu | Float | 포지션별 TrueSkill μ (기본 25.0) |
| top/jungle/mid/adc/support _sigma | Float | 포지션별 TrueSkill σ (기본 8.333) |
| impossible_positions | String | JSON 배열 e.g. `["top","jungle"]` |

### `matches` 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | Integer PK | 고유 ID |
| created_at | DateTime | 기록 시각 |
| is_virtual | Boolean | 가상 데이터 여부 |
| winner_team | String | "A" 또는 "B" |
| team_a/b_포지션_id | Integer FK | 각 포지션 선수 ID |

---

## 📝 사용 가이드 (처음 시작할 때)

1. **서버 실행** → 브라우저로 `http://localhost:5173` 접속
2. **첫 번째 회원가입** → 자동으로 관리자 계정이 됨
3. **선수 등록** → 멤버들의 닉네임과 불가능 포지션 입력
4. **가상 데이터 입력** (선택) → 알고 있는 실력 관계를 시뮬레이션하여 초기 점수 보정
5. **팀 짜기** → 내전 당일 참가자 10명 선택 후 자동 배정
6. **결과 기록** → 경기 종료 후 승리 팀 클릭 → 랭킹 자동 갱신

---

## ⚠️ 주의 사항

- SQLite DB 파일(`loltc_data.db`)은 `backend/` 폴더 내에 자동 생성됩니다
- `auth.py`의 `SECRET_KEY`는 로컬 전용 키입니다. 외부 공개 시 반드시 변경하세요
- 팀 짜기 알고리즘은 완전 탐색 방식으로 선수 수가 많아도 10명 고정이라 수 초 내에 완료됩니다
