import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import type { ProjectTask } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const status = typeof body?.status === 'string' ? body.status.trim() : '';
	const dueDate = typeof body?.dueDate === 'string' ? body.dueDate.trim() : '';
	if (!projectId || !title || title.length > 255 || (dueDate && !DATE.test(dueDate))) {
		error(400, 'Enter a task name and a valid optional due date.');
	}
	const projects = new ProjectEventRepository(env.DB);
	const project = await projects.findById('project', projectId);
	if (!project) error(404, 'Project not found.');
	const directory = new EventDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN)));
	const created = await directory.createProjectTask(projectId, { title, status, dueDate });
	const task: ProjectTask = {
		id: created.id,
		title: created.title,
		owner: '',
		status,
		dueDate,
		completionDate: '',
		completed: false,
		attachments: [],
		comments: []
	};
	const tasks = Array.isArray(project.record.tasks) ? (project.record.tasks as ProjectTask[]) : [];
	await projects.upsert({
		...project,
		record: { ...project.record, tasks: [...tasks, task] },
		syncedAt: new Date().toISOString()
	});
	return json({
		task,
		mondayConfirmed: true,
		message: 'Task created and confirmed by Monday.'
	});
};
