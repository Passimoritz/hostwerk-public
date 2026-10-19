#!/usr/bin/env node
'use strict';
/*
 * Builds the interface module of a native Hostwerk extension (SDK 2.7):
 *
 *   node build-native.js <extension folder> [--watch]
 *
 * Bundles <folder>/ui/src/index.jsx into the file named by "ui" in manifest.json (usually ui/index.js) as one ES module.
 * React and Hostwerk's building blocks are NOT bundled – the module shares them with Hostwerk through window.__hostwerk:
 *
 *   import { useState } from 'react';                    → Hostwerk's React
 *   import { get, post, useApi } from '@hostwerk/api';   → API helpers (same login, same error handling)
 *   import { Btn, Modal, toast } from '@hostwerk/ui';    → Hostwerk's components (dialog texts are translated for you)
 *   import { SvcImage, contextMenu } from '@hostwerk/kit';  · '@hostwerk/editor' · '@hostwerk/files' · '@hostwerk/three'
 *   import { t } from '@hostwerk/i18n';                  → t('Server {name} started', { name }) for texts outside JSX
 *
 * JSX text is translated automatically: write English, put German into locales/de.json ({ "English": "Deutsch" }).
 * Icons: import from 'lucide-react' (bundled, tree-shaken). Needs esbuild (npm i -D esbuild lucide-react).
 */
const fs = require('fs');
const path = require('path');

const HOST_MODULES = ['react', 'react-dom', '@hostwerk/api', '@hostwerk/ui', '@hostwerk/kit', '@hostwerk/editor', '@hostwerk/files', '@hostwerk/three', '@hostwerk/i18n'];
const HEAVY = ['@hostwerk/kit', '@hostwerk/editor', '@hostwerk/files', '@hostwerk/three'];

function loadEsbuild(dir) {
  const tries = [dir, process.cwd(), __dirname, path.join(__dirname, '..', '..', '..')];
  for (const t of tries) { try { return require(require.resolve('esbuild', { paths: [t] })); } catch { /* next */ } }
  throw new Error('esbuild not found – run: npm i -D esbuild lucide-react');
}

function hostPlugin(id, used) {
  return {
    name: 'hostwerk-host',
    setup(b) {
      const filter = /^(react|react-dom|react\/jsx-runtime|react\/jsx-dev-runtime|@hostwerk\/[\w-]+(\/jsx-runtime|\/jsx-dev-runtime)?)$/;
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: 'hostwerk' }));
      b.onLoad({ filter: /.*/, namespace: 'hostwerk' }, (a) => {
        const p = a.path;
        const ext = `globalThis.__hostwerk.forExt(${JSON.stringify(id)})`;
        if (/jsx-(dev-)?runtime$/.test(p)) return { contents: `module.exports = ${ext}.runtime;`, loader: 'js' };
        if (p === '@hostwerk/ui') return { contents: `module.exports = ${ext}.ui;`, loader: 'js' };
        if (p === '@hostwerk/i18n') return { contents: `module.exports = { t: ${ext}.t };`, loader: 'js' };
        if (!HOST_MODULES.includes(p)) throw new Error(`${p} is not offered by Hostwerk – available: ${HOST_MODULES.join(', ')}`);
        used.add(p);
        return { contents: `module.exports = globalThis.__hostwerk.mods[${JSON.stringify(p)}];`, loader: 'js' };
      });
    },
  };
}

async function build(dir, { watch = false } = {}) {
  dir = path.resolve(dir);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (!m.ui) throw new Error('manifest.json has no "ui" entry.');
  const entry = ['ui/src/index.jsx', 'ui/src/index.js'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!entry) throw new Error('Missing ui/src/index.jsx');
  const out = path.join(dir, m.ui);
  const esbuild = loadEsbuild(dir);
  const used = new Set();
  const opts = {
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'browser', target: ['chrome120'], outfile: out, write: false,
    jsx: 'automatic', jsxImportSource: '@hostwerk', minify: true, legalComments: 'none', charset: 'utf8',
    nodePaths: [path.join(dir, 'node_modules'), path.join(__dirname, '..', '..', '..', 'node_modules')],
    plugins: [hostPlugin(m.id, used)], logLevel: 'warning',
  };
  const finish = (res) => {
    // Styles imported by the module (import './style.css') land next to it: ui/index.css – Hostwerk loads it with the module
    const js = res.outputFiles.find((f) => /\.js$/.test(f.path));
    const css = res.outputFiles.find((f) => /\.css$/.test(f.path));
    const code = js.text;
    const cssOut = out.replace(/\.js$/, '.css');
    if (css) fs.writeFileSync(cssOut, `/* ${m.id} ${m.version} – built with Hostwerk build-native.js */\n${css.text}`); else fs.rmSync(cssOut, { force: true });
    const need = [...used].filter((x) => HEAVY.includes(x));
    const head = `/* ${m.id} ${m.version} – built with Hostwerk build-native.js. Source: ui/src */\n${need.length ? `await globalThis.__hostwerk.need(${JSON.stringify(need)});\n` : ''}`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, head + code);
    console.log(`✓ ${path.relative(dir, out)} (${Math.round((head.length + code.length) / 1024)} KB${need.length ? `, uses ${need.join(', ')}` : ''})`);
  };
  if (!watch) { finish(await esbuild.build(opts)); return; }
  const c = await esbuild.context({ ...opts, plugins: [...opts.plugins, { name: 'write', setup(b) { b.onEnd((r) => { if (!r.errors.length) finish(r); }); } }] });
  await c.watch();
  console.log('watching ui/src …');
}

module.exports = { build, HOST_MODULES };

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.log('Usage: node build-native.js <extension folder> [--watch]'); process.exit(2); }
  build(dir, { watch: process.argv.includes('--watch') }).catch((e) => { console.error(e.message); process.exit(1); });
}
