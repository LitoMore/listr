import process from 'node:process';
import React from 'react';
import {render, useApp} from 'ink';
import {Task, TaskList} from '../index.js';

const h = React.createElement;

const delay = milliseconds => new Promise(resolve => {
	setTimeout(resolve, milliseconds);
});

const App = () => {
	const {exit} = useApp();

	return h(
		TaskList,
		{
			onComplete() {
				setTimeout(exit, 50);
			},
			onError(error) {
				console.error(error.message);
				exit(error);
			},
		},
		h(Task, {
			title: 'Read project metadata',
			async task(context, task) {
				task.output = 'Opening package.json';
				await delay(350);

				context.packageManager = 'npm';
				task.output = 'Detected npm workspace';
				await delay(350);
			},
		}),
		h(
			Task,
			{
				title: 'Prepare checks',
				concurrent: true,
			},
			h(Task, {
				title: 'Resolve dependencies',
				async task(context, task) {
					task.output = 'Using installed node_modules';
					await delay(600);
				},
			}),
			h(Task, {
				title: 'Warm cache',
				async task(context, task) {
					task.output = 'Priming lint and test cache';
					await delay(500);
				},
			}),
		),
		h(Task, {
			title: 'Run pnpm-specific check',
			skip: context => context.packageManager !== 'pnpm' && 'This example detected npm',
			async task() {
				await delay(300);
			},
		}),
		h(Task, {
			title: 'Run test command',
			async task(context, task) {
				task.output = 'npm test';
				await delay(700);

				task.title = 'Run test command (simulated)';
				task.output = '43 tests passed';
				await delay(300);
			},
		}),
	);
};

render(h(App), {
	interactive: process.stdout.isTTY,
});
