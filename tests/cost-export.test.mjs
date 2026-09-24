import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {buildCostWorkbook} from '../src/lib/cost-export.ts';
test('XLSX exports all rows, literal text, precision, flat items and matching totals',async()=>{
 const draft={title:'Test worksheet',site:'Test site',bookId:'standard',bookVersion:1,currency:'CAD',validityDays:30,notes:'Keep all notes',lines:[{id:'1',rateItemId:'1',description:'=SUM(A1:A2)',supplier:'Test',unit:'hour',supplierCost:100,multiplier:1,manualCost:100,costMode:'manual',quantity:1.5,exchangeRate:1,margin:.25},{id:'2',rateItemId:'2',description:'Unused row retained',supplier:'',unit:'each',supplierCost:0,multiplier:1,manualCost:0,costMode:'manual',quantity:0,exchangeRate:1,margin:0}],flatLines:[{id:'f',description:'Flat',amount:50,addition:10}],shipping:5,brokerage:2,usdRate:.75,taxPercent:13};
 const book=await buildCostWorkbook(draft);const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await book.xlsx.writeBuffer());
 const table=reopened.getWorksheet('Complete cost table');assert.equal(table.rowCount,3);assert.equal(table.getCell('C2').value,'=SUM(A1:A2)');assert.equal(table.getCell('O2').value,200);assert.equal(table.getCell('M2').value,.25);
 const totals=Object.fromEntries(reopened.getWorksheet('Summary').getSheetValues().filter(Boolean).map(row=>[row[1],row[2]]));assert.equal(totals['Total cost CAD'],157);assert.equal(totals['Selling price CAD'],260);assert.equal(totals['Total including tax CAD'],293.8);assert.equal(totals['Notes'],'Keep all notes');assert.equal(reopened.getWorksheet('Flat items').getCell('E2').value,60);
});
