<script lang="ts">
	import { onMount } from 'svelte';

	type Audit = { id: string; action: string; previous_status: string; new_status: string; note: string; actor_id: string; created_at: string };
	type Submission = {
		id: string; name: string; email: string; town: string; story: string; created_at: string; status: string;
		public_display_consent: number; calendar_publication_consent: number; image_edit_consent: number; disqualification_reason: string; hasPhoto: boolean; audits: Audit[];
	};

	let submissions = $state<Submission[]>([]);
	let filter = $state('pending');
	let search = $state('');
	let loading = $state(false);
	let message = $state('');
	let failed = $state(false);
	let savingId = $state('');
	let notes = $state<Record<string, string>>({});

	function date(value: string) {
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
	}

	async function load() {
		loading = true; message = ''; failed = false;
		try {
			const params = new URLSearchParams({ status: filter });
			if (search.trim()) params.set('search', search.trim());
			const response = await fetch(`/api/admin/calendar-campaign?${params}`);
			const result = await response.json() as { submissions?: Submission[]; message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not load campaign submissions.');
			submissions = result.submissions || [];
		} catch (cause) {
			failed = true; message = cause instanceof Error ? cause.message : 'Could not load campaign submissions.';
		} finally { loading = false; }
	}

	async function moderate(submission: Submission, status: 'approved' | 'not_displayed' | 'disqualified') {
		const note = notes[submission.id]?.trim() || '';
		if (status === 'disqualified' && !note) { failed = true; message = 'Enter an official-rules reason before disqualifying an entry.'; return; }
		savingId = submission.id; message = ''; failed = false;
		try {
			const response = await fetch(`/api/admin/calendar-campaign/${submission.id}/moderate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, note }) });
			const result = await response.json() as { message?: string };
			if (!response.ok) throw new Error(result.message || 'Could not save moderation decision.');
			message = status === 'approved' ? 'Approved and ready for the Love Wall.' : result.message || 'Moderation decision saved.';
			await load();
		} catch (cause) {
			failed = true; message = cause instanceof Error ? cause.message : 'Could not save moderation decision.';
		} finally { savingId = ''; }
	}

	onMount(() => { void load(); });
</script>

<section class="campaign-moderation" aria-labelledby="campaign-moderation-title">
	<div class="moderation-heading"><div><p class="eyebrow">Things We Love About New Hampshire</p><h2 id="campaign-moderation-title">Moderation inbox</h2><p>Approve wall submissions, keep a story private, or disqualify an entry with an official-rules reason.</p></div></div>
	<div class="moderation-controls"><label>Status <select bind:value={filter} onchange={() => load()}><option value="pending">Pending review</option><option value="approved">Approved</option><option value="not_displayed">Not displayed</option><option value="disqualified">Disqualified</option><option value="all">All submissions</option></select></label><label>Search <input bind:value={search} placeholder="Name, email, town, or story" /></label><button type="button" onclick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
	{#if message}<p class="moderation-message" class:error={failed} role={failed ? 'alert' : 'status'}>{message}</p>{/if}
	{#if loading && !submissions.length}<p>Loading submissions…</p>
	{:else if !submissions.length}<p class="moderation-empty">No submissions match this view.</p>
	{:else}<div class="submission-list">{#each submissions as submission (submission.id)}
		<article class="submission-card">
			<div class="submission-head"><div><h3>{submission.name}</h3><p>{submission.email}{submission.town ? ` · ${submission.town}` : ''}</p></div><span class:pending={submission.status === 'pending'} class="status-pill">{submission.status.replace('_', ' ')}</span></div>
			<p class="submitted-at">Submitted {date(submission.created_at)}</p>
			<div class="submission-body">{#if submission.hasPhoto}<img src={`/api/admin/calendar-campaign/${submission.id}/image`} alt={`Submitted by ${submission.name}`} />{/if}<blockquote>“{submission.story}”</blockquote></div>
			<div class="consents"><span class:off={!submission.public_display_consent}>Wall {submission.public_display_consent ? 'allowed' : 'not allowed'}</span><span class:off={!submission.calendar_publication_consent}>Calendar {submission.calendar_publication_consent ? 'allowed' : 'not allowed'}</span>{#if submission.hasPhoto}<span class:off={!submission.image_edit_consent}>Image editing {submission.image_edit_consent ? 'allowed' : 'not allowed'}</span>{/if}</div>
			<label class="note-label">Moderator note <input value={notes[submission.id] || ''} oninput={(event) => (notes[submission.id] = event.currentTarget.value)} placeholder="Required only to disqualify" maxlength="1000" /></label>
			<div class="moderation-actions"><button type="button" class="approve" disabled={savingId === submission.id} onclick={() => moderate(submission, 'approved')}>Approve for wall</button><button type="button" disabled={savingId === submission.id} onclick={() => moderate(submission, 'not_displayed')}>Keep private</button><button type="button" class="disqualify" disabled={savingId === submission.id} onclick={() => moderate(submission, 'disqualified')}>Disqualify</button></div>
			{#if submission.disqualification_reason}<p class="reason">Disqualification reason: {submission.disqualification_reason}</p>{/if}
			{#if submission.audits.length}<details><summary>Moderation history ({submission.audits.length})</summary><ul>{#each submission.audits as audit (audit.id)}<li><strong>{audit.new_status || audit.action}</strong> · {date(audit.created_at)}{audit.actor_id ? ` · ${audit.actor_id}` : ''}{audit.note ? ` — ${audit.note}` : ''}</li>{/each}</ul></details>{/if}
		</article>
	{/each}</div>{/if}
</section>

<style>
	.campaign-moderation{margin-top:28px;padding:26px;border:1px solid #d7dfd8;border-radius:16px;background:#fff}.moderation-heading h2{margin:0;font-size:1.7rem}.moderation-heading p{max-width:680px;line-height:1.5}.moderation-controls{display:grid;grid-template-columns:180px minmax(220px,1fr) auto;gap:12px;align-items:end;margin:24px 0}.moderation-controls label,.note-label{display:grid;gap:6px;font-size:.84rem;font-weight:700}.moderation-controls select,.moderation-controls input,.note-label input{border:1px solid #bdc9c0;border-radius:8px;padding:10px;font:inherit}.moderation-controls button,.moderation-actions button{border:0;border-radius:8px;padding:11px 14px;background:#194639;color:#fff;font-weight:700;cursor:pointer}.moderation-controls button:disabled,.moderation-actions button:disabled{opacity:.55;cursor:wait}.moderation-message{padding:12px;border-radius:8px;background:#eaf3ec}.moderation-message.error{background:#fbe8e6;color:#912f22}.submission-list{display:grid;gap:18px}.submission-card{border-top:1px solid #d7dfd8;padding-top:20px}.submission-head{display:flex;align-items:start;justify-content:space-between;gap:14px}.submission-head h3{margin:0;font-size:1.12rem}.submission-head p,.submitted-at{margin:4px 0 0;color:#64716a;font-size:.86rem}.status-pill{border-radius:999px;background:#e7efe9;padding:5px 9px;font-size:.76rem;text-transform:capitalize}.status-pill.pending{background:#fff0c8}.submission-body{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin:14px 0}.submission-body:has(img){grid-template-columns:150px minmax(0,1fr)}.submission-body img{width:150px;height:110px;object-fit:cover;border-radius:8px}.submission-body blockquote{margin:0;line-height:1.55}.consents{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.consents span{border-radius:999px;background:#e5f2e8;padding:5px 8px;font-size:.75rem}.consents .off{background:#f2e8e5;color:#704034}.note-label{margin:14px 0}.moderation-actions{display:flex;gap:9px;flex-wrap:wrap}.moderation-actions button:not(.approve){background:#5d6a62}.moderation-actions .disqualify{background:#9c3a2b}.reason{color:#9c3a2b;font-size:.88rem}.submission-card details{margin-top:15px;font-size:.85rem}.submission-card summary{cursor:pointer;font-weight:700}.submission-card ul{margin:8px 0 0;padding-left:20px;display:grid;gap:5px}.moderation-empty{padding:22px;border-radius:10px;background:#f4f6f4}@media(max-width:700px){.campaign-moderation{padding:18px}.moderation-controls{grid-template-columns:1fr}.submission-body:has(img){grid-template-columns:1fr}.submission-body img{width:100%;height:auto;max-height:270px}.submission-head{display:block}.status-pill{display:inline-block;margin-top:8px}}
</style>
