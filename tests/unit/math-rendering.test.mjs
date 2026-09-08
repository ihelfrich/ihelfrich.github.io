import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createMarkdownProcessor} from '@astrojs/markdown-remark';
import {Window} from 'happy-dom';
import config from '../../astro.config.mjs';

const require=createRequire(import.meta.url);
const processor=await createMarkdownProcessor(config.markdown);
const css=await readFile(require.resolve('katex/dist/katex.css'),'utf8');

// A renderer/stylesheet mismatch previously left every script at full text size.
// Exercise the actual Markdown pipeline and the stylesheet imported by the layout.
for(const [name,source] of [
  ['inline subscripts',String.raw`Forecast $Y_t$ conditional on $X_i$.`],
  ['display limits and powers',String.raw`$$
\hat Y_{T+h\mid T}=\mu+\phi^h(Y_T-\mu),\qquad
s_h^2=\sigma^2\sum_{j=0}^{h-1}\phi^{2j}.
$$`],
  ['math inside worked solutions',String.raw`<details class="solution"><summary>Solution</summary>

The variance is $\sigma_i^2$.

</details>`],
]){
  test(`${name} retain smaller script sizes with the shipped CSS`,async()=>{
    const {code}=await processor.render(source);
    const window=new Window({settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
    try{
      window.document.write(`<style>${css}\n.katex{font-size:20px}</style><article>${code}</article>`);
      assert.equal(window.document.querySelectorAll('.katex-error').length,0);
      const scripts=window.document.querySelectorAll('.reset-size6.size3');
      assert.ok(scripts.length>0,'fixture must contain rendered subscripts or superscripts');
      for(const script of scripts){
        const scriptSize=parseFloat(window.getComputedStyle(script).fontSize);
        const baseSize=parseFloat(window.getComputedStyle(script.closest('.katex')).fontSize);
        assert.ok(Math.abs(scriptSize/baseSize-0.7)<0.001,
          `script must be 70% of base size, got ${scriptSize}px / ${baseSize}px`);
      }
    }finally{await window.happyDOM.abort();window.close();}
  });
}
