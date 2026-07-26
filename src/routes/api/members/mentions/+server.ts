import { loadMemberContext } from '$lib/server/auth/member-context';
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
	const members = await new MemberDirectory(
		new MondayClient(await mondayToken(env.MONDAY_API_TOKEN))
	).list();
	const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('en-US');
	const options = members
		.filter((member) => member.id !== context.member.id)
		.map((member) => ({ id: member.id, label: coveredByLabel(member.preferredName) }))
		.filter((member) => !query || member.label.toLocaleLowerCase('en-US').includes(query))
		.sort((left, right) => left.label.localeCompare(right.label))
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
