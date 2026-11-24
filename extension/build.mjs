import { build } from 'esbuild'
import { copyFile } from 'node:fs/promises'
await Promise.all(
  ['background', 'content'].map((name) =>
    build({
      entryPoints: ['src/' + name + '/index.ts'],
      outfile: 'dist/' + (name === 'background' ? 'worker' : 'observe') + '.js',
      bundle: true,
      minify: true,
      format: 'iife',
      target: 'chrome120',
      legalComments: 'eof',
    }),
  ),
)
await copyFile('manifest.json', 'dist/manifest.json')
