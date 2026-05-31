import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DataManagement({ token }) {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLolId, setEditLolId] = useState('');

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users', { headers: authHeaders });
      setUsers(Array.isArray(res.data) ? res.data : (res.data.users || []));
    } catch (err) {
      console.error('사용자 목록 조회 실패:', err);
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

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>관리자: 데이터 관리</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          가입 유저의 표시 이름과 LoL 아이디를 관리합니다.
        </p>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>사용자 정보 관리 ({users.length}명)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.45rem 0 0 0' }}>
            행 또는 수정 버튼을 클릭하면 이름과 LoL 아이디를 수정할 수 있습니다.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>로그인 아이디</th>
                <th>이름</th>
                <th>LoL 아이디</th>
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
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>LoL 아이디</label>
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
