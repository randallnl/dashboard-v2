export type LinkifiedTextPart =
	| { type: 'text'; text: string }
	| { type: 'link'; text: string; href: string };

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/giu;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/u;

function withoutTrailingPunctuation(value: string): { url: string; trailing: string } {
	let url = value;
	let trailing = '';

	const punctuation = url.match(TRAILING_PUNCTUATION)?.[0] ?? '';
	if (punctuation) {
		url = url.slice(0, -punctuation.length);
		trailing = punctuation;
	}

	for (const closer of [')', ']', '}']) {
		const opener = closer === ')' ? '(' : closer === ']' ? '[' : '{';
		while (
			url.endsWith(closer) &&
			[...url].filter((character) => character === closer).length >
				[...url].filter((character) => character === opener).length
		) {
			url = url.slice(0, -1);
			trailing = `${closer}${trailing}`;
		}
	}

	return { url, trailing };
}

function safeHref(value: string): string {
	try {
		const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch {
		return '';
	}
}

/** Splits plain text into safe, renderable HTTP(S) links without using HTML injection. */
export function linkify(value: string): LinkifiedTextPart[] {
	const parts: LinkifiedTextPart[] = [];
	let cursor = 0;

	for (const match of value.matchAll(URL_PATTERN)) {
		const index = match.index ?? 0;
		const matchedText = match[0];
		if (index > cursor) parts.push({ type: 'text', text: value.slice(cursor, index) });

		const { url, trailing } = withoutTrailingPunctuation(matchedText);
		const href = safeHref(url);
		parts.push(href ? { type: 'link', text: url, href } : { type: 'text', text: url });
		if (trailing) parts.push({ type: 'text', text: trailing });
		cursor = index + matchedText.length;
	}

	if (cursor < value.length) parts.push({ type: 'text', text: value.slice(cursor) });
	return parts.length ? parts : [{ type: 'text', text: value }];
}
