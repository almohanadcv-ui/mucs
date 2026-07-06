const nestjsConfig = require("@mica-mab/config/eslint-nestjs");

module.exports = [...nestjsConfig, { ignores: ["dist/**"] }];
