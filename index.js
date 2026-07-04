import React, {useLayoutEffect, useMemo, useState} from 'react';
import pMap from 'p-map';
import TaskModel from './lib/task.js';
import TaskWrapper from './lib/task-wrapper.js';
import {getRenderer} from './lib/renderer.js';
import {TaskTree, hasPendingTask, useSpinnerFrame} from './lib/ink-renderer.js';
import ListrError from './lib/listr-error.js';

const h = React.createElement;

const runTask = (task, context, errors) => {
	if (!task.isEnabled()) {
		return Promise.resolve();
	}

	return new TaskWrapper(task, errors).run(context);
};

class Listr {
	_renderer;

	constructor(tasks, options) {
		if (tasks && !Array.isArray(tasks) && typeof tasks === 'object') {
			if (typeof tasks.title === 'string' && typeof tasks.task === 'function') {
				throw new TypeError('Expected an array of tasks or an options object, got a task object');
			}

			options = tasks;
			tasks = [];
		}

		if (tasks && !Array.isArray(tasks)) {
			throw new TypeError('Expected an array of tasks');
		}

		this._options = {
			showSubtasks: true,
			concurrent: false,
			renderer: 'default',
			nonTTYRenderer: 'verbose',
			...options,
		};
		this._tasks = [];

		this.concurrency = 1;
		if (this._options.concurrent === true) {
			this.concurrency = Infinity;
		} else if (typeof this._options.concurrent === 'number') {
			this.concurrency = this._options.concurrent;
		}

		this._RendererClass = getRenderer(this._options.renderer, this._options.nonTTYRenderer);

		this.exitOnError = this._options.exitOnError;

		this.add(tasks || []);
	}

	#checkAll(context) {
		for (const task of this._tasks) {
			task.check(context);
		}
	}

	get tasks() {
		return this._tasks;
	}

	setRenderer(value) {
		this._RendererClass = getRenderer(value);
	}

	add(task) {
		const tasks = Array.isArray(task) ? task : [task];

		for (const taskDefinition of tasks) {
			this._tasks.push(new TaskModel(this, taskDefinition, this._options));
		}

		return this;
	}

	render() {
		this._renderer ||= new this._RendererClass(this._tasks, this._options);

		return this._renderer.render();
	}

	run(context) {
		this.render();

		context ||= Object.create(null);

		const errors = [];

		this.#checkAll(context);

		const tasks = pMap(this._tasks, task => {
			this.#checkAll(context);
			return runTask(task, context, errors);
		}, {concurrency: this.concurrency});

		return tasks
			.then(async () => {
				if (errors.length > 0) {
					const error = new ListrError('Something went wrong');
					error.errors = errors;
					throw error;
				}

				await this._renderer.end();

				return context;
			})
			.catch(async error => {
				error.context = context;
				await this._renderer.end(error);
				throw error;
			});
	}
}

const subscribeTaskTree = (tasks, onChange) => {
	const subscriptions = new Set();
	const subscribedTasks = new Set();

	const subscribe = taskList => {
		for (const task of taskList) {
			if (subscribedTasks.has(task)) {
				continue;
			}

			subscribedTasks.add(task);

			const subscription = task.subscribe(event => {
				if (event.type === 'SUBTASKS') {
					subscribe(task.subtasks);
				}

				onChange();
			});

			subscriptions.add(subscription);
		}
	};

	subscribe(tasks);

	return () => {
		for (const subscription of subscriptions) {
			subscription.unsubscribe();
		}
	};
};

const createTaskDefinitions = children => React.Children.toArray(children)
	.filter(child => child && (typeof child !== 'string' || child.trim() !== ''))
	.map(child => {
		if (!React.isValidElement(child)) {
			throw new TypeError('Expected task children to be <Task> elements');
		}

		const {title, task, skip, enabled, concurrent, children: taskChildren} = child.props;
		const nestedTasks = typeof taskChildren === 'function' ? [] : createTaskDefinitions(taskChildren);
		const taskFunction = task || (typeof taskChildren === 'function' ? taskChildren : undefined) || (() => new Listr(nestedTasks, {concurrent}));

		return {
			title,
			task: taskFunction,
			skip,
			enabled,
		};
	});

export function Task() {
	return null;
}

export const TaskList = ({
	children,
	context,
	concurrent = false,
	exitOnError,
	showSubtasks = true,
	collapse = true,
	onComplete,
	onError,
}) => {
	const [version, setVersion] = useState(0);
	const taskDefinitions = useMemo(() => createTaskDefinitions(children), [children]);
	const list = useMemo(() => new Listr(taskDefinitions, {
		concurrent,
		exitOnError,
		renderer: 'silent',
		showSubtasks,
	}), [taskDefinitions, concurrent, exitOnError, showSubtasks]);
	const [runError, setRunError] = useState({});
	const pending = hasPendingTask(list.tasks);
	const frame = useSpinnerFrame(pending);

	useLayoutEffect(() => {
		const unsubscribe = subscribeTaskTree(list.tasks, () => {
			setVersion(currentVersion => currentVersion + 1);
		});
		let isMounted = true;

		list.run(context)
			.then(result => {
				if (isMounted && onComplete) {
					onComplete(result);
				}
			})
			.catch(error => {
				if (!isMounted) {
					return;
				}

				if (onError) {
					onError(error);
					return;
				}

				setRunError({
					list,
					error,
				});
			});

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [list, context, onComplete, onError]);

	if (runError.list === list) {
		throw runError.error;
	}

	return h(TaskTree, {
		tasks: list.tasks,
		frame: frame + version,
		options: {
			showSubtasks,
			collapse,
		},
	});
};

export default Listr;
