// 장비 종류와 자동 점검.
// 점검 기준은 두 갈래다: ① 기관이 공개한 공연장 제원(venues.js) ② 업계 관행(참고). 화면에 어느 쪽인지 적는다.

export const TYPES = {
  deck: {
    label: '무대 덱', color: 0x3f3f46, hint: '무대 바닥. 가로·세로·높이를 입력합니다.',
    defaults: { w: 12, d: 8, h: 1.2 }, fields: ['w', 'd', 'h', 'x', 'z', 'rot', 'y'],
  },
  truss: {
    label: '트러스', color: 0x9ca3af, hint: '조명·스피커를 거는 가로 트러스. 그라운드 서포트면 양 끝에 타워가 섭니다.',
    defaults: { w: 12, d: 0.3, h: 0.3, elev: 7, hang: 'ground', weight: 0 }, fields: ['w', 'elev', 'x', 'z', 'rot', 'y'],
  },
  light: {
    label: '조명기', color: 0xf59e0b, hint: '무빙·스팟 등 조명기 1대. 무게와 설치 높이를 입력합니다.',
    defaults: { w: 0.4, d: 0.4, h: 0.5, elev: 7, weight: 25 }, fields: ['elev', 'weight', 'x', 'z', 'y'],
  },
  speaker: {
    label: '스피커', color: 0x27272a, hint: '메인 스피커(라인어레이 한 조 또는 스택).',
    defaults: { w: 1.2, d: 1.0, h: 4, elev: 0, weight: 300 }, fields: ['w', 'd', 'h', 'elev', 'weight', 'x', 'z', 'rot', 'y'],
  },
  foh: {
    label: '음향·조명 콘솔', color: 0x1d4ed8, hint: 'FOH(객석 쪽 콘솔 자리). 여기서 무대가 보여야 합니다.',
    defaults: { w: 4, d: 3, h: 1.0 }, fields: ['w', 'd', 'h', 'x', 'z', 'rot', 'y'],
  },
  seats: {
    label: '객석 블록', color: 0xcbd5e1, hint: '지정석 또는 스탠딩 구역. 크기에서 수용 인원을 셉니다.',
    defaults: { w: 20, d: 15, h: 0.05, mode: 'seated' }, fields: ['w', 'd', 'x', 'z', 'rot', 'y'],
  },
  fence: {
    label: '펜스', color: 0xe11d48, hint: '무대 앞 안전 펜스·구역 펜스.',
    defaults: { w: 10, d: 0.1, h: 1.2 }, fields: ['w', 'h', 'x', 'z', 'rot', 'y'],
  },
  set: {
    label: '세트(장치)', color: 0x92400e, hint: '반입할 무대 장치 한 덩어리. 반입구를 통과하는지 봅니다.',
    defaults: { w: 6, d: 1, h: 4 }, fields: ['w', 'd', 'h', 'x', 'z', 'rot', 'y'],
  },
};

// 가정값(업계 관행). 기획서·화면 「한계」에 같은 값을 적는다.
export const ASSUME = {
  seatW: 0.5, seatRow: 0.9, // 지정석 1석 폭·줄 간격(m)
  standingPerM2: 2, // 스탠딩 밀도(명/㎡)
  trussKgPerM: 12, // 30cm 박스 트러스 자중(kg/m)
  eye: 1.6, // 콘솔 앞 눈높이(m)
  actor: 1.7, // 무대 위 사람 키(m)
  delayM: 60, // 이 거리를 넘으면 딜레이 스피커 검토
  lightMin: 30, lightMax: 60, // 조명 입사각(수평면 기준, °)
};

export function seatCount(it) {
  if (it.mode === 'standing') return Math.floor(it.w * it.d * ASSUME.standingPerM2);
  return Math.floor(it.w / ASSUME.seatW) * Math.floor(it.d / ASSUME.seatRow);
}
export const deckArea = (it) => it.w * it.d;
export function itemWeight(it) {
  if (it.type === 'truss') return Math.round(it.w * ASSUME.trussKgPerM);
  return it.weight || 0;
}

const rad = (d) => (d * Math.PI) / 180;
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

// 장비 사각형의 네 모서리(평면, 회전 반영)
function corners(it) {
  const c = Math.cos(rad(it.rot || 0)), s = Math.sin(rad(it.rot || 0));
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const lx = (a * it.w) / 2, lz = (b * it.d) / 2;
    // three.js 의 Y축 회전과 같은 방향
    return [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  });
}
function nearestOnRect(it, px, pz) {
  // 점에서 가장 가까운 사각형 위의 점(평면)
  const c = Math.cos(rad(it.rot || 0)), s = Math.sin(rad(it.rot || 0));
  const dx = px - it.x, dz = pz - it.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const cx = Math.max(-it.w / 2, Math.min(it.w / 2, lx));
  const cz = Math.max(-it.d / 2, Math.min(it.d / 2, lz));
  return [it.x + cx * c + cz * s, it.z - cx * s + cz * c];
}
function segPointDist(ax, az, bx, bz, px, pz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(ax + t * vx - px, az + t * vz - pz);
}

export function runChecks(venue, items, { raycastVenue, THREE }) {
  const out = [];
  const floor = venue.floorY;
  const decks = items.filter((i) => i.type === 'deck');
  const seats = items.filter((i) => i.type === 'seats');
  const fohs = items.filter((i) => i.type === 'foh');
  const lights = items.filter((i) => i.type === 'light');
  const trusses = items.filter((i) => i.type === 'truss');
  const sets = items.filter((i) => i.type === 'set');
  const sp = venue.specs || {};
  const deck = decks[0];

  // 수용 인원
  if (seats.length) {
    const total = seats.reduce((a, s) => a + seatCount(s), 0);
    const st = seats.filter((s) => s.mode === 'standing').reduce((a, s) => a + seatCount(s), 0);
    out.push({
      status: 'info', title: '수용 인원(추정)', value: `${total.toLocaleString('ko-KR')}명`,
      detail: `지정석 ${(total - st).toLocaleString('ko-KR')}명 · 스탠딩 ${st.toLocaleString('ko-KR')}명. 통로·시야 제한석을 빼기 전 값입니다.`,
      basis: `지정석 ${ASSUME.seatW}m×${ASSUME.seatRow}m, 스탠딩 ㎡당 ${ASSUME.standingPerM2}명(가정)`,
    });
  }

  if (deck) {
    const top = floor + (deck.y || 0) + deck.h;
    const target = [deck.x, top + ASSUME.actor, deck.z];

    // 가장 먼 객석까지 거리
    if (seats.length) {
      let far = 0, farPt = null, nearPt = null;
      for (const s of seats) for (const [cx, cz] of corners(s)) {
        const [nx, nz] = nearestOnRect(deck, cx, cz);
        const d = Math.hypot(cx - nx, cz - nz);
        if (d > far) { far = d; farPt = [cx, cz]; nearPt = [nx, nz]; }
      }
      out.push({
        status: far > ASSUME.delayM ? 'warn' : 'ok', title: '무대 끝 → 가장 먼 객석', value: `${f1(far)} m`,
        detail: far > ASSUME.delayM ? '메인 스피커만으로는 뒤쪽 음압·명료도가 떨어질 수 있습니다. 딜레이 스피커 자리를 검토하세요.' : '메인 스피커 한 조로 덮을 수 있는 거리 안입니다.',
        basis: `${ASSUME.delayM}m 이상이면 딜레이 스피커 검토(업계 관행, 참고)`,
        line: [[nearPt[0], floor + 0.3, nearPt[1]], [farPt[0], floor + 0.3, farPt[1]]],
      });
    }

    // 콘솔 시야
    for (const f of fohs) {
      const eye = [f.x, floor + (f.y || 0) + f.h + ASSUME.eye - 1.0, f.z];
      const a = new THREE.Vector3(...eye), b = new THREE.Vector3(...target);
      const len = a.distanceTo(b);
      // 놓은 장비가 가리는지
      const r = new THREE.Ray(a, b.clone().sub(a).normalize());
      let blocker = null;
      for (const it of items) {
        if (it === f || it === deck || it.type === 'seats' || it.type === 'light') continue;
        const bb = boxOf(it, floor, THREE);
        const p = r.intersectBox(bb, new THREE.Vector3());
        if (p && p.distanceTo(a) < len - 0.2) { blocker = it.name; break; }
      }
      // 공연장 구조물이 가리는지
      let structural = null;
      if (!blocker && raycastVenue) {
        const hit = raycastVenue(a, b);
        if (hit) structural = `${f1(hit.distance)}m 지점 구조물`;
      }
      const dist = Math.hypot(f.x - deck.x, f.z - deck.z) - deck.d / 2;
      const bad = blocker || structural;
      out.push({
        status: bad ? 'fail' : raycastVenue ? 'ok' : 'info',
        title: `${f.name} 시야`, value: bad ? '가림' : '열림',
        detail: bad ? `콘솔에서 무대 중앙(사람 키 높이)을 볼 때 ${blocker ? `「${blocker}」` : structural}이(가) 가립니다. 콘솔을 옮기거나 높이를 올리세요.` : `무대 앞에서 약 ${f1(Math.max(0, dist))}m, 무대 중앙까지 가리는 것이 없습니다.`,
        basis: '콘솔 앞 눈높이에서 무대 위 1.7m 지점까지 직선(3D 모델 구조물 포함)',
        line: [eye, target],
      });
    }

    // 조명 입사각
    // 객석 쪽에서 무대 중앙을 넘어 뒤에 있는 조명은 역광으로 보고 입사각 점검에서 뺀다
    let front = lights, back = [];
    if (seats.length) {
      const sx = seats.reduce((a, s) => a + s.x, 0) / seats.length - deck.x;
      const sz = seats.reduce((a, s) => a + s.z, 0) / seats.length - deck.z;
      back = lights.filter((l) => (l.x - deck.x) * sx + (l.z - deck.z) * sz < 0);
      front = lights.filter((l) => !back.includes(l));
    }
    if (back.length) {
      out.push({
        status: 'info', title: '역광 조명', value: `${back.length}대`,
        detail: '무대 중앙보다 뒤(객석 반대쪽)에 있어 역광으로 분류했습니다. 입사각 점검에서 뺍니다.',
      });
    }
    if (front.length) {
      const bad = [];
      const angles = front.map((l) => {
        const ly = floor + (l.y || 0) + l.elev;
        const horiz = Math.hypot(l.x - deck.x, l.z - deck.z);
        const ang = (Math.atan2(ly - (top + 1.5), horiz) * 180) / Math.PI;
        if (ang < ASSUME.lightMin || ang > ASSUME.lightMax) bad.push(`${l.name} ${Math.round(ang)}°`);
        return ang;
      });
      out.push({
        status: bad.length ? 'warn' : 'ok', title: '앞쪽 조명 입사각', value: `${Math.round(Math.min(...angles))}~${Math.round(Math.max(...angles))}°`,
        detail: bad.length ? `범위를 벗어난 조명: ${bad.slice(0, 4).join(', ')}${bad.length > 4 ? ` 외 ${bad.length - 4}대` : ''}. 너무 낮으면 눈부심, 너무 높으면 얼굴 그림자가 깊어집니다.` : `앞쪽 조명 ${front.length}대 모두 권장 범위 안입니다.`,
        basis: `무대 중앙 얼굴 높이 기준 ${ASSUME.lightMin}~${ASSUME.lightMax}°(맥캔들리스 45° 관행, 참고)`,
      });
    }

    // 실내 공연장 제원 점검
    if (sp.procW) {
      const wide = deck.w > sp.procW;
      out.push({
        status: wide ? 'warn' : 'ok', title: '무대 덱 폭 ↔ 프로시니엄', value: `${f1(deck.w)} / ${sp.procW} m`,
        detail: wide ? `덱이 프로시니엄 폭보다 ${f1(deck.w - sp.procW)}m 넓어 객석에서 양 끝이 가려집니다.` : '프로시니엄 안에 들어옵니다.',
        basis: `기관 공개 제원: 프로시니엄 폭 ${sp.procW}m, 높이 ${sp.procH}m`,
      });
      const area = decks.reduce((a, d) => a + deckArea(d), 0);
      const own = sp.decks.reduce((a, d) => a + d.w * d.d * d.n, 0);
      out.push({
        status: area > own ? 'info' : 'ok', title: '보유 덧마루로 덮을 수 있나', value: `${f1(area)} / ${f1(own)} ㎡`,
        detail: area > own ? `보유 덧마루(1.2×1.8m 18개, 0.9×1.8m 18개)보다 ${f1(area - own)}㎡ 넓습니다. 나머지는 외부 반입이 필요합니다(면적 기준).` : '공연장 보유 덧마루 면적 안입니다(면적 기준, 높이·배치는 따로 확인).',
        basis: '기관 공개 제원: 덧마루 1200×1800 18개(38.9㎡) + 900×1800 18개(29.2㎡) = 68.0㎡',
      });
    }
  }

  // 반입구 통과
  if (sp.loadIn && sets.length) {
    const fails = sets.filter((s) => {
      const [a, b] = [s.w, s.d, s.h].sort((x, y) => x - y);
      return !(a <= sp.loadIn.h && b <= sp.loadIn.w);
    });
    out.push({
      status: fails.length ? 'fail' : 'ok', title: '세트 반입구 통과', value: fails.length ? `${fails.length}개 불가` : `${sets.length}개 통과`,
      detail: fails.length ? `${fails.map((s) => `「${s.name}」 ${f1(s.w)}×${f1(s.d)}×${f1(s.h)}m`).join(', ')}는 눕혀도 반입구를 지나지 못합니다. 나눠서 만드세요.` : '가장 작은 두 변이 반입구 안에 들어옵니다(눕혀서 반입 가정).',
      basis: `기관 공개 제원: ${sp.loadIn.label} 폭 ${sp.loadIn.w}m × 높이 ${sp.loadIn.h}m`,
    });
  }

  // 트러스 하중
  for (const t of trusses) {
    const c = Math.cos(rad(t.rot || 0)), s = Math.sin(rad(t.rot || 0));
    const ax = t.x - (t.w / 2) * c, az = t.z + (t.w / 2) * s, bx = t.x + (t.w / 2) * c, bz = t.z - (t.w / 2) * s;
    const hung = lights.filter((l) => Math.abs(l.elev - t.elev) < 1.2 && segPointDist(ax, az, bx, bz, l.x, l.z) < 0.8);
    const load = itemWeight(t) + hung.reduce((a, l) => a + itemWeight(l), 0);
    if (t.hang === 'batten' && sp.batten) {
      const over = load > sp.batten.live;
      out.push({
        status: over ? 'fail' : 'ok', title: `${t.name} 배튼 하중`, value: `${load} / ${sp.batten.live} kg`,
        detail: `${hung.length}대 조명 + 트러스 자중. ${over ? '배튼 허용 하중을 넘습니다. 나눠 걸거나 체인모터(1톤, 6개 보유)를 쓰세요.' : '배튼 허용 하중 안입니다.'}${t.w > sp.batten.len ? ` 트러스 길이 ${f1(t.w)}m가 배튼 길이 ${sp.batten.len}m보다 깁니다.` : ''}`,
        basis: `기관 공개 제원: 세트 배튼 ${sp.batten.count}개, 허용 하중 ${sp.batten.live}kg, 길이 ${sp.batten.len}m. 트러스 자중 ${ASSUME.trussKgPerM}kg/m(가정)`,
      });
    } else {
      out.push({
        status: 'info', title: `${t.name} 걸리는 무게`, value: `${load} kg`,
        detail: `조명 ${hung.length}대 + 트러스 자중. ${t.hang === 'batten' ? '이 공연장은 배튼 하중이 공개되지 않았습니다.' : '타워 한쪽에 약 절반씩 걸립니다. 타워·베이스 정격과 대조하세요.'}`,
        basis: `트러스 자중 ${ASSUME.trussKgPerM}kg/m(가정)`,
      });
    }
  }

  if (venue.missing?.length && items.length) {
    out.push({
      status: 'info', title: '아직 점검할 수 없는 것', value: '',
      detail: `${venue.missing.join(', ')}. 기관 공개 자료에 없는 항목입니다.`,
    });
  }
  return out;
}

function boxOf(it, floor, THREE) {
  const base = floor + (it.y || 0) + (it.elev || 0);
  let h = it.h || 0.3;
  let y0 = base;
  if (it.type === 'truss') { y0 = base - 0.15; h = 0.3; }
  const cs = corners(it);
  const xs = cs.map((p) => p[0]), zs = cs.map((p) => p[1]);
  return new THREE.Box3(new THREE.Vector3(Math.min(...xs), y0, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), y0 + h, Math.max(...zs)));
}
