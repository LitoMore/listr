import process from 'node:process';
import React from 'react';
import {render, useApp} from 'ink';
import {Task, TaskList} from '../index.js';

const delay = milliseconds => new Promise(resolve => {
	setTimeout(resolve, milliseconds);
});

function App() {
	const {exit} = useApp();

	return (
		<TaskList
			context={{packageManager: 'npm'}}
			onComplete={context => {
				console.log(`Done with ${context.packageManager}`);
				setTimeout(exit, 50);
			}}
			onError={error => {
				console.error(error.message);
				exit(error);
			}}
		>
			<Task
				title='Read package metadata'
				task={async (context, task) => {
					task.output = 'Loading package.json';
					await delay(300);

					context.packageName = 'listr';
					task.output = `Package: ${context.packageName}`;
					await delay(300);
				}}
			/>
			<Task concurrent title='Run checks'>
				<Task
					title='Lint'
					task={async (context, task) => {
						task.output = 'xo';
						await delay(600);
					}}
				/>
				<Task
					title='Unit tests'
					task={async (context, task) => {
						task.output = 'ava';
						await delay(700);
					}}
				/>
			</Task>
			<Task
				title='Publish with pnpm'
				skip={context => context.packageManager !== 'pnpm' && 'Current package manager is npm'}
				task={async () => {
					await delay(300);
				}}
			/>
		</TaskList>
	);
}

render(<App/>, {
	interactive: process.stdout.isTTY,
});
