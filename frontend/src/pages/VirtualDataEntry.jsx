import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [usage, setUsage] = useState(null);
  const [reward, setReward] = useState(null);
  const [couponImageUrl, setCouponImageUrl] = useState(null);
  const [missToast, setMissToast] = useState(null);
  const randomizeTimeoutRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchUsage = async () => {
    if (!token) return;
    const res = await axios.get('/api/virtual/stats', { headers: authHeaders });
    setUsage(res.data);
  };

  const fetchCouponImage = async (matchId) => {
    const res = await axios.get(`/api/virtual/coupons/${matchId}`, {
      headers: authHeaders,
      responseType: 'blob',
    });
    const objectUrl = URL.createObjectURL(res.data);
    setCouponImageUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return objectUrl;
    });
  };

  const showRewardPreview = async () => {
    try {
      const res = await axios.get('/api/admin/virtual/coupon-preview', {
        headers: authHeaders,
        responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(res.data);
      setCouponImageUrl(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return objectUrl;
      });
      setReward({ won: true, preview: true, today_count: usage?.today_count || 1 });
    } catch (err) {
      alert('미리보기를 불러오지 못했습니다: ' + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    fetchUsage().catch(() => {});
  }, [token]);

  useEffect(() => () => {
    if (couponImageUrl) URL.revokeObjectURL(couponImageUrl);
  }, [couponImageUrl]);

  useEffect(() => () => {
    if (randomizeTimeoutRef.current) clearTimeout(randomizeTimeoutRef.current);
  }, []);

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
        if (p.is_guest) {
          return false;
        }

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
      const res = await axios.post('/api/matches', {
        team_a_ids: aIds.map(Number),
        team_b_ids: bIds.map(Number),
        winner,
        is_virtual: true
      }, {
        headers: authHeaders
      });
      const virtualReward = res.data.virtual_reward;
      if (virtualReward) {
        if (virtualReward.won) {
          if (randomizeTimeoutRef.current) {
            clearTimeout(randomizeTimeoutRef.current);
            randomizeTimeoutRef.current = null;
          }
          setMissToast(null);
          setReward(virtualReward);
          fetchCouponImage(virtualReward.coupon_match_id).catch(() => setCouponImageUrl(null));
        } else {
          setReward(null);
          setMissToast({ todayCount: virtualReward.today_count });
          setCouponImageUrl(previous => {
            if (previous) URL.revokeObjectURL(previous);
            return null;
          });
          if (randomizeTimeoutRef.current) clearTimeout(randomizeTimeoutRef.current);
          randomizeTimeoutRef.current = setTimeout(() => {
            setMissToast(null);
            handleRandomize();
          }, 900);
        }
      } else {
        handleRandomize();
      }
      fetchUsage().catch(() => {});
    } catch (err) {
      if (err.response?.status === 429) {
        fetchUsage().catch(() => {});
      }
      alert('오류 발생: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRandomize = () => {
    if (randomizeTimeoutRef.current) {
      clearTimeout(randomizeTimeoutRef.current);
      randomizeTimeoutRef.current = null;
    }
    setMissToast(null);

    if (players.length < 10) {
      alert('선수가 10명 미만입니다.');
      return;
    }

    const MAX_MMR_DIFF = 1.0; // 허용되는 최대 양 팀 평균 MMR 격차 (1점)

    for (let attempt = 0; attempt < 2000; attempt++) {
      const picked = shuffle(players).slice(0, 10);
      const half  = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const idxA  = half.slice(0, 5).map(i => picked[i]);
      const idxB  = half.slice(5, 10).map(i => picked[i]);

      const assignA = tryAssignWeighted(idxA);
      const assignB = tryAssignWeighted(idxB);

      if (assignA && assignB) {
        const avgA = getTeamAvgMmr(assignA);
        const avgB = getTeamAvgMmr(assignB);
        const diff = Math.abs(avgA - avgB);

        // 양 팀 평균 MMR 격차가 1점 이하인 경우에만 매칭 확정
        if (diff <= MAX_MMR_DIFF) {
          setTeamA(assignA);
          setTeamB(assignB);
          setActiveSlot(null);
          return;
        }
      }
    }
    alert(`양 팀 평균 MMR 격차 1점 이내의 가상 배치를 찾지 못했습니다. (선수들의 불가능 포지션 제한이 너무 많을 때 발생 가능)`);
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

  const getPlayerLabel = (player) => {
    if (!player) return { displayName: '', lolId: '' };
    const slashIndex = player.name.indexOf('/');
    if (slashIndex < 0) return { displayName: player.name.trim(), lolId: '' };
    return {
      displayName: player.name.slice(0, slashIndex).trim(),
      lolId: player.name.slice(slashIndex + 1).trim(),
    };
  };

  // --- Styles ---
  const slotStyle = (team, pos) => {
    const isActive = !isMobile && activeSlot?.team === team && activeSlot?.pos === pos;
    const isAssigned = (team === 'A' ? teamA[pos] : teamB[pos]) !== '';
    return {
      padding: isMobile ? '0.28rem 0.35rem' : '0.8rem',
      borderRadius: '8px',
      border: isActive ? `2px solid ${team === 'A' ? '#3b82f6' : '#ef4444'}` : '1px solid var(--border-color)',
      background: isActive ? (team === 'A' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--panel-bg)',
      cursor: isMobile ? 'default' : 'pointer',
      marginBottom: isMobile ? '0.22rem' : '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: isMobile ? '39px' : undefined,
      minWidth: 0,
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
  const inputDisabled = usage?.remaining_today === 0 || Boolean(missToast) || Boolean(reward);

  return (
    <div className="card" style={{ padding: isMobile ? '0.6rem' : '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? '0.35rem' : '1rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? '0.92rem' : undefined }}>🧪 가상 데이터 입력 모드</h2>
        <button disabled={inputDisabled} className="btn" onClick={handleRandomize} style={{ background: 'rgba(94,106,210,0.3)', border: '1px solid var(--accent)', opacity: inputDisabled ? 0.45 : 1, padding: isMobile ? '0.38rem 0.48rem' : undefined, fontSize: isMobile ? '0.7rem' : undefined, whiteSpace: 'nowrap' }}>
          🎲 랜덤 배치
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: isMobile ? '0.45rem' : '1rem', fontSize: isMobile ? '0.68rem' : '0.86rem' }}>
        <span style={{ color: usage?.remaining_today === 0 ? '#f87171' : 'var(--text-secondary)', fontWeight: 600 }}>
          오늘 입력 {usage ? `${usage.today_count} / ${usage.daily_limit}` : '조회 중...'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.7rem' }}>
          {userInfo?.is_admin && (
            <button className="btn" disabled={inputDisabled} onClick={showRewardPreview} style={{
              padding: isMobile ? '0.28rem 0.38rem' : '0.35rem 0.6rem',
              fontSize: isMobile ? '0.62rem' : '0.78rem',
              opacity: inputDisabled ? 0.45 : 1,
              color: '#ffe24f',
              border: '1px solid rgba(255,211,65,0.45)',
              background: 'rgba(255,184,0,0.1)',
              whiteSpace: 'nowrap',
            }}>
              당첨 효과 보기
            </button>
          )}
          <Link to="/virtual-stats" style={{ color: 'var(--accent-hover)', textDecoration: 'none', whiteSpace: 'nowrap' }}>내 기록 보기</Link>
        </div>
      </div>
      <p style={{ display: isMobile ? 'none' : undefined, marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        슬롯을 클릭한 뒤, 아래의 선수 목록에서 선수를 골라 배정하세요. (본인은 제외됨)
      </p>

      {/* 배정 슬롯 영역 */}
      <div style={{ display: 'flex', gap: isMobile ? '0.4rem' : '2rem', marginBottom: isMobile ? '0.75rem' : '2.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ color: '#3b82f6', marginBottom: '0.2rem', textAlign: 'center', fontSize: isMobile ? '0.78rem' : undefined, whiteSpace: 'nowrap' }}>🔵 Blue Team</h3>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '0.35rem' : '1rem', fontSize: isMobile ? '0.64rem' : '0.9rem', color: 'var(--text-secondary)' }}>
            평균 MMR: {getTeamAvgMmr(teamA).toFixed(1)}
          </div>
          {POSITIONS.map(pos => {
            const pId = teamA[pos];
            const p = getPlayerById(pId);
            const playerLabel = getPlayerLabel(p);
            return (
              <div key={`A_${pos}`} style={slotStyle('A', pos)} onClick={isMobile ? undefined : () => handleSlotClick('A', pos)}>
                <span style={{ width: isMobile ? '1.8rem' : '4rem', flexShrink: 0, color: 'var(--text-secondary)', fontSize: isMobile ? '0.61rem' : '0.85rem' }}>{POS_LABELS[pos]}</span>
                {isMobile && p ? (
                  <span style={{ minWidth: 0, flex: 1, textAlign: 'right', lineHeight: 1.15 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: '#3b82f6', fontSize: '0.66rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerLabel.lolId || playerLabel.displayName}</span>
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.57rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerLabel.lolId ? `${playerLabel.displayName} · ` : ''}MMR {p[`${pos}_mu`].toFixed(1)}</span>
                  </span>
                ) : (
                  <span style={{ fontWeight: p ? 700 : 400, color: p ? '#3b82f6' : 'var(--text-secondary)', fontSize: isMobile ? '0.62rem' : undefined, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p ? `${p.name} (${p[`${pos}_mu`].toFixed(1)})` : '선택...'}
                  </span>
                )}
              </div>
            );
          })}
          <button disabled={inputDisabled} className="btn" style={{ width: '100%', background: '#3b82f6', opacity: inputDisabled ? 0.45 : 1, marginTop: isMobile ? '0.35rem' : '1rem', padding: isMobile ? '0.4rem 0.12rem' : undefined, fontSize: isMobile ? '0.68rem' : undefined, whiteSpace: 'nowrap' }} onClick={() => handleSubmit('A')}>
            🔵 A팀 승리 기록
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ color: '#ef4444', marginBottom: '0.2rem', textAlign: 'center', fontSize: isMobile ? '0.78rem' : undefined, whiteSpace: 'nowrap' }}>🔴 Red Team</h3>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '0.35rem' : '1rem', fontSize: isMobile ? '0.64rem' : '0.9rem', color: 'var(--text-secondary)' }}>
            평균 MMR: {getTeamAvgMmr(teamB).toFixed(1)}
          </div>
          {POSITIONS.map(pos => {
            const pId = teamB[pos];
            const p = getPlayerById(pId);
            const playerLabel = getPlayerLabel(p);
            return (
              <div key={`B_${pos}`} style={slotStyle('B', pos)} onClick={isMobile ? undefined : () => handleSlotClick('B', pos)}>
                <span style={{ width: isMobile ? '1.8rem' : '4rem', flexShrink: 0, color: 'var(--text-secondary)', fontSize: isMobile ? '0.61rem' : '0.85rem' }}>{POS_LABELS[pos]}</span>
                {isMobile && p ? (
                  <span style={{ minWidth: 0, flex: 1, textAlign: 'right', lineHeight: 1.15 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: '#ef4444', fontSize: '0.66rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerLabel.lolId || playerLabel.displayName}</span>
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.57rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerLabel.lolId ? `${playerLabel.displayName} · ` : ''}MMR {p[`${pos}_mu`].toFixed(1)}</span>
                  </span>
                ) : (
                  <span style={{ fontWeight: p ? 700 : 400, color: p ? '#ef4444' : 'var(--text-secondary)', fontSize: isMobile ? '0.62rem' : undefined, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p ? `${p.name} (${p[`${pos}_mu`].toFixed(1)})` : '선택...'}
                  </span>
                )}
              </div>
            );
          })}
          <button disabled={inputDisabled} className="btn" style={{ width: '100%', background: '#ef4444', opacity: inputDisabled ? 0.45 : 1, marginTop: isMobile ? '0.35rem' : '1rem', padding: isMobile ? '0.4rem 0.12rem' : undefined, fontSize: isMobile ? '0.68rem' : undefined, whiteSpace: 'nowrap' }} onClick={() => handleSubmit('B')}>
            🔴 B팀 승리 기록
          </button>
        </div>
      </div>

      {/* 선수 선택 영역 */}
      {!isMobile && <div style={{
        padding: isMobile ? '0.7rem' : '1.5rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)'
      }}>
        <h4 style={{ margin: isMobile ? '0 0 0.6rem 0' : '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: isMobile ? '0.78rem' : undefined }}>
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
      </div>}
      {missToast && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1250,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            minWidth: isMobile ? '210px' : '240px',
            padding: isMobile ? '1rem 1.3rem' : '1.15rem 1.7rem',
            textAlign: 'center', color: '#e6def0',
            background: 'rgba(32,31,43,0.96)', border: '1px solid #665976', borderRadius: '16px',
            boxShadow: '0 16px 42px rgba(0,0,0,0.55)',
            transform: 'translateY(-6vh)',
          }}>
            <div style={{ fontSize: isMobile ? '1.65rem' : '1.85rem', fontWeight: 900, color: '#c6bed0' }}>꽝!</div>
            <div style={{ fontSize: '0.86rem', marginTop: '0.22rem', color: '#978da7' }}>다음 랜덤 배치를 준비합니다...</div>
          </div>
        </div>
      )}
      {reward?.won && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'radial-gradient(circle, rgba(106,73,12,0.48) 0%, rgba(0,0,0,0.88) 62%)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem',
        }}>
          <div style={{
            maxWidth: '430px', width: '100%', textAlign: 'center',
            padding: isMobile ? '1.3rem 1rem 1.2rem' : '1.7rem 1.5rem 1.45rem',
            borderRadius: '22px', border: '2px solid #ffd341',
            background: 'linear-gradient(145deg, #332008 0%, #171318 48%, #241309 100%)',
            boxShadow: '0 0 0 5px rgba(255,211,65,0.15), 0 0 48px rgba(255,184,0,0.5), 0 22px 56px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontSize: isMobile ? '1.05rem' : '1.22rem', letterSpacing: '0.18rem', marginBottom: '0.35rem' }}>
              🎉 ✨ 🎟️ ✨ 🎉
            </div>
            <h1 style={{
              color: '#ffe24f', fontSize: isMobile ? '2.35rem' : '2.8rem', fontWeight: 1000,
              margin: '0 0 0.25rem', letterSpacing: '0.09rem',
              textShadow: '0 0 18px rgba(255,216,54,0.85)',
            }}>당첨!!!!!</h1>
            <div style={{ color: '#fff2a6', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.35rem' }}>
              {reward.preview ? '관리자 이펙트 미리보기' : '쿠폰이 터졌습니다!'}
            </div>
            <p style={{ color: '#e6d7af', margin: '0 0 1rem', fontSize: '0.92rem' }}>
              {reward.preview ? '쿠폰 소모 및 입력 기록 없이 표시 중입니다.' : `오늘 ${reward.today_count}번째 입력의 행운입니다.`}
            </p>
            {couponImageUrl ? (
              <div style={{ padding: '0.35rem', borderRadius: '14px', background: 'linear-gradient(135deg, #ffd238, #f48c13)', marginBottom: '1.05rem' }}>
                <img src={couponImageUrl} alt="당첨 쿠폰" style={{ display: 'block', width: '100%', maxHeight: '48vh', objectFit: 'contain', borderRadius: '10px', background: '#fff' }} />
              </div>
            ) : (
              <div style={{ color: '#f0ce68', margin: '1.1rem 0', fontSize: '0.9rem' }}>쿠폰을 불러오는 중...</div>
            )}
            <button className="btn" style={{ width: '100%', fontWeight: 800, fontSize: '1rem', background: '#f5b400', borderColor: '#f5b400', color: '#231400' }} onClick={() => {
              setReward(null);
              if (!reward.preview) handleRandomize();
            }}>
              {reward.preview ? '미리보기 닫기' : '쿠폰 확인 완료 · 다음 배치'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
