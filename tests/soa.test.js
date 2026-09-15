const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const { fillSheet1 } = require('../services/sheet1Generator');
const { fillSheet2 } = require('../services/sheet2Generator');
const { validateSoa } = require('../services/validateSoa');
const fs = require('node:fs');
const vm = require('node:vm');
const claim = (extra = {}) => ({ renderDate: '2026-08-02', dialyzerType: 'new',
    epoType: "alfa", hasIronSucrose: false, hasLab: false, ...extra });
function generate(claims) {
    const workbook = new ExcelJS.Workbook();
    for (const name of ['Drugs and Medicine', 'Xray Lab Supplies and Others']) {
        const sheet = workbook.addWorksheet(name);
        sheet.addRow(['Title']); sheet.addRow(['Headers']);
    }
    fillSheet1(workbook, { claims }); fillSheet2(workbook, { claims });
    return workbook;
}
function total(sheet, col) {
    let result = 0;
    sheet.eachRow((row, n) => { if (n > 2) result += row.getCell(col).value; });
    return result;
}
test('all medicine, dialyzer and laboratory combinations use sample prices and fixed quantities', () => {
    for (const epoType of ["none", "alfa", "beta"]) for (let mask = 0; mask < 8; mask++) {
        const c = claim({ epoType, hasIronSucrose: !!(mask & 1), hasLab: !!(mask & 2), dialyzerType: mask & 4 ? 'reuse' : 'new', epoQty: 99 });
        const w = generate([c]); const drugs = w.getWorksheet(1); const supplies = w.getWorksheet(2);
        const ids = []; drugs.eachRow((row,n) => { if(n > 2) { ids.push(row.getCell(1).value); assert.equal(row.getCell(4).value,1); } });
        assert.deepEqual(ids, [(c.epoType === "alfa") && 'MED001', (c.epoType === "beta") && 'MED002', c.hasIronSucrose && 'MED003', 'MED004','MED005'].filter(Boolean));
        assert.equal(total(drugs,6),190 + ((c.epoType === "alfa") ? 1200 : 0) + ((c.epoType === "beta") ? 1750 : 0) + (c.hasIronSucrose ? 375 : 0));
        assert.equal(total(supplies,5), (c.dialyzerType === 'reuse' ? 7310 : 8457.5) + (c.hasLab ? 3437.5 : 0));
        const fistulaNeedle = supplies.getRows(3, supplies.rowCount - 2).find(row => row.getCell(2).value === 'Fistula Needle');
        assert.equal(fistulaNeedle.getCell(3).value, 2);
        assert.equal(fistulaNeedle.getCell(5).value, 60);
        assert.equal(supplies.rowCount, c.hasLab ? 20 : 10);
    }
});
test('three claims survive Excel serialization with correct dates and totals', async () => {
    const w = new ExcelJS.Workbook(); await w.xlsx.readFile('templates/master.xlsx');
    const claims = ['02','04','06'].map((day,i) => claim({ renderDate: `2026-08-${day}`, epoType: i === 1 ? "beta" : "alfa", hasIronSucrose: true, hasLab: i === 0, dialyzerType: i === 2 ? 'reuse' : 'new' }));
    fillSheet1(w,{claims}); fillSheet2(w,{claims});
    const read = new ExcelJS.Workbook(); await read.xlsx.load(await w.xlsx.writeBuffer());
    assert.equal(read.worksheets.length,4);
    assert.equal(read.getWorksheet(1).rowCount,14);
    assert.equal(read.getWorksheet(2).rowCount,36);
    assert.equal(read.getWorksheet(2).getCell('B30').value,'Highflux Dialyzer re-use');
    assert.equal(read.getWorksheet(2).getCell('D30').value,2352.5);
    assert.equal(read.getWorksheet(1).getCell('H11').value.toISOString(),'2026-08-06T00:00:00.000Z');
    assert.equal(total(read.getWorksheet(1),6)+total(read.getWorksheet(2),5),33507.5);
});
test('request validation rejects malformed dates and old claim shape', () => {
    assert.equal(validateSoa({claims:[claim()]}),null);
    for(const data of [{},{claims:[]},{claims:[claim({renderDate:'2026-02-30'})]},
        {claims:[claim({epoType:"both"})]}, {claims:[claim({hasEpoAlfa:true,hasEpoBeta:true})]},
        {claims:[claim({dialyzerType:'low'})]},{claims:[claim({hasIronSucrose:'false'})]},
        {claims:[{renderDate:'2026-08-02',hasEpo:true,epoType:'alfa'}]}]) assert.ok(validateSoa(data));
});
test('license validation caches successful checks for five minutes', async () => {
    const source=fs.readFileSync('public/js/app.js','utf8');
    let now = 1000;
    let calls = 0;
    const context=vm.createContext({
        Date: { now: () => now },
        window: { electronAPI: { saveLicenseKey: async () => {} } },
        fetch: async () => {
            calls++;
            return { ok: true, json: async () => ({ valid: true, owner: 'Clinic', plan: 'Pro' }) };
        },
        setTimeout, clearTimeout, AbortController, console
    });
    const licenseConstants = source.slice(source.indexOf('const LICENSE_VALIDATION_URL'),source.indexOf('// ── Release log'));
    const settingsListener = source.lastIndexOf('document', source.indexOf('getElementById("settingsBtn")'));
    const licenseHelpers = source.slice(source.indexOf('// ── License settings helpers'),settingsListener);
    vm.runInContext(licenseConstants + licenseHelpers,context);
    assert.equal((await vm.runInContext("validateLicenseKey('abc')",context)).valid,true);
    assert.equal((await vm.runInContext("validateLicenseKey(' abc ')",context)).valid,true);
    assert.equal(calls,1);
    now += (5 * 60 * 1000) + 1;
    assert.equal((await vm.runInContext("validateLicenseKey('abc')",context)).valid,true);
    assert.equal(calls,2);
});
test('frontend selection, reset, and batch parsing use the new claim shape', () => {
    const source=fs.readFileSync('public/js/app.js','utf8');
    const context=vm.createContext({document:{getElementById:()=>({value:0})},clearBatchSection:()=>{},
        claimsContainer:{innerHTML:''},summary:{innerHTML:''}});
    const slices = [source.slice(0,source.indexOf('//')), 'let activeDatePickerIndex = null; let pendingDatePickerToggleIndex = null;',
        source.slice(source.indexOf('function renderClaims()'),source.indexOf('function toggleLab(')),
        source.slice(source.indexOf('function clearForm()'),source.indexOf('const aboutBtn')),
        'const CLAIM_COLUMNS_PER_ROW=7;',source.slice(source.indexOf('function normalizeHeader('),source.indexOf('async function downloadBatchTemplate()'))];
    vm.runInContext(slices.join('\n'),context);
    vm.runInContext(`renderClaims(); updateClaimOption(0,'hasIronSucrose',true); updateClaimOption(0,'dialyzerType','reuse');`,context);
    assert.match(context.claimsContainer.innerHTML,/class="date-text-input" type="text"/);
    assert.match(context.claimsContainer.innerHTML,/onclick="openDatePicker\(0, event\)"/);
    assert.doesNotMatch(context.claimsContainer.innerHTML,/id="renderDate0"[^>]+type="date"/);
    assert.equal(vm.runInContext(`(() => {
        let calls = 0;
        const els = {
            renderDatePicker0: { showPicker() { calls++; } },
            renderDate0: { focus() { calls += 10; } }
        };
        document.getElementById = id => els[id] || { style: {} };
        openDatePicker(0);
        return calls;
    })()`,context),1);
    assert.equal(vm.runInContext(`(() => {
        let calls = 0;
        const els = {
            renderDatePicker0: { showPicker() { throw new Error('blocked'); } },
            renderDate0: { focus() { calls++; } }
        };
        document.getElementById = id => els[id] || { style: {} };
        openDatePicker(0);
        return calls;
    })()`,context),1);
    assert.equal(vm.runInContext(`(() => {
        const calls = { show: 0, blur: 0, prevented: 0, stopped: 0 };
        const els = {
            renderDatePicker0: {
                focus() {},
                showPicker() { calls.show++; },
                blur() { calls.blur++; }
            },
            renderDate0: { focus() {} }
        };
        const event = {
            preventDefault() { calls.prevented++; },
            stopPropagation() { calls.stopped++; }
        };
        document.getElementById = id => els[id] || { style: {} };
        datePickerToggleStarted(0);
        openDatePicker(0, event);
        datePickerToggleStarted(0);
        datePickerClosed(0);
        openDatePicker(0, event);
        return JSON.stringify(calls);
    })()`,context),JSON.stringify({ show: 1, blur: 1, prevented: 1, stopped: 1 }));
    assert.equal(vm.runInContext(`(() => {
        const els = {
            dateError0: { style: {} },
            renderDatePicker0: { value: '' },
            renderDate0: { value: '' }
        };
        document.getElementById = id => els[id] || null;
        syncPickedDate(0, '2026-08-02');
        document.getElementById = () => ({ value: 0, style: {} });
        return els.renderDate0.value + '|' + appState.claims[0].renderDate;
    })()`,context),'2026-08-02|2026-08-02');
    assert.match(context.summary.innerHTML,/Iron Sucrose/); assert.match(context.summary.innerHTML,/Re-use/);
    assert.doesNotMatch(context.claimsContainer.innerHTML,/EPO Quantity|Access Type/);
    vm.runInContext('clearForm()',context);
    assert.equal(vm.runInContext('appState.claims[0].hasIronSucrose',context),false);
    const entry=vm.runInContext(`rowToBatchEntry({'NAME OF PATIENT':'Sample','TREATMENT DATES':'Aug 2,4,6',
        'DATES OF ERYTHROPOIETIN GIVEN (WEEKLY)':'2,6','BETA RECORMON':'4','IRON SUCROSE':'2,4,6',
        'RE-USE DATES':'6','W/ LAB':'2'},8,2026)`,context);
    assert.equal(entry.state.claims.length,3); assert.equal(entry.state.claims[2].dialyzerType,'reuse');
    assert.equal(entry.state.claims[0].hasLab,true); assert.equal(entry.state.claims[1].hasLab,false);
    assert.equal(entry.state.claims[0].epoType,'alfa');
    assert.equal(entry.state.claims[1].epoType,'beta');
    assert.ok(entry.state.claims.every(c=>c.hasIronSucrose));
    assert.equal(vm.runInContext('appState.claims[0].epoType',context),'none');
    vm.runInContext("updateClaimOption(0,'epoType','beta'); renderClaims();",context);
    assert.match(context.summary.innerHTML,/EPOETIN BETA/);
    assert.doesNotMatch(context.summary.innerHTML,/EPOETIN ALFA/);
    const conflict=vm.runInContext(`rowToBatchEntry({'TREATMENT DATES':'Aug 2',
        'DATES OF ERYTHROPOIETIN GIVEN (WEEKLY)':'2','BETA RECORMON':'2'},8,2026)`,context);
    assert.equal(conflict.state.claims.length,0);
    assert.match(conflict.warnings.join(' '),/cannot be given on the same/);
});
