import tslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import eslint_js from "@eslint/js";
import eslint_prettier from "eslint-config-prettier";

export default [
  { files: ["**/*"] },
  {
    // default files for all configs
    ignores: [
      "**/cdk.out",
      "**/.yarn",
      "**/node_modules",
      "**/ts-out",
      "**/.pnp.*",
      "packages/cdk/client-app",
      "packages/client/dist",
      "packages/cdk/lib/App/*.handler.js",
    ],
  },
  {
    plugins: {
      tslint,
    },
    languageOptions: {
      ecmaVersion: 2021,
      parser,
      sourceType: "commonjs",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
  eslint_js.configs.recommended,
  {
    rules: {
      "no-useless-rename": "error",
    },
  },
  // Override any previously-set style rules
  { rules: eslint_prettier.rules },
];
