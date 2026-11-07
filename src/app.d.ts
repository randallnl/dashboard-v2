/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../worker-configuration.d.ts" />
/// <reference path="../cron-worker-configuration.d.ts" />
/// <reference path="../drive-worker-configuration.d.ts" />
/// <reference path="../receipt-worker-configuration.d.ts" />

import type { AuthenticatedSession } from '$lib/server/auth/types';

declare global {
	interface Env {
		COLAB_DISCORD_PUBLIC_KEY: string;
		COLAB_DISCORD_CHANNEL_ID: string;
		CALENDAR_CAMPAIGN_ASSETS?: R2Bucket;
		SHOPIFY_CALENDAR_URL?: string;
	}

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
