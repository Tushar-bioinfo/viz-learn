# Common Parameters Across Matplotlib, Seaborn, and Plotly

One of the easiest ways to get comfortable with plotting is to stop memorizing full commands and start learning shared ideas.

The shared idea is the real skill.
The library-specific syntax is just the spelling.

## The Big Comparison Table

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

## How to Read the Table

Read it like a translation guide:

- ask what concept you want
- find the column for your library
- copy the syntax pattern

The beginner mistake is trying to memorize entire libraries.
A better approach is to memorize concepts such as:

- size
- labels
- color
- legend
- export

## Group 1: Figure Size, Title, and Axis Labels

These are the minimum controls you should learn first in every library.

```python
# Matplotlib
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(x, y)
ax.set_title("Passengers over time")
ax.set_xlabel("Year")
ax.set_ylabel("Passengers")

# Seaborn
fig, ax = plt.subplots(figsize=(8, 4.5))
sns.lineplot(data=line_data, x="year", y="passengers", hue="month", ax=ax)
ax.set_title("Passengers over time")
ax.set_xlabel("Year")
ax.set_ylabel("Passengers")

# Plotly
fig = px.line(line_data, x="year", y="passengers", color="month")
fig.update_layout(
    width=800,
    height=450,
    title="Passengers over time",
    xaxis_title="Year",
    yaxis_title="Passengers",
)
```

Beginner translation:

- first make room for the plot
- then give it a clear title
- then make sure both axes say what they mean

![Line plot example](../outputs/figures/05_line_plot.png)

## Group 2: Color, Marker Size, Marker Shape, and Transparency

These settings answer:

- how groups are separated visually
- how dense points are handled
- how much attention the marks pull

```python
# Matplotlib
ax.scatter(x, y, color="steelblue", s=70, alpha=0.65, marker="o")

# Seaborn
sns.scatterplot(data=iris, x="sepal_length", y="petal_length", hue="species", s=80, alpha=0.75)

# Plotly
fig = px.scatter(iris, x="sepal_length", y="petal_length", color="species")
fig.update_traces(marker=dict(size=10, opacity=0.75, symbol="circle"))
```

Simpler explanation:

- use color to separate meaning
- use size carefully so points do not become clutter
- use transparency when many points overlap

![Scatter plot example](../outputs/figures/06_scatter_plot.png)

## Group 3: Legends, Ticks, Limits, and Grids

These control readability more than raw data drawing.

```python
# Matplotlib
ax.legend(frameon=False, title="Species")
ax.set_xlim(4, 8)
ax.tick_params(axis="x", labelrotation=0)
ax.grid(alpha=0.2)

# Seaborn
ax.legend(frameon=False, title="Species")
ax.set_ylim(1, 7)
ax.tick_params(axis="x", rotation=15)
ax.grid(alpha=0.2)

# Plotly
fig.update_layout(legend_title_text="Species")
fig.update_xaxes(range=[4, 8], tickangle=0, showgrid=True)
fig.update_yaxes(range=[1, 7], showgrid=True)
```

What these do:

- legends explain encoding
- tick controls make labels readable
- limits zoom the plot appropriately
- grids help with value reading

![Customization example](../outputs/figures/23_customization_plot.png)

## Group 4: Subplots, Annotations, and Error Bars

These are the next layer after basic plotting.

```python
# Matplotlib subplot and annotation
fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].plot(x, y)
axes[1].scatter(x2, y2)
axes[1].annotate("Important point", xy=(7.0, 6.1), xytext=(6.2, 5.5))

# Seaborn error bars
sns.pointplot(data=tcell_counts, x="condition", y="count", errorbar="se")

# Plotly annotation and error bars
fig = px.bar(error_summary, x="condition", y="mean_count", error_y="se_count")
fig.add_annotation(x="Treatment A", y=520, text="Highest mean", showarrow=True)
```

Use these when:

- a single panel is not enough
- a key point needs explicit explanation
- uncertainty matters as much as the mean

![Multi-panel figure example](../outputs/figures/17_multi_panel_figure.png)

![Error bar example](../outputs/figures/16_error_bar_plot.png)

## Group 5: Export Settings

Export is the last step, but beginners should learn it early.

```python
# Matplotlib or Seaborn
fig.savefig("outputs/figures/my_plot.png", dpi=300, bbox_inches="tight")
fig.savefig("outputs/figures/my_plot.svg", bbox_inches="tight")
fig.savefig("outputs/figures/my_plot.pdf", bbox_inches="tight")

# Plotly
fig.write_html("outputs/figures/my_plot.html")
fig.write_image("outputs/figures/my_plot.png")
```

Rule of thumb:

- PNG for slides and notebooks
- SVG or PDF for vector workflows
- HTML when interactivity matters

## Beginner Strategy for Moving Between Libraries

If you know how to do something in one library, ask:

- what is the same concept here?
- where does this library store the title?
- where does this library store legend settings?
- how does this library save the figure?

That mindset is much more useful than memorizing disconnected commands.

## Official Documentation Links

- [Matplotlib user guide](https://matplotlib.org/stable/users/index.html)
- [Seaborn tutorial](https://seaborn.pydata.org/tutorial.html)
- [Plotly Python documentation](https://plotly.com/python/)
