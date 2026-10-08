const STOPS = [[76,29,149],[139,29,224],[213,28,144],[243,80,131],[255,209,226]];
export const SPEED_MAX = 0.8;

// A fixed 0–0.8 m/s scale keeps colors comparable across places and depths.
// Faster cells clip at the pale-rose endpoint, matching the labeled legend.
export function speedColor(speed) {
  const t=Math.max(0,Math.min(1,(Number.isFinite(speed)?speed:0)/SPEED_MAX))*4;
  const i=Math.min(3,Math.floor(t)),f=t-i;
  return STOPS[i].map((v,c)=>Math.round(v+(STOPS[i+1][c]-v)*f));
}

export function speedColorCss(speed) { return `rgb(${speedColor(speed).join(' ')})`; }
