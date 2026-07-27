import { loadMemberContext, requireProjectManager } from '$lib/server/auth/member-context';
import { ProjectEventRepository } from '$lib/server/db';
import { MondayClient, mondayToken } from '$lib/server/monday/client';
import { EventDirectory } from '$lib/server/monday/events';
import type { ProjectTask, ProjectTaskComment } from '$lib/types/domain';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const env = platform!.env;
	const context = await loadMemberContext({ session: locals.session, env });
	requireProjectManager(context);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
	const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : '';
	const commentBody = typeof body?.body === 'string' ? body.body.trim() : '';
	if (!projectId || !taskId || !commentBody || commentBody.length > 5000) {
		error(400, 'Enter a comment under 5,000 characters.');
	}
	const projects = new ProjectEventRepository(env.DB);
	const project = await projects.findById('project', projectId);
	if (!project) error(404, 'Project not found.');
	const tasks = Array.isArray(project.record.tasks) ? (project.record.tasks as ProjectTask[]) : [];
	const taskIndex = tasks.findIndex((task) => task.id === taskId);
	if (taskIndex < 0) error(404, 'Task not found on this project.');
	const directory = new EventDirectory(new MondayClient(await mondayToken(env.MONDAY_API_TOKEN)));
	const mondayComment = await directory.createTaskComment(
		taskId,
		`[CoLab member: ${context.member.preferredName}] ${commentBody}`
	);
	const comment: ProjectTaskComment = {
		...mondayComment,
		body: commentBody,
		author: context.member.preferredName
	};
	const task = tasks[taskIndex];
	const updatedTasks = tasks.map((candidate, index) =>
		index === taskIndex ? { ...task, comments: [...(task.comments ?? []), comment] } : candidate
	);
	await projects.upsert({
		...project,
		record: { ...project.record, tasks: updatedTasks },
		syncedAt: new Date().toISOString()
	});
	return json({
		comment,
		mondayConfirmed: true,
		message: 'Comment posted and confirmed by Monday.'
	});
};
