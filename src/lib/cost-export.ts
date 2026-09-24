import type { QuoteDraft } from '../types/operations';
import { calculateCost, FORMULA_VERSION } from './costing.ts';

export const costHeaders=['Item','Supplier','Description','Unit','Supplier cost','Multiplier','Cost basis','My cost','Quantity','Total my cost','Exchange divisor','Cost CAD','Margin','Profit CAD','Selling CAD'];
export function costExportRows(draft:QuoteDraft) {
  const calc=calculateCost(draft);
  if(!calc.valid || (draft.currency==='USD'&&draft.usdRate<=0))throw new Error('Correct invalid calculation inputs before exporting.');
  return {calc,rows:calc.lines.map((l,i)=>[i+1,l.supplier,l.description,l.unit,l.supplierCost,l.multiplier,l.costMode,l.unitCost,l.quantity,l.extendedCost,l.exchangeRate,l.cadCost,l.margin,l.profit,l.sell])};
}
export async function buildCostWorkbook(draft:QuoteDraft) {
  const {default:ExcelJS}=await import('exceljs');
  const {calc,rows}=costExportRows(draft),book=new ExcelJS.Workbook();
  book.creator='Operations workspace';book.created=new Date();
  const sheet=book.addWorksheet('Complete cost table',{views:[{state:'frozen',ySplit:1}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  sheet.addRow(costHeaders);rows.forEach(row=>sheet.addRow(row));
  sheet.columns.forEach((column,i)=>{column.width=i===2?48:i===1?24:18;});
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF24443F'}};
  sheet.getRow(1).height=32;sheet.autoFilter={from:'A1',to:'O1'};
  sheet.eachRow((row,index)=>{row.alignment={vertical:'top',wrapText:true};if(index>1){row.height=Math.max(30,Math.ceil(String(row.getCell(3).value).length/45)*16);for(let i=5;i<=15;i++)if(i!==7)row.getCell(i).numFmt=i===13?'0.00%':'#,##0.00####';}});
  const flats=book.addWorksheet('Flat items');flats.addRow(['Item','Description','Fixed amount CAD','Addition CAD','Selling CAD']);
  draft.flatLines.forEach((f,i)=>flats.addRow([i+1,f.description,f.amount,f.addition,f.amount+f.addition]));
  flats.columns.forEach((c,i)=>{c.width=i===1?55:24;});flats.getRow(1).font={bold:true};
  const summary=book.addWorksheet('Summary');summary.columns=[{width:36},{width:85}];
  const outputFactor=draft.currency==='USD'?draft.usdRate:1;
  const values=[['Scope',draft.title],['Customer',draft.customerSnapshot?.name||'Quick calculation'],['Site',draft.site],['Rate book',draft.bookId],['Rate version',draft.bookVersion],['Formula version',FORMULA_VERSION],['Exported',new Date().toISOString()],['Values','Calculated snapshot; amounts are CAD unless labeled otherwise.'],['Line cost CAD',calc.totalCost-draft.shipping-draft.brokerage],['Shipping CAD',draft.shipping],['Brokerage CAD',draft.brokerage],['Total cost CAD',calc.totalCost],['Flat selling CAD',calc.flatSelling],['Selling price CAD',calc.sellingPrice],['Profit CAD',calc.profit],['Gross margin',calc.grossMargin===null?'N/A':calc.grossMargin],['Tax percent',draft.taxPercent],['Tax CAD',calc.tax],['Total including tax CAD',calc.cadTotal],['USD per CAD',draft.usdRate],['Selling USD',calc.usdSellingPrice],['Quote currency',draft.currency],['Quote total incl. tax',calc.cadTotal*outputFactor],['Validity (days)',draft.validityDays],['Notes',draft.notes]];
  values.forEach(v=>summary.addRow(v));summary.getColumn(1).font={bold:true};summary.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};if(typeof row.getCell(2).value==='number')row.getCell(2).numFmt=row.getCell(1).value==='Gross margin'?'0.00%':'#,##0.00####';row.height=Math.max(22,Math.ceil(String(row.getCell(2).value).length/80)*16);});
  return book;
}
export function downloadBlob(blob:Blob,name:string) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const exportName=(title:string)=> (title.replace(/[^a-z0-9_-]+/gi,'-').slice(0,70)||'cost-table');
export async function exportCostXlsx(draft:QuoteDraft) {
  const book=await buildCostWorkbook(draft),buffer=await book.xlsx.writeBuffer();
  downloadBlob(new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`${exportName(draft.title)}.xlsx`);
}

// Draw data, not a clipped screenshot of a horizontally scrolling table.
// Large tables are split into numbered JPG pages so no row is silently omitted.
export async function exportCostJpg(draft:QuoteDraft) {
  const {calc,rows}=costExportRows(draft);
  const cols=[60,160,310,90,125,115,115,125,105,135,130,135,105,135,140];
  const width=cols.reduce((a,b)=>a+b,0)+60,canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=1500;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable in this browser.');
  let y=0,page=0;const pages:Blob[]=[];
  const wrap=(text:string,max:number)=>{const lines:string[]=[];let line='';for(const char of text){if(char==='\n'||ctx.measureText(line+char).width>max){lines.push(line);line=char==='\n'?'':char;}else line+=char;}lines.push(line);return lines;};
  const start=()=>{page++;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,1500);ctx.fillStyle='#18342f';ctx.font='bold 26px Arial';ctx.fillText('INTERNAL COST WORKSHEET',30,45);ctx.font='16px Arial';ctx.fillText(`Page ${page} | CAD unless labeled otherwise | Rate version ${draft.bookVersion}`,30,75);y=100;};
  const flush=async()=>{await new Promise<void>((resolve,reject)=>canvas.toBlob(blob=>{if(!blob)return reject(new Error('Unable to export image.'));pages.push(blob);resolve();},'image/jpeg',0.94));};
  const paragraph=async(text:string,bold=false)=>{ctx.font=`${bold?'bold ':''}18px Arial`;for(const line of wrap(text,width-70)){if(y>1420){await flush();start();ctx.font=`${bold?'bold ':''}18px Arial`;}ctx.fillStyle='#18342f';ctx.fillText(line,30,y+22);y+=28;}y+=10;};
  start();await paragraph(`${draft.title}\nCustomer: ${draft.customerSnapshot?.name||'Quick calculation'}\nSite: ${draft.site}`);
  const drawRow=async(values:(string|number)[],header=false)=>{
    ctx.font=`${header?'bold ':''}15px Arial`;const lines=values.map((v,i)=>wrap(String(v),cols[i]-16));
    const height=Math.max(50,...lines.map(l=>l.length*20+16));
    if(height>1250)throw new Error('A description is too long for JPG export. Use XLSX for the complete text.');
    if(y+height>1400){await flush();start();if(!header)await drawRow(costHeaders,true);ctx.font=`${header?'bold ':''}15px Arial`;}
    let x=30;values.forEach((_,i)=>{ctx.fillStyle=header?'#24443f':'#f1f6f4';ctx.fillRect(x,y,cols[i]-1,height-1);ctx.fillStyle=header?'#ffffff':'#18342f';lines[i].forEach((line,j)=>ctx.fillText(line,x+8,y+23+j*20));x+=cols[i];});y+=height;
  };
  await drawRow(costHeaders,true);
  for(const row of rows)await drawRow(row.map((v,i)=>typeof v==='number'?(i===12?`${(v*100).toFixed(2)}%`:Number(v.toFixed(6)).toString()):v));
  await paragraph('Flat rate items',true);for(const f of draft.flatLines)await paragraph(`${f.description||'Flat item'} | Fixed CAD ${f.amount.toFixed(2)} + addition CAD ${f.addition.toFixed(2)} = CAD ${(f.amount+f.addition).toFixed(2)}`);
  await paragraph(`Shipping CAD ${draft.shipping.toFixed(2)} | Brokerage CAD ${draft.brokerage.toFixed(2)}\nTotal cost CAD ${calc.totalCost.toFixed(2)} | Selling CAD ${calc.sellingPrice.toFixed(2)} | Profit CAD ${calc.profit.toFixed(2)}\nGross margin ${calc.grossMargin===null?'N/A':(calc.grossMargin*100).toFixed(2)+'%'} | Tax ${draft.taxPercent}%: CAD ${calc.tax.toFixed(2)}\nTotal incl. tax CAD ${calc.cadTotal.toFixed(2)} | USD per CAD ${draft.usdRate}\nSelling USD ${calc.usdSellingPrice.toFixed(2)} | Quote total ${draft.currency} ${(calc.cadTotal*(draft.currency==='USD'?draft.usdRate:1)).toFixed(2)}\nValid for ${draft.validityDays} days | Formula ${FORMULA_VERSION}`,true);
  await paragraph(`Notes / assumptions\n${draft.notes||'None recorded.'}`);await flush();
  pages.forEach((blob,i)=>downloadBlob(blob,`${exportName(draft.title)}-${i+1}.jpg`));
  return pages.length;
}
