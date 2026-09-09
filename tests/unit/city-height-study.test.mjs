import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createHeightStudy} from '../../src/scripts/city/city-height-study.mjs';
test('height study requires explicit valid inputs and clears on edits, selection changes, or unavailable surface',t=>{
 const window=new Window(),root=window.document.createElement('section');window.document.body.append(root);
 const calls=[],states=[];let evidence={parcels:{parcel:{properties:{recordKey:'fixture'}}}},response={status:'shown',reference:'Test display plane; not surveyed ground.'};
 const panel=createHeightStudy(root,{getEvidence:()=>evidence,getCity:()=>({setDevelopmentVolume:v=>{calls.push(v);return response}}),onChange:v=>states.push(v)});
 const $=id=>root.querySelector('#height-'+id),type=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event('input'))};
 t.after(()=>{panel.dispose();window.happyDOM.abort()});
 $('show').click();assert.match($('status').textContent,/Enter 1–100/);assert.equal(states.at(-1),false);
 type('stories','5');type('floor','3.2');$('show').click();assert.equal(calls.at(-1).stories,5);assert.match($('status').textContent,/16.0 m/);assert.equal(states.at(-1),true);
 type('stories','6');assert.equal(calls.at(-1),null);assert.equal(states.at(-1),false);
 $('show').click();response={status:'unavailable',message:'Zoom in and retry.'};panel.refreshRenderer();assert.equal(calls.at(-1),null);assert.match($('status').textContent,/Zoom in/);
 panel.setEvidence(null);assert.equal($('stories').value,'');assert.equal($('floor').value,'');
 evidence=null;type('stories','3');type('floor','3');$('show').click();assert.match($('status').textContent,/Select an exact/);
});
