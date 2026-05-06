# Common Parameters Intersection

    | Concept | Matplotlib | Seaborn | Plotly |
| --- | --- | --- | --- |
| Figure size | `fig, ax = plt.subplots(figsize=(w, h))` | `plt.subplots(figsize=...)` or figure-level `height=` / `aspect=` | `fig.update_layout(width=..., height=...)` |
| Title | `ax.set_title(...)` | `ax.set_title(...)` or `g.fig.suptitle(...)` | `fig.update_layout(title=...)` |
| Axis labels | `ax.set_xlabel(...)`, `ax.set_ylabel(...)` | Same as Matplotlib because Seaborn builds on top of it | `fig.update_xaxes(title=...)`, `fig.update_yaxes(title=...)` |
| Colors | `color=`, `facecolor=`, `edgecolor=` | `palette=`, `color=`, `hue=` | `color=`, `color_discrete_sequence=`, `color_continuous_scale=` |
| Colormaps | `cmap='viridis'` | `palette='viridis'` or pass a palette object | `color_continuous_scale='Viridis'` |
| Marker size | `s=` for scatter, `markersize=` for lines | `s=` or `size=` depending on function | `size=` or `marker=dict(size=...)` |
| Marker shape | `marker='o'`, `'^'`, `'s'` | `style=` or `markers=` | `symbol=` |
| Line width | `linewidth=` or `lw=` | Usually passed through to the underlying Matplotlib artist | `line_width=` or `line=dict(width=...)` |
| Transparency | `alpha=` | `alpha=` | `opacity=` |
| Legends | `ax.legend(...)` | Automatic from `hue`, `style`, `size`; refine with `ax.legend(...)` | `fig.update_layout(legend_title_text=...)` |
| Ticks | `ax.set_xticks(...)`, `ax.tick_params(...)` | Usually modify the Matplotlib axes after the Seaborn call | `fig.update_xaxes(tickangle=..., tickvals=...)` |
| Axis limits | `ax.set_xlim(...)`, `ax.set_ylim(...)` | Same Matplotlib methods on the returned axes | `fig.update_xaxes(range=[...])` |
| Grid lines | `ax.grid(True, alpha=...)` | `sns.set_theme(style='whitegrid')` and `ax.grid(...)` | `fig.update_xaxes(showgrid=True)` |
| Fonts | `plt.rcParams[...]` or text methods | Use Matplotlib font settings or Seaborn context helpers | `fig.update_layout(font=dict(...))` |
| Subplots | `plt.subplots(...)` | `FacetGrid`, `catplot`, `relplot`, or Matplotlib subplots` | `make_subplots(...)` |
| Annotations | `ax.annotate(...)`, `ax.text(...)` | Same Matplotlib tools after plotting | `fig.add_annotation(...)` |
| Error bars | `ax.errorbar(...)` | `errorbar=` on modern categorical and line functions | `error_y=...` or `error_x=...` |
| Export settings | `fig.savefig(path, dpi=300, bbox_inches='tight')` | Same Matplotlib save step using `g.fig.savefig(...)` | `fig.write_html(...)` and `fig.write_image(...)` |
