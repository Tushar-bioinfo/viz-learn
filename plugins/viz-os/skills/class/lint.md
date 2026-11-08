# What a lint message means

Read this after a build or a check fails. `lesson.py` prints the deck's messages and these. `ERR` must be fixed; `WARN` is a judgement call, fixed unless you have a reason.

| Message (shortened) | Fix |
|---|---|
| `N scenes; a lesson is 8–14` | add the missing beats, or split into a series |
| `the first scene after the title … is a plan scene` | start with `beat: plan` |
| `the plan is its picture, so it has no lines of text` | delete the `say` and keep the `flow` |
| `a formula scene before any problem scene` | show the problem first |
| `no limits scene` / `limits comes after next` | add one, before `next` |
| `a what-if scene with no picture` | add a `chart` or `plane` whose marks read the slider |
| `no summary scene` | a `recap` slide that answers the opening question, before `next` |
| `no next scene` / `the next tease is the last scene` | one `next` scene, at the end |
| `a class lesson has no quiz cards` | delete the slide; keep any good question as a `think` stop |
| `a class lesson has no recall cards` | delete `recall:`; reach back with a `think` stop near the start |
| `no lead` | one short line linking the scene to the last |
| `N steps (≤ 10)` | split the scene |
| `6 steps in a row with no think stop` | add a `think` step |
| `` `say` has N words (≤ 14) ``; also `think q` and an item's `say` (≤ 14), `note` (≤ 16), `think a` (≤ 18) | cut it, or move the rest to the next step |
| `` `beat` is …; use one of … `` | a beat from the list above |
| `unknown step field` / `a step needs say` | steps take `say`, `add`, `mark`, `think`, `frame` |
| `` `calc` has no field X `` (also `col`, `eqn`, `assemble`, `params`) | a comma inside an unquoted `{ }` value split it into a second key: quote the value |
| `each added item is one of …` | a typo in an item key, or an item at the wrong level |
| `` `mark: …` is not a target `` | `row:<i>`, `col:<key>`, `cell:<i>:<key>`, `#<id>` |
| `symbol X shows on slide …, but its number first shows on …` | show the number first: a worked line, a column, or `{{name}}` |
| `` `assemble` uses X, whose number was not worked in an earlier by-hand scene `` | work it by hand first |
| `X is a matrix used on … before it is drawn with its numbers` | draw it first: `add: {matrix: X}` (or `vec:`), or `X = \mat{X}` inside `$…$` or a formula. Brackets with no `X =` beside them, or `\mat` outside maths, do not count |
| `kind: matrix draws X from the data, but data.json has no X` / `X … is not a list of numbers` / `is a flat list … a vector` / `is N rows of M, a matrix` | write X in make_data.py as a list of rows (a matrix) or a flat list (a vector), and give the `kind` that fits |
| `cols: gives N colour(s), but X has M columns` (also `rows:`) / `a vector takes rows:` | one colour per column or row; a vector takes `rows:` |
| `X is not a symbol` / `X has no kind: matrix or kind: vector` / `draw it with vec: X, not matrix: X` | `matrix:`, `vec:` and `\mat{}` name a symbol with `kind: matrix` or `kind: vector`, by the item that fits its kind |
| `cols: and rows: colour a matrix or a vector` / `give cols: or rows:, not both` | add `kind: matrix` or `kind: vector`; keep one colour list |
| `\mat{…} outside $…$` / `X and Y are both written $X$` / `one formula shows its \mat objects with 1 and 2 decimals` | put it inside `$…$`; give the matrix its own TeX; use one `\mat{X|d}` across the formula |
| `a formula scene builds its formula with an assemble item` | add the `assemble` |
| `` `assemble` has a line between its numbers and its symbols `` | add a step after it |
| `an assemble with tex needs plug` / `a number in plug has no tag` | write `plug` with each number as `[name:number]` |
| `N terms: more than 5 is a wall` | build it over two scenes |
| `typed number N in say matches X` | write `{{X|fmt}}` |
| `` `ops` has N steps and each one takes a board step `` | add that many board steps after it |
| `a calc with row: reads that row of the scene's table` | give a row number from 0, and a `table` |
| `` `params` name X is not in data, derive or the worked lines `` | work it first, or add it to data |
| `` `rows: X` names data, which a table cannot read `` | write `from: X` |
| `the line for X has its own name as its formula` | write the formula from the names it is made of |
| `plane mark N is one of …` / `plane line takes 3 values` | one mark kind per entry; quote expressions with commas |
| `plane mark N (kind) has no field X` | X is not a mark field; when X reads like the end of a sentence, a comma in an unquoted `says:` or `label:` cut it off: quote the value |
| `` has both `rgb` and `color` `` (or `colors`): `use one` / `` `rgb` colours a `point` or `points` dot `` / `rgb has no field X` | keep `rgb` for a dot whose colour comes from its numbers, `color` for a fixed one; `rgb` takes a number or `{r, g, b, max}` |
| `` name “X” says red, but its colour (8, 4, 0) reads as orange (#cc6600) `` (also a `label`, a dot's label, or a `points` mark's own name read against each dot; a typed hex too) | the colour word does not fit what is drawn: change the word to the one it reads as, or name the mark by its id (`p5`). A word before a channel noun (`red level`, `green sensor`, `red channel`) is not checked. With `at leak s = 1`, the word is true at the start but not at that control's end: name it by id, or by a word that stays true |
| `its rgb does not work out to numbers with a max above 0` / `row N has no number for rgb r: key` | each of `r`, `g`, `b` and `max` must be a number or an expression the page can work out, and `max` above 0. On `points`, a channel written as a name is that row's key, never a value from `data`: give every row the key |
| `a plane with fill stretches its axes` | delete `fill`, or drop the `vector`, `foot` or `square` |
| `legend labels are for a quick read: 2 words at most` | cut the `label` to 2 words; move the rest to the mark's `says:` |
| `names on the plot are for a quick read: 2 words at most` | cut the mark's `name` to 2 words (`$…$` and `{{…}}` count as one); move the rest to its `says:` |
| `` X opens a pop-up card on the board, so it needs short: `` / `` `short` … has N words `` / `` `says` … only repeats `short` `` | give every symbol in a formula or brackets a `short` of 2 words at most; `says` adds what it means or is made from |
| `` a matrix's `fmt` is its number of decimals `` | `fmt: 1`, a whole number; `s3` and `,` do not apply to brackets |
| `N legend entries on one plane: more than 5` | name marks on the plot with `name:` and `says:`, or split the plane |
| `say what X is: add says: to the mark, or name it in a teacher line first` | give the mark `says:`, or name X in a `say` at or before the step that draws it (the later of the plane's step and the mark's own). `$x$` and `x`, `$\alpha$` and `α` count as the same name |
| `` `\boxed` draws a box `` (also `\fbox`, `\framebox`, `\colorbox`, `\fcolorbox`) | delete the box: the last line of the working is the answer. To make its number stand out, bold it: `\mathbf{…}` in maths, `**…**` in text |
| `` a `product` step holds only the product `` | move the step's `say`, `mark`, `think` or other items to the step before or after; to change its lines, give `says:` |
| `` `X` has N columns but `v` has M entries `` | the product needs `m`'s columns = `v`'s rows: check which is which, or transpose one in make_data.py |
| `` `name: X` is also an input `` / `` `y` is already the result of … `` | give the result its own symbol; the same product twice (rows way, then columns way) may share one |
| `` `v` was drawn as a row … but a product reads it as a column `` | draw it as a column (`vec: v`) before the product, or make it a one-row matrix |
| `` `_draws` is a marker the kit writes `` (any key starting with `_`) | delete it: only the kit writes these |
| `` `says:` has N line(s), but this product writes M lines `` | one teacher line per line of working, in order (the message gives the count) |
| `` `plane: true` needs `way: cols`, a vector `v`, and an `m` with 2 rows `` | a plane has two axes, one per row of `m`: drop `plane`, or use the columns way on a 2-row matrix |
| `` `name` comes out as a vector / matrix `` / `data.json holds name as …` | give the result's symbol the kind and the shape the product makes |
| `cannot tell the size of X` | keep X's (starting) numbers in data.json, even when a derive remakes it |
| `` X works out to [...] on the board but the data says [...] `` | the product and data.json's copy of its result disagree: fix make_data.py, or drop the copy |
| `` control …: `run` is the number of frames `` / `stops … are not frames` | `run` ≥ 2; stops between 0 and run − 1 |
| `the run stops on N frames, one per step, but the scene has M steps` | one stop per step, or `frame:` on the steps |
| `one run per scene` | split the scene |
| `` control X: no `label`, and X is not a symbol `` | add X (or the run's `show:` name) under `symbols`, so its TeX is the label; or give `label:` one word |
| `` control X: `label` “…” is N words `` | one word, or the symbol; put the meaning in the control's `says:` (or the symbol's) |
| `control X: no card says what it means` | give the control `says:`, or name it after a symbol |
| `` `show: X` is not in data, derive or controls `` / `` `show:` names what a run's value column shows `` / `` `show: X` is a list of numbers `` | name one number the run moves (`derive: {s: t / 20}`, `show: s`); a slider or toggle takes no `show`; draw a matrix or vector with `\mat{X}` instead |
| `` `label` is not shown, because the symbol s labels this control `` | delete the `label:`: the symbol's TeX is the label, its card the meaning |
| `control X: nothing on this scene reads it` | draw what it changes (a mark's coordinates or `when`, a worked line, `{{…}}`), directly or through `derive`; or delete it. A mark's `name` or `label` does not count |
| `` it remakes the matrix X, which this scene never draws `` (or vector) | write `X = \mat{X}` in a line on that scene, so its numbers change in view. A figure that only computes from X does not show it; a vector also counts as drawn as a plane `vector` or `point` that reads its entries |
| `` X changes with control … but has no `fmt:` `` | give the matrix or vector `fmt:` (decimals), so it does not jump from 1 to 1.00 to 1.0 |
| `` chart mark N has `label:` `` (or `text:`) / `` chart mark N is a `label` mark `` | on a board a mark has no tag: give it `name:` (2 words, in the legend) and `says:` (its card), or make its value a symbol (`{kind: hline, y: xbar}`), whose `short` and card it takes. Delete a `kind: label` tag; say it in a teacher line or a `note` |
| `` chart mark N: name “…” is N words `` | 2 words at most; the rest goes in `says:` |
| `chart mark N (point) has no name` (also `arrow`) | give it `name:` and `says:`, or a symbol as its `y`; an unnamed line, band or area is fine as a plain reference |
| `legend name “…” is N words` | a chart series `name` is 2 words at most (a `{{…}}` or `$…$` counts as one); say the rest in the caption or a teacher line |
| `N legend entries on one chart` | series names (when 2 or more) plus named marks: 5 at most. Set `legend: false` on context series, leave a reference line unnamed, or split the chart |
| `` chart mark N: `says` is not shown `` | the mark's value is a symbol, so its card is the symbol's: delete the mark's `says:` (edit the symbol's `says` instead) |
| `the legend cannot tell X and Y apart` | two named marks of one kind draw in one colour: give one a `color:` (or give its symbol one) |
| `` a control has no field X `` / `` a symbol has no field X `` | a comma inside an unquoted `{ }` value split it into a second key: quote the value |

The browser check adds: `a plane is N wide per 1 tall` (change its ranges, or the spacing of what it shows), `a chart is W × H px` (set its `ratio`), `a plane is only W × H px` (give it more room, or split the scene), `a formula renders under 20px`, `a table cell renders under 18px`, `mark target not found`, `a worked line … reads ≈` (finer `fmt` on the inputs), `point … is outside the picture` / `plane mark N is outside the box` (widen the box), `the plane label … overlaps` (shorter names, or move a mark), `a formula is wider than its box` (split it: at 20 px, above its text, it still does not fit), `the run's show: X is a list, so its value column has no value` (show one number the run moves), and `X works out to … on the board but the data says …` (`make_data.py` and the page disagree: fix one).
