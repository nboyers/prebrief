import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import globals from "globals";

const electronGlobals = { Electron: "readonly" };

export default [
	{
		ignores: ["dist/**", "out/**", "node_modules/**"],
	},
	js.configs.recommended,
	{
		files: ["src/main/**/*.ts", "src/preload/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: { ...globals.node, ...electronGlobals },
		},
		plugins: { "@typescript-eslint": tseslint },
		rules: {
			...tseslint.configs.recommended.rules,
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
	{
		files: ["src/renderer/**/*.{ts,tsx}", "src/shared/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				ecmaFeatures: { jsx: true },
			},
			globals: { ...globals.browser },
		},
		plugins: { "@typescript-eslint": tseslint },
		rules: {
			...tseslint.configs.recommended.rules,
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
	{
		files: ["vite.config.ts", "eslint.config.js"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { ecmaVersion: "latest", sourceType: "module" },
			globals: { ...globals.node },
		},
		plugins: { "@typescript-eslint": tseslint },
		rules: {
			...tseslint.configs.recommended.rules,
		},
	},
	prettier,
];
