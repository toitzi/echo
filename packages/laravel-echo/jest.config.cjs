module.exports = {
    transform: {
        "^.+\\.tsx?$": ["ts-jest"],
    },
    extensionsToTreatAsEsm: [".ts"],
    testEnvironment: "node",
};
