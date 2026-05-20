from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect as sa_inspect, text
from fastapi.security import OAuth2PasswordRequestForm
from typing import List, Optional
from pydantic import BaseModel
import json
import trueskill
import csv
from io import BytesIO, StringIO

from database import get_db, engine, SessionLocal, User, Player, Match
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_approved_user, get_admin_user
)
from model import update_ratings, find_best_matchups

app = FastAPI(title="LoL Tournament API")


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

        # matches table migration
        match_cols = [c["name"] for c in sa_inspect(engine).get_columns("matches")]
        if "recorded_by_name" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN recorded_by_name VARCHAR"))
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

        # 20 test players — (name, top, jgl, mid, adc, sup, impossible[])
        TEST_PLAYERS = [
            ("test01", 60.0, 44.0, 50.0, 40.0, 36.0, []),
            ("test02", 44.0, 64.0, 50.0, 42.0, 38.0, []),
            ("test03", 42.0, 46.0, 66.0, 44.0, 40.0, []),
            ("test04", 40.0, 42.0, 48.0, 68.0, 44.0, []),
            ("test05", 38.0, 40.0, 44.0, 46.0, 70.0, []),
            ("test06", 56.0, 40.0, 40.0, 56.0, 44.0, ["mid", "jungle"]),
            ("test07", 40.0, 54.0, 40.0, 44.0, 54.0, ["top", "mid"]),
            ("test08", 44.0, 44.0, 52.0, 40.0, 42.0, []),
            ("test09", 48.0, 48.0, 48.0, 48.0, 48.0, []),
            ("test10", 36.0, 36.0, 36.0, 36.0, 36.0, []),
            ("test11", 64.0, 50.0, 44.0, 40.0, 40.0, ["adc", "support"]),
            ("test12", 42.0, 66.0, 44.0, 42.0, 40.0, ["top"]),
            ("test13", 40.0, 42.0, 62.0, 44.0, 42.0, []),
            ("test14", 44.0, 40.0, 44.0, 64.0, 40.0, []),
            ("test15", 40.0, 42.0, 44.0, 42.0, 60.0, []),
            ("test16", 52.0, 52.0, 40.0, 40.0, 52.0, ["mid", "adc"]),
            ("test17", 40.0, 40.0, 56.0, 56.0, 40.0, ["top", "support"]),
            ("test18", 58.0, 42.0, 42.0, 58.0, 42.0, []),
            ("test19", 46.0, 58.0, 46.0, 46.0, 46.0, []),
            ("test20", 50.0, 50.0, 50.0, 50.0, 50.0, []),
        ]
        for name, top, jgl, mid, adc, sup, imp in TEST_PLAYERS:
            if not db.query(Player).filter(Player.name == name).first():
                db.add(Player(
                    name=name,
                    top_mu=top, jungle_mu=jgl, mid_mu=mid, adc_mu=adc, support_mu=sup,
                    top_sigma=16.666, jungle_sigma=16.666, mid_sigma=16.666, adc_sigma=16.666, support_sigma=16.666,
                    impossible_positions=json.dumps(imp),
                ))
        db.commit()
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

class UserUpdateAdmin(BaseModel):
    display_name: str = ""
    lol_id: str = ""


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
        "매치ID", "경기일시", "승리팀", "기록자",
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
def export_db(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    users   = db.query(User).all()
    players = db.query(Player).all()
    matches = db.query(Match).all()

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
                "id": p.id, "name": p.name,
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
    }


# --- Player Endpoints ---
@app.get("/api/players", response_model=List[PlayerResponse])
def get_players(db: Session = Depends(get_db)):
    return db.query(Player).all()

@app.post("/api/players")
def create_player(player: PlayerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_approved_user)):
    if db.query(Player).filter(Player.name == player.name).first():
        raise HTTPException(status_code=400, detail="Player already exists")

    new_player = Player(
        name=player.name,
        impossible_positions=json.dumps(player.impossible_positions),
        preferred_positions=json.dumps(player.preferred_positions),
        non_preferred_positions=json.dumps(player.non_preferred_positions)
    )

    if player.copy_top_id:
        p = db.query(Player).filter(Player.id == player.copy_top_id).first()
        if p: new_player.top_mu = p.top_mu
    if player.copy_jungle_id:
        p = db.query(Player).filter(Player.id == player.copy_jungle_id).first()
        if p: new_player.jungle_mu = p.jungle_mu
    if player.copy_mid_id:
        p = db.query(Player).filter(Player.id == player.copy_mid_id).first()
        if p: new_player.mid_mu = p.mid_mu
    if player.copy_adc_id:
        p = db.query(Player).filter(Player.id == player.copy_adc_id).first()
        if p: new_player.adc_mu = p.adc_mu
    if player.copy_support_id:
        p = db.query(Player).filter(Player.id == player.copy_support_id).first()
        if p: new_player.support_mu = p.support_mu

    db.add(new_player)
    db.commit()
    return {"message": "Player created"}


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

@app.post("/api/matches")
def record_match(req: RecordMatchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_approved_user)):
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

    team_a_won = req.winner == "A"
    new_team_a, new_team_b = update_ratings(team_a_ratings, team_b_ratings, team_a_won)

    for i, p in enumerate(team_a_players):
        setattr(p, f"{positions[i]}_mu",    new_team_a[i].mu)
        setattr(p, f"{positions[i]}_sigma", new_team_a[i].sigma)

    for i, p in enumerate(team_b_players):
        setattr(p, f"{positions[i]}_mu",    new_team_b[i].mu)
        setattr(p, f"{positions[i]}_sigma", new_team_b[i].sigma)

    match = Match(
        is_virtual=req.is_virtual,
        winner_team=req.winner,
        recorded_by_name=current_user.username,
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
    )
    db.add(match)
    db.commit()

    return {"message": "Match recorded and ratings updated"}
