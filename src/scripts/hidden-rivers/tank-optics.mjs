// Artistic optical coefficient. Path lengths are physical metres, not pixels.
export const dyeExtinctionPerMetre=420;
/** Independent quadrature reference for the shader's Beer–Lambert integration. */
export function integrateDyeTransmittance(concentrations,stepMetres){
 if(!Number.isFinite(stepMetres)||stepMetres<0)throw new RangeError('Path step must be finite, in metres and nonnegative');
 let depth=0;for(const c of concentrations){if(!Number.isFinite(c)||c<0)throw new RangeError('Concentration must be finite and nonnegative');depth+=c*stepMetres;}
 return Math.exp(-dyeExtinctionPerMetre*depth);
}
