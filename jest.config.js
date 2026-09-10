module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  forceExit: true,
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/dashboard/"],
};
