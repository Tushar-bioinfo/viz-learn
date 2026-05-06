# Plotting Concepts Cheatsheet

    | Concept | Meaning | Quick reminder |
| --- | --- | --- |
| Figure | Full canvas | One figure can contain many axes. |
| Axes | Single plotting area | Most labels and titles belong here. |
| Legend | Mapping guide | Remove it if it repeats obvious labels. |
| Ticks | Scale markers | Keep them readable and not too dense. |
| Palette | Set of colors | Use categorical palettes for groups. |
| Colormap | Numeric color scale | Use for heatmaps and numeric encodings. |
| DPI | Raster sharpness | 300+ for print. |

    ## Which Plot for Which Question

    | Question | Use |
| --- | --- |
| How does a number change across ordered time or distance? | Line plot |
| Do two numeric variables move together? | Scatter plot |
| How large are group summaries? | Bar plot |
| How do multiple groups compare inside the same category? | Grouped bar plot |
| What is the distribution of one numeric variable? | Histogram |
| What does the smoothed shape of a distribution look like? | KDE plot |
| What are the median, spread, and outliers per group? | Box plot |
| What is the full distribution shape per group? | Violin plot |
| Where are individual observations inside categories? | Strip or swarm plot |
| How does one value change across a matrix of rows and columns? | Heatmap |
| How strongly are variables correlated? | Correlation heatmap |
| What is the uncertainty around a mean or estimate? | Error bar plot |
| Can I compare several related panels at once? | Multi-panel figure |
| How do high-dimensional samples cluster after reduction? | PCA or UMAP-like embedding |
| Which genes have both large fold change and strong significance? | Volcano plot |

    ## Fast Workflow

    1. Identify the question.
    2. Check the data shape.
    3. Pick the simplest matching plot.
    4. Label clearly.
    5. Export carefully.
