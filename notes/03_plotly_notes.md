# Plotly Notes

## What Plotly Is

Plotly is an interactive plotting library that works especially well in notebooks,
dashboards, and HTML reports. It supports hover labels, zooming, legend toggles,
and self-contained HTML export.

## When to Use It

- When exploration benefits from hover details and zoom.
- When you need an interactive figure for the web or for collaborators.
- When you want quick expressive plots from a tidy dataframe.

## Important Functions

| Function | What it does | Typical use |
| --- | --- | --- |
| `px.scatter` | Interactive scatter plot. | Exploring relationships with hover info. |
| `px.line` | Interactive line plot. | Time series and ordered data. |
| `px.bar` | Interactive bar chart. | Category comparisons. |
| `px.histogram` | Interactive histogram. | Distribution inspection. |
| `px.imshow` | Interactive matrix or heatmap-like display. | Heatmaps and image-like tables. |
| `go.Figure` | Lower-level figure object. | Custom control or advanced composition. |
| `fig.update_layout` | Changes titles, legends, fonts, size, margins, and template. | Polishing the figure. |
| `fig.add_annotation` | Adds callouts or labels. | Highlighting important points. |
| `fig.write_html` | Exports an interactive HTML figure. | Sharing a self-contained interactive chart. |

## Important Parameters

| Parameter | Why it matters |
| --- | --- |
| `color` | Maps categories or numbers to color. |
| `symbol` | Maps groups to marker shape. |
| `size` | Maps a numeric column to point size. |
| `hover_data` | Shows extra columns in hover labels. |
| `template` | Controls the overall style. |
| `opacity` | Useful for overplotting. |
| `facet_row` / `facet_col` | Creates small multiples quickly. |
| `error_y` | Adds vertical uncertainty bars. |

## Strengths

- Built-in interactivity.
- Good defaults for web-friendly figures.
- Easy HTML export with one file.

## Weaknesses

- Static publication export usually needs extra care.
- Fine-grained control can require lower-level graph objects.
- Large interactive figures can become heavy.

## Best Practices

- Choose a template such as `plotly_white` before polishing.
- Keep hover labels focused on useful information.
- Export HTML when interactivity matters and PNG or PDF when it does not.
- Use static exports for papers, but interactive HTML for exploration.

## Common Mistakes

- Overloading hover labels with too much text.
- Using too many traces in one interactive chart.
- Forgetting that interactive HTML is not the same as a journal-ready static figure.
- Letting default sizes or margins clip titles or tick labels.

## Documentation

- [Plotly Python documentation](https://plotly.com/python/)
- [Plotly Express overview](https://plotly.com/python/plotly-express/)
