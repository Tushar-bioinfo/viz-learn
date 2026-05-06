# Export Settings Cheatsheet

| Output | Best use | Recommended setting |
| --- | --- | --- |
| PNG | Slides, notebooks, chat, quick sharing | `dpi=300` or higher |
| SVG | Web figures, diagrams, vector editing | Export as vector, avoid raster screenshots |
| PDF | Papers, supplements, print workflows | Prefer vector text and lines |
| HTML | Interactive Plotly figures | `fig.write_html(...)` |

## Fast Rules

- Use white backgrounds unless you have a specific reason not to.
- Check fonts and margins after export, not only inside the notebook.
- Use `bbox_inches="tight"` in Matplotlib to avoid clipped labels.
- Export both a working notebook version and a final presentation version when needed.
