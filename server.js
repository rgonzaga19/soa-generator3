const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use("/generate", require("./routes/generate"));

let serverInstance;

// Starts the Express server and resolves once it's listening.
function start(port = 3000) {
    return new Promise((resolve) => {
        serverInstance = app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
            resolve(serverInstance);
        });
    });
}

// Gracefully stops the server.
function stop() {
    if (serverInstance) {
        serverInstance.close(() => {
            console.log("Express server stopped.");
        });
    }
}

// Allow running directly with: node server.js
if (require.main === module) {
    start();
}

module.exports = {
    start,
    stop
};