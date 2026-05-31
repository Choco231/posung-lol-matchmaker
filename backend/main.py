from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect as sa_inspect, text
from fastapi.security import OAuth2PasswordRequestForm
from typing import List, Optional
from pydantic import BaseModel
from datetime import timedelta
import json
import trueskill
import csv
import random
import shutil
from io import BytesIO, StringIO
from pathlib import Path

from database import get_db, engine, SessionLocal, User, Player, Match, now_kst
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_approved_user, get_admin_user
)
from model import SETTLED_SIGMA, update_ratings, find_best_matchups

app = FastAPI(title="LoL Tournament API")

VIRTUAL_DAILY_LIMIT = 50
COUPON_P_MIN = 0.001016354020111
COUPON_AMPLITUDE = 0.006511588765629
COUPON_LATE_PROBABILITY = 0.010163540201109
COUPON_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
COUPON_RANDOM = random.SystemRandom()
COUPON_DIRECTORIES = (
    Path("/coupon"),
    Path(__file__).resolve().parent.parent / "frontend" / "coupon",
)

def virtual_coupon_probability(attempt_number: int) -> float:
    if attempt_number >= 31:
        return COUPON_LATE_PROBABILITY
    shape = ((attempt_number - 1) / 29) ** 2
    return COUPON_P_MIN + COUPON_AMPLITUDE * shape

def get_coupon_directory() -> Optional[Path]:
    for directory in COUPON_DIRECTORIES:
        if directory.exists() and directory.is_dir():
            return directory
    return None

def get_available_coupon_filenames(db: Session) -> List[str]:
    directory = get_coupon_directory()
    if not directory:
        return []
    awarded = {
        Path(filename).name for (filename,) in db.query(Match.coupon_filename)
        .filter(Match.coupon_filename.isnot(None)).all()
    }
    return sorted(
        path.name for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in COUPON_EXTENSIONS and path.name not in awarded
    )

def move_coupon_to_awarded_folder(filename: str) -> Optional[str]:
    directory = get_coupon_directory()
    if not directory:
        return None
    source = directory / Path(filename).name
    if not source.exists() or source.suffix.lower() not in COUPON_EXTENSIONS:
        return None
    awarded_dir = directory / "won"
    awarded_dir.mkdir(exist_ok=True)
    target = awarded_dir / source.name
    if not target.exists():
        shutil.move(str(source), str(target))
    return f"won/{source.name}"

def migrate_awarded_coupon_files(db: Session):
    matches = db.query(Match).filter(Match.coupon_filename.isnot(None)).all()
    changed = False
    for match in matches:
        if Path(match.coupon_filename).parent.name == "won":
            continue
        moved_filename = move_coupon_to_awarded_folder(match.coupon_filename)
        if moved_filename:
            match.coupon_filename = moved_filename
            changed = True
    if changed:
        db.commit()

def get_virtual_matches_for_user(db: Session, username: str):
    return db.query(Match).filter(
        Match.is_virtual == True,
        Match.recorded_by_name == username,
    )

def today_virtual_count(db: Session, username: str) -> int:
    start = now_kst().replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return get_virtual_matches_for_user(db, username).filter(
        Match.created_at >= start,
        Match.created_at < end,
    ).count()


# ── Startup: column migration + admin seed ─────────────────────────────────
@app.on_event("startup")
def startup():
    # 1) Add new columns to existing DB if they don't exist yet (SQLite migration)
    with engine.connect() as conn:
        cols = [c["name"] for c in sa_inspect(engine).get_columns("users")]
        if "display_name" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR"))
            conn.commit()
        if "lol_id" not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN lol_id VARCHAR"))
            conn.commit()
            
        player_cols = [c["name"] for c in sa_inspect(engine).get_columns("players")]
        if "preferred_positions" not in player_cols:
            conn.execute(text("ALTER TABLE players ADD COLUMN preferred_positions VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "non_preferred_positions" not in player_cols:
            conn.execute(text("ALTER TABLE players ADD COLUMN non_preferred_positions VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "is_guest" not in player_cols:
            conn.execute(text("ALTER TABLE players ADD COLUMN is_guest BOOLEAN DEFAULT 0"))
            conn.commit()

        # matches table migration
        match_cols = [c["name"] for c in sa_inspect(engine).get_columns("matches")]
        if "recorded_by_name" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN recorded_by_name VARCHAR"))
            conn.commit()

        # Ban/Pick columns migration
        if "record_mode" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN record_mode VARCHAR DEFAULT 'simple'"))
            conn.commit()
        if "team_a_bans" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN team_a_bans VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "team_b_bans" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN team_b_bans VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "fearless_bans" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN fearless_bans VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "team_a_picks" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN team_a_picks VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "team_b_picks" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN team_b_picks VARCHAR DEFAULT '[]'"))
            conn.commit()
        if "virtual_attempt_number" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN virtual_attempt_number INTEGER"))
            conn.commit()
        if "coupon_probability" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN coupon_probability FLOAT"))
            conn.commit()
        if "coupon_filename" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN coupon_filename VARCHAR"))
            conn.commit()

        # Existing match timestamps were stored as naive UTC values. Convert them to naive KST once.
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_metadata (
                key VARCHAR PRIMARY KEY,
                value VARCHAR NOT NULL
            )
        """))
        timezone_migration = conn.execute(text("""
            SELECT value FROM app_metadata WHERE key = 'matches_created_at_timezone'
        """)).scalar()
        if timezone_migration != "KST":
            conn.execute(text("UPDATE matches SET created_at = datetime(created_at, '+9 hours')"))
            conn.execute(text("""
                INSERT INTO app_metadata (key, value)
                VALUES ('matches_created_at_timezone', 'KST')
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """))
            conn.commit()

    # 2) Seed the master admin account + 20 test players
    db = SessionLocal()
    try:
        # Admin account
        if not db.query(User).filter(User.username == "dkswldnjs213").first():
            db.add(User(
                username="dkswldnjs213",
                hashed_password=get_password_hash("Rudql1theo@!#"),
                display_name="안지원",
                lol_id="초코타코#kr1",
                is_admin=True,
                is_approved=True,
            ))
            db.commit()



        # Database Migration: Auto Scale-down existing players from 1500 scale to 50 scale (100pt max Elo)
        players = db.query(Player).all()
        migrated = False
        for p in players:
            # If any position has mu > 150.0, it is considered 1500 scale. Divide all mu & sigma by 30
            if p.top_mu > 150.0:
                p.top_mu /= 30
                p.top_sigma /= 30
                p.jungle_mu /= 30
                p.jungle_sigma /= 30
                p.mid_mu /= 30
                p.mid_sigma /= 30
                p.adc_mu /= 30
                p.adc_sigma /= 30
                p.support_mu /= 30
                p.support_sigma /= 30
                migrated = True
        if migrated:
            db.commit()
            print("Successfully migrated all players' MMR scale from 1500.0 back to 50.0!")
        migrate_awarded_coupon_files(db)
    finally:
        db.close()


# --- Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str = ""
    lol_id: str = ""

class PlayerCreate(BaseModel):
    name: str
    is_guest: bool = False
    guest_mmrs: Optional[dict] = None
    impossible_positions: List[str] = []
    preferred_positions: List[str] = []
    non_preferred_positions: List[str] = []
    copy_top_id: Optional[int] = None
    copy_jungle_id: Optional[int] = None
    copy_mid_id: Optional[int] = None
    copy_adc_id: Optional[int] = None
    copy_support_id: Optional[int] = None

class PlayerResponse(BaseModel):
    id: int
    name: str
    is_guest: bool = False
    top_mu: float
    jungle_mu: float
    mid_mu: float
    adc_mu: float
    support_mu: float
    impossible_positions: str
    preferred_positions: str = "[]"
    non_preferred_positions: str = "[]"
    class Config:
        orm_mode = True

class MatchmakeRequest(BaseModel):
    player_ids: List[int]
    pinned_positions: dict = {}

class RecordMatchRequest(BaseModel):
    team_a_ids: List[int]  # [top, jgl, mid, adc, sup]
    team_b_ids: List[int]  # [top, jgl, mid, adc, sup]
    winner: str            # "A" or "B"
    is_virtual: bool = False
    record_mode: str = "simple"  # "simple" or "detailed"
    team_a_bans: List[dict] = []  # [{"order": 1, "champion": "아리"}, ...]
    team_b_bans: List[dict] = []  
    fearless_bans: List[str] = []  # ["가렌", "다리우스", ...]
    team_a_picks: List[dict] = []  # [{"order": 1, "champion": "아리", "position": "mid"}, ...]
    team_b_picks: List[dict] = []

class UserUpdateAdmin(BaseModel):
    display_name: str = ""
    lol_id: str = ""

class PlayerPreferencesUpdate(BaseModel):
    preferred_positions: List[str]
    non_preferred_positions: List[str]

class GuestPlayerUpdate(BaseModel):
    name: str
    lol_id: str = ""
    mmrs: dict
    preferred_positions: List[str]
    non_preferred_positions: List[str]
    impossible_positions: List[str]

ALL_POSITIONS = {"top", "jungle", "mid", "adc", "support"}

def validate_position_preferences(preferred_positions, non_preferred_positions, impossible_positions):
    preferred = set(preferred_positions)
    non_preferred = set(non_preferred_positions)
    impossible = set(impossible_positions)
    if preferred & non_preferred or preferred & impossible or non_preferred & impossible:
        raise HTTPException(status_code=400, detail="Position preference groups must not overlap")
    if preferred | non_preferred | impossible != ALL_POSITIONS:
        raise HTTPException(status_code=400, detail="Every position must be assigned a preference state")
    if not preferred:
        raise HTTPException(status_code=400, detail="At least one preferred position is required")

def validate_guest_mmrs(mmrs):
    if not isinstance(mmrs, dict) or set(mmrs.keys()) != ALL_POSITIONS:
        raise HTTPException(status_code=400, detail="Guest MMR is required for every position")
    for position, mmr in mmrs.items():
        if not isinstance(mmr, (int, float)) or not 0 <= mmr <= 100:
            raise HTTPException(status_code=400, detail=f"Guest {position} MMR must be between 0 and 100")


# --- Auth Endpoints ---
@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")

    # First user (other than seeded admin) becomes admin if no admin exists yet
    has_admin = db.query(User).filter(User.is_admin == True).first()
    is_first   = not has_admin

    new_user = User(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        display_name=user.display_name or None,
        lol_id=user.lol_id or None,
        is_admin=is_first,
        is_approved=is_first,
    )
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully. Wait for admin approval."}

@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "lol_id": current_user.lol_id,
        "is_admin": current_user.is_admin,
        "is_approved": current_user.is_approved,
    }

@app.get("/api/auth/users")
def get_users(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "lol_id": u.lol_id,
            "is_admin": u.is_admin,
            "is_approved": u.is_approved,
        }
        for u in users
    ]

@app.post("/api/auth/approve/{user_id}")
def approve_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_approved = True
    db.commit()
    return {"message": "User approved"}

@app.post("/api/auth/toggle-admin/{user_id}")
def toggle_admin(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자신의 역할은 변경할 수 없습니다.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "dkswldnjs213":
        raise HTTPException(status_code=400, detail="절대자 권한을 가진 계정의 역할은 변경할 수 없습니다.")
    user.is_admin = not user.is_admin
    db.commit()
    return {"is_admin": user.is_admin}

@app.post("/api/admin/users/{user_id}/update")
def update_user_by_admin(user_id: int, req: UserUpdateAdmin, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.display_name = req.display_name or None
    user.lol_id = req.lol_id or None
    db.commit()
    return {"message": "User info updated successfully"}

@app.get("/api/admin/matches")
def get_admin_matches(page: int = 1, limit: int = 20, is_virtual: Optional[bool] = None, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    page = max(1, page)
    limit = min(max(1, limit), 100)
    offset = (page - 1) * limit
    query = db.query(Match)
    if is_virtual is not None:
        query = query.filter(Match.is_virtual == is_virtual)
    total = query.count()
    matches = query.order_by(Match.id.desc()).offset(offset).limit(limit).all()
    players = db.query(Player).all()
    pid_to_name = {p.id: p.name for p in players}

    formatted_matches = [
        {
            "id": m.id,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else None,
            "is_virtual": m.is_virtual,
            "winner": m.winner_team,
            "recorded_by": m.recorded_by_name or "알 수 없음",
            "team_a": {
                "top": pid_to_name.get(m.team_a_top_id, "?"),
                "jungle": pid_to_name.get(m.team_a_jungle_id, "?"),
                "mid": pid_to_name.get(m.team_a_mid_id, "?"),
                "adc": pid_to_name.get(m.team_a_adc_id, "?"),
                "support": pid_to_name.get(m.team_a_support_id, "?"),
            },
            "team_b": {
                "top": pid_to_name.get(m.team_b_top_id, "?"),
                "jungle": pid_to_name.get(m.team_b_jungle_id, "?"),
                "mid": pid_to_name.get(m.team_b_mid_id, "?"),
                "adc": pid_to_name.get(m.team_b_adc_id, "?"),
                "support": pid_to_name.get(m.team_b_support_id, "?"),
            },
            "record_mode": m.record_mode or "simple",
            "team_a_bans": json.loads(m.team_a_bans) if m.team_a_bans else [],
            "team_b_bans": json.loads(m.team_b_bans) if m.team_b_bans else [],
            "fearless_bans": json.loads(m.fearless_bans) if m.fearless_bans else [],
            "team_a_picks": json.loads(m.team_a_picks) if m.team_a_picks else [],
            "team_b_picks": json.loads(m.team_b_picks) if m.team_b_picks else [],
        }
        for m in matches
    ]
    return {"matches": formatted_matches, "total": total, "page": page, "limit": limit}

@app.get("/api/admin/export/matches/csv")
def export_matches_csv(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # 실전 매치만 쿼리 (is_virtual == False)
    matches = db.query(Match).filter(Match.is_virtual == False).order_by(Match.id.asc()).all()
    players = db.query(Player).all()
    pid_to_name = {p.id: p.name for p in players}

    output = StringIO()
    output.write('\ufeff')  # Excel UTF-8 BOM 한글 안깨짐 방지
    
    writer = csv.writer(output)
    writer.writerow([
        "매치ID", "경기일시(KST)", "승리팀", "기록자",
        "블루_탑", "블루_정글", "블루_미드", "블루_원딜", "블루_서폿",
        "레드_탑", "레드_정글", "레드_미드", "레드_원딜", "레드_서폿"
    ])
    
    for m in matches:
        writer.writerow([
            m.id,
            m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else "",
            "BLUE" if m.winner_team == "A" else "RED",
            m.recorded_by_name or "알 수 없음",
            pid_to_name.get(m.team_a_top_id, "?"),
            pid_to_name.get(m.team_a_jungle_id, "?"),
            pid_to_name.get(m.team_a_mid_id, "?"),
            pid_to_name.get(m.team_a_adc_id, "?"),
            pid_to_name.get(m.team_a_support_id, "?"),
            pid_to_name.get(m.team_b_top_id, "?"),
            pid_to_name.get(m.team_b_jungle_id, "?"),
            pid_to_name.get(m.team_b_mid_id, "?"),
            pid_to_name.get(m.team_b_adc_id, "?"),
            pid_to_name.get(m.team_b_support_id, "?"),
        ])
        
    csv_data = output.getvalue().encode('utf-8')
    return StreamingResponse(
        BytesIO(csv_data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=real_matches_export.csv"}
    )

# --- Admin DB Export (admin only) ---
@app.get("/api/admin/export")
def export_db(include_matches: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    users   = db.query(User).all()
    players = db.query(Player).all()
    matches = db.query(Match).all() if include_matches else []

    # Build player name lookup
    pid_to_name = {p.id: p.name for p in players}

    return {
        "users": [
            {
                "id": u.id, "username": u.username,
                "display_name": u.display_name, "lol_id": u.lol_id,
                "is_admin": u.is_admin, "is_approved": u.is_approved,
            }
            for u in users
        ],
        "players": [
            {
                "id": p.id, "name": p.name, "is_guest": p.is_guest,
                "top_mu": round(p.top_mu, 2), "top_sigma": round(p.top_sigma, 3),
                "jungle_mu": round(p.jungle_mu, 2), "jungle_sigma": round(p.jungle_sigma, 3),
                "mid_mu": round(p.mid_mu, 2), "mid_sigma": round(p.mid_sigma, 3),
                "adc_mu": round(p.adc_mu, 2), "adc_sigma": round(p.adc_sigma, 3),
                "support_mu": round(p.support_mu, 2), "support_sigma": round(p.support_sigma, 3),
                "impossible_positions": json.loads(p.impossible_positions or "[]"),
            }
            for p in players
        ],
        "matches": [
            {
                "id": m.id,
                "created_at": m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else None,
                "is_virtual": m.is_virtual,
                "winner": m.winner_team,
                "recorded_by": m.recorded_by_name or "알 수 없음",
                "team_a": {
                    "top": pid_to_name.get(m.team_a_top_id, "?"),
                    "jungle": pid_to_name.get(m.team_a_jungle_id, "?"),
                    "mid": pid_to_name.get(m.team_a_mid_id, "?"),
                    "adc": pid_to_name.get(m.team_a_adc_id, "?"),
                    "support": pid_to_name.get(m.team_a_support_id, "?"),
                },
                "team_b": {
                    "top": pid_to_name.get(m.team_b_top_id, "?"),
                    "jungle": pid_to_name.get(m.team_b_jungle_id, "?"),
                    "mid": pid_to_name.get(m.team_b_mid_id, "?"),
                    "adc": pid_to_name.get(m.team_b_adc_id, "?"),
                    "support": pid_to_name.get(m.team_b_support_id, "?"),
                },
            }
            for m in matches
        ],
        "matches_omitted": not include_matches,
    }


# --- Player Endpoints ---
@app.get("/api/players", response_model=List[PlayerResponse])
def get_players(db: Session = Depends(get_db)):
    return db.query(Player).all()

@app.post("/api/players")
def create_player(player: PlayerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_approved_user)):
    if db.query(Player).filter(Player.name == player.name).first():
        raise HTTPException(status_code=400, detail="Player already exists")

    validate_position_preferences(player.preferred_positions, player.non_preferred_positions, player.impossible_positions)
    if player.is_guest:
        validate_guest_mmrs(player.guest_mmrs)

    new_player = Player(
        name=player.name,
        is_guest=player.is_guest,
        impossible_positions=json.dumps(player.impossible_positions),
        preferred_positions=json.dumps(player.preferred_positions),
        non_preferred_positions=json.dumps(player.non_preferred_positions)
    )

    if player.is_guest:
        for position in ALL_POSITIONS:
            setattr(new_player, f"{position}_mu", player.guest_mmrs[position])
            setattr(new_player, f"{position}_sigma", SETTLED_SIGMA)
    elif player.copy_top_id:
        p = db.query(Player).filter(Player.id == player.copy_top_id).first()
        if p: new_player.top_mu = p.top_mu
    if not player.is_guest and player.copy_jungle_id:
        p = db.query(Player).filter(Player.id == player.copy_jungle_id).first()
        if p: new_player.jungle_mu = p.jungle_mu
    if not player.is_guest and player.copy_mid_id:
        p = db.query(Player).filter(Player.id == player.copy_mid_id).first()
        if p: new_player.mid_mu = p.mid_mu
    if not player.is_guest and player.copy_adc_id:
        p = db.query(Player).filter(Player.id == player.copy_adc_id).first()
        if p: new_player.adc_mu = p.adc_mu
    if not player.is_guest and player.copy_support_id:
        p = db.query(Player).filter(Player.id == player.copy_support_id).first()
        if p: new_player.support_mu = p.support_mu

    db.add(new_player)
    db.commit()
    return {"message": "Player created"}

@app.put("/api/players/{player_id}/guest")
def update_guest_player(player_id: int, req: GuestPlayerUpdate, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if not player.is_guest:
        raise HTTPException(status_code=403, detail="Only guest players can be publicly edited")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Guest player name is required")
    validate_position_preferences(req.preferred_positions, req.non_preferred_positions, req.impossible_positions)
    validate_guest_mmrs(req.mmrs)
    full_name = f"{req.name.strip()} / {req.lol_id.strip()}" if req.lol_id.strip() else req.name.strip()
    duplicate = db.query(Player).filter(Player.name == full_name, Player.id != player.id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Player already exists")

    player.name = full_name
    player.preferred_positions = json.dumps(req.preferred_positions)
    player.non_preferred_positions = json.dumps(req.non_preferred_positions)
    player.impossible_positions = json.dumps(req.impossible_positions)
    for position in ALL_POSITIONS:
        setattr(player, f"{position}_mu", req.mmrs[position])
        setattr(player, f"{position}_sigma", SETTLED_SIGMA)

    db.commit()
    return {"message": "Guest player updated"}

@app.put("/api/players/{player_id}/preferences")
def update_player_preferences(player_id: int, req: PlayerPreferencesUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_approved_user)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="선수를 찾을 수 없습니다.")

    # 본인 여부 확인: Player.name을 " / "로 쪼개서 뒤쪽 파트가 current_user.lol_id와 일치하는지 검증 (공백 제거, 대소문자 무시)
    name_parts = player.name.split(" / ")
    player_lol_id = name_parts[1] if len(name_parts) > 1 else None

    def normalize_lol_id(val: Optional[str]) -> str:
        if not val:
            return ""
        return "".join(val.split()).lower()

    norm_player_lol_id = normalize_lol_id(player_lol_id)
    norm_user_lol_id = normalize_lol_id(current_user.lol_id)

    if not norm_user_lol_id or not norm_player_lol_id or norm_player_lol_id != norm_user_lol_id:
        raise HTTPException(status_code=403, detail="본인의 선수 정보만 수정할 수 있습니다.")

    # 불가(impossible) 포지션은 수정 불가능하게 유지
    existing_impossible = set(json.loads(player.impossible_positions or "[]"))
    new_preferred = set(req.preferred_positions)
    new_non_preferred = set(req.non_preferred_positions)

    # 불가 포지션이 새로 설정하려는 선호/비선호에 겹쳐 들어오는지 확인
    if existing_impossible.intersection(new_preferred) or existing_impossible.intersection(new_non_preferred):
        raise HTTPException(status_code=400, detail="불가(impossible)로 설정된 포지션은 선호/비선호로 변경할 수 없습니다.")

    # 불가 포지션을 제외한 모든 포지션이 정확히 preferred 혹은 non_preferred 중 하나여야 함
    all_positions = {"top", "jungle", "mid", "adc", "support"}
    allowed_positions = all_positions - existing_impossible

    if (new_preferred | new_non_preferred) != allowed_positions:
        raise HTTPException(status_code=400, detail="선호/비선호 포지션 설정이 올바르지 않습니다.")

    # 선호 포지션은 최소 1개 있어야 함
    if len(req.preferred_positions) == 0:
        raise HTTPException(status_code=400, detail="최소 한 개의 포지션은 선호(🥰)로 설정해야 합니다.")

    player.preferred_positions = json.dumps(req.preferred_positions)
    player.non_preferred_positions = json.dumps(req.non_preferred_positions)
    db.commit()

    return {"message": "선호 포지션이 수정되었습니다."}


# --- Match Endpoints ---
@app.post("/api/matchmake")
def matchmake(req: MatchmakeRequest, db: Session = Depends(get_db)):
    if len(req.player_ids) != 10:
        raise HTTPException(status_code=400, detail="Exactly 10 players required")

    players = db.query(Player).filter(Player.id.in_(req.player_ids)).all()
    if len(players) != 10:
        raise HTTPException(status_code=404, detail="Some players not found")

    matchups = find_best_matchups(players, pinned_positions=req.pinned_positions, top_n=100)
    if not matchups:
        raise HTTPException(status_code=400, detail="Could not find a valid matchup with given impossible positions")

    return {"matchups": matchups, "total": len(matchups)}

@app.get("/api/matches/public-results")
def get_public_real_match_results(page: int = 1, limit: int = 20, db: Session = Depends(get_db)):
    page = max(page, 1)
    limit = min(max(limit, 1), 50)
    offset = (page - 1) * limit

    query = db.query(Match).filter(Match.is_virtual == False)
    total = query.count()
    matches = query.order_by(Match.created_at.desc(), Match.id.desc()).offset(offset).limit(limit).all()
    players = db.query(Player).all()
    pid_to_name = {p.id: p.name for p in players}

    return {
        "matches": [
            {
                "id": match.id,
                "created_at": match.created_at.strftime("%Y-%m-%d %H:%M") if match.created_at else None,
                "winner": match.winner_team,
                "team_a": {
                    "top": pid_to_name.get(match.team_a_top_id, "?"),
                    "jungle": pid_to_name.get(match.team_a_jungle_id, "?"),
                    "mid": pid_to_name.get(match.team_a_mid_id, "?"),
                    "adc": pid_to_name.get(match.team_a_adc_id, "?"),
                    "support": pid_to_name.get(match.team_a_support_id, "?"),
                },
                "team_b": {
                    "top": pid_to_name.get(match.team_b_top_id, "?"),
                    "jungle": pid_to_name.get(match.team_b_jungle_id, "?"),
                    "mid": pid_to_name.get(match.team_b_mid_id, "?"),
                    "adc": pid_to_name.get(match.team_b_adc_id, "?"),
                    "support": pid_to_name.get(match.team_b_support_id, "?"),
                },
            }
            for match in matches
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }

@app.get("/api/matches/recent-real-participants")
def get_recent_real_match_participants(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cutoff = now_kst() - timedelta(hours=2)
    match = (
        db.query(Match)
        .filter(Match.is_virtual == False, Match.created_at >= cutoff)
        .order_by(Match.created_at.desc(), Match.id.desc())
        .first()
    )

    if not match:
        return {"player_ids": [], "created_at": None}

    return {
        "player_ids": [
            match.team_a_top_id,
            match.team_a_jungle_id,
            match.team_a_mid_id,
            match.team_a_adc_id,
            match.team_a_support_id,
            match.team_b_top_id,
            match.team_b_jungle_id,
            match.team_b_mid_id,
            match.team_b_adc_id,
            match.team_b_support_id,
        ],
        "created_at": match.created_at.isoformat() if match.created_at else None,
    }

@app.get("/api/virtual/stats")
def get_my_virtual_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    matches = (
        get_virtual_matches_for_user(db, current_user.username)
        .order_by(Match.created_at.desc(), Match.id.desc())
        .all()
    )
    daily_counts = {}
    awards = []
    for match in matches:
        date_key = match.created_at.strftime("%Y-%m-%d") if match.created_at else "unknown"
        daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
        if match.coupon_filename:
            awards.append({
                "match_id": match.id,
                "created_at": match.created_at.strftime("%Y-%m-%d %H:%M") if match.created_at else None,
                "attempt_number": match.virtual_attempt_number,
                "coupon_url": f"/api/virtual/coupons/{match.id}",
            })

    today_key = now_kst().strftime("%Y-%m-%d")
    today_count = daily_counts.get(today_key, 0)
    return {
        "today": today_key,
        "today_count": today_count,
        "daily_limit": VIRTUAL_DAILY_LIMIT,
        "remaining_today": max(VIRTUAL_DAILY_LIMIT - today_count, 0),
        "total_count": len(matches),
        "daily_counts": [
            {"date": date, "count": count}
            for date, count in sorted(daily_counts.items(), reverse=True)
        ],
        "awards": awards,
    }

@app.get("/api/virtual/coupons/{match_id}")
def get_my_coupon_image(match_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    match = db.query(Match).filter(
        Match.id == match_id,
        Match.is_virtual == True,
        Match.recorded_by_name == current_user.username,
    ).first()
    if not match or not match.coupon_filename:
        raise HTTPException(status_code=404, detail="Coupon not found")

    directory = get_coupon_directory()
    if not directory:
        raise HTTPException(status_code=404, detail="Coupon image storage not available")
    coupon_relative_path = Path(match.coupon_filename)
    if coupon_relative_path.is_absolute() or ".." in coupon_relative_path.parts:
        raise HTTPException(status_code=404, detail="Coupon image not found")
    image_path = directory / coupon_relative_path
    if not image_path.exists() or image_path.suffix.lower() not in COUPON_EXTENSIONS:
        raise HTTPException(status_code=404, detail="Coupon image not found")
    return FileResponse(
        image_path,
        media_type=f"image/{image_path.suffix.lower().lstrip('.')}",
        headers={"Cache-Control": "private, no-store"},
    )

@app.post("/api/matches")
def record_match(req: RecordMatchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_approved_user)):
    if req.is_virtual:
        raise HTTPException(status_code=410, detail="Virtual data entry has been disabled")

    last_same_type_match = (
        db.query(Match)
        .filter(Match.is_virtual == req.is_virtual)
        .order_by(Match.created_at.desc(), Match.id.desc())
        .first()
    )
    if last_same_type_match and last_same_type_match.created_at:
        same_blue_team = req.team_a_ids == [
            last_same_type_match.team_a_top_id,
            last_same_type_match.team_a_jungle_id,
            last_same_type_match.team_a_mid_id,
            last_same_type_match.team_a_adc_id,
            last_same_type_match.team_a_support_id,
        ]
        same_red_team = req.team_b_ids == [
            last_same_type_match.team_b_top_id,
            last_same_type_match.team_b_jungle_id,
            last_same_type_match.team_b_mid_id,
            last_same_type_match.team_b_adc_id,
            last_same_type_match.team_b_support_id,
        ]
        elapsed = now_kst() - last_same_type_match.created_at
        if same_blue_team and same_red_team and timedelta(0) <= elapsed <= timedelta(seconds=10):
            match_type_label = "가상 데이터" if req.is_virtual else "실전"
            raise HTTPException(
                status_code=409,
                detail=f"직전 {match_type_label} 기록과 같은 팀 구성이 10초 이내에 다시 제출되어 중복 기록을 막았습니다.",
            )

    virtual_attempt_number = None
    coupon_probability = None
    coupon_filename = None
    selected_coupon_filename = None
    if req.is_virtual:
        used_today = today_virtual_count(db, current_user.username)
        if used_today >= VIRTUAL_DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="오늘의 가상 데이터 입력 한도 50건을 모두 사용했습니다.")
        virtual_attempt_number = used_today + 1
        coupon_probability = virtual_coupon_probability(virtual_attempt_number)
        available_coupons = get_available_coupon_filenames(db)
        if available_coupons and COUPON_RANDOM.random() < coupon_probability:
            selected_coupon_filename = COUPON_RANDOM.choice(available_coupons)

    positions = ["top", "jungle", "mid", "adc", "support"]
    team_a_players = [db.query(Player).filter(Player.id == pid).first() for pid in req.team_a_ids]
    team_b_players = [db.query(Player).filter(Player.id == pid).first() for pid in req.team_b_ids]

    team_a_ratings = []
    team_b_ratings = []

    for i, p in enumerate(team_a_players):
        mu    = getattr(p, f"{positions[i]}_mu")
        sigma = getattr(p, f"{positions[i]}_sigma")
        team_a_ratings.append(trueskill.Rating(mu=mu, sigma=sigma))

    for i, p in enumerate(team_b_players):
        mu    = getattr(p, f"{positions[i]}_mu")
        sigma = getattr(p, f"{positions[i]}_sigma")
        team_b_ratings.append(trueskill.Rating(mu=mu, sigma=sigma))

    # 변화량을 측정하기 위해 이전 MMR(mu) 백업
    team_a_prev_mus = [getattr(p, f"{positions[i]}_mu") for i, p in enumerate(team_a_players)]
    team_b_prev_mus = [getattr(p, f"{positions[i]}_mu") for i, p in enumerate(team_b_players)]

    team_a_won = req.winner == "A"
    rating_tau = 1.0 if req.is_virtual else 1.6
    new_team_a, new_team_b = update_ratings(team_a_ratings, team_b_ratings, team_a_won, tau=rating_tau)

    mmr_changes = []

    for i, p in enumerate(team_a_players):
        pos = positions[i]
        setattr(p, f"{pos}_mu",    new_team_a[i].mu)
        setattr(p, f"{pos}_sigma", new_team_a[i].sigma)
        mmr_changes.append({
            "team": "A",
            "player_name": p.name,
            "position": pos,
            "prev_mmr": team_a_prev_mus[i],
            "new_mmr": new_team_a[i].mu,
            "diff": new_team_a[i].mu - team_a_prev_mus[i]
        })

    for i, p in enumerate(team_b_players):
        pos = positions[i]
        setattr(p, f"{pos}_mu",    new_team_b[i].mu)
        setattr(p, f"{pos}_sigma", new_team_b[i].sigma)
        mmr_changes.append({
            "team": "B",
            "player_name": p.name,
            "position": pos,
            "prev_mmr": team_b_prev_mus[i],
            "new_mmr": new_team_b[i].mu,
            "diff": new_team_b[i].mu - team_b_prev_mus[i]
        })

    if selected_coupon_filename:
        coupon_filename = move_coupon_to_awarded_folder(selected_coupon_filename)

    match = Match(
        is_virtual=req.is_virtual,
        winner_team=req.winner,
        recorded_by_name=current_user.username,
        virtual_attempt_number=virtual_attempt_number,
        coupon_probability=coupon_probability,
        coupon_filename=coupon_filename,
        team_a_top_id=req.team_a_ids[0],
        team_a_jungle_id=req.team_a_ids[1],
        team_a_mid_id=req.team_a_ids[2],
        team_a_adc_id=req.team_a_ids[3],
        team_a_support_id=req.team_a_ids[4],
        team_b_top_id=req.team_b_ids[0],
        team_b_jungle_id=req.team_b_ids[1],
        team_b_mid_id=req.team_b_ids[2],
        team_b_adc_id=req.team_b_ids[3],
        team_b_support_id=req.team_b_ids[4],
        record_mode=req.record_mode,
        team_a_bans=json.dumps(req.team_a_bans, ensure_ascii=False),
        team_b_bans=json.dumps(req.team_b_bans, ensure_ascii=False),
        fearless_bans=json.dumps(req.fearless_bans, ensure_ascii=False),
        team_a_picks=json.dumps(req.team_a_picks, ensure_ascii=False),
        team_b_picks=json.dumps(req.team_b_picks, ensure_ascii=False),
    )
    db.add(match)
    db.commit()

    return {
        "message": "Match recorded and ratings updated",
        "mmr_changes": mmr_changes,
        "virtual_reward": {
            "today_count": virtual_attempt_number,
            "daily_limit": VIRTUAL_DAILY_LIMIT,
            "remaining_today": VIRTUAL_DAILY_LIMIT - virtual_attempt_number,
            "probability": coupon_probability,
            "won": coupon_filename is not None,
            "coupon_match_id": match.id if coupon_filename else None,
        } if req.is_virtual else None,
    }
