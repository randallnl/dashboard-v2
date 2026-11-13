export const RETAIL_INBOX = 'retail@nhsolidarityecosystem.com';
export const RETAIL_STEPS = [
	{ id: 'received', label: 'Receive shipment and check quantities / damage' },
	{ id: 'shopify', label: 'Add to Shopify inventory' },
	{ id: 'totally-tea', label: 'Add to Totally Tea inventory' },
	{ id: 'labels', label: 'Price and label products' },
	{ id: 'display', label: 'Add to Totally Tea retail display' }
] as const;
export type RetailOrder = {
	id: string;
	title: string;
	order_number: string;
	notes: string;
	created_at: string;
	steps: Record<string, string>;
};
export function faireOrderNumber(text: string): string {
	return (
		text
			.match(/\border\s*(?:number|no\.?|#|:)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,40})\b/iu)?.[1]
			?.toUpperCase() ?? ''
	);
}
