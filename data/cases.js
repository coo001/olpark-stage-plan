// 설계 사례. 실제 공연 의뢰가 아니라 공개 자료로 세운 가정 조건이다(화면·기획서에 같은 문장을 적는다).
// y 를 비워 두면 불러올 때 3D 모델 지면에 자동으로 붙는다.
window.OLPARK_CASES = {
  park88: {
    venue: '88',
    title: '사례 1 · 야외 페스티벌 3천 명',
    note: '가정: 하루 1회, 스탠딩 3천 명 규모 야외 음악 공연. 무대는 입구 반대편 가장자리, 콘솔은 가운데 원형 광장.',
    plan: {
      v: '88',
      m: { title: '사례 1 · 88잔디마당 야외 페스티벌(가정)', date: '', loadIn: '', rehearsal: '', strike: '', cast: '', crew: '' },
      i: [
        { type: 'deck', name: '메인 무대', w: 18, d: 12, h: 1.8, x: 0, z: -32, rot: 0 },
        { type: 'truss', name: '앞 트러스', w: 20, d: 0.3, h: 0.3, elev: 9, hang: 'ground', x: 0, z: -27.5, rot: 0 },
        { type: 'truss', name: '뒤 트러스', w: 20, d: 0.3, h: 0.3, elev: 10, hang: 'ground', x: 0, z: -36, rot: 0 },
        ...[-8, -5.5, -3, -1, 1, 3, 5.5, 8].map((x, k) => ({ type: 'light', name: `앞 조명 ${k + 1}`, w: 0.4, d: 0.4, h: 0.5, elev: 9, weight: 30, x, z: -27.5, rot: 0 })),
        ...[-7, -3, 3, 7].map((x, k) => ({ type: 'light', name: `뒤 조명 ${k + 1}`, w: 0.4, d: 0.4, h: 0.5, elev: 10, weight: 30, x, z: -36, rot: 0 })),
        { type: 'speaker', name: '메인 스피커 왼쪽', w: 1.4, d: 1.2, h: 6, elev: 4, weight: 900, x: -11.5, z: -27, rot: 0 },
        { type: 'speaker', name: '메인 스피커 오른쪽', w: 1.4, d: 1.2, h: 6, elev: 4, weight: 900, x: 11.5, z: -27, rot: 0 },
        { type: 'fence', name: '무대 앞 펜스', w: 24, d: 0.1, h: 1.2, x: 0, z: -24, rot: 0 },
        { type: 'seats', name: '앞 스탠딩', w: 30, d: 10, h: 0.05, mode: 'standing', x: 0, z: -18, rot: 0 },
        { type: 'seats', name: '왼쪽 스탠딩', w: 16, d: 24, h: 0.05, mode: 'standing', x: -22, z: -2, rot: 0 },
        { type: 'seats', name: '오른쪽 스탠딩', w: 16, d: 24, h: 0.05, mode: 'standing', x: 22, z: -2, rot: 0 },
        { type: 'seats', name: '뒤 스탠딩', w: 34, d: 10, h: 0.05, mode: 'standing', x: 0, z: 17, rot: 0 },
        { type: 'foh', name: '콘솔(FOH)', w: 5, d: 4, h: 1.0, x: 0, z: 0, rot: 0 },
      ],
    },
  },
  woori: {
    venue: 'woori',
    title: '사례 2 · 실내 밴드 콘서트',
    note: '가정: 5인조 밴드 콘서트, 조명은 공연장 배튼 2개에 트러스를 걸고, 밴드 라이저는 공연장 보유 덧마루로 만든다.',
    plan: {
      v: 'woori',
      m: { title: '사례 2 · 우리금융아트홀 밴드 콘서트(가정)', date: '', loadIn: '', rehearsal: '', strike: '', cast: '', crew: '' },
      i: [
        { type: 'deck', name: '밴드 라이저', w: 12, d: 5.4, h: 0.6, x: -8.5, z: -3.7, rot: 90 },
        { type: 'truss', name: '1번 조명 트러스(배튼)', w: 14, d: 0.3, h: 0.3, elev: 8, hang: 'batten', x: -15, z: -3.7, rot: 90 },
        { type: 'truss', name: '2번 조명 트러스(배튼)', w: 14, d: 0.3, h: 0.3, elev: 8.5, hang: 'batten', x: -6, z: -3.7, rot: 90 },
        ...[-9.7, -7.7, -5.7, -3.7, -1.7, 0.3, 2.3].map((z, k) => ({ type: 'light', name: `1번 조명 ${k + 1}`, w: 0.4, d: 0.4, h: 0.5, elev: 8, weight: 32, x: -15, z, rot: 0 })),
        ...[-8.7, -5.7, -1.7, 1.3].map((z, k) => ({ type: 'light', name: `2번 조명 ${k + 1}`, w: 0.4, d: 0.4, h: 0.5, elev: 8.5, weight: 32, x: -6, z, rot: 0 })),
        { type: 'speaker', name: '메인 스피커 왼쪽', w: 1.0, d: 1.0, h: 2.8, elev: 0, weight: 250, x: -16.2, z: -11.8, rot: 0 },
        { type: 'speaker', name: '메인 스피커 오른쪽', w: 1.0, d: 1.0, h: 2.8, elev: 0, weight: 250, x: -16.2, z: 4.4, rot: 0 },
        { type: 'set', name: '배경 세트 벽(2쪽 중 1)', w: 4.0, d: 0.4, h: 4.2, x: -3, z: -6.0, rot: 90 },
        { type: 'set', name: '배경 세트 벽(2쪽 중 2)', w: 4.0, d: 0.4, h: 4.2, x: -3, z: -1.4, rot: 90 },
        { type: 'seats', name: '1층 객석 범위(거리 점검용)', w: 16, d: 22, h: 0.05, mode: 'seated', x: -28, z: -3.7, rot: 0 },
        { type: 'foh', name: '콘솔(FOH)', w: 3, d: 2.5, h: 1.0, x: -33.5, z: -3.7, rot: 0 },
      ],
    },
  },
};
