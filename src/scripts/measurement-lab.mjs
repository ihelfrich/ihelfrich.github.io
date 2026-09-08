import {profiles, ordinal, compare, eligibility} from '../lib/measurement.mjs';

const number = value => Math.abs(value)<1e-9?'0':Number(value.toFixed(2)).toString();
const x = w => 68+w*620;
const y = gap => 300-(gap+60)*2.4;
const verdicts = {
  A:'Every compatible profile and allowed weight favors A under this scoring rule.',
  B:'Every compatible profile and allowed weight favors B under this scoring rule.',
  'weak-A':'A is never worse under this scoring rule; equality is still possible.',
  'weak-B':'B is never worse under this scoring rule; equality is still possible.',
  equal:'The scores are equal throughout this scenario set. This is equality within the declared model.',
  unresolved:'Both rankings remain possible. The evidence and allowed trade-offs do not settle the comparison.'
};

export function initializeMeasurement(root=document){
  for(const section of root.querySelectorAll('[data-measurement]')){
    if(section.dataset.initialized)continue;
    section.dataset.initialized='true';
    const find=selector=>section.querySelector(selector);
    const text=(selector,value)=>{const el=find(selector);if(el)el.textContent=value;};
    const attr=(selector,key,value)=>{const el=find(selector);if(el)el.setAttribute(key,String(value));};
    let record;
    function update(){
      const center=Number(find('[data-m-weight]').value)/100;
      const spread=Number(find('[data-m-spread]').value)/100;
      const weights=[Math.max(0,Math.round((center-spread)*100)/100),Math.min(1,Math.round((center+spread)*100)/100)];
      const audit=find('[data-m-audit]').checked;
      const veto=find('[data-m-veto]').checked;
      const q=Number(find('[data-m-q]').value);
      const scenario=profiles(audit), result=compare(scenario.A,scenario.B,weights), recoding=ordinal(q);
      const feasibility=veto?{A:eligibility(scenario.A.control,50),B:eligibility(scenario.B.control,50)}:null;
      record={schema:'measurement-argument/v1',dataStatus:'synthetic teaching scenario',profiles:scenario,weights,controlAudit:audit,controlFloor:veto?50:null,comparison:result,feasibility,ordinal:{q,...recoding},assumptions:[
        'Two hypothetical service designs, not assessments of people.',
        'Anchored 0–100 access and control rubrics with meaningful differences are assumed, not empirically validated.',
        'Profile coordinates vary jointly over their rectangular scenario set; weights vary independently of profiles.',
        'The score is additive and compensatory: w times access plus (1-w) times control.',
        'Ranges are compatible possibilities, not sampling confidence intervals or probability distributions.',
        'The control floor, when enabled, is a separate noncompensatory eligibility rule.',
        'The ordinal exercise uses a separate four-category dataset and a common strictly increasing recoding.'
      ],source:'https://ihelfrich.github.io/econometrics/measurement/technical/'};
      text('[data-m-weight-value]',`${Math.round(center*100)}%`);
      text('[data-m-spread-value]',`${Math.round(weights[0]*100)}–${Math.round(weights[1]*100)}% allowed`);
      text('[data-m-q-value]',number(q));
      text('[data-m-gap]',`[${number(result.lower)}, ${number(result.upper)}]`);
      text('[data-m-verdict]',verdicts[result.status]);
      section.dataset.conclusion=result.status;
      text('[data-m-veto-result]',veto?'Control floor 50: A is excluded in every compatible profile. B is guaranteed to pass. This rule excludes A even when its weighted score wins.':'No eligibility floor is imposed. Access can compensate for lower participant control in this scoring rule.');
      text('[data-m-profile-note]',audit?'Control audit: A 30–40; B 70–80. Access ranges are unchanged.':'Initial evidence: A control 25–45; B control 65–85.');
      text('[data-m-profile-a]',`${scenario.A.control[0]}–${scenario.A.control[1]}`);
      text('[data-m-profile-b]',`${scenario.B.control[0]}–${scenario.B.control[1]}`);
      const p0=compare(scenario.A,scenario.B,[0,0]),p1=compare(scenario.A,scenario.B,[1,1]);
      attr('[data-m-envelope]','d',`M ${x(0)} ${y(p0.lower)} L ${x(1)} ${y(p1.lower)} L ${x(1)} ${y(p1.upper)} L ${x(0)} ${y(p0.upper)} Z`);
      attr('[data-m-selection]','x',x(weights[0]));attr('[data-m-selection]','width',Math.max(1,x(weights[1])-x(weights[0])));
      attr('[data-m-cursor]','x1',x(center));attr('[data-m-cursor]','x2',x(center));
      attr('[data-m-range]','y1',y(result.lower));attr('[data-m-range]','y2',y(result.upper));
      for(const [key,gap] of [['low',result.lower],['high',result.upper]]){
        attr(`[data-m-${key}-cap]`,'y1',y(gap));attr(`[data-m-${key}-cap]`,'y2',y(gap));
        attr(`[data-m-${key}-label]`,'y',y(gap)+5);text(`[data-m-${key}-label]`,number(gap));
      }
      text('[data-m-plot-description]',`Score gap A minus B ranges from ${number(result.lower)} to ${number(result.upper)} with access weights ${Math.round(weights[0]*100)} to ${Math.round(weights[1]*100)} percent. ${verdicts[result.status]}`);
      for(let i=0;i<4;i++){
        const position=60+recoding.values[i]*600;
        attr(`[data-m-recode-line="${i}"]`,'x2',position);
        attr(`[data-m-recode-point="${i}"]`,'cx',position);
        attr(`[data-m-recode-label="${i}"]`,'x',position);
        text(`[data-m-recode-value="${i}"]`,recoding.values[i].toFixed(3));
      }
      text('[data-m-mean-a]',recoding.meanA.toFixed(3));text('[data-m-mean-b]',recoding.meanB.toFixed(3));
      text('[data-m-ordinal-result]',Math.abs(recoding.gap)<1e-10?'The arithmetic means tie with equal category spacing. Order alone does not require that spacing.':`The recoded mean favors ${recoding.gap>0?'A':'B'}. All individual rankings and both endpoints are unchanged. Pairwise superiority remains 0.50.`);
      text('[data-m-record]',JSON.stringify(record,null,2));
    }
    section.addEventListener('input',update);
    for(const button of section.querySelectorAll('[data-m-preset]'))button.addEventListener('click',()=>{find('[data-m-weight]').value=button.dataset.mPreset;find('[data-m-spread]').value='0';update();});
    for(const button of section.querySelectorAll('[data-m-q-preset]'))button.addEventListener('click',()=>{find('[data-m-q]').value=button.dataset.mQPreset;update();});
    find('[data-m-reset]').addEventListener('click',()=>{
      find('[data-m-weight]').value='50';find('[data-m-spread]').value='0';find('[data-m-q]').value='1';find('[data-m-audit]').checked=false;find('[data-m-veto]').checked=false;update();
    });
    find('[data-m-export]').addEventListener('click',()=>{
      const view=section.ownerDocument.defaultView;
      const blob=new view.Blob([JSON.stringify(record,null,2)],{type:'application/json'});
      const url=view.URL.createObjectURL(blob),a=section.ownerDocument.createElement('a');
      a.href=url;a.download='measurement-argument.json';section.append(a);a.click();a.remove();
      view.setTimeout(()=>view.URL.revokeObjectURL(url),1000);
      text('[data-m-export-status]','Analysis record prepared for download. It includes the synthetic-data label and every selected assumption.');
    });
    update();
  }
}
