import {
	ProjectEventRepository,
	ShopifyMarketSalesRepository,
	type ShopifyMarketSale
} from '$lib/server/db';
import {
	loadMemberContext,
	requireAdmin,
	requireWritableMemberView
} from '$lib/server/auth/member-context';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function numericId(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) error(400, 'Choose a valid sales report.');
	return parsed;
}

async function response(env: Env): Promise<{
	inbox: string;
	sales: ShopifyMarketSale[];
	projects: Array<{ source: string; id: string; title: string; dateValue: string }>;
}> {
	const projects = await new ProjectEventRepository(env.DB).list({ includeAdminOnly: true });
	return {
		inbox: 'shopify-sales@nhsolidarityecosystem.com',
		sales: await new ShopifyMarketSalesRepository(env.DB).list(),
		projects: projects.map((project) => ({
			source: project.source,
			id: project.id,
			title: project.title,
			dateValue: project.dateValue
		}))
	};
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireAdmin(context);
	return json(await response(env!), { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform?.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireWritableMemberView(context);
	requireAdmin(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const action = typeof body?.action === 'string' ? body.action : '';
	const id = numericId(body?.id);
	const repository = new ShopifyMarketSalesRepository(env!.DB);
	const now = new Date().toISOString();

	if (action === 'assign-project') {
		const source = typeof body?.projectSource === 'string' ? body.projectSource : '';
		const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
		if (!projectId) {
			await repository.assignProject({
				id,
				projectSource: '',
				projectId: '',
				projectTitle: '',
				now
			});
		} else {
			if (source !== 'project' && source !== 'community') error(400, 'Choose a valid project.');
			const project = await new ProjectEventRepository(env!.DB).findById(source, projectId);
			if (!project) error(404, 'That project is no longer available.');
			await repository.assignProject({
				id,
				projectSource: source,
				projectId,
				projectTitle: project.title,
				now
			});
		}
	} else if (action === 'set-deposited') {
		await repository.setCashDeposited({
			id,
			memberId: context.viewer.id,
			now,
			deposited: Boolean(body?.deposited)
		});
	} else {
		error(400, 'Unknown market sales action.');
	}
	return json(await response(env!));
};
