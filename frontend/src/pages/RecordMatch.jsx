import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const POSITIONS = ['top', 'jungle', 'mid', 'adc', 'support'];
const POS_LABELS = { top: '탑', jungle: '정글', mid: '미드', adc: '원딜', support: '서포터' };

function canPlay(player, position) {
  try {
    const imp = JSON.parse(player.impossible_positions || '[]');
    return !imp.includes(position);
  } catch { return true; }
}

export default function RecordMatch({ token }) {
  const location = useLocation();
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });
  const [teamB, setTeamB] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });
  const [activeSlot, setActiveSlot] = useState(null);
  const [mmrModalData, setMmrModalData] = useState(null);

  const getTeamAvgMmr = (assign) => {
    let sum = 0;
    let count = 0;
    POSITIONS.forEach(pos => {
      const pId = assign[pos];
      const player = players.find(p => String(p.id) === String(pId));
      if (player) {
        if (pos === 'top') sum += player.top_mu;
        else if (pos === 'jungle') sum += player.jungle_mu;
        else if (pos === 'mid') sum += player.mid_mu;
        else if (pos === 'adc') sum += player.adc_mu;
        else if (pos === 'support') sum += player.support_mu;
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  };

  useEffect(() => {
    // 실전에서는 본인도 출전할 수 있으므로 필터링하지 않음
    axios.get('/api/players').then(res => setPlayers(res.data));
  }, []);

  // location.state로 넘어온 presetMatchup이 있을 시 폼에 주입
  useEffect(() => {
    if (location.state?.presetMatchup) {
      const pm = location.state.presetMatchup;
      setTeamA({
        top: String(pm.team_a.top),
        jungle: String(pm.team_a.jungle),
        mid: String(pm.team_a.mid),
        adc: String(pm.team_a.adc),
        support: String(pm.team_a.support)
      });
      setTeamB({
        top: String(pm.team_b.top),
        jungle: String(pm.team_b.jungle),
        mid: String(pm.team_b.mid),
        adc: String(pm.team_b.adc),
        support: String(pm.team_b.support)
      });
    }
  }, [location.state]);

  const handleSubmit = async (winner) => {
    const aIds = POSITIONS.map(p => teamA[p]);
    const bIds = POSITIONS.map(p => teamB[p]);

    if (aIds.includes('') || bIds.includes('')) {
      alert('모든 포지션을 배정해주세요.');
      return;
    }

    try {
      const res = await axios.post('/api/matches', {
        team_a_ids: aIds.map(Number),
        team_b_ids: bIds.map(Number),
        winner,
        is_virtual: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 백엔드로부터 받은 MMR 변화량을 커스텀 모달에 주입
      if (res.data && res.data.mmr_changes) {
        setMmrModalData({ winner, changes: res.data.mmr_changes });
      } else {
        alert(`🏆 [실전 기록] ${winner === 'A' ? '블루' : '레드'}팀 승리 결과가 반영되었습니다!`);
      }
      
      setActiveSlot(null);
    } catch (err) {
      alert('오류 발생: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSwapTeams = () => {
    const temp = { ...teamA };
    setTeamA(teamB);
    setTeamB(temp);
  };

  const handleSlotClick = (team, pos) => {
    if (activeSlot?.team === team && activeSlot?.pos === pos) {
      setActiveSlot(null);
    } else {
      setActiveSlot({ team, pos });
    }
  };

  const handlePlayerClick = (p) => {
    if (!activeSlot) return;

    const { team, pos } = activeSlot;
    if (!canPlay(p, pos)) return;

    const newTeamA = { ...teamA };
    const newTeamB = { ...teamB };
    
    POSITIONS.forEach(ps => {
      if (newTeamA[ps] === String(p.id)) newTeamA[ps] = '';
      if (newTeamB[ps] === String(p.id)) newTeamB[ps] = '';
    });

    if (team === 'A') newTeamA[pos] = String(p.id);
    else newTeamB[pos] = String(p.id);

    setTeamA(newTeamA);
    setTeamB(newTeamB);

    const nextPos = POSITIONS[POSITIONS.indexOf(pos) + 1];
    if (nextPos) {
      setActiveSlot({ team, pos: nextPos });
    } else if (team === 'A') {
      setActiveSlot({ team: 'B', pos: 'top' });
    } else {
      setActiveSlot(null);
    }
  };

  const getAssignedInfo = (pId) => {
    for (const pos of POSITIONS) {
      if (teamA[pos] === String(pId)) return { team: 'A', pos };
      if (teamB[pos] === String(pId)) return { team: 'B', pos };
    }
    return null;
  };

  const getPlayerById = (id) => players.find(p => String(p.id) === String(id));

  const slotStyle = (team, pos) => {
    const isActive = activeSlot?.team === team && activeSlot?.pos === pos;
    return {
      padding: '0.8rem',
      borderRadius: '8px',
      border: isActive ? `2px solid ${team === 'A' ? '#3b82f6' : '#ef4444'}` : '1px solid var(--border-color)',
      background: isActive ? (team === 'A' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--panel-bg)',
      cursor: 'pointer',
      marginBottom: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: isActive ? '0 0 0 3px rgba(255,255,255,0.05)' : 'none',
      transition: 'all 0.15s',
    };
  };

  const chipStyle = (p) => {
    const assigned = getAssignedInfo(p.id);
    const cantPlay = activeSlot && !canPlay(p, activeSlot.pos);
    
    let bg = 'var(--panel-bg)';
    let color = 'var(--text-primary)';
    let border = '1px solid var(--border-color)';
    let opacity = 1;

    if (assigned) {
      bg = assigned.team === 'A' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)';
      border = assigned.team === 'A' ? '1px solid #3b82f6' : '1px solid #ef4444';
    } else if (cantPlay) {
      opacity = 0.4;
      bg = 'rgba(255,255,255,0.02)';
    }

    return {
      padding: '0.6rem 1rem',
      borderRadius: '20px',
      background: bg,
      color: color,
      border: border,
      opacity: opacity,
      cursor: cantPlay ? 'not-allowed' : 'pointer',
      fontSize: '0.9rem',
      fontWeight: assigned ? 600 : 400,
      userSelect: 'none',
      transition: 'all 0.1s',
    };
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>⚔️ 실전 결과 기록</h2>
        <button 
          className="btn" 
          onClick={handleSwapTeams} 
          style={{ 
            background: 'rgba(255,255,255,0.06)', 
            border: '1px solid var(--border-color)', 
            fontSize: '0.82rem',
            padding: '0.4rem 0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            cursor: 'pointer'
          }}
        >
          🔄 블루/레드 진영 교환
        </button>
      </div>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        슬롯을 클릭한 뒤 아래 선수 목록에서 배정하세요. 배정이 끝나면 승리팀 버튼을 누릅니다.
      </p>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#3b82f6', marginBottom: '0.2rem', textAlign: 'center' }}>🔵 Blue Team</h3>
          <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            평균 MMR: {getTeamAvgMmr(teamA).toFixed(1)}
          </div>
          {POSITIONS.map(pos => {
            const pId = teamA[pos];
            const p = getPlayerById(pId);
            return (
              <div key={`A_${pos}`} style={slotStyle('A', pos)} onClick={() => handleSlotClick('A', pos)}>
                <span style={{ width: '4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{POS_LABELS[pos]}</span>
                <span style={{ fontWeight: p ? 700 : 400, color: p ? '#3b82f6' : 'var(--text-secondary)' }}>
                  {p ? `${p.name} (${p[`${pos}_mu`].toFixed(1)})` : '선택...'}
                </span>
              </div>
            );
          })}
          <button className="btn" style={{ width: '100%', background: '#3b82f6', marginTop: '1rem' }} onClick={() => handleSubmit('A')}>
            🔵 A팀(블루) 승리
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#ef4444', marginBottom: '0.2rem', textAlign: 'center' }}>🔴 Red Team</h3>
          <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            평균 MMR: {getTeamAvgMmr(teamB).toFixed(1)}
          </div>
          {POSITIONS.map(pos => {
            const pId = teamB[pos];
            const p = getPlayerById(pId);
            return (
              <div key={`B_${pos}`} style={slotStyle('B', pos)} onClick={() => handleSlotClick('B', pos)}>
                <span style={{ width: '4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{POS_LABELS[pos]}</span>
                <span style={{ fontWeight: p ? 700 : 400, color: p ? '#ef4444' : 'var(--text-secondary)' }}>
                  {p ? `${p.name} (${p[`${pos}_mu`].toFixed(1)})` : '선택...'}
                </span>
              </div>
            );
          })}
          <button className="btn" style={{ width: '100%', background: '#ef4444', marginTop: '1rem' }} onClick={() => handleSubmit('B')}>
            🔴 B팀(레드) 승리
          </button>
        </div>
      </div>

      <div style={{
        padding: '1.5rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)'
      }}>
        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>
          {activeSlot ? `👇 [${activeSlot.team === 'A' ? 'Blue' : 'Red'} ${POS_LABELS[activeSlot.pos]}] 배치할 선수 선택` : '클릭해서 선택할 슬롯을 먼저 지정하세요'}
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {players.map(p => (
            <div
              key={p.id}
              style={chipStyle(p)}
              onClick={() => handlePlayerClick(p)}
            >
              {p.name}
              {activeSlot && ` (${p[`${activeSlot.pos}_mu`].toFixed(1)})`}
              {getAssignedInfo(p.id) && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', opacity: 0.7 }}>
                ({getAssignedInfo(p.id).team})
              </span>}
            </div>
          ))}
          {players.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>배정할 수 있는 선수가 없습니다.</span>}
        </div>
      </div>

      {/* MMR 변동 상세 커스텀 모달 */}
      {mmrModalData && (
        <>
          {/* 뒷배경 오버레이 */}
          <div 
            onClick={() => setMmrModalData(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999
            }}
          />
          {/* 모달 윈도우 */}
          <div 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '95%',
              maxWidth: '760px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              padding: '2rem',
              zIndex: 10000,
              color: '#f9fafb'
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 실전 매치 결과 기록 완료
              </h2>
              <button 
                onClick={() => setMmrModalData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            {/* 승리 팀 알림 안내 */}
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              borderRadius: '10px',
              background: mmrModalData.winner === 'A' 
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1.25rem',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              boxShadow: mmrModalData.winner === 'A'
                ? '0 4px 15px rgba(37, 99, 235, 0.4)'
                : '0 4px 15px rgba(220, 38, 38, 0.4)',
              marginBottom: '1.8rem',
              letterSpacing: '0.5px'
            }}>
              🎉 {mmrModalData.winner === 'A' ? '🔵 Blue Team (블루팀)' : '🔴 Red Team (레드팀)'} 승리!
            </div>

            {/* 블루/레드 상하단으로 분리하여 표시 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* 블루 팀 변동 내역 */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '1.2rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h3 style={{ color: '#60a5fa', margin: '0 0 0.8rem 0', fontSize: '1.05rem', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '0.4rem' }}>
                  🔵 Blue Team MMR 변동
                </h3>
                {mmrModalData.changes.filter(c => c.team === 'A').map(c => {
                  const isUp = c.diff > 0;
                  const diffColor = isUp ? '#60a5fa' : c.diff < 0 ? '#f87171' : '#94a3b8';
                  const sign = isUp ? '+' : '';
                  return (
                    <div key={c.player_name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                      <span style={{ color: '#d1d5db' }}>
                        <strong style={{ color: '#9ca3af', marginRight: '0.4rem', fontSize: '0.78rem' }}>{POS_LABELS[c.position]}</strong>
                        {c.player_name}
                      </span>
                      <span>
                        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{c.prev_mmr.toFixed(1)} → {c.new_mmr.toFixed(1)}</span>
                        <strong style={{ marginLeft: '0.5rem', color: diffColor }}>({sign}{c.diff.toFixed(1)})</strong>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 레드 팀 변동 내역 */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '1.2rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ color: '#f87171', margin: '0 0 0.8rem 0', fontSize: '1.05rem', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.4rem' }}>
                  🔴 Red Team MMR 변동
                </h3>
                {mmrModalData.changes.filter(c => c.team === 'B').map(c => {
                  const isUp = c.diff > 0;
                  const diffColor = isUp ? '#60a5fa' : c.diff < 0 ? '#f87171' : '#94a3b8';
                  const sign = isUp ? '+' : '';
                  return (
                    <div key={c.player_name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                      <span style={{ color: '#d1d5db' }}>
                        <strong style={{ color: '#9ca3af', marginRight: '0.4rem', fontSize: '0.78rem' }}>{POS_LABELS[c.position]}</strong>
                        {c.player_name}
                      </span>
                      <span>
                        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{c.prev_mmr.toFixed(1)} → {c.new_mmr.toFixed(1)}</span>
                        <strong style={{ marginLeft: '0.5rem', color: diffColor }}>({sign}{c.diff.toFixed(1)})</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 하단 닫기 단추 */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                onClick={() => setMmrModalData(null)}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: '0.6rem 1.5rem',
                  fontSize: '0.92rem',
                  fontWeight: 600
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
