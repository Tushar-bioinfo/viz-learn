# Publication Quality Checklist

Use this checklist before you call a figure complete.

## Message

- Is the main scientific or analytical point visible in less than ten seconds?
- Does the title describe the message instead of just naming the variables?
- Did you choose the simplest plot that answers the question?

## Data Integrity

- Are axes and units correct?
- Did you check for missing values, outliers, and category order?
- If error bars are present, is it clear whether they show SD, SE, or confidence intervals?

## Visual Design

- Are fonts readable at the final figure size?
- Are line widths and marker sizes visible but not heavy?
- Is the color palette consistent and accessible?
- Are grid lines light and supportive rather than dominant?

## Layout

- Are labels, legends, and annotations placed where they do not hide data?
- If there are multiple panels, do they share scales when comparison matters?
- Is there enough white space for the figure to breathe?

## Export

- PNG at 300 DPI or higher for raster output.
- SVG or PDF when vector output is preferred.
- HTML for interactive Plotly figures.
- Open the saved file outside the notebook and inspect it at the final viewing size.

## Reproducibility

- Save the figure from code, not by taking screenshots.
- Keep the data source and random seed documented.
- Make sure the notebook can rerun from top to bottom.
