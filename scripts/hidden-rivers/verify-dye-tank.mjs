import {writeFile,mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {vortexDecay,tracerTranslation} from '../../tests/helpers/dye-tank-accuracy.mjs';
import {seawaterMetadata} from '../../src/scripts/hidden-rivers/tank-seawater.mjs';
import {createDyeTank} from '../../src/scripts/hidden-rivers/dye-tank.mjs';
const result={model:'salinity-dye-tank-v3',classification:'2D physical approximation; synthetic/numerical verification only',fixture:{widthM:.24,heightM:.18,waterSalinityGKg:30,dropSalinityGKg:36,dropRadiusM:.009,dropPositionM:[.12,.09],timeS:1.2},comparisons:[],browserGrid:[],extremes:[],densityLookup:seawaterMetadata,analyticVortices:[],tracerTranslation:[]};
for(const [nx,dt] of [[48,.01],[72,.01],[96,.01],[72,.005]]){
 const tank=createDyeTank({nx,ny:nx*3/4});tank.drop({x:.12,y:.09,radius:.009,salinity:36});
 for(let n=0;n<Math.round(1.2/dt);n++)tank.step(dt);const d=tank.diagnostics();
 result.comparisons.push({grid:[nx,nx*3/4],dtS:dt,...d,saltResidual:d.saltIntegral-tank.initialSaltIntegral-tank.injectedSaltIntegral,dyeResidual:d.dyeIntegral-tank.injectedDyeIntegral});
}
const [coarse,medium,fine,half]=result.comparisons;
result.momentDifferencesM={coarseVsFine:Math.abs(coarse.dyeCentroid.y-fine.dyeCentroid.y),mediumVsFine:Math.abs(medium.dyeCentroid.y-fine.dyeCentroid.y),dtHalving:Math.abs(medium.dyeCentroid.y-half.dyeCentroid.y)};
assert.ok(result.momentDifferencesM.coarseVsFine<.003&&result.momentDifferencesM.mediumVsFine<.002&&result.momentDifferencesM.dtHalving<.001);
for(const [nx,ny,dt] of [[256,128,.01],[256,256,.01],[256,128,.005]]){
 const tank=createDyeTank({nx,ny});tank.drop({x:.12,y:.09,radius:.009,salinity:36});
 for(let n=0;n<Math.round(1.2/dt);n++)tank.step(dt);const d=tank.diagnostics();
 assert.ok(d.divergenceRms<1e-8&&Math.abs(d.saltIntegral-tank.initialSaltIntegral-tank.injectedSaltIntegral)<1e-10);
 result.browserGrid.push({grid:[nx,ny],dtS:dt,...d});
}
result.browserMomentDifferencesM={finerVerticalGrid:Math.abs(result.browserGrid[0].dyeCentroid.y-result.browserGrid[1].dyeCentroid.y),dtHalving:Math.abs(result.browserGrid[0].dyeCentroid.y-result.browserGrid[2].dyeCentroid.y)};
assert.ok(result.browserMomentDifferencesM.finerVerticalGrid<.002&&result.browserMomentDifferencesM.dtHalving<.001);
for(const [nx,dt] of [[64,.01],[128,.01],[64,.005]])result.analyticVortices.push(vortexDecay(nx,dt));
assert.ok(result.analyticVortices[0].relativeEnergyError<.005&&result.analyticVortices[1].relativeEnergyError<result.analyticVortices[0].relativeEnergyError);
for(const nx of [64,128])result.tracerTranslation.push(tracerTranslation(nx));
assert.ok(result.tracerTranslation[0].relativeL1Error<.1&&result.tracerTranslation[1].relativeL1Error<result.tracerTranslation[0].relativeL1Error);
for(const [water,salt,y] of [[0,40,.03],[40,0,.15],[30,36,.03],[30,24,.15]]){
 const tank=createDyeTank({nx:256,ny:128,waterSalinity:water});tank.drop({x:.12,y,radius:.009,salinity:salt});let maxDiv=0,maxResidual=0;
 for(let n=0;n<600;n++){tank.step(.01);if(n%25===0){const d=tank.diagnostics();maxDiv=Math.max(maxDiv,d.divergenceRms);maxResidual=Math.max(maxResidual,Math.abs(d.saltIntegral-tank.initialSaltIntegral-tank.injectedSaltIntegral));}}
 const d=tank.diagnostics();assert.ok(d.salinityMin>=Math.min(water,salt)-1e-5&&d.salinityMax<=Math.max(water,salt)+1e-5);assert.ok(maxDiv<1e-6&&maxResidual<1e-10);
 result.extremes.push({waterSalinityGKg:water,dropSalinityGKg:salt,...d,maxDivergenceRms:maxDiv,maxSaltResidual:maxResidual});
}
await mkdir('public/hidden-rivers/dye-tank',{recursive:true});await writeFile('public/hidden-rivers/dye-tank/verification.json',JSON.stringify(result,null,2)+'\n');
await writeFile('public/hidden-rivers/dye-tank/model.md',await readFile('docs/hidden-rivers/dye-tank-model.md'));
console.log(JSON.stringify({momentDifferencesM:result.momentDifferencesM,browserMomentDifferencesM:result.browserMomentDifferencesM,vortexEnergyError:result.analyticVortices[0].relativeEnergyError,tracerL1:result.tracerTranslation[0].relativeL1Error,maxDiv:Math.max(...result.extremes.map(d=>d.maxDivergenceRms)),maxSaltResidual:Math.max(...result.extremes.map(d=>d.maxSaltResidual)),extremesPassed:result.extremes.length}));
