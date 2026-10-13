// Authored method prompts. Never interpolate an answer or worked explanation.
export const HINT_VERSION='topic-scaffolds-v1';
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
export function hintFor(item){
 if(item.course==='ap-micro'&&micro[item.topic])return {hint:micro[item.topic],hintVersion:HINT_VERSION,hintScope:`ap-micro:${item.topic}`};
 return {hint:'Identify the economic relationship the question asks you to use. Write down what is given, what must be found, and which quantities are held fixed. Check that the units of your result match the requested quantity.',hintVersion:HINT_VERSION,hintScope:'general'};
}
