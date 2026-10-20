#!/usr/bin/env python3
"""Часова діаграма LED + BUTTON із запису логічного аналізатора Wokwi (VCD).

    wokwi-cli cpp --scenario ../wokwi/scenarios/modes.yaml --vcd-file modes.vcd
    python3 tools/vcd_plot.py modes.vcd docs/modes-timeline.png

Друкує кожне натискання: скільки фронтів дав брязкіт і через скільки мс після останнього
фронту змінився LED (має бути ≈ debounce 30 мс + до одного проходу циклу).
"""

import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


def read_vcd(path):
    """{назва сигналу: [(час_нс, рівень), ...]}"""
    names, signals, now = {}, {}, 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("$var"):
                _, _, _, ident, name, _ = line.split()
                names[ident] = name
                signals[name] = []
            elif line.startswith("#"):
                now = int(line[1:])
            elif line[:1] in "01" and line[1:] in names:
                signals[names[line[1:]]].append((now, int(line[0])))
    return signals


def presses(button, led, burst_gap_ns=20_000_000):
    """Пачки фронтів кнопки, що закінчились LOW (натискання), і реакція LED після них."""
    edges = [t for t, _ in button[1:]]
    bursts, start = [], 0
    for i in range(1, len(edges) + 1):
        if i == len(edges) or edges[i] - edges[i - 1] > burst_gap_ns:
            bursts.append(edges[start:i])
            start = i
    level_at = lambda sig, t: [v for ts, v in sig if ts <= t][-1]
    for burst in bursts:
        last = burst[-1]
        if level_at(button, last) != 0:
            continue  # відпускання
        after = [t for t, _ in led if t > last]
        yield burst, (after[0] - last) / 1e6 if after else None


def main(vcd, png):
    sig = read_vcd(vcd)
    led, button = sig["LED"], sig["BUTTON"]
    for n, (burst, react_ms) in enumerate(presses(button, led), 1):
        # Якщо LED уже мав потрібний рівень (BLINK у фазі «on» → STEADY_ON), виводу нічого міняти.
        react = (f"LED changed {react_ms:.2f} ms after the last edge"
                 if react_ms is not None and react_ms < 100 else "LED already at the new level")
        print(f"press #{n}: {len(burst)} edges, bounce {(burst[-1] - burst[0]) / 1e3:.1f} us, {react}")

    end = max(led[-1][0], button[-1][0]) + 300_000_000
    # Зблизька — перше натискання, після якого LED змінив рівень (видно затримку антибрязкоту).
    shown_no, shown = next((n, burst) for n, (burst, ms) in enumerate(presses(button, led), 1)
                           if ms is not None and ms < 100)

    fig, (full, zoom) = plt.subplots(2, 1, figsize=(11, 5.2), gridspec_kw={"height_ratios": [3, 2]})

    def steps(ax, data, offset, scale, label, color, t0=0):
        xs, ys = [], []
        for t, v in data:
            xs.append((t - t0) / scale)
            ys.append(v + offset)
        xs.append((end - t0) / scale)
        ys.append(ys[-1])
        ax.step(xs, ys, where="post", color=color, lw=1.4, label=label)

    steps(full, led, 1.5, 1e9, "LED (GPIO15)", "#d62728")
    steps(full, button, 0, 1e9, "BUTTON (GPIO21)", "#1f77b4")
    full.set_xlim(0, end / 1e9)
    full.set_yticks([0, 1, 1.5, 2.5], ["LOW", "HIGH", "off", "on"])
    full.set_xlabel("час, с")
    full.set_title("Wokwi: BLINK → STEADY_ON → STEADY_OFF → BLINK (натискання = BUTTON у LOW)")
    full.legend(loc="upper right", fontsize=8)
    full.grid(alpha=0.3)

    t0 = shown[0] - 2_000_000
    steps(zoom, button, 0, 1e6, "BUTTON", "#1f77b4", t0)
    steps(zoom, led, 1.5, 1e6, "LED", "#d62728", t0)
    zoom.set_xlim(0, 45)
    quiet_from = (shown[-1] - t0) / 1e6
    zoom.axvspan(quiet_from, quiet_from + 30, color="#2ca02c", alpha=0.15,
                 label="debounce 30 мс після останнього фронту")
    zoom.set_yticks([0, 1, 1.5, 2.5], ["LOW", "HIGH", "off", "on"])
    zoom.set_xlabel(f"мс від початку натискання #{shown_no}")
    zoom.set_title(f"Натискання #{shown_no} зблизька: {len(shown)} фронтів брязкоту → одна подія, "
                   "LED вимикається після 30 мс тиші")
    zoom.legend(loc="center right", fontsize=8)
    zoom.grid(alpha=0.3)

    fig.tight_layout()
    fig.savefig(png, dpi=120)
    print(f"saved {png}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
