import {cp,mkdir,writeFile} from 'node:fs/promises';
const source=new URL('../node_modules/web-ifc/',import.meta.url),target=new URL('../public/vendor/web-ifc/',import.meta.url);
await mkdir(target,{recursive:true});
await Promise.all(['web-ifc.wasm','LICENSE.md'].map(name=>cp(new URL(name,source),new URL(name,target))));
await writeFile(new URL('SOURCE.txt',target),'web-ifc 0.0.77 — unmodified package runtime\nLicense: Mozilla Public License 2.0; see LICENSE.md in this directory.\nCorresponding source: https://github.com/ThatOpen/engine_web-ifc/tree/f26c4beef0a668ebdb180d2b95a94097a1e21cef\nSource archive: https://github.com/ThatOpen/engine_web-ifc/archive/f26c4beef0a668ebdb180d2b95a94097a1e21cef.tar.gz\nPackage: https://registry.npmjs.org/web-ifc/-/web-ifc-0.0.77.tgz\nOnly the browser single-threaded WASM binary is copied; local IFC files are never uploaded.\n');
console.info('Pinned web-ifc WASM and MPL notice copied to public/vendor/web-ifc.');
