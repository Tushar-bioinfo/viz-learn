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
| `` `say` has N words (≤ 14) ``; also `think q` and an item's `say` (≤ 14), `note` (≤ 16), `think a` (≤ 18) | cut it, or move the rest to the next step. Lift the limits only when the learner asked for the full voice |
| `` `say` has N words (≤ 50 in the full voice) ``; also `think q` (≤ 24), `think a` (≤ 40), `note` (≤ 30) | split it over two steps |
| `` `say` has a sentence of N words (≤ 24) `` | the full voice writes more sentences, not longer ones: split the sentence |
| `` `say` joins two thoughts with “;” `` | write two sentences, joined by a word such as So, But or Because |
| `` this step works a `calc` but never says why `` (or a `col`, an `assemble`) | add `why:` to the step: the reason we do it, or what it lets us do next, in 12 words or fewer. A `calc`'s own `why` counts |
| `` `why` is the reason at the end of the step's `say` `` | give the step a `say`; write `why` as one line of text |
| `` `why` has N words (≤ 12) `` | cut it to the reason alone; the step's `say` holds what we do |
| `` steps N, M each open extra reading `` | keep one step `more` a scene; move the rest into the scene's `more` |
| `` `more` is `{ask, answer, sources}` `` / `` `more` has no field … `` | write the question as `ask`, the paragraphs as `answer`, any pages as `sources` |
| `` `more` ask … ending in `?` `` / `` `more` ask has N words `` | the fold's label is the learner's question, 14 words at most |
| `` `more` holds N words (≤ 160) `` / `` `more` has a sentence of N words `` | keep the reason that matters most, in short sentences; point to a source for the rest |
| `` a refresher needs `ask:` `` / `` `ask` is the link line of a `refresher` scene `` | give the refresher its link line as a question ("Rusty on the mean?"); only a `beat: refresher` scene has one |
| `` `refresh: X` names no scene `` / `` links to a `… ` scene `` / `` links back to an earlier scene `` | `refresh` names the `id` of a `beat: refresher` scene placed after `next` |
| `` a refresher sits at the end `` | move the refresher scene after the `next` scene, so the story runs on without it |
| `` no step links here `` | add `refresh: <id>` to the step that first needs the idea, or delete the refresher |
| `` no transfer stop `` | near the end, add a `think` with `transfer: <field>` that asks where the same move works in another field |
| `` a transfer stop in scene N of M `` | move it to the last third of the lesson, once the method is known |
| `` `transfer` is N words `` / `` `transfer` names the other field `` | name only the field ("replicate wells on a plate"); the case goes in the question |
| `` `think` has no field … `` | a think takes `q`, `a`, `set` and `transfer` |
| `` … needs `title`, `url` and `why` `` / `` `url` is a full https:// link `` | each source is a page you opened: its title, its https link, and what the reader gets from it |
| `` `voice: …` is `short` … or `full` `` | set `learner.voice` to `short` or `full`, or leave it out for short |
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
| `` plane `quarters` takes the point where the two zero lines cross `` | write `quarters: [cx, cy]`, two numbers or expressions, like `[0, 0]` for centred data |
| `a plane with fill stretches its axes` | delete `fill`, or drop the `vector`, `foot` or `square` |
| `space mark N is one of …` / `space mark N (kind) has no field X` | one mark kind per entry (`ring: true` on a `point` is a field); quote a value that has a comma |
| `` space mark N (kind) has `name:` `` | a space draws no names on its marks: give it `label:` (its legend entry) and `says:` (its card) |
| `` space `axes` is 3 names `` / `` space `max` is 3 numbers `` | write `axes: [x, y, z]`; leave `max` out and the kit sizes the axes |
| `space X is not 3 numbers` | a position is a name that holds 3 numbers (a `kind: vector` symbol, a data list, a derive) or a written `[x, y, z]` |
| `` space `sheet` takes two vectors `` / `` needs `max: [a, b]` `` | `sheet: [U, V]` with `max: [a, b]`, how far it runs along each vector |
| `` space `foot.onto` is 1 vector … or 2 vectors `` | `onto: U` drops onto the line along U; `onto: [U, V]` onto the plane they span |
| `space sheet [U, V]` / `space foot onto [U, V]`: `the two vectors are zero or nearly point the same way` | they span no plane (the sine of their angle is under 1e-6): the sheet draws as a line and the drop is not drawn. Pick two vectors that point different ways |
| `N legend entries on one space: more than 5` | drop a `label` (that mark keeps no entry), or split the scene |
| `legend labels are for a quick read: 2 words at most` | cut the `label` to 2 words; move the rest to the mark's `says:` |
| `names on the plot are for a quick read: 2 words at most` | cut the mark's `name` to 2 words (`$…$` and `{{…}}` count as one); move the rest to its `says:` |
| `` X opens a pop-up card on the board, so it needs short: `` / `` `short` … has N words `` / `` `says` … only repeats `short` `` | give every symbol in a formula or brackets a `short` of 2 words at most; `says` adds what it means or is made from |
| `` a matrix's `fmt` is its number of decimals `` | `fmt: 1`, a whole number; `s3` and `,` do not apply to brackets |
| `N legend entries on one plane: more than 5` | name marks on the plot with `name:` and `says:`, or split the plane |
| `say what X is: add says: to the mark, or name it in a teacher line first` | give the mark `says:`, or name X in a `say` at or before the step that draws it (the later of the plane's step and the mark's own). `$x$` and `x`, `$\alpha$` and `α` count as the same name |
| `` plane/space/chart mark N (X) has a legend entry but no linked word by step S `` | write `==X==` (or `==X:your words==`) in a teacher line or the lead, at or before step S. A label with `{{…}}` or `$…$`: give the mark a one-word `id:` and link that |
| `` `==x==` names no mark, but is close to `y` `` / `` `==a:b==`: `a` is no colour and no mark `` | a typo: as written the page shows an orange underline (or the text `a:b`). Write the mark's exact label, `id` or symbol, or a colour token (`s1:` …) |
| `` `==x==` names a mark on slide N, not on this scene `` | a word links only to a mark of its own scene's figure: link a mark here, or reword it. A mark at a later step of the same scene is fine: its word waits |
| `linked words ==a==, ==b== all take the colour C in one figure` (or `colours that look the same`: a theme name counts as its value, `s1` is `#8ec5ff`) | the learner cannot tell which mark a word means: give one mark its own `color:` |
| `` `==x==`: `x` names N marks in this scene `` | two marks share that label, `id` or symbol, and the page would light the first: give the one you mean its own `id:` and link that |
| `` plane mark N: `name: X` is not drawn, since a linked word names the mark `` | delete `name:`; the legend entry and the word carry it |
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
| `` `calc say` “Red steps: red part” reads as made-up shorthand `` (also `eqn`, `assemble`, a `col`'s `label`) | two short phrases joined by a colon read as code names: say it as one plain phrase (‘red light that lands in red’). A digit, `$…$` or `{{…}}` on either side, or a lead word on the left (`Note:`, `Why:`, `Step:` …), is fine |
| `` X ($a$), Y ($b$) all have `short` “…” `` | two symbols with different TeX share a name, so the legend and the cards cannot tell them apart: give each its own 2-word `short` (`CD3–CD19 covariance`). One quantity under two data names may share it when the TeX is the same |
| `` `say` “…” only says what to do on the page `` | every sentence was only press, click, tap, drag, scroll, hover, watch, look, or move / slide / try / use the slider (or toggle, dial, button, play): say what changes, with its number (‘the area falls to {{area|2}}’). A clause that says what happens (‘Move the slider and the mean rises.’), or another sentence that says what is shown, is fine |
| `an adv scene names its idea, the one mark that carries it and the picture: add …` | an adv lesson (any scene has `idea`): give every scene but `plan`, `summary` and `next` its `idea`, `see` and `shows` (`adv.md` §2) |
| `` `idea: X` is not in the idea table `` (maybe `did you mean …?`) | use a table name (`adv.md` §3), or write the learner's own question ending in `?` |
| `` `idea: X` is drawn with …, and this scene has none of them `` | draw the scene with one of the listed items, pick the idea that fits the picture, or write the learner's own question ending in `?` |
| `` `see: X` names nothing this scene draws `` | `see` is a mark's `label` or `id`, a chart series name, a symbol the scene shows, or a table column: fix the spelling, or name the mark that carries the point |
| `` `see: X` is the mark that carries the point, but no teacher line links its word `` | write `==X==` (or `==X:your words==`) in the scene's `lead`, a `say` or a think question; a think answer does not count. A column or series with the same name does not stand in for the mark |
| `` a `shortcut` scene (or `misconception`, `limits`) … holds one state `` | put the wrong way beside the right way on one frame: a `compare`; a toggle or slider that the figure reads (in a mark, a series or through `derive`); or the other way as a mark with `step:` (a later step) or `when:` |
| `` the idea `X` fills N scenes and the depth budget is D `` | merge scenes on that idea, or ask the learner for more depth and set `learner.depth` |
| `` `depth: X` is how many scenes one idea may fill `` | a whole number from 1 to 6, or leave it out for 2 (checked only in an adv lesson) |
| `` `idea` belong on a board scene; this is a `T` slide `` (also `see`, `shows`) | move the plan to a `type: board` scene, or delete it |
| `` `chance` compares exactly two groups `` / `` a `chance` group needs `name:` / `n:` / `ill:` `` | two groups, each `{name, n, ill}` (`adv.md` §9) |
| `` `chance` group X: `n` is … `` / `` `ill` is … at frame F while `n` is … `` | `n` is the group's units, a whole number 1–100; `ill` counts those with the outcome, 0 to `n`, checked on each state of the run or slider: fix `make_data.py` or the derive |
| `` `chance` group X: `ill` is True `` / `` is `name`: unknown name … `` / `` is `xs`, a list in the data `` (also `n`, `step`) | a number, or a name from data, controls or derive. Arithmetic is allowed: the lint lets it through and the browser check warns if the page has to clamp it |
| `` `ill` reads `at(xs, draw)`, but `xs` has N entries and the run `draw` has M frames `` | the list needs one entry per state of its control (a longer list is fine) |
| `` the gap is N noise steps …; a ruler counts up to 12 `` | `step` is a share (0.05), not a percent (5); the ruler draws at most 12 steps |
| `` a `chance` group is named `gap` `` / `` both `chance` groups are named X `` / `` a second `chance` figure `` | `gap` and `noise step` (any case or spacing) are the figure's own marks; two groups, two names; one `chance` per scene, a second comparison in its own scene |
| `` `X` names 2 marks in this scene (chance mark …, plane mark …): rename one `` | a `chance` mark and another figure's mark share a name: rename the other mark, or the group |
| `` `chance` `step` is … `` | one noise step is a share above 0; leave `step` out for no ruler |
| `` `chance` `tally` … this scene has none `` / `` has N entries but the run has M frames `` / `` holds values other than 0 and 1 `` | a tally needs the scene's run control, and exactly one 0 or 1 per frame, frame 0 first |
| `` `chance` has no field X `` (maybe `did you mean …?`) | a typo, or a comma in an unquoted `{ }` value: the fields are in `adv.md` §9 |

The browser check adds: `a plane is N wide per 1 tall` (change its ranges, or the spacing of what it shows), `a chart is W × H px` (set its `ratio`), `a plane is only W × H px` (also a `chance`: give it more room, or split the scene), `the chance figure's units are N px` / `tally squares are N px` / `one noise step is only N px` (more room, or a larger `step`; under 16 px the ruler drops its numbers), `the chance figure: … (at frame F)` (a value the page clamped, or a tally that does not match the run: the lint row above says what it must be), `a formula renders under 20px`, `a table cell renders under 18px`, `mark target not found`, `a worked line … reads ≈` (finer `fmt` on the inputs), `point … is outside the picture` / `plane mark N is outside the box` (widen the box), `the plane label … overlaps` (shorter names, or move a mark), `a formula is wider than its box` (split it: at 20 px, above its text, it still does not fit), `the run's show: X is a list, so its value column has no value` (show one number the run moves), `space mark N (kind): X is not 3 numbers` (a derive or data name gave something else), `reaches past the axes' max` (leave `max` out), `reaches past the axes at t = …` (a value the sizing did not try: give the space `max: [x, y, z]`), `no drop is drawn` / `the sheet is a line` (two vectors that point nearly the same way), `the space drew a point that is not a number`, `the space's name … covers a mark at this view` (shorter axis names), and `X works out to … on the board but the data says …` (`make_data.py` and the page disagree: fix one).
