const express = require("express");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const { fillSheet1 } = require("../services/sheet1Generator");
const { fillSheet2 } = require("../services/sheet2Generator");

/**
 * Resolve the template location.
 *
 * Development:
 *   <project>/templates/master.xlsx
 *
 * Electron (packaged):
 *   <resources>/templates/master.xlsx
 */
const TEMPLATE_PATH = process.env.APP_RESOURCES
    ? path.join(process.env.APP_RESOURCES, "templates", "master.xlsx")
    : path.join(__dirname, "..", "templates", "master.xlsx");

// Cache the template in memory so it is only read once.
let templateBuffer = null;

async function getTemplateBuffer() {

    if (!templateBuffer) {

        console.log("[SOA] Loading template from:");
        console.log(TEMPLATE_PATH);

        templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);

    }

    return templateBuffer;
}

// Preload the template on startup.
getTemplateBuffer().catch((err) => {
    console.error("Failed to preload master.xlsx:", err);
});

router.post("/", async (req, res) => {

    try {

        const buffer = await getTemplateBuffer();

        const workbook = new ExcelJS.Workbook();

        await workbook.xlsx.load(buffer);

        // Prevent unnecessary recalculation.
        workbook.calcProperties.fullCalcOnLoad = false;

        fillSheet1(workbook, req.body);
        fillSheet2(workbook, req.body);

        if (process.env.DEBUG) {
            console.log(JSON.stringify(req.body, null, 2));
        }

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=generated.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});

module.exports = router;