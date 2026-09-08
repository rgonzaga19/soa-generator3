const { styleTreatmentRow } = require("./treatmentRowStyle");
const { drugs } = require("./soaCatalog.json");

function fillSheet1(workbook, data) {
    const sheet = workbook.getWorksheet(1);
    if (sheet.rowCount > 2) sheet.spliceRows(3, sheet.rowCount - 2);
    for (const [claimIndex, claim] of data.claims.entries()) {
        const selected = [claim.epoType === "alfa", claim.epoType === "beta", claim.hasIronSucrose, true, true];
        drugs.forEach((source, index) => {
            if (!selected[index]) return;
            const values = [...source];
            values[3] = 1;
            values[5] = values[4];
            values[7] = new Date(`${claim.renderDate}T00:00:00.000Z`);
            const row = sheet.addRow(values);
            styleTreatmentRow(row, claimIndex, 12);
            row.getCell(5).numFmt = row.getCell(6).numFmt = "0.00";
            row.getCell(8).numFmt = "m/d/yyyy";
        });
    }
}
module.exports = { fillSheet1 };
