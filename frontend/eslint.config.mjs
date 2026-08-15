import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXOpeningElement[name.name='input']", message: "Use a shared control from components/ui instead of a native input." },
        { selector: "JSXOpeningElement[name.name='select']", message: "Use SelectControl or SearchableSelect instead of a native select." },
        { selector: "JSXOpeningElement[name.name='textarea']", message: "Use TextareaControl instead of a native textarea." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
