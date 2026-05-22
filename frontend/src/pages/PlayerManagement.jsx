import { useState, useEffect } from 'react';
import axios from 'axios';

const POSITIONS = [
  { id: 'top', label: 'Top' },
  { id: 'jungle', label: 'Jungle' },
  { id: 'mid', label: 'Mid' },
  { id: 'adc', label: 'ADC' },
  { id: 'support', label: 'Support' }
];

export default function PlayerManagement({ token, userInfo }) {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState('');
  const [lolId, setLolId] = useState('');
  
  // 포지션 선호도: preferred, non_preferred, impossible
  const [positionPreferences, setPositionPreferences] = useState({
    top: 'non_preferred', jungle: 'non_preferred', mid: 'non_preferred', adc: 'non_preferred', support: 'non_preferred'
  });
  
  const [copyFromIds, setCopyFromIds] = useState({ top: '', jungle: '', mid: '', adc: '', support: '' });

  // 내 정보 편집용 state
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPrefs, setEditPrefs] = useState({
    top: 'non_preferred', jungle: 'non_preferred', mid: 'non_preferred', adc: 'non_preferred', support: 'non_preferred'
  });

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const res = await axios.get('/api/players');
    setPlayers(res.data);
  };

  const handlePreferenceChange = (posId, pref) => {
    setPositionPreferences(prev => ({ ...prev, [posId]: pref }));
    
    // 만약 불가(impossible)로 바뀌었다면 복사 대상을 초기화
    if (pref === 'impossible') {
      setCopyFromIds(prev => ({ ...prev, [posId]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    
    const fullName = lolId ? `${name} / ${lolId}` : name;

    const preferred_positions = POSITIONS.filter(p => positionPreferences[p.id] === 'preferred').map(p => p.id);
    const non_preferred_positions = POSITIONS.filter(p => positionPreferences[p.id] === 'non_preferred').map(p => p.id);
    const impossible_positions = POSITIONS.filter(p => positionPreferences[p.id] === 'impossible').map(p => p.id);

    if (preferred_positions.length === 0) {
      alert('최소 한 개의 포지션은 반드시 🥰 선호로 설정해 주셔야 합니다.');
      return;
    }

    try {
      await axios.post('/api/players', {
        name: fullName,
        impossible_positions,
        preferred_positions,
        non_preferred_positions,
        copy_top_id: copyFromIds.top ? Number(copyFromIds.top) : null,
        copy_jungle_id: copyFromIds.jungle ? Number(copyFromIds.jungle) : null,
        copy_mid_id: copyFromIds.mid ? Number(copyFromIds.mid) : null,
        copy_adc_id: copyFromIds.adc ? Number(copyFromIds.adc) : null,
        copy_support_id: copyFromIds.support ? Number(copyFromIds.support) : null,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setName('');
      setLolId('');
      setPositionPreferences({ top: 'non_preferred', jungle: 'non_preferred', mid: 'non_preferred', adc: 'non_preferred', support: 'non_preferred' });
      setCopyFromIds({ top: '', jungle: '', mid: '', adc: '', support: '' });
      fetchPlayers();
      alert('선수가 추가되었습니다.');
    } catch (err) {
      alert('추가 실패: ' + (err.response?.data?.detail || err.message));
    }
  };

  const startEditing = (player) => {
    setEditingPlayerId(player.id);
    const imp = JSON.parse(player.impossible_positions || '[]');
    const pref = JSON.parse(player.preferred_positions || '[]');
    const npref = JSON.parse(player.non_preferred_positions || '[]');
    
    const initialPrefs = {
      top: 'non_preferred', jungle: 'non_preferred', mid: 'non_preferred', adc: 'non_preferred', support: 'non_preferred'
    };
    
    POSITIONS.forEach(pos => {
      if (imp.includes(pos.id)) {
        initialPrefs[pos.id] = 'impossible';
      } else if (pref.includes(pos.id)) {
        initialPrefs[pos.id] = 'preferred';
      } else if (npref.includes(pos.id)) {
        initialPrefs[pos.id] = 'non_preferred';
      }
    });
    setEditPrefs(initialPrefs);
  };

  const cancelEditing = () => {
    setEditingPlayerId(null);
  };

  const handleSaveEdit = async (playerId) => {
    const preferred_positions = POSITIONS.filter(p => editPrefs[p.id] === 'preferred').map(p => p.id);
    const non_preferred_positions = POSITIONS.filter(p => editPrefs[p.id] === 'non_preferred').map(p => p.id);

    if (preferred_positions.length === 0) {
      alert('최소 한 개의 포지션은 반드시 🥰 선호로 설정해 주셔야 합니다.');
      return;
    }

    try {
      await axios.put(`/api/players/${playerId}/preferences`, {
        preferred_positions,
        non_preferred_positions
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingPlayerId(null);
      fetchPlayers();
      alert('선호 포지션이 성공적으로 변경되었습니다.');
    } catch (err) {
      alert('수정 실패: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{display: 'flex', gap: '2rem'}}>
      <div className="card" style={{flex: 1}}>
        <h2>👥 선수 추가</h2>
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '1rem', display: 'flex', gap: '1rem'}}>
            <div style={{flex: 1}}>
              <label style={{display: 'block', marginBottom: '0.5rem'}}>이름</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 안지원" required />
            </div>
            <div style={{flex: 1}}>
              <label style={{display: 'block', marginBottom: '0.5rem'}}>롤 아이디</label>
              <input value={lolId} onChange={e => setLolId(e.target.value)} placeholder="예: 초코타코#kr1" />
            </div>
          </div>

          <div style={{marginBottom: '1rem'}}>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>포지션 선호도 (각 포지션별 1개 선택)</label>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
              {POSITIONS.map(pos => (
                <div key={pos.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '4rem', color: 'var(--text-primary)' }}>{pos.label}</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[
                      { val: 'preferred', label: '🥰 선호', bg: 'rgba(76,175,80,0.2)', border: '#4caf50', activeColor: '#4caf50' },
                      { val: 'non_preferred', label: '😟 비선호', bg: 'rgba(255,152,0,0.2)', border: '#ff9800', activeColor: '#ff9800' },
                      { val: 'impossible', label: '❌ 불가', bg: 'rgba(244,67,54,0.2)', border: '#f44336', activeColor: '#f44336' },
                    ].map(opt => {
                      const isActive = positionPreferences[pos.id] === opt.val;
                      return (
                        <button
                          type="button"
                          key={opt.val}
                          onClick={() => handlePreferenceChange(pos.id, opt.val)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            border: `1px solid ${isActive ? opt.activeColor : 'var(--border-color)'}`,
                            background: isActive ? opt.bg : 'transparent',
                            color: isActive ? opt.activeColor : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginBottom: '1.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>초기 점수 복사 (각 포지션별 비슷한 실력자 선택)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {POSITIONS.map(pos => {
                const isImpossible = positionPreferences[pos.id] === 'impossible';
                return (
                  <div key={pos.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      width: '4rem', 
                      color: isImpossible ? 'var(--loss-color)' : 'var(--text-primary)', 
                      textDecoration: isImpossible ? 'line-through' : 'none' 
                    }}>
                      {pos.label}
                    </span>
                    <select 
                      value={copyFromIds[pos.id]} 
                      onChange={(e) => setCopyFromIds({...copyFromIds, [pos.id]: e.target.value})}
                      disabled={isImpossible}
                      style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: isImpossible ? 'rgba(255,255,255,0.05)' : 'var(--panel-bg)', color: isImpossible ? 'var(--text-secondary)' : 'var(--text-primary)' }}
                    >
                      <option value="">기본 점수 (50.0) 유지</option>
                      {players.map(p => {
                        const canPlay = !JSON.parse(p.impossible_positions || '[]').includes(pos.id);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} {canPlay ? '' : '(불가)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn" style={{width: '100%'}}>선수 등록</button>
        </form>
      </div>

      <div className="card" style={{flex: 1}}>
        <h2>목록 ({players.length}명)</h2>
        <div style={{maxHeight: '500px', overflowY: 'auto'}}>
          {players.map(p => {
            const imp = JSON.parse(p.impossible_positions || '[]');
            const pref = JSON.parse(p.preferred_positions || '[]');
            const npref = JSON.parse(p.non_preferred_positions || '[]');

            // 본인 카드 여부 판별 (이름 / 롤아이디 형식)
            const nameParts = p.name.split(" / ");
            const playerLolId = nameParts[1] ? nameParts[1].trim() : null;
            const isMe = userInfo && userInfo.lol_id && playerLolId === userInfo.lol_id.trim();
            const isEditing = editingPlayerId === p.id;

            if (isEditing) {
              return (
                <div key={p.id} style={{padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)'}}>
                  <div style={{fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem'}}>{p.name} (편집 중)</div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px'}}>
                    {POSITIONS.map(pos => {
                      const isImpossible = editPrefs[pos.id] === 'impossible';
                      return (
                        <div key={pos.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.85rem', color: isImpossible ? 'var(--loss-color)' : 'var(--text-primary)', textDecoration: isImpossible ? 'line-through' : 'none' }}>
                            {pos.label}
                          </span>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {isImpossible ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>❌ 불가 (수정 불가)</span>
                            ) : (
                              [
                                { val: 'preferred', label: '🥰 선호', bg: 'rgba(76,175,80,0.2)', border: '#4caf50', activeColor: '#4caf50' },
                                { val: 'non_preferred', label: '😟 비선호', bg: 'rgba(255,152,0,0.2)', border: '#ff9800', activeColor: '#ff9800' }
                              ].map(opt => {
                                const isActive = editPrefs[pos.id] === opt.val;
                                return (
                                  <button
                                    type="button"
                                    key={opt.val}
                                    onClick={() => setEditPrefs(prev => ({ ...prev, [pos.id]: opt.val }))}
                                    style={{
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      border: `1px solid ${isActive ? opt.activeColor : 'var(--border-color)'}`,
                                      background: isActive ? opt.bg : 'transparent',
                                      color: isActive ? opt.activeColor : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                    <button 
                      type="button" 
                      onClick={() => handleSaveEdit(p.id)}
                      style={{padding: '0.3rem 0.75rem', fontSize: '0.8rem', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                    >
                      저장
                    </button>
                    <button 
                      type="button" 
                      onClick={cancelEditing}
                      style={{padding: '0.3rem 0.75rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer'}}
                    >
                      취소
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={p.id} style={{padding: '1rem', borderBottom: '1px solid var(--border-color)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                  <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{p.name}</div>
                  {isMe && (
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => startEditing(p)}
                      style={{padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: 'var(--accent-color)'}}
                    >
                      ⚙️ 내 선호도 수정
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {pref.length > 0 && (
                    <span style={{fontSize: '0.8rem', color: '#4caf50', background: 'rgba(76,175,80,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px'}}>
                      🥰 선호: {pref.join(', ')}
                    </span>
                  )}
                  {npref.length > 0 && (
                    <span style={{fontSize: '0.8rem', color: '#ff9800', background: 'rgba(255,152,0,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px'}}>
                      😟 비선호: {npref.join(', ')}
                    </span>
                  )}
                  {imp.length > 0 && (
                    <span style={{fontSize: '0.8rem', color: '#f44336', background: 'rgba(244,67,54,0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px'}}>
                      ❌ 불가: {imp.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
