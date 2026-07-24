/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../worker-configuration.d.ts" />

declare global {
	namespace App {
		interface Platform {
			env: Env;
		}
	}
}

export {};
