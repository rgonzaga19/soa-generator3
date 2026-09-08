const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const server = require("./server");
const fs = require("fs");
const https = require("https");
const os = require("os");

let mainWindow;

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1500,
        height: 900,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "public", "images", "logo.ico"),
        show: false,

        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
        
    });

    mainWindow.loadURL("http://localhost:3000");

    // Show the window only after the page has finished loading.
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
}

ipcMain.handle("get-app-version", () => {
    return app.getVersion();
});

// ── License key persistence ──────────────────────────────────────────
// Stored as a small JSON file in the app's userData folder rather than
// renderer localStorage. This is a synchronous fs write in the main
// process — it completes fully before the IPC handler returns, so it
// can't be lost to the same async-flush-vs-quit race that localStorage
// was subject to (see electron-main.js before-quit handler / the
// session.flushStorageData() fix that preceded this).
function getLicenseFilePath() {
    return path.join(app.getPath("userData"), "license.json");
}

function readSavedLicenseKey() {

    try {

        const raw = fs.readFileSync(getLicenseFilePath(), "utf8");
        const data = JSON.parse(raw);

        return typeof data.key === "string" ? data.key : "";

    } catch (err) {

        // No file yet (first run), or it's missing/corrupt — either way
        // there's no usable saved key.
        return "";

    }

}

function writeSavedLicenseKey(key) {

    const filePath = getLicenseFilePath();

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ key: String(key || "").trim() }), "utf8");

}

ipcMain.handle("get-license-key", () => {
    return readSavedLicenseKey();
});

ipcMain.handle("save-license-key", (event, key) => {
    writeSavedLicenseKey(key);
    return { success: true };
});

ipcMain.handle("download-update", async (event, downloadUrl) => {

    function download(url, destination, resolve, reject) {

        https.get(url, (response) => {

            // Follow GitHub redirects
            if (
                response.statusCode === 301 ||
                response.statusCode === 302
            ) {

                return download(
                    response.headers.location,
                    destination,
                    resolve,
                    reject
                );

            }

            if (response.statusCode !== 200) {

                return reject(
                    new Error(`Download failed. Status: ${response.statusCode}`)
                );

            }

            const file = fs.createWriteStream(destination);

            const totalSize = parseInt(response.headers["content-length"] || "0", 10);
            let downloaded = 0;

            response.on("data", (chunk) => {
                downloaded += chunk.length;

                if (totalSize > 0 && mainWindow) {
                    const percent = Math.round((downloaded / totalSize) * 100);

                    mainWindow.webContents.send("download-progress", percent);
                }
            });

            response.pipe(file);

            file.on("finish", () => {

                file.close();

                if (mainWindow) {
                    mainWindow.webContents.send("download-progress", 100);
                }

                resolve({
                    success: true,
                    path: destination
                });

            });

            file.on("error", reject);

        }).on("error", reject);

    }

    return new Promise((resolve, reject) => {

        const tempFile = path.join(
            os.tmpdir(),
            "SOA Generator Setup.exe"
        );

        download(
            downloadUrl,
            tempFile,
            resolve,
            reject
        );

    });

});


ipcMain.handle("install-update", async (event, installerPath) => {

    try {

        await shell.openPath(installerPath);

        app.quit();

        return {
            success: true
        };

    } catch (err) {

        return {
            success: false,
            error: err.message
        };

    }

});


app.whenReady().then(async () => {

    if (app.isPackaged) {
        process.env.APP_RESOURCES = process.resourcesPath;
    }

    await server.start();
    createWindow();

});

// Cleanly stop the Express server. Also flushes the renderer's DOM
// storage (localStorage) to disk first: localStorage.setItem() writes
// are committed to disk asynchronously by Chromium's storage service, so
// without this, a value saved (e.g. the dark/light theme preference)
// just before the app is closed can be lost if the process tears down
// before that background write completes. The license key no longer
// goes through this path at all — it's written synchronously to disk by
// the main process (see get-license-key/save-license-key above), so it
// isn't subject to this race in the first place.
app.on("before-quit", () => {

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.session.flushStorageData();
    }

    server.stop();

});

// Quit when all windows are closed (except on macOS).
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// Re-create the window if the dock icon is clicked on macOS.
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});