import {fixupConfigRules} from '@eslint/compat';
import xoReact from 'eslint-config-xo-react';

export default [
	...fixupConfigRules(xoReact()),
	{
		rules: {
			'prefer-destructuring': 'off',
			'promise/prefer-await-to-then': 'off',
			'unicorn/default-export-style': 'off',
			'unicorn/no-nonstandard-builtin-properties': 'off',
			'unicorn/no-undeclared-class-members': 'off',
			'unicorn/prefer-promise-try': 'off',
			'unicorn/prefer-private-class-fields': 'off',
		},
	},
];
