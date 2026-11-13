import { describe, expect, it } from 'vitest';
import { faireReceiptFile } from './faire-receipt';

describe('Faire receipt file', () => {
	it('turns a Faire confirmation into a QuickBooks-compatible PDF attachment', () => {
		const receipt = faireReceiptFile({
			receivedAt: '2026-11-13T18:00:00.000Z',
			text: `Order summary
VDUWADJNM8
Camilla Watson Art
23 items · $150.00
Frog Wizard Enamel Pin
$24.00
Qty: 3
View all products`
		});
		expect(receipt?.filename).toBe('faire-order-VDUWADJNM8.pdf');
		expect(receipt?.mimeType).toBe('application/pdf');
		expect(receipt?.content.byteLength).toBeGreaterThanOrEqual(46 * 1024);
		expect(new TextDecoder().decode(receipt?.content.slice(0, 8))).toBe('%PDF-1.4');
	});
});
