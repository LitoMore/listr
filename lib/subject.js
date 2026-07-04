const toObserver = (next, error, complete) => {
	if (typeof next === 'object' && next !== null) {
		return next;
	}

	return {next, error, complete};
};

class Subject {
	constructor() {
		this._observers = new Set();
		this._isComplete = false;
	}

	subscribe(next, error, complete) {
		const observer = toObserver(next, error, complete);

		if (this._isComplete) {
			if (typeof observer.complete === 'function') {
				observer.complete();
			}

			return {
				unsubscribe() {},
			};
		}

		this._observers.add(observer);

		return {
			unsubscribe: () => {
				this._observers.delete(observer);
			},
		};
	}

	next(value) {
		if (this._isComplete) {
			return;
		}

		for (const observer of this._observers) {
			if (typeof observer.next === 'function') {
				observer.next(value);
			}
		}
	}

	error(error) {
		if (this._isComplete) {
			return;
		}

		for (const observer of this._observers) {
			if (typeof observer.error === 'function') {
				observer.error(error);
			}
		}

		this.complete();
	}

	complete() {
		if (this._isComplete) {
			return;
		}

		this._isComplete = true;

		for (const observer of this._observers) {
			if (typeof observer.complete === 'function') {
				observer.complete();
			}
		}

		this._observers.clear();
	}
}

export default Subject;
