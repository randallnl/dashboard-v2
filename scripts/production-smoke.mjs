const baseUrl = new URL(
	process.argv[2] ??
		process.env.DASHBOARD_BASE_URL ??
		'https://dashboard-v2.randall-d53.workers.dev'
);
const release = process.env.RELEASE_SHA ?? `smoke-${Date.now()}`;
const securityHeaders = [
	'permissions-policy',
	'referrer-policy',
	'x-content-type-options',
	'x-frame-options',
	'x-request-id'
];

async function request(path) {
	const url = new URL(path, baseUrl);
	url.searchParams.set('release', release);
	return fetch(url, {
		headers: { 'cache-control': 'no-cache' },
		redirect: 'manual'
	});
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function checkHeaders(response, label) {
	for (const header of securityHeaders) {
		assert(response.headers.has(header), `${label} is missing ${header}`);
	}
}

async function run() {
	const homepage = await request('/');
	assert(homepage.status === 200, `homepage returned ${homepage.status}`);
	checkHeaders(homepage, 'homepage');

	const health = await request('/api/health');
	assert(health.status === 200, `health endpoint returned ${health.status}`);
	checkHeaders(health, 'health endpoint');
	const healthBody = await health.json();
	assert(healthBody.status === 'ok', 'health endpoint did not report ok');
	for (const [name, status] of Object.entries(healthBody.bindings ?? {})) {
		assert(status?.configured === true, `${name} binding is not configured`);
	}

	const protectedEndpoint = await request('/api/member');
	assert(
		protectedEndpoint.status === 401,
		`protected endpoint returned ${protectedEndpoint.status}, expected 401`
	);
	checkHeaders(protectedEndpoint, 'protected endpoint');

	const missing = await request(`/release-check-${release}`);
	assert(missing.status === 404, `missing route returned ${missing.status}, expected 404`);
	checkHeaders(missing, 'missing route');
	const missingBody = await missing.text();
	assert(
		missingBody.includes('We couldn’t find that page.'),
		'custom 404 content was not rendered'
	);

	console.log(
		JSON.stringify({
			status: 'passed',
			baseUrl: baseUrl.origin,
			checks: ['homepage', 'bindings', 'authorization', 'custom-404', 'security-headers']
		})
	);
}

run().catch((cause) => {
	console.error(
		JSON.stringify({
			status: 'failed',
			message: cause instanceof Error ? cause.message : 'Unknown smoke-test failure'
		})
	);
	process.exitCode = 1;
});
