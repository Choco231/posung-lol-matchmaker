import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function VirtualStats({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCoupon, setSelectedCoupon] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    axios.get('/api/virtual/stats', { headers })
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => () => {
    if (selectedCoupon?.url) URL.revokeObjectURL(selectedCoupon.url);
  }, [selectedCoupon]);

  const openCoupon = async (award) => {
    const res = await axios.get(award.coupon_url, { headers, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    setSelectedCoupon(previous => {
      if (previous?.url) URL.revokeObjectURL(previous.url);
      return { url, award };
    });
  };

  if (loading) return <div className="card">기록을 불러오는 중입니다...</div>;
  if (!token) return <div className="card">로그인 후 본인의 가상 데이터 기록을 확인할 수 있습니다.</div>;
  if (!stats) return <div className="card">가상 데이터 기록을 불러올 수 없습니다.</div>;

  const encouragement = stats.today_count >= stats.daily_limit
    ? '오늘 50건을 모두 채웠습니다. 자정 이후 다시 참여할 수 있습니다.'
    : `오늘 ${stats.remaining_today}건이 남았습니다. 아직 ${stats.daily_limit}건을 다 채우지 못해 아쉽습니다.`;

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
        <h2 style={{ margin: 0 }}>내 가상 데이터 기록</h2>
        <Link to="/virtual" className="btn" style={{ textDecoration: 'none', padding: '0.55rem 0.8rem' }}>입력 화면</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>오늘 입력</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-hover)' }}>{stats.today_count} / {stats.daily_limit}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>전체 입력</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total_count}건</div>
        </div>
      </div>

      <div className="card" style={{
        borderColor: stats.today_count >= stats.daily_limit ? 'rgba(76,175,80,0.45)' : 'rgba(251,191,36,0.42)',
        color: stats.today_count >= stats.daily_limit ? '#86efac' : '#fcd34d',
      }}>
        {encouragement}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '0.8rem' }}>날짜별 입력 수</h3>
        {stats.daily_counts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>아직 입력 기록이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {stats.daily_counts.map(day => (
              <div key={day.date} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0.5rem 0' }}>
                <span>{day.date}</span>
                <span style={{ fontWeight: 700, color: day.count >= stats.daily_limit ? '#86efac' : 'var(--text-primary)' }}>{day.count}건</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '0.8rem' }}>당첨 쿠폰</h3>
        {stats.awards.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>아직 당첨된 쿠폰이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {stats.awards.map(award => (
              <button key={award.match_id} className="btn" onClick={() => openCoupon(award)} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(94,106,210,0.2)', border: '1px solid var(--accent)' }}>
                <span>{award.created_at} KST</span>
                <span>{award.attempt_number ? `${award.attempt_number}번째 입력` : '쿠폰 보기'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCoupon && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.74)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSelectedCoupon(null)}>
          <div className="card" style={{ maxWidth: '430px', width: '100%', textAlign: 'center' }} onClick={event => event.stopPropagation()}>
            <h3 style={{ marginBottom: '0.8rem' }}>내 당첨 쿠폰</h3>
            <img src={selectedCoupon.url} alt="당첨 쿠폰" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px', marginBottom: '0.8rem' }} />
            <button className="btn" onClick={() => setSelectedCoupon(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
