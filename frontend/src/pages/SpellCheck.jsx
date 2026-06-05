import { useEffect, useMemo, useState } from 'react';

const LANES = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];
const SPELL_LABELS = {
  SummonerFlash: 'Flash',
  SummonerTeleport: 'Teleport',
  SummonerDot: 'Ignite',
  SummonerExhaust: 'Exhaust',
  SummonerHeal: 'Heal',
  SummonerBarrier: 'Barrier',
  SummonerHaste: 'Ghost',
  SummonerBoost: 'Cleanse',
  TopQuestTeleport: 'Top Quest TP',
};

function websocketUrl(token) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${proto}//${window.location.host}/api/spellcheck/ws${query}`;
}

export default function SpellCheck({ token }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [canControl, setCanControl] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const rows = useMemo(() => state?.slots || [], [state]);

  useEffect(() => {
    let closed = false;
    let ws;
    let retryTimer;

    const connect = () => {
      ws = new WebSocket(websocketUrl(token));
      ws.onopen = () => {
        setConnected(true);
        setError('');
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => setError('Spell check server connection failed.');
      ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'hello') {
          setCanControl(Boolean(message.canControl));
        }
        if (message.type === 'state') {
          setState(message.state);
        }
        if (message.type === 'error') {
          setError(message.message || 'Spell check error.');
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(timer);
  }, []);

  const remainingSeconds = (spell) => {
    if (!spell?.startedAt || !spell?.duration) return 0;
    return Math.max(0, Math.ceil(spell.duration - (now - spell.startedAt) / 1000));
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <h2>Spell Check Sync</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Overlay에서 변경한 중앙 spell check 상태를 실시간으로 확인하는 페이지입니다.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.25rem 0.55rem', borderRadius: '6px', background: connected ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.12)', color: connected ? '#34d399' : '#f87171' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span style={{ padding: '0.25rem 0.55rem', borderRadius: '6px', background: canControl ? 'rgba(94,106,210,0.18)' : 'rgba(255,255,255,0.06)', color: canControl ? 'var(--accent-hover)' : 'var(--text-secondary)' }}>
          {canControl ? 'Admin control enabled' : 'View only'}
        </span>
        {state?.updatedBy && (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
            Last update: {state.updatedBy} / {state.updatedAt}
          </span>
        )}
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'grid', gap: '0.65rem', maxWidth: '560px' }}>
        {rows.map((spells, index) => (
          <div key={LANES[index]} style={{ display: 'grid', gridTemplateColumns: '4rem 1fr', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)' }}>
            <strong>{LANES[index]}</strong>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {(spells || []).map((spell, slotIndex) => (
                <span key={`${spell.id}-${slotIndex}`} style={{ padding: '0.3rem 0.55rem', borderRadius: '6px', background: remainingSeconds(spell) > 0 ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.06)', color: remainingSeconds(spell) > 0 ? '#fbbf24' : 'var(--text-primary)' }}>
                  {SPELL_LABELS[spell.id] || spell.id}
                  {remainingSeconds(spell) > 0 ? ` ${formatTime(remainingSeconds(spell))}` : ''}
                </span>
              ))}
              {state?.mods?.[index]?.ionian && <span style={{ color: '#38bdf8', fontSize: '0.8rem' }}>Ionian</span>}
              {state?.mods?.[index]?.cosmic && <span style={{ color: '#a78bfa', fontSize: '0.8rem' }}>Cosmic</span>}
              {index === 0 && state?.mods?.[index]?.unleashed && <span style={{ color: '#facc15', fontSize: '0.8rem' }}>Top TP upgrade</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
