# Common Parameters Across Matplotlib, Seaborn, and Plotly

Many plotting ideas are shared across libraries even when the exact function names differ.
Learn the concept first, then learn each library's spelling of that concept.

| Concept | Matplotlib | Seaborn | Plotly | Meaning |
| --- | --- | --- | --- | --- |
| Figure size | `fig, ax = plt.subplots(figsize=(w, h))` | `plt.subplots(figsize=...)` or figure-level `height=` / `aspect=` | `fig.update_layout(width=..., height=...)` | Controls how much space the plot gets. Matplotlib and Seaborn use inches. Plotly uses pixels. |
| Title | `ax.set_title(...)` | `ax.set_title(...)` or `g.fig.suptitle(...)` | `fig.update_layout(title=...)` | Adds the main message of the chart. |
| Axis labels | `ax.set_xlabel(...)`, `ax.set_ylabel(...)` | Same as Matplotlib because Seaborn builds on top of it | `fig.update_xaxes(title=...)`, `fig.update_yaxes(title=...)` | Names what each axis means. |
| Colors | `color=`, `facecolor=`, `edgecolor=` | `palette=`, `color=`, `hue=` | `color=`, `color_discrete_sequence=`, `color_continuous_scale=` | Colors can separate groups or show magnitude. |
| Colormaps | `cmap='viridis'` | `palette='viridis'` or pass a palette object | `color_continuous_scale='Viridis'` | Used when color represents a number instead of categories. |
| Marker size | `s=` for scatter, `markersize=` for lines | `s=` or `size=` depending on function | `size=` or `marker=dict(size=...)` | Bigger points attract attention but can hide overlap. |
| Marker shape | `marker='o'`, `'^'`, `'s'` | `style=` or `markers=` | `symbol=` | Useful when color alone is not enough. |
| Line width | `linewidth=` or `lw=` | Usually passed through to the underlying Matplotlib artist | `line_width=` or `line=dict(width=...)` | Thicker lines help emphasis. Very thick lines can hide data. |
| Transparency | `alpha=` | `alpha=` | `opacity=` | Useful when many points overlap. |
| Legends | `ax.legend(...)` | Automatic from `hue`, `style`, `size`; refine with `ax.legend(...)` | `fig.update_layout(legend_title_text=...)` | Explains how colors, symbols, or line types map to groups. |
| Ticks | `ax.set_xticks(...)`, `ax.tick_params(...)` | Usually modify the Matplotlib axes after the Seaborn call | `fig.update_xaxes(tickangle=..., tickvals=...)` | Ticks show numeric scale or category order. |
| Axis limits | `ax.set_xlim(...)`, `ax.set_ylim(...)` | Same Matplotlib methods on the returned axes | `fig.update_xaxes(range=[...])` | Limits control zoom. Do not crop data without a reason. |
| Grid lines | `ax.grid(True, alpha=...)` | `sns.set_theme(style='whitegrid')` and `ax.grid(...)` | `fig.update_xaxes(showgrid=True)` | Light grids help people read values. |
| Fonts | `plt.rcParams[...]` or text methods | Use Matplotlib font settings or Seaborn context helpers | `fig.update_layout(font=dict(...))` | Keep fonts readable and consistent across all panels. |
| Subplots | `plt.subplots(...)` | `FacetGrid`, `catplot`, `relplot`, or plain Matplotlib subplots | `make_subplots(...)` | Subplots compare related views without leaving one figure. |
| Annotations | `ax.annotate(...)`, `ax.text(...)` | Same Matplotlib tools after plotting | `fig.add_annotation(...)` | Annotations call attention to an important point. |
| Error bars | `ax.errorbar(...)` | `errorbar=` on modern categorical and line functions | `error_y=...` or `error_x=...` | Show uncertainty or variability around a summary value. |
| Export settings | `fig.savefig(path, dpi=300, bbox_inches='tight')` | Same Matplotlib save step using `g.fig.savefig(...)` | `fig.write_html(...)` and `fig.write_image(...)` | Export settings control resolution, file type, and whether interactivity is preserved. |

## Reading the Table

- Matplotlib is usually the most direct and explicit.
- Seaborn often uses Matplotlib underneath, so many final edits still happen on the axes.
- Plotly tends to split styling between the initial function call and `update_layout` or `update_*axes`.
