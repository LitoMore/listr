import process from 'node:process';
import {MainRenderer, SilentRenderer, VerboseRenderer} from './ink-renderer.js';

const renderers = {
	default: MainRenderer,
	main: MainRenderer,
	silent: SilentRenderer,
	verbose: VerboseRenderer,
};

const isRendererSupported = renderer => process.stdout.isTTY === true || renderer.nonTTY === true;

const getRendererClass = renderer => {
	if (typeof renderer === 'string') {
		return renderers[renderer] || renderers.main;
	}

	return typeof renderer === 'function' ? renderer : renderers.main;
};

export const getRenderer = (renderer, fallbackRenderer) => {
	let returnValue = getRendererClass(renderer);

	if (!isRendererSupported(returnValue)) {
		returnValue = getRendererClass(fallbackRenderer);

		if (!returnValue || !isRendererSupported(returnValue)) {
			returnValue = renderers.verbose;
		}
	}

	return returnValue;
};
