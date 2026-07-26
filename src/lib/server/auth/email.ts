type MagicLinkEmailInput = {
	to: string;
	loginUrl: string;
	expiresInMinutes: number;
};

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

export function magicLinkEmailContent(input: MagicLinkEmailInput): {
	subject: string;
	html: string;
	text: string;
} {
	const safeUrl = escapeHtml(input.loginUrl);
	const subject = 'Your CoLab sign-in link';
	const text = [
		'Sign in to the Queerlective CoLab member portal:',
		input.loginUrl,
		'',
		`This link expires in ${input.expiresInMinutes} minutes and can only be used once.`,
		'If you did not request this link, you can ignore this email.'
	].join('\n');
	const html = `
		<!doctype html>
		<html lang="en">
			<body style="margin:0;background:#f3efe6;color:#17251e;font-family:Arial,sans-serif">
				<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
					<tr>
						<td style="padding:32px 16px">
							<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
								style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px">
								<tr>
									<td style="padding:40px">
										<p style="margin:0 0 16px;color:#a04e31;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">
											Queerlective CoLab
										</p>
										<h1 style="margin:0 0 16px;font-size:30px;line-height:1.15">Sign in to your member portal</h1>
										<p style="margin:0 0 28px;color:#56625b;line-height:1.6">
											Use the secure button below to sign in. This link expires in
											${input.expiresInMinutes} minutes and can only be used once.
										</p>
										<a href="${safeUrl}"
											style="display:inline-block;padding:14px 22px;border-radius:10px;background:#194639;color:#ffffff;text-decoration:none;font-weight:700">
											Sign in to CoLab
										</a>
										<p style="margin:28px 0 0;color:#78817c;font-size:13px;line-height:1.5">
											If you did not request this link, you can safely ignore this email.
										</p>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
			</body>
		</html>
	`;

	return { subject, html, text };
}

export async function sendMagicLinkEmail(
	emailBinding: SendEmail,
	fromEmail: string,
	fromName: string,
	input: MagicLinkEmailInput
): Promise<void> {
	const content = magicLinkEmailContent(input);
	await emailBinding.send({
		to: input.to,
		from: {
			email: fromEmail,
			name: fromName
		},
		subject: content.subject,
		html: content.html,
		text: content.text
	});
}
