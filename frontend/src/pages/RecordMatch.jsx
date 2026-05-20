import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { CHAMPIONS } from '../data/champions';

const POSITIONS = ['top', 'jungle', 'mid', 'adc', 'support'];
const POS_LABELS = { top: '탑', jungle: '정글', mid: '미드', adc: '원딜', support: '서포터' };

function canPlay(player, position) {
  try {
    const imp = JSON.parse(player.impossible_positions || '[]');
    return !imp.includes(position);
  } catch { return true; }
}

// ── 챔피언 선택 모달 컴포넌트 (단일/멀티 선택 지원) ──────────────────
function ChampionSelectModal({ open, onClose, onSelect, onMultiSelect, multi = false, excludeChampions = [], title = '챔피언 선택' }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  if (!open) return null;

  const filtered = CHAMPIONS.filter(c =>
    !excludeChampions.includes(c) && c.includes(search)
  );

  const handleClose = () => { setSearch(''); setSelected([]); onClose(); };

  const toggleChamp = (c) => {
    setSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleConfirm = () => {
    if (onMultiSelect) onMultiSelect(selected);
    handleClose();
  };

  return (
    <>
      <div onClick={handleClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', zIndex: 9998
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '95%', maxWidth: '640px', maxHeight: '80vh',
        backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', padding: '1.5rem',
        zIndex: 9999, color: '#f9fafb', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
            {title}
            {multi && selected.length > 0 && <span style={{ fontSize: '0.8rem', color: '#a855f7', marginLeft: '0.5rem', fontWeight: 400 }}>({selected.length}개 선택됨)</span>}
          </h3>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        <input
          type="text"
          placeholder="챔피언 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={{
            width: '100%', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #4b5563',
            background: '#111827', color: '#f9fafb', fontSize: '0.9rem', marginBottom: '1rem',
            outline: 'none', boxSizing: 'border-box'
          }}
        />
        <div style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
          alignContent: 'flex-start'
        }}>
          {filtered.map(c => {
            const isSelected = multi && selected.includes(c);
            return (
              <div
                key={c}
                onClick={() => {
                  if (multi) {
                    toggleChamp(c);
                  } else {
                    onSelect(c); handleClose();
                  }
                }}
                style={{
                  padding: '0.45rem 0.85rem', borderRadius: '6px',
                  border: isSelected ? '1px solid #a855f7' : '1px solid #4b5563',
                  background: isSelected ? 'rgba(168,85,247,0.25)' : '#374151',
                  color: isSelected ? '#d8b4fe' : '#e5e7eb',
                  fontSize: '0.82rem', cursor: 'pointer',
                  transition: 'all 0.1s', userSelect: 'none'
                }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = '#4b5563'; e.currentTarget.style.borderColor = '#60a5fa'; } }}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = '#374151'; e.currentTarget.style.borderColor = '#4b5563'; } }}
              >
                {isSelected && '✓ '}{c}
              </div>
            );
          })}
          {filtered.length === 0 && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>검색 결과가 없습니다.</span>}
        </div>
        {multi && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button onClick={handleClose} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #4b5563', background: 'transparent', color: '#9ca3af', fontSize: '0.85rem', cursor: 'pointer' }}>취소</button>
            <button onClick={handleConfirm} disabled={selected.length === 0} style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', background: selected.length > 0 ? '#a855f7' : '#4b5563', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: selected.length > 0 ? 'pointer' : 'not-allowed' }}>
              {selected.length}개 추가
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function RecordMatch({ token }) {
  const location = useLocation();
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });
  const [teamB, setTeamB] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });
  const [activeSlot, setActiveSlot] = useState(null);
  const [mmrModalData, setMmrModalData] = useState(null);

  // 모드 탭: 'simple' | 'detailed'
  const [recordMode, setRecordMode] = useState('simple');

  // 벤 데이터 (팀별 5개, 순서대로)
  const [teamABans, setTeamABans] = useState(['', '', '', '', '']);
  const [teamBBans, setTeamBBans] = useState(['', '', '', '', '']);

  // 피어리스 벤 (무제한)
  const [fearlessBans, setFearlessBans] = useState([]);

  // 픽 데이터 (팀별 5개, 순서 + 챔피언 + 포지션)
  const [teamAPicks, setTeamAPicks] = useState(
    POSITIONS.map((_, i) => ({ order: i + 1, champion: '', position: '' }))
  );
  const [teamBPicks, setTeamBPicks] = useState(
    POSITIONS.map((_, i) => ({ order: i + 1, champion: '', position: '' }))
  );

  // 챔피언 모달 상태
  const [champModal, setChampModal] = useState({ open: false, callback: null, multiCallback: null, multi: false, title: '', excludes: [] });

  const getTeamAvgMmr = (assign) => {
    let sum = 0; let count = 0;
    POSITIONS.forEach(pos => {
      const pId = assign[pos];
      const player = players.find(p => String(p.id) === String(pId));
      if (player) {
        sum += player[`${pos}_mu`];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  };

  useEffect(() => {
    axios.get('/api/players').then(res => setPlayers(res.data));
  }, []);

  useEffect(() => {
    if (location.state?.presetMatchup) {
      const pm = location.state.presetMatchup;
      setTeamA({ top: String(pm.team_a.top), jungle: String(pm.team_a.jungle), mid: String(pm.team_a.mid), adc: String(pm.team_a.adc), support: String(pm.team_a.support) });
      setTeamB({ top: String(pm.team_b.top), jungle: String(pm.team_b.jungle), mid: String(pm.team_b.mid), adc: String(pm.team_b.adc), support: String(pm.team_b.support) });
    }
  }, [location.state]);

  // 현재 벤/픽에서 사용 중인 챔피언 전체 목록 (중복 방지용)
  const getAllUsedChampions = () => {
    const used = [];
    teamABans.forEach(c => { if (c) used.push(c); });
    teamBBans.forEach(c => { if (c) used.push(c); });
    fearlessBans.forEach(c => used.push(c));
    teamAPicks.forEach(p => { if (p.champion) used.push(p.champion); });
    teamBPicks.forEach(p => { if (p.champion) used.push(p.champion); });
    return used;
  };

  const openChampModal = (callback, title, extraExcludes = []) => {
    const excludes = [...getAllUsedChampions(), ...extraExcludes];
    setChampModal({ open: true, callback, multiCallback: null, multi: false, title, excludes });
  };

  const openMultiChampModal = (multiCallback, title, extraExcludes = []) => {
    const excludes = [...getAllUsedChampions(), ...extraExcludes];
    setChampModal({ open: true, callback: null, multiCallback, multi: true, title, excludes });
  };

  const handleSubmit = async (winner) => {
    const aIds = POSITIONS.map(p => teamA[p]);
    const bIds = POSITIONS.map(p => teamB[p]);

    if (aIds.includes('') || bIds.includes('')) {
      alert('모든 포지션을 배정해주세요.');
      return;
    }

    const payload = {
      team_a_ids: aIds.map(Number),
      team_b_ids: bIds.map(Number),
      winner,
      is_virtual: false,
      record_mode: recordMode,
    };

    if (recordMode === 'detailed') {
      // 벤 데이터 검증 (5개 모두 작성)
      const hasEmptyABan = teamABans.some(c => !c);
      const hasEmptyBBan = teamBBans.some(c => !c);
      if (hasEmptyABan || hasEmptyBBan) {
        alert('상세 기록 모드에서는 양 팀의 벤(각 5개)을 모두 등록해야 합니다.');
        return;
      }

      // 픽 데이터 검증 (5개 모두 작성 및 포지션 지정)
      const hasEmptyAPick = teamAPicks.some(p => !p.champion || !p.position);
      const hasEmptyBPick = teamBPicks.some(p => !p.champion || !p.position);
      if (hasEmptyAPick || hasEmptyBPick) {
        alert('상세 기록 모드에서는 양 팀의 픽(각 5개) 챔피언 및 라인을 모두 등록해야 합니다.');
        return;
      }

      payload.team_a_bans = teamABans.map((c, i) => ({ order: i + 1, champion: c }));
      payload.team_b_bans = teamBBans.map((c, i) => ({ order: i + 1, champion: c }));
      payload.fearless_bans = fearlessBans;
      payload.team_a_picks = teamAPicks.map(p => ({ order: p.order, champion: p.champion, position: p.position }));
      payload.team_b_picks = teamBPicks.map(p => ({ order: p.order, champion: p.champion, position: p.position }));
    }

    try {
      const res = await axios.post('/api/matches', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data && res.data.mmr_changes) {
        setMmrModalData({ winner, changes: res.data.mmr_changes });
      } else {
        alert(`🏆 [실전 기록] ${winner === 'A' ? '블루' : '레드'}팀 승리 결과가 반영되었습니다!`);
      }
      
      // 상세 기록 모드였던 경우, 이번 판의 픽 10개를 다음 판의 피어리스 벤에 누적하고 벤/픽 초기화
      if (recordMode === 'detailed') {
        const pickedChamps = [
          ...teamAPicks.map(p => p.champion),
          ...teamBPicks.map(p => p.champion)
        ].filter(Boolean);
        
        setFearlessBans(prev => [...prev, ...pickedChamps]);
        setTeamABans(['', '', '', '', '']);
        setTeamBBans(['', '', '', '', '']);
        setTeamAPicks(POSITIONS.map((_, i) => ({ order: i + 1, champion: '', position: '' })));
        setTeamBPicks(POSITIONS.map((_, i) => ({ order: i + 1, champion: '', position: '' })));
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
    if (nextPos) setActiveSlot({ team, pos: nextPos });
    else if (team === 'A') setActiveSlot({ team: 'B', pos: 'top' });
    else setActiveSlot(null);
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
      padding: '0.8rem', borderRadius: '8px',
      border: isActive ? `2px solid ${team === 'A' ? '#3b82f6' : '#ef4444'}` : '1px solid var(--border-color)',
      background: isActive ? (team === 'A' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--panel-bg)',
      cursor: 'pointer', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: isActive ? '0 0 0 3px rgba(255,255,255,0.05)' : 'none', transition: 'all 0.15s',
    };
  };

  const chipStyle = (p) => {
    const assigned = getAssignedInfo(p.id);
    const cantPlay = activeSlot && !canPlay(p, activeSlot.pos);
    let bg = 'var(--panel-bg)', color = 'var(--text-primary)', border = '1px solid var(--border-color)', opacity = 1;
    if (assigned) {
      bg = assigned.team === 'A' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)';
      border = assigned.team === 'A' ? '1px solid #3b82f6' : '1px solid #ef4444';
    } else if (cantPlay) {
      opacity = 0.4; bg = 'rgba(255,255,255,0.02)';
    }
    return {
      padding: '0.6rem 1rem', borderRadius: '20px', background: bg, color, border, opacity,
      cursor: cantPlay ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: assigned ? 600 : 400,
      userSelect: 'none', transition: 'all 0.1s',
    };
  };

  // ── 벤 슬롯 렌더 헬퍼 ──
  const renderBanSlot = (bans, setBans, idx, teamColor) => {
    const champ = bans[idx];
    return (
      <div
        key={idx}
        onClick={() => {
          if (champ) {
            const newBans = [...bans]; newBans[idx] = ''; setBans(newBans);
          } else {
            openChampModal((c) => {
              const newBans = [...bans]; newBans[idx] = c; setBans(newBans);
            }, `${teamColor === '#3b82f6' ? '블루' : '레드'}팀 ${idx + 1}번째 벤`);
          }
        }}
        style={{
          flex: '1 1 0px', minWidth: '70px', padding: '0.45rem 0.2rem', borderRadius: '6px',
          border: `1px solid ${champ ? teamColor : '#4b5563'}`,
          background: champ ? `${teamColor}15` : '#1f2937', cursor: 'pointer', fontSize: '0.78rem',
          color: champ ? '#e5e7eb' : '#6b7280', textAlign: 'center',
          transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}
      >
        {champ ? (
          <span title={champ}>{idx + 1}. {champ} <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>✕</span></span>
        ) : (
          <span>{idx + 1}. 벤</span>
        )}
      </div>
    );
  };

  // ── 픽 슬롯 렌더 헬퍼 ──
  const renderPickSlot = (picks, setPicks, idx, teamColor) => {
    const pick = picks[idx];
    return (
      <div key={idx} style={{
        flex: '1 1 0px', minWidth: '95px', display: 'flex', flexDirection: 'column',
        gap: '0.3rem', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '8px',
        border: `1px solid ${pick.champion ? teamColor : '#374151'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
          <span>{idx + 1}픽</span>
          {pick.champion && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                const np = [...picks]; np[idx] = { ...np[idx], champion: '' }; setPicks(np);
              }}
              style={{ cursor: 'pointer', color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem', padding: '0 0.2rem' }}
            >
              ✕
            </span>
          )}
        </div>
        <div
          onClick={() => {
            if (!pick.champion) {
              openChampModal((c) => {
                const np = [...picks]; np[idx] = { ...np[idx], champion: c }; setPicks(np);
              }, `${teamColor === '#3b82f6' ? '블루' : '레드'}팀 ${idx + 1}번째 픽`);
            }
          }}
          style={{
            padding: '0.35rem 0.2rem', borderRadius: '4px', cursor: pick.champion ? 'default' : 'pointer',
            background: pick.champion ? `${teamColor}15` : '#1f2937', fontSize: '0.8rem',
            color: pick.champion ? '#e5e7eb' : '#6b7280', textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}
          title={pick.champion || '챔피언 선택'}
        >
          {pick.champion || '선택...'}
        </div>
        <select
          value={pick.position}
          onChange={e => {
            const np = [...picks]; np[idx] = { ...np[idx], position: e.target.value }; setPicks(np);
          }}
          style={{
            padding: '0.2rem 0.3rem', borderRadius: '4px', border: '1px solid #4b5563',
            background: '#111827', color: '#e5e7eb', fontSize: '0.72rem', cursor: 'pointer',
            outline: 'none', width: '100%'
          }}
        >
          <option value="">라인</option>
          {POSITIONS.map(pos => <option key={pos} value={pos}>{POS_LABELS[pos]}</option>)}
        </select>
      </div>
    );
  };

  // ── 탭 스타일 ──
  const tabStyle = (active) => ({
    flex: 1, padding: '0.7rem', textAlign: 'center', cursor: 'pointer', fontWeight: active ? 700 : 400,
    borderRadius: '8px 8px 0 0', fontSize: '0.9rem', transition: 'all 0.2s',
    background: active ? 'var(--panel-bg)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  });

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>⚔️ 실전 결과 기록</h2>
        <button
          className="btn"
          onClick={handleSwapTeams}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)',
            fontSize: '0.82rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer'
          }}
        >
          🔄 블루/레드 진영 교환
        </button>
      </div>

      {/* 모드 선택 탭 */}
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={tabStyle(recordMode === 'simple')} onClick={() => setRecordMode('simple')}>
          📋 간단 기록
        </div>
        <div style={tabStyle(recordMode === 'detailed')} onClick={() => setRecordMode('detailed')}>
          📝 상세 기록 (벤/픽)
        </div>
      </div>

      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        슬롯을 클릭한 뒤 아래 선수 목록에서 배정하세요. 배정이 끝나면 승리팀 버튼을 누릅니다.
      </p>

      {/* 팀 배정 영역 (기존) */}
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

      {/* 선수 목록 (팀 구성 아래로 이동) */}
      <div style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>
          {activeSlot ? `👇 [${activeSlot.team === 'A' ? 'Blue' : 'Red'} ${POS_LABELS[activeSlot.pos]}] 배치할 선수 선택` : '클릭해서 선택할 슬롯을 먼저 지정하세요'}
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {players.map(p => (
            <div key={p.id} style={chipStyle(p)} onClick={() => handlePlayerClick(p)}>
              {p.name}
              {activeSlot && ` (${p[`${activeSlot.pos}_mu`].toFixed(1)})`}
              {getAssignedInfo(p.id) && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', opacity: 0.7 }}>({getAssignedInfo(p.id).team})</span>}
            </div>
          ))}
          {players.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>배정할 수 있는 선수가 없습니다.</span>}
        </div>
      </div>

      {/* ── 상세 기록 모드: 벤/픽 섹션 ── */}
      {recordMode === 'detailed' && (
        <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 피어리스 벤 */}
          <div style={{ padding: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(168,85,247,0.25)' }}>
            <h4 style={{ margin: '0 0 0.8rem 0', color: '#a855f7', fontSize: '0.95rem' }}>
              🚫 피어리스 벤 <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>(이전 내전 사용 챔피언, 순서 무관, 무제한)</span>
              {fearlessBans.length > 0 && (
                <span style={{
                  marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600,
                  padding: '0.15rem 0.5rem', borderRadius: '10px',
                  background: 'rgba(168,85,247,0.25)', color: '#c084fc'
                }}>총 {fearlessBans.length}개</span>
              )}
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
              {fearlessBans.map((c, i) => (
                <div key={i} style={{
                  padding: '0.35rem 0.7rem', borderRadius: '16px', background: 'rgba(168,85,247,0.15)',
                  border: '1px solid rgba(168,85,247,0.3)', color: '#d8b4fe', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '0.3rem'
                }}>
                  {c}
                  <span
                    onClick={() => setFearlessBans(fearlessBans.filter((_, j) => j !== i))}
                    style={{ cursor: 'pointer', opacity: 0.6, fontSize: '0.7rem' }}
                  >✕</span>
                </div>
              ))}
            </div>
            <button
              className="btn"
              onClick={() => openMultiChampModal((champs) => setFearlessBans([...fearlessBans, ...champs]), '피어리스 벤 챔피언 추가 (여러 개 선택 가능)')}
              style={{
                background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
                color: '#c084fc', fontSize: '0.8rem', padding: '0.4rem 0.9rem', borderRadius: '8px', cursor: 'pointer'
              }}
            >
              + 챔피언 추가
            </button>
          </div>

          {/* 벤 섹션 */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* 블루팀 벤 */}
            <div style={{ flex: 1, minWidth: '280px', padding: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', color: '#60a5fa', fontSize: '0.95rem' }}>🔵 블루팀 벤</h4>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4].map(i => renderBanSlot(teamABans, setTeamABans, i, '#3b82f6'))}
              </div>
            </div>
            {/* 레드팀 벤 */}
            <div style={{ flex: 1, minWidth: '280px', padding: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', color: '#f87171', fontSize: '0.95rem' }}>🔴 레드팀 벤</h4>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4].map(i => renderBanSlot(teamBBans, setTeamBBans, i, '#ef4444'))}
              </div>
            </div>
          </div>

          {/* 픽 섹션 */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* 블루팀 픽 */}
            <div style={{ flex: 1, minWidth: '280px', padding: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', color: '#60a5fa', fontSize: '0.95rem' }}>🔵 블루팀 픽</h4>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4].map(i => renderPickSlot(teamAPicks, setTeamAPicks, i, '#3b82f6'))}
              </div>
            </div>
            {/* 레드팀 픽 */}
            <div style={{ flex: 1, minWidth: '280px', padding: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h4 style={{ margin: '0 0 0.8rem 0', color: '#f87171', fontSize: '0.95rem' }}>🔴 레드팀 픽</h4>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4].map(i => renderPickSlot(teamBPicks, setTeamBPicks, i, '#ef4444'))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 챔피언 선택 모달 */}
      <ChampionSelectModal
        open={champModal.open}
        onClose={() => setChampModal({ ...champModal, open: false })}
        onSelect={(c) => { if (champModal.callback) champModal.callback(c); }}
        onMultiSelect={(champs) => { if (champModal.multiCallback) champModal.multiCallback(champs); }}
        multi={champModal.multi}
        excludeChampions={champModal.excludes}
        title={champModal.title}
      />

      {/* MMR 변동 상세 커스텀 모달 */}
      {mmrModalData && (
        <>
          <div
            onClick={() => setMmrModalData(null)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', zIndex: 9999
            }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '95%', maxWidth: '760px', backgroundColor: '#1f2937',
              border: '1px solid #374151', borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', padding: '2rem',
              zIndex: 10000, color: '#f9fafb'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #374151', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 실전 매치 결과 기록 완료
              </h2>
              <button onClick={() => setMmrModalData(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.5rem', cursor: 'pointer', padding: '0.2rem 0.5rem', lineHeight: 1 }}>&times;</button>
            </div>

            <div style={{
              textAlign: 'center', padding: '1rem', borderRadius: '10px',
              background: mmrModalData.winner === 'A'
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff', fontWeight: 800, fontSize: '1.25rem',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              boxShadow: mmrModalData.winner === 'A' ? '0 4px 15px rgba(37, 99, 235, 0.4)' : '0 4px 15px rgba(220, 38, 38, 0.4)',
              marginBottom: '1.8rem', letterSpacing: '0.5px'
            }}>
              🎉 {mmrModalData.winner === 'A' ? '🔵 Blue Team (블루팀)' : '🔴 Red Team (레드팀)'} 승리!
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
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

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setMmrModalData(null)} style={{ background: 'var(--accent)', color: '#fff', padding: '0.6rem 1.5rem', fontSize: '0.92rem', fontWeight: 600 }}>닫기</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
