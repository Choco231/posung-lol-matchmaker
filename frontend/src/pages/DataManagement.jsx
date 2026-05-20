import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DataManagement({ token }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'matches'
  const [users, setUsers] = useState([]);
  
  // 매치 페이지네이션 및 필터 상태
  const [matches, setMatches] = useState([]);
  const [matchesPage, setMatchesPage] = useState(1);
  const [matchesTotal, setMatchesTotal] = useState(0);
  const [matchesLimit] = useState(20);
  const [filterType, setFilterType] = useState('all'); // 'all', 'real', 'virtual'
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  
  // 수정 모달 상태
  const [editingUser, setEditingUser] = useState(null); // { id, username, display_name, lol_id }
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLolId, setEditLolId] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'matches') {
      fetchMatches(matchesPage, filterType);
    }
  }, [activeTab, matchesPage, filterType, token]);

  const fetchUsers = async () => {
    try {
      // 사용자 목록은 export API를 통해 로드
      const res = await axios.get('/api/admin/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('사용자 목록 조회 실패:', err);
    }
  };

  const fetchMatches = async (page, type = filterType) => {
    setIsLoadingMatches(true);
    try {
      let url = `/api/admin/matches?page=${page}&limit=${matchesLimit}`;
      if (type === 'real') {
        url += '&is_virtual=false';
      } else if (type === 'virtual') {
        url += '&is_virtual=true';
      }
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(res.data.matches || []);
      setMatchesTotal(res.data.total || 0);
    } catch (err) {
      console.error('매치 목록 조회 실패:', err);
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
      await axios.post(`/api/admin/users/${editingUser.id}/update`, {
        display_name: editDisplayName,
        lol_id: editLolId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('사용자 정보가 성공적으로 수정되었습니다.');
      closeEditModal();
      fetchUsers(); // 사용자 데이터 새로고침
    } catch (err) {
      alert('수정 실패: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 총 페이지 수 계산
  const totalPages = Math.ceil(matchesTotal / matchesLimit) || 1;

  // 페이지 번호 리스트 계산 (최대 5개씩 노출)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, matchesPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>🛠️ 관리자: 통합 데이터 관리</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          사용자 정보 오탈자 교정 및 시스템에 기록된 모든 매치 기록(실전/가상)을 안전하게 조회합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.6rem 1.2rem',
            fontSize: '0.92rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'users' ? 'rgba(94, 106, 210, 0.18)' : 'transparent',
            color: activeTab === 'users' ? 'var(--accent-hover)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          👥 사용자 정보 관리 ({users.length}명)
        </button>
        <button
          onClick={() => {
            setActiveTab('matches');
            setMatchesPage(1); // 탭 전환 시 1페이지로 강제 초기화
          }}
          style={{
            padding: '0.6rem 1.2rem',
            fontSize: '0.92rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'matches' ? 'rgba(94, 106, 210, 0.18)' : 'transparent',
            color: activeTab === 'matches' ? 'var(--accent-hover)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📊 입력 매치 기록 조회 ({matchesTotal}건)
        </button>
      </div>

      {/* 탭 콘텐츠 영역 */}
      {activeTab === 'users' ? (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>👥 가입자 정보 리스트</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.2rem' }}>
            행 또는 우측의 [수정] 버튼을 클릭해 이름과 롤 아이디를 수정할 수 있습니다.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>로그인 아이디</th>
                  <th>이름 (표시명)</th>
                  <th>롤 아이디</th>
                  <th>권한 및 상태</th>
                  <th style={{ textAlign: 'center' }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr
                    key={u.id}
                    onClick={() => openEditModal(u)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                    className="hover-row"
                  >
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.display_name || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {u.lol_id || <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {u.is_admin ? (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(94,106,210,0.18)', color: 'var(--accent-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>👑 관리자</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>👤 멤버</span>
                        )}
                        {u.is_approved ? (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(16,185,129,0.12)', color: '#34d399', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>✓ 승인됨</span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(239,68,68,0.12)', color: '#f87171', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>⏳ 대기중</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => openEditModal(u)}
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>📊 매치 기록 리스트 (수정 불가)</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
              페이지당 {matchesLimit}개 데이터 출력 중
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.2rem' }}>
            기존에 기록된 실전 내전 경기와 모의/가상 매치 데이터 내역입니다. (서버 측 페이지네이션 적용)
          </p>

          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
            <button
              onClick={() => { setFilterType('all'); setMatchesPage(1); }}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.82rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: filterType === 'all' ? 'rgba(94,106,210,0.2)' : 'transparent',
                color: filterType === 'all' ? 'var(--accent-hover)' : 'var(--text-secondary)',
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              🗂️ 전체
            </button>
            <button
              onClick={() => { setFilterType('real'); setMatchesPage(1); }}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.82rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: filterType === 'real' ? 'rgba(94,106,210,0.2)' : 'transparent',
                color: filterType === 'real' ? 'var(--accent-hover)' : 'var(--text-secondary)',
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              ⚔️ 실전만
            </button>
            <button
              onClick={() => { setFilterType('virtual'); setMatchesPage(1); }}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.82rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: filterType === 'virtual' ? 'rgba(94,106,210,0.2)' : 'transparent',
                color: filterType === 'virtual' ? 'var(--accent-hover)' : 'var(--text-secondary)',
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              🧪 가상만
            </button>
          </div>

          {isLoadingMatches ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              ⏳ 데이터를 불러오는 중입니다...
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '950px' }}>
                  <thead>
                    <tr>
                      <th>경기 일시</th>
                      <th>구분</th>
                      <th>승리</th>
                      <th>🔵 Blue Team</th>
                      <th>🔴 Red Team</th>
                      <th>기록자 (ID)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                          기록된 매치가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      matches.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.created_at || '—'}</td>
                          <td>
                            {m.is_virtual ? (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>🧪 가상</span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>⚔️ 실전</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: m.winner === 'A' ? 'var(--win-color)' : 'var(--loss-color)' }}>
                            {m.winner === 'A' ? 'BLUE' : 'RED'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', gap: '0.15rem' }}>
                              <div>탑: {m.team_a.top}</div>
                              <div>정글: {m.team_a.jungle}</div>
                              <div>미드: {m.team_a.mid}</div>
                              <div>원딜: {m.team_a.adc}</div>
                              <div>서폿: {m.team_a.support}</div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', gap: '0.15rem' }}>
                              <div>탑: {m.team_b.top}</div>
                              <div>정글: {m.team_b.jungle}</div>
                              <div>미드: {m.team_b.mid}</div>
                              <div>원딜: {m.team_b.adc}</div>
                              <div>서폿: {m.team_b.support}</div>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{m.recorded_by}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 조작 패널 */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setMatchesPage(1)}
                    disabled={matchesPage === 1}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: matchesPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: matchesPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: matchesPage === 1 ? 0.4 : 1,
                    }}
                  >
                    ≪ 처음
                  </button>
                  <button
                    onClick={() => setMatchesPage(prev => Math.max(1, prev - 1))}
                    disabled={matchesPage === 1}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: matchesPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: matchesPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: matchesPage === 1 ? 0.4 : 1,
                    }}
                  >
                    이전
                  </button>

                  {getPageNumbers().map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setMatchesPage(pageNum)}
                      style={{
                        width: '32px',
                        height: '32px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: matchesPage === pageNum ? 'var(--accent-hover)' : 'var(--border-color)',
                        background: matchesPage === pageNum ? 'rgba(94, 106, 210, 0.15)' : 'transparent',
                        color: matchesPage === pageNum ? 'var(--accent-hover)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => setMatchesPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={matchesPage === totalPages}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: matchesPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: matchesPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: matchesPage === totalPages ? 0.4 : 1,
                    }}
                  >
                    다음
                  </button>
                  <button
                    onClick={() => setMatchesPage(totalPages)}
                    disabled={matchesPage === totalPages}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'transparent',
                      color: matchesPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                      cursor: matchesPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: matchesPage === totalPages ? 0.4 : 1,
                    }}
                  >
                    끝 ≫
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 사용자 정보 수정 모달 */}
      {editingUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.25s ease-out'
        }} onClick={closeEditModal}>
          <div className="card" style={{
            width: '450px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
            animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.2rem', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📝 가입 유저 정보 수정
            </h3>
            
            <form onSubmit={handleUpdateUser}>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  로그인 아이디 (수정 불가)
                </label>
                <input
                  value={editingUser.username}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-secondary)',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  이름 (표시명)
                </label>
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="사용자의 이름을 입력해 주세요"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.8rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                  롤 아이디
                </label>
                <input
                  value={editLolId}
                  onChange={(e) => setEditLolId(e.target.value)}
                  placeholder="예: 초코타코#kr1 (오타 교정용)"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    padding: '0.5rem 1.2rem',
                  }}
                >
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
