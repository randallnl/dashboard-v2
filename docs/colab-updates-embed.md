# Embed the CoLab updates board

The public updates board is available at:

```text
https://dashboard.queerlective.com/embed/colab-updates
```

Use a **Custom Liquid** block (not the regular Shopify rich-text editor) to add the following. It
automatically grows the frame to the public board’s exact height, which leaves the Shopify page as the
only scroll surface. The page may be framed only by `queerlective.com` and `www.queerlective.com`; all
other dashboard pages remain blocked from framing.

```html
<div class="ql-colab-updates-embed">
	<iframe
		id="ql-colab-updates-frame"
		src="https://dashboard.queerlective.com/embed/colab-updates"
		title="CoLab updates"
		width="100%"
		height="800"
		loading="lazy"
		scrolling="no"
		style="display:block; border:0; border-radius:18px; overflow:hidden; width:100%; transition:height .2s ease"
	></iframe>
</div>

<script>
	(() => {
		const frame = document.getElementById('ql-colab-updates-frame');
		const minHeight = 720;
		const maxHeight = 3200;

		window.addEventListener('message', (event) => {
			if (event.origin !== 'https://dashboard.queerlective.com') return;
			const message = event.data;
			if (message?.source !== 'queerlective-colab-updates' || message.type !== 'resize') return;

			const height = Number(message.height);
			if (!Number.isFinite(height) || height < 1) return;
			frame.style.height = `${Math.min(maxHeight, Math.max(minHeight, Math.ceil(height)))}px`;
		});
	})();
</script>
```

The board reads confirmed shifts from the dashboard's sync cache for the current Monday–Sunday week. It deliberately publishes the date, time, and shift name only—never the name of the member who is staffing the shift. Links open in the parent page so members do not become trapped in the embedded frame.

The announcement panel matches the existing hub's current empty state. When a public announcement source is chosen, that panel can be connected without changing the page's embed or schedule behavior.

The resize message contains only the rendered page height. The Shopify listener accepts messages only
from `dashboard.queerlective.com` and caps the frame height, so the embed cannot alter the host page in
other ways.
