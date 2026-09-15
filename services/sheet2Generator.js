const { styleTreatmentRow } = require("./treatmentRowStyle");
const { supplies, laboratory, reuse } = require("./soaCatalog.json");

function fillSheet2(workbook, data) {
    const sheet = workbook.getWorksheet(2);
    if (sheet.rowCount > 2) sheet.spliceRows(3, sheet.rowCount - 2);
    for (const [claimIndex, claim] of data.claims.entries()) {
        const items = supplies.map((row, index) => index === 1 && claim.dialyzerType === "reuse" ? reuse : row);
        if (claim.hasLab) items.push(...laboratory);
        for (const source of items) {
            const values = [...source];
            values[2] = values[2] || 1;
            values[4] = values[2] * values[3];
            values[5] = new Date(`${claim.renderDate}T00:00:00.000Z`);
            const row = sheet.addRow(values);
            styleTreatmentRow(row, claimIndex, 9);
            row.getCell(4).numFmt = row.getCell(5).numFmt = "0.00";
            row.getCell(6).numFmt = "m/d/yyyy";
        }
    }
}
module.exports = { fillSheet2 };
