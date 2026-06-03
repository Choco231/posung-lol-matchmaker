import React from 'react';

export default function Guide() {
  const sections = [
    {
      title: '전체 랭킹 (MMR)',
      desc: '경기 결과를 기반으로 선수들의 포지션별 TrueSkill MMR을 보여주는 공개 화면입니다.',
      details: [
        '기본 점수는 평균 50점에서 시작합니다.',
        '평균 MMR은 불가능 포지션을 제외하고 계산합니다.',
        '컬럼 헤더를 클릭하면 해당 포지션 기준으로 정렬할 수 있습니다.',
      ],
      icon: '🏆',
      badge: '모든 사용자',
    },
    {
      title: '내전 결과',
      desc: '기록된 실전 경기 결과를 최신순으로 확인하는 공개 화면입니다.',
      details: [
        '실제 경기 결과만 표시합니다.',
        'Blue/Red 팀의 라인별 참가자와 승리 팀을 확인할 수 있습니다.',
        '기록자 정보는 공개 결과 화면에 노출하지 않습니다.',
      ],
      icon: '📊',
      badge: '모든 사용자',
    },
    {
      title: '선수 관리',
      desc: '경기에 참여하는 선수 명단, 포지션 선호도, 초기 MMR을 관리합니다.',
      details: [
        '각 포지션은 선호, 비선호, 불가능 중 하나로 지정합니다.',
        '최소 1개 포지션은 선호로 설정해야 합니다.',
        '새 선수 등록 시 기존 선수의 포지션별 점수를 복사해 초기값으로 사용할 수 있습니다.',
      ],
      icon: '👥',
      badge: '로그인 사용자',
    },
    {
      title: '팀 짜기',
      desc: '10명을 선택해 MMR 차이가 작은 5대5 팀 조합을 추천합니다.',
      details: [
        '불가능 포지션은 배정하지 않습니다.',
        '특정 포지션에 선수를 고정한 뒤 나머지 배치를 계산할 수 있습니다.',
        '추천 결과에서 바로 실전 기록 화면으로 이동할 수 있습니다.',
      ],
      icon: '⚔️',
      badge: '로그인 사용자',
    },
    {
      title: '실전 기록',
      desc: '실제 경기 종료 후 승리 팀을 기록하고 선수 MMR을 갱신합니다.',
      details: [
        'Blue/Red 팀의 라인업을 지정한 뒤 승리 팀을 선택합니다.',
        '기록이 저장되면 해당 포지션의 TrueSkill 점수가 즉시 갱신됩니다.',
        '상세 기록 모드에서는 밴픽과 피어리스 밴도 함께 남길 수 있습니다.',
      ],
      icon: '📝',
      badge: '로그인 사용자',
    },
    {
      title: '관리자',
      desc: '가입 승인, 권한 변경, 사용자 표시 정보 수정을 처리합니다.',
      details: [
        '승인된 사용자만 선수 등록과 경기 기록 기능을 사용할 수 있습니다.',
        '데이터 관리 화면에서는 사용자 정보를 관리합니다.',
      ],
      icon: '🛠️',
      badge: '관리자 전용',
    },
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>호령회 LOL 스크림 이용 가이드</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          주요 화면의 목적과 사용 흐름을 정리했습니다.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {sections.map((sec) => (
          <div key={sec.title} className="card guide-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', padding: '1.5rem' }}>
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
                  background: sec.badge === '관리자 전용' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(94, 106, 210, 0.15)',
                  color: sec.badge === '관리자 전용' ? '#ff7878' : 'var(--accent-hover)',
                }}>
                  {sec.badge}
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                {sec.desc}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                {sec.details.map((detail) => (
                  <li key={detail} style={{ marginBottom: '0.35rem' }}>{detail}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
