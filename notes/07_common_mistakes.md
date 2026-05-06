# Common Mistakes and Fixes

Most plotting mistakes are not coding mistakes. They are communication mistakes.
The table below lists common problems and practical fixes.

| Mistake | Why it hurts | Better fix |
| --- | --- | --- |
| Using bars for raw distributions | Bars hide spread and outliers. | Use box, violin, strip, or swarm plots. |
| Too many colors | The viewer cannot track the mapping. | Limit colors to meaningful groups. |
| Missing units on axes | Readers cannot interpret scale. | Add units directly to labels. |
| Crowded legends | Legends become a reading task. | Reduce groups or label directly. |
| Overplotting in scatter plots | Dense regions disappear. | Use alpha, smaller markers, or summarize. |
| Default export DPI | Saved figures look soft in slides or print. | Export raster figures at 300 DPI or higher. |
| Unexplained error bars | Readers do not know what uncertainty means. | State SD, SE, or CI in caption or label. |
| Too many decimals | Extra precision adds noise, not clarity. | Round to what the audience needs. |
| Alphabetical category order by accident | Story and comparison become harder. | Set a meaningful category order. |
| Using interactivity as a substitute for design | A weak figure is still weak when interactive. | Make the static design clear first. |

## Extra Advice

- Always ask what question the figure should answer.
- If a reader needs a long explanation, the figure may need redesign.
- A cleaner plot usually wins over a more decorative plot.
