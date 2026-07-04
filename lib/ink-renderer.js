import process from 'node:process';
import {Writable} from 'node:stream';
import React, {useLayoutEffect, useState} from 'react';
import {
	Box,
	Static,
	Text,
	render as renderInk,
} from 'ink';

const h = React.createElement;

const spinnerFrames = ['-', '\\', '|', '/'];

let taskId = 0;
let logId = 0;
const taskIds = new WeakMap();

const getTaskId = task => {
	if (!taskIds.has(task)) {
		taskIds.set(task, taskId++);
	}

	return taskIds.get(task);
};

const isDefined = value => value !== null && value !== undefined;

const createStdoutProxy = stdout => {
	const stream = new Writable({
		write(chunk, encoding, callback) {
			stdout.write(chunk, encoding, callback);
		},
	});

	for (const property of ['columns', 'rows', 'isTTY']) {
		Object.defineProperty(stream, property, {
			get() {
				return stdout[property];
			},
		});
	}

	return stream;
};

const normalizeOutput = data => {
	if (typeof data !== 'string') {
		return data;
	}

	const output = data.trim().split('\n').findLast(Boolean);

	return output === '' ? undefined : output;
};

export const hasPendingTask = tasks => tasks.some(task => task.isPending() || hasPendingTask(task.subtasks));

const getStatus = (task, frame, options) => {
	if (task.isPending()) {
		return options.showSubtasks !== false && task.subtasks.length > 0 ? '>' : spinnerFrames[frame % spinnerFrames.length];
	}

	if (task.isCompleted()) {
		return 'done';
	}

	if (task.hasFailed()) {
		return 'fail';
	}

	if (task.isSkipped()) {
		return 'skip';
	}

	return ' ';
};

const getStatusColor = task => {
	if (task.isCompleted()) {
		return 'green';
	}

	if (task.hasFailed()) {
		return 'red';
	}

	if (task.isSkipped()) {
		return 'yellow';
	}

	if (task.isPending()) {
		return 'cyan';
	}

	return undefined;
};

const shouldRenderSubtasks = (task, options) => (
	task.subtasks.length > 0
	&& (task.isPending() || task.hasFailed() || options.collapse === false)
	&& (task.hasFailed() || options.showSubtasks !== false)
);

const shouldRenderOutput = task => (
	(task.isPending() || task.isSkipped() || task.hasFailed())
	&& isDefined(normalizeOutput(task.output))
);

const TaskOutput = ({task, level}) => h(
	Box,
	{
		paddingLeft: (level * 2) + 3,
	},
	h(
		Text,
		{
			dimColor: true,
			wrap: 'truncate-end',
		},
		`> ${normalizeOutput(task.output)}`,
	),
);

const TaskLine = ({task, level, frame, options}) => h(
	Box,
	{
		paddingLeft: level * 2,
	},
	h(
		Text,
		{
			color: getStatusColor(task),
			dimColor: !task.isPending() && !task.isCompleted() && !task.hasFailed() && !task.isSkipped(),
		},
		`[${getStatus(task, frame, options).padEnd(4)}] `,
	),
	h(
		Text,
		{
			dimColor: task.isSkipped(),
			wrap: 'truncate-end',
		},
		task.title,
	),
	task.isSkipped()
		? h(
			Text,
			{
				dimColor: true,
			},
			' [skipped]',
		)
		: null,
);

export const TaskTree = ({tasks, level = 0, frame, options}) => h(
	Box,
	{
		flexDirection: 'column',
	},
	tasks.filter(task => task.isEnabled()).map(task => h(
		React.Fragment,
		{
			key: getTaskId(task),
		},
		h(TaskLine, {
			task, level, frame, options,
		}),
		shouldRenderOutput(task) ? h(TaskOutput, {task, level}) : null,
		shouldRenderSubtasks(task, options)
			? h(TaskTree, {
				tasks: task.subtasks,
				level: level + 1,
				frame,
				options,
			})
			: null,
	)),
);

export const useSpinnerFrame = enabled => {
	const [frame, setFrame] = useState(0);

	useLayoutEffect(() => {
		if (!enabled) {
			return undefined;
		}

		const timer = setInterval(() => {
			setFrame(currentFrame => currentFrame + 1);
		}, 100);

		return () => {
			clearInterval(timer);
		};
	}, [enabled]);

	return frame;
};

const MainApp = ({tasks, options, subscribe}) => {
	const [version, setVersion] = useState(0);
	const pending = hasPendingTask(tasks);
	const frame = useSpinnerFrame(pending);

	useLayoutEffect(() => subscribe(() => {
		setVersion(currentVersion => currentVersion + 1);
	}), [subscribe]);

	return h(TaskTree, {tasks, frame: frame + version, options});
};

const formatTimestamp = date => {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${hours}:${minutes}:${seconds}`;
};

const createLog = (message, options) => ({
	id: logId++,
	message,
	timestamp: options.dateFormat === false ? undefined : formatTimestamp(new Date()),
});

const getVerboseLogs = (task, event, options) => {
	if (event.type === 'STATE') {
		const state = task.isPending() ? 'started' : task.state;
		const logs = [createLog(`${task.title} [${state}]`, options)];

		if (task.isSkipped() && task.output) {
			logs.push(createLog(`> ${task.output}`, options));
		}

		return logs;
	}

	if (event.type === 'DATA') {
		return [createLog(`> ${event.data}`, options)];
	}

	if (event.type === 'TITLE') {
		return [createLog(`${task.title} [title changed]`, options)];
	}

	return [];
};

const VerboseLog = ({log}) => h(
	Text,
	null,
	log.timestamp
		? h(
			Text,
			{
				dimColor: true,
			},
			`[${log.timestamp}] `,
		)
		: null,
	log.message,
);

const VerboseApp = ({subscribe}) => {
	const [logs, setLogs] = useState([]);

	useLayoutEffect(() => subscribe(newLogs => {
		setLogs(currentLogs => [...currentLogs, ...newLogs]);
	}), [subscribe]);

	return h(
		Static,
		{
			items: logs,
		},
		log => h(VerboseLog, {
			key: log.id,
			log,
		}),
	);
};

class BaseInkRenderer {
	constructor(tasks, options) {
		this._tasks = tasks;
		this._subscriptions = new Set();
		this._subscribedTasks = new Set();
		this._options = {
			stdout: process.stdout,
			stdin: process.stdin,
			stderr: process.stderr,
			...options,
		};
		this._stdout = createStdoutProxy(this._options.stdout);
	}

	_subscribeTasks(tasks, onEvent) {
		for (const task of tasks) {
			if (this._subscribedTasks.has(task)) {
				continue;
			}

			this._subscribedTasks.add(task);

			const subscription = task.subscribe(
				event => {
					if (event.type === 'SUBTASKS') {
						this._subscribeTasks(task.subtasks, onEvent);
					}

					onEvent(task, event);
				},
				error => {
					onEvent(task, {
						type: 'DATA',
						data: error.message,
					});
				},
			);

			this._subscriptions.add(subscription);
		}
	}

	_unsubscribe() {
		for (const subscription of this._subscriptions) {
			subscription.unsubscribe();
		}

		this._subscriptions.clear();
		this._subscribedTasks.clear();
	}

	async _unmount() {
		if (!this._instance) {
			this._unsubscribe();
			return;
		}

		await this._instance.waitUntilRenderFlush();
		this._instance.unmount();
		await this._instance.waitUntilExit();
		this._instance = undefined;
		this._unsubscribe();
	}
}

export class MainRenderer extends BaseInkRenderer {
	constructor(tasks, options) {
		super(tasks, {
			showSubtasks: true,
			collapse: true,
			clearOutput: false,
			...options,
		});

		this._subscribe = onChange => {
			this._subscribeTasks(this._tasks, onChange);

			return () => {
				this._unsubscribe();
			};
		};
	}

	render() {
		if (this._instance) {
			return;
		}

		this._instance = renderInk(
			h(MainApp, {
				tasks: this._tasks,
				options: this._options,
				subscribe: this._subscribe,
			}),
			{
				stdout: this._stdout,
				stdin: this._options.stdin,
				stderr: this._options.stderr,
				patchConsole: this._options.patchConsole,
			},
		);
	}

	async end(error) {
		if (this._instance && this._options.clearOutput && error === undefined) {
			this._instance.rerender(null);
		}

		await this._unmount();
	}
}

export class VerboseRenderer extends BaseInkRenderer {
	static get nonTTY() {
		return true;
	}

	constructor(tasks, options) {
		super(tasks, {
			dateFormat: 'HH:mm:ss',
			...options,
		});

		this._subscribe = onLogs => {
			this._subscribeTasks(this._tasks, (task, event) => {
				const logs = getVerboseLogs(task, event, this._options);

				if (logs.length > 0) {
					onLogs(logs);
				}
			});

			return () => {
				this._unsubscribe();
			};
		};
	}

	render() {
		if (this._instance) {
			return;
		}

		this._instance = renderInk(
			h(VerboseApp, {
				subscribe: this._subscribe,
			}),
			{
				stdout: this._stdout,
				stdin: this._options.stdin,
				stderr: this._options.stderr,
				interactive: false,
				patchConsole: this._options.patchConsole ?? false,
			},
		);
	}

	async end() {
		await this._unmount();
	}
}

export class SilentRenderer {
	static get nonTTY() {
		return true;
	}

	render() {}

	end() {}
}
