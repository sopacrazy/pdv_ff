// Roda depois do `vite build` (ver package.json). Zipa dist/ inteiro pra dist-bundle/app-bundle.zip
// — é o que o tablet Android baixa via @capgo/capacitor-updater pra atualizar o app sem precisar
// reinstalar o .apk (ver server/api.js, rotas /api/app/*). Só cobre mudanças no código React/CSS;
// uma mudança nativa de verdade (novo plugin Capacitor, permissão nova) ainda exige gerar e
// reinstalar um novo .apk manualmente.
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const DIST_DIR = path.join(RAIZ, 'dist');
const BUNDLE_DIR = path.join(RAIZ, 'dist-bundle');

const { version } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

fs.mkdirSync(BUNDLE_DIR, { recursive: true });

const zip = new AdmZip();
zip.addLocalFolder(DIST_DIR);
zip.writeZip(path.join(BUNDLE_DIR, 'app-bundle.zip'));

fs.writeFileSync(path.join(BUNDLE_DIR, 'version.json'), JSON.stringify({ version }, null, 2));

console.log(`[bundle] app-bundle.zip gerado para a versão ${version}`);
