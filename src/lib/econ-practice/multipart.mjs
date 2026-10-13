import {family} from './bank.mjs';
const part=(id,prompt,answer,explanation)=>({id,prompt,answer,tolerance:.005,points:1,explanation});
family('market-tax-sequence','2.8','Equilibrium and a tax',3,n=>{
 const a=80+4*n,t=8+2*n,q=(a-20)/2,qt=(a-20-t)/2;
 return {format:'multipart',prompt:`A competitive market has inverse demand P = ${a} − Q and inverse supply P = 20 + Q. A per-unit seller tax of $${t} is then imposed. There are no externalities. Calculate each requested quantity.`,parts:[part('before','Quantity traded before the tax',q,'Set demand equal to supply without the tax.'),part('after','Quantity traded after the tax',qt,'Set the buyer price equal to supply plus the tax.'),part('revenue','Government tax revenue',t*qt,'Multiply the tax by the post-tax quantity, not the original quantity.')],explanation:'The tax creates a wedge between buyer and seller prices and reduces mutually beneficial trade. Each part is scored separately.'};
},'ap-micro',12);
family('monopoly-sequence','4.2','Monopoly output, price, and welfare',3,n=>{
 const a=100+4*n,q=(a-20)/4,p=a-2*q,qc=(a-20)/2;
 return {format:'multipart',prompt:`A single-price monopolist faces P = ${a} − 2Q, MR = ${a} − 4Q, and constant MC = 20. It remains open and has no capacity constraint. There are no externalities.`,parts:[part('quantity','Profit-maximizing quantity',q,'Set MR equal to MC.'),part('price','Price charged',p,'Substitute the monopoly quantity into demand, not marginal revenue.'),part('loss','Deadweight loss',.5*(qc-q)*(p-20),'Compare monopoly output with the efficient quantity and calculate the lost-surplus triangle.')],explanation:'Quantity follows the marginal revenue condition, price comes from demand, and welfare loss concerns forgone gains from trade. These are numeric rubric parts, not a complete AP free-response rubric.'};
},'ap-micro',12);
