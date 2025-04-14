import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Add custom rules here
    rules: {
      // Configure @typescript-eslint/no-unused-vars to ignore variables starting with _
      "@typescript-eslint/no-unused-vars": [
        "error", // Keep the severity level (usually error or warn)
        {
          "argsIgnorePattern": "^_", // Ignore arguments starting with _
          "varsIgnorePattern": "^_"  // Ignore other variables starting with _
        }
      ]
    }
  }
];

export default eslintConfig;
