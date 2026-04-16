import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import recommendedConfig from "eslint-plugin-prettier/recommended";

export default defineConfig([
  recommendedConfig,
  {
    ignores: ["dist/*", "node_modules/*"],
  },
  { files: ["**/*.js"], plugins: { js }, extends: ["js/recommended"] },

  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "no-console": "warn",
      semi: ["error", "always"],
      quotes: ["error", "double"],
    },
  },
]);
