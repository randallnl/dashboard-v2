/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../worker-configuration.d.ts" />
/// <reference path="../cron-worker-configuration.d.ts" />

import type { AuthenticatedSession } from '$lib/server/auth/types';

declare global {
	namespace App {
		interface Error {
			message: string;
			requestId?: string;
		}

		interface Locals {
			session: AuthenticatedSession | null;
			requestId: string;
		}

		interface Platform {
			env: Env;
			ctx: ExecutionContext;
		}
	}
}

export {};
