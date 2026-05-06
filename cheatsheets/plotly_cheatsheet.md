# Plotly Cheatsheet

## Core Pattern

```python
fig = px.scatter(df, x="x", y="y", color="group", template="plotly_white")
fig.update_layout(title="Title", width=700, height=450)
fig.write_html("figure.html")
```

## Quick Recipes

- Line: `px.line(df, x="time", y="value", color="group", markers=True)`
- Scatter: `px.scatter(df, x="x", y="y", color="group", hover_data=[...])`
- Bar: `px.bar(df, x="group", y="value", barmode="group")`
- Histogram: `px.histogram(df, x="value", color="group", nbins=20)`
- Heatmap: `px.imshow(matrix, color_continuous_scale="Viridis")`
- Box: `px.box(df, x="group", y="value", color="group")`

## High-Value Parameters

- `color`, `symbol`, `size`, `hover_data`, `template`, `opacity`, `error_y`, `facet_col`
