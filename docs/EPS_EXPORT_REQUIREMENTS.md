# EPS export for Roland CutStudio: requirements

## What this is, in plain words

Roland CutStudio is the program that drives a vinyl cutter. It cannot import SVG, and its EPS reader is very picky: it understands only
a tiny part of the EPS language. This file describes, step by step, how to write an EPS file that CutStudio opens correctly, so that
the lines in it are cut at the right size, in the right direction, with nothing missing.

It is written for somebody who will build an EPS export in another project. It describes **what the file must look like** and **which rules the
numbers follow**. It does not say how to build it: programming language, libraries and tools are the choice of the project that uses this. The
rules were taken from a working export that was verified in a real CutStudio (2026-11-09): it imports, the size and direction are right
and it prints and cuts correctly. Everything that was not tried in CutStudio is marked as such. If a requirement says "exactly", it
means exactly: CutStudio's reader is crude, so do not improve, shorten or reword the fixed parts.

The requirements are numbered `EPS_EXPORT_REQ_001`, `EPS_EXPORT_REQ_002` and so on. Samples with expected results are at the end, with
the rules for checking your result against them (including a ban on faking the result).

## Words used

- **Input**: the drawing to export: a list of paths. A path is an ordered list of points (straight lines between them), and may also have arcs; it is
  open or closed. Distances are in millimetres. The input's y axis grows **downwards** (like a screen).
- **Point (pt)**: the unit of the output file, 1 pt = 25.4 / 72 mm = 0.352778 mm. 1 mm = 2.834646 pt.
- **moveto / lineto / curveto**: the three path commands, written `x y m`, `x y l` and `x1 y1 x2 y2 x3 y3 c`.

## Requirements: the file as a whole

**EPS_EXPORT_REQ_001** The export produces one text file per drawing. The file has three parts in this order: the fixed header (REQ_006), the path lines (REQ_010 to REQ_021) and the fixed tail (REQ_007). Nothing else is in the file: no other lines before, between or after.

**EPS_EXPORT_REQ_002** The file is plain text, ASCII only, no byte order mark. Every line ends with a single line feed character (LF, byte 10), never CR or CR LF. The last line also ends with an LF, so the file ends with a line feed. (Other line endings were not tried in CutStudio; do not use them.)

**EPS_EXPORT_REQ_003** The numbers in the path lines follow one format: a decimal point (never a comma), rounded to 3 decimals, trailing zeros and an unneeded decimal point removed (`141.732`, `70.866`, `50`, `0`), no exponent notation, no plus sign, no spaces inside a number. A value that rounds to zero is written `0` (never `-0`). Items on a line are separated by exactly one space.

**EPS_EXPORT_REQ_004** The bounding box is fixed. The header always says `%%BoundingBox: -10000 -10000 10000 10000` and `%%PageBoundingBox: -10000 -10000 10000 10000`, whatever the drawing's size is. The real bounding box of the drawing is not written there.

**EPS_EXPORT_REQ_005** The drawing must fit inside the fixed box: every written coordinate must stay within -10000 and 10000 pt (about 3527 mm). If something does not fit, the export must still write the file but report a warning that CutStudio may clip or ignore it (REQ_024).

## Requirements: the fixed header and tail

**EPS_EXPORT_REQ_006** The header is these lines, character for character, in this order (lines starting with `%` are part of it; the comment line 8 is part of the template and must stay):

```
%!PS-Adobe-3.0 EPSF-3.0
%%LanguageLevel: 2
%%BoundingBox: -10000 -10000 10000 10000
%%EndComments
%%BeginSetup
%%EndSetup
%%BeginProlog
% Short operator names used by the path below (standard PostScript, one line each).
50 dict begin
/q { gsave } bind def
/Q { grestore } bind def
/w { setlinewidth } bind def
/J { setlinecap } bind def
/j { setlinejoin } bind def
/M { setmiterlimit } bind def
/d { setdash } bind def
/g { setgray } bind def
/m { moveto } bind def
/l { lineto } bind def
/c { curveto } bind def
/h { closepath } bind def
/S { stroke } bind def
/n { newpath } bind def
%%EndProlog
%%Page: 1 1
%%BeginPageSetup
%%PageBoundingBox: -10000 -10000 10000 10000
%%EndPageSetup
% Cut lines only: thin outlines, no fills, no groups, no clipping.
q q
0 g
1.41732 w
0 J
0 j
[] 0.0 d
4 M q
```

The one line that can differ is `1.41732 w`: it is the line width 0.5 mm in points, rounded to 5 decimals. It is only a picture width (the cutter follows the centre of the line), so keep 1.41732.

**EPS_EXPORT_REQ_007** The tail is these lines, character for character, directly after the last path line:

```
% CutStudio skips the last line unless one more moveto follows it:
0 0 m
S Q
Q Q
showpage
%%Trailer
end
%%EOF
```

The line `0 0 m` is not decoration: CutStudio skips the last path of the file unless one more moveto follows it. It must be there also when the drawing has only one path, and it must be there exactly once.

**EPS_EXPORT_REQ_008** The header and the tail are not changed in any way (no extra comments, no other operators, no other line width form, no document title, no creator or date lines) unless the changed file has been opened in a real CutStudio and the result is the same. Only the verified template is known to work.

**EPS_EXPORT_REQ_009** The path lines contain no comments, no blank lines and no other operators than `m`, `l` and `c`. In particular the file never contains fills, clipping, groups, transparency, text, dashes other than the template's, `h` (closepath) or crop marks (`%%RolandCropMark` is not used). Only thin outlines are written.

## Requirements: the path lines

**EPS_EXPORT_REQ_010** Every path starts with a line `x y m`. Then, in the order of the input, come lines `x y l` for straight segments and lines `x1 y1 x2 y2 x3 y3 c` for curves (two control points and the end point). The next path starts with its own `m`. Nothing is written between two paths. The order of the paths in the input is kept.

**EPS_EXPORT_REQ_011** A closed path is closed by writing the first point of the path once more as a last `x y l` line. The path is never closed with `h`. (CutStudio does not close a path from `h`.) An open path is not closed: it just ends after its last segment.

**EPS_EXPORT_REQ_012** The first point and the direction of a path are taken from the input as they are. The program does not rotate the point order, reverse a path or choose another starting point. (Starting points and direction were fixed for the verification samples; the cutting order might depend on them, which was not tried.)

**EPS_EXPORT_REQ_013** Points are written as given: a point that equals the point before it is not removed or merged, and no point is invented. (A whole path is skipped only by the rule of REQ_019.)

**EPS_EXPORT_REQ_014** A rectangle, a triangle or any polygon is written as straight segments only: `m`, then one `l` per remaining point, then for a closed path the extra `l` back to the first point.

## Requirements: the coordinates

**EPS_EXPORT_REQ_015** The unit conversion: every input coordinate is first made relative to the drawing's origin (REQ_016, REQ_017) and then multiplied by 72 / 25.4. The factor is the exact fraction, not a rounded value; rounding happens only when the number is written (REQ_003).

**EPS_EXPORT_REQ_016** The origin of the output (0 0) is the **lower left corner of the drawing's bounding box**. The bounding box is the smallest box that contains all points of all paths, **including the control points of the curves** (a curve's control points count even when the curve itself stays inside). In input coordinates (y downwards) the corner is the smallest x and the largest y. After this step the output coordinates of all points are zero or positive.

**EPS_EXPORT_REQ_017** The y axis is flipped: the output y of a point is (origin_y - input_y) times the factor of REQ_015, and the output x is (input_x - origin_x) times the same factor, where origin_x and origin_y are the values of REQ_016. So the output y grows upwards and the picture is not upside down. A point at the top of the picture has the biggest y in the file.

**EPS_EXPORT_REQ_018** All paths of one file share the same origin and the same factor, so their distances stay as in the input. (For one drawing split into several files, for example one per colour, use the same origin for all of them, taken from the bounding box of the whole drawing, so they stay in register. This is an extra feature, not needed for a single file.)

## Requirements: what is skipped or reported

**EPS_EXPORT_REQ_019** A path with fewer than two distinct points is not written, and a warning says which one. Distinct means: the starting point counts as one, a straight segment to a point that is not the same as the point before counts as one more, each curve or arc counts as one more. A path that does not start with a moveto is not written, and a warning says so.

**EPS_EXPORT_REQ_020** A drawing with no path to write still produces a valid file: the header, no path lines, the tail, and a warning that there is nothing to export. In that case the bounding box and origin are 0 0.

**EPS_EXPORT_REQ_021** The export must not stay silent about a problem: every warning of REQ_005, REQ_019 and REQ_020 is returned to the caller together with the file (in whatever way the project reports messages). The file is written anyway.

## Requirements: arcs and circles

**EPS_EXPORT_REQ_022** The file contains no arc command. An arc is written as cubic Bezier curves (the `c` line). An arc has a centre (cx, cy), a radius r, a start angle a0 and a signed sweep (in radians, y downwards, positive sweep = growing angle), and starts at the current point of the path. It is split into n pieces of equal sweep d = sweep / n, where n = the smallest whole number for which the absolute sweep of a piece is at most 90 degrees (a tiny tolerance of 1e-9 is allowed in the division, so an exact quarter turn gives n = 1 and exactly 2 pi gives n = 4). Every piece is one `c` line.

**EPS_EXPORT_REQ_023** For the piece from angle s to angle e = s + d the control values are: k = 4/3 times tan(d / 4); first control point = (cx + r (cos s - k sin s), cy + r (sin s + k cos s)); second control point = (cx + r (cos e + k sin e), cy + r (sin e - k cos e)); end point = (cx + r cos e, cy + r sin e). These are computed in input coordinates and then converted like all other points (REQ_015 to REQ_017). The error of the radius is below 0.03 %.

**EPS_EXPORT_REQ_024** A full circle is a closed path that starts at its right-most point (cx + r, cy) and has one arc with a sweep of 2 pi (growing angle): 4 curves, then the extra `l` back to the start point (REQ_011). (The circle runs clockwise as seen in the picture. Sample 2 shows it.)

## Requirements: optional extras

**EPS_EXPORT_REQ_025** (optional) Mirror and other changes of the picture are made by an affine transformation applied to every output point after REQ_017, before the number is written. The default is no change. The fixed header and tail are not affected. (Not tried in CutStudio.)

**EPS_EXPORT_REQ_026** (optional) The origin may be given by the caller instead of the bounding box corner (for example the shared origin of REQ_018). The rules of REQ_017 stay the same.

## Requirements: the proof that the implementation works

The samples at the end of this file give exact inputs and the exact path lines expected. Four rules decide how an implementation is checked.

**EPS_EXPORT_REQ_030** The implementation is tested with every sample (1 to 7) and every variant (A to E). For each, the produced file is checked at three levels:
1. **Fixed parts exactly the same**: the header and the tail of the produced file are identical, character for character, to REQ_006 and REQ_007 (line ending LF).
2. **The paths as a structure**: the produced path lines are read back, and they must agree with the sample: the same number of paths, the same sequence of `m`, `l` and `c` in each path, the same starting point and direction, closed paths closed as REQ_011 says. Every coordinate may differ from the sample by at most 0.0015 pt (this allows for different rounding in the last decimal and nothing else). Arcs must use the piece count of REQ_022.
3. **The number format** follows REQ_003 in every line (3 decimals at most, no `-0`, no exponent).

A byte-for-byte equal file is not required; an equal-looking file that breaks one of the rules above is a failure.

**EPS_EXPORT_REQ_031** The implementation must also pass a test that does not use any sample file: for any drawing made of the permitted elements the produced file is read back and these properties are checked: the size of the drawing (largest minus smallest coordinates, including control points) equals the size of the input in millimetres times 72 / 25.4 within 0.002 pt; the smallest x and y of all coordinates are 0 (within 0.002 pt); closed paths end at their starting point; only `m`, `l` and `c` occur in the path lines; the last line before `S Q` is `0 0 m`; a picture that is taller at the top in the input has larger y values at the top in the file. The test is run with several different drawings, among them drawings that are not in this file.

**EPS_EXPORT_REQ_032** It is **forbidden** to make the samples pass by reproducing them: the export must not contain, look up or return the text of a sample file, must not detect a sample input and answer with a stored result, and must not special-case the sample's shapes, sizes or positions. The only allowed way to get the same file is that the general export of this specification, given the input, writes it. To make this checkable, REQ_031 and the variants A to E use shapes, sizes and positions that are not in samples 1 to 7; an implementation that copies the samples fails them.

**EPS_EXPORT_REQ_033** (manual, once) The first file made by a new implementation should be opened in a real CutStudio with File, Import. Check: the file opens, the size in the toolbar equals the input's size in millimetres, the shape is not upside down or mirrored, the closed shapes are really closed, the last path is there. Cut one piece on scrap material. A change of the header, the tail or the rules is accepted only after this has been done again.

## What was verified and what was not

Verified in a real CutStudio (2026-11-09): files built exactly by these rules, with the header and tail of this file: they import, have the right size, direction and closed shapes, keep the last path, and print and cut correctly. These are samples 1 to 7.

Not verified in CutStudio: the variants A to E (they follow the same rules but were only produced, not opened); other line endings; other header comment lines; other starting points of a path; reversed path directions; the optional extras (REQ_025 and REQ_026); files with several colours.

## Samples

The path lines of each sample are shown. The whole file is always: the header of REQ_006, the path lines shown, the tail of REQ_007.

### Samples with a known good result (opened in CutStudio)

#### Sample 1: square 50 mm

Input (millimetres, y grows downwards): one closed path with the points (0,0), (50,0), (50,50), (0,50) in this order.

The first point of the input is the first point of the output, and the order is kept. The picture is drawn from the top left corner to the right (clockwise on the screen). The last `l` repeats the first point.

Path lines of the file (between the fixed header and the fixed tail):

```
0 141.732 m
141.732 141.732 l
141.732 0 l
0 0 l
0 141.732 l
```

#### Sample 2: circle 50 mm across

Input (millimetres, y grows downwards): one closed circle, centre (25,25), radius 25, started at its right-most point, turning in the direction of growing angle (on a screen with y downwards that is clockwise).

Four curves, 90 degrees each, then a line back to the first point.

Path lines of the file (between the fixed header and the fixed tail):

```
141.732 70.866 m
141.732 31.728 110.004 0 70.866 0 c
31.728 0 0 31.728 0 70.866 c
0 110.004 31.728 141.732 70.866 141.732 c
110.004 141.732 141.732 110.004 141.732 70.866 c
141.732 70.866 l
```

#### Sample 3: triangle, point up

Input (millimetres, y grows downwards): one closed path with the points (25,0), (50,50), (0,50).

The point is at the top of the picture, so its y value in the file is the largest.

Path lines of the file (between the fixed header and the fixed tail):

```
70.866 141.732 m
141.732 0 l
0 0 l
70.866 141.732 l
```

#### Sample 4: open quarter circle, radius 50

Input (millimetres, y grows downwards): one open path: start at (50,0), then an arc with centre (0,0), radius 50, starting at angle 0 and turning by +90 degrees (a quarter turn; it ends at (0,50)).

An open path is not closed with an extra line.

Path lines of the file (between the fixed header and the fixed tail):

```
141.732 141.732 m
141.732 63.456 78.277 0 0 0 c
```

#### Sample 5: one straight line, 100 mm

Input (millimetres, y grows downwards): one open path with the points (0,0), (100,0).

This is the only line in the file; the extra `0 0 m` of the tail is what makes CutStudio keep it.

Path lines of the file (between the fixed header and the fixed tail):

```
0 0 m
283.465 0 l
```

#### Sample 6: letter L

Input (millimetres, y grows downwards): one closed path with the points (0,0), (20,0), (20,60), (60,60), (60,80), (0,80).

The foot is at the bottom of the picture and points to the right.

Path lines of the file (between the fixed header and the fixed tail):

```
0 226.772 m
56.693 226.772 l
56.693 56.693 l
170.079 56.693 l
170.079 0 l
0 0 l
0 226.772 l
```

#### Sample 7: calibration strip, 480 x 20 mm

Input (millimetres, y grows downwards): one closed path, the 480 mm long horizontal strip below. The point list is given below the output block.

The input points are listed under the output block.

Path lines of the file (between the fixed header and the fixed tail):

```
0 0 m
0 56.693 l
28.346 56.693 l
28.346 42.52 l
42.52 42.52 l
42.52 28.346 l
56.693 28.346 l
56.693 56.693 l
85.039 56.693 l
85.039 28.346 l
113.386 28.346 l
113.386 56.693 l
141.732 56.693 l
141.732 28.346 l
170.079 28.346 l
170.079 56.693 l
198.425 56.693 l
198.425 28.346 l
226.772 28.346 l
226.772 56.693 l
255.118 56.693 l
255.118 28.346 l
283.465 28.346 l
283.465 56.693 l
311.811 56.693 l
311.811 42.52 l
325.984 42.52 l
325.984 28.346 l
340.157 28.346 l
340.157 56.693 l
368.504 56.693 l
368.504 28.346 l
396.85 28.346 l
396.85 56.693 l
425.197 56.693 l
425.197 28.346 l
453.543 28.346 l
453.543 56.693 l
481.89 56.693 l
481.89 28.346 l
510.236 28.346 l
510.236 56.693 l
538.583 56.693 l
538.583 28.346 l
566.929 28.346 l
566.929 56.693 l
595.276 56.693 l
595.276 42.52 l
609.449 42.52 l
609.449 28.346 l
623.622 28.346 l
623.622 56.693 l
651.969 56.693 l
651.969 28.346 l
680.315 28.346 l
680.315 56.693 l
708.661 56.693 l
708.661 28.346 l
737.008 28.346 l
737.008 56.693 l
765.354 56.693 l
765.354 28.346 l
793.701 28.346 l
793.701 56.693 l
822.047 56.693 l
822.047 28.346 l
850.394 28.346 l
850.394 56.693 l
878.74 56.693 l
878.74 42.52 l
892.913 42.52 l
892.913 28.346 l
907.087 28.346 l
907.087 56.693 l
935.433 56.693 l
935.433 28.346 l
963.78 28.346 l
963.78 56.693 l
992.126 56.693 l
992.126 28.346 l
1020.472 28.346 l
1020.472 56.693 l
1048.819 56.693 l
1048.819 28.346 l
1077.165 28.346 l
1077.165 56.693 l
1105.512 56.693 l
1105.512 28.346 l
1133.858 28.346 l
1133.858 56.693 l
1162.205 56.693 l
1162.205 42.52 l
1176.378 42.52 l
1176.378 28.346 l
1190.551 28.346 l
1190.551 56.693 l
1218.898 56.693 l
1218.898 28.346 l
1247.244 28.346 l
1247.244 56.693 l
1275.591 56.693 l
1275.591 28.346 l
1303.937 28.346 l
1303.937 56.693 l
1332.283 56.693 l
1332.283 28.346 l
1360.63 28.346 l
1360.63 0 l
0 0 l
```

Input points of sample 7 in millimetres, x then y, in order:

```
0 20
0 0
10 0
10 5
15 5
15 10
20 10
20 0
30 0
30 10
40 10
40 0
50 0
50 10
60 10
60 0
70 0
70 10
80 10
80 0
90 0
90 10
100 10
100 0
110 0
110 5
115 5
115 10
120 10
120 0
130 0
130 10
140 10
140 0
150 0
150 10
160 10
160 0
170 0
170 10
180 10
180 0
190 0
190 10
200 10
200 0
210 0
210 5
215 5
215 10
220 10
220 0
230 0
230 10
240 10
240 0
250 0
250 10
260 10
260 0
270 0
270 10
280 10
280 0
290 0
290 10
300 10
300 0
310 0
310 5
315 5
315 10
320 10
320 0
330 0
330 10
340 10
340 0
350 0
350 10
360 10
360 0
370 0
370 10
380 10
380 0
390 0
390 10
400 10
400 0
410 0
410 5
415 5
415 10
420 10
420 0
430 0
430 10
440 10
440 0
450 0
450 10
460 10
460 0
470 0
470 10
480 10
480 20
```

### Variants for the third level of checking (produced by the rules, not opened in CutStudio)

#### Variant A: square 73 mm

Input (millimetres, y grows downwards): one closed path with the points (0,0), (73,0), (73,73), (0,73).

Path lines of the file (between the fixed header and the fixed tail):

```
0 206.929 m
206.929 206.929 l
206.929 0 l
0 0 l
0 206.929 l
```

#### Variant B: the same rectangle far from the origin

Input (millimetres, y grows downwards): one closed path with the points (200,300), (320,300), (320,340), (200,340): a 120 x 40 mm rectangle.

The output must be the same as for the rectangle placed at (0,0): the lower left corner of the drawing is moved to 0 0.

Path lines of the file (between the fixed header and the fixed tail):

```
0 113.386 m
340.157 113.386 l
340.157 0 l
0 0 l
0 113.386 l
```

#### Variant C: circle, radius 12.5

Input (millimetres, y grows downwards): one closed circle, centre (100,100), radius 12.5.

Path lines of the file (between the fixed header and the fixed tail):

```
70.866 35.433 m
70.866 15.864 55.002 0 35.433 0 c
15.864 0 0 15.864 0 35.433 c
0 55.002 15.864 70.866 35.433 70.866 c
55.002 70.866 70.866 55.002 70.866 35.433 c
70.866 35.433 l
```

#### Variant D: an arc of 200 degrees

Input (millimetres, y grows downwards): one open path: start at (30,0), then an arc with centre (0,0), radius 30, starting at angle 0 and turning by +200 degrees.

200 degrees need 3 pieces of 66.667 degrees each.

Path lines of the file (between the fixed header and the fixed tail):

```
176.56 91.53 m
176.56 57.584 156.373 26.89 125.203 13.445 c
94.034 0 57.854 6.379 33.163 29.674 c
8.472 52.969 0 88.716 11.61 120.615 c
```

#### Variant E: two separate paths

Input (millimetres, y grows downwards): two closed paths, a square (0,0), (10,0), (10,10), (0,10) and a square (20,0), (30,0), (30,10), (20,10).

The second path simply follows the first one, with its own `m`.

Path lines of the file (between the fixed header and the fixed tail):

```
0 28.346 m
28.346 28.346 l
28.346 0 l
0 0 l
0 28.346 l
56.693 28.346 m
85.039 28.346 l
85.039 0 l
56.693 0 l
56.693 28.346 l
```

