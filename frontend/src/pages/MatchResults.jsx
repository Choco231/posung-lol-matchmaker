import { useEffect, useState } from 'react';
import axios from 'axios';

const PAGE_SIZE = 10;
const POSITIONS = [
  { key: 'top', label: '탑' },
  { key: 'jungle', label: '정글' },
  { key: 'mid', label: '미드' },
  { key: 'adc', label: '원딜' },
  { key: 'support', label: '서폿' },
];

export default function MatchResults() {
  const [matches, setMatches] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/matches/public-results?page=${page}&limit=${PAGE_SIZE}`)
      .then(res => {
        setMatches(res.data.matches || []);
        setTotal(res.data.total || 0);
      })
      .catch(err => {
        console.error('실전 결과 조회 실패:', err);
        setMatches([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>⚔️ 내전 결과</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          기록된 실전 내전의 참가 선수, 포지션, 승리 팀을 확인할 수 있습니다.
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          결과를 불러오는 중입니다...
        </div>
      ) : matches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          기록된 실전 결과가 없습니다.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {matches.map(match => {
              const blueWon = match.winner === 'A';
              return (
                <div key={match.id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {match.created_at ? `${match.created_at} KST` : '시간 정보 없음'}
                    </span>
                    <span style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '14px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: blueWon ? '#60a5fa' : '#f87171',
                      background: blueWon ? 'rgba(59,130,246,0.14)' : 'rgba(239,68,68,0.14)',
                    }}>
                      {blueWon ? 'BLUE 승리' : 'RED 승리'}
                    </span>
                  </div>

                  <div className="match-results-teams" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '0.8rem',
                  }}>
                    {[
                      { label: 'BLUE', team: match.team_a, color: '#60a5fa', won: blueWon },
                      { label: 'RED', team: match.team_b, color: '#f87171', won: !blueWon },
                    ].map(side => (
                      <div key={side.label} style={{
                        padding: '0.8rem',
                        borderRadius: '8px',
                        background: side.won ? `${side.color}10` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${side.won ? `${side.color}45` : 'var(--border-color)'}`,
                      }}>
                        <div style={{ color: side.color, fontWeight: 700, marginBottom: '0.6rem' }}>
                          {side.label} {side.won && 'WIN'}
                        </div>
                        {POSITIONS.map(position => (
                          <div key={position.key} style={{
                            display: 'flex',
                            gap: '0.6rem',
                            padding: '0.18rem 0',
                            fontSize: '0.86rem',
                          }}>
                            <span style={{ width: '2.6rem', color: 'var(--text-secondary)' }}>{position.label}</span>
                            <span style={{ fontWeight: 500 }}>{side.team[position.key]}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.7rem', marginTop: '1.4rem' }}>
              <button className="btn" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>
                이전
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {page} / {totalPages}
              </span>
              <button className="btn" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
