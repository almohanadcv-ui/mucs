const baseConfig = require("@mica-mab/config/eslint-base");

module.exports = [...baseConfig, { ignores: ["dist/**"] }];
