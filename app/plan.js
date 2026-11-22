// 올팍 무대도면 — 편집기
// three.js 로 기관 3D 공연장 모델을 띄우고, 무대·장비를 놓아 보고, 점검하고, 도면을 뽑는다.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { TYPES, runChecks, itemWeight, seatCount, deckArea } from './checks.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const VENUES = window.OLPARK_VENUES;
const CASES = window.OLPARK_CASES || {};
const EVENTS = (window.OLPARK_EVENTS && window.OLPARK_EVENTS.events) || [];
const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- 상태 ----------
const state = {
  venue: null,
  items: [],
  selected: null,
  mode: 'select', // select | place | measure
  placeType: null,
  measure: [],
  meta: { title: '', date: '', loadIn: '', rehearsal: '', strike: '', cast: '', crew: '' },
};
let uid = 1;

// ---------- 렌더러 ----------
const viewEl = $('#view');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f3ef);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 60, 20);
scene.add(sun);

const persp = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const ortho = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 2000);
let camera = persp;
const controls = new OrbitControls(persp, renderer.domElement);
controls.enableDamping = true;
controls.screenSpacePanning = true;

const venueRoot = new THREE.Group();
const itemRoot = new THREE.Group();
const helperRoot = new THREE.Group();
scene.add(venueRoot, itemRoot, helperRoot);
let venueMeshes = [];
let venueBox = new THREE.Box3();
let bvhReady = false;
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
renderer.localClippingEnabled = true;

function resize() {
  const w = viewEl.clientWidth, h = viewEl.clientHeight;
  renderer.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  fitOrtho();
}
window.addEventListener('resize', resize);

function fitOrtho(box = venueBox, cam = ortho, aspect = viewEl.clientWidth / viewEl.clientHeight) {
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  let hw = s.x / 2 * 1.08, hh = s.z / 2 * 1.08;
  if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
  cam.position.set(c.x, box.max.y + 100, c.z);
  cam.up.set(0, 0, -1);
  cam.lookAt(c.x, 0, c.z);
  cam.near = 0.1; cam.far = box.max.y - box.min.y + 300;
  cam.updateProjectionMatrix();
}

function setCut() {
  const cut = $('#cut');
  const h = parseFloat(cut.value);
  const off = h >= parseFloat(cut.max);
  cutPlane.constant = off ? 1000 : state.venue.floorY + h;
  $('#cut-out').textContent = off ? '끔' : `${h}m`;
}

// 놓는 자리의 지면(객석 단차·잔디 경사)을 3D 모델에서 찾는다
function groundAt(x, z) {
  if (!bvhReady) return state.venue.floorY;
  const rc = new THREE.Raycaster(new THREE.Vector3(x, state.venue.floorY + 6, z), new THREE.Vector3(0, -1, 0), 0, 40);
  rc.firstHitOnly = true;
  const hit = rc.intersectObjects(venueMeshes, false)[0];
  return hit ? hit.point.y : state.venue.floorY;
}
// 넓은 것(덱·객석·콘솔)은 네 모서리와 가운데 중 가장 높은 지면에 놓는다(경사·단차에 묻히지 않게)
function settle(it) {
  const pts = [[it.x, it.z]];
  if (['deck', 'seats', 'foh'].includes(it.type)) {
    const c = Math.cos(THREE.MathUtils.degToRad(it.rot || 0)), s = Math.sin(THREE.MathUtils.degToRad(it.rot || 0));
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = (a * it.w) / 2 * 0.95, lz = (b * it.d) / 2 * 0.95;
      pts.push([it.x + lx * c + lz * s, it.z - lx * s + lz * c]);
    }
  }
  it.y = round1(Math.max(...pts.map(([x, z]) => groundAt(x, z))) - state.venue.floorY);
}

function setView(v) {
  if (v === 'top') {
    camera = ortho;
    controls.enabled = false;
    fitOrtho();
  } else {
    camera = persp;
    controls.enabled = true;
  }
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
}

function frameVenue() {
  const c = venueBox.getCenter(new THREE.Vector3());
  const s = venueBox.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.z);
  persp.position.set(c.x + r * 0.45, c.y + r * 0.55, c.z + r * 0.75);
  controls.target.copy(c);
  controls.update();
}

// ---------- 모델 불러오기 ----------
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error(src));
    document.head.appendChild(s);
  });
}
async function modelBuffer(key) {
  if (location.protocol !== 'file:') {
    const r = await fetch(`models/${key}.glb`);
    if (r.ok) return r.arrayBuffer();
  }
  await loadScript(`models/${key}.glb.js`);
  const b64 = window.OLPARK_MODEL[key];
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  delete window.OLPARK_MODEL[key];
  return buf.buffer;
}

async function loadVenue(key) {
  const v = VENUES[key];
  state.venue = v;
  setStatus(`${v.name} 3D 모델을 불러오는 중…`);
  const buf = await modelBuffer(v.model);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
  venueRoot.clear();
  venueRoot.add(gltf.scene);
  venueMeshes = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      venueMeshes.push(o);
      if (o.material) { o.material.side = THREE.DoubleSide; o.material.clippingPlanes = [cutPlane]; }
    }
  });
  venueRoot.updateMatrixWorld(true);
  venueBox = new THREE.Box3().setFromObject(venueRoot);
  const cut = $('#cut');
  cut.max = Math.ceil(venueBox.max.y - v.floorY + 1);
  cut.value = v.cutH ?? cut.max;
  setCut();
  frameVenue();
  resize();
  setStatus('모델 준비 완료. 왼쪽에서 장비를 골라 바닥을 누르면 놓입니다.');
  renderVenueInfo();
  // 측정·가림 점검용 가속 구조는 화면이 뜬 뒤 만든다
  setTimeout(() => {
    for (const m of venueMeshes) m.geometry.computeBoundsTree();
    bvhReady = true;
    for (const it of state.items) if (it.y == null) settle(it);
    refresh();
    document.body.dataset.bvh = '1';
  }, 50);
}

// ---------- 장비 메시 ----------
const mats = {};
function mat(color, opacity = 1) {
  const k = `${color}-${opacity}`;
  if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: opacity < 1, opacity });
  return mats[k];
}
const edgeMat = new THREE.LineBasicMaterial({ color: 0x111111 });
const selMat = new THREE.LineBasicMaterial({ color: 0x1d4ed8 });

function box(w, h, d, color, opacity) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat(color, opacity));
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
  m.add(e);
  return m;
}

function buildItemObject(it) {
  const t = TYPES[it.type];
  const g = new THREE.Group();
  const base = state.venue.floorY + (it.y || 0);
  if (it.type === 'truss') {
    const beam = box(it.w, 0.3, 0.3, t.color);
    beam.position.y = base + it.elev;
    g.add(beam);
    if (it.hang === 'ground') {
      for (const sx of [-1, 1]) {
        const tw = box(0.4, it.elev, 0.4, t.color);
        tw.position.set(sx * it.w / 2, base + it.elev / 2, 0);
        g.add(tw);
      }
    }
  } else if (it.type === 'light') {
    const body = box(0.35, 0.45, 0.35, t.color);
    body.position.y = base + it.elev;
    g.add(body);
  } else if (it.type === 'seats') {
    const b = box(it.w, 0.05, it.d, it.mode === 'standing' ? 0xf1d9a6 : t.color, 0.75);
    b.position.y = base + 0.03;
    g.add(b);
    // 좌석 줄 표시
    if (it.mode !== 'standing') {
      const rows = Math.floor(it.d / 0.9);
      const pts = [];
      for (let r = 1; r < rows; r++) {
        const z = -it.d / 2 + r * 0.9;
        pts.push(new THREE.Vector3(-it.w / 2, 0, z), new THREE.Vector3(it.w / 2, 0, z));
      }
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7b8794 }));
      lines.position.y = base + 0.07;
      g.add(lines);
    }
  } else {
    const b = box(it.w, it.h, it.d, t.color, t.opacity);
    b.position.y = base + (it.elev || 0) + it.h / 2;
    g.add(b);
  }
  g.position.set(it.x, 0, it.z);
  g.rotation.y = THREE.MathUtils.degToRad(it.rot || 0);
  g.userData.id = it.id;
  return g;
}

function rebuildItems() {
  itemRoot.clear();
  for (const it of state.items) {
    const o = buildItemObject(it);
    if (it.id === state.selected) {
      const bb = new THREE.Box3().setFromObject(o);
      const h = new THREE.Box3Helper(bb, 0x1d4ed8);
      h.material = selMat;
      helperRoot.add(h);
    }
    itemRoot.add(o);
  }
}

function drawHelpers(checks) {
  helperRoot.clear();
  // 선택 표시
  const sel = itemRoot.children.find((o) => o.userData.id === state.selected);
  if (sel) helperRoot.add(new THREE.Box3Helper(new THREE.Box3().setFromObject(sel), 0x1d4ed8));
  // 점검 선(콘솔 시야, 최원거리)
  for (const c of checks) {
    if (!c.line) continue;
    const color = c.status === 'fail' ? 0xdc2626 : c.status === 'warn' ? 0xd97706 : 0x1d4ed8;
    const geo = new THREE.BufferGeometry().setFromPoints(c.line.map((p) => new THREE.Vector3(...p)));
    helperRoot.add(new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.4 })).computeLineDistances());
  }
  // 측정 선
  if (state.measure.length) {
    const pts = state.measure.map((p) => p.clone());
    for (const p of pts) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }));
      dot.position.copy(p);
      helperRoot.add(dot);
    }
    if (pts.length === 2) helperRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1d4ed8 })));
  }
}

// ---------- 점검 ----------
function raycastVenue(a, b) {
  if (!bvhReady) return null;
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const rc = new THREE.Raycaster(a, dir.normalize(), 0.05, len - 0.05);
  rc.firstHitOnly = true;
  const hit = rc.intersectObjects(venueMeshes, false)[0];
  return hit || null;
}

let lastChecks = [];
function refresh() {
  rebuildItems();
  lastChecks = runChecks(state.venue, state.items, { raycastVenue, THREE });
  drawHelpers(lastChecks);
  renderList();
  renderProps();
  renderChecks(lastChecks);
  writeHash();
}

// ---------- 화면: 목록·속성·점검 ----------
function renderList() {
  const el = $('#items');
  if (!state.items.length) {
    el.innerHTML = '<p class="muted">아직 놓은 것이 없습니다.</p>';
    return;
  }
  el.innerHTML = state.items.map((it) => `<button class="row ${it.id === state.selected ? 'on' : ''}" data-id="${it.id}"><span class="sw" style="background:#${TYPES[it.type].color.toString(16).padStart(6, '0')}"></span>${esc(it.name)}<span class="num">${fmt(it.w)}×${fmt(it.d)}</span></button>`).join('');
  el.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => select(+b.dataset.id)));
}

const FIELDS = {
  w: ['가로(m)', 0.1], d: ['세로(m)', 0.1], h: ['높이(m)', 0.1], elev: ['설치 높이(m)', 0.1],
  x: ['X(m)', 0.1], z: ['Z(m)', 0.1], rot: ['회전(°)', 15], y: ['바닥 위 높이(m)', 0.1], weight: ['무게(kg)', 1],
};
function renderProps() {
  const el = $('#props');
  const it = state.items.find((i) => i.id === state.selected);
  if (!it) { el.innerHTML = '<p class="muted">장비를 누르면 여기서 치수를 바꿀 수 있습니다.</p>'; return; }
  const t = TYPES[it.type];
  const keys = t.fields;
  let html = `<label class="f wide"><span>이름</span><input data-k="name" value="${esc(it.name)}"></label>`;
  for (const k of keys) html += `<label class="f"><span>${FIELDS[k][0]}</span><input type="number" step="${FIELDS[k][1]}" data-k="${k}" value="${it[k] ?? 0}"></label>`;
  if (it.type === 'truss') html += `<label class="f wide"><span>매다는 방식</span><select data-k="hang"><option value="ground" ${it.hang === 'ground' ? 'selected' : ''}>그라운드 서포트(타워)</option><option value="batten" ${it.hang === 'batten' ? 'selected' : ''}>공연장 배튼·호이스트</option></select></label>`;
  if (it.type === 'seats') html += `<label class="f wide"><span>형태</span><select data-k="mode"><option value="seated" ${it.mode !== 'standing' ? 'selected' : ''}>지정석(0.5m×0.9m)</option><option value="standing" ${it.mode === 'standing' ? 'selected' : ''}>스탠딩(㎡당 2명)</option></select></label><p class="muted wide">${seatCount(it).toLocaleString('ko-KR')}명</p>`;
  if (it.type === 'deck') html += `<p class="muted wide">면적 ${fmt(deckArea(it))}㎡</p>`;
  html += `<div class="wide btns"><button data-act="dup">복제</button><button data-act="del" class="danger">삭제</button></div>`;
  el.innerHTML = html;
  el.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.k;
    it[k] = inp.type === 'number' ? parseFloat(inp.value) || 0 : inp.value;
    refresh();
  }));
  el.querySelector('[data-act=del]').onclick = () => { state.items = state.items.filter((i) => i !== it); state.selected = null; refresh(); };
  el.querySelector('[data-act=dup]').onclick = () => { const c = { ...it, id: uid++, x: it.x + 2, name: it.name + ' 사본' }; state.items.push(c); state.selected = c.id; refresh(); };
}

const ICON = { ok: '적합', warn: '확인', fail: '부적합', info: '참고' };
function renderChecks(checks) {
  $('#checks').innerHTML = checks.map((c) => `<div class="chk ${c.status}"><div class="chk-h"><b>${ICON[c.status]}</b><span>${esc(c.title)}</span><span class="num">${esc(c.value || '')}</span></div><p>${esc(c.detail || '')}</p>${c.basis ? `<p class="basis">기준: ${esc(c.basis)}</p>` : ''}</div>`).join('') || '<p class="muted">무대 덱과 객석을 놓으면 점검이 시작됩니다.</p>';
}

function renderVenueInfo() {
  const v = state.venue;
  $('#venue-name').textContent = v.name;
  $('#venue-kind').textContent = v.kind;
  const re = new RegExp(v.eventMatch);
  const evs = EVENTS.filter((e) => re.test(e.plc));
  const byYear = {};
  for (const e of evs) { const y = e.beginDt.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; }
  const years = [];
  for (let y = 2013; y <= new Date().getFullYear(); y++) years.push(String(y));
  const max = Math.max(1, ...years.map((y) => byYear[y] || 0));
  const bw = 12, gap = 3, H = 46;
  const bars = years.map((y, i) => { const h = Math.round(((byYear[y] || 0) / max) * H); return `<rect x="${i * (bw + gap)}" y="${H - h}" width="${bw}" height="${h}"><title>${y}년 ${byYear[y] || 0}건</title></rect>`; }).join('');
  const W = years.length * (bw + gap);
  const today = new Date().toISOString().slice(0, 10);
  const past = evs.filter((e) => e.beginDt <= today).slice(-6).reverse();
  const next = evs.filter((e) => e.beginDt > today).slice(0, 3);
  $('#history').innerHTML = `
    <p class="kpi"><span class="num">${evs.length.toLocaleString('ko-KR')}</span>건 <span class="muted">공개 행사 목록에서 이 공연장으로 표기된 행사</span></p>
    <svg class="bars" viewBox="0 0 ${W} ${H + 14}" width="100%" role="img" aria-label="연도별 행사 수">${bars}<text x="0" y="${H + 12}">${years[0]}</text><text x="${W}" y="${H + 12}" text-anchor="end">${years[years.length - 1]}</text></svg>
    ${next.length ? `<h4>예정</h4><ul class="ev">${next.map(evLi).join('')}</ul>` : ''}
    <h4>최근</h4><ul class="ev">${past.map(evLi).join('')}</ul>
    <p class="basis">출처: 올림픽공원 공연·행사 정보(공공데이터포털 15015212·3037877 연결 화면), 수집 ${(window.OLPARK_EVENTS?.collectedAt || '').slice(0, 10)}</p>`;
  $('#venue-spec').innerHTML = v.specs.procW
    ? `<dl class="spec"><dt>프로시니엄</dt><dd class="num">${v.specs.procW} × ${v.specs.procH} m</dd><dt>무대 전체</dt><dd class="num">${v.specs.stageW} × ${v.specs.stageD} m</dd><dt>그리드 높이</dt><dd class="num">${v.specs.gridH} m</dd><dt>세트 배튼</dt><dd class="num">${v.specs.batten.count}개 · ${v.specs.batten.live} kg</dd><dt>외부 반입구</dt><dd class="num">${v.specs.loadIn.w} × ${v.specs.loadIn.h} m</dd></dl><p class="basis">${esc(v.specSource)}</p>`
    : `<p class="muted">${esc(v.specSource)}</p>`;
}
const evLi = (e) => `<li><span class="num">${e.beginDt.slice(2).replace(/-/g, '.')}</span> ${esc(e.title)}</li>`;
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function setStatus(t) { $('#status').textContent = t; }

// ---------- 입력: 놓기·고르기·끌기·재기 ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pointer(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function floorPoint(y = state.venue.floorY) {
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
}

let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!state.venue || e.button !== 0) return;
  pointer(e);
  if (state.mode === 'place') {
    const p = floorPoint();
    if (!p) return;
    addItem(state.placeType, p.x, p.z);
    setMode('select');
    return;
  }
  if (state.mode === 'measure') {
    if (!bvhReady) { setStatus('측정 준비 중입니다. 잠시 뒤 다시 눌러 주세요.'); return; }
    ray.firstHitOnly = true;
    const hit = ray.intersectObjects([...venueMeshes, ...itemRoot.children], true)[0];
    if (!hit) return;
    if (state.measure.length >= 2) state.measure = [];
    state.measure.push(hit.point.clone());
    if (state.measure.length === 2) {
      const [a, b] = state.measure;
      const dh = Math.hypot(a.x - b.x, a.z - b.z);
      $('#measure-out').textContent = `직선 ${fmt(a.distanceTo(b), 2)} m · 수평 ${fmt(dh, 2)} m · 높이차 ${fmt(Math.abs(a.y - b.y), 2)} m`;
    } else $('#measure-out').textContent = '두 번째 점을 누르세요.';
    drawHelpers(lastChecks);
    return;
  }
  const hit = ray.intersectObjects(itemRoot.children, true)[0];
  if (hit) {
    let o = hit.object;
    while (o && o.userData.id === undefined) o = o.parent;
    select(o.userData.id);
    const it = state.items.find((i) => i.id === o.userData.id);
    const p = floorPoint();
    if (p) {
      drag = { it, dx: it.x - p.x, dz: it.z - p.z, moved: false };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  } else if (camera === ortho) {
    select(null);
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  pointer(e);
  const p = floorPoint();
  if (!p) return;
  const snap = e.shiftKey ? 1 : 0.1;
  drag.it.x = round1(Math.round((p.x + drag.dx) / snap) * snap);
  drag.it.z = round1(Math.round((p.z + drag.dz) / snap) * snap);
  drag.moved = true;
  rebuildItems();
  drawHelpers(lastChecks);
});
renderer.domElement.addEventListener('pointerup', () => {
  if (!drag) return;
  const moved = drag.moved;
  const drag_it = drag.it;
  drag = null;
  controls.enabled = camera === persp;
  if (moved) { settle(drag_it); refresh(); }
});
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input,select,textarea')) return;
  const it = state.items.find((i) => i.id === state.selected);
  if (e.key === 'Escape') { setMode('select'); select(null); }
  if (!it) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { state.items = state.items.filter((i) => i !== it); state.selected = null; refresh(); }
  if (e.key === 'r' || e.key === 'R') { it.rot = ((it.rot || 0) + (e.shiftKey ? -15 : 15)) % 360; refresh(); }
});

function addItem(type, x, z) {
  const t = TYPES[type];
  const n = state.items.filter((i) => i.type === type).length + 1;
  const it = { id: uid++, type, name: `${t.label} ${n}`, x: round1(x), z: round1(z), rot: 0, ...structuredClone(t.defaults) };
  settle(it);
  state.items.push(it);
  state.selected = it.id;
  refresh();
}
const round1 = (v) => Math.round(v * 10) / 10;

function select(id) { state.selected = id; refresh(); }
function setMode(m, type = null) {
  state.mode = m;
  state.placeType = type;
  document.querySelectorAll('[data-place]').forEach((b) => b.classList.toggle('on', m === 'place' && b.dataset.place === type));
  $('#btn-measure').classList.toggle('on', m === 'measure');
  renderer.domElement.style.cursor = m === 'select' ? 'default' : 'crosshair';
  if (m === 'place') setStatus(`${TYPES[type].label}: 놓을 자리를 누르세요. (Esc 취소)`);
  else if (m === 'measure') { state.measure = []; setStatus('치수 재기: 모델 위 두 점을 차례로 누르세요.'); }
  else setStatus('장비를 끌어 옮기고, R로 15°씩 돌립니다. Shift를 누르고 끌면 1m 단위로 맞춥니다.');
}

// ---------- 공유 주소 ----------
function encodePlan() {
  const items = state.items.map(({ id, ...r }) => r);
  const json = JSON.stringify({ v: state.venue.key, m: state.meta, i: items });
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePlan(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
}
let hashTimer;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, '', `#p=${encodePlan()}`), 300);
}
function applyPlan(p) {
  state.items = (p.i || []).map((r) => ({ ...r, id: uid++ }));
  state.meta = { ...state.meta, ...(p.m || {}) };
  state.selected = null;
}

// ---------- 내보내기 ----------
function planImage(scale = 1) {
  // 놓은 장비 기준으로 화면을 잡되, 장비가 없으면 공연장 전체
  const bb = new THREE.Box3();
  if (state.items.length) {
    bb.setFromObject(itemRoot);
    bb.expandByScalar(6);
    bb.min.y = venueBox.min.y; bb.max.y = venueBox.max.y;
  } else bb.copy(venueBox);
  const W = 2000 * scale, H = 1400 * scale;
  const cam = new THREE.OrthographicCamera();
  fitOrtho(bb, cam, W / H);
  helperRoot.visible = false;
  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.render(scene, cam);
  const img = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(prevRatio);
  renderer.setSize(prevSize.x, prevSize.y);
  helperRoot.visible = true;
  return { img, cam, W, H };
}

async function exportPNG(download = true) {
  const { img, cam, W, H } = planImage();
  const pad = 40, foot = 150;
  const cv = document.createElement('canvas');
  cv.width = W + pad * 2; cv.height = H + pad * 2 + foot;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  const im = new Image(); im.src = img; await im.decode();
  g.drawImage(im, pad, pad);
  g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(pad, pad, W, H);
  // 장비 이름표
  const pxPerM = W / (cam.right - cam.left);
  g.font = '600 20px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // 조명기는 개수가 많아 이름표 대신 트러스 이름표에 대수를 붙이고, 이름표끼리 겹치면 아래로 비킨다
  const placed = [];
  for (const it of state.items) {
    if (it.type === 'light') continue;
    const p = new THREE.Vector3(it.x, 0, it.z).project(cam);
    const x = pad + (p.x + 1) / 2 * W;
    let y = pad + (1 - p.y) / 2 * H;
    const label = it.type === 'seats' ? `${it.name}  ${seatCount(it).toLocaleString('ko-KR')}명` : `${it.name}  ${fmt(it.w)}×${fmt(it.d)}m`;
    const tw = g.measureText(label).width + 12;
    for (let k = 0; k < 8 && placed.some((r) => Math.abs(r.x - x) < (r.w + tw) / 2 && Math.abs(r.y - y) < 28); k++) y += 30;
    placed.push({ x, y, w: tw });
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x - tw / 2, y - 14, tw, 28);
    g.fillStyle = '#111'; g.fillText(label, x, y);
  }
  const nLights = state.items.filter((i) => i.type === 'light').length;
  if (nLights) {
    g.textAlign = 'right'; g.fillStyle = '#111';
    g.fillText(`조명기 ${nLights}대(주황 점)`, pad + W - 16, pad + H - 26);
    g.textAlign = 'center';
  }
  // 축척 막대
  const bar = [5, 10, 20, 50].find((m) => m * pxPerM > 160) || 50;
  const bx = pad + 20, by = pad + H - 30;
  g.fillStyle = '#111'; g.fillRect(bx, by, bar * pxPerM, 8);
  g.fillStyle = '#fff'; g.fillRect(bx + bar * pxPerM / 2, by + 1, bar * pxPerM / 2 - 1, 6);
  g.fillStyle = '#111'; g.textAlign = 'left'; g.font = '600 18px ui-monospace,Menlo,monospace';
  g.fillText(`0        ${bar} m`, bx, by - 14);
  // 제목란
  const v = state.venue;
  const ty = pad * 2 + H;
  g.font = '700 30px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.fillText(`${state.meta.title || '무대 배치 평면도'} — ${v.name}`, pad, ty + 30);
  g.font = '400 18px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  const sum = lastChecks.filter((c) => c.status !== 'info').map((c) => `${ICON[c.status]} ${c.title} ${c.value || ''}`).slice(0, 4).join('  ·  ');
  g.fillText(sum, pad, ty + 68);
  g.fillStyle = '#555';
  g.fillText(`3D 모델: ${v.modelSource}. 모델 단순화 오차가 있어 답사·실측을 대신하지 않습니다.`, pad, ty + 100);
  g.fillText(`올팍 무대도면으로 작성 · ${new Date().toLocaleDateString('ko-KR')} · 한국체육산업개발 공식 서비스가 아님`, pad, ty + 126);
  const url = cv.toDataURL('image/png');
  if (download) dl(url, `무대평면도_${v.name}.png`);
  return url;
}

function equipmentRows() {
  const rows = [['구분', '이름', '가로(m)', '세로(m)', '높이(m)', '설치 높이(m)', 'X(m)', 'Z(m)', '회전(°)', '무게(kg)', '수용(명)']];
  for (const it of state.items) rows.push([TYPES[it.type].label, it.name, it.w, it.d, it.h ?? '', it.elev ?? '', it.x, it.z, it.rot || 0, itemWeight(it) || '', it.type === 'seats' ? seatCount(it) : '']);
  return rows;
}
function exportCSV() {
  const csv = '﻿' + equipmentRows().map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  dl(URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), `장비목록_${state.venue.name}.csv`);
}
function dl(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }

async function copyLink() {
  history.replaceState(null, '', `#p=${encodePlan()}`);
  try { await navigator.clipboard.writeText(location.href); setStatus('공유 주소를 복사했습니다. 받은 사람은 같은 배치를 그대로 엽니다.'); }
  catch { prompt('이 주소를 복사하세요', location.href); }
}

async function openForm() {
  const m = state.meta;
  const png = await exportPNG(false);
  const rows = equipmentRows();
  const hasGear = state.items.some((i) => ['set', 'speaker', 'truss', 'light'].includes(i.type));
  const w = window.open('', '_blank');
  if (!w) { setStatus('팝업이 막혔습니다. 브라우저에서 팝업을 허용해 주세요.'); return; }
  const cell = (s) => esc(s) || '&nbsp;';
  w.document.write(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>무대설치 계획서 초안 — ${esc(state.venue.name)}</title>
<style>body{font:14px/1.6 "Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 16px}h1{font-size:22px;text-align:center;letter-spacing:.3em;margin:8px 0 16px}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #111;padding:6px 8px;text-align:left;vertical-align:top}th{width:22%;background:#f2f2f2;font-weight:600}.small{font-size:12px;color:#444}img{width:100%;border:1px solid #111}.ok{color:#166534}.warn{color:#b45309}.fail{color:#b91c1c}@media print{.noprint{display:none}h2{page-break-before:always}}button{font:inherit;padding:6px 14px;margin:0 0 12px}</style>
<p class="noprint"><button onclick="print()">인쇄 / PDF로 저장</button> <span class="small">기관 서식 제7호 항목 순서를 따른 초안입니다. 단체명·주소·서명 칸은 비워 두었습니다.</span></p>
<p class="small">[서식 제7호] 초안</p><h1>무대설치 계획서</h1>
<table><tr><th>공 연 명</th><td>${cell(m.title)}</td></tr><tr><th>공연장소</th><td>올림픽공원 ${esc(state.venue.name)}</td></tr><tr><th>공연일시</th><td>${cell(m.date)}</td></tr>
<tr><th>공연장비 반입여부<br><span class="small">(내역 별첨)</span></th><td>${hasGear ? '■ 있음 □ 없음' : '□ 있음 ■ 없음'} — 별첨 1 장비 목록 ${rows.length - 1}건</td></tr>
<tr><th>무대시설 작업일정</th><td>${cell(m.loadIn)}</td></tr><tr><th>출연자 및 외부스텝</th><td>출연자 ${cell(m.cast)} 명 · 외부스텝 ${cell(m.crew)} 명</td></tr>
<tr><th>무대연습 일정</th><td>${cell(m.rehearsal)}</td></tr><tr><th>무대철수 작업일정</th><td>${cell(m.strike)}</td></tr></table>
<p class="small">위 공연을 위하여 올림픽시설물 대관운영규정 및 안전수칙을 성실히 준수하겠습니다. (단체명·주소·전화·대표자 서명은 제출 시 직접 기입)</p>
<h2>별첨 1. 무대장치 평면도</h2><img src="${png}" alt="무대 배치 평면도">
<h2>별첨 2. 장비 목록</h2><table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th style="width:auto">${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>
<h2>별첨 3. 자동 점검 결과</h2><table>${lastChecks.map((c) => `<tr><th style="width:30%">${esc(c.title)}</th><td><b class="${c.status}">${ICON[c.status]}</b> ${esc(c.value || '')}<br>${esc(c.detail || '')}${c.basis ? `<br><span class="small">기준: ${esc(c.basis)}</span>` : ''}</td></tr>`).join('')}</table>
<p class="small">이 문서는 올팍 무대도면(공공데이터 활용)으로 만든 초안이며 한국체육산업개발 공식 서식 파일을 대신하지 않습니다. 3D 모델은 단순화 오차가 있어 무대 스태프 회의와 실측으로 확인해야 합니다.</p></html>`);
  w.document.close();
}

function openMetaDialog() {
  const d = $('#meta');
  for (const k of Object.keys(state.meta)) d.querySelector(`[name=${k}]`).value = state.meta[k] || '';
  d.showModal();
}
$('#meta').addEventListener('close', () => {
  const d = $('#meta');
  if (d.returnValue !== 'ok') return;
  for (const k of Object.keys(state.meta)) state.meta[k] = d.querySelector(`[name=${k}]`).value;
  writeHash();
  openForm();
});

// ---------- 시작 ----------
function bindUI() {
  const pal = $('#palette');
  pal.innerHTML = Object.entries(TYPES).map(([k, t]) => `<button data-place="${k}" title="${esc(t.hint)}"><span class="sw" style="background:#${t.color.toString(16).padStart(6, '0')}"></span>${t.label}</button>`).join('');
  pal.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => setMode(state.mode === 'place' && state.placeType === b.dataset.place ? 'select' : 'place', b.dataset.place)));
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#cut').addEventListener('input', setCut);
  $('#btn-measure').onclick = () => setMode(state.mode === 'measure' ? 'select' : 'measure');
  $('#btn-png').onclick = () => exportPNG();
  $('#btn-csv').onclick = exportCSV;
  $('#btn-link').onclick = copyLink;
  $('#btn-form').onclick = openMetaDialog;
  $('#btn-clear').onclick = () => { if (confirm('놓은 장비를 모두 지울까요?')) { state.items = []; state.selected = null; refresh(); } };
  const cs = $('#cases');
  const mine = Object.entries(CASES).filter(([, c]) => c.venue === state.venue.key);
  cs.innerHTML = mine.length ? mine.map(([k, c]) => `<button data-case="${k}">${esc(c.title)}</button>`).join('') : '<p class="muted">이 공연장 사례는 준비 중입니다.</p>';
  cs.querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => {
    const c = CASES[b.dataset.case];
    if (state.items.length && !confirm('지금 배치를 지우고 사례를 불러올까요?')) return;
    applyPlan(c.plan);
    refresh();
    setStatus(`사례 「${c.title}」를 불러왔습니다. ${c.note || ''}`);
  }));
}

function animate() {
  requestAnimationFrame(animate);
  if (camera === persp) controls.update();
  renderer.render(scene, camera);
}

async function main() {
  let key = params.get('v');
  let plan = null;
  const m = location.hash.match(/^#p=(.+)$/);
  if (m) { try { plan = decodePlan(m[1]); key = plan.v; } catch { /* 잘못된 주소는 무시 */ } }
  if (params.get('case') && CASES[params.get('case')]) { plan = CASES[params.get('case')].plan; key = CASES[params.get('case')].venue; }
  if (!VENUES[key]) key = 'woori';
  state.venue = VENUES[key];
  document.title = `${VENUES[key].name} — 올팍 무대도면`;
  resize();
  animate();
  bindUI();
  setMode('select');
  try { await loadVenue(key); }
  catch (e) { setStatus(`모델을 불러오지 못했습니다: ${e.message}`); console.error(e); return; }
  if (plan) applyPlan(plan);
  refresh();
  if (params.get('view') === 'top') setView('top');
  if (params.get('probe')) probe();
  document.body.dataset.ready = '1';
}

// 개발용: 모델 좌표를 확인하기 위해 위에서 본 화면에 5m 격자와 좌표를 그린다
function probe() {
  setView('top');
  const s = venueBox.getSize(new THREE.Vector3());
  const grid = new THREE.GridHelper(Math.ceil(Math.max(s.x, s.z) / 10) * 10 + 20, (Math.ceil(Math.max(s.x, s.z) / 10) * 10 + 20) / 5, 0xff0000, 0xff8888);
  grid.position.y = venueBox.max.y + 1;
  scene.add(grid);
  const out = {};
  if (bvhReady || true) {
    for (const m of venueMeshes) if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
    bvhReady = true;
    const rc = new THREE.Raycaster();
    rc.firstHitOnly = true;
    const step = Number(params.get('probe')) || 4;
    for (let x = Math.floor(venueBox.min.x); x <= venueBox.max.x; x += step) {
      for (let z = Math.floor(venueBox.min.z); z <= venueBox.max.z; z += step) {
        rc.set(new THREE.Vector3(x, venueBox.max.y + 5, z), new THREE.Vector3(0, -1, 0));
        rc.firstHitOnly = false;
        const hs = rc.intersectObjects(venueMeshes, false);
        out[`${x},${z}`] = hs.map((h) => Math.round(h.point.y * 100) / 100).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
      }
    }
  }
  const pre = document.createElement('pre');
  pre.id = 'dump';
  pre.textContent = JSON.stringify({ box: venueBox, heights: out });
  document.body.appendChild(pre);
}

main();
