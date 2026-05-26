import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PAGE_SIZE = 10;

const POSITION_LABELS = ["Top", "Jungle", "Mid", "ADC", "Support"];
const POSITION_ICONS  = ["🛡️", "🌿", "⚡", "🏹", "💊"];

export default function TeamBuilder({ token }) {
  const navigate = useNavigate();
  const [players, setPlayers]         = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pinnedPositions, setPinnedPositions] = useState({}); // { A_top: pId, B_jungle: pId }
  const [activeSlot, setActiveSlot]   = useState(null); // { team: 'A', pos: 'top' }
  const [matchups, setMatchups]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);   // 0-indexed
  const [loading, setLoading]         = useState(false);
  const [sortBy, setSortBy]           = useState('preference'); // 'balance' | 'preference'
  const [recentSelectionLoaded, setRecentSelectionLoaded] = useState(false);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      axios.get('/api/players'),
      axios.get('/api/matches/recent-real-participants', { headers })
    ]).then(([playersRes, recentMatchRes]) => {
      const fetchedPlayers = playersRes.data;
      const validPlayerIds = new Set(fetchedPlayers.map(player => player.id));
      const recentIds = [...new Set(recentMatchRes.data.player_ids || [])]
        .filter(playerId => validPlayerIds.has(playerId))
        .slice(0, 10);

      setPlayers(fetchedPlayers);
      if (recentIds.length === 10) {
        setSelectedIds(recentIds);
        setRecentSelectionLoaded(true);
      }
    }).catch(err => {
      console.error('팀 짜기 초기 데이터 조회 실패:', err);
    });
  }, [token]);

  const getPositionPreference = (player, position) => {
    if (!position) return 'neutral';

    try {
      const preferred = JSON.parse(player.preferred_positions || '[]');
      const impossible = JSON.parse(player.impossible_positions || '[]');

      if (impossible.includes(position)) return 'impossible';
      if (preferred.includes(position)) return 'preferred';
    } catch {}

    return 'non_preferred';
  };

  const handlePlayerClick = (pId) => {
    setRecentSelectionLoaded(false);

    if (activeSlot) {
      const player = players.find(p => p.id === pId);
      if (!player || getPositionPreference(player, activeSlot.pos) === 'impossible') return;
      if (!selectedIds.includes(pId) && selectedIds.length >= 10) {
        alert('이미 10명이 선택되었습니다. 다른 선수를 빼고 고정하세요.');
        return;
      }

      const pinKey = `${activeSlot.team}_${activeSlot.pos}`;
      const newPins = { ...pinnedPositions };
      
      // 만약 클릭한 선수가 이미 다른 곳에 고정되어 있다면 그 고정을 해제
      for (const k in newPins) {
        if (newPins[k] === pId) delete newPins[k];
      }
      
      // 이 선수를 activeSlot에 고정
      newPins[pinKey] = pId;
      setPinnedPositions(newPins);
      
      // 10명 선택 목록에 없다면 자동 추가
      if (!selectedIds.includes(pId)) {
        setSelectedIds([...selectedIds, pId]);
      }
      
      // 자동 다음 슬롯 (선택적)
      setActiveSlot(null);
    } else {
      // 슬롯 선택 안 된 상태면 그냥 10명 토글 및 고정 해제
      if (selectedIds.includes(pId)) {
        setSelectedIds(selectedIds.filter(id => id !== pId));
        // 이 선수의 고정도 해제
        const newPins = { ...pinnedPositions };
        for (const k in newPins) {
          if (newPins[k] === pId) delete newPins[k];
        }
        setPinnedPositions(newPins);
      } else {
        if (selectedIds.length >= 10) return;
        setSelectedIds([...selectedIds, pId]);
      }
    }
  };

  const handleSlotClick = (team, pos) => {
    if (activeSlot?.team === team && activeSlot?.pos === pos) {
      // Toggle off and unpin
      const pinKey = `${team}_${pos}`;
      const newPins = { ...pinnedPositions };
      if (newPins[pinKey]) {
        delete newPins[pinKey];
        setPinnedPositions(newPins);
      }
      setActiveSlot(null);
    } else {
      setActiveSlot({ team, pos });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setPinnedPositions({});
    setActiveSlot(null);
    setMatchups([]);
    setTotal(0);
    setPage(0);
    setRecentSelectionLoaded(false);
  };

  const handleMatchmake = async () => {
    if (selectedIds.length !== 10) {
      alert('10명을 선택해주세요.');
      return;
    }
    setLoading(true);
    setMatchups([]);
    setPage(0);
    setSortBy('preference');
    try {
      const res = await axios.post('/api/matchmake', { player_ids: selectedIds, pinned_positions: pinnedPositions }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatchups(res.data.matchups);
      setTotal(res.data.total);
    } catch (err) {
      alert('매칭 실패: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRecordClick = (matchup) => {
    navigate('/record', {
      state: {
        presetMatchup: {
          team_a: {
            top: matchup.team_a[0],
            jungle: matchup.team_a[1],
            mid: matchup.team_a[2],
            adc: matchup.team_a[3],
            support: matchup.team_a[4]
          },
          team_b: {
            top: matchup.team_b[0],
            jungle: matchup.team_b[1],
            mid: matchup.team_b[2],
            adc: matchup.team_b[3],
            support: matchup.team_b[4]
          }
        }
      }
    });
  };

  const getMatchupPreferredCount = (matchup) => {
    let count = 0;
    const positions = ['top', 'jungle', 'mid', 'adc', 'support'];
    
    matchup.team_a.forEach((pid, idx) => {
      const p = getPlayerObj(pid);
      if (p) {
        try {
          const pref = JSON.parse(p.preferred_positions || '[]');
          if (pref.includes(positions[idx])) count++;
        } catch {}
      }
    });

    matchup.team_b.forEach((pid, idx) => {
      const p = getPlayerObj(pid);
      if (p) {
        try {
          const pref = JSON.parse(p.preferred_positions || '[]');
          if (pref.includes(positions[idx])) count++;
        } catch {}
      }
    });

    return count;
  };

  const getPlayerObj  = (id) => players.find(x => x.id === id);
  const getPlayerName = (id) => players.find(x => x.id === id)?.name ?? '?';

  const sortedMatchups = [...matchups].sort((a, b) => {
    if (sortBy === 'preference') {
      const prefA = getMatchupPreferredCount(a);
      const prefB = getMatchupPreferredCount(b);
      if (prefA !== prefB) {
        return prefB - prefA; // 선호 수 많은 순 (내림차순)
      }
      return a.diff - b.diff; // 선호 수가 같으면 MMR 차이 적은 순 (오름차순)
    }
    return a.diff - b.diff; // balance: MMR 차이 적은 순 (오름차순)
  });

  const totalPages    = Math.ceil(sortedMatchups.length / PAGE_SIZE);
  const paginated     = sortedMatchups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectablePlayers = activeSlot
    ? [...players].sort((a, b) => {
        const priority = { preferred: 0, non_preferred: 1, impossible: 2 };
        return priority[getPositionPreference(a, activeSlot.pos)] - priority[getPositionPreference(b, activeSlot.pos)];
      })
    : players;

  const getPreferenceLabel = (player, pos) => {
    if (!player) return null;
    try {
      const pref = JSON.parse(player.preferred_positions || '[]');
      const imp = JSON.parse(player.impossible_positions || '[]');
      
      if (pref.includes(pos)) {
        return (
          <span style={{
            fontSize: '0.65rem',
            padding: '0.08rem 0.35rem',
            borderRadius: '4px',
            background: 'rgba(52, 211, 153, 0.15)',
            color: '#34d399',
            marginLeft: '0.4rem',
            fontWeight: 600,
            border: '1px solid rgba(52, 211, 153, 0.25)'
          }}>선호</span>
        );
      }
      if (imp.includes(pos)) {
        return (
          <span style={{
            fontSize: '0.65rem',
            padding: '0.08rem 0.35rem',
            borderRadius: '4px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            marginLeft: '0.4rem',
            fontWeight: 600,
            border: '1px solid rgba(239, 68, 68, 0.25)'
          }}>불가</span>
        );
      }
      return (
        <span style={{
          fontSize: '0.65rem',
          padding: '0.08rem 0.35rem',
          borderRadius: '4px',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          marginLeft: '0.4rem',
          fontWeight: 600,
          border: '1px solid rgba(245, 158, 11, 0.25)'
        }}>비선호</span>
      );
    } catch {
      return null;
    }
  };

  /* ── Sub-components ── */
  const RankBadge = ({ rank }) => {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const colors  = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const color   = rank <= 3 ? colors[rank - 1] : 'var(--text-secondary)';
    return (
      <span style={{ fontSize: '1rem', fontWeight: 800, color, minWidth: '2.2rem', textAlign: 'center', display: 'inline-block' }}>
        {medals[rank] ?? `#${rank}`}
      </span>
    );
  };

  const MmrBar = ({ mmrA, mmrB }) => {
    const sum = mmrA + mmrB || 1;
    const pct = (mmrA / sum) * 100;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#3b82f6', minWidth: '3.5rem', textAlign: 'right' }}>
          {mmrA.toFixed(1)}
        </span>
        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(239,68,68,0.3)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: '3px', transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: '0.75rem', color: '#ef4444', minWidth: '3.5rem' }}>
          {mmrB.toFixed(1)}
        </span>
      </div>
    );
  };

  const MatchupCard = ({ matchup, rank }) => (
    <div style={{
      background: 'var(--panel-bg)',
      border: rank === 1 ? '1px solid rgba(94,106,210,0.6)' : '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.2rem 1.5rem',
      boxShadow: rank === 1 ? '0 0 16px rgba(94,106,210,0.2)' : '0 2px 4px rgba(0,0,0,0.3)',
      marginBottom: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <RankBadge rank={rank} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            MMR 차이 <strong style={{ color: matchup.diff < 5 ? 'var(--win-color)' : 'var(--text-primary)' }}>
              {matchup.diff.toFixed(2)}
            </strong>
          </span>
          <span style={{
            fontSize: '0.7rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'rgba(52, 211, 153, 0.12)',
            color: '#34d399',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.15rem'
          }}>
            ✨ 선호 배정: {getMatchupPreferredCount(matchup)}명
          </span>
          <button 
            onClick={() => handleRecordClick(matchup)}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              background: 'rgba(94,106,210,0.15)',
              color: 'var(--accent-hover)',
              border: '1px solid rgba(94,106,210,0.3)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              marginLeft: '0.5rem',
              transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(94,106,210,0.15)';
              e.currentTarget.style.color = 'var(--accent-hover)';
            }}
          >
            ⚔️ 기록하기
          </button>
        </div>
        <MmrBar mmrA={matchup.mmr_a} mmrB={matchup.mmr_b} />
      </div>

      {/* Teams */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
          <div style={{ color: '#3b82f6', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            🔵 Blue Team &nbsp;<span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{matchup.mmr_a.toFixed(1)}</span>
          </div>
          {matchup.team_a.map((pid, i) => {
            const player = getPlayerObj(pid);
            const pos = POSITION_LABELS[i].toLowerCase();
            return (
              <div key={pid} style={{ fontSize: '0.82rem', padding: '0.15rem 0', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span title={POSITION_LABELS[i]}>{POSITION_ICONS[i]}</span>
                <span style={{ color: 'var(--text-secondary)', minWidth: '3.8rem', fontSize: '0.75rem' }}>{POSITION_LABELS[i]}</span>
                <span style={{ fontWeight: 600 }}>{player?.name ?? '?'}</span>
                {getPreferenceLabel(player, pos)}
              </div>
            );
          })}
        </div>

        <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
          <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            🔴 Red Team &nbsp;<span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{matchup.mmr_b.toFixed(1)}</span>
          </div>
          {matchup.team_b.map((pid, i) => {
            const player = getPlayerObj(pid);
            const pos = POSITION_LABELS[i].toLowerCase();
            return (
              <div key={pid} style={{ fontSize: '0.82rem', padding: '0.15rem 0', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span title={POSITION_LABELS[i]}>{POSITION_ICONS[i]}</span>
                <span style={{ color: 'var(--text-secondary)', minWidth: '3.8rem', fontSize: '0.75rem' }}>{POSITION_LABELS[i]}</span>
                <span style={{ fontWeight: 600 }}>{player?.name ?? '?'}</span>
                {getPreferenceLabel(player, pos)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const NavBtn = ({ onClick, disabled, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.4rem 0.9rem', borderRadius: '8px',
        background: disabled ? 'rgba(255,255,255,0.05)' : 'var(--accent)',
        color: 'white', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600, opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >{children}</button>
  );

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', gap: '2rem' }}>

      {/* ── Left: Player selector (sticky) ── */}
      <div className="card" style={{ width: '480px', flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>
            참가자 선택 ({selectedIds.length}/10)
          </h2>
          <button
            type="button"
            onClick={handleClearSelection}
            disabled={selectedIds.length === 0 && Object.keys(pinnedPositions).length === 0}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: selectedIds.length === 0 && Object.keys(pinnedPositions).length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.75rem',
              opacity: selectedIds.length === 0 && Object.keys(pinnedPositions).length === 0 ? 0.45 : 1,
            }}
          >
            전체 선택 취소
          </button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '1rem' }}>
          {activeSlot
            ? `${activeSlot.team === 'A' ? 'Blue' : 'Red'} ${activeSlot.pos.toUpperCase()}에 고정할 선수를 선택하세요.`
            : recentSelectionLoaded
              ? '최근 2시간 내 최신 실전 매치 참가자 10명이 선택되어 있습니다.'
              : '클릭하여 10명 선택 후 버튼을 누르세요.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.2rem', maxHeight: '55vh', overflowY: 'auto' }}>
          {selectablePlayers.map(p => {
            const selected = selectedIds.includes(p.id);
            const preference = getPositionPreference(p, activeSlot?.pos);
            const unavailable = preference === 'impossible';
            return (
              <button
                key={p.id}
                onClick={() => handlePlayerClick(p.id)}
                disabled={activeSlot && unavailable}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: unavailable
                    ? 'rgba(255,255,255,0.015)'
                    : selected ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                  color: unavailable ? 'rgba(255,255,255,0.3)' : 'white',
                  border: unavailable
                    ? '1px solid rgba(255,255,255,0.04)'
                    : selected ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: unavailable ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  fontWeight: selected ? 700 : 400,
                  fontSize: '0.88rem',
                  opacity: unavailable ? 0.5 : 1,
                  transition: 'all 0.15s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{selected ? '✓ ' : ''}{p.name}</span>
                {activeSlot && preference === 'preferred' && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                    선호
                  </span>
                )}
                {activeSlot && preference === 'impossible' && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239,68,68,0.08)', color: 'rgba(248,113,113,0.6)' }}>
                    불가
                  </span>
                )}
                {!activeSlot && Object.entries(pinnedPositions).find(([, v]) => v === p.id) && (
                  <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.2)' }}>
                    📌 고정됨
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={handleMatchmake}
          disabled={selectedIds.length !== 10 || loading}
        >
          {loading ? '⏳ 계산 중...' : '⚖️ 황금 밸런스 팀 짜기'}
        </button>

        {matchups.length > 0 && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            총 {total}개 후보 발견
          </p>
        )}
      </div>

      {/* ── Right: Results & Pinning ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {!matchups.length && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
            <p>왼쪽에서 10명을 선택하고 버튼을 누르면<br/>공정성 순으로 팀 후보를 보여드립니다.</p>
          </div>
        )}

        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <p>최적 편성 탐색 중...<br/>경우의 수가 많아 수 초가 걸릴 수 있습니다.</p>
          </div>
        )}

        {matchups.length > 0 && (
          <>
            {/* ── Sort Options ── */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', background: 'rgba(0,0,0,0.12)', padding: '0.3rem', borderRadius: '8px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
              <button
                onClick={() => { setSortBy('balance'); setPage(0); }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: sortBy === 'balance' ? 'var(--accent)' : 'transparent',
                  color: sortBy === 'balance' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: sortBy === 'balance' ? 700 : 400,
                  transition: 'all 0.15s'
                }}
              >
                ⚖️ MMR 밸런스 순
              </button>
              <button
                onClick={() => { setSortBy('preference'); setPage(0); }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: sortBy === 'preference' ? 'var(--accent)' : 'transparent',
                  color: sortBy === 'preference' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: sortBy === 'preference' ? 700 : 400,
                  transition: 'all 0.15s'
                }}
              >
                ✨ 선호 포지션 배정 순
              </button>
            </div>

            {/* ── Pagination header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                팀 후보&nbsp;
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.9rem' }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedMatchups.length)} / {sortedMatchups.length}개
                </span>
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <NavBtn onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← 이전</NavBtn>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '4rem', textAlign: 'center' }}>
                  {page + 1} / {totalPages}
                </span>
                <NavBtn onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>다음 →</NavBtn>
              </div>
            </div>

            {/* ── Candidate cards ── */}
            {paginated.map((m, i) => (
              <MatchupCard key={`${page}-${i}`} matchup={m} rank={page * PAGE_SIZE + i + 1} />
            ))}

            {/* ── Page number buttons ── */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                     key={i}
                     onClick={() => setPage(i)}
                     style={{
                       width: '2.2rem', height: '2.2rem', borderRadius: '6px',
                       background: i === page ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                       color: 'white', border: '1px solid var(--border-color)',
                       cursor: 'pointer', fontWeight: i === page ? 700 : 400,
                       fontSize: '0.85rem', transition: 'all 0.15s',
                     }}
                  >{i + 1}</button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Pinning UI ── */}
        <div className="card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📌 포지션 고정 (선택 사항)</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              슬롯을 클릭한 뒤 왼쪽 목록에서 선수를 누르면 고정됩니다.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(59,130,246,0.05)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ color: '#3b82f6', fontWeight: 700, marginBottom: '0.75rem', textAlign: 'center' }}>🔵 Blue Team</div>
              {POSITION_LABELS.map((label, i) => {
                const posStr = label.toLowerCase();
                const pinKey = `A_${posStr}`;
                const isActive = activeSlot?.team === 'A' && activeSlot?.pos === posStr;
                const pId = pinnedPositions[pinKey];
                return (
                  <div key={pinKey} onClick={() => handleSlotClick('A', posStr)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', marginBottom: '0.4rem', borderRadius: '6px', cursor: 'pointer',
                    background: isActive ? 'rgba(59,130,246,0.2)' : 'var(--panel-bg)',
                    border: isActive ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    transition: 'all 0.15s'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{POSITION_ICONS[i]} {label}</span>
                    <span style={{ fontWeight: pId ? 700 : 400, color: pId ? '#3b82f6' : 'var(--text-secondary)' }}>
                      {pId ? getPlayerName(pId) : '비어있음'}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div style={{ background: 'rgba(239,68,68,0.05)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: '0.75rem', textAlign: 'center' }}>🔴 Red Team</div>
              {POSITION_LABELS.map((label, i) => {
                const posStr = label.toLowerCase();
                const pinKey = `B_${posStr}`;
                const isActive = activeSlot?.team === 'B' && activeSlot?.pos === posStr;
                const pId = pinnedPositions[pinKey];
                return (
                  <div key={pinKey} onClick={() => handleSlotClick('B', posStr)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', marginBottom: '0.4rem', borderRadius: '6px', cursor: 'pointer',
                    background: isActive ? 'rgba(239,68,68,0.2)' : 'var(--panel-bg)',
                    border: isActive ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    transition: 'all 0.15s'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{POSITION_ICONS[i]} {label}</span>
                    <span style={{ fontWeight: pId ? 700 : 400, color: pId ? '#ef4444' : 'var(--text-secondary)' }}>
                      {pId ? getPlayerName(pId) : '비어있음'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
