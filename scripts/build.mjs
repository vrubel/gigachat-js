#!/usr/bin/env node
// Кроссплатформенный порт scripts/build (был bash со встроенными rm/cp/mkdir —
// они отсутствуют в Windows cmd, из-за чего установка из исходников падала).
// Логика идентична оригиналу: собрать пакет в dist/ и проверить его require/import.
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

// npm на Windows — это npm.cmd, поэтому npm-вызовы идут через shell; node — напрямую.
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const runNpm = (args, opts = {}) =>
  execFileSync('npm', args, { stdio: 'inherit', shell: true, ...opts });

// Собираем в dist и публикуем оттуда, чтобы src/resources/foo.ts стал
// <package root>/resources/foo.js (импорт "gigachat/resources/foo" работает).
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');

// Копируем src в dist/src и README; сборка идёт из dist/src в dist, чтобы
// source map для index.js.map ссылался на ./src/index.ts и т.п.
cpSync('src', join('dist', 'src'), { recursive: true });
copyFileSync('README.md', join('dist', 'README.md'));
for (const f of ['LICENSE', 'CHANGELOG.md']) {
  if (existsSync(f)) copyFileSync(f, join('dist', f));
}
if (existsSync(join('bin', 'cli'))) {
  mkdirSync(join('dist', 'bin'), { recursive: true });
  copyFileSync(join('bin', 'cli'), join('dist', 'bin', 'cli'));
}

// Преобразует пути export map для каталога dist и делает ещё пару мелочей.
const distPkg = execFileSync(process.execPath, ['scripts/utils/make-dist-package-json.cjs'], { encoding: 'utf8' });
writeFileSync(join('dist', 'package.json'), distPkg);

// Сборка в .js/.mjs/.d.ts
runNpm(['exec', 'tsc-multi']);

// С "moduleResolution": "nodenext" ESM должен резолвиться в index.d.mts,
// иначе default-импорт даёт TS-ошибки.
copyFileSync(join('dist', 'index.d.ts'), join('dist', 'index.d.mts'));
copyFileSync('tsconfig.dist-src.json', join('dist', 'src', 'tsconfig.json'));

// Проверяем, что ничего не падает при require CJS и import ESM собранного пакета.
run(process.execPath, ['-e', 'require("gigachat")'], { cwd: 'dist' });
run(process.execPath, ['--input-type=module', '-e', 'import("gigachat")'], { cwd: 'dist' });
