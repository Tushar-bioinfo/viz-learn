# Seaborn Notes

    ## What Seaborn Is

    Seaborn is a high-level statistical plotting library built on top of Matplotlib.
    It is designed around tidy dataframes and makes grouped, polished plots easy to create.

    ## When to Use It

    - When your data is already in a pandas dataframe.
    - When you want cleaner defaults than raw Matplotlib.
    - When you want statistical summaries or faceted panels quickly.

    ## Important Functions

    | Function | What it does | Typical use |
| --- | --- | --- |
| `sns.scatterplot` | Scatter plot with tidy-data semantics. | Grouped relationships. |
| `sns.lineplot` | Line plot with optional grouping. | Time or ordered series. |
| `sns.barplot` | Summary bar plot with aggregation. | Category means. |
| `sns.histplot` | Histogram and related distribution views. | Distribution checks. |
| `sns.kdeplot` | Smoothed density estimate. | Distribution shape. |
| `sns.boxplot` | Box-and-whisker summaries. | Grouped spread. |
| `sns.violinplot` | Density-shaped category comparison. | Full distribution shape. |
| `sns.heatmap` | Matrix display with annotations and colormaps. | Heatmaps and correlations. |
| `sns.FacetGrid` | Multi-panel small multiples. | Compare the same pattern across groups. |

    ## Important Parameters

    | Parameter | Why it matters |
| --- | --- |
| `data` | Passes a whole tidy dataframe. |
| `x`, `y` | Choose columns for axes. |
| `hue` | Maps a grouping column to color. |
| `style` | Maps a grouping column to marker or line style. |
| `palette` | Chooses the categorical or continuous palette. |
| `errorbar` | Controls uncertainty summaries in modern Seaborn. |
| `estimator` | Defines how grouped values are summarized. |
| `fill` | Turns fills on or off for some distribution plots. |

    ## Strengths

    - Excellent defaults for style and color.
    - Works naturally with tidy pandas dataframes.
    - Very fast for exploratory analysis and teaching.

    ## Weaknesses

    - Some advanced layout control still requires Matplotlib afterward.
    - Figure-level APIs can feel less direct to beginners.
    - Defaults can hide aggregation behavior if you do not read the function docs carefully.

    ## Best Practices

    - Keep data in tidy long-form tables when possible.
    - Use `hue` only for meaningful groupings.
    - Read the defaults for summary functions such as `barplot` and `lineplot`.
    - Edit the returned Matplotlib axes when you need final polishing.

    ## Common Mistakes

    - Treating Seaborn like a drop-in replacement for every Matplotlib call.
    - Forgetting that some functions summarize data by default.
    - Using too many `hue` categories in one plot.
    - Ignoring missing values in datasets like `penguins`.

    ## Documentation

    - [Seaborn documentation](https://seaborn.pydata.org/)
    - [Seaborn API reference](https://seaborn.pydata.org/api.html)
