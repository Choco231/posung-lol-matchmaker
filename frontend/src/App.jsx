import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import PlayerManagement from './pages/PlayerManagement';
import TeamBuilder from './pages/TeamBuilder';
import RecordMatch from './pages/RecordMatch';
import Admin from './pages/Admin';
import Guide from './pages/Guide';
import DataManagement from './pages/DataManagement';
import MatchResults from './pages/MatchResults';

function PcOnlyGuard({ children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <div className="card" style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        margin: '3rem auto 1.5rem auto',
        maxWidth: '400px',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
        background: 'var(--panel-bg)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.2rem' }}>🖥️</div>
        <h3 style={{ marginBottom: '0.8rem', fontSize: '1.25rem', fontWeight: 700 }}>PC 전용 기능 안내</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
          선수 등록, 팀 매칭 및 경기 기록 입력 등의 고정밀 작업은 화면이 넓은 PC 환경에 최적화되어 있습니다.<br/><br/>
          원활한 조작을 위해 데스크톱 환경에서 접속해 주세요.
        </p>
      </div>
    );
  }
  return children;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userInfo, setUserInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!token) {
      setUserInfo(null);
      return;
    }
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUserInfo(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUserInfo(null);
      });
  }, [token]);

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
      {isMobile && (
        <div className="mobile-header">
          <span className="mobile-logo" onClick={() => navigate('/')}>호령회 LOL 스크림</span>
          {token && userInfo && (
            <span className="mobile-user-badge">
              👤 {userInfo.display_name || userInfo.username}
            </span>
          )}
        </div>
      )}

      {!isMobile && (
        <div className="sidebar">
          <h1 style={{ marginBottom: '1.5rem' }}>호령회<br/>LOL 스크림</h1>

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

          {navLink('/', '👑 랭킹')}
          {navLink('/results', '⚔️ 내전 결과')}
          {navLink('/guide', '📖 이용 가이드')}

          {token && (
            <>
              {navLink('/players', '👥 선수 추가')}
              {navLink('/teambuilder', '⚖️ 팀 짜기 (10인)')}
              {navLink('/record', '⚔️ 실전 결과 기록')}

              {userInfo?.is_admin && (
                <>
                  {navLink('/admin', '🛡️ 관리자 (가입승인)')}
                  {navLink('/datamanage', '🛠️ 데이터 관리')}
                </>
              )}
            </>
          )}
        </div>
      )}

      {isMobile && (
        <div className="bottom-nav">
          <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
            <span className="bottom-nav-icon">👑</span>
            <span className="bottom-nav-label">랭킹</span>
          </Link>
          <Link to="/guide" className={`bottom-nav-item ${location.pathname === '/guide' ? 'active' : ''}`}>
            <span className="bottom-nav-icon">📖</span>
            <span className="bottom-nav-label">가이드</span>
          </Link>
          <Link to="/results" className={`bottom-nav-item ${location.pathname === '/results' ? 'active' : ''}`}>
            <span className="bottom-nav-icon">⚔️</span>
            <span className="bottom-nav-label">결과</span>
          </Link>
          {token ? (
            <>
              <div className="bottom-nav-item" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                <span className="bottom-nav-icon">↩</span>
                <span className="bottom-nav-label">로그아웃</span>
              </div>
            </>
          ) : (
            <Link to="/login" className={`bottom-nav-item ${location.pathname === '/login' ? 'active' : ''}`}>
              <span className="bottom-nav-icon">🔐</span>
              <span className="bottom-nav-label">로그인</span>
            </Link>
          )}
        </div>
      )}

      <div className="main-content">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/results" element={<MatchResults />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/login" element={<Login setToken={setToken} />} />
          <Route path="/players" element={<PcOnlyGuard><PlayerManagement token={token} userInfo={userInfo} /></PcOnlyGuard>} />
          <Route path="/teambuilder" element={<PcOnlyGuard><TeamBuilder token={token} /></PcOnlyGuard>} />
          <Route path="/record" element={<PcOnlyGuard><RecordMatch token={token} /></PcOnlyGuard>} />
          <Route path="/admin" element={<PcOnlyGuard>{userInfo?.is_admin ? <Admin token={token} userInfo={userInfo} /> : <Leaderboard />}</PcOnlyGuard>} />
          <Route path="/datamanage" element={<PcOnlyGuard>{userInfo?.is_admin ? <DataManagement token={token} /> : <Leaderboard />}</PcOnlyGuard>} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
