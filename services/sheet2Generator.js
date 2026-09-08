const { getRoomBoardPrices } = require("./roomBoardPricing");

// Laboratory rows never change — build once at module load, not per claim.
const LABORATORY_ROWS = [
    {
        type: "LABORATORY",
        description: "Chemistry - Sodium",
        qty: 1,
        price: 175.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: SODIUM"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - Potassium",
        qty: 1,
        price: 175.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: POTASSIUM"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - Serum Calcium",
        qty: 1,
        price: 175.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: SERUM CALCIUM"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - BUN",
        qty: 1,
        price: 250.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: BUN"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - URIC ACID",
        qty: 1,
        price: 250.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: URIC ACID"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - Creatinine",
        qty: 1,
        price: 200.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: CREATININE"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - UREAN NITROGEN",
        qty: 1,
        price: 175.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: URINE-UREAN NITROGEN"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - Serum Albumin",
        qty: 1,
        price: 175.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: SERUM ALBUMIN"
    },
    {
        type: "LABORATORY",
        description: "Chemistry - Phosphorous",
        qty: 1,
        price: 175.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "CHEMISTRY: PHOSPHOROUS"
    },
    {
        type: "LABORATORY",
        description: "Hematology - CBC",
        qty: 1,
        price: 250.00,
        esoaGroup: "LaboratoryAndDiagnostic",
        unit: "",
        mapping: "HEMATOLOGY: CBC"
    }
];

// Builds the 4 supply rows that only depend on accessType/fluxType, which
// are constant for the whole request — so this only needs to run once,
// not once per claim.
function buildSuppliesRows(isSubkit, isLowFlux) {
    return [
        {
            type: "Supplies",
            description: "DIALYZER",
            qty: 1,
            price: 500,
            esoaGroup: "MedicalSupplies",
            unit: "PIECE",
            mapping: isLowFlux
                    ? "LOW FLUX DIALYZER OR ITS EQUIVALENT"
                    : "DIALYZER, CELLULOSE HIGH EFFICIENCY AM-SD-750U"
        },
        {
            type: "Supplies",
            description: "BLOODLINES",
            qty: 1,
            price: 312.50,
            esoaGroup: "MedicalSupplies",
            unit: "PIECE",
            mapping: "BLOODLINES"
        },
        {
            type: isSubkit ? "Supplies" : "Others",
            description: isSubkit
                ? "Sterile Dressing Kit"
                : "Fistula Needles with Safety",
            qty: 1,
            price: 312.50,
            esoaGroup: isSubkit
                ? "MedicalSupplies"
                : "Others",
            unit: isSubkit
                ? "KIT"
                : "",
            mapping: isSubkit
                ? "DRESSING KIT"
                : "Others"
        },
        {
            type: "Supplies",
            description: isSubkit
                ? "SUBCLAVIAN KIT"
                : "FISTULA KIT",
            qty: 1,
            price: 312.50,
            esoaGroup: "MedicalSupplies",
            unit: "KIT",
            mapping: isSubkit
                ? "IJ CATHETER FR. 12"
                : "FISTULA KIT"
        }
    ];
}

// Builds the 4 room & board rows, which depend on per-claim roomBoard pricing.
function buildRoomBoardRows(roomBoard) {
    return [
        {
            type: "Others",
            description: "Room and Board - Use of Machines",
            qty: 1,
            price: roomBoard.roomUseMachine,
            esoaGroup: "RoomAndBoard",
            unit: "",
            mapping: "ROOM AND BOARD"
        },
        {
            type: "Others",
            description: "Room and Board - Personnel Costs",
            qty: 1,
            price: roomBoard.personnelCost,
            esoaGroup: "RoomAndBoard",
            unit: "",
            mapping: "ROOM AND BOARD"
        },
        {
            type: "Others",
            description: "Room and Board - Rentals and Utilities",
            qty: 1,
            price: roomBoard.rentalUtilities,
            esoaGroup: "RoomAndBoard",
            unit: "",
            mapping: "ROOM AND BOARD"
        },
        {
            type: "Others",
            description: "Room and Board - Other Administrative Costs",
            qty: 1,
            price: roomBoard.adminCost,
            esoaGroup: "RoomAndBoard",
            unit: "",
            mapping: "ROOM AND BOARD"
        }
    ];
}

function fillSheet2(workbook, data) {

    const sheet = workbook.getWorksheet(2);

    // Delete the original template data block
    sheet.spliceRows(3, 8);

    const isSubkit = data.accessType === "subkit";
    const isLowFlux = data.fluxType === "low";

    // These 4 rows don't depend on the claim, so build them once for
    // the whole request instead of rebuilding them on every iteration.
    const suppliesRows = buildSuppliesRows(isSubkit, isLowFlux);

    let currentRow = 3;

    for (const claim of data.claims) {

        const roomBoard = getRoomBoardPrices(claim);
        const roomBoardRows = buildRoomBoardRows(roomBoard);

        const sheet2Rows = [...suppliesRows, ...roomBoardRows];

        if (claim.hasLab) {
            sheet2Rows.push(...LABORATORY_ROWS);
        }

        // create blank rows in a single batched shift instead of one insertRow per row
        const blankRows = new Array(sheet2Rows.length).fill([]);
        sheet.insertRows(currentRow, blankRows);

        // parse the render date once per claim instead of once per row
        const renderDate = new Date(claim.renderDate);

        for (let i = 0; i < sheet2Rows.length; i++) {

            const row = sheet2Rows[i];
            const excelRow = sheet.getRow(currentRow + i);

            excelRow.getCell(1).value = row.type;        // A
            excelRow.getCell(2).value = row.description; // B

            excelRow.getCell(3).value = row.qty;          // C

            const priceCell = excelRow.getCell(4);        // D
            priceCell.value = row.price;
            priceCell.numFmt = "0.00";

            const totalCell = excelRow.getCell(5);         // E
            totalCell.value = row.qty * row.price;
            totalCell.numFmt = "0.00";

            const dateCell = excelRow.getCell(6);          // F
            dateCell.value = renderDate;
            dateCell.numFmt = "m/d/yyyy";

            excelRow.getCell(7).value = row.esoaGroup;     // G
            excelRow.getCell(8).value = row.unit;          // H
            excelRow.getCell(9).value = row.mapping;       // I
        }

        currentRow += sheet2Rows.length;

    }

}

module.exports = {
    fillSheet2
};