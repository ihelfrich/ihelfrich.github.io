/** Presentation only: all live quantities come from the analytic lesson result. */
const number = n => new Intl.NumberFormat('en-US', {maximumFractionDigits: 5}).format(Math.abs(n) < 1e-12 ? 0 : n);
const signed = n => `${n > 1e-12 ? '+' : ''}${number(n)}`;
const step = (label, value, explanation) => ({label, value, explanation});
export const intuition = {
 slope: {
  title: 'How steep is it right here?',
  idea: 'Imagine walking along this curve. Your average climb over a whole step can differ from how steep the ground is under your foot.',
  picture: 'Purple is the path. Gold joins the start and end of your step. Mint shows the slope right at the start, when one exists.',
  controls: {fn:'Choose a path',x:'Where you start',h:'How far you step'},
  labels: ['Slope right here','Average slope to the right','Average slope to the left'],
  examples: [{label:'A smooth uphill path',params:{fn:'square',x:1,h:.8}},{label:'A sharp corner',params:{fn:'abs',x:0,h:.5}}],
  question: 'At a sharp V-shaped corner, is there one slope that fits both sides?',answers:['Yes, the downhill slope','Yes, a flat slope','No, the two sides disagree'],
  feedback: 'Coming from the left you go downhill; leaving to the right you go uphill. A single slope cannot describe both, even as your step shrinks.'
 },
 product: {
  title:'Grow both sides. Count every piece.',
  idea:'Make a rectangular garden longer and wider. You add a strip along each edge and a little square where the two new edges meet.',
  picture:'The purple rectangle is what you already had. Separate the pieces to see the two strips and the gold corner; drag the gold handle to grow them.',
  controls:{x:'Original short side',h:'Extra length on each side'},labels:['Total new area','Two edge strips','Little corner'],
  examples:[{label:'Make the corner obvious',params:{x:2,h:1}},{label:'Make a tiny extension',params:{x:2,h:.05}}],
  question:'When you make both sides longer, which changes count?',answers:['Only one edge','Both edges','Only the little corner'],
  feedback:'Both edges add area. For a tiny extension the corner is much smaller than the strips, which is why the derivative counts two contributions.'
 },
 chain: {
  title:'A nudge goes through two machines.',
  idea:'The first machine squares your input and adds one. The second takes its log. A tiny nudge gets scaled at each step: multiply the two local effects.',
  picture:'Read the boxes left to right. On the graph, purple shows the full result and the gold straight line predicts nearby changes from the starting point.',
  controls:{x:'Starting input',h:'Size of your nudge'},labels:['Local response per input unit','What actually changed','Small-nudge prediction'],
  examples:[{label:'Reverse the response',params:{x:-1,h:.2}},{label:'Try a flat starting point',params:{x:0,h:.2}},{label:'Start with a positive input',params:{x:1,h:.2}}],
  question:'At input zero, the first machine is locally flat. What is the final local response?',answers:['Zero','One','It cannot be defined'],
  feedback:'The second machine cannot amplify a first-order change that is zero. A finite nudge still changes the output, because the first machine bends.'
 },
 logs: {
  title:'Measure growth in multiples.',
  idea:'An ordinary ruler counts how much you add. A log ruler counts how much you multiply. Doubling a small amount and doubling a large amount travel the same log distance.',
  picture:'Follow the purple start and gold end from the ordinary ruler to the log ruler. Change the starting amount while keeping the percentage fixed.',
  controls:{x:'Starting amount',pct:'Grow or shrink by (%)',base:'Ruler scale (log base)'},labels:['Actual log distance','Small-change estimate','Log distance per extra input unit'],
  examples:[{label:'Double 2 to 4',params:{x:2,pct:100,base:Math.E}},{label:'Double 4 to 8',params:{x:4,pct:100,base:Math.E}},{label:'Try just 1% growth',params:{x:2,pct:1,base:Math.E}}],
  question:'If you double an amount, how far does it move on the natural-log ruler?',answers:['Exactly 1','About 0.693','Exactly 2'],
  feedback:'Both 2 → 4 and 4 → 8 move about 0.693 log units. Treating a percentage as a log change works well only for small percentage changes.'
 },
 partials: {
  title:'Change one thing. Hold the other still.',
  idea:'A workshop uses equipment and workers. To isolate the effect of equipment, hold the workforce fixed. If both change, start by adding their separate small-change contributions.',
  picture:'Capital means equipment here; labor means workers. The slice freezes labor. The gold move on the map or surface shows what happens when both inputs change.',
  controls:{x:'Equipment available',y:'Workers available',alpha:'Equipment exponent (elasticity)',dx:'Change in equipment',dy:'Change in workers'},labels:['Output per extra equipment unit','Output per extra worker unit','Equipment elasticity'],
  examples:[{label:'Only equipment changes',params:{x:4,y:3,alpha:.4,dx:.4,dy:0}},{label:'Change both inputs',params:{x:4,y:3,alpha:.4,dx:.4,dy:.2}}],
  question:'Is the equipment exponent the output gained from one extra equipment unit?',answers:['Yes, always','No: percentage sensitivity differs from output per unit','Yes, if workers stay fixed'],
  feedback:'The exponent describes percentage sensitivity. Output per extra equipment unit also depends on current output and how much equipment you already have.'
 },
 gradient: {
  title:'Which way is uphill?',
  idea:'Stand on a landscape and turn without moving your feet. The slope ahead changes with the direction you face. The gradient points toward the steepest immediate climb when the ground is not flat.',
  picture:'Gold shows the direction you chose; mint shows the steepest uphill direction. The slice below the map is the path ahead. Switch to Surface to see the height.',
  controls:{shape:'Choose the terrain',x:'Position across the map',y:'Position up the map',angle:'Which way you face (degrees)'},labels:['Slope ahead','Steepest possible uphill slope','How the path bends'],
  examples:[{label:'Face downhill',params:{shape:'bowl',x:1,y:1,angle:225}},{label:'A deceptively flat saddle',params:{shape:'saddle',x:0,y:0,angle:0}},{label:'Turn across that saddle',params:{shape:'saddle',x:0,y:0,angle:90}}],
  question:'If the slope is zero in every direction at one spot, must it be the bottom?',answers:['Yes','No','Yes, on a smooth surface'],
  feedback:'A saddle is flat right at its center but curves up in one direction and down in another. Slope tells you about the immediate response; bending tells you more.'
 },
 taylor: {
  title:'Guess the path. Then let it bend.',
  idea:'A straight-line guess uses the slope where you start. A bend-aware guess also uses how that slope is changing. Neither knows the whole curve.',
  picture:'Purple is the true curve, mint is the straight guess, and gold adds bending. Move the endpoint farther away to see where the guesses miss.',
  controls:{fn:'Choose a curve',x:'Where you build the guess',h:'How far away to predict'},labels:['Actual endpoint value','Straight-guess error','Bend-aware error'],
  examples:[{label:'Predict nearby',params:{fn:'log',x:1,h:.1}},{label:'Predict farther away',params:{fn:'log',x:1,h:1}}],
  question:'What extra information lets a straight-line guess follow the bend?',answers:['The slope again','How the slope changes','The starting height squared'],
  feedback:'The second derivative measures how slope changes. It supplies the bending correction. Its value is local, so a longer extrapolation can still miss.'
 },
 optimize: {
  title:'Is a little more still worth it?',
  idea:'More activity brings benefits, but each extra bit helps less than the last. Each unit also has a cost. Stop where the next tiny increase pays for itself exactly.',
  picture:'Purple is total payoff. The gold line tells you whether a small increase helps or hurts. The mint point marks the best quantity in this example.',
  controls:{x:'How much you choose',c:'Cost per extra unit'},labels:['Net benefit of a tiny increase, per unit','Best quantity','Payoff still available'],
  examples:[{label:'Too little',params:{x:2,c:3}},{label:'Too much',params:{x:6,c:3}},{label:'Exactly balanced',params:{x:4,c:3}}],
  question:'If a tiny increase costs more than it adds in benefit, which move helps?',answers:['Choose a little more','Choose a little less','Neither'],
  feedback:'Reduce the quantity a little. Here the payoff curve bends downward everywhere, so the point where benefit and cost balance is the unique maximum.'
 },
 integral: {
  title:'Add up the rate as you go.',
  idea:'Think of a rate as how fast a total is filling up. Over a short interval, rate × interval gives a rectangle that estimates the extra amount.',
  picture:'The curve is the rate. Purple shading records accumulation from zero to your endpoint. Gold marks the extended endpoint; the new interval runs between the two dots.',
  controls:{x:'Where accumulation ends',h:'How much farther to go'},labels:['Signed total from zero','Actual extra amount','Rectangle estimate'],
  examples:[{label:'A short extra interval',params:{x:1.5,h:.1}},{label:'Accumulate in reverse',params:{x:-1.5,h:.4}}],
  question:'What controls how quickly the accumulated total grows as you extend its endpoint?',answers:['The rate at that endpoint','How quickly the rate changes','The total already accumulated'],
  feedback:'Extending the endpoint adds a thin strip. Its height is the current rate, so extra amount per unit extension approaches that rate.'
 }
};

export function intuitionStory(id,p,r) {
 let steps,note;
 if(id==='slope') {
  steps=[step('Take a step',`${number(p.x)} → ${number(p.x+p.h)}`,`Move ${number(p.h)} input units to the right.`),step('Measure the climb',signed(r.actual),'This is the actual output change over that whole step.'),step('Climb per step unit',number(r.secant),'Divide the output change by the input change: the average slope.')];
  note=r.slope===null?'At this corner the left and right slopes disagree. Shrinking the step cannot produce one slope that fits both sides.':`The slope right at your starting point is ${number(r.slope)}. Shrink the step to bring its average slope toward this local rate; a finite step need not match it.`;
 }
 if(id==='product') {
  steps=[step('Extend one edge',number(r.first),`The old long side (${number(p.x+1)}) × the added length (${number(p.h)}).`),step('Extend the other edge',number(r.second),`The old short side (${number(p.x)}) × that same added length.`),step('Fill in the corner',number(r.corner),`The added length × itself. All three pieces total ${number(r.actual)}.`)];
  note=`The strips predict ${number(r.linear)} new area. The corner adds ${number(r.corner)} more. Halving the extension halves each strip but quarters the corner; this is why the two-strip rule captures tiny changes.`;
 }
 if(id==='chain') {
  steps=[step('Nudge the input',`+${number(p.h)}`,`Start at ${number(p.x)}. The first machine is “square, then add one.”`),step('First local response',signed(r.innerSlope*p.h),`Scale the nudge by ${number(r.innerSlope)}. The actual intermediate change is ${signed(r.innerChange)}.`),step('Second local response',signed(r.linear),`Scale that prediction by ${number(r.outerSlope)}. The actual final change is ${signed(r.actual)}.`)];
  note=Math.abs(p.x)<1e-12?'The local response is zero here, but a finite nudge still changes the output. The first machine bends away from its flat starting point.':`${p.x<0?'The first machine reverses the local response: an infinitesimal increase in input lowers its output.':'The first machine passes a tiny positive nudge forward as a positive change.'} Multiply the local scale factors to get ${number(r.slope)} output units per input unit. Those starting rates are predictions for a finite move, not its exact result.`;
 }
 if(id==='logs') {
  steps=[step('Change the amount',`${number(p.x)} → ${number(r.end)}`,`A ${number(p.pct)}% change multiplies the amount by ${number(r.ratio)}.`),step('Read the log ruler',signed(r.actual),'The log distance depends on that multiplier, not the starting amount.'),step('Try the shortcut',signed(r.linear),`This small-percentage estimate differs from the true log change by ${number(Math.abs(r.actual-r.linear))}.`)];
  note=p.base===Math.E?`On the natural-log scale, divide the percentage by 100 for a small-change estimate. ${p.pct===100?'Doubling is a 100% increase but only about 0.693 log units.':'Large percentage changes expose the shortcut’s error.'}`:'Changing the base changes the ruler’s scale. Equal multipliers still travel equal distances, but the percentage shortcut must also be rescaled.';
 }
 if(id==='partials') {
  steps=[step('Equipment contribution',signed(r.kPart),`Change equipment by ${signed(p.dx)}; multiply by its local response ${number(r.fx)}.`),step('Worker contribution',signed(r.lPart),`Change workers by ${signed(p.dy)}; multiply by their local response ${number(r.fy)}.`),step('Put them together',signed(r.linear),`Add the two predictions. The actual joint output change is ${signed(r.actual)}.`)];
  note=`${p.dy===0?'Workers stay fixed, so you have isolated the equipment effect.':'Both inputs move, so both contributions count.'} The exponent ${number(p.alpha)} means a small 1% equipment increase gives approximately ${number(p.alpha)}% more output with workers fixed. It is not output per extra equipment unit.`;
 }
 if(id==='gradient') {
  steps=[step('Stand here',`${number(p.x)}, ${number(p.y)}`,`The landscape height is ${number(r.value)}.`),step('Face a direction',`${number(p.angle)}°`,'Turn the gold direction without changing your position.'),step('Read the slope ahead',signed(r.directional),'Height change per unit distance for an infinitesimal move in that direction.')];
  note=r.norm<1e-10?(p.shape==='saddle'?`Every immediate slope is zero here, but this is a saddle. This direction has curvature ${number(r.curvature)}; turn 90° to compare how it bends.`:'Every immediate slope is zero here. This particular bowl curves upward in every direction, making its center the minimum.'):`${Math.abs(r.directional)<1e-10?'You face a locally level direction.':r.directional>0?'You face uphill.':'You face downhill.'} The steepest uphill slope available is ${number(r.norm)}. These rates describe tiny moves; the terrain can bend farther ahead.`;
 }
 if(id==='taylor') {
  steps=[step('Use the starting slope',number(r.linear),`Starting value ${number(r.value)}, plus slope × your move: the straight guess.`),step('Account for bending',number(r.quadratic),`The bending correction changes that guess by ${signed(r.quadratic-r.linear)}.`),step('Check the actual curve',number(r.end),`Absolute misses: straight ${number(Math.abs(r.error1))}; bend-aware ${number(Math.abs(r.error2))}.`)];
  note='The extra bending information helps locally as the move becomes small. It does not promise that the bend-aware guess wins at every distance. Halve the distance and compare both errors.';
 }
 if(id==='optimize') {
  steps=[step('Benefit of a tiny increase',number(12/p.x),'Benefit per extra unit, evaluated at your current quantity.'),step('Cost of that increase',number(p.c),'Cost per extra unit, on the same scale.'),step('Keep the difference',signed(r.slope),'Local net benefit per unit: benefit minus cost.')];
  note=`${Math.abs(r.slope)<1e-10?'The two balance: you are at the best quantity.':r.slope>0?'A little more improves payoff here.':'A little less improves payoff here.'} The best quantity is ${number(r.optimum)} in this example. The action moves to the nearest slider step, which may not land exactly on that value.`;
 }
 if(id==='integral') {
  steps=[step('Read the current rate',number(r.slope),`The curve’s height at the current endpoint ${number(p.x)}.`),step('Build a thin rectangle',number(r.linear),`Rate × extra interval: ${number(r.slope)} × ${number(p.h)}.`),step('Count the actual addition',number(r.actual),'The rate varies over the new interval, so the curved strip can differ from the rectangle.')];
  note=p.x<0?'Here the endpoint is left of zero. The signed total is negative because accumulation runs in reverse, even though the rate is positive. This is an oriented integral, not negative water in a tank.':'A thinner strip makes the rectangle estimate more accurate. The derivative of the accumulated total is the rate at its endpoint: it tells you how fast the total changes.';
 }
 if(!steps)throw new RangeError('Unknown intuition lesson.');
 return {steps,note};
}
