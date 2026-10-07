import {writeFile,mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createDyeTank} from '../../src/scripts/hidden-rivers/dye-tank.mjs';
const result={model:'salinity-dye-tank-v1',classification:'2D physical approximation; synthetic/numerical verification only',fixture:{widthM:.24,heightM:.18,waterSalinityGKg:30,dropSalinityGKg:36,dropRadiusM:.009,dropPositionM:[.12,.09],timeS:1.2},comparisons:[],extremes:[]};
for(const [nx,dt] of [[48,.01],[72,.01],[96,.01],[72,.005]]){
 const tank=createDyeTank({nx,ny:nx*3/4});tank.drop({x:.12,y:.09,radius:.009,salinity:36});
 for(let n=0;n<Math.round(1.2/dt);n++)tank.step(dt);const d=tank.diagnostics();
 result.comparisons.push({grid:[nx,nx*3/4],dtS:dt,...d,saltResidual:d.saltIntegral-tank.initialSaltIntegral-tank.injectedSaltIntegral,dyeResidual:d.dyeIntegral-tank.injectedDyeIntegral});
}
const [coarse,medium,fine,half]=result.comparisons;
result.momentDifferencesM={coarseVsFine:Math.abs(coarse.dyeCentroid.y-fine.dyeCentroid.y),mediumVsFine:Math.abs(medium.dyeCentroid.y-fine.dyeCentroid.y),dtHalving:Math.abs(medium.dyeCentroid.y-half.dyeCentroid.y)};
assert.ok(result.momentDifferencesM.coarseVsFine<.003&&result.momentDifferencesM.mediumVsFine<.002&&result.momentDifferencesM.dtHalving<.001);
for(const [water,salt,y] of [[0,40,.03],[40,0,.15],[30,36,.03],[30,24,.15]]){
 const tank=createDyeTank({nx:96,ny:72,waterSalinity:water});tank.drop({x:.12,y,radius:.009,salinity:salt});let maxDiv=0,maxResidual=0;
 for(let n=0;n<600;n++){tank.step(.01);if(n%25===0){const d=tank.diagnostics();maxDiv=Math.max(maxDiv,d.divergenceRms);maxResidual=Math.max(maxResidual,Math.abs(d.saltIntegral-tank.initialSaltIntegral-tank.injectedSaltIntegral));}}
 const d=tank.diagnostics();assert.ok(d.salinityMin>=Math.min(water,salt)-1e-5&&d.salinityMax<=Math.max(water,salt)+1e-5);assert.ok(maxDiv<1e-6&&maxResidual<1e-10);
 result.extremes.push({waterSalinityGKg:water,dropSalinityGKg:salt,...d,maxDivergenceRms:maxDiv,maxSaltResidual:maxResidual});
}
await mkdir('public/hidden-rivers/dye-tank',{recursive:true});await writeFile('public/hidden-rivers/dye-tank/verification.json',JSON.stringify(result,null,2)+'\n');
await writeFile('public/hidden-rivers/dye-tank/model.md',await readFile('docs/hidden-rivers/dye-tank-model.md'));
console.log(JSON.stringify({momentDifferencesM:result.momentDifferencesM,maxDiv:Math.max(...result.extremes.map(d=>d.maxDivergenceRms)),maxSaltResidual:Math.max(...result.extremes.map(d=>d.maxSaltResidual)),extremesPassed:result.extremes.length}));
