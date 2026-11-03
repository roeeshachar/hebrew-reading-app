// Bundles tools/three/gl.js and Three.js into vendor/gl3d.js (one ES module, minified).
import { build } from 'esbuild';
await build({
  entryPoints: ['tools/three/gl.js'], bundle: true, minify: true, format: 'esm', target: 'es2020',
  outfile: 'vendor/gl3d.js', legalComments: 'none',
});
console.log('vendor/gl3d.js built');
