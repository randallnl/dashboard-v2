# Embed the CoLab updates board

The public updates board is available at:

```text
https://dashboard.queerlective.com/embed/colab-updates
```

Add it to the CoLab Member Hub page with this iframe. The page may be framed only by
`queerlective.com` and `www.queerlective.com`; all other dashboard pages remain blocked from framing.

```html
<iframe
  src="https://dashboard.queerlective.com/embed/colab-updates"
  title="CoLab updates"
  width="100%"
  height="1450"
  loading="lazy"
  style="display:block; border:0; border-radius:18px; overflow:hidden"
></iframe>
```

The board reads confirmed shifts from the dashboard's sync cache for the current Monday–Sunday week. It deliberately publishes the date, time, and shift name only—never the name of the member who is staffing the shift. Links open in the parent page so members do not become trapped in the embedded frame.

The announcement panel matches the existing hub's current empty state. When a public announcement source is chosen, that panel can be connected without changing the page's embed or schedule behavior.
