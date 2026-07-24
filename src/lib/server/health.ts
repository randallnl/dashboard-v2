export type BindingStatus = {
	configured: boolean;
};

export type HealthResponse = {
	status: 'ok';
	service: 'dashboard-v2';
	environment: string;
	bindings: {
		DB: BindingStatus;
		MONDAY_API_TOKEN: BindingStatus;
		EMAIL: BindingStatus;
		LOGIN_FROM_EMAIL: BindingStatus;
		LOGIN_FROM_NAME: BindingStatus;
	};
};

type BindingName = 'DB' | 'MONDAY_API_TOKEN' | 'EMAIL' | 'LOGIN_FROM_EMAIL' | 'LOGIN_FROM_NAME';

function runtimeBindings(env: unknown): Record<string, unknown> {
	return typeof env === 'object' && env !== null ? (env as Record<string, unknown>) : {};
}

function hasBinding(env: Record<string, unknown>, name: BindingName): boolean {
	return env[name] !== undefined && env[name] !== '';
}

export function getHealth(input: unknown): HealthResponse {
	const env = runtimeBindings(input);

	return {
		status: 'ok',
		service: 'dashboard-v2',
		environment: typeof env.ENVIRONMENT === 'string' ? env.ENVIRONMENT : 'unknown',
		bindings: {
			DB: { configured: hasBinding(env, 'DB') },
			MONDAY_API_TOKEN: { configured: hasBinding(env, 'MONDAY_API_TOKEN') },
			EMAIL: { configured: hasBinding(env, 'EMAIL') },
			LOGIN_FROM_EMAIL: { configured: hasBinding(env, 'LOGIN_FROM_EMAIL') },
			LOGIN_FROM_NAME: { configured: hasBinding(env, 'LOGIN_FROM_NAME') }
		}
	};
}
