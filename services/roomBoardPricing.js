function getRoomBoardPrices(claim) {

    const hasLab = claim.hasLab;
    const hasEpo = claim.hasEpo;
    const epoType = (claim.epoType || "alfa").toLowerCase();

    // Beta has no double-dose pricing tier — clamp to 1 regardless of what
    // the client sent, so a bypassed/stale frontend can't fall through to
    // the wrong bracket (or the no-epo fallback) below.
    let epoQty = Number(claim.epoQty || 0);
    if (epoType === "beta" && epoQty > 1) {
        epoQty = 1;
    }

    // NO EPO + NO LAB
    if (!hasEpo && !hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 1750.00,
            rentalUtilities: 1750.00,
            adminCost: 1162.50
        };
    }

    // NO EPO + LAB
    if (!hasEpo && hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 950.00,
            rentalUtilities: 950.00,
            adminCost: 762.50
        };
    }

    // SINGLE DOSE ALFA + NO LAB
    if (hasEpo && epoType === "alfa" && epoQty === 1 && !hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 1500.00,
            rentalUtilities: 1500.00,
            adminCost: 787.50
        };
    }

    // SINGLE DOSE ALFA + LAB
    if (hasEpo && epoType === "alfa" && epoQty === 1 && hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 700.00,
            rentalUtilities: 700.00,
            adminCost: 387.50
        };
    }

    // SINGLE DOSE BETA + NO LAB
    if (hasEpo && epoType === "beta" && epoQty === 1 && !hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 1250.00,
            rentalUtilities: 1250.00,
            adminCost: 662.50
        };
    }

    // SINGLE DOSE BETA + LAB
    if (hasEpo && epoType === "beta" && epoQty === 1 && hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 450.00,
            rentalUtilities: 450.00,
            adminCost: 262.50
        };
    }

    // DOUBLE DOSE ALFA + NO LAB
    if (hasEpo && epoType === "alfa" && epoQty === 2 && !hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 1250.00,
            rentalUtilities: 1250.00,
            adminCost: 412.50
        };
    }

    // DOUBLE DOSE ALFA + LAB
    if (hasEpo && epoType === "alfa" && epoQty === 2 && hasLab) {
        return {
            roomUseMachine: 500.00,
            personnelCost: 350.00,
            rentalUtilities: 350.00,
            adminCost: 212.50
        };
    }
    // // DOUBLE DOSE BETA + NO LAB
    // if (hasEpo && epoType === "beta" && epoQty === 2 && !hasLab) {
    //     return {
    //         roomUseMachine: 500.00,
    //         personnelCost: /* need correct value */,
    //         rentalUtilities: /* need correct value */,
    //         adminCost: /* need correct value */,
    //     };
    // }

    // // DOUBLE DOSE BETA + LAB
    // if (hasEpo && epoType === "beta" && epoQty === 2 && hasLab) {
    //     return {
    //         roomUseMachine: 500.00,
    //         personnelCost: /* need correct value */,
    //         rentalUtilities: /* need correct value */,
    //         adminCost: /* need correct value */,
    //     };
    // }

    // Fallback
    return {
        roomUseMachine: 500.00,
        personnelCost: 1750.00,
        rentalUtilities: 1750.00,
        adminCost: 1162.50
    };

}

module.exports = {
    getRoomBoardPrices
};