import {loadCountyPropertyRecords,countyTaxLink,normalizeCountyBill,COUNTY_RECORD_URL} from '../../lib/county-property-records.mjs';
import {escapeHtml as e} from '../../lib/property-proforma-export.mjs';

const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n):'Not reported';
const number=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString():'Not reported';
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString().slice(0,10):'Not supplied';
const array=value=>Array.isArray(value)?value:[];
function sourceLink(value,label){
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&['www.arcgis.com','revenue.stlouisco.com','maps.stlouisco.com','taxpayments.stlouiscountymo.gov'].includes(url.hostname))return `<a href="${e(url.href)}" target="_blank" rel="noopener">${e(label)} ↗</a>`;}catch{}
 return `${e(label)} · link not supplied`;
}
function table(headers,rows){return `<div class="cr-table-wrap"><table><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<${i?'td':'th'}>${e(v)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function histories(data){
 const archived=data.history,reviewed=data.assessmentHistory;
 const newer=data.transfers?.parcelId===data.parcelId&&Array.isArray(data.transfers?.sales)?data.transfers:null;
 const taxes=array(archived?.taxes),sales=array(newer?newer.sales:archived?.sales),assessments=array(archived?.assessments),appraisals=array(archived?.appraisals),years=array(reviewed?.assessments);
 const archiveSource=archived?.source;
 const archiveNote=`<p class="small-note">${sourceLink(archiveSource?.catalogUrl||archiveSource?.url,archiveSource?.name||'County archive')} · retrieved ${e(date(archiveSource?.retrievedAt))}. Archive component timestamps describe stored files, not current property status.</p>`;
 const sections=[];
 if(years.length)sections.push(`<details class="cr-detail"><summary>Assessment history · ${years.length} years</summary>${table(['Year','Appraised','Assessed'],years.map(v=>[v.year??v.taxYear,money(v.appraisedValueUSD??v.appraisedTotalUSD),money(v.assessedValueUSD??v.assessedTotalUSD)]))}<p class="small-note">${sourceLink(reviewed.sourceUrl||reviewed.source?.url,'County assessment record')} · retrieved ${e(date(reviewed.retrievedAt||reviewed.source?.retrievedAt))}.${reviewed.sourceUpdatedLabel?` Source update label: ${e(reviewed.sourceUpdatedLabel)}; timezone not supplied.`:''}</p><p>Imported assessment history for a small reviewed set. Administrative values are not sale prices.</p></details>`);
 if(taxes.length)sections.push(`<details class="cr-detail"><summary>Historical tax records · ${taxes.length} entries</summary><p>July 2021 archive. Separate class/roll rows are not added together into an annual bill and do not establish a current balance.</p>${table(['Tax year','Class','Tax amount','Other fees'],taxes.map(t=>[t.taxYear,t.assessmentClass,money(t.taxAmountUSD),money(t.otherFeesUSD)]))}${archiveNote}</details>`);
 if(sales.length||newer){
  const shown=[...sales].sort((a,b)=>String(b.saleDateISO||b.transactionDateISO||'').localeCompare(String(a.saleDateISO||a.transactionDateISO||''))||(b.sourceRow||0)-(a.sourceRow||0)).slice(0,12);
  const description=newer?`<p>Archive member timestamp: ${e(newer.archiveTimestamp)} (${e(newer.source?.timestampTimezone||'timezone not supplied')}).${newer.maxObservedSaleDate?` Latest interpreted sale date among retained study rows: ${e(newer.maxObservedSaleDate)}.`:''} This does not establish complete coverage through that date. Source dates, reported prices and validity codes are retained; these are not verified market comparables.</p>`:'<p>County archive through July 2021. Reported prices and validity codes are retained; these are not verified market comparables.</p>';
  const labels=(newer||archived)?.codeLabels?.saleValidity||{},codes=[...new Set(shown.map(s=>s.validityCode).filter(Boolean))];
  const codeNote=codes.length?`<p class="small-note">Source code meanings: ${codes.map(code=>`${e(code)} = ${e(typeof labels[code]==='string'?labels[code]:'meaning not supplied')}`).join('; ')}. These are County classifications, not independent verification.</p>`:'';
  const citation=newer?`<p class="small-note">${sourceLink(newer.source?.catalogUrl||newer.source?.url,newer.source?.name||'County transfer archive')} · retrieved ${e(date(newer.source?.retrievedAt))}. The evidence download also retains the older CERT21 archive. Two-digit date-century interpretations remain flagged in exported rows.</p>`:archiveNote;
  sections.push(`<details class="cr-detail"><summary>${newer?'Transfer records · November 2025 archive':'Historical transfer records'} · ${sales.length} entries</summary>${description}${sales.length?table(['Source date','Reported price / status','Validity code','Book/page'],shown.map(s=>[s.saleDate||s.transactionDate||'Unknown',`${money(s.priceUSD)} · ${s.priceStatus||'Reported'}`,s.validityCode||'Unknown',[s.book,s.page].filter(Boolean).join('/')||'Unknown'])):'<p>No matching transfer rows in this extract. This does not establish that no transfers occurred.</p>'}${sales.length>12?'<p>Showing 12 entries, ordered by interpreted source date. The evidence download contains all matched rows in both archives.</p>':''}${codeNote}${citation}</details>`);
 }
 if(assessments.length||appraisals.length)sections.push(`<details class="cr-detail"><summary>Archived valuation records · ${assessments.length+appraisals.length} entries</summary><p>July 2021 archive. Assessment and appraisal rows remain separate; a matching locator does not certify unchanged parcel boundaries.</p>${assessments.length?table(['Tax year','Assessment class','Appraised total','Assessed total'],assessments.map(v=>[v.taxYear,v.assessmentClass||'Not supplied',money(v.appraisedTotalUSD),money(v.assessedTotalUSD)])):''}${appraisals.length?table(['Tax year','Appraisal roll','Appraised total','Source market value'],appraisals.map(v=>[v.taxYear,v.rollType||'Not supplied',money(v.appraisedTotalUSD),money(v.sourceMarketValueUSD)])):''}${archiveNote}</details>`);
 return sections.join('');
}

export function createCountyRecordsPanel(root,{parcel,source,onTaxEvidence=()=>{},onScenario=()=>{},load=loadCountyPropertyRecords}={}){
 let disposed=false,serial=0,current=null,controller=null;
 const downloads=new Set(),official=countyTaxLink(parcel.parcelId);
 root.innerHTML=`<section class="county-records" aria-label="Understand this property"><div class="cr-heading"><span>UNDERSTAND THIS PROPERTY</span><button type="button" data-cr-refresh class="text-button">Refresh County record</button></div><p data-cr-summary></p><p data-cr-status class="cr-status" role="status">Checking the County’s published record…</p><div data-cr-values></div><div data-cr-bill></div><div class="cr-next"><a href="${e(official)}" target="_blank" rel="noopener">Open official tax bill ↗</a><button type="button" data-cr-scenario class="secondary-button">Build a rental budget</button></div><details class="cr-help"><summary>How to read these numbers</summary><ol><li><strong>Appraised value:</strong> the County’s value for assessment purposes. A buyer’s offer or an independent appraisal can differ.</li><li><strong>Assessed value:</strong> the value used in the tax calculation. It is not the amount you pay.</li><li><strong>Annual tax:</strong> a charge for a specific tax year. Fees, payments and unpaid balances are different amounts.</li></ol><p>For a rental budget, enter your purchase price, expected rent and actual operating costs. County values do not fill those assumptions automatically.</p></details><div data-cr-history></div><details class="cr-detail"><summary>Detailed record &amp; source fields</summary><div data-cr-details></div></details><div class="cr-export"><button type="button" data-cr-export class="text-button">Download property evidence JSON</button><span data-cr-export-status class="small-note" role="status"></span></div></section>`;
 const q=name=>root.querySelector(`[data-cr-${name}]`);
 function render(data){
  if(data.parcelId&&data.parcelId!==parcel.parcelId||data.record?.parcelId!==parcel.parcelId)throw Error('Property evidence identity did not match.');
  let bill=null,billStatus=data.billStatus;
  if(data.bill){try{bill=normalizeCountyBill(data.bill,parcel);}catch{billStatus='invalid';}}
  current={...data,bill,billStatus};const r=current.record,b=current.bill;
  q('summary').textContent=`${r.dwellingUnits==null?'Dwelling count not reported':`${number(r.dwellingUnits)} recorded dwelling unit${r.dwellingUnits===1?'':'s'}`} · ${r.livingAreaSqFt==null?'Living area not reported':`${number(r.livingAreaSqFt)} sq ft of living area`} · ${r.yearBuilt?`built ${r.yearBuilt}`:'build year not reported'}.`;
  q('status').textContent=data.liveStatus==='ready'?`County record checked ${date(r.source?.retrievedAt)} · source tax year ${r.taxYear??'not supplied'}.`:`Showing the saved parcel record from ${date(source?.retrievedAt)}. Live refresh unavailable; you can retry.`;
  q('values').innerHTML=`<div class="cr-value-grid"><article><small>County appraised value</small><strong>${money(r.assessorAppraisedValueUSD)}</strong><p>County valuation · not a sale price</p></article><article><small>Assessed value</small><strong>${money(r.assessedValueUSD)}</strong><p>Tax calculation base · not a bill</p></article></div>`;
  const charges=b?[`${money(b.otherFeesUSD)} separate costs/fees`,...(b.penaltyUSD>0?[`${money(b.penaltyUSD)} penalties`]:[]),...(b.interestUSD>0?[`${money(b.interestUSD)} interest`]:[]),`${money(b.totalBilledUSD)} total billed`].join(' · '):'';
  const missing=current.billStatus==='invalid'?'The imported bill could not be verified for this property and tax year. Open the official record to check the bill.':current.billStatus==='unavailable'?'The imported bill source is unavailable. Retry or open the official record to check the annual bill.':'A recent bill for this parcel has not been imported. The official link opens the County’s tax record.';
  q('bill').innerHTML=b?`<section class="cr-bill"><div><small>${e(b.taxYear)} ANNUAL PROPERTY TAX</small><strong>${money(b.amountUSD)}</strong><p>${charges}</p></div><p>This bill is for ${e(b.taxYear)}. The County parcel record’s tax year may be different. Review future tax changes when budgeting.</p>${sourceLink(b.sourceUrl,'View this source bill')}<p class="small-note">Imported ${e(date(b.retrievedAt))}. This is a dated bill record, not a live payment-status check.</p></section>`:`<section class="cr-bill cr-missing"><strong>Check the annual bill</strong><p>${missing} An assessed value cannot substitute for a bill.</p><small>${number(data.billCoverage)} parcel bills imported in this edition.</small></section>`;
  const rows=[['Parcel locator',parcel.parcelId],['Source tax year',r.taxYear??'Not supplied'],['Valuation effective year','Not supplied by this GIS layer'],['Appraised land',money(r.appraisedLandUSD)],['Appraised improvements',money(r.appraisedImprovementsUSD)],['Assessed land',money(r.assessedLandUSD)],['Assessed improvements',money(r.assessedImprovementsUSD)],['Lot area',r.areaSqFt==null?'Not reported':`${number(r.areaSqFt)} sq ft`],['Property class code',r.propertyClass||'Not supplied'],['Land-use code',r.landUseCode??'Not supplied'],['Taxability code',r.taxCode||'Not supplied'],['Taxing district (bill)',b?.taxDistrict||'Not imported'],['Municipality',r.municipality||'Not supplied'],['School district',r.schoolDistrict||'Not supplied'],['Fire district',r.fireDistrict||'Not supplied'],['Library district',r.libraryDistrict||'Not supplied'],['Subdivision',r.subdivision||'Not supplied'],['Deed book/page reference',r.deedBookPage||'Not supplied'],['Lot dimensions (source text)',r.lotDimensions||'Not supplied'],['Current source object ID',r.sourceObjectId??'Not supplied']];
  q('details').innerHTML=`<dl>${rows.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl><p>A deed reference is a document pointer, not a verified sale price or ownership history. A source tax year does not establish the valuation’s effective date. District labels do not establish zoning permissions.</p><p>${sourceLink(r.source?.queryUrl||COUNTY_RECORD_URL,'County source record')} · Retrieved ${e(date(r.source?.retrievedAt))}. Source edit date: ${e(date(r.source?.sourceDataEditedAt))}.</p>`;
  q('history').innerHTML=histories(current);
 }
 render({record:{...parcel,source},liveStatus:'pending',bill:null,billCoverage:0});q('status').textContent='Checking current County records…';
 async function refresh(){
  if(disposed)return;
  controller?.abort();controller=new AbortController();const request=++serial;
  q('refresh').disabled=true;q('status').textContent='Checking current County records…';
  try{const data=await load(parcel,{signal:controller.signal,source});if(disposed||request!==serial)return;render(data);onTaxEvidence(current.bill);}
  catch{if(!disposed&&request===serial)q('status').textContent='Refresh unavailable. Saved property facts remain available; retry or open the official record.';}
  finally{if(!disposed&&request===serial)q('refresh').disabled=false;}
 }
 const handleRefresh=()=>void refresh(),handleScenario=event=>{if(!disposed)onScenario(event);};
 function handleExport(){
  if(disposed||!current)return;
  const bundle={...current,schema:'county-property-evidence-v1',parcelId:parcel.parcelId,selectedRecordKey:parcel.recordKey,exportedAt:new Date().toISOString()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'})),a=root.ownerDocument.createElement('a');
  a.href=url;a.download=`${parcel.parcelId}-property-evidence.json`;root.ownerDocument.body.append(a);a.click();a.remove();
  const entry={url,timer:setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(entry);},60000)};downloads.add(entry);
  q('export-status').textContent='Evidence file prepared with source dates.';
 }
 q('refresh').addEventListener('click',handleRefresh);q('scenario').addEventListener('click',handleScenario);q('export').addEventListener('click',handleExport);
 void refresh();
 return {dispose(){if(disposed)return;disposed=true;serial++;controller?.abort();q('refresh').removeEventListener('click',handleRefresh);q('scenario').removeEventListener('click',handleScenario);q('export').removeEventListener('click',handleExport);for(const entry of downloads){clearTimeout(entry.timer);URL.revokeObjectURL(entry.url);}downloads.clear();}};
}
