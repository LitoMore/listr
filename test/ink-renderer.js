import {Writable} from 'node:stream';
import test from 'ava';
import Listr from '../index.js';

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

test.serial('verbose renderer renders task events with Ink', async t => {
	const output = createOutput();
	const list = new Listr([
		{
			title: 'foo',
			task(context, task) {
				task.output = 'bar';
			},
		},
	], {
		dateFormat: false,
		renderer: 'verbose',
		stdout: output.stream,
	});

	await list.run();

	t.true(output.output.includes('foo [started]\n'));
	t.true(output.output.includes('> bar\n'));
	t.true(output.output.includes('foo [completed]\n'));
});

test.serial('silent renderer does not render output', async t => {
	const output = createOutput();
	const list = new Listr([
		{
			title: 'foo',
			task(context, task) {
				task.output = 'bar';
			},
		},
	], {
		renderer: 'silent',
		stdout: output.stream,
	});

	await list.run();

	t.is(output.output, '');
});
