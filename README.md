# python-plotting-guide

A reproducible learning project for Python plotting with Matplotlib, Seaborn, and Plotly.
The project starts with beginner-friendly plotting vocabulary and grows into publication-style
figures, synthetic bioinformatics examples, and export-ready outputs.

## What You Get

- A `pixi` environment with plotting, notebook, and statistics packages.
- A pre-executed Jupyter notebook with inline outputs.
- Local cached CSV copies of the real teaching datasets in `data/raw/`.
- Reproducible synthetic datasets written to `data/processed/` during notebook execution.
- Long-form notes and compact cheatsheets for review outside the notebook.
- Saved polished figures in `outputs/figures/`.

## Project Layout

- `pixi.toml`: reproducible environment and helper tasks.
- `data/raw/`: cached snapshots of `iris`, `tips`, `penguins`, `flights`, and `breast_cancer`.
- `data/processed/`: synthetic datasets generated with fixed random seeds.
- `notebooks/01_plotting_walkthrough.ipynb`: the main teaching notebook.
- `notes/`: detailed notes by concept and by library.
- `cheatsheets/`: compact reference material.
- `outputs/figures/`: exported figures created by the notebook.

## Setup

```bash
cd /Users/tusharsingh/Library/CloudStorage/OneDrive-UniversityofSouthFlorida/codex/visualizations/python-plotting-guide
pixi run import-check
pixi run execute-notebook
pixi run lab
```

## Learning Order

1. Read `notes/00_overall_plotting_notes.md` for plotting vocabulary and workflow.
2. Skim `cheatsheets/plotting_concepts_cheatsheet.md` for quick plot selection.
3. Work through `notebooks/01_plotting_walkthrough.ipynb` from top to bottom.
4. Use the library notes and cheatsheets when you want a focused reference.
5. Use `notes/06_publication_quality_checklist.md` before exporting a final figure.

## Pixi Tasks

- `pixi run import-check`: imports the main packages and prints version numbers.
- `pixi run execute-notebook`: runs the notebook in place and stores inline outputs.
- `pixi run lab`: launches JupyterLab in the project environment.

## Reproducibility Notes

- Real datasets are cached locally under `data/raw/` so the notebook does not depend on remote loading.
- Synthetic datasets use a fixed random seed and are regenerated into `data/processed/` each time the notebook runs.
- Plotly is rendered as static PNG inside the notebook for reliable execution, and as interactive HTML in the export section.

## Recommended Docs

- [Matplotlib documentation](https://matplotlib.org/stable/)
- [Seaborn documentation](https://seaborn.pydata.org/)
- [Plotly Python documentation](https://plotly.com/python/)
- [Jupyter documentation](https://docs.jupyter.org/en/latest/)
