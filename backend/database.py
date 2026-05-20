from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./loltc_data.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    display_name = Column(String, nullable=True)   # 실명 (이름)
    lol_id = Column(String, nullable=True)         # 롤 아이디 (e.g. 초코타코#kr1)
    is_admin = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    # Positions MMR (mu and sigma)
    top_mu = Column(Float, default=50.0)
    top_sigma = Column(Float, default=16.666)
    jungle_mu = Column(Float, default=50.0)
    jungle_sigma = Column(Float, default=16.666)
    mid_mu = Column(Float, default=50.0)
    mid_sigma = Column(Float, default=16.666)
    adc_mu = Column(Float, default=50.0)
    adc_sigma = Column(Float, default=16.666)
    support_mu = Column(Float, default=50.0)
    support_sigma = Column(Float, default=16.666)
    # JSON string for impossible positions e.g., '["top", "jungle"]'
    impossible_positions = Column(String, default='[]')
    # JSON string for preferred positions
    preferred_positions = Column(String, default='[]')
    # JSON string for non-preferred positions
    non_preferred_positions = Column(String, default='[]')

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_virtual = Column(Boolean, default=False)
    winner_team = Column(String) # "A" or "B"
    recorded_by_name = Column(String, nullable=True) # 입력한 사람 이름
    
    # Team A players (IDs)
    team_a_top_id = Column(Integer, ForeignKey("players.id"))
    team_a_jungle_id = Column(Integer, ForeignKey("players.id"))
    team_a_mid_id = Column(Integer, ForeignKey("players.id"))
    team_a_adc_id = Column(Integer, ForeignKey("players.id"))
    team_a_support_id = Column(Integer, ForeignKey("players.id"))

    # Team B players (IDs)
    team_b_top_id = Column(Integer, ForeignKey("players.id"))
    team_b_jungle_id = Column(Integer, ForeignKey("players.id"))
    team_b_mid_id = Column(Integer, ForeignKey("players.id"))
    team_b_adc_id = Column(Integer, ForeignKey("players.id"))
    team_b_support_id = Column(Integer, ForeignKey("players.id"))

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
