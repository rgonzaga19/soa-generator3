function validateSoa(data) {
    if (!data || !Array.isArray(data.claims) || data.claims.length < 1 || data.claims.length > 7) {
        return "Provide between 1 and 7 claims.";
    }
    for (const [index, claim] of data.claims.entries()) {
        const prefix = `Claim ${index + 1}: `;
        if (!claim || typeof claim !== "object") return prefix + "Invalid claim.";
        if (typeof claim.renderDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(claim.renderDate)) return prefix + "A valid render date is required.";
        const date = new Date(`${claim.renderDate}T00:00:00.000Z`);
        if (isNaN(date) || date.toISOString().slice(0,10) !== claim.renderDate) return prefix + "Invalid render date.";
        if (!["new", "reuse"].includes(claim.dialyzerType)) return prefix + "Choose New or Re-use Highflux Dialyzer.";
        if (!["alfa", "beta", "none"].includes(claim.epoType)) return prefix + "Choose Alfa, Beta, or None for EPO.";
        if ("hasEpoAlfa" in claim || "hasEpoBeta" in claim) return prefix + "Use a single EPO type selection.";
        for (const key of ["hasIronSucrose", "hasLab"]) {
            if (typeof claim[key] !== "boolean") return prefix + `Invalid ${key} selection.`;
        }
    }
    return null;
}
module.exports = { validateSoa };
