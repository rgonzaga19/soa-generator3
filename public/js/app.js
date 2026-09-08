const appState = {

    accessType: "fistula",

    fluxType: "high",

    claims: [
        {
            renderDate: "",
            hasEpo: false,
            epoQty: 1,
            epoType: "alfa",
            hasLab: false
        }
    ]

};

// ── Update information ────────────────────────────────────────────────
let currentVersion = "";
let latestUpdateInfo = null;
let downloadedInstallerPath = null;

// ── Header update-status badge ──────────────────────────────────────────
// Mirrors whatever checkForUpdates() finds so the user sees it immediately
// in the sticky header, without having to open the About modal.
function setUpdateBadge(state, text) {

    const badge = document.getElementById("updateStatusBadge");
    if (!badge) return;

    badge.classList.remove("is-checking", "is-uptodate", "is-available", "is-error");

    if (!state) {
        badge.style.display = "none";
        return;
    }

    badge.classList.add(`is-${state}`);
    badge.innerHTML = `<span class="dot"></span>${text}`;
    badge.style.display = "flex";

}

// ── Application version ────────────────────────────────────────────────

async function loadApplicationVersion() {

    try {

        currentVersion = await window.electronAPI.getAppVersion();

        const version = currentVersion;

        const badge = document.getElementById("versionBadge");
        if (badge) {
            badge.textContent = `v${version}`;
        }

        const about = document.getElementById("aboutVersion");
        if (about) {
            about.textContent = version;
        }

        const footer = document.getElementById("footerVersion");
        if (footer) {
            footer.textContent = `Version ${version}`;
        }

    } catch (err) {

        console.error("Unable to load application version:", err);

    }

}

function isNewerVersion(latest, current) {

    const latestParts = latest.split(".").map(Number);
    const currentParts = current.split(".").map(Number);

    const maxLength = Math.max(
        latestParts.length,
        currentParts.length
    );

    for (let i = 0; i < maxLength; i++) {

        const latestValue = latestParts[i] || 0;
        const currentValue = currentParts[i] || 0;

        if (latestValue > currentValue) {
            return true;
        }

        if (latestValue < currentValue) {
            return false;
        }

    }

    return false;

}

async function checkForUpdates(showLatestMessage = false) {

    setUpdateBadge("checking", "Checking…");

    try {

        if (!currentVersion) {
            currentVersion = await window.electronAPI.getAppVersion();
        }

        const savedKey = await getSavedLicenseKey();

        if (!savedKey) {

            document.getElementById("latestVersion").textContent = "-";
            document.getElementById("updateStatus").textContent =
                "No license key configured.";

            // Nothing meaningful to show in the header without a key —
            // hide the badge rather than nag the user on every load.
            setUpdateBadge(null);

            return;

        }

        const result = await validateLicenseKey(savedKey);

        if (!result.valid) {

            document.getElementById("latestVersion").textContent = "-";
            document.getElementById("updateStatus").textContent =
                result.message || "Unable to validate license.";

            setUpdateBadge("error", "Update check failed");

            return;

        }

        if (!result.update) {

            document.getElementById("latestVersion").textContent = "-";
            document.getElementById("updateStatus").textContent =
                "Update information unavailable.";

            setUpdateBadge("error", "Update check failed");

            return;

        }

        latestUpdateInfo = result.update;

        document.getElementById("latestVersion").textContent =
            latestUpdateInfo.version;

        if (!isNewerVersion(latestUpdateInfo.version, currentVersion)) {

            document.getElementById("updateStatus").textContent =
                "✅ You're using the latest version.";

            document.getElementById("releaseNotesContainer").style.display = "none";
            document.getElementById("downloadUpdateBtn").style.display = "none";

            setUpdateBadge("uptodate", "Up to date");

            if (showLatestMessage) {
                showToast("You're already using the latest version.", "success");
            }

            return;

        }

        document.getElementById("updateStatus").textContent =
            `🟢 Version ${latestUpdateInfo.version} is available.`;

        setUpdateBadge("available", `Update available (v${latestUpdateInfo.version})`);

        const notes = document.getElementById("releaseNotes");

        notes.innerHTML = "";

        (latestUpdateInfo.notes || []).forEach(note => {

            const li = document.createElement("li");
            li.textContent = note;
            notes.appendChild(li);

        });

        document.getElementById("releaseNotesContainer").style.display = "block";
        document.getElementById("downloadUpdateBtn").style.display = "inline-block";

    }
    catch (err) {

        console.error(err);

        document.getElementById("updateStatus").textContent =
            "Unable to check for updates.";

        setUpdateBadge("error", "Update check failed");

    }

}



// ── License settings ─────────────────────────────────────────────
const LICENSE_VALIDATION_URL = "https://soa-generator-license.gonzagaromel19.workers.dev";
const LICENSE_REQUEST_TIMEOUT_MS = 10000; // matches the Python client's timeout=10

// ── Release log (full version history, shown in the About modal) ────────
let releaseLogLoaded = false;

async function loadReleaseLog() {

    const container = document.getElementById("releaseLog");
    if (!container) return;

    // Cache it for the session — the history only changes with a new
    // worker deploy, no need to refetch every time the modal opens.
    if (releaseLogLoaded) return;

    try {

        const response = await fetch(`${LICENSE_VALIDATION_URL}/changelog`);

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const history = await response.json();

        if (!Array.isArray(history) || history.length === 0) {
            container.innerHTML =
                `<p class="release-log-empty">No release history available yet.</p>`;
            return;
        }

        container.innerHTML = history.map(entry => {

            const notes = (entry.notes || [])
                .map(note => `<li>${escapeHtml(note)}</li>`)
                .join("");

            return `
                <div class="release-log-entry">
                    <div class="release-log-entry-header">
                        <span class="release-log-version">v${escapeHtml(entry.version || "-")}</span>
                        ${entry.date ? `<span class="release-log-date">${escapeHtml(entry.date)}</span>` : ""}
                    </div>
                    <ul>${notes}</ul>
                </div>
            `;

        }).join("");

        releaseLogLoaded = true;

    } catch (err) {

        console.error("Unable to load release log:", err);

        container.innerHTML =
            `<p class="release-log-empty">Unable to load release history.</p>`;

    }

}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

const claimsContainer = document.getElementById("claimsContainer");

const summary = document.getElementById("summary");

function renderClaims() {

    claimsContainer.innerHTML = "";
    const today = new Date().toISOString().split("T")[0];

    appState.claims.forEach((claim, index) => {

        claimsContainer.innerHTML += `

        <div class="claim-card">

            <h3>Claim #${index + 1}</h3>

            <div class="claim-grid">

                <div>

                    <label>Render Date</label>

                    <input
                        type="date"
                        value="${claim.renderDate}"
                        min="2020-01-01"
                        max="${today}"
                        onchange="updateDate(${index}, this.value)"
                    >

                    <small
                        id="dateError${index}"
                        style="color:red; display:none;"
                    >
                        Date cannot be in the future.
                    </small>

                </div>

                <div>

                    <label>Has EPO</label>

                    <label class="checkbox-field checkbox-field--epo">
                        <input
                            type="checkbox"
                            ${claim.hasEpo ? "checked" : ""}
                            onchange="toggleEpo(${index},this.checked)"
                        >
                        <span>${claim.hasEpo ? "Yes" : "No"}</span>
                    </label>

                </div>

                <div>

                    <label>Include Laboratory</label>

                    <label class="checkbox-field checkbox-field--lab">
                        <input
                            type="checkbox"
                            ${claim.hasLab ? "checked" : ""}
                            onchange="toggleLab(${index})"
                        >
                        <span>${claim.hasLab ? "Yes" : "No"}</span>
                    </label>

                </div>

                <div>

                    <label>EPO Type</label>

                    <select
                            class="epo-field"
                            ${claim.hasEpo ? "" : "disabled"}
                            onchange="updateEpoType(${index},this.value)"
                        >

                        <option
                            value="alfa"
                            ${claim.epoType === "alfa" ? "selected" : ""}
                        >
                            Alfa
                        </option>

                        <option
                            value="beta"
                            ${claim.epoType === "beta" ? "selected" : ""}
                        >
                            Beta
                        </option>

                    </select>

                </div>

                <div>

                    <label>EPO Quantity</label>

                    <input
                        class="epo-field epo-field--qty"
                        type="number"
                        min="1"
                        max="${claim.epoType === "beta" ? 1 : 2}"
                        value="${claim.epoQty}"
                        ${claim.hasEpo ? "" : "disabled"}
                        oninput="updateEpoQty(${index}, this)"
                    >
                    <small
                        id="epoQtyError${index}"
                        style="color:red; display:none;"
                    >
                        ${claim.epoType === "beta" ? "Beta does not support double dose." : "Maximum quantity is 2."}
                    </small>

                </div>

            </div>

        </div>

        `;

    });

    renderSummary();

}

function renderSummary(){

    let html = "";

    html += `<div class="summary-item"><b>Access:</b> ${appState.accessType}</div>`;
    html += `<div class="summary-item"><b>Dialyzer:</b> ${appState.fluxType}</div>`;

    html += `<div class="summary-item"><b>Claims:</b> ${appState.claims.length}</div>`;

    const labIndex =
        appState.claims.findIndex(c=>c.hasLab);

    html += `<div class="summary-item"><b>Laboratory:</b> ${
        labIndex==-1 ? "None" : "Claim #"+(labIndex+1)
    }</div>`;

    html += "<hr><br>";

    appState.claims.forEach((c,i)=>{

        html+=`
        <div class="summary-item">

        <b>Claim ${i+1}</b><br>

        Date:
        ${c.renderDate || "-"}

        <br>
        EPO:
        ${
            c.hasEpo
                ? `${c.epoType.toUpperCase()} x${c.epoQty}`
                : "None"
        }

        ${c.hasLab ? "<br>LAB ✓" : ""}

        </div>
        `;

    });

    summary.innerHTML=html;

}

function updateDate(index, value) {

    const today = new Date().toISOString().split("T")[0];

    const error =
        document.getElementById(`dateError${index}`);

    if (value > today) {

        error.style.display = "block";

        value = today;

        // Update the visible input
        const inputs =
            document.querySelectorAll("input[type='date']");

        inputs[index].value = today;

    } else {

        error.style.display = "none";

    }

    appState.claims[index].renderDate = value;

    renderSummary();

}

function toggleEpo(index, value){

    appState.claims[index].hasEpo = value;

    if (!value) {
        appState.claims[index].epoQty = 1;
        appState.claims[index].epoType = "alfa";
    }

    renderClaims();

}

function updateEpoQty(index, input) {

    const claim = appState.claims[index];
    const maxQty = claim.epoType === "beta" ? 1 : 2;

    // Only allow 1 digit, same as the old validateEpoQty behavior.
    if (input.value.length > 1) {
        input.value = input.value.slice(0, 1);
    }

    let value = parseInt(input.value);
    const wentOverMax = value > maxQty;

    if (isNaN(value) || value < 1) {
        value = 1;
    }

    if (value > maxQty) {
        value = maxQty;
    }

    // Commit to state immediately (on every keystroke), so the value
    // submitted with the form always matches what's shown in the field —
    // it no longer depends on the field losing focus first.
    claim.epoQty = value;
    input.value = value;

    const error = document.getElementById(`epoQtyError${index}`);
    if (error) {
        error.style.display = wentOverMax ? "block" : "none";
    }

    renderSummary();

}

function updateEpoType(index,value){

    const claim = appState.claims[index];

    claim.epoType = value;

    // Beta does not support double dose — clamp back to 1 if needed.
    if (value === "beta" && claim.epoQty > 1) {
        claim.epoQty = 1;
    }

    // Re-render so the quantity field's max attribute and error text
    // (which depend on epoType) reflect the new selection.
    renderClaims();

}

function toggleLab(index) {

    // If already checked, uncheck it
    if (appState.claims[index].hasLab) {

        appState.claims[index].hasLab = false;

    } else {

        // Otherwise make this the only checked laboratory
        appState.claims.forEach(c => c.hasLab = false);

        appState.claims[index].hasLab = true;

    }

    renderClaims();

}

document
.getElementById("claimCount")
.addEventListener("change",(e)=>{

    let count = parseInt(e.target.value);

        const error = document.getElementById("claimCountError");

        if (isNaN(count)) {
            count = 1;
        }

        if (count > 7) {

            error.style.display = "block";

            count = 7;

            e.target.value = 7;

        } else {

            error.style.display = "none";

        }

        if (count < 1) {

            count = 1;

            e.target.value = 1;

        }

    while(appState.claims.length<count){

        appState.claims.push({

            renderDate:"",
            hasEpo:false,
            epoQty:1,
            epoType:"alfa",
            hasLab:false

        });
    }

    while(appState.claims.length>count){

        appState.claims.pop();

    }

    renderClaims();

});

document
.querySelectorAll("input[name='accessType']")
.forEach(r=>{

    r.addEventListener("change",(e)=>{

        appState.accessType=e.target.value;

        renderSummary();

    });

});

document
.querySelectorAll("input[name='fluxType']")
.forEach(r => {

    r.addEventListener("change", (e) => {

        appState.fluxType = e.target.value;

        renderSummary();

    });

});

renderClaims();

// ── Theme (dark mode) ────────────────────────────────────────────
// Note: the initial theme is already applied by an inline script in
// <head> before this file loads (avoids a flash of the light theme).
// This section just wires up the toggle button and keeps localStorage
// in sync with whatever the user picks from here on.

const THEME_STORAGE_KEY = "soaTheme";

function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
}

function applyTheme(theme) {

    document.documentElement.setAttribute("data-theme", theme);

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
        // localStorage unavailable — theme just won't persist across restarts.
    }

    const btn = document.getElementById("themeToggleBtn");

    if (btn) {
        btn.textContent = theme === "dark" ? "☀ Light" : "🌙 Dark";
    }

}

function toggleTheme() {
    applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
}

// Sync the button label with whatever theme the inline head script already
// applied, so the icon/text is correct on first render.
applyTheme(getCurrentTheme());

document
    .getElementById("themeToggleBtn")
    .addEventListener("click", toggleTheme);

// ── License settings helpers ────────────────────────────────────

// Cached result of the most recent successful validation, so the Settings
// panel can show owner/plan/expiry instead of just a masked key once we've
// actually confirmed the key against the server.
let lastLicenseInfo = null;

// The license key is persisted by the main process to a file in the
// app's userData folder (see electron-main.js) rather than renderer
// localStorage — a synchronous main-process file write can't be lost to
// the storage-flush-vs-quit race that localStorage was subject to.
async function getSavedLicenseKey() {

    try {
        return (await window.electronAPI.getLicenseKey()) || "";
    } catch (err) {
        console.error("Unable to read saved license key:", err);
        return "";
    }

}

async function saveLicenseKey(key) {

    await window.electronAPI.saveLicenseKey(key.trim());

    // A newly-entered key hasn't been validated yet — drop any cached
    // info from a previous (different) key so the status display doesn't
    // show stale owner/plan details for a key that's since changed.
    lastLicenseInfo = null;

}

async function updateLicenseStatusText() {

    const statusEl = document.getElementById("licenseStatus");
    const savedKey = await getSavedLicenseKey();

    if (!savedKey) {
        statusEl.textContent = "No license key saved yet.";
        statusEl.className = "license-status";
        return;
    }

    if (lastLicenseInfo && lastLicenseInfo.valid) {

        const parts = [];

        if (lastLicenseInfo.owner) parts.push(lastLicenseInfo.owner);
        if (lastLicenseInfo.plan) parts.push(`${lastLicenseInfo.plan} plan`);
        if (lastLicenseInfo.expires) parts.push(`expires ${lastLicenseInfo.expires}`);

        statusEl.textContent = parts.length
            ? `Licensed to ${parts.join(" — ")}`
            : "License verified.";

        statusEl.className = "license-status saved";

        return;

    }

    // A confirmed rejection (invalid key or expired license) from the
    // server — show the server's own explanation rather than a generic
    // "not yet verified", since we actually know why it failed.
    if (lastLicenseInfo && (lastLicenseInfo.reason === "invalid" || lastLicenseInfo.reason === "expired")) {
        statusEl.textContent = lastLicenseInfo.message || "This license key was rejected by the server.";
        statusEl.className = "license-status invalid";
        return;
    }

    // Saved but not yet (re)verified this session — mask all but the
    // last 4 characters so it's clear a key is saved without displaying
    // it in full every time the modal opens.
    const masked =
        savedKey.length > 4
            ? "•".repeat(savedKey.length - 4) + savedKey.slice(-4)
            : "••••";

    statusEl.textContent = `Saved key: ${masked} (not yet verified)`;
    statusEl.className = "license-status";

}

async function openSettingsModal() {

    const modal = document.getElementById("settingsModal");
    const input = document.getElementById("licenseKeyInput");

    document.getElementById("licenseError").style.display = "none";

    // Show the modal immediately rather than waiting on the file read —
    // it's a fast local read, but there's no reason to make the modal's
    // appearance depend on it.
    modal.style.display = "block";

    input.value = await getSavedLicenseKey();

    await updateLicenseStatusText();

}

function closeSettingsModal() {
    document.getElementById("settingsModal").style.display = "none";
}

// Calls the Cloudflare license server. Matches worker.js exactly:
//   - POST { license: <key> }, 10 second timeout
//   - Almost every outcome is HTTP 200 with { valid, reason?, owner?,
//     plan?, expires? } in the body — the worker only uses non-200 for
//     405 (wrong method) and 400 (malformed request), and even those
//     bodies carry a JSON "reason".
//   - An expired license comes back as { valid: false, reason: "License
//     expired", owner, plan, expires } — still rejected, but with enough
//     detail to tell the user *why* rather than a flat "invalid".
// Returns { valid, owner?, plan?, expires?, reason?, message? } — reason
// and message are only present when valid is false.
async function validateLicenseKey(key) {

    if (!key) {
        return {
            valid: false,
            reason: "empty",
            message: "Please enter a license key."
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
        () => controller.abort(),
        LICENSE_REQUEST_TIMEOUT_MS
    );

    try {

        const response = await fetch(LICENSE_VALIDATION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ license: key.trim() }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // The worker returns a JSON body with a "reason" field on every
        // status code it uses (200, 400, 405), so parse first and only
        // fall back to a generic HTTP message if the body itself isn't
        // valid JSON (e.g. an upstream/network failure Cloudflare itself
        // returned an HTML error page for).
        let data;

        try {
            data = await response.json();
        } catch (parseErr) {
            return {
                valid: false,
                reason: "server",
                message: `License server returned HTTP ${response.status}`
            };
        }

        if (!response.ok) {
            return {
                valid: false,
                reason: "server",
                message: data.reason || `License server returned HTTP ${response.status}`
            };
        }

        if (!data.valid) {

            const isExpired = data.reason === "License expired";

            let message = data.reason || "Invalid license key. Please check Settings.";

            if (isExpired && data.expires) {
                const details = [data.owner, data.plan && `${data.plan} plan`]
                    .filter(Boolean)
                    .join(", ");
                message = `License expired on ${data.expires}` + (details ? ` (${details})` : "");
            }

            return {
                valid: false,
                reason: isExpired ? "expired" : "invalid",
                message,
                owner: data.owner,
                plan: data.plan,
                expires: data.expires
            };

        }

        return {
            valid: true,
            owner: data.owner,
            plan: data.plan,
            expires: data.expires,

            update: data.update || null
        };

    } catch (err) {

        clearTimeout(timeoutId);

        console.error("License validation request failed:", err);

        if (err.name === "AbortError") {
            return {
                valid: false,
                reason: "timeout",
                message: "Connection to the license server timed out."
            };
        }

        return {
            valid: false,
            reason: "network",
            message: "Unable to connect to the license server."
        };

    }

}

document
    .getElementById("settingsBtn")
    .addEventListener("click", openSettingsModal);

document
    .getElementById("closeSettings")
    .addEventListener("click", closeSettingsModal);

document
    .getElementById("saveLicenseBtn")
    .addEventListener("click", async () => {

        const input = document.getElementById("licenseKeyInput");
        const error = document.getElementById("licenseError");

        const key = input.value.trim();

        if (!key) {
            error.style.display = "block";
            return;
        }

        error.style.display = "none";

        await saveLicenseKey(key);

        await updateLicenseStatusText();

        showToast("License key saved.", "success");

    });

// ── Excel generation ─────────────────────────────────────────────

async function generateExcel() {

        const missingDate = appState.claims.find(
            c => !c.renderDate
        );

        if (missingDate) {

            showToast(
                "Please enter the render date for all claims.",
                "warning"
            );

            return;

        }

        const savedKey = await getSavedLicenseKey();

        if (!savedKey) {

            showToast(
                "Please enter your license key in Settings before generating.",
                "warning"
            );

            openSettingsModal();

            return;

        }

        const overlay = document.getElementById("loadingOverlay");
        const loadingText = document.getElementById("loadingText");

        const btn = document.getElementById("generateBtn");

        overlay.style.display = "flex";

        btn.disabled = true;
        loadingText.textContent = "Validating license...";
        btn.textContent = "Validating...";

        document.getElementById("systemStatus").textContent =
            "🟡 Validating license...";

        const licenseResult = await validateLicenseKey(savedKey);

        if (!licenseResult.valid) {

            overlay.style.display = "none";

            btn.disabled = false;
            btn.textContent = "Generate Excel";

            const message =
                licenseResult.message
                || "Invalid license key. Please check Settings.";

            showToast(message, "error");

            document.getElementById("systemStatus").textContent =
                "🔴 License check failed";

            // Cache the failure (invalid/expired/etc.) so Settings can show
            // *why* it failed next time it's opened, instead of just a
            // masked "not yet verified" key.
            lastLicenseInfo = licenseResult;

            // Only pop Settings open for cases the user can fix by editing
            // the key there (invalid, expired, or missing). A timeout or
            // network/server error isn't something re-typing the key fixes,
            // so don't yank focus away from the form for those — the toast
            // already told them what happened.
            if (licenseResult.reason === "invalid" || licenseResult.reason === "expired" || licenseResult.reason === "empty") {
                openSettingsModal();
            }

            return;

        }

        // Cache the verified owner/plan/expiry so the Settings panel can
        // show it next time it's opened, instead of just a masked key.
        lastLicenseInfo = licenseResult;

        loadingText.textContent = "Generating Excel...";
        btn.textContent = "Generating...";

    try {

        document.getElementById("systemStatus").textContent =
            "🟡 Generating Excel...";

        const response = await fetch("/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(appState)
        });

        if (!response.ok) {

            overlay.style.display = "none";

            btn.disabled = false;

            btn.textContent = "Generate Excel";

            showToast(
                "Generation failed.",
                "error"
            );

            document.getElementById("systemStatus").textContent =
                "🔴 Generation failed";

            return;

        }

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = "generated.xlsx";

        document.body.appendChild(a);

        a.click();

        a.remove();

        window.URL.revokeObjectURL(url);

            overlay.style.display = "none";

            btn.disabled = false;

            btn.textContent = "Generate Excel";

            showToast(
                "Excel generated successfully!",
                "success"
            );
        document.getElementById("systemStatus").textContent =
            "✅ Excel generated successfully";

    } catch (err) {

        document.getElementById("systemStatus").textContent =
            "🔴 Generation failed";

        overlay.style.display = "none";

        btn.disabled = false;

        btn.textContent = "Generate Excel";

        showToast(
            "Generation failed.",
            "error"
        );

        console.error(err);

    }


}

function clearForm() {

    // Reset access type
    appState.accessType = "fistula";

    // Reset flux type (if you've already added it)
    if ("fluxType" in appState) {
        appState.fluxType = "high";
    }

    // Reset claims
    appState.claims = [
        {
            renderDate: "",
            hasEpo: false,
            epoQty: 1,
            epoType: "alfa",
            hasLab: false
        }
    ];

    // Reset Number of Claims input
    document.getElementById("claimCount").value = 1;

    // Reset radio buttons
    document.querySelector(
        "input[name='accessType'][value='fistula']"
    ).checked = true;

    // Reset flux radio buttons if present
    const highFlux = document.querySelector(
        "input[name='fluxType'][value='high']"
    );

    if (highFlux) {
        highFlux.checked = true;
    }

    renderClaims();

    clearBatchSection();

}

const aboutBtn = document.getElementById("aboutBtn");
const aboutModal = document.getElementById("aboutModal");
const closeAbout = document.getElementById("closeAbout");

if (aboutBtn && aboutModal && closeAbout) {

    aboutBtn.onclick = async () => {

        aboutModal.style.display = "block";

        document.getElementById("latestVersion").textContent = "Checking...";
        document.getElementById("updateStatus").textContent =
            "Checking for updates...";

        await checkForUpdates();

        loadReleaseLog();

        window.electronAPI.onDownloadProgress((percent) => {

            const button = document.getElementById("downloadUpdateBtn");

            if (!button) return;

            if (downloadedInstallerPath) return;

            button.textContent = `Downloading... ${percent}%`;

        });

    };

    const updateStatusBadge = document.getElementById("updateStatusBadge");
    if (updateStatusBadge) {
        updateStatusBadge.onclick = () => aboutBtn.onclick();
    }

    closeAbout.onclick = () => {
        aboutModal.style.display = "none";
    };

    window.onclick = (e) => {
        if (e.target === aboutModal) {
            aboutModal.style.display = "none";
        }
        if (e.target === document.getElementById("settingsModal")) {
            closeSettingsModal();
        }
    };

}

function showToast(message, type = "info") {

    const toast = document.getElementById("toast");

    toast.className = `toast ${type}`;

    toast.textContent = message;

    toast.style.display = "block";

    setTimeout(() => {

        toast.style.display = "none";

    }, 3000);

}



document
    .getElementById("generateBtn")
    .addEventListener("click", generateExcel);

document
    .getElementById("clearBtn")
    .addEventListener("click", clearForm);

document
    .getElementById("checkUpdateBtn")
    .addEventListener("click", () => {

        checkForUpdates(true);

    });
    
document
    .getElementById("downloadUpdateBtn")
    .addEventListener("click", async () => {

        const button = document.getElementById("downloadUpdateBtn");

        // Installer already downloaded
        if (downloadedInstallerPath) {

            await window.electronAPI.installUpdate(downloadedInstallerPath);

            return;

        }

        if (!latestUpdateInfo) {
            return;
        }

        try {

            button.disabled = true;
            button.textContent = "Downloading...";

            const result = await window.electronAPI.downloadUpdate(
                latestUpdateInfo.download
            );

            if (result.success) {

                downloadedInstallerPath = result.path;

                button.disabled = false;
                button.textContent = "🚀 Install Update";

                showToast(
                    "Download complete. Click again to install.",
                    "success"
                );

            }

        } catch (err) {

            console.error(err);

            button.disabled = false;
            button.textContent = "⬇ Download Update";

            showToast(
                "Failed to download update.",
                "error"
            );

        }

    });

loadApplicationVersion();

// Silent background check so the header badge reflects update status
// right away, without waiting for the user to open the About modal.
checkForUpdates();

// ── Batch generation ─────────────────────────────────────────────
// Client-side only: parses an uploaded .xlsx (one row per person, wide
// claim columns), calls the existing single-item /generate endpoint once
// per row, and packages every returned .xlsx into one .zip download named
// from each row's Name column. No server changes required.

const CLAIM_COLUMNS_PER_ROW = 7; // hard cap — mirrors the single-entry form's 7-claim max

function sanitizeFileName(name) {

    const cleaned = String(name || "")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 100);

    return cleaned || "Unnamed";

}

const batchFileInput = document.getElementById("batchFileInput");
const batchFileError = document.getElementById("batchFileError");
const batchPreview = document.getElementById("batchPreview");
const batchGenerateBtn = document.getElementById("batchGenerateBtn");
const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
const batchProgress = document.getElementById("batchProgress");
const batchProgressFill = document.getElementById("batchProgressFill");
const batchProgressText = document.getElementById("batchProgressText");
const batchLog = document.getElementById("batchLog");
const batchClaimMonth = document.getElementById("batchClaimMonth");
const batchClaimYear = document.getElementById("batchClaimYear");

// Parsed { name, state, warnings } entries from the most recently loaded file.
let batchEntries = [];

// ── Default claim period (month/year) ──────────────────────────────
// Fills in whatever a cell's date doesn't state itself — see
// parseTreatmentDatesCell()/parseDayListCell() below for exactly when
// each gets used.
(function initBatchPeriodDefaults() {

    if (!batchClaimMonth || !batchClaimYear) return;

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const now = new Date();

    monthNames.forEach((label, i) => {
        const opt = document.createElement("option");
        opt.value = String(i + 1);
        opt.textContent = label;
        if (i === now.getMonth()) opt.selected = true;
        batchClaimMonth.appendChild(opt);
    });

    batchClaimYear.value = now.getFullYear();

})();

// Resets the whole Batch Generate card back to its just-loaded state:
// clears the selected file, the parsed entries, the preview/warning
// text, any in-progress log/progress bar, and puts the Default Claim
// Period back to the current month/year. Called by clearForm() (the
// main "Clear Form" button) so clearing the form clears batch state too.
function clearBatchSection() {

    batchEntries = [];

    if (batchFileInput) batchFileInput.value = "";

    if (batchFileError) batchFileError.style.display = "none";

    if (batchPreview) {
        batchPreview.style.display = "none";
        batchPreview.innerHTML = "";
    }

    if (batchGenerateBtn) {
        batchGenerateBtn.disabled = true;
        batchGenerateBtn.textContent = "📦 Generate Batch (ZIP)";
    }

    if (batchProgress) batchProgress.style.display = "none";
    if (batchProgressFill) batchProgressFill.style.width = "0%";
    if (batchProgressText) batchProgressText.textContent = "0 / 0";

    if (batchLog) {
        batchLog.style.display = "none";
        batchLog.innerHTML = "";
    }

    if (batchClaimMonth && batchClaimYear) {
        const now = new Date();
        batchClaimMonth.value = String(now.getMonth() + 1);
        batchClaimYear.value = now.getFullYear();
    }

}

// ── Header + value parsing ───────────────────────────────────────────
// The uploaded sheet's exact header text varies (line breaks, periods,
// slashes — "NO. OF CLAIMS" vs "NO OF CLAIMS", "W/ LAB" vs "W LAB"), so
// headers are matched after stripping everything but letters/digits.
function normalizeHeader(h) {
    return String(h).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function normalizeRowKeys(rawRow) {
    const out = {};
    Object.keys(rawRow).forEach(k => {
        out[normalizeHeader(k)] = rawRow[k];
    });
    return out;
}

const BATCH_HEADERS = {
    NAME: "NAME OF PATIENT",
    TREATMENT_DATES: "TREATMENT DATES",
    CLAIM_COUNT: "NO OF CLAIMS",
    EPO_ALFA: "DATES OF ERYTHROPOIETIN GIVEN WEEKLY",
    EPO_BETA: "BETA RECORMON",
    ACCESS: "DIALYZER CATEGORY",
    FLUX: "KIT CATEGORY",
    LAB: "W LAB"
};

const MONTH_ABBR = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function monthFromText(text) {
    return MONTH_ABBR[String(text).slice(0, 3).toLowerCase()] || null;
}

// Excel serial date number -> JS Date (UTC midnight).
function excelSerialToDate(serial) {
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d) ? null : d;
}

// ── Shared day-token parsing helpers ─────────────────────────────────
// Used by parseTreatmentDatesCell(), parseDayQtyListCell(), and
// parseDayListCell() below so all three columns accept the same range of
// user handwriting/typing styles instead of each having its own rules.

// Strips ordinal suffixes ("27th" -> "27", "1st-3rd" -> "1-3").
function stripOrdinals(text) {
    return String(text).replace(/(\d)(st|nd|rd|th)/gi, "$1");
}

// Splits a day-list fragment on any common separator — comma, semicolon,
// slash, embedded newline, or plain whitespace — while normalizing spaced
// ranges ("27 - 29") down to "27-29" first so the range survives the split.
function splitDayTokens(text) {
    return String(text)
        .replace(/\s*-\s*/g, "-")
        .split(/[,;\/\n\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

// Parses a day-list fragment like "28,30", "27-29", "1,3,5", or "28,30
// 2026" into the individual days plus an optional explicit year. A range
// ("27-29") expands to every day in between. A standalone number too big
// to be a day (32+) is treated as an explicit year override rather than
// a day — e.g. the "2026" in "28,30 2026", or a 2-digit "26" -> 2026.
// Returns { days: [...], year: number|null }.
function parseDayListFragment(text) {
    const days = [];
    let year = null;

    splitDayTokens(text).forEach(token => {

        const range = token.match(/^(\d{1,2})-(\d{1,2})$/);
        if (range) {
            const start = parseInt(range[1], 10);
            const end = parseInt(range[2], 10);
            if (start >= 1 && end <= 31 && start <= end) {
                for (let d = start; d <= end; d++) days.push(d);
            }
            return;
        }

        if (!/^\d{1,4}$/.test(token)) return;

        const n = parseInt(token, 10);
        if (n >= 1 && n <= 31) {
            days.push(n);
        } else if (n >= 32) {
            year = n < 100 ? 2000 + n : n;
        }

    });

    return { days, year };
}

// Reads the "Treatment Dates" cell in any of the shapes the template
// allows: a real Excel date, "29-Jul", "Jul 28,30", "Jul 27,29,31", a
// day range ("Jul 27-29"), ordinal days ("29th Jul"), an explicit year
// anywhere in the text ("Jul 28, 2026"), or a bare day list ("28,30")
// that borrows the batch's default month.
// Returns { days: [1..31], month, year } or null if unreadable.
function parseTreatmentDatesCell(value, defaultMonth, defaultYear) {

    if (value === undefined || value === null || value === "") return null;

    if (value instanceof Date && !isNaN(value)) {
        return { days: [value.getDate()], month: value.getMonth() + 1, year: value.getFullYear() };
    }

    if (typeof value === "number" && isFinite(value)) {
        const d = excelSerialToDate(value);
        if (d) return { days: [d.getUTCDate()], month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
    }

    const rawText = String(value).trim();
    if (!rawText) return null;

    // Ordinal suffixes ("27th" -> "27") are stripped up front so every
    // pattern below can assume plain numbers.
    const text = stripOrdinals(rawText);

    // "Jul 28,30" / "Jul-28,30" / "Jul 27-29,31" / "Jul 28, 2026" — month
    // name, then a day list. Days may be separated by commas, semicolons,
    // slashes, whitespace, or hyphenated ranges ("27-29"), and an
    // explicit 2- or 4-digit year anywhere in the list overrides the
    // batch default.
    let m = text.match(/^([A-Za-z]{3,9})[\s,.\-]+([0-9\s,;\/\-]+)$/);
    if (m) {
        const month = monthFromText(m[1]);
        if (month) {
            const { days, year } = parseDayListFragment(m[2]);
            if (days.length) return { days, month, year: year || defaultYear };
        }
    }

    // "29-Jul" / "29 Jul" / "29 Jul 2026" — day number first, then month
    // name, with an optional trailing explicit year.
    m = text.match(/^(\d{1,2})[\s,.\-\/]+([A-Za-z]{3,9})(?:[\s,]+(\d{2,4}))?$/);
    if (m) {
        const month = monthFromText(m[2]);
        const day = parseInt(m[1], 10);
        if (month && day >= 1 && day <= 31) {
            let year = defaultYear;
            if (m[3]) {
                const n = parseInt(m[3], 10);
                year = m[3].length <= 2 ? 2000 + n : n;
            }
            return { days: [day], month, year };
        }
    }

    // Bare day list, no month at all — "28,30", "27-29", "1,3,5" —
    // borrows the batch-level default month (and year, unless the cell
    // itself includes an explicit year).
    if (/^[0-9\s,;\/\-]+$/.test(text)) {
        const { days, year } = parseDayListFragment(text);
        if (days.length) return { days, month: defaultMonth, year: year || defaultYear };
    }

    // Last resort — let the browser parse things like "July 29, 2026".
    const parsed = new Date(rawText);
    if (!isNaN(parsed)) {
        return { days: [parsed.getDate()], month: parsed.getMonth() + 1, year: parsed.getFullYear() };
    }

    return null;

}

// Reads a "day marker" cell (Erythropoietin dates, Beta Recormon): a bare
// day number (qty 1), "day(N)"/"dayxN"/"day*N" for an explicit quantity,
// the same day repeated (each occurrence adds 1) — e.g. "27(2),31" or
// "27,27,31,31" — or a day range ("27-29") which applies the same
// quantity to every day in the range. Separators can be commas,
// semicolons, slashes, whitespace, or newlines, and ordinal suffixes
// ("27th") are accepted. Returns a Map<day, quantity>.
function parseDayQtyListCell(value) {

    const result = new Map();

    if (value === undefined || value === null || value === "") return result;

    const addDay = (day, qty) => {
        if (day < 1 || day > 31) return;
        result.set(day, (result.get(day) || 0) + qty);
    };

    if (value instanceof Date && !isNaN(value)) {
        addDay(value.getDate(), 1);
        return result;
    }

    if (typeof value === "number" && isFinite(value)) {
        if (value >= 1 && value <= 31) {
            addDay(Math.round(value), 1);
        } else {
            const d = excelSerialToDate(value);
            if (d) addDay(d.getUTCDate(), 1);
        }
        return result;
    }

    const text = String(value).trim();
    if (!text || /^(no|none|n\/a|-)$/i.test(text)) return result;

    // Collapse whitespace around x/*/()  ("27 x 2" -> "27x2") before
    // tokenizing, since whitespace is otherwise also a separator between
    // distinct day entries and would split "27 x 2" into three tokens.
    const normalized = stripOrdinals(text).replace(/\s*([x*()])\s*/gi, "$1");

    splitDayTokens(normalized).forEach(token => {

        // Day range, optionally with a shared quantity — "27-29" or
        // "27-29(2)" / "27-29x2" applies the same quantity to every day.
        const rangeMatch = token.match(/^(\d{1,2})-(\d{1,2})(?:\s*[x*(]\s*(\d+)\)?)?$/i);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            const qty = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;
            if (start >= 1 && end <= 31 && start <= end) {
                for (let d = start; d <= end; d++) addDay(d, qty);
            }
            return;
        }

        // Single day, optionally with a quantity — "27(2)", "27x2",
        // "27 x 2", "27*2".
        const m = token.match(/^(\d{1,2})(?:\s*[x*(]\s*(\d+)\)?)?$/i);
        if (!m) return;

        const day = parseInt(m[1], 10);
        const qty = m[2] ? parseInt(m[2], 10) : 1;

        addDay(day, qty);

    });

    return result;

}

// Reads a "day marker" cell with no quantity concept (W/ Lab): a bare day
// number, a day range ("27-29"), a list of days (comma/semicolon/slash/
// whitespace-separated, ordinal suffixes accepted), or "NO"/blank meaning
// none. Returns a Set of day-of-month integers to match against the
// row's treatment days.
function parseDayListCell(value) {

    if (value === undefined || value === null || value === "") return new Set();
    if (value instanceof Date && !isNaN(value)) return new Set([value.getDate()]);

    if (typeof value === "number" && isFinite(value)) {
        if (value >= 1 && value <= 31) return new Set([Math.round(value)]);
        const d = excelSerialToDate(value);
        return d ? new Set([d.getUTCDate()]) : new Set();
    }

    const text = String(value).trim();
    if (!text || /^(no|none|n\/a|-)$/i.test(text)) return new Set();

    const { days } = parseDayListFragment(stripOrdinals(text));
    return new Set(days);

}

// Converts one raw spreadsheet row into { name, state, warnings }, where
// state is the same { accessType, fluxType, claims[] } shape generateExcel()
// already posts to /generate. Each treatment day becomes one claim; a day
// that also appears in the Erythropoietin/Beta/W-Lab columns picks up
// hasEpo/epoType/hasLab for that specific claim. A marker day that doesn't
// match any treatment date is simply unused — there's no claim to attach it to.
function rowToBatchEntry(rawRow, defaultMonth, defaultYear) {

    const row = normalizeRowKeys(rawRow);
    const warnings = [];

    const name = String(row[BATCH_HEADERS.NAME] || "").trim();

    const accessType =
        String(row[BATCH_HEADERS.ACCESS] || "").trim().toLowerCase() === "subkit"
            ? "subkit"
            : "fistula";

    const fluxRaw = String(row[BATCH_HEADERS.FLUX] || "").trim().toLowerCase();
    const fluxType = fluxRaw === "low" || fluxRaw === "low flux" ? "low" : "high";

    const treatment = parseTreatmentDatesCell(row[BATCH_HEADERS.TREATMENT_DATES], defaultMonth, defaultYear);

    if (!treatment || !treatment.days.length) {
        return {
            name,
            state: { accessType, fluxType, claims: [] },
            warnings: ["Could not read Treatment Dates for this row."]
        };
    }

    let days = treatment.days;

    if (days.length > CLAIM_COLUMNS_PER_ROW) {
        warnings.push(`Treatment Dates lists ${days.length} dates — only the first ${CLAIM_COLUMNS_PER_ROW} were used.`);
        days = days.slice(0, CLAIM_COLUMNS_PER_ROW);
    }

    const declaredCount = parseInt(row[BATCH_HEADERS.CLAIM_COUNT], 10);
    if (!isNaN(declaredCount) && declaredCount !== days.length) {
        warnings.push(`No. of Claims says ${declaredCount}, but ${days.length} Treatment Date(s) were found.`);
    }

    const epoAlfaQty = parseDayQtyListCell(row[BATCH_HEADERS.EPO_ALFA]);
    const epoBetaQty = parseDayQtyListCell(row[BATCH_HEADERS.EPO_BETA]);
    const labDays = parseDayListCell(row[BATCH_HEADERS.LAB]);

    const month = treatment.month || defaultMonth;
    const year = treatment.year || defaultYear;

    const claims = days.map(day => {

        const renderDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const inBeta = epoBetaQty.has(day);
        const inAlfa = epoAlfaQty.has(day);
        const hasEpo = inAlfa || inBeta;
        const epoType = inBeta ? "beta" : "alfa";

        let epoQty = hasEpo ? (inBeta ? epoBetaQty.get(day) : epoAlfaQty.get(day)) : 1;
        const maxQty = epoType === "beta" ? 1 : 2;

        if (epoQty > maxQty) {
            warnings.push(`${epoType === "beta" ? "Beta Recormon" : "Erythropoietin Given"} on day ${day} lists quantity ${epoQty}, but ${epoType === "beta" ? "Beta" : "Alfa"} allows max ${maxQty} — clamped to ${maxQty}.`);
            epoQty = maxQty;
        }

        return {
            renderDate,
            hasEpo,
            epoQty: hasEpo ? epoQty : 1,
            epoType: hasEpo ? epoType : "alfa",
            hasLab: labDays.has(day)
        };

    });

    // A day listed in one of the marker columns but not among this row's
    // actual Treatment Dates (e.g. a typo like "23" when the claims run
    // 27/29/31) has nowhere to attach — flag it rather than guessing which
    // claim it belongs to or silently dropping it.
    const claimDaySet = new Set(days);

    const flagOrphanDays = (dayIterable, columnLabel, doseNoun) => {
        dayIterable.forEach(d => {
            if (!claimDaySet.has(d)) {
                warnings.push(`${columnLabel} lists day ${d}, which doesn't match any Treatment Date — check for a typo; that ${doseNoun} wasn't included.`);
            }
        });
    };

    flagOrphanDays(Array.from(epoAlfaQty.keys()), "Erythropoietin Given", "dose");
    flagOrphanDays(Array.from(epoBetaQty.keys()), "Beta Recormon", "dose");
    flagOrphanDays(labDays, "W/ Lab", "lab");

    return { name, state: { accessType, fluxType, claims }, warnings };

}

async function downloadBatchTemplate() {

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Batch");

    // Uniform column width across all 8 columns — matches the reference
    // sheet, which was manually widened evenly rather than sized per
    // column content. Keeping it uniform is what actually reads clearly.
    sheet.columns = [
        { width: 34 }, { width: 20 }, { width: 20 }, { width: 20 },
        { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }
    ];

    const headerRow = sheet.addRow([
        "NAME OF PATIENT",
        "TREATMENT DATES",
        "NO. OF CLAIMS",
        "DATES OF ERYTHROPOIETIN GIVEN\n(WEEKLY)",
        "BETA RECORMON",
        "DIALYZER CATEGORY",
        "KIT CATEGORY",
        "W/ LAB"
    ]);

    headerRow.height = 48;
    headerRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    // Same three real examples as the working reference sheet, plus a set
    // of format-teaching examples covering every notation the parser now
    // accepts: dose-quantity variants, day ranges, ordinal suffixes, an
    // explicit year override, and the alternate separators (; /).
    const sampleRows = [
        ["ABAO", "29-Jul", 1, "", 29, "FISTULA", "HIGH FLUX", 29],
        ["ABOGADO", "Jul 28,30", 2, "28,30", "", "SUBKIT", "LOW FLUX", "28"],
        ["ALARZAR", "Jul 27,29,31", 3, "27,31", "", "SUBKIT", "LOW FLUX", "NO"],
        ["EXAMPLE 1 - dose qty (2)", "Jul 27,31", 2, "27(2),31", "", "SUBKIT", "LOW FLUX", "NO"],
        ["EXAMPLE 2 - dose qty x2", "Jul 27,31", 2, "27x2,31", "", "SUBKIT", "LOW FLUX", "NO"],
        ["EXAMPLE 3 - dose qty *2", "Jul 27,31", 2, "27*2,31", "", "SUBKIT", "LOW FLUX", "NO"],
        ["EXAMPLE 4 - repeated day = qty 2", "Jul 27,31", 2, "27,27,31,31", "", "SUBKIT", "HIGH FLUX", "NO"],
        ["EXAMPLE 5 - day range", "Jul 27-29", 3, "27-29", "", "SUBKIT", "LOW FLUX", "27"],
        ["EXAMPLE 6 - ordinal days", "29th Jul", 1, "29th", "", "FISTULA", "HIGH FLUX", "NO"],
        ["EXAMPLE 7 - explicit year", "Jul 28, 2027", 1, "28", "", "FISTULA", "LOW FLUX", "NO"],
        ["EXAMPLE 8 - semicolon/slash separators", "Jul 5/7/9", 3, "5;7;9", "", "SUBKIT", "HIGH FLUX", "NO"],
        ["EXAMPLE 9 - bare day list, no month", "28,30", 2, "28,30", "", "SUBKIT", "LOW FLUX", "NO"]
    ];

    sampleRows.forEach(values => {
        const row = sheet.addRow(values);
        row.eachCell(cell => {
            cell.alignment = { vertical: "middle", horizontal: "center" };
        });
    });

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // ── Instructions sheet ──
    const notes = workbook.addWorksheet("Instructions");
    notes.columns = [{ width: 40 }, { width: 100 }];

    const title = notes.addRow(["How to fill out the Batch sheet"]);
    title.getCell(1).font = { bold: true, size: 13 };
    notes.addRow([]);

    const noteLines = [
        ["NAME OF PATIENT", "Used as the output file name."],
        ["TREATMENT DATES", "Accepts a real date, \"29-Jul\", \"Jul 28,30\", a day range (\"Jul 27-29\"), ordinal days (\"29th Jul\", \"1st,3rd\"), or an explicit year anywhere in the text (\"Jul 28, 2027\") to override the app's Default Claim Period year. Days can be separated with commas, semicolons, or slashes (\"5;7;9\", \"5/7/9\"). If you only type day numbers with no month (e.g. \"28,30\" or \"27-29\"), the app's Default Claim Period month/year fills the gap."],
        ["NO. OF CLAIMS", "Informational — the app counts claims from Treatment Dates directly. A mismatch just shows as a warning, it won't block generation."],
        ["DATES OF ERYTHROPOIETIN GIVEN (WEEKLY)", "Day number(s) EPO Alfa was given — must match a day already listed in Treatment Dates. A second dose on the same day: write \"27(2)\", \"27x2\", \"27*2\", or list the day twice (\"27,27\"). A range like \"27-29\" applies to every day in it; add a quantity to the whole range with \"27-29x2\". Ordinal suffixes (\"27th\") and semicolon/slash separators are also accepted. Max 2 doses per day."],
        ["BETA RECORMON", "Same formats and matching rules as Erythropoietin above, but max 1 dose per day."],
        ["W/ LAB", "Day number(s) a lab was included — accepts the same day-range, ordinal, and separator formats as the other columns — or \"NO\" / blank for none."],
        ["DIALYZER CATEGORY", "FISTULA or SUBKIT."],
        ["KIT CATEGORY", "HIGH FLUX or LOW FLUX."]
    ];

    noteLines.forEach(([label, desc]) => {
        const row = notes.addRow([label, desc]);
        row.getCell(1).font = { bold: true };
        row.getCell(1).alignment = { vertical: "top" };
        row.getCell(2).alignment = { vertical: "top", wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "SOA_Batch_Template.xlsx";

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);

}

function readWorkbookRows(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = (e) => {

            try {

                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array", cellDates: true });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];

                resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }));

            } catch (err) {

                reject(err);

            }

        };

        reader.onerror = () => reject(reader.error);

        reader.readAsArrayBuffer(file);

    });

}

if (batchFileInput) {

    batchFileInput.addEventListener("change", async (e) => {

        const file = e.target.files[0];

        batchFileError.style.display = "none";
        batchPreview.style.display = "none";
        batchGenerateBtn.disabled = true;
        batchEntries = [];

        if (!file) return;

        try {

            const rawRows = await readWorkbookRows(file);

            if (!rawRows.length) {

                batchFileError.textContent = "The file has no data rows.";
                batchFileError.style.display = "block";

                return;

            }

            const defaultMonth = parseInt(batchClaimMonth.value, 10);
            const defaultYear = parseInt(batchClaimYear.value, 10);

            batchEntries = rawRows.map(row => rowToBatchEntry(row, defaultMonth, defaultYear));

            const missingNames = batchEntries.filter(en => !en.name).length;
            const noClaims = batchEntries.filter(en => en.state.claims.length === 0).length;
            const withWarnings = batchEntries.filter(en => en.warnings && en.warnings.length).length;
            const usable = batchEntries.length - noClaims;

            batchPreview.innerHTML = `
                <div class="summary-item"><b>Rows found:</b> ${batchEntries.length}</div>
                <div class="summary-item"><b>Ready to generate:</b> ${usable}</div>
                ${missingNames ? `<div class="summary-item" style="color:var(--red);"><b>Missing Name:</b> ${missingNames} row(s) — will be labeled "Unnamed".</div>` : ""}
                ${noClaims ? `<div class="summary-item" style="color:var(--red);"><b>Unreadable Treatment Dates:</b> ${noClaims} row(s) will be skipped.</div>` : ""}
                ${withWarnings ? `<div class="summary-item" style="color:#b45309;"><b>Warnings:</b> ${withWarnings} row(s) — check the log after generating.</div>` : ""}
            `;
            batchPreview.style.display = "block";

            batchGenerateBtn.disabled = usable === 0;

        } catch (err) {

            console.error("Failed to read batch file:", err);

            batchFileError.textContent = "Unable to read this file. Please use the template.";
            batchFileError.style.display = "block";

        }

    });

}

if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener("click", () => {
        downloadBatchTemplate().catch(err => {
            console.error("Failed to build template file:", err);
            showToast("Couldn't build the template file. Please try again.", "error");
        });
    });
}

async function generateBatch() {

    const validEntries = batchEntries.filter(en => en.state.claims.length > 0);

    if (!validEntries.length) return;

    const savedKey = await getSavedLicenseKey();

    if (!savedKey) {

        showToast("Please enter your license key in Settings before generating.", "warning");
        openSettingsModal();

        return;

    }

    batchGenerateBtn.disabled = true;
    batchGenerateBtn.textContent = "Validating license...";

    const licenseResult = await validateLicenseKey(savedKey);

    if (!licenseResult.valid) {

        batchGenerateBtn.disabled = false;
        batchGenerateBtn.textContent = "📦 Generate Batch (ZIP)";

        showToast(licenseResult.message || "Invalid license key. Please check Settings.", "error");
        openSettingsModal();

        return;

    }

    batchProgress.style.display = "block";
    batchLog.style.display = "block";
    batchLog.innerHTML = "";
    batchProgressFill.style.width = "0%";
    batchProgressText.textContent = `0 / ${validEntries.length}`;

    const zip = new JSZip();
    const usedNames = new Map();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validEntries.length; i++) {

        const entry = validEntries[i];
        const label = entry.name || "Unnamed";
        const warningSuffix = entry.warnings && entry.warnings.length
            ? ` — ⚠ ${entry.warnings.join(" ")}`
            : "";

        batchGenerateBtn.textContent = `Generating ${i + 1}/${validEntries.length}...`;

        try {

            const response = await fetch("/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entry.state)
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const blob = await response.blob();

            let fileName = sanitizeFileName(label);
            const priorCount = usedNames.get(fileName) || 0;

            usedNames.set(fileName, priorCount + 1);

            // Same name appears more than once in the sheet — number the
            // repeats instead of one silently overwriting another in the zip.
            if (priorCount > 0) {
                fileName = `${fileName}_${priorCount + 1}`;
            }

            zip.file(`${fileName}.xlsx`, blob);
            successCount++;

            batchLog.innerHTML += `<div class="summary-item">✅ ${label}${warningSuffix}</div>`;

        } catch (err) {

            console.error(`Batch row failed (${label}):`, err);
            failCount++;

            batchLog.innerHTML += `<div class="summary-item" style="color:var(--red);">❌ ${label} — ${err.message}</div>`;

        }

        const pct = Math.round(((i + 1) / validEntries.length) * 100);

        batchProgressFill.style.width = `${pct}%`;
        batchProgressText.textContent = `${i + 1} / ${validEntries.length}`;

    }

    if (successCount > 0) {

        batchGenerateBtn.textContent = "Packaging ZIP...";

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().split("T")[0];

        a.href = url;
        a.download = `SOA_Batch_${stamp}.zip`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);

    }

    batchGenerateBtn.disabled = false;
    batchGenerateBtn.textContent = "📦 Generate Batch (ZIP)";

    showToast(
        failCount === 0
            ? `Batch complete — ${successCount} file(s) zipped.`
            : `Batch finished with errors — ${successCount} succeeded, ${failCount} failed.`,
        failCount === 0 ? "success" : "warning"
    );

}

if (batchGenerateBtn) {
    batchGenerateBtn.addEventListener("click", generateBatch);
}