import {Writable} from 'node:stream';
import React from 'react';
import test from 'ava';
import {render, useApp} from 'ink';
import {Task, TaskList} from '../index.js';

const h = React.createElement;

const createOutput = () => {
	let output = '';
	const stream = new Writable({
		write(chunk, encoding, callback) {
			output += chunk.toString();
			callback();
		},
	});

	return {
		stream,
		get output() {
			return output;
		},
	};
};

const App = ({onComplete}) => {
	const {exit} = useApp();

	return h(
		TaskList,
		{
			onComplete(context) {
				onComplete(context);
				setTimeout(exit, 50);
			},
			onError: exit,
		},
		h(Task, {
			title: 'first',
			task(context) {
				context.value = 'ok';
			},
		}),
		h(
			Task,
			{
				title: 'group',
				concurrent: true,
			},
			h(Task, {
				title: 'nested',
				task() {},
			}),
		),
	);
};

test.serial('component API runs tasks in Ink', async t => {
	const output = createOutput();
	let context;

	const instance = render(h(App, {
		onComplete(result) {
			context = result;
		},
	}), {
		stdout: output.stream,
		interactive: false,
	});

	await instance.waitUntilExit();

	t.deepEqual(context, {
		value: 'ok',
	});
	t.true(output.output.includes('[done] first'));
	t.true(output.output.includes('[done] group'));
});
