import { useState, useEffect } from 'react';
import axios from 'axios';

const POSITIONS = ['top', 'jungle', 'mid', 'adc', 'support'];
const POS_LABELS = { top: '탑', jungle: '정글', mid: '미드', adc: '원딜', support: '서포터' };

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getWeight(player, position) {
  try {
    const imp = JSON.parse(player.impossible_positions || '[]');
    if (imp.includes(position)) return 0;
    
    const pref = JSON.parse(player.preferred_positions || '[]');
    if (pref.includes(position)) return 2.0;

    // 선호, 불가에 해당하지 않는 모든 포지션은 기본적으로 비선호(0.7) 처리
    return 0.7;
  } catch { return 0.7; }
}

function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  const perms = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of getPermutations(rest)) {
      perms.push([arr[i]].concat(p));
    }
  }
  return perms;
}

function tryAssignWeighted(players5) {
  const perms = getPermutations([0, 1, 2, 3, 4]);
  const weightedPerms = [];
  let totalWeight = 0;

  for (const p of perms) {
    let score = 1.0;
    for (let posIdx = 0; posIdx < 5; posIdx++) {
      const pIdx = p[posIdx];
      score *= getWeight(players5[pIdx], POSITIONS[posIdx]);
    }
    if (score > 0) {
      weightedPerms.push({ p, score });
      totalWeight += score;
    }
  }

  if (totalWeight === 0) return null;

  let rand = Math.random() * totalWeight;
  let selectedP = null;
  for (const wp of weightedPerms) {
    rand -= wp.score;
    if (rand <= 0) {
      selectedP = wp.p;
      break;
    }
  }
  if (!selectedP) selectedP = weightedPerms[weightedPerms.length - 1].p;

  const result = {};
  selectedP.forEach((pIdx, posIdx) => {
    result[POSITIONS[posIdx]] = String(players5[pIdx].id);
  });
  return result;
}

export default function VirtualDataEntry({ token, userInfo }) {
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });
  const [teamB, setTeamB] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });
  const [activeSlot, setActiveSlot] = useState(null); // e.g., { team: 'A', pos: 'top' }

  useEffect(() => {
    axios.get('/api/players').then(res => {
      const cleanLolId = (id) => {
        if (!id) return '';
        return id.replace(/\s+/g, '').toLowerCase();
      };

      const getLolIdFromPlayerName = (name) => {
        if (!name) return '';
        const parts = name.split('/');
        if (parts.length > 1) {
          return parts[parts.length - 1];
        }
        return '';
      };

      const filtered = res.data.filter(p => {
        const myLolId = cleanLolId(userInfo?.lol_id);
        const pLolId = cleanLolId(getLolIdFromPlayerName(p.name));

        // 1. 롤 아이디가 지정되어 있고 서로 일치하면 본인으로 취급하여 제외
        if (myLolId && pLolId && myLolId === pLolId) {
          return false;
        }

        if (cleanLolId(p.name) === '본인') {
          return false;
        }

        return true;
      });
      setPlayers(filtered);
    });
  }, [userInfo]);

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
        is_virtual: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // alert 삭제하고 바로 다음 랜덤 배치 수행
      handleRandomize();
    } catch (err) {
      alert('오류 발생: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRandomize = () => {
    if (players.length < 10) {
      alert('선수가 10명 미만입니다.');
      return;
    }

    for (let attempt = 0; attempt < 200; attempt++) {
      const picked = shuffle(players).slice(0, 10);
      const half  = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const idxA  = half.slice(0, 5).map(i => picked[i]);
      const idxB  = half.slice(5, 10).map(i => picked[i]);

      const assignA = tryAssignWeighted(idxA);
      const assignB = tryAssignWeighted(idxB);

      if (assignA && assignB) {
        setTeamA(assignA);
        setTeamB(assignB);
        setActiveSlot(null);
        return;
      }
    }
    alert('불가능 포지션 제약으로 랜덤 배치를 찾지 못했습니다.');
  };

  const handleSlotClick = (team, pos) => {
    if (activeSlot?.team === team && activeSlot?.pos === pos) {
      setActiveSlot(null); // toggle off
    } else {
      setActiveSlot({ team, pos });
    }
  };

  const handlePlayerClick = (p) => {
    if (!activeSlot) return; // 선택된 슬롯이 없으면 무시

    const { team, pos } = activeSlot;
    if (getWeight(p, pos) === 0) return; // 불가 포지션이면 무시

    // 이미 다른 슬롯에 배치되어 있다면 해당 슬롯에서 제거 (Swap 로직 대신 단순 이동)
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

    // 자동 다음 슬롯 선택 편의
    const nextPos = POSITIONS[POSITIONS.indexOf(pos) + 1];
    if (nextPos) {
      setActiveSlot({ team, pos: nextPos });
    } else if (team === 'A') {
      setActiveSlot({ team: 'B', pos: 'top' });
    } else {
      setActiveSlot(null);
    }
  };

  // 선수가 현재 어느 팀/포지션에 배정되어 있는지 확인
  const getAssignedInfo = (pId) => {
    for (const pos of POSITIONS) {
      if (teamA[pos] === String(pId)) return { team: 'A', pos };
      if (teamB[pos] === String(pId)) return { team: 'B', pos };
    }
    return null;
  };

  const getPlayerById = (id) => players.find(p => String(p.id) === String(id));

  // --- Styles ---
  const slotStyle = (team, pos) => {
    const isActive = activeSlot?.team === team && activeSlot?.pos === pos;
    const isAssigned = (team === 'A' ? teamA[pos] : teamB[pos]) !== '';
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
    const cantPlay = activeSlot && getWeight(p, activeSlot.pos) === 0;
    
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
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🧪 가상 데이터 입력 모드</h2>
        <button className="btn" onClick={handleRandomize} style={{ background: 'rgba(94,106,210,0.3)', border: '1px solid var(--accent)' }}>
          🎲 랜덤 배치
        </button>
      </div>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        슬롯을 클릭한 뒤, 아래의 선수 목록에서 선수를 골라 배정하세요. (본인은 제외됨)
      </p>

      {/* 배정 슬롯 영역 */}
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
            🔵 A팀 승리 기록
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
            🔴 B팀 승리 기록
          </button>
        </div>
      </div>

      {/* 선수 선택 영역 */}
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
