import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import recommendedConfig from "eslint-plugin-prettier/recommended";
import globals from "globals";
export default defineConfig([
  recommendedConfig,
  {
    ignores: ["dist/*", "node_modules/*"],
  },
  {
    files: ["**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-undef": "warn",
      "no-console": "off",
      semi: ["error", "always"],
      quotes: ["error", "double"],
    },
  },
]);
