# Matplotlib Notes

    ## What Matplotlib Is

    Matplotlib is the foundational plotting library in the scientific Python ecosystem.
    It gives you direct control over figures, axes, labels, legends, annotations, and export settings.

    ## When to Use It

    - When you need exact control over layout and styling.
    - When you are building publication figures panel by panel.
    - When another library returns Matplotlib axes and you want to polish them.

    ## Important Functions

    | Function | What it does | Typical use |
| --- | --- | --- |
| `plt.subplots` | Creates the figure and axes objects. | Starting almost any Matplotlib workflow. |
| `ax.plot` | Draws lines. | Time series or ordered x-values. |
| `ax.scatter` | Draws points. | Relationships between two numeric variables. |
| `ax.bar` | Draws bars. | Group summaries. |
| `ax.hist` | Draws histograms. | Distribution checks. |
| `ax.imshow` | Shows a 2D matrix as an image. | Heatmaps or images. |
| `ax.errorbar` | Draws points or lines with error bars. | Uncertainty summaries. |
| `fig.savefig` | Writes the figure to disk. | Final export. |

    ## Important Parameters

    | Parameter | Why it matters |
| --- | --- |
| `figsize` | Controls overall canvas size. |
| `color` | Sets line or fill color. |
| `linewidth` / `lw` | Changes line thickness. |
| `marker` | Adds point symbols to lines or scatter plots. |
| `alpha` | Controls transparency. |
| `s` | Controls scatter marker size. |
| `cmap` | Chooses a colormap for numeric color mapping. |
| `dpi` | Controls raster export sharpness. |

    ## Strengths

    - Extremely flexible.
    - Strong export support for PNG, SVG, and PDF.
    - Excellent for multi-panel figures and journal-style polishing.

    ## Weaknesses

    - More verbose than Seaborn or Plotly.
    - Beginners often struggle with the figure-versus-axes distinction.
    - Default styles can look plain unless you customize them.

    ## Best Practices

    - Start with `fig, ax = plt.subplots(...)`.
    - Set titles and labels on the axes, not with loose global commands.
    - Save with `bbox_inches='tight'` to avoid cut-off labels.
    - Use consistent `rcParams` if many figures should share one style.

    ## Common Mistakes

    - Mixing `plt.*` stateful calls and `ax.*` object-oriented calls without understanding the difference.
    - Forgetting to set figure size before drawing a complex plot.
    - Using default color cycles without checking readability.
    - Exporting low-resolution PNG files for print.

    ## Documentation

    - [Matplotlib documentation](https://matplotlib.org/stable/)
    - [Matplotlib gallery](https://matplotlib.org/stable/gallery/index.html)
