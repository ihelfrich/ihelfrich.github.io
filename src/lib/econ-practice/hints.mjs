import {fieldVariantHintFor} from './field-variant-hints.mjs';
import {fieldHints} from './field-hints.mjs';
import {undergraduateHints} from './undergraduate-hints.mjs';
// Authored method prompts. Never interpolate an answer or worked explanation.
export const HINT_VERSION='topic-scaffolds-v22';
const micro={
 '1.1':'Name the scarce resource. What alternative use must be given up when it is used here?',
 '1.2':'Separate the allocation rule from its consequences. Who decides what is produced and who receives it?',
 '1.3':'Follow the production frontier from one feasible bundle to another. Compare the output gained with the output forgone.',
 '1.4':'Write each producer’s opportunity cost in the same units. Comparative advantage depends on that cost, not total output.',
 '1.5':'Compare the benefits and opportunity costs of the decision still available. A cost that cannot be recovered is not changed by that decision.',
 '1.6':'Compare the extra benefit with the extra cost of one more unit. For purchases, check marginal benefit per dollar.',
 '2.1':'Does the event change the good’s own price or a determinant of demand? Distinguish movement along a curve from a shift.',
 '2.2':'Ask whether sellers’ willingness to supply changes at a given price, or whether the price itself changes.',
 '2.3':'Use percentage changes, not changes in units. If the question asks for midpoint elasticity, use the average of the two values in each denominator.',
 '2.4':'Measure the percentage change in quantity supplied relative to the percentage change in price. Keep the stated time horizon in mind.',
 '2.5':'Identify which variable changes: income or another good’s price. The sign of the elasticity carries economic meaning.',
 '2.6':'Find the price at which buyers and sellers agree on quantity. For surplus, identify willingness to pay, marginal cost, and the relevant area.',
 '2.7':'Shift only the curves affected by the event. If both shift, check which outcome is determined without knowing the relative shift sizes.',
 '2.8':'First locate the unregulated equilibrium. Then check whether the rule binds; a tax creates a wedge between the buyer and seller prices.',
 '2.9':'Compare the world price with the domestic no-trade price. At the world price, calculate domestic supply and demand separately.',
 '3.1':'Hold the fixed inputs constant. Marginal product is the change in output from an additional unit of the variable input.',
 '3.2':'Separate fixed and variable costs before calculating averages. Marginal cost concerns the change in total cost.',
 '3.3':'In the long run, every input can adjust. Distinguish a change in scale from adding a variable input to a fixed plant.',
 '3.4':'List explicit payments and the opportunity costs of owned resources. Accounting profit and economic profit subtract different costs.',
 '3.5':'Compare marginal revenue with marginal cost at feasible output levels. Total revenue maximization is a different objective.',
 '3.6':'Separate the short-run operating decision from long-run exit. Ask which costs can be avoided over the stated horizon.',
 '3.7':'A price-taking firm cannot choose the market price. Find its output decision, then check whether it covers the relevant costs.',
 '4.1':'Consider entry barriers, product differentiation, and how many sellers compete. A firm’s size alone does not identify the market structure.',
 '4.2':'Use marginal revenue to choose output, then use demand to find the price buyers will pay for that output.',
 '4.3':'Identify which customers can be separated and whether resale is possible. Distinguish willingness to pay from the cost of serving them.',
 '4.4':'Consider both the firm’s downward-sloping demand and the possibility of entry. Zero economic profit need not mean price equals marginal cost.',
 '4.5':'For each action of the other player, mark your player’s best response. A Nash equilibrium requires mutual best responses.',
 '5.1':'Demand for an input comes from what it helps produce. Identify the output gained and the revenue that output generates.',
 '5.2':'Trace the event to productivity, the output price, or input availability. Then decide which factor-market curve moves.',
 '5.3':'Compare the revenue from one additional input unit with its additional cost. Check whether the firm takes the input price as given.',
 '5.4':'If hiring another worker requires raising pay for existing workers, the extra hiring cost exceeds the wage of the new worker.',
 '6.1':'Compare marginal benefit and marginal cost for society. A transfer between buyers and sellers is not itself a loss of total surplus.',
 '6.2':'Identify the effect on people outside the transaction. Add that external effect to the relevant private marginal curve.',
 '6.3':'Ask two separate questions: does one person’s use reduce what others can use, and can people feasibly be excluded?',
 '6.4':'Identify which incentive the policy changes. A fixed payment and a per-unit charge affect marginal decisions differently.',
 '6.5':'Distinguish a group’s population share from its income share. Relative inequality does not by itself tell you anyone’s absolute income.'
};
const macro={
 '1.1':'Separate a move toward the existing production frontier from a shift of the frontier. What resources are currently unused?',
 '1.2':'Compare opportunity costs in the same units. For a proposed trade, check whether each side does better than producing the import itself.',
 '2.1':'Ask whether production occurred domestically in the current period. Then identify consumption, investment, government purchases, or net exports; avoid counting the same production twice.',
 '2.2':'Separate the price change from the quantity change. Check which basket or production measure the stated index actually covers.',
 '2.3':'First classify people as employed, unemployed and seeking work, or outside the labor force. Use the denominator required by the particular rate.',
 '2.4':'Distinguish the price level from its rate of change. For interest and debt, separate nominal payments from purchasing power and expected from unexpected inflation.',
 '2.5':'Compare actual output with potential output. A negative gap concerns the level of output relative to capacity, not necessarily a fall in output over time.',
 '3.1':'Trace how much of each additional dollar is spent again. Use only the leakages included in the stated model.',
 '3.2':'A tax change first changes disposable income; only the consumed part enters the next spending round. Distinguish a policy change from an automatic response to income.',
 '3.3':'Identify the curve that moves first. Then separate the immediate output and price effects from later wage and input-price adjustment.',
 '3.4':'Trace the change in government purchases or taxes to aggregate demand. Check the starting output gap and any assumptions about crowding out.',
 '4.1':'Ask whether the asset is used to make payments, quote prices, or carry purchasing power into the future. Wealth is broader than money.',
 '4.2':'Hold a bond’s promised payments fixed and change its purchase price. How does the return per dollar invested change?',
 '4.3':'Keep bank reserves, deposits, loans, and capital separate. A textbook deposit multiplier needs assumptions about lending and cash holdings.',
 '4.4':'Identify the monetary operating framework in the question. An administered rate and a change in money demand act through different mechanisms.',
 '4.5':'Locate government borrowing in the loanable-funds model. Hold the stated other factors fixed before tracing the effect on interest and private investment.',
 '5.1':'Distinguish a movement along a short-run Phillips curve from a shift caused by changing expectations. Then consider the long-run unemployment benchmark.',
 '5.2':'Relate money growth, velocity growth, real output growth, and inflation. Do not silently assume velocity is constant unless the question permits it.',
 '5.3':'A deficit is a flow over a period; debt is a stock at a date. Check whether the question asks for a change in debt or its ratio to GDP.',
 '5.4':'Separate more capital per worker from better technology. Consider diminishing returns when only capital per worker rises.',
 '5.5':'Keep nominal variables separate from real variables and identify the time horizon. Long-run neutrality does not rule out short-run effects.',
 '6.1':'Write the currency units beside the exchange rate before multiplying or dividing. For a real exchange rate, also track the relative price levels.',
 '6.2':'State which currency appreciates and translate that change into the price faced by foreign buyers. Keep the quotation convention straight.',
 '6.3':'Identify which cross-border transactions belong in the current account. When using saving minus investment, apply the accounting definitions given.',
 '6.4':'Compare expected returns after accounting for exchange-rate expectations and risk. A higher quoted interest rate alone need not guarantee a higher expected return.'
};
const microFamily={
 'positive-normative':'Ask whether each statement could be tested against evidence or instead expresses a judgment about what ought to happen.',
 'ppc-feasible':'At the stated X, calculate the largest feasible Y. Compare actual Y with that frontier value before classifying the bundle.',
 'ppf-bowed':'Consider whether resources are equally well suited to both activities. Which resources must be shifted as production becomes more specialized?',
 'ppf-unemployment':'The economy’s productive capacity has not changed. Locate the initial and new bundles relative to the same frontier.',
 'ppf-sector-tech':'Compare the two intercepts separately. A productivity improvement confined to one sector need not move both intercepts.',
 'revenue-elasticity':'Total revenue is price times quantity. Compare the percentage quantity response with the percentage price change.',
 'inelastic-revenue':'Compare the proportional loss of sales with the proportional increase in price. Revenue depends on both.',
 'elasticity-slope':'Point elasticity combines the curve’s slope with the price-to-quantity ratio. Which of those stays constant along a straight line?',
 'fixed-supply':'Draw a vertical supply curve. When demand shifts, check which coordinate of the intersection can move.',
 'surplus-transfer':'Write producer surplus as revenue minus variable cost and economic profit as revenue minus total cost. Compare what each subtracts.',
 'tariff-revenue':'Use imports after the tariff, not total domestic purchases. Each imported unit generates the stated tariff payment.',
 'tax-incidence':'Use the tax wedge and both inverse-curve slopes to relate the quantity reduction to the buyer and seller price changes.',
 'tax-dwl':'Identify the tax wedge and the reduction in mutually beneficial trade. With straight curves, the lost-surplus region is a triangle.',
 'subsidy-welfare':'For the extra units beyond the efficient quantity, compare marginal willingness to pay with marginal resource cost.'
};
const macroFamily={
 opportunity:'Divide the amount of food forgone by the number of additional machines. The requested units are food per machine, not machines per food unit.',
 'bond-price':'For a one-year zero-coupon bond, compare the maturity payment with the purchase price. Express the gain as a percentage of the amount paid today.',
 growth:'Labor productivity is output per hour worked. Calculate its percentage change, checking whether hours change as well as output.',
 appreciation:'Read the quotation as yen obtainable with one dollar. Compare that purchasing power before and after the change, then name which currency strengthens.',
 'macro-natural-rate':'Separate cyclical unemployment from frictional and structural unemployment. Potential output does not require every member of the labor force to have a job.',
 'bank-reserves':'Calculate required reserves from deposits and the required reserve ratio, then compare that requirement with the reserves actually held.',
 'macro-money-demand':'At each interest rate, consider how higher nominal income changes desired transaction balances. Then find the adjustment needed with money supply fixed.',
 'macro-stabilizers':'Trace how the existing tax rule changes disposable income as earnings fall. Compare the income decline with what would happen if tax payments did not respond.'
};
export function hintFor(item){
 const extension=fieldVariantHintFor(item);
 if(extension)return {hint:extension,hintVersion:HINT_VERSION,hintScope:`${item.course}:family:${item.family}:variant:${item.variant}`};
 if(item.course==='ap-micro'&&microFamily[item.family])return {hint:microFamily[item.family],hintVersion:HINT_VERSION,hintScope:`ap-micro:family:${item.family}`};
 if(item.course==='ap-macro'&&macroFamily[item.family])return {hint:macroFamily[item.family],hintVersion:HINT_VERSION,hintScope:`ap-macro:family:${item.family}`};
 const specific=undergraduateHints[item.course]?.[item.family]??fieldHints[item.course]?.[item.family];
 if(specific)return {hint:specific,hintVersion:HINT_VERSION,hintScope:`${item.course}:family:${item.family}`};
 if(item.course==='ap-macro'&&macro[item.topic])return {hint:macro[item.topic],hintVersion:HINT_VERSION,hintScope:`ap-macro:${item.topic}`};
 if(item.course==='ap-micro'&&micro[item.topic])return {hint:micro[item.topic],hintVersion:HINT_VERSION,hintScope:`ap-micro:${item.topic}`};
 return {hint:'Identify the economic relationship the question asks you to use. Write down what is given, what must be found, and which quantities are held fixed. Check that the units of your result match the requested quantity.',hintVersion:HINT_VERSION,hintScope:'general'};
}
