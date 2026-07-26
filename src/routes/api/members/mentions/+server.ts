import { loadMemberContext } from '$lib/server/auth/member-context';
import { MemberRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { MemberDirectory } from '$lib/server/monday/members';
import { coveredByLabel } from '$lib/server/monday/shifts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function html(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

export const GET: RequestHandler = async ({ request, locals, platform, url }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('en-US');
	const includeSelf =
		url.searchParams.get('includeSelf') === '1' && context.viewerCapabilities.isAdmin;
	const repository = new MemberRepository(env.DB);
	let members = await repository.search(query, 12);
	if (!members.length) {
		const mondayMembers = await new MemberDirectory(
			new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
		).list();
		const syncedAt = new Date().toISOString();
		await Promise.all(mondayMembers.map((member) => repository.upsert(member, syncedAt)));
		members = await repository.search(query, 12);
	}
	const options = members
		.filter((member) => includeSelf || member.id !== context.member.id)
		.map((member) => ({ id: member.id, label: coveredByLabel(member.preferredName) }))
		.slice(0, 10);
	if (request.headers.has('hx-request')) {
		return new Response(
			options.length
				? options
						.map(
							(member) =>
								`<button type="button" data-id="${html(member.id)}" data-label="${html(member.label)}" x-on:click="addMember($el.dataset.id, $el.dataset.label)">@${html(member.label)}</button>`
						)
						.join('')
				: '<p>No matching members.</p>',
			{
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'cache-control': 'private, no-store'
				}
			}
		);
	}
	return json({ members: options }, { headers: { 'cache-control': 'private, max-age=300' } });
};
