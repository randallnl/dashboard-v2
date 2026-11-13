import { describe, expect, it } from 'vitest';
import { receiptEmailCopyFile } from './email-copy';

describe('receiptEmailCopyFile', () => {
	it('turns an accepted receipt email into a Drive-ready PDF copy', () => {
		const copy = receiptEmailCopyFile({
			from: 'orders@faire.com',
			to: 'receipts@nhsolidarityecosystem.com',
			subject: 'Your Faire order',
			receivedAt: '2026-11-13T18:00:00.000Z',
			text: 'Order VDUWADJNM8\nTotal: $150.00'
		});
		expect(copy.filename).toBe('receipt-email-2026-11-13T18-00-00-000Z.pdf');
		expect(copy.mimeType).toBe('application/pdf');
		expect(new TextDecoder().decode(copy.content.slice(0, 8))).toBe('%PDF-1.4');
		expect(new TextDecoder().decode(copy.content)).toContain('Your Faire order');
		expect(new TextDecoder().decode(copy.content)).toContain('Order VDUWADJNM8');
	});
});
