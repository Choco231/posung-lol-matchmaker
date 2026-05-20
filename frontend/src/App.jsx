import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import PlayerManagement from './pages/PlayerManagement';
import TeamBuilder from './pages/TeamBuilder';
import RecordMatch from './pages/RecordMatch';
import VirtualDataEntry from './pages/VirtualDataEntry';
import Admin from './pages/Admin';
import DBViewer from './pages/DBViewer';
import Guide from './pages/Guide';
import DataManagement from './pages/DataManagement';

function App() {
  const [token, setToken]       = useState(localStorage.getItem('token'));
  const [userInfo, setUserInfo] = useState(null);
  const navigate  = useNavigate();
  const location  = useLocation();

  // Fetch current user info whenever token changes
  useEffect(() => {
    if (!token) {
      setUserInfo(null);
      return;
    }
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUserInfo(res.data))
      .catch(() => {
        // Token expired or invalid — force logout
        localStorage.removeItem('token');
        setToken(null);
        setUserInfo(null);
      });
  }, [token]);

  // Axios response interceptor to handle token expiration (401)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          setToken(null);
          setUserInfo(null);
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserInfo(null);
    navigate('/');
  };

  const navLink = (to, label) => (
    <Link to={to} className={`nav-link ${location.pathname === to ? 'active' : ''}`}>{label}</Link>
  );

  return (
    <div className="app-container">
      <div className="sidebar">
        <h1 style={{ marginBottom: '1.5rem' }}>호낳대<br/>LoL 스크림</h1>

        {/* --- 인증(로그인/로그아웃/유저정보) 영역 최상단 배치 --- */}
        {token ? (
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {userInfo && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px', border: '1px solid var(--border-color)',
                fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  {userInfo.display_name || userInfo.username}
                  {userInfo.is_admin && (
                    <span style={{
                      marginLeft: '0.4rem', fontSize: '0.68rem', fontWeight: 600,
                      padding: '0.1rem 0.4rem', borderRadius: '4px',
                      background: 'rgba(94,106,210,0.25)', color: 'var(--accent-hover)',
                    }}>관리자</span>
                  )}
                </div>
                {userInfo.lol_id && <div style={{ fontSize: '0.75rem' }}>{userInfo.lol_id}</div>}
              </div>
            )}
            <button
              className="btn"
              onClick={handleLogout}
              style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`}
            style={{ marginBottom: '1.5rem', justifyContent: 'center' }}
          >
            🔐 로그인 / 가입
          </Link>
        )}

        {/* --- 네비게이션 링크들 --- */}
        {navLink('/', '👑 랭킹')}
        {navLink('/guide', '📖 이용 가이드')}

        {token && (
          <>
            {navLink('/players',    '👥 선수 관리')}
            {navLink('/teambuilder','⚖️ 팀 짜기 (10인)')}
            {navLink('/record',     '⚔️ 실전 결과 기록')}
            {navLink('/virtual',    '🧪 가상 데이터 입력')}
            
            {/* 관리자 전용 메뉴 */}
            {userInfo?.is_admin && (
              <>
                {navLink('/admin',      '🛡️ 관리자 (가입승인)')}
                {navLink('/datamanage',   '🛠️ 데이터 관리')}
              </>
            )}
          </>
        )}
      </div>

      <div className="main-content">
        <Routes>
          <Route path="/"           element={<Leaderboard />} />
          <Route path="/guide"      element={<Guide />} />
          <Route path="/login"      element={<Login setToken={setToken} />} />
          <Route path="/players"    element={<PlayerManagement token={token} userInfo={userInfo} />} />
          <Route path="/teambuilder"element={<TeamBuilder token={token} />} />
          <Route path="/record"     element={<RecordMatch token={token} />} />
          <Route path="/virtual"    element={<VirtualDataEntry token={token} userInfo={userInfo} />} />
          <Route path="/admin"      element={userInfo?.is_admin ? <Admin token={token} userInfo={userInfo} /> : <Leaderboard />} />
          <Route path="/datamanage" element={userInfo?.is_admin ? <DataManagement token={token} /> : <Leaderboard />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
