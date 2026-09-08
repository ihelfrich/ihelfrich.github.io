export const portrait=Object.freeze({src:'/people/ian-zoom-portrait.png',width:1024,height:1024,alt:'Ian Helfrich outdoors in a navy suit and patterned tie'});
export const email='ianthelfrich@gmail.com';
export const home='https://ihelfrich.github.io';
export const intents=Object.freeze({learn:'Learning and quantitative coaching',collaborate:'Research collaboration or advisory work',hire:'Academic or industry opportunity'});
export function inquiryHref(intent,name,question){
 const subject=intents[intent]||intents.learn;
 const body=`Hi Ian,\n\n${String(question).trim()}\n\n${String(name).trim()}`;
 return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
// Illustrative geometry, not research data or a physical model.
export function fieldPoint(u,v,t){
 const ridge=Math.exp(-Math.pow((u-.6)*3.5,2));
 return [u,v+Math.sin(u*5.8+v*2.1+t*.22)*ridge*.22+Math.sin(u*13-v*4-t*.13)*ridge*.025];
}
export const nmtc=Object.freeze({pooled:-.262,within:-.047,lower:-.245,upper:.152,min:-.35,max:.25});
export function coefficientX(value){return 55+(value-nmtc.min)/(nmtc.max-nmtc.min)*430;}
