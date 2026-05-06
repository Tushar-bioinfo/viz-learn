# Seaborn Cheatsheet

## Core Pattern

```python
sns.set_theme(style="whitegrid")
ax = sns.scatterplot(data=df, x="x", y="y", hue="group", s=80)
ax.set(title="Title", xlabel="X label", ylabel="Y label")
```

## Quick Recipes

- Line: `sns.lineplot(data=df, x="time", y="value", hue="group")`
- Scatter: `sns.scatterplot(data=df, x="x", y="y", hue="group")`
- Bar: `sns.barplot(data=df, x="group", y="value", errorbar="sd")`
- Histogram: `sns.histplot(data=df, x="value", hue="group", bins=20)`
- KDE: `sns.kdeplot(data=df, x="value", hue="group", fill=False)`
- Heatmap: `sns.heatmap(matrix, cmap="mako", annot=False)`

## High-Value Parameters

- `data`, `x`, `y`, `hue`, `style`, `palette`, `errorbar`, `estimator`, `fill`
