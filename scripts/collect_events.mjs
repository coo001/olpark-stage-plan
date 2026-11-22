// 올림픽공원 공연·행사 정보 수집기
// 출처: 공공데이터포털 15015212(대관정보)·3037877(공연정보)의 LINK 대상인
//       https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoList?mid=a20301010100
// 이 목록 화면이 월별로 부르는 공개 JSON(eventInfoListAjax.es)을 그대로 받는다. 키·로그인 없음.
// 사용: node scripts/collect_events.mjs [시작YYYYMM] [끝YYYYMM]
// 결과: data/events.json, data/events.js (로컬 file:// 에서도 열리도록 전역 변수로)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoListAjax.es';
const REFERER = 'https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoList?mid=a20301010100';

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const defEnd = `${now.getFullYear() + 1}${pad(now.getMonth() + 1)}`;
const [start = '201301', end = defEnd] = process.argv.slice(2);

// 화면에 필요한 항목만 남긴다(등록자 ID·IP·문의 전화 등은 버린다)
const KEEP = ['evtSeq', 'title', 'beginDt', 'endDt', 'tm', 'plc', 'plcItem', 'seeAge', 'ndTm', 'muf', 'spns', 'tktPrc'];

function months(a, b) {
  const out = [];
  let y = +a.slice(0, 4), m = +a.slice(4);
  while (`${y}${pad(m)}` <= b) {
    out.push(`${y}${pad(m)}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

async function fetchMonth(ym) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8', Referer: REFERER, 'User-Agent': 'olpark-stage-plan/1.0 (public data contest)' },
        body: JSON.stringify({ nowYM: ym, plcCd: '' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return [...(j[0] || []), ...(j[1] || [])];
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((s) => setTimeout(s, 2000));
    }
  }
}

const outJson = join(ROOT, 'data', 'events.json');
mkdirSync(dirname(outJson), { recursive: true });
const byId = new Map();
if (existsSync(outJson)) for (const e of JSON.parse(readFileSync(outJson, 'utf8')).events) byId.set(e.evtSeq, e);

for (const ym of months(start, end)) {
  const items = await fetchMonth(ym);
  for (const it of items) {
    const e = {};
    for (const k of KEEP) e[k] = typeof it[k] === 'string' ? it[k].trim() : it[k];
    byId.set(e.evtSeq, e);
  }
  process.stdout.write(`${ym}:${items.length} `);
  await new Promise((s) => setTimeout(s, 400)); // 기관 서버 부담을 줄인다
}

const events = [...byId.values()].sort((a, b) => (a.beginDt < b.beginDt ? -1 : 1));
const payload = { source: REFERER, collectedAt: new Date().toISOString(), count: events.length, events };
writeFileSync(outJson, JSON.stringify(payload));
writeFileSync(join(ROOT, 'data', 'events.js'), `window.OLPARK_EVENTS=${JSON.stringify(payload)};\n`);
console.log(`\n${events.length} events`);
