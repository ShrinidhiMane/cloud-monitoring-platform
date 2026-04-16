import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import recommendedConfig from "eslint-plugin-prettier/recommended";

export default defineConfig([
  globalIgnores(["dist"]),
  recommendedConfig,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
      "no-console": "warn",
    },
  },
  {
    languageOptions: {
      globals: {
        fetch: "false",
        RequestInit: true,
      },
    },
  },
]);
