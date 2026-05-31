import { useState, useEffect } from 'react';
import axios from 'axios';

const MATCH_LIMIT = 100;
const PAGE_SIZE = 20;
const POSITIONS = [
  ['top', 'Top'],
  ['jungle', 'Jgl'],
  ['mid', 'Mid'],
  ['adc', 'ADC'],
  ['support', 'Sup'],
];

export default function DataManagement({ token }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [matchPage, setMatchPage] = useState(1);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLolId, setEditLolId] = useState('');

  const authHeaders = { Authorization: `Bearer ${token}` };
  const shownMatchesTotal = matches.length;
  const totalPages = Math.max(1, Math.ceil(shownMatchesTotal / PAGE_SIZE));
  const pagedMatches = matches.slice((matchPage - 1) * PAGE_SIZE, matchPage * PAGE_SIZE);

  useEffect(() => {
    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'matches' && !matchesLoaded) {
      fetchRecentMatches();
    }
  }, [activeTab, matchesLoaded]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users', { headers: authHeaders });
      setUsers(Array.isArray(res.data) ? res.data : (res.data.users || []));
    } catch (err) {
      console.error('사용자 목록 조회 실패:', err);
    }
  };

  const fetchRecentMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const res = await axios.get(`/api/admin/matches?page=1&limit=${MATCH_LIMIT}&is_virtual=true`, {
        headers: authHeaders,
      });
      setMatches(res.data.matches || []);
      setMatchesTotal(res.data.total || 0);
      setMatchPage(1);
      setMatchesLoaded(true);
    } catch (err) {
      console.error('가상 데이터 기록 조회 실패:', err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditDisplayName(user.display_name || '');
    setEditLolId(user.lol_id || '');
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditDisplayName('');
    setEditLolId('');
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await axios.post(
        `/api/admin/users/${editingUser.id}/update`,
        {
          display_name: editDisplayName,
          lol_id: editLolId,
        },
        { headers: authHeaders }
      );
      alert('사용자 정보가 성공적으로 수정되었습니다.');
      closeEditModal();
      fetchUsers();
    } catch (err) {
      alert('수정 실패: ' + (err.response?.data?.detail || err.message));
    }
  };

  const tabStyle = (selected) => ({
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: selected ? 'rgba(94, 106, 210, 0.18)' : 'transparent',
    color: selected ? 'var(--accent-hover)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 600,
  });

  const teamBoxStyle = (teamColor, isWinner) => {
    const rgb = teamColor === 'blue' ? '59,130,246' : '239,68,68';
    return {
      display: 'grid',
      gap: '0.35rem',
      minWidth: '260px',
      padding: '0.7rem',
      borderRadius: '12px',
      border: `1px solid rgba(${rgb}, ${isWinner ? 0.9 : 0.18})`,
      background: isWinner ? `rgba(${rgb}, 0.22)` : 'rgba(255,255,255,0.025)',
      boxShadow: isWinner ? `0 0 0 1px rgba(${rgb}, 0.25), 0 8px 22px rgba(${rgb}, 0.14)` : 'none',
      opacity: isWinner ? 1 : 0.72,
    };
  };

  const TeamRoster = ({ team, color, isWinner }) => (
    <div style={teamBoxStyle(color, isWinner)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
        <strong style={{ color: color === 'blue' ? '#60a5fa' : '#f87171' }}>{color === 'blue' ? 'BLUE' : 'RED'}</strong>
        {isWinner && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: color === 'blue' ? '#93c5fd' : '#fca5a5' }}>
            WIN
          </span>
        )}
      </div>
      {POSITIONS.map(([key, label]) => (
        <div
          key={key}
          style={{
            display: 'grid',
            gridTemplateColumns: '42px 1fr',
            alignItems: 'center',
            gap: '0.55rem',
            fontSize: '0.82rem',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 800 }}>{label}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: isWinner ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team?.[key] || '-'}
          </span>
        </div>
      ))}
    </div>
  );

  const PaginationControls = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
      <button
        onClick={() => setMatchPage((prev) => Math.max(1, prev - 1))}
        disabled={matchPage === 1}
        style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', opacity: matchPage === 1 ? 0.4 : 1, cursor: matchPage === 1 ? 'not-allowed' : 'pointer' }}
      >
        이전
      </button>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        {matchPage} / {totalPages}
      </span>
      <button
        onClick={() => setMatchPage((prev) => Math.min(totalPages, prev + 1))}
        disabled={matchPage === totalPages}
        style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', opacity: matchPage === totalPages ? 0.4 : 1, cursor: matchPage === totalPages ? 'not-allowed' : 'pointer' }}
      >
        다음
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>관리자: 통합 데이터 관리</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          가상 데이터 기록은 최근 {MATCH_LIMIT}개만 가져오고, 화면에는 {PAGE_SIZE}개씩 나눠 표시합니다.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
        <button style={tabStyle(activeTab === 'users')} onClick={() => setActiveTab('users')}>
          사용자 정보 관리 ({users.length}명)
        </button>
        <button style={tabStyle(activeTab === 'matches')} onClick={() => setActiveTab('matches')}>
          가상 데이터 기록 조회
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>사용자 정보 관리</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.45rem 0 0 0' }}>
              행 또는 수정 버튼을 클릭하면 이름과 롤 아이디를 수정할 수 있습니다.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>로그인 아이디</th>
                  <th>이름</th>
                  <th>롤 아이디</th>
                  <th>권한 및 상태</th>
                  <th style={{ textAlign: 'center' }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => openEditModal(u)} style={{ cursor: 'pointer' }} className="hover-row">
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.display_name || <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {u.lol_id || <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', background: u.is_admin ? 'rgba(94,106,210,0.18)' : 'rgba(255,255,255,0.06)', color: u.is_admin ? 'var(--accent-hover)' : 'var(--text-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: u.is_admin ? 600 : 400 }}>
                          {u.is_admin ? '관리자' : '멤버'}
                        </span>
                        <span style={{ fontSize: '0.72rem', background: u.is_approved ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_approved ? '#34d399' : '#f87171', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {u.is_approved ? '승인됨' : '대기중'}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} onClick={() => openEditModal(u)}>
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      사용자 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>최근 가상 데이터 기록</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.45rem 0 0 0' }}>
                전체 가상 데이터 {matchesTotal}건 중 최근 {shownMatchesTotal}건을 불러왔고, {PAGE_SIZE}개씩 표시합니다.
              </p>
            </div>
            <button className="btn" onClick={fetchRecentMatches} disabled={isLoadingMatches} style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}>
              새로고침
            </button>
          </div>

          {isLoadingMatches ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>가상 데이터 기록을 불러오는 중입니다...</div>
          ) : (
            <>
              {shownMatchesTotal > PAGE_SIZE && (
                <div style={{ marginBottom: '1rem' }}>
                  <PaginationControls />
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '980px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>경기 일시</th>
                      <th>Blue Team</th>
                      <th>Red Team</th>
                      <th style={{ width: '130px' }}>기록자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMatches.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.created_at || '-'}</td>
                        <td>
                          <TeamRoster team={m.team_a} color="blue" isWinner={m.winner === 'A'} />
                        </td>
                        <td>
                          <TeamRoster team={m.team_b} color="red" isWinner={m.winner === 'B'} />
                        </td>
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{m.recorded_by}</td>
                      </tr>
                    ))}
                    {pagedMatches.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                          표시할 가상 데이터 기록이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {shownMatchesTotal > PAGE_SIZE && (
                <div style={{ marginTop: '1rem' }}>
                  <PaginationControls />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {editingUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={closeEditModal}
        >
          <div
            className="card"
            style={{ width: '450px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1.2rem', fontSize: '1.3rem' }}>가입자 정보 수정</h3>

            <form onSubmit={handleUpdateUser}>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>로그인 아이디</label>
                <input value={editingUser.username} disabled style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>이름</label>
                <input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="사용자의 표시 이름을 입력하세요" required style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }} />
              </div>

              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>롤 아이디</label>
                <input value={editLolId} onChange={(e) => setEditLolId(e.target.value)} placeholder="예: 포성#KR1" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeEditModal} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  취소
                </button>
                <button type="submit" className="btn" style={{ padding: '0.5rem 1.2rem' }}>
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
