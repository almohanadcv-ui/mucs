const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");

/** Shared base ESLint flat config used by both apps/api and apps/web. */
module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["**/*.config.js", "**/*.config.cjs"],
    languageOptions: {
      globals: { require: "readonly", module: "readonly", __dirname: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "coverage/**"],
  },
);
