import sqlite3
import json
import random
import os

# 스크립트 실행 위치에 관계없이 backend/loltc_data.db를 찾도록 절대 경로로 계산
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'loltc_data.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT id, name FROM players")
players = c.fetchall()

positions = ['top', 'jungle', 'mid', 'adc', 'support']

for p in players:
    p_id = p[0]
    
    # 1. 선호 포지션 개수 결정 (최소 1개에서 최대 3개)
    num_pref = random.randint(1, 3)
    pref = random.sample(positions, num_pref)
    
    # 남은 포지션들
    remaining = [pos for pos in positions if pos not in pref]
    
    # 2. 불가 포지션 개수 결정 (0개에서 남은 것 중 일부)
    num_imp = random.randint(0, min(2, len(remaining)))
    imp = random.sample(remaining, num_imp)
    
    # 3. 비선호 포지션 (선호와 불가에 포함되지 않은 나머지 전부)
    non_pref = [pos for pos in remaining if pos not in imp]
    
    c.execute(
        "UPDATE players SET preferred_positions=?, non_preferred_positions=?, impossible_positions=? WHERE id=?",
        (json.dumps(pref), json.dumps(non_pref), json.dumps(imp), p_id)
    )

conn.commit()
conn.close()
print("Successfully partitioned all players with at least one preferred position.")
