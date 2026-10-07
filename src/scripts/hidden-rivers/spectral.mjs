export function spectralSample(values,pca){
  if(!values||values.length!==4||!values.every(Number.isFinite))return null;
  const meanVisible=(values[0]+values[1]+values[2])/3;
  const ratio=(a,b)=>a+b>1e-7?(a-b)/(a+b):null;
  const pc=pca?pca.eigenvectors[0].map((_,j)=>values.reduce((s,v,i)=>s+(v-pca.mean[i])*pca.eigenvectors[i][j],0)):[];
  return {values,meanVisible,blueGreen:ratio(values[0],values[1]),ndwi:ratio(values[1],values[3]),pc,normalized:pc.map((v,i)=>(v-pca.stretchLow[i])/(pca.stretchHigh[i]-pca.stretchLow[i]))};
}
