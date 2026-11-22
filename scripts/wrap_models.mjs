// models/*.glb 를 models/*.glb.js 로 감싼다.
// 브라우저는 file:// 에서 fetch로 GLB를 못 읽으므로, 로컬에서 index.html을 바로 열 때는 이 사본을 쓴다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'models');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
  const key = f.replace(/\.glb$/, '');
  const b64 = readFileSync(join(dir, f)).toString('base64');
  writeFileSync(join(dir, `${f}.js`), `(window.OLPARK_MODEL=window.OLPARK_MODEL||{})[${JSON.stringify(key)}]="${b64}";\n`);
  console.log(f, '→', `${f}.js`);
}
