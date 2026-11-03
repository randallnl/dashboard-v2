function hexBytes(value: string): Uint8Array | null {
	if (!/^(?:[0-9a-f]{2})+$/iu.test(value)) return null;
	return Uint8Array.from(value.match(/.{2}/gu) ?? [], (pair) => Number.parseInt(pair, 16));
}

function arrayBuffer(value: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(value.byteLength);
	copy.set(value);
	return copy.buffer;
}

/** Reads a Secrets Store binding in production or a plain string from `.dev.vars` locally. */
export async function discordConfigValue(
	binding: string | { get(): Promise<string> }
): Promise<string> {
	return typeof binding === 'string' ? binding : binding.get();
}

/** Verifies the exact raw payload Discord signed; never parse or reserialize before calling this. */
export async function verifyDiscordInteraction(
	rawBody: string,
	signature: string,
	timestamp: string,
	publicKey: string
): Promise<boolean> {
	const signatureBytes = hexBytes(signature);
	const publicKeyBytes = hexBytes(publicKey);
	if (!signatureBytes || !publicKeyBytes || !timestamp) return false;

	try {
		const key = await crypto.subtle.importKey(
			'raw',
			arrayBuffer(publicKeyBytes),
			{ name: 'Ed25519' },
			false,
			['verify']
		);
		return crypto.subtle.verify(
			{ name: 'Ed25519' },
			key,
			arrayBuffer(signatureBytes),
			arrayBuffer(new TextEncoder().encode(`${timestamp}${rawBody}`))
		);
	} catch {
		return false;
	}
}

export type DiscordInteraction = {
	type?: unknown;
	channel_id?: unknown;
	data?: { name?: unknown };
};

export function isColabHoursCommand(interaction: DiscordInteraction): boolean {
	return interaction.type === 2 && interaction.data?.name === 'colab-hours';
}
