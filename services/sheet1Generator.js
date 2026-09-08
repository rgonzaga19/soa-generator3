// Static drug rows that never change across claims — built once, not per claim.
const STATIC_DRUG_ROWS = [
    {
        itemId: "MED01",
        brand: "APRINOL",
        generic: "REGULAR HEPARIN",
        qty: 1,
        price: 250,
        preparation: "VIAL",
        frequency: "DURING HD TREATMENT",
        route: "IV",
        philhealthMapping: "HEPARIN (as SODIUM) 5000 IU/mL SOLUTION 5 mL VIAL",
        philhealthUnit: "VIAL"
    },
    {
        itemId: "MED02",
        brand: "SALINE PHILRX",
        generic: "PNSS(PLAIN NORMAL SALINE SOLUTION)",
        qty: 1,
        price: 100,
        preparation: "BOTTLE",
        frequency: "DURING HD TREATMENT",
        route: "IV",
        philhealthMapping: "0.9% SODIUM CHLORIDE SOLUTION 1 L BOTTLE",
        philhealthUnit: "BOTTLE"
    },
    {
        itemId: "MED03",
        brand: "CITRAPURE",
        generic: "HEMODIALYSIS ACID CONCENTRATE (DIALYSATE ACETATE BASED)",
        qty: 1,
        price: 375,
        preparation: "GALLON",
        frequency: "DURING HD TREATMENT",
        route: "DIALYSATE",
        philhealthMapping:
            "HEMODIALYSIS ACID CONCENTRATE (DIALYSATE ACETATE BASED) 5 L",
        philhealthUnit: "GALLON"
    },
    {
        itemId: "MED04",
        brand: "RENAL PURE",
        generic: "HEMODIALYSIS BICARBONATE CONCENTRATE",
        qty: 1,
        price: 175,
        preparation: "GALLON",
        frequency: "DURING HD TREATMENT",
        route: "DIALYSATE",
        philhealthMapping:
            "HEMODIALYSIS BICARBONATE CONCENTRATE 5 L",
        philhealthUnit: "GALLON"
    }
];

function buildEpoRow(claim) {

    const isBeta = claim.epoType === "beta";

    // Beta has no double-dose tier — clamp to 1 regardless of what was
    // submitted, so a bypassed/stale frontend can't produce a beta row
    // with qty 2.
    let epoQty = claim.epoQty ?? 1;
    if (isBeta && epoQty > 1) {
        epoQty = 1;
    }

    return {
        itemId: "MED05",

        brand:
            claim.epoType === "beta"
                ? "RECORMON"
                : "EPOETINE",

        generic:
            claim.epoType === "beta"
                ? "EPOETIN BETA"
                : "EPOETIN ALFA",

        qty: epoQty,

        price:
            claim.epoType === "beta"
                ? 1500
                : 875,

        preparation: "PREFILLED SYRINGE",

        frequency: "POST HD TREATMENT",

        route: "IV/SUBCUTANEOUS",

        philhealthMapping:
            claim.epoType === "beta"
                ? "EPOETIN BETA (RECOMBINANT ERYTHROPOIETIN) 5000IU/0.3ml SOLUTION PRE-FILLED SYRINGE WITH NEEDLE"
                : "EPOETIN ALFA (RECOMBINANT HUMAN ERYTHROPOIETIN) 4000 IU/mL SOLUTION 1 mL PRE-FILLED GLASS SYRINGE",

        philhealthUnit: "VIAL"
    };
}

function fillSheet1(workbook, data) {

    const sheet = workbook.getWorksheet(1);

    // Remove the original template rows
    sheet.spliceRows(3, 5);

    let currentRow = 3;

    for (const claim of data.claims) {

        const rows = claim.hasEpo
            ? [...STATIC_DRUG_ROWS, buildEpoRow(claim)]
            : STATIC_DRUG_ROWS;

        const rowsForClaim = claim.hasEpo ? 5 : 4;

        // create blank rows in a single batched shift instead of one insertRow per row
        const blankRows = new Array(rowsForClaim).fill([]);
        sheet.insertRows(currentRow, blankRows);

        // parse the render date once per claim instead of once per row
        const renderDate = new Date(claim.renderDate);

        // write render date to every row of this claim
        for (let i = 0; i < rowsForClaim; i++) {
            const cell = sheet.getRow(currentRow + i).getCell(8); // H

            cell.value = renderDate;

            cell.numFmt = "m/d/yyyy";
        }

        // Populate drug information
        for (let i = 0; i < rows.length; i++) {

            const row = rows[i];
            const excelRow = sheet.getRow(currentRow + i);

            excelRow.getCell(1).value = row.itemId;   // A
            excelRow.getCell(2).value = row.brand;    // B
            excelRow.getCell(3).value = row.generic;  // C

            excelRow.getCell(4).value = row.qty;       // D

            const priceCell = excelRow.getCell(5);     // E
            priceCell.value = row.price;
            priceCell.numFmt = "0.00";

            const totalCell = excelRow.getCell(6);      // F
            totalCell.value = row.qty * row.price;
            totalCell.numFmt = "0.00";

            excelRow.getCell(7).value = row.preparation; // G

            excelRow.getCell(9).value = row.frequency;   // I

            excelRow.getCell(10).value = row.route;      // J

            excelRow.getCell(11).value = row.philhealthMapping; // K

            excelRow.getCell(12).value = row.philhealthUnit;    // L
        }

        currentRow += rowsForClaim;
    }

}

module.exports = {
    fillSheet1
};