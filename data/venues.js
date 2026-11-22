// 공연장 정보. 숫자는 모두 기관 공개 자료에서 옮겼고 출처를 함께 둔다.
// floorY·stageY·center 는 3D 모델 좌표(미터, Y가 위)에서 직접 잰 값이다(scripts 아님, plan.html?probe=1 로 확인).
window.OLPARK_VENUES = {
  woori: {
    key: 'woori',
    name: '우리금융아트홀',
    kind: '실내 공연장',
    model: 'woori',
    modelSource: '공공데이터포털 15127487 올림픽공원 공연장 실감형 콘텐츠 (woori_glb.zip, 원본 170MB)',
    eventMatch: '우리금융|역도경기장',
    floorY: -1.25, // 주무대 바닥. 객석 앞 바닥(-2.32)과 1.07m 차이 = 공개 제원 '객석바닥→무대 1m7cm'와 일치
    cutH: 11, // 무대탑 지붕을 걷어 내고 보는 단면 높이(무대 바닥 위 m)
    specs: {
      stageW: 47, stageD: 22.6,
      procW: 15.8, procH: 8.7,
      gridH: 19.1,
      stageRise: 1.07,
      loadIn: { w: 4.3, h: 2.9, label: '외부 장치 반입구' },
      sideLoadIn: { w: 4.0, h: 3.0, label: '무대 옆 장치 반입구' },
      batten: { count: 29, len: 20, live: 750 },
      apronLive: [200, 750, 200],
      chainMotor: { cap: 1000, count: 6 },
      decks: [{ w: 1.2, d: 1.8, n: 18 }, { w: 0.9, d: 1.8, n: 18 }],
      trapStage: { w: 19.4, d: 10.62 },
    },
    specSource: '한국체육산업개발 누리집 대관&시설자료 › 우리금융아트홀 › 무대운영(f10.hwp) 「WOORI ART HALL 무대 현황」',
    missing: ['배튼별 위치(무대 앞에서 거리)', '전기 용량(무대·객석 분전반)', '객석 단차·좌석 좌표'],
  },
  '88': {
    key: '88',
    name: '88잔디마당',
    kind: '야외 공연장',
    model: '88',
    modelSource: '공공데이터포털 15127487 올림픽공원 공연장 실감형 콘텐츠 (88_glb.zip, 원본 10.9MB)',
    eventMatch: '88잔디|잔디마당',
    floorY: -2.3, // 잔디밭은 가장자리 -1.6m ~ 가운데 -2.7m 의 완만한 사발형. 장비는 놓는 자리 지면에 자동으로 붙는다
    cutH: null,
    specs: {},
    specSource: '야외 공연장은 기관이 무대 제원 자료를 공개하지 않았다(실감형 콘텐츠만 있음).',
    missing: ['전기 인입 위치·용량', '차량 반입 경로 폭·하중', '잔디 보호 바닥재 기준', '소음 제한(시간대별 dB)'],
  },
};
