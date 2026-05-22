import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "loltc_data.db")

def reset_db_raw():
    if not os.path.exists(db_path):
        print(f"데이터베이스 파일({db_path})이 존재하지 않습니다.")
        return
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # matches 테이블 데이터 지우기
        cursor.execute("DELETE FROM matches;")
        num_matches = cursor.rowcount
        
        # players 테이블 데이터 지우기
        cursor.execute("DELETE FROM players;")
        num_players = cursor.rowcount
        
        conn.commit()
        print("성공적으로 데이터를 리셋했습니다.")
        print(f"- 삭제된 매치 기록 수: {num_matches}")
        print(f"- 삭제된 플레이어 수: {num_players}")
        print("가입된 유저 계정(users 테이블)은 정상적으로 유지되었습니다.")
        
    except Exception as e:
        print(f"데이터 리셋 중 오류 발생: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    reset_db_raw()
