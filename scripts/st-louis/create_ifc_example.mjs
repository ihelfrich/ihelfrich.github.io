// Original, invented geometry. No site, owner, georeference or real building plans.
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../../public/st-louis/models/',import.meta.url);await mkdir(output,{recursive:true});
let next=1;const lines=[];const add=s=>{const id=next++;lines.push(`#${id}=${s};`);return '#'+id;};
let guids=0;const guid=()=>String(++guids).padStart(22,'0');
const origin=add('IFCCARTESIANPOINT((0.,0.,0.))'),z=add('IFCDIRECTION((0.,0.,1.))'),x=add('IFCDIRECTION((1.,0.,0.))'),axis=add(`IFCAXIS2PLACEMENT3D(${origin},${z},${x})`),placement=add(`IFCLOCALPLACEMENT($,${axis})`);
const origin2D=add('IFCCARTESIANPOINT((0.,0.))'),axis2D=add(`IFCAXIS2PLACEMENT2D(${origin2D},$)`);
const context=add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,${axis},$)`),units=add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)"),unitset=add(`IFCUNITASSIGNMENT((${units}))`),project=add(`IFCPROJECT('${guid()}',$,'Invented example pavilion','Example model — not a St. Louis building',$,$,$,(${context}),${unitset})`);
const building=add(`IFCBUILDING('${guid()}',$,'Example pavilion',$,$,${placement},$,$,.ELEMENT.,$,$,$)`),floor=add(`IFCBUILDINGSTOREY('${guid()}',$,'Example level',$,$,${placement},$,$,.ELEMENT.,0.)`);
add(`IFCRELAGGREGATES('${guid()}',$,$,$,${project},(${building}))`);add(`IFCRELAGGREGATES('${guid()}',$,$,$,${building},(${floor}))`);
function box(type,name,px,py,pz,w,d,h,predefined){
 const point=add(`IFCCARTESIANPOINT((${px}.,${py}.,${pz}.))`.replace(/(\d+\.\d+)\./g,'$1'));
 const at=add(`IFCAXIS2PLACEMENT3D(${point},${z},${x})`),place=add(`IFCLOCALPLACEMENT(${placement},${at})`),profile=add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${axis2D},${w},${d})`),solid=add(`IFCEXTRUDEDAREASOLID(${profile},${axis},${z},${h})`),representation=add(`IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${solid}))`),shape=add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${representation}))`);
 return add(`${type}('${guid()}',$,'${name}',$,$,${place},${shape},$,.${predefined}.)`);
}
const elements=[box('IFCSLAB','Ground slab',0,0,-.25,12,8,.25,'FLOOR'),box('IFCWALL','Rear wall',0,3.8,0,12,.25,3.2,'STANDARD'),box('IFCWALL','West wall',-5.8,0,0,.25,7.6,3.2,'STANDARD'),box('IFCWALL','Interior screen',1,1,0,.2,4.5,2.6,'PARTITIONING'),box('IFCSLAB','Roof plate',0,0,3.4,12.8,8.8,.22,'ROOF')];
for(const px of [-5.3,-1.8,1.8,5.3])elements.push(box('IFCCOLUMN',`Front column ${px}`,px,-3.3,0,.28,.28,3.4,'COLUMN'));
add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',$,$,$,(${elements.join(',')}),${floor})`);
const evidence=add("IFCPROPERTYSINGLEVALUE('Evidence',$,IFCTEXT('Invented example — not a St. Louis building. No survey or construction use.'),$)"),note=add("IFCPROPERTYSINGLEVALUE('DesignNote',$,IFCTEXT('A small open pavilion made for trying element selection and category visibility.'),$)"),props=add(`IFCPROPERTYSET('${guid()}',$,'Example provenance',$,(${evidence},${note}))`);
add(`IFCRELDEFINESBYPROPERTIES('${guid()}',$,$,$,(${elements.join(',')}),${props})`);
const text=`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]','Invented example, not a real building'),'2;1');\nFILE_NAME('example-pavilion.ifc','2026-09-13T00:00:00',('Property Lab'),('Example only'),'Property Lab example generator','Property Lab','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
await writeFile(new URL('example-pavilion.ifc',output),text);console.info(`Invented IFC example: ${elements.length} elements, ${Buffer.byteLength(text)} bytes.`);
