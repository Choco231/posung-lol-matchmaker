import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login({ setToken }) {
  const [isRegister, setIsRegister]   = useState(false);
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [lolId, setLolId]             = useState('');
  const [message, setMessage]         = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await axios.post('/api/auth/register', {
          username,
          password,
          display_name: displayName,
          lol_id: lolId,
        });
        setMessage('가입 신청 완료. 최고 관리자의 승인을 기다려주세요.');
        setIsRegister(false);
      } else {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const res = await axios.post('/api/auth/login', formData);
        localStorage.setItem('token', res.data.access_token);
        setToken(res.data.access_token);
        navigate('/players');
      }
    } catch (err) {
      if (!err.response) {
        // 네트워크 오류 — 백엔드가 꺼져 있거나 연결 불가
        setMessage('❌ 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.');
      } else {
        setMessage(err.response.data?.detail || `❌ 서버 오류 (${err.response.status})`);
      }
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setMessage('');
  };

  return (
    <div className="card" style={{ maxWidth: '420px', margin: '0 auto', marginTop: '8vh' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {isRegister ? '회원가입' : '로그인'}
      </h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="아이디 (로그인용)"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {/* 회원가입 전용 추가 필드 */}
        {isRegister && (
          <>
            <input
              type="text"
              placeholder="이름 (실명)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
            <input
              type="text"
              placeholder="롤 아이디 (e.g. 초코타코#kr1)"
              value={lolId}
              onChange={e => setLolId(e.target.value)}
            />
          </>
        )}

        {message && (
          <div style={{ color: 'var(--accent)', marginBottom: '1rem', fontSize: '0.88rem' }}>
            {message}
          </div>
        )}

        <button type="submit" className="btn" style={{ width: '100%', marginBottom: '1rem' }}>
          {isRegister ? '가입 신청' : '로그인'}
        </button>
      </form>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={switchMode}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isRegister ? '이미 계정이 있으신가요? 로그인' : '계정 만들기'}
        </button>
      </div>
    </div>
  );
}
