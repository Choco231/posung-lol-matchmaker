import { useEffect, useState } from 'react';
import axios from 'axios';

const PAGE_SIZE = 10;
const POSITIONS = [
  { key: 'top', label: 'Top' },
  { key: 'jungle', label: 'Jungle' },
  { key: 'mid', label: 'Mid' },
  { key: 'adc', label: 'ADC' },
  { key: 'support', label: 'Support' },
];

const POSITION_LABELS = {
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Mid',
  adc: 'ADC',
  support: 'Support',
};

function BanList({ title, items, color }) {
  const rows = [];
  for (let i = 0; i < items.length; i += i === 0 ? 3 : 2) {
    rows.push(items.slice(i, i === 0 ? 3 : i + 2));
  }

  return (
    <div style={{ flex: 1, minWidth: '240px' }}>
      <h4 style={{ color, margin: '0 0 0.6rem 0' }}>{title}</h4>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>기록 없음</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {row.map((item, idx) => (
                <span
                  key={`${item.champion || item}-${rowIdx}-${idx}`}
                  style={{
                    padding: '0.28rem 0.55rem',
                    borderRadius: '14px',
                    background: `${color}20`,
                    color,
                    border: `1px solid ${color}45`,
                    fontSize: '0.82rem',
                  }}
                >
                  {item.champion || item}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PickList({ title, items, color }) {
  return (
    <div style={{ flex: 1, minWidth: '240px' }}>
      <h4 style={{ color, margin: '0 0 0.6rem 0' }}>{title}</h4>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>기록 없음</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {items.map((item, idx) => (
            <div
              key={`${item.champion || item}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.7rem',
                padding: '0.45rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
                fontSize: '0.86rem',
              }}
            >
              <span style={{ color, minWidth: '3.5rem', fontWeight: 700 }}>
                {item.position ? (POSITION_LABELS[item.position] || item.position) : '-'}
              </span>
              <span style={{ fontWeight: 700 }}>{item.champion || item}</span>
              {item.playerName && (
                <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', textAlign: 'right' }}>
                  {item.playerName}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchDetailModal({ match, onClose }) {
  if (!match) return null;

  const blueWon = match.winner === 'A';
  const withPlayerNames = (items, team) => (
    (items || []).map((item) => ({
      ...item,
      playerName: item.position ? team?.[item.position] : null,
    }))
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 'min(920px, 100%)', maxHeight: '88vh', overflowY: 'auto', padding: '1.4rem' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0' }}>상세 기록</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {match.created_at ? `${match.created_at} KST` : '시간 정보 없음'}
              </span>
              <span style={{
                padding: '0.22rem 0.55rem',
                borderRadius: '12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: blueWon ? '#60a5fa' : '#f87171',
                background: blueWon ? 'rgba(59,130,246,0.14)' : 'rgba(239,68,68,0.14)',
              }}>
                {blueWon ? 'BLUE 승리' : 'RED 승리'}
              </span>
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: '0.45rem 0.8rem' }}>
            닫기
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
          <BanList title="Blue 밴" items={match.team_a_bans || []} color="#60a5fa" />
          <BanList title="Red 밴" items={match.team_b_bans || []} color="#f87171" />
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
          <PickList title="Blue 픽" items={withPlayerNames(match.team_a_picks, match.team_a)} color="#60a5fa" />
          <PickList title="Red 픽" items={withPlayerNames(match.team_b_picks, match.team_b)} color="#f87171" />
        </div>

        <div>
          <h4 style={{ color: '#c084fc', margin: '0 0 0.6rem 0' }}>피어리스 밴</h4>
          {match.fearless_bans?.length ? (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              {match.fearless_bans.map((champion, idx) => (
                <span
                  key={`${champion}-${idx}`}
                  style={{
                    padding: '0.28rem 0.55rem',
                    borderRadius: '14px',
                    background: 'rgba(168,85,247,0.14)',
                    color: '#d8b4fe',
                    border: '1px solid rgba(168,85,247,0.28)',
                    fontSize: '0.82rem',
                  }}
                >
                  {champion}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>기록 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MatchResults() {
  const [matches, setMatches] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/matches/public-results?page=${page}&limit=${PAGE_SIZE}`)
      .then(res => {
        setMatches(res.data.matches || []);
        setTotal(res.data.total || 0);
      })
      .catch(err => {
        console.error('내전 결과 조회 실패:', err);
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
          기록된 실전 내전의 참가 선수, 라인, 승리 팀을 확인할 수 있습니다.
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
              const hasDetails = match.record_mode === 'detailed';
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => setSelectedMatch(match)}
                          style={{
                            padding: '0.3rem 0.7rem',
                            borderRadius: '14px',
                            border: '1px solid rgba(94,106,210,0.45)',
                            background: 'rgba(94,106,210,0.16)',
                            color: 'var(--accent-hover)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          상세 보기
                        </button>
                      )}
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
                            <span style={{ width: '3.5rem', color: 'var(--text-secondary)' }}>{position.label}</span>
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

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  );
}
