import { describe, expect, it } from 'vitest';
import { parseFaireOrder, savedFaireEmailText } from './orders';

const confirmation = `
Order summary
VDUWADJNM8
Camilla Watson Art
23 items · $150.00
Free shipping with Insider
Frog Wizard Enamel Pin
Frog Wizard Enamel Pin
$24.00
Qty: 3
Midnight Forest Clearing | Fine Art Print | 5 x 7 inches
Midnight Forest Clearing | Fine Art Print | 5 x 7 inches
$12.00
Qty: 3
Book Wyrm Enamel Pin
Book Wyrm Enamel Pin
$24.00
Qty: 3
Wizard Frog | Fine Art Print | 5 x 7 inches
Wizard Frog | Fine Art Print | 5 x 7 inches
$12.00
Qty: 3
"Celestial Fish" Collar Chain Enamel Pin : Gold Plating
"Celestial Fish" Collar Chain Enamel Pin : Gold Plating
$30.00
Qty: 2
View all products
Subtotal
$150.00
`;

describe('Faire order parsing', () => {
	it('extracts the order summary, line items, and matching safe product thumbnails', () => {
		const parsed = parseFaireOrder({
			text: confirmation,
			html: '<img alt="Frog Wizard Enamel Pin" src="https://images.faire.com/frog.png?width=200"><img alt="Book Wyrm Enamel Pin" src="https://images.faire.com/book.png?token=private">'
		});
		expect(parsed.orderNumber).toBe('VDUWADJNM8');
		expect(parsed.brand).toBe('Camilla Watson Art');
		expect(parsed.itemCount).toBe(23);
		expect(parsed.total).toBe('$150.00');
		expect(parsed.products).toEqual([
			{
				name: 'Frog Wizard Enamel Pin',
				quantity: 3,
				unit_price: '$24.00',
				thumbnail_url: 'https://images.faire.com/frog.png?width=200'
			},
			{
				name: 'Midnight Forest Clearing | Fine Art Print | 5 x 7 inches',
				quantity: 3,
				unit_price: '$12.00',
				thumbnail_url: ''
			},
			{
				name: 'Book Wyrm Enamel Pin',
				quantity: 3,
				unit_price: '$24.00',
				thumbnail_url: ''
			},
			{
				name: 'Wizard Frog | Fine Art Print | 5 x 7 inches',
				quantity: 3,
				unit_price: '$12.00',
				thumbnail_url: ''
			},
			{
				name: '"Celestial Fish" Collar Chain Enamel Pin : Gold Plating',
				quantity: 2,
				unit_price: '$30.00',
				thumbnail_url: ''
			}
		]);
	});

	it('removes personalized Faire URLs before saving the forwarded email text', () => {
		expect(
			savedFaireEmailText(
				'View https://www.faire.com/order?email=randall%40queerlective.com&brandOrderToken=secret now'
			)
		).toBe('View [link removed] now');
	});
});
