import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test('hidden rates, calculator exports and independent proposal PDF',async({page})=>{
 await mkdir('tmp/export-qa',{recursive:true});
 await page.route('**/api/auth',r=>r.fulfill({json:{configured:false,user:null}}));
 await page.goto('/');await page.getByRole('button',{name:/Open local dashboard preview/}).click();
 await expect(page.getByRole('button',{name:'Rates',exact:true})).toHaveCount(0);
 await expect(page.getByText('Your rate books')).toHaveCount(0);
 await page.getByRole('button',{name:'Cost calculator',exact:true}).click();
 const quantity=page.locator('input[aria-label$=" quantity"]').first();await quantity.fill('2');
 const [xlsx]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download XLSX'}).click()]);expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);await xlsx.saveAs('tmp/export-qa/cost-table.xlsx');
 const [jpg]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download JPG',exact:true}).click()]);expect(jpg.suggestedFilename()).toMatch(/\.jpg$/);await jpg.saveAs('tmp/export-qa/cost-table.jpg');
 await page.getByRole('button',{name:'Customers',exact:true}).click();
 await page.getByRole('button',{name:'Make proposal',exact:true}).first().click();
 await expect(page.getByRole('dialog',{name:'Customer proposal editor'})).toBeVisible();expect(page.url()).toContain('#customers');
 await page.getByLabel('Proposal title *').fill('UPS inspection proposal');
 await page.getByLabel('Scope of work *').fill('Inspect the customer UPS installation and prepare a condition report. Coordinate access with the site contact before scheduling.');
 await page.getByLabel('Deliverables',{exact:true}).fill('Written condition report and recommendations for customer review.');
 await page.getByLabel('Commercial terms').fill('Pricing and scheduling to be agreed before work begins.');
 await page.screenshot({path:'tmp/export-qa/proposal-editor.png'});
 const [pdf]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save & export PDF'}).click()]);await pdf.saveAs('tmp/export-qa/proposal.pdf');
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('heading',{name:'UPS inspection proposal'})).toBeVisible();
 await page.getByRole('button',{name:'Open proposal'}).click();await expect(page.getByLabel('Scope of work *')).toContainText('Inspect');
});

test('performance reporting displays daily counts and timezone controls',async({page})=>{
 await page.route('**/api/auth',r=>r.fulfill({json:{configured:true,user:{email:'test@example.com'}}}));
 await page.route('**/api/mail?*',r=>r.fulfill({json:{configured:false,provider:'microsoft'}}));
 await page.route('**/api/crm?*',r=>r.fulfill({json:{records:[],books:[],history:[]}}));
 await page.route('**/api/tracking?*',r=>{const url=new URL(r.request().url());const action=url.searchParams.get('action');return r.fulfill({json:action==='report'?{mailbox:{address:'test@example.com',last_synced_at:new Date().toISOString()},report:{received:8,sent:5,conversations_received:6,conversations_replied:4,reply_rate:66.7,average_response_minutes:24,folders:[{folder:'inbox',backfill_complete:true,updated_at:new Date().toISOString()},{folder:'sentitems',backfill_complete:true,updated_at:new Date().toISOString()}],daily:[{day:'2026-09-24',received:8,sent:5,replied:4}]}}:{attention:2,drafts:1,waiting:4,due:0,recent:[]}});});
 await page.goto('/');await expect(page.getByText('66.7%')).toBeVisible();await page.getByLabel('Email reporting period').selectOption('1');await expect(page.getByRole('cell',{name:'2026-09-24'})).toBeVisible();await page.screenshot({path:'tmp/export-qa/email-performance.png'});
});
