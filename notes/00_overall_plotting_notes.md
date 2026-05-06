# Overall Plotting Notes

Plotting is the process of turning data into a visual object that people can read quickly.
A good figure reduces mental work. It makes the important pattern visible without forcing
the reader to hunt for it.

## Basic Vocabulary

- **Figure**: the full canvas that holds one or more plots.
- **Axes**: the plotting area where data is drawn. One figure can hold multiple axes.
- **Subplot**: one axes object inside a grid of several axes.
- **Title**: a short sentence that tells the reader what the figure is about.
- **Axis label**: text that names the meaning of the x-axis or y-axis.
- **Tick**: the marks and values shown along an axis.
- **Legend**: the guide that explains colors, line types, or marker shapes.
- **Annotation**: extra text or arrows used to point at something important.
- **Resolution / DPI**: dots per inch. Higher DPI gives sharper raster images.

## Figure Anatomy

A simple workflow is:

1. Start with a question.
2. Check what columns or variables answer that question.
3. Pick a plot type that matches the data and the message.
4. Draw a clear draft.
5. Improve labels, colors, and spacing.
6. Export the final figure in the right format.

## Common Data Shapes

- **One numeric column**: histogram, KDE, box plot.
- **One category plus one numeric column**: bar plot, box plot, violin plot, strip plot.
- **Two numeric columns**: scatter plot, line plot.
- **Matrix or table of values**: heatmap.
- **High-dimensional matrix**: PCA or UMAP-like embedding after dimensionality reduction.

## Labels, Legends, and Ticks

- Titles should describe the message, not just repeat the variable name.
- Axis labels should include units when units exist.
- Legends should be removed if they repeat labels already printed on the plot.
- Tick labels should be readable without rotating them unless rotation is truly needed.
- Keep decimal precision honest. Do not show five decimals when one is enough.

## Color

- Use color to encode meaning, not decoration.
- Use categorical palettes for groups and continuous colormaps for numeric values.
- Avoid relying on red versus green alone because many readers have color-vision limitations.
- Keep background and grid lines quiet so the data carries the attention.

## DPI and File Formats

- **PNG**: raster format. Good for slides, notebooks, and quick sharing.
- **SVG**: vector format. Good for diagrams, line art, and web use.
- **PDF**: vector-friendly and common for papers and supplements.
- **HTML**: best for interactive Plotly figures.
- Use **300 DPI** or higher for print-style raster exports.

## Plotting Workflow

- Start with a rough plot and confirm the data is correct.
- Check scales, missing values, and category order early.
- Simplify: remove decoration that does not help interpretation.
- Polish: fonts, spacing, line widths, and export settings.
- Verify: open the saved file and check it outside the notebook.

## Which Plot Should I Use?

| Question | Good plot | Why |
| --- | --- | --- |
| How does a number change across ordered time or distance? | Line plot | Use when x-axis order matters. |
| Do two numeric variables move together? | Scatter plot | Add color or shape for groups. |
| How large are group summaries? | Bar plot | Use only for summaries, not raw distributions. |
| How do multiple groups compare inside the same category? | Grouped bar plot | Keep the number of groups small. |
| What is the distribution of one numeric variable? | Histogram | Good first look at spread and skew. |
| What does the smoothed shape of a distribution look like? | KDE plot | Works best with enough observations. |
| What are the median, spread, and outliers per group? | Box plot | Compact summary for several groups. |
| What is the full distribution shape per group? | Violin plot | Shows density shape, not just quartiles. |
| Where are individual observations inside categories? | Strip or swarm plot | Useful when the dataset is not too large. |
| How does one value change across a matrix of rows and columns? | Heatmap | Strong choice for tables of values. |
| How strongly are variables correlated? | Correlation heatmap | Use a limited set of variables for readability. |
| What is the uncertainty around a mean or estimate? | Error bar plot | State clearly what the error bars represent. |
| Can I compare several related panels at once? | Multi-panel figure | Keep scales consistent when possible. |
| How do high-dimensional samples cluster after reduction? | PCA or UMAP-like embedding | Use for exploration, not final proof on its own. |
| Which genes have both large fold change and strong significance? | Volcano plot | A common genomics summary plot. |

## Good Habits

- Use consistent fonts and color palettes across a project.
- Prefer direct labels or simple legends.
- Save source data tables when the plot is important.
- Keep notebooks reproducible by fixing random seeds.
- Re-read the figure as if you were a new reader, not the author.

## Official References

- [Matplotlib user guide](https://matplotlib.org/stable/users/index.html)
- [Seaborn tutorial](https://seaborn.pydata.org/tutorial.html)
- [Plotly Python graphing library](https://plotly.com/python/)
