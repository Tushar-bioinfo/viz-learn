# Unique Parameters and Ideas by Library

Shared plotting concepts are helpful, but each library has features that feel natural only inside that library.
These are the ideas worth learning after you understand the common plotting vocabulary.


## Matplotlib

| Unique idea | Why it matters |
| --- | --- |
| Artist model | Every line, patch, text label, and axis element is an artist object that you can edit directly. |
| `rcParams` | Global style dictionary for fonts, line widths, colors, and default figure behavior. |
| Transforms | Precise placement in data coordinates, axis coordinates, or figure coordinates. |
| Twin axes | Tools such as `ax.twinx()` make shared x-axes and separate y-axes easy. |
| Full control | Best choice when journals, collaborators, or templates demand exact placement. |

## Seaborn

| Unique idea | Why it matters |
| --- | --- |
| Semantic mappings | `hue`, `style`, and `size` connect visual encodings to columns in tidy data. |
| Figure-level APIs | `relplot`, `catplot`, `displot`, and `lmplot` automatically build faceted grids. |
| Statistical defaults | Many functions compute summaries, confidence intervals, or distributions for you. |
| Theme helpers | `set_theme`, `despine`, and context scaling quickly improve appearance. |
| Tidy-data bias | Works best when every row is one observation and each column is one variable. |

## Plotly

| Unique idea | Why it matters |
| --- | --- |
| Interactivity | Hover labels, zooming, panning, legend toggles, and HTML export are built in. |
| Templates | Layout themes such as `plotly_white` or custom templates apply consistent styling. |
| Rich hover text | You can expose extra columns with `hover_data` and `hover_name`. |
| Animations and dashboards | The same figure objects can feed dashboards or animated views. |
| Browser-native export | HTML output keeps interactivity without requiring a notebook. |
