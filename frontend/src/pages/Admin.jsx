import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Admin({ token, userInfo }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await axios.post(`/api/auth/approve/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert('승인 실패: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    const action = currentIsAdmin ? '멤버로 변경' : '관리자로 변경';
    if (!confirm(`이 유저를 ${action}하시겠습니까?`)) return;
    try {
      await axios.post(`/api/auth/toggle-admin/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert('역할 변경 실패: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="card">
      <h2>🛡️ 관리자: 회원 관리</h2>
      <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>최고 관리자 전용 페이지입니다.</p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>아이디</th>
              <th>이름</th>
              <th>롤 아이디</th>
              <th>역할</th>
              <th>승인 상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ color: 'var(--text-secondary)' }}>{u.id}</td>
                <td style={{ fontWeight: 'bold' }}>{u.username}</td>
                <td>{u.display_name || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {u.lol_id || <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
                <td>
                  {u.is_admin
                    ? <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>👑 관리자</span>
                    : <span style={{ color: 'var(--text-secondary)' }}>👤 멤버</span>}
                </td>
                <td>
                  {u.is_approved
                    ? <span style={{ color: 'var(--win-color)' }}>✓ 승인됨</span>
                    : <span style={{ color: 'var(--loss-color)' }}>⏳ 대기중</span>}
                </td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* 승인 버튼 */}
                  {!u.is_approved && (
                    <button
                      className="btn"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem' }}
                      onClick={() => handleApprove(u.id)}
                    >
                      승인
                    </button>
                  )}
                  {/* 역할 변경 버튼 (본인 및 절대자 제외) */}
                  {u.username === 'dkswldnjs213' || (userInfo && u.id === userInfo.id) ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.35rem 0.8rem', display: 'inline-flex', alignItems: 'center' }}>
                      🔒 변경 불가
                    </span>
                  ) : (
                    <button
                      style={{
                        padding: '0.35rem 0.8rem', fontSize: '0.82rem',
                        borderRadius: '8px', border: '1px solid var(--border-color)',
                        background: u.is_admin ? 'rgba(244,67,54,0.12)' : 'rgba(94,106,210,0.15)',
                        color: u.is_admin ? 'var(--loss-color)' : 'var(--accent-hover)',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                      onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                    >
                      {u.is_admin ? '멤버로 변경' : '관리자로 변경'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
