---

# Building the Desktop Application (Electron)

This project has been migrated from a browser-based Node.js application to an Electron desktop application. Electron packages the application together with Chromium and Node.js, allowing it to run as a native Windows desktop application without requiring a separate web server.

## Requirements

- Node.js 18 or later
- npm
- Git

Verify your installation:

```bash
node -v
npm -v
git --version
```

---

## Install Dependencies

Clone the repository and install all required packages.

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/soa-generator.git

cd soa-generator

npm install
```

---

## Project Structure

```
soa-generator/
│
├── electron/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Secure API bridge
│   └── ipcHandlers.js       # IPC communication
│
├── public/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── services/
│   ├── sheet1Generator.js
│   ├── sheet2Generator.js
│   └── roomBoardPricing.js
│
├── templates/
│   └── master.xlsx
│
├── package.json
└── README.md
```

---

## Running in Development Mode

Launch Electron:

```bash
npm start
```

Electron will:

- Create the desktop window
- Load the application UI
- Enable communication between the renderer and Node.js using IPC
- Generate Excel workbooks locally

---

## Application Architecture

```
┌───────────────────────────┐
│       Electron Main       │
│      (main.js)            │
└─────────────┬─────────────┘
              │
        IPC Communication
              │
┌─────────────▼─────────────┐
│      Renderer Process     │
│      HTML/CSS/JS UI       │
└─────────────┬─────────────┘
              │
              ▼
     Business Rule Engine
              │
              ▼
        ExcelJS Services
              │
              ▼
      templates/master.xlsx
              │
              ▼
      Generated SOA Workbook
```

---

## Building the Executable

To generate a distributable Windows executable, run:

```bash
npm run build
```

Electron Builder will package the application and create the installer.

The generated files are located in:

```
dist/
```

Example output:

```
dist/
├── SOA Generator Setup.exe
├── latest.yml
└── win-unpacked/
```

---

## Packaging Process

The build process performs the following steps:

1. Compiles the Electron application.
2. Bundles the renderer files.
3. Includes all required Node.js dependencies.
4. Copies the Excel template (`templates/master.xlsx`).
5. Packages the application into a Windows executable.
6. Creates an installer using Electron Builder.

---

## Updating the Application

After modifying the source code:

```bash
npm install
npm run build
```

A new installer will be generated inside the `dist` folder.

---

## Notes

- Do not modify `templates/master.xlsx` unless the SOA format changes.
- Always test generated workbooks before releasing a new version.
- Exclude `node_modules` from version control.
- Commit business rule changes separately for easier maintenance.

## New SOA item format

Item descriptions, prices, and PhilHealth mappings in `services/soaCatalog.json`
were transcribed from `NEW FORMAT SOA 3 CLAIMS.xlsx`. Generation preserves the
existing workbook columns and fills one block per claim.

Each claim selects New or Re-use Highflux Dialyzer and selects
one EPO type (Alfa, Beta, or None), with None as the manual form default.
Iron Sucrose is selected independently. Batch Alfa and Beta dates must not overlap. All exported quantities are 1.
Sodium Chloride and Heparin are always included, along with the sample's eight
machine/supply rows. Laboratory adds the sample's ten laboratory rows.
Iron Sucrose's PhilHealth mapping remains blank, as in the supplied sample.
There is no fixed-total room-and-board adjustment in this format.

Use the updated downloadable batch template. Medicine and laboratory columns
contain day lists; RE-USE DATES identifies treatments using a reused dialyzer.
All other treatment dates use New. The previous access, flux, and dose-quantity
fields are no longer used.

Run `npm test` for item-selection, workbook, input-validation, and frontend-state checks.
