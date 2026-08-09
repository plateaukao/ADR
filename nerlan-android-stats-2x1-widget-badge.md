2026-08-10

# NerLan widgets: 學習紀錄 down to 2×1, and an app badge on every widget

Two small follow-ups to the widget-density work (see
[nerlan-android-widget-density](nerlan-android-widget-density.md)), both from
user review of the refreshed docs screenshots.

## 學習紀錄 no longer demands 2×2

The question that triggered it: *why does 學習紀錄 need 2×2 at all?* The
answer turned out to be "only because its provider XML said so" —
`targetCellHeight="2"` and `minHeight="110dp"` were the whole constraint;
the content never needed the space, especially once the 30-minute daily
goal bar was questioned. That bar was a progress hint against a target
nothing in the app lets you configure, so it communicated little — removed
entirely.

What shipped:

- `widget_stats_info.xml` now declares `targetCellHeight="1"`,
  `minHeight="50dp"`, `minResizeHeight="40dp"` — the widget picker offers
  學習紀錄 as "2 wide by 1 high" and that's the default placement; existing
  larger placements can be resized down.
- A compact layout for cells under ~100dp of inner height: 今日學習, a bold
  26sp minutes figure with 分鐘 inline, and the streak line (the week total
  joins that line when the widget is 3+ cells wide). Taller cells keep the
  scaled 42/56sp number and both summary lines, minus the bar.

## A small app badge on all four widgets

Request: a recognizable app mark on every widget. Because all four widgets
render inside the shared `WidgetSurface` frame, this was a one-place
change: the surface now overlays a 16dp `ic_launcher_round` (the orange
"Tune In" icon) in the top-end corner, clickable to open the app. It rides
above the content stack, and every layout — including the empty states —
gets it for free. Verified on the emulator that no layout collides with
the corner: list headers are left-aligned, the 我的節目 badge sits in the
header strip above the cover grid, and hero titles stop short of it.

Docs screenshots were re-captured with the badge visible, 學習紀錄 at its
new 2×1, and 最近播放 showing its computed three rows (made possible by
playing a third show on the emulator — the widget had been data-limited,
not layout-limited).
