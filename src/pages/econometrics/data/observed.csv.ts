import {observationSample,world,csv} from '../../../lib/econometrics.mjs';
export function GET(){return new Response(csv(world(observationSample(),.5),['id','x','y']),{headers:{'Content-Type':'text/csv;charset=utf-8'}});}
