// Alternate treatment blocks consistently across both item sheets.
function styleTreatmentRow(row, claimIndex, columnCount) {
    if (claimIndex % 2 === 0) return;
    for (let column = 1; column <= columnCount; column++) {
        row.getCell(column).fill = {
            type: "pattern", pattern: "solid", fgColor: { argb: "FFEEECE1" }
        };
    }
}
module.exports = { styleTreatmentRow };
