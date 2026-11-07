<script lang="ts">
	let { campaignBase = '/things-we-love' }: { campaignBase?: string } = $props();
</script>

<svelte:head><title>Giveaway Rules · Things We Love About New Hampshire</title></svelte:head>

<main>
	<a class="back" href={campaignBase}>← Back to the campaign</a>
	<p class="eyebrow">Queerlective fundraiser</p>
	<h1>Giveaway rules</h1>
	<p class="intro">No purchase is necessary to submit a story or receive a giveaway entry. A purchase does not increase the chance of winning.</p>
	<section><h2>1. How to enter</h2><p>Complete the Things We Love About New Hampshire submission form with the required contact information, story, and acknowledgement of these rules. Each accepted submission receives one giveaway entry. A moderation decision about public display or calendar publication does not affect giveaway eligibility.</p></section>
	<section><h2>2. Prizes</h2><p>The campaign begins with two $100 prizes. Additional partner-contributed prizes may be added and announced on the campaign page. No prize is transferable, and no cash substitute is required except at Queerlective’s discretion where required by law.</p></section>
	<section><h2>3. Preorders and production</h2><p>The 2027 community calendar is a closed 12 × 9 format, offered at $25 with free shipping; it does not require a preorder activation threshold. The community book is offered at $20 with free shipping and activates for production only after 50 preorders. Preordering either item is separate from the giveaway and does not change entry odds. Selected calendar contributors receive a free calendar, subject to production.</p></section>
	<section><h2>4. Public display and publication</h2><p>Consent to display a submission publicly and consent to consider it for the calendar are separate choices. If a photo is submitted, its creator may separately permit cropping, resizing, and text overlays. A submission may be declined for public display without affecting its giveaway entry.</p></section>
	<section><h2>5. Disqualification</h2><p>Queerlective may disqualify an entry only for a violation of these rules, incomplete or materially false entry information, tampering, abuse, or conduct that compromises the campaign’s fair administration. A disqualification reason is recorded in the moderation history.</p></section>
	<section><h2>6. Drawing and notification</h2><p>Eligible entries will be included in a random drawing after the published entry period closes. Potential winners will be contacted using the email provided with their submission. If a potential winner cannot be reached or is ineligible, Queerlective may select an alternate eligible entry.</p></section>
	<section><h2>7. Timing and eligibility notice</h2><p>The campaign page is the source of the entry deadline, eligibility requirements, and any prize updates. These details must be confirmed before the drawing occurs. Where applicable law requires a different process, Queerlective will follow that law.</p></section>
	<section><h2>8. Privacy</h2><p>Contact information is used to administer the submission, giveaway, contributor follow-up, and preorder communications. It is not displayed on the public community wall. Public display is limited to the name, town, story, and image content expressly approved through the submission form.</p></section>
	<p class="updated">Last updated November 6, 2026.</p>
</main>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Bangers&family=Chewy&family=DM+Sans:wght@400;600;700&display=swap');
	:global(body){margin:0;background:#d5effc;color:#173f85;font-family:'DM Sans',sans-serif}main{max-width:820px;margin:auto;padding:clamp(44px,8vw,100px) 24px 90px}.back{font-family:Chewy,cursive;color:#173f85;background:#fff;border:4px solid #fff;border-radius:12px;box-shadow:3px 4px 0 #f72b4b;padding:6px 11px;text-decoration:none}.eyebrow{margin:70px 0 12px;color:#f72b4b;font:1rem Chewy,cursive}h1{font:clamp(3.1rem,7vw,6.5rem)/.83 Bangers,Impact,sans-serif;letter-spacing:.02em;color:#fff;text-shadow:3px 3px 0 #173f85,6px 6px 0 #fff,9px 9px 0 #173f85;margin:0 0 35px}.intro,section{background:#fff;border:5px solid #fff;border-radius:20px;box-shadow:6px 7px 0 #2878e9;padding:21px 23px;margin:20px 0}.intro{font:600 1.08rem/1.6 'DM Sans',sans-serif}h2{font:1.65rem Chewy,cursive;color:#f72b4b;margin:0 0 8px}p{font-size:1rem;line-height:1.6;margin:0}.updated{font:1rem Chewy,cursive;color:#f72b4b;margin:32px 0 0}
</style>
