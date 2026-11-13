import PostalMime from 'postal-mime';
import { RETAIL_INBOX, faireOrderNumber } from '$lib/retail/orders';
import { RetailRepository } from '$lib/server/db/retail-repository';

export async function processRetailEmail(
	message: ForwardableEmailMessage,
	db: D1Database
): Promise<boolean> {
	const recipient = message.to.trim().toLowerCase();
	const [local, domain] = RETAIL_INBOX.split('@');
	if (!recipient.startsWith(`${local}+`) || !recipient.endsWith(`@${domain}`)) return false;
	const token = recipient.slice(local.length + 1, -(domain.length + 1));
	const repository = new RetailRepository(db);
	if (!token || token !== (await repository.inbox())) {
		message.setReject('This retail forwarding address is not active.');
		return true;
	}
	if (message.rawSize > 5 * 1024 * 1024) {
		message.setReject('Retail emails must be smaller than 5 MB.');
		return true;
	}
	const raw = await new Response(message.raw).arrayBuffer();
	const parsed = await PostalMime.parse(raw);
	const subject = parsed.subject?.trim() || 'Faire order — review details';
	const text = parsed.text || (parsed.html || '').replace(/<[^>]*>/gu, ' ');
	const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	await repository.create({
		title: subject.slice(0, 200),
		orderNumber: faireOrderNumber(`${subject}\n${text}`),
		notes: `Forwarded by: ${message.from}\n\n${text}`.slice(0, 20000),
		messageId: parsed.messageId || hash
	});
	return true;
}
