import {isStream as objectIsStream} from 'is-stream';
import objectIsObservable from 'is-observable';

// RxJS@6 symbol (https://github.com/sindresorhus/is-observable/issues/1#issuecomment-387843191)
const symbolObservable = (typeof Symbol === 'function' && Symbol.observable) || '@@observable';

export const isObservable = object => {
	if (!object) {
		return objectIsObservable(object);
	}

	const observable = object[symbolObservable];

	return Boolean(observable && object === observable.call(object)) || objectIsObservable(object);
};

export const isListr = object => Boolean(object && object.setRenderer && object.add && object.run);
export const isStream = object => objectIsStream(object) && !isObservable(object);
