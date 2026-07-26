/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../worker-configuration.d.ts" />

import type { AuthenticatedSession } from '$lib/server/auth/types';

declare global {
	namespace App {
		interface Locals {
			session: AuthenticatedSession | null;
		}

		interface Platform {
			env: Env;
			ctx: ExecutionContext;
		}
	}
}

export {};
