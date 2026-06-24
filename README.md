# POSUNG LOL MATCHMAKER

League of Legends 내전 참가자를 관리하고, 포지션별 TrueSkill MMR을 기반으로 균형 잡힌 5 대 5 팀을 찾고, 실전/가상 경기 결과를 기록하는 웹 애플리케이션입니다.

## 주요 기능

- 회원가입, 로그인, 관리자 승인 및 관리자 권한 관리
- 선수 등록과 포지션별 선호/비선호/불가 설정
- 포지션별 MMR 랭킹 조회
- 10명 선택 후 MMR 차이가 작은 팀 조합 탐색
- 특정 팀/포지션에 선수를 고정한 상태의 팀 추천
- 실전 결과 기록 및 TrueSkill 점수 갱신
- 모든 사용자가 확인할 수 있는 실전 내전 결과 공개 조회
- 상세 실전 기록 모드의 밴, 픽, 피어리스 밴 저장
- 가상 매치 반복 입력을 통한 초기 MMR 보정
- 관리자용 사용자 수정, 매치 조회, JSON/CSV 데이터 내보내기

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | React 18, React Router, Axios, Vite 5 |
| 백엔드 | FastAPI, Pydantic, SQLAlchemy |
| 인증 | JWT (`python-jose`), bcrypt (`passlib`) |
| 매칭/평점 | TrueSkill |
| 데이터베이스 | SQLite |
| 실행 환경 | Docker, Docker Compose |

## 동작 흐름

1. 사용자가 회원가입 후 로그인합니다. 데이터 변경 기능은 승인된 사용자 또는 관리자에게 허용됩니다.
2. 선수를 등록하면서 5개 포지션의 선호 상태와 필요 시 초기 MMR 복사 대상을 설정합니다.
3. 팀 짜기 화면에서 10명을 선택하면 백엔드가 가능한 팀/포지션 배치를 탐색하고 MMR 차이가 작은 후보를 반환합니다.
4. 실전 또는 가상 경기 결과를 기록하면 각 선수가 맡은 포지션의 `mu`, `sigma` 값이 TrueSkill 결과로 갱신됩니다.
5. 관리자는 사용자 정보와 축적된 경기 기록을 확인하거나 내보낼 수 있습니다.

## MMR 및 매칭 규칙

- 각 선수는 `top`, `jungle`, `mid`, `adc`, `support`마다 별도의 TrueSkill 평점을 가집니다.
- 기본 평점은 `mu=50.0`, `sigma=16.666`이며, 랭킹과 팀 합산 점수에는 `mu`가 표시됩니다.
- 랭킹 평균 MMR은 불가 포지션을 제외한 포지션 점수 평균입니다.
- 팀 추천은 불가 포지션과 사용자가 고정한 슬롯을 만족하는 배치만 평가합니다.
- 백엔드는 각 팀 분할마다 가장 MMR 차이가 작은 포지션 배치를 보관하고 상위 후보를 반환합니다.
- 가상 데이터 화면의 랜덤 배치는 선호 포지션에 가중치 `2.0`, 비선호에 `0.7`, 불가에 `0`을 주며 팀 평균 차이 1점 이내인 조합을 탐색합니다.

## 권한과 화면

| 경로 | 화면 | 접근/역할 |
| --- | --- | --- |
| `/` | 전체 랭킹 | 공개 조회 |
| `/results` | 실전 내전 결과 | 공개 조회 |
| `/guide` | 이용 가이드 | 공개 조회 |
| `/login` | 로그인/회원가입 | 공개 |
| `/players` | 선수 추가 및 본인 선호도 수정 | 메뉴는 로그인 후 노출, 생성/수정 API는 승인 사용자 필요 |
| `/teambuilder` | 10인 팀 구성 | 메뉴는 로그인 후 노출, 조회/추천 API는 현재 공개 |
| `/record` | 실전 결과 기록 | 메뉴는 로그인 후 노출, 기록 API는 승인 사용자 필요 |
| `/virtual` | 가상 데이터 입력 | 모바일 지원, 메뉴는 로그인 후 노출, 기록 API는 승인 사용자 필요 |
| `/admin` | 가입 승인/관리자 역할 변경 | 관리자 전용 |
| `/datamanage` | 사용자 정보 및 매치 기록 관리 | 관리자 전용 |

`/players`, `/teambuilder`, `/record` 및 관리자 화면은 모바일 폭에서 PC 전용 안내를 표시합니다. `/virtual`은 모바일에서도 사용할 수 있으며, 두 팀 구성과 승리 기록 버튼이 한 화면 상단에 함께 표시됩니다.

## 디렉터리 구조

```text
posung-lol-matchmaker/
├── backend/                         # FastAPI API, 모델, SQLite 데이터와 관리 스크립트
├── frontend/                        # React/Vite 클라이언트
├── .gitignore                       # Git 제외 규칙
├── docker-compose.yml               # 백엔드/프론트엔드 컨테이너 구성
├── update_mock_partitions.py        # 기존 선수의 포지션 선호 데이터를 임의 분할하는 유틸리티
└── README.md                        # 프로젝트 설명 문서
```

## 루트 파일

| 파일 | 역할 |
| --- | --- |
| `.gitignore` | Python 캐시, 가상환경, SQLite DB, Node 빌드 산출물, IDE 파일 등을 Git 대상에서 제외합니다. |
| `docker-compose.yml` | `backend:8000`, `frontend:5173` 서비스를 빌드하고 소스 볼륨과 Vite 프록시용 환경 변수를 설정합니다. 주석 처리된 ngrok 예시 설정도 포함되어 있습니다. |
| `update_mock_partitions.py` | `backend/loltc_data.db`의 모든 선수에게 임의의 선호/비선호/불가 포지션 JSON 값을 채우는 일회성 데이터 보정 스크립트입니다. |
| `README.md` | 프로젝트 개요, 실행 방법, 구조와 파일 역할을 설명하는 현재 문서입니다. |

## 백엔드 파일

| 파일 | 역할 |
| --- | --- |
| `backend/main.py` | FastAPI 애플리케이션 진입점입니다. 시작 시 SQLite 컬럼 보정과 기본 관리자 초기화를 수행하고, 인증/선수/매칭/경기 기록/관리자 내보내기 API를 제공합니다. |
| `backend/database.py` | SQLAlchemy 엔진과 세션을 생성하고 `User`, `Player`, `Match` 테이블 모델 및 DB 의존성 `get_db()`를 정의합니다. |
| `backend/auth.py` | 비밀번호 해시, 7일 유효 JWT 생성/해석, 현재 사용자/승인 사용자/관리자 검증 의존성을 제공합니다. |
| `backend/model.py` | TrueSkill 환경을 설정하고 경기 후 평점 갱신 및 10인 팀 배치 완전 탐색 로직을 구현합니다. |
| `backend/requirements.txt` | FastAPI, SQLAlchemy, 인증, TrueSkill 등 Python 실행 의존성 목록입니다. |
| `backend/Dockerfile` | Python 3.11 이미지에 의존성과 소스를 설치하고 `uvicorn main:app --reload`로 API를 실행합니다. |
| `backend/reset_data.py` | SQLite에서 `matches`와 `players` 데이터만 삭제하고 `users`는 유지하는 초기화 스크립트입니다. |
| `backend/db_manager.py` | 터미널에서 선수/사용자/최근 매치를 조회하고 선수 편집/삭제/생성, 사용자 권한과 승인 상태를 변경하는 관리 CLI입니다. |
| `backend/delete_all_players.py` | SQLAlchemy를 이용해 전체 선수 데이터를 삭제하는 단일 목적 관리 스크립트입니다. |
| `backend/loltc_data.db` | 실행 데이터가 저장되는 SQLite DB 파일입니다. Git 무시 대상이며 사용자, 선수, 매치 기록을 보관합니다. |

### 주요 API

| 메서드/경로 | 역할 |
| --- | --- |
| `POST /api/auth/register` | 회원가입 신청 |
| `POST /api/auth/login` | JWT 발급 |
| `GET /api/auth/me` | 로그인 사용자 정보 조회 |
| `GET /api/auth/users` | 관리자용 사용자 목록 |
| `POST /api/auth/approve/{user_id}` | 사용자 승인 |
| `POST /api/auth/toggle-admin/{user_id}` | 관리자 역할 전환 |
| `POST /api/admin/users/{user_id}/update` | 사용자 표시명/롤 ID 수정 |
| `GET /api/admin/matches` | 필터/페이지 기반 매치 목록 조회 |
| `GET /api/admin/export` | 사용자, 선수, 매치 데이터를 JSON 형태로 조회 |
| `GET /api/admin/export/matches/csv` | 실전 매치 CSV 다운로드 |
| `GET /api/players` | 선수 및 포지션별 MMR 공개 조회 |
| `POST /api/players` | 선수 생성 |
| `PUT /api/players/{player_id}/preferences` | 본인 선수의 선호/비선호 포지션 수정 |
| `POST /api/matchmake` | 선택된 10명의 추천 팀 구성 계산 (현재 인증 없이 호출 가능) |
| `GET /api/matches/recent-real-participants` | 최근 2시간 내 최신 실전 매치 참가자 10명 조회 |
| `GET /api/matches/public-results` | 기록자 정보 없이 실전 매치 결과 공개 조회 |
| `POST /api/matches` | 실전/가상 결과 저장 및 MMR 갱신 |

### 데이터 모델

| 테이블 | 핵심 데이터 |
| --- | --- |
| `users` | 로그인 ID, 암호화 비밀번호, 표시명, 롤 ID, 관리자/승인 여부 |
| `players` | 선수명, 5개 포지션의 `mu`/`sigma`, 선호/비선호/불가 포지션 JSON |
| `matches` | 생성 시각, 실전/가상 여부, 승리 팀, 기록자, 양 팀 포지션별 선수 ID, 상세 밴픽 JSON |

`matches.created_at`은 한국 표준시(KST, UTC+09:00) 기준으로 저장됩니다. 기존 UTC 기록은 시작 마이그레이션에서 한 번만 KST로 변환됩니다.

## 프론트엔드 설정 파일

| 파일 | 역할 |
| --- | --- |
| `frontend/package.json` | React 애플리케이션 의존성과 `dev`, `build`, `preview` npm 스크립트를 정의합니다. |
| `frontend/package-lock.json` | npm 의존성 버전을 고정하여 동일한 설치 결과를 재현합니다. |
| `frontend/vite.config.js` | React 플러그인과 개발 서버를 구성하고 `/api` 요청을 로컬 또는 Docker 백엔드로 프록시합니다. |
| `frontend/index.html` | React 루트 엘리먼트와 웹 폰트를 포함하는 HTML 진입 문서입니다. |
| `frontend/Dockerfile` | Node 20 환경에서 패키지를 설치하고 Vite 개발 서버를 외부 접속 가능하게 실행합니다. |

## 프론트엔드 소스 파일

| 파일 | 역할 |
| --- | --- |
| `frontend/src/main.jsx` | React 앱을 DOM에 마운트하고 `BrowserRouter`와 전역 CSS를 연결합니다. |
| `frontend/src/App.jsx` | 전체 라우팅, 좌측/모바일 내비게이션, 토큰 상태, 현재 사용자 조회, 로그아웃, 모바일 PC 전용 가드를 관리합니다. |
| `frontend/src/index.css` | 다크 테마, 공통 카드/버튼/테이블, 사이드바와 모바일 헤더/하단 탭 스타일을 정의합니다. |
| `frontend/src/data/champions.js` | 상세 실전 기록의 밴픽 선택기에 사용하는 한국어 챔피언 이름 목록입니다. |

## 페이지 컴포넌트

| 파일 | 역할 |
| --- | --- |
| `frontend/src/pages/Leaderboard.jsx` | 공개 랭킹 화면입니다. 불가 포지션을 제외한 평균 MMR과 포지션별 점수를 정렬 가능한 표로 표시합니다. |
| `frontend/src/pages/MatchResults.jsx` | 공개 실전 결과 화면입니다. 최신순으로 블루/레드 포지션별 참가자와 승리 팀을 표시합니다. |
| `frontend/src/pages/Guide.jsx` | 일반 사용자를 위한 화면별 기능과 TrueSkill 동작 안내를 카드 형태로 표시합니다. |
| `frontend/src/pages/Login.jsx` | 로그인과 회원가입 폼을 전환하며 JWT를 `localStorage`에 저장합니다. |
| `frontend/src/pages/PlayerManagement.jsx` | 선수 등록, 포지션 선호 상태 설정, 포지션별 초기 점수 복사, 본인 선수 선호도 수정을 담당합니다. |
| `frontend/src/pages/TeamBuilder.jsx` | 10인 선택, 포지션 고정, 추천 팀 조회, MMR/선호 기준 정렬과 실전 기록 화면으로의 라인업 전달을 담당합니다. |
| `frontend/src/pages/RecordMatch.jsx` | 실전 라인업 배정과 승패 기록을 담당합니다. 간단/상세 모드, 밴픽 및 피어리스 밴 입력, 반영된 MMR 변화 표시를 지원합니다. |
| `frontend/src/pages/VirtualDataEntry.jsx` | 현재 사용자를 제외한 선수로 가상 팀을 만들고, 선호 가중치 기반 랜덤 배치와 가상 결과 반복 기록을 수행합니다. |
| `frontend/src/pages/Admin.jsx` | 관리자용 회원 승인 및 관리자/멤버 역할 변경 화면입니다. |
| `frontend/src/pages/DataManagement.jsx` | 관리자용 사용자 정보 수정과 실전/가상 매치 필터링, 페이지 조회 화면입니다. |
| `frontend/src/pages/DBViewer.jsx` | 전체 DB 내보내기 응답을 유저/선수/매치 탭으로 표시하는 관리자 조회 컴포넌트입니다. 현재 `App.jsx` 라우트에는 연결되지 않았습니다. |

## 실행 방법

### Docker Compose

```bash
docker compose up --build
```

| 서비스 | 주소 |
| --- | --- |
| 프론트엔드 | <http://localhost:5173> |
| 백엔드 API | <http://localhost:8000> |
| Swagger 문서 | <http://localhost:8000/docs> |

### 로컬 실행

백엔드:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

프론트엔드:

```bash
cd frontend
npm install
npm run dev
```

### AWS Lightsail 상시 실행 systemd 배포

Docker 없이 Ubuntu 서버에 직접 배포하려면 아래 스크립트를 사용합니다.

```bash
sudo bash deploy/install-lightsail-systemd.sh
```

이 스크립트는 다음을 자동으로 설정합니다.

- Python 가상환경 생성 및 백엔드 의존성 설치
- React 프론트엔드 `npm run build`
- Nginx로 프론트엔드 정적 파일 서빙
- `/api/*` 요청을 FastAPI 백엔드로 프록시
- `posung-lol-backend` systemd 서비스 등록
- 서버 재부팅 후 자동 실행 및 실패 시 자동 재시작

서비스 확인:

```bash
sudo systemctl status posung-lol-backend --no-pager --full
sudo journalctl -u posung-lol-backend -f
```

## 운영 시 확인 사항

- `backend/loltc_data.db`는 로컬 SQLite 실행 데이터이며 백업 없이 삭제하면 기록이 사라집니다.
- `backend/main.py`는 시작 시 기본 관리자 계정을 시드하고, `backend/auth.py`는 소스에 JWT 비밀 키를 포함합니다. 공개 배포 전에는 환경 변수 기반 비밀 관리와 초기 관리자 생성 절차로 변경해야 합니다.
- `backend/db_manager.py`, `backend/delete_all_players.py`, `backend/reset_data.py`, `update_mock_partitions.py`는 데이터를 변경하는 운영/보정 도구이므로 실행 전에 DB 백업이 필요합니다.
- 팀 추천 알고리즘은 10명의 포지션 순열을 폭넓게 탐색하므로 참가 인원을 10명으로 고정한 현재 UI/요청 흐름을 전제로 합니다.
