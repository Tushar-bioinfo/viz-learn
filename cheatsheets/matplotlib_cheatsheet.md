# Matplotlib Cheatsheet

## Core Pattern

```python
fig, ax = plt.subplots(figsize=(6, 4))
ax.plot(x, y, color="steelblue", marker="o")
ax.set(title="Title", xlabel="X label", ylabel="Y label")
fig.savefig("figure.png", dpi=300, bbox_inches="tight")
```

## Quick Recipes

- Line: `ax.plot(x, y, linewidth=2, marker="o")`
- Scatter: `ax.scatter(x, y, s=60, alpha=0.7)`
- Bar: `ax.bar(categories, values, color=...)`
- Histogram: `ax.hist(values, bins=20, edgecolor="white")`
- Heatmap-style matrix: `ax.imshow(matrix, cmap="viridis", aspect="auto")`
- Error bars: `ax.errorbar(x, y, yerr=err, fmt="o-", capsize=4)`

## High-Value Parameters

- `figsize`, `dpi`, `color`, `linewidth`, `marker`, `alpha`, `cmap`, `bbox_inches`
