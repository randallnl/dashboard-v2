import { describe, expect, it } from 'vitest';
import { emailLinksFrom, googleDriveFileId, inboxTokenFrom } from './project-email-ingest-worker';

const inbox = 'projects@nhsolidarityecosystem.com';
const token = 'f6d46896-0c2c-45d5-a2a1-c2bb4e11a5d8';

function message(to: string, subject = ''): Pick<ForwardableEmailMessage, 'to' | 'headers'> {
	return { to, headers: new Headers(subject ? { subject } : {}) };
}

describe('project email recipient matching', () => {
	it('uses the token in a project-specific plus address without relying on the subject', () => {
		expect(
			inboxTokenFrom(
				message(`projects+${token}@nhsolidarityecosystem.com`, 'Any ordinary subject'),
				inbox
			)
		).toBe(token);
	});

	it('keeps the legacy tagged-subject format working for the base inbox', () => {
		expect(inboxTokenFrom(message(inbox, `Fwd: [project:${token}] Follow-up`), inbox)).toBe(token);
	});

	it('rejects the base inbox without a project tag and malformed plus addresses', () => {
		expect(inboxTokenFrom(message(inbox, 'No project selected'), inbox)).toBe('');
		expect(inboxTokenFrom(message('projects+not-a-token@nhsolidarityecosystem.com'), inbox)).toBe(
			''
		);
		expect(inboxTokenFrom(message(`other+${token}@nhsolidarityecosystem.com`), inbox)).toBe('');
	});
});

describe('project email link extraction', () => {
	it('keeps normal web links for the Files & links area', () => {
		expect(emailLinksFrom('Read https://example.com/updates.')).toEqual([
			{ url: 'https://example.com/updates', label: 'example.com · updates', driveFileId: '' }
		]);
	});

	it('finds Google Docs and Drive document ids for project-folder shortcuts', () => {
		const documentId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
		const fileId = '1ZyXwVuTsRqPoNmLkJiHgFeDcBa';
		const links = emailLinksFrom(
			`Agenda https://docs.google.com/document/d/${documentId}/edit`,
			`Asset https://drive.google.com/file/d/${fileId}/view?usp=drive_link`
		);
		expect(links.map((link) => link.driveFileId)).toEqual([documentId, fileId]);
		expect(googleDriveFileId('https://example.com/document/d/not-a-drive-file')).toBe('');
	});
});
