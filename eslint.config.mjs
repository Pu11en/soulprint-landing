import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        // Ignore scripts directory (utility scripts, not production code)
        "scripts/**",
    ]),
    // Custom rule overrides for production build
    {
        rules: {
            // Downgrade strict TypeScript rules to warnings
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-require-imports": "warn",
            // Downgrade React rules that are often false positives
            "react/no-unescaped-entities": "warn",
            "react-hooks/exhaustive-deps": "warn",
            // Disable experimental React 19 rules that cause issues
            "react-hooks/immutability": "off",
            "react-hooks/set-state-in-effect": "off",
            // Style rules
            "prefer-const": "warn",
        },
    },
]);

export default eslintConfig;
