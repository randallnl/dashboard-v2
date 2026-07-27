import type { ShiftSwitchRequest } from '$lib/types/domain';

function escape(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

export async function sendShiftSwitchEmail(
	email: SendEmail,
	fromEmail: string,
	fromName: string,
	to: string,
	request: ShiftSwitchRequest,
	kind: 'requested' | 'accepted' | 'declined' | 'reminder'
): Promise<void> {
	const dashboardUrl = 'https://dashboard-v2.randall-d53.workers.dev/#coming-up-title';
	const subjects = {
		requested: `${request.requesterLabel} requested a CoLab shift switch`,
		accepted: `${request.replacementLabel} accepted your shift switch`,
		declined: `${request.replacementLabel} declined your shift switch`,
		reminder: `Reminder: CoLab shift switch awaiting your response`
	};
	const actions = {
		requested: 'Please open the dashboard to accept or decline this request.',
		accepted: 'The shift has been updated in Monday and is now assigned to the replacement.',
		declined: 'The shift remains assigned to the original member.',
		reminder: 'This request is still pending. Please accept or decline it before the shift.'
	};
	const summary = `${request.shiftTitle} · ${request.shiftDate}${request.shiftTime ? ` · ${request.shiftTime}` : ''}`;
	await email.send({
		to,
		from: { email: fromEmail, name: fromName },
		subject: subjects[kind],
		text: `${subjects[kind]}\n\n${summary}\n\n${actions[kind]}\n\n${dashboardUrl}`,
		html: `<h1>${escape(subjects[kind])}</h1><p>${escape(summary)}</p><p>${escape(actions[kind])}</p><p><a href="${dashboardUrl}">Open the CoLab dashboard</a></p>`
	});
}
