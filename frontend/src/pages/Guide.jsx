import React from 'react';

export default function Guide() {
  const sections = [
    {
      title: '👑 전체 랭킹 (MMR)',
      desc: '경기 결과를 분석하여 플레이어들의 실시간 실력 점수(MMR)를 보여주는 메인 랭킹판입니다.',
      details: [
        '기본 실력 점수는 평균 50점(0~100점 범위)에서 시작하며, 플레이어별 전적이 쌓임에 따라 실시간 반영됩니다.',
        '평균 MMR은 플레이어가 갈 수 있는 포지션(불가 포지션 제외) 점수들의 평균으로 공정하게 계산됩니다.',
        '포지션 헤더(Top, Jungle 등)를 클릭하여 각 라인별 순위를 볼 수 있으며, 해당 라인이 "불가"인 선수는 자동으로 목록 최하단으로 정렬됩니다.'
      ],
      icon: '👑',
      badge: '모든 사용자'
    },
    {
      title: '👥 선수 관리',
      desc: '경기에 참가하는 선수들의 명단을 등록하고, 포지션 선호도 및 초기 실력을 설정하는 페이지입니다.',
      details: [
        '선수 등록 시 5개 포지션(탑, 정글, 미드, 원딜, 서폿)에 대해 "선호", "비선호", "불가" 3가지 중 하나를 무조건 선택해야 합니다.',
        '더 합리적인 매칭을 위해 최소 1개 포지션은 반드시 "선호"로 설정해 주셔야 합니다.',
        '새로운 선수 등록 시 기존에 등록된 다른 선수와 비슷한 실력일 경우, 실력 점수(MMR)를 복사해서 초기화할 수 있습니다.'
      ],
      icon: '👥',
      badge: '로그인 유저'
    },
    {
      title: '⚖️ 팀 짜기 (10인)',
      desc: '10명의 참여 선수를 선택하여 MMR 밸런스와 라인 선호도가 가장 잘 맞는 최적의 5대5 팀을 생성합니다.',
      details: [
        'AI 매칭 알고리즘이 작동하여 블루 팀과 레드 팀의 평균 MMR 격차가 최소화되도록 라인업을 구성합니다.',
        '선수들의 포지션별 선호도와 불가 포지션을 고려하여 최선의 포지션 배치를 탐색합니다.',
        '특정 라인에 선수를 고정(Pin 📌)해 두고 나머지 라인만 밸런스를 맞추도록 팀을 자동 구성할 수도 있습니다.'
      ],
      icon: '⚖️',
      badge: '로그인 유저'
    },
    {
      title: '⚔️ 실전 결과 기록',
      desc: '내전 또는 토너먼트 경기가 끝난 후 실제 매치 결과를 데이터베이스에 기록하는 페이지입니다.',
      details: [
        '블루 팀과 레드 팀의 라인업을 지정하고 "블루 승리" 또는 "레드 승리" 버튼을 통해 결과를 기록합니다.',
        '결과가 전송되면 TrueSkill™ 알고리즘에 의해 플레이한 10명 선수의 MMR 점수가 실시간으로 업데이트됩니다.',
        '기록된 데이터는 영구적으로 서버 DB에 누적되어 정교한 실력 측정의 바탕이 됩니다.'
      ],
      icon: '⚔️',
      badge: '로그인 유저'
    },
    {
      title: '🧪 가상 데이터 입력',
      desc: '선수들의 실물 데이터가 없는 첫 시작 단계에서, 초기 MMR 점수를 정밀하게 설정하고 밸런스를 잡기 위해 사용하는 전용 기능입니다.',
      details: [
        '가상 경기로 입력된 결과도 실제 데이터베이스에 반영되어 선수들의 MMR 실력 점수를 변동시키고 기록을 축적합니다.',
        '완전 무작위가 아닌, 선수들의 포지션 선호 가중치(선호 2.0배, 비선호 0.7배, 불가 0배)를 기반으로 모의 팀이 정교하게 매칭됩니다.',
        '실전 내전 전에 가상 경기를 여러 판 입력해 봄으로써, TrueSkill™ 알고리즘이 각 선수의 기량에 걸맞은 신뢰도 높은 "초기 MMR 점수 및 분포"를 형성할 수 있도록 돕습니다.'
      ],
      icon: '🧪',
      badge: '로그인 유저'
    },
    {
      title: '🛡️ 관리자 (가입승인)',
      desc: '사이트에 새로 가입한 일반 사용자가 선수 등록 및 전적 입력을 할 수 있도록 권한을 승인하는 관리용 페이지입니다.',
      details: [
        '가입 승인이 완료된 계정만 데이터 쓰기/수정 권한을 가집니다.',
        '승인되지 않은 멤버에게는 선수 관리, 결과 기록 등의 관리 메뉴가 완전히 숨겨집니다.'
      ],
      icon: '🛡️',
      badge: '관리자 전용'
    },
    {
      title: '🛠️ 데이터 관리',
      desc: '가입 유저들의 정보를 교정하고, 시스템에 영구 축적된 실전 및 가상 매치 기록을 테이블 형식으로 통합 조회하는 관리자 전용 대시보드입니다.',
      details: [
        '가입 유저들의 로그인 ID를 제외한 이름(표시명), 롤 아이디 정보를 즉시 수정하여 오타나 변경 사항을 반영할 수 있습니다.',
        '그동안 입력된 모든 실전 및 가상 매치 기록을 분류 배지와 함께 조회할 수 있으며, 서버 부하 방지를 위해 페이징(Pagination) 처리가 적용되어 있습니다.'
      ],
      icon: '🛠️',
      badge: '관리자 전용'
    },
    {
      title: '📊 TrueSkill™ 실력 분석 시스템',
      desc: 'Microsoft가 개발한 베이지안 확률 추론 기반의 진보된 실력 평점 시스템으로, 기존 Elo 시스템의 한계를 극복합니다.',
      details: [
        '실력의 불확실성(σ, 시그마) 개념 도입: 시스템은 플레이어의 MMR을 "예상 실력(μ, 뮤)"과 "불확실성(σ)"의 두 매개변수로 관리합니다.',
        '판수가 적은 초반(데이터가 쌓이기 전): 불확실성(σ)이 크기 때문에, 실력을 빠르게 판단하기 위해 경기 결과에 따른 MMR 변동폭(상승/하락)이 매우 크게 작동합니다.',
        '판수가 많아진 후(신뢰 데이터 축적): 시스템이 플레이어의 진짜 실력대를 확신하게 됨에 따라 불확실성(σ)이 작아지고 MMR의 급격한 변동폭이 감소하여 실력 점수가 안정화됩니다.',
        '실력 고착화 방지(최소 변동 유지): 플레이어의 기량이 갑자기 향상되거나 저하될 수 있으므로, 내부 노이즈 보정(τ, 타우)을 통해 데이터가 무한히 쌓이더라도 실력이 변동될 수 있는 일정 수준의 최소 변동폭은 항상 보장합니다.'
      ],
      icon: '📊',
      badge: '알고리즘 가이드'
    }
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>📖 호낳대 시스템 이용 가이드</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          호낳대 LoL 토너먼트 매칭 시스템의 주요 기능들과 작동 목적에 대해 소개합니다.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {sections.map((sec, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', padding: '1.5rem' }}>
            <div style={{
              fontSize: '2.5rem',
              background: 'rgba(94, 106, 210, 0.1)',
              padding: '1rem',
              borderRadius: '12px',
              minWidth: '70px',
              height: '70px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 10px rgba(94, 106, 210, 0.1)'
            }}>
              {sec.icon}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{sec.title}</h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  background: sec.badge === '관리자 전용' ? 'rgba(239, 68, 68, 0.15)' : (sec.badge === '로그인 유저' ? 'rgba(94, 106, 210, 0.15)' : (sec.badge === '알고리즘 가이드' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.08)')),
                  color: sec.badge === '관리자 전용' ? '#ff7878' : (sec.badge === '로그인 유저' ? 'var(--accent-hover)' : (sec.badge === '알고리즘 가이드' ? '#34d399' : 'var(--text-secondary)')),
                  border: '1px solid transparent'
                }}>
                  {sec.badge}
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                {sec.desc}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                {sec.details.map((detail, dIdx) => (
                  <li key={dIdx} style={{ marginBottom: '0.35rem' }}>{detail}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
