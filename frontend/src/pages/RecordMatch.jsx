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
      await axios.post('/api/matches', {
        team_a_ids: aIds.map(Number),
        team_b_ids: bIds.map(Number),
        winner,
        is_virtual: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`[실전 기록] ${winner === 'A' ? '블루' : '레드'}팀 승리 결과가 반영되었습니다! 랭킹 페이지를 확인하세요.`);
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
          <h3 style={{ color: '#3b82f6', marginBottom: '1rem', textAlign: 'center' }}>🔵 Blue Team</h3>
          {POSITIONS.map(pos => {
            const pId = teamA[pos];
            const p = getPlayerById(pId);
            return (
              <div key={`A_${pos}`} style={slotStyle('A', pos)} onClick={() => handleSlotClick('A', pos)}>
                <span style={{ width: '4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{POS_LABELS[pos]}</span>
                <span style={{ fontWeight: p ? 700 : 400, color: p ? '#3b82f6' : 'var(--text-secondary)' }}>
                  {p ? p.name : '선택...'}
                </span>
              </div>
            );
          })}
          <button className="btn" style={{ width: '100%', background: '#3b82f6', marginTop: '1rem' }} onClick={() => handleSubmit('A')}>
            🔵 A팀(블루) 승리
          </button>
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>🔴 Red Team</h3>
          {POSITIONS.map(pos => {
            const pId = teamB[pos];
            const p = getPlayerById(pId);
            return (
              <div key={`B_${pos}`} style={slotStyle('B', pos)} onClick={() => handleSlotClick('B', pos)}>
                <span style={{ width: '4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{POS_LABELS[pos]}</span>
                <span style={{ fontWeight: p ? 700 : 400, color: p ? '#ef4444' : 'var(--text-secondary)' }}>
                  {p ? p.name : '선택...'}
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
              {getAssignedInfo(p.id) && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', opacity: 0.7 }}>
                ({getAssignedInfo(p.id).team})
              </span>}
            </div>
          ))}
          {players.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>배정할 수 있는 선수가 없습니다.</span>}
        </div>
      </div>
    </div>
  );
}
