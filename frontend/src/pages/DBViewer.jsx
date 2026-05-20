import { useState, useEffect } from 'react';
import axios from 'axios';

const TABS = ['유저', '선수 (Players)', '경기 기록 (Matches)'];

const ROLE_BADGE = (is_admin) => is_admin
  ? <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(94,106,210,0.2)', color: '#7b88ff', fontSize: '0.78rem', fontWeight: 600 }}>관리자</span>
  : <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>멤버</span>;

export default function DBViewer({ token, isAdmin }) {
  const [tab, setTab]     = useState(0);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 경기 기록 정렬 상태 (기본값: 최신 시간순)
  const [matchSort, setMatchSort] = useState({ key: 'time', asc: false });

  useEffect(() => {
    if (!token || !isAdmin) return;
    setLoading(true);
    axios.get('/api/admin/export', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { setData(res.data); setLoading(false); })
      .catch(err => { setError(err.response?.data?.detail || '오류가 발생했습니다.'); setLoading(false); });
  }, [token, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--loss-color)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚫</div>
        <p>관리자 전용 페이지입니다.</p>
      </div>
    );
  }

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>🔄 DB 불러오는 중...</div>;
  if (error)   return <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--loss-color)' }}>{error}</div>;
  if (!data)   return null;

  const handleMatchSort = (key) => {
    if (matchSort.key === key) {
      setMatchSort({ key, asc: !matchSort.asc });
    } else {
      setMatchSort({ key, asc: key !== 'time' }); // 시간은 최신순(desc)가 기본, 나머지는 오름차순(asc) 기본
    }
  };

  const getSortedMatches = () => {
    const arr = [...data.matches];
    arr.sort((a, b) => {
      let cmp = 0;
      if (matchSort.key === 'time') {
        cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      } else if (matchSort.key === 'type') {
        cmp = (a.is_virtual === b.is_virtual) ? 0 : (a.is_virtual ? 1 : -1);
      } else if (matchSort.key === 'recorder') {
        cmp = (a.recorded_by || '').localeCompare(b.recorded_by || '');
      }
      return matchSort.asc ? cmp : -cmp;
    });
    return arr;
  };

  /* ── Tab styles ── */
  const tabBtn = (i) => ({
    padding: '0.5rem 1.2rem', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
    fontWeight: tab === i ? 700 : 400, fontSize: '0.9rem',
    background: tab === i ? 'var(--panel-bg)' : 'rgba(255,255,255,0.04)',
    color: tab === i ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderBottom: tab === i ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'all 0.15s',
  });

  const sortHeaderStyle = { cursor: 'pointer', userSelect: 'none' };
  const sortIndicator = (key) => matchSort.key === key ? (matchSort.asc ? ' ▲' : ' ▼') : '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>🗄️ DB 뷰어</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          유저 {data.users.length}명 · 선수 {data.players.length}명 · 경기 {data.matches.length}건
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '-1px', zIndex: 1, position: 'relative' }}>
        {TABS.map((t, i) => (
          <button key={i} style={tabBtn(i)} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      <div className="card" style={{ borderRadius: '0 12px 12px 12px' }}>

        {/* ── Users ── */}
        {tab === 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>아이디</th><th>이름</th><th>롤 아이디</th><th>역할</th><th>승인</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.display_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.lol_id || '—'}</td>
                    <td>{ROLE_BADGE(u.is_admin)}</td>
                    <td>
                      {u.is_approved
                        ? <span style={{ color: 'var(--win-color)', fontSize: '0.85rem' }}>✓ 승인됨</span>
                        : <span style={{ color: 'var(--loss-color)', fontSize: '0.85rem' }}>⏳ 대기</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Players ── */}
        {tab === 1 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>이름</th>
                  <th>Top μ/σ</th><th>Jungle μ/σ</th><th>Mid μ/σ</th><th>ADC μ/σ</th><th>Support μ/σ</th>
                  <th>불가 포지션</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map(p => (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.id}</td>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    {['top','jungle','mid','adc','support'].map(pos => (
                      <td key={pos} style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{p[`${pos}_mu`]}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>/{p[`${pos}_sigma`]}</span>
                      </td>
                    ))}
                    <td>
                      {p.impossible_positions.length > 0
                        ? JSON.parse(p.impossible_positions).map(pos => (
                            <span key={pos} className="pos-tag" style={{ background: 'rgba(244,67,54,0.15)', color: 'var(--loss-color)', marginRight: '0.2rem' }}>
                              {pos}
                            </span>
                          ))
                        : <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>없음</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Matches ── */}
        {tab === 2 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleMatchSort('time')} style={sortHeaderStyle}>기록 시간{sortIndicator('time')}</th>
                  <th onClick={() => handleMatchSort('recorder')} style={sortHeaderStyle}>입력한 사람{sortIndicator('recorder')}</th>
                  <th onClick={() => handleMatchSort('type')} style={sortHeaderStyle}>종류{sortIndicator('type')}</th>
                  <th style={{color:'#3b82f6'}}>블루 탑</th>
                  <th style={{color:'#3b82f6'}}>블루 정글</th>
                  <th style={{color:'#3b82f6'}}>블루 미드</th>
                  <th style={{color:'#3b82f6'}}>블루 원딜</th>
                  <th style={{color:'#3b82f6'}}>블루 서폿</th>
                  <th style={{color:'#ef4444'}}>레드 탑</th>
                  <th style={{color:'#ef4444'}}>레드 정글</th>
                  <th style={{color:'#ef4444'}}>레드 미드</th>
                  <th style={{color:'#ef4444'}}>레드 원딜</th>
                  <th style={{color:'#ef4444'}}>레드 서폿</th>
                  <th>승리팀</th>
                </tr>
              </thead>
              <tbody>
                {getSortedMatches().map(m => {
                  // "YYYY-MM-DD HH:MM:SS" 형식에서 초 부분을 제거하여 "YYYY-MM-DD HH:MM" 형태로 표시
                  const timeStr = m.created_at ? m.created_at.substring(0, 16) : '알 수 없음';
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{timeStr}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {m.recorded_by}
                      </td>
                      <td>
                        {m.is_virtual
                          ? <span style={{ fontSize: '0.78rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(94,106,210,0.15)', color: 'var(--accent-hover)' }}>가상</span>
                          : <span style={{ fontSize: '0.78rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(76,175,80,0.15)', color: 'var(--win-color)' }}>실전</span>}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#3b82f6' }}>{m.team_a.top}</td>
                      <td style={{ fontSize: '0.82rem', color: '#3b82f6' }}>{m.team_a.jungle}</td>
                      <td style={{ fontSize: '0.82rem', color: '#3b82f6' }}>{m.team_a.mid}</td>
                      <td style={{ fontSize: '0.82rem', color: '#3b82f6' }}>{m.team_a.adc}</td>
                      <td style={{ fontSize: '0.82rem', color: '#3b82f6' }}>{m.team_a.support}</td>
                      
                      <td style={{ fontSize: '0.82rem', color: '#ef4444' }}>{m.team_b.top}</td>
                      <td style={{ fontSize: '0.82rem', color: '#ef4444' }}>{m.team_b.jungle}</td>
                      <td style={{ fontSize: '0.82rem', color: '#ef4444' }}>{m.team_b.mid}</td>
                      <td style={{ fontSize: '0.82rem', color: '#ef4444' }}>{m.team_b.adc}</td>
                      <td style={{ fontSize: '0.82rem', color: '#ef4444' }}>{m.team_b.support}</td>
                      
                      <td style={{ fontWeight: 700, color: m.winner === 'A' ? '#3b82f6' : '#ef4444' }}>
                        {m.winner === 'A' ? '블루' : '레드'}
                      </td>
                    </tr>
                  );
                })}
                {data.matches.length === 0 && (
                  <tr><td colSpan={14} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>경기 기록이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
