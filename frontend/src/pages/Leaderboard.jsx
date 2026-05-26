import { useState, useEffect } from 'react';
import axios from 'axios';

const COLUMNS = [
  { key: 'avg',     label: '평균 MMR' },
  { key: 'top',     label: 'Top' },
  { key: 'jungle',  label: 'Jungle' },
  { key: 'mid',     label: 'Mid' },
  { key: 'adc',     label: 'ADC' },
  { key: 'support', label: 'Support' },
];

const getAvg = (p) => {
  let total = 0;
  let count = 0;
  let imp = [];
  try {
    imp = JSON.parse(p.impossible_positions || '[]');
  } catch {}

  const positions = ['top', 'jungle', 'mid', 'adc', 'support'];
  for (const pos of positions) {
    if (!imp.includes(pos)) {
      total += p[`${pos}_mu`];
      count += 1;
    }
  }
  
  return count > 0 ? total / count : 0;
};

const getMu = (p, key) => {
  if (key === 'avg') return getAvg(p);
  try {
    const imp = JSON.parse(p.impossible_positions || '[]');
    if (imp.includes(key)) return -999; // 정렬 시 불가 포지션은 가장 아래로
  } catch {}
  return p[`${key}_mu`];
};

export default function Leaderboard() {
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sortKey, setSortKey]   = useState('avg');   // default: avg
  const [sortAsc, setSortAsc]   = useState(false);   // default: desc (high first)

  useEffect(() => {
    axios.get('/api/players')
      .then(res  => { setPlayers(res.data.filter(player => !player.is_guest)); setLoading(false); })
      .catch(err => { console.error(err);   setLoading(false); });
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);   // toggle direction
    } else {
      setSortKey(key);
      setSortAsc(false);      // new column → descending first
    }
  };

  const sorted = [...players].sort((a, b) => {
    const diff = getMu(b, sortKey) - getMu(a, sortKey);
    return sortAsc ? -diff : diff;
  });

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <span style={{ opacity: 0.25, marginLeft: '0.3rem' }}>↕</span>;
    return <span style={{ marginLeft: '0.3rem', color: 'var(--accent-hover)' }}>{sortAsc ? '↑' : '↓'}</span>;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <h2>👑 전체 랭킹 (MMR)</h2>
      <p style={{ marginBottom: '1.2rem', color: 'var(--text-secondary)' }}>
        승패 결과에 따라 TrueSkill™ 알고리즘이 계산한 실력 점수입니다. 평균 50점(0~100점 범위)에서 시작합니다.
        <br />
        <span style={{ fontSize: '0.8rem' }}>컬럼 헤더를 클릭하면 해당 포지션 기준으로 정렬됩니다.</span>
      </p>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '3rem' }}>순위</th>
              <th>이름</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortKey === col.key ? 'var(--accent-hover)' : 'var(--text-secondary)',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  title={`${col.label} 기준으로 정렬`}
                >
                  {col.label}
                  <SortIcon colKey={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const avg = getAvg(p);
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 'bold', color: idx < 3 ? 'var(--accent)' : 'inherit', textAlign: 'center' }}>
                    {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                  {/* 평균 MMR */}
                  <td style={{
                    fontWeight: 'bold',
                    color: 'var(--win-color)',
                    background: sortKey === 'avg' ? 'rgba(94,106,210,0.07)' : 'transparent',
                  }}>
                    {avg.toFixed(1)}
                  </td>
                  {/* 포지션별 */}
                  {['top','jungle','mid','adc','support'].map(pos => {
                    let isImp = false;
                    try {
                      const imp = JSON.parse(p.impossible_positions || '[]');
                      isImp = imp.includes(pos);
                    } catch {}
                    
                    return (
                      <td
                        key={pos}
                        style={{
                          background: sortKey === pos ? 'rgba(94,106,210,0.07)' : 'transparent',
                          color: sortKey === pos ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: sortKey === pos ? 600 : 400,
                          textAlign: 'center',
                        }}
                      >
                        {isImp ? <span style={{color: 'rgba(255,255,255,0.1)'}}>-</span> : p[`${pos}_mu`].toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
