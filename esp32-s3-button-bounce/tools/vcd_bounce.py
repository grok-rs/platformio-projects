#!/usr/bin/env python3
"""Bounce report from a logic-analyzer recording (VCD) — the "ground truth" for module 1.5.

    python3 tools/vcd_bounce.py capture.vcd                      # channel named BUTTON, or the first one
    python3 tools/vcd_bounce.py capture.vcd --button D0 --isr D1 # PulseView names channels D0, D1, ...

Works with Wokwi recordings (wokwi-cli --vcd-file, or the file the simulator saves when you stop it)
and with PulseView: File -> Export -> Value Change Dump (.vcd). The table has the same columns as the
firmware's Serial report, so the two can be compared line by line.

With --isr (the GPIO17 marker channel) it also prints how many times the interrupt handler ran and
how late it started after the button edge that triggered it.
"""
import argparse
import re
import sys

QUIET_US = 50_000   # same as kQuietUs in src/main.cpp
SHOW_EDGES = 12


def read_vcd(path):
    """Returns ({name: [(t_ns, level), ...]}, timescale in ns). Only 1-bit wires are kept."""
    ids, names, scale = {}, [], 1.0
    changes = {}
    t = 0
    units = {"s": 1e9, "ms": 1e6, "us": 1e3, "ns": 1.0, "ps": 1e-3, "fs": 1e-6}
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    header, _, body = text.partition("$enddefinitions")
    m = re.search(r"\$timescale\s+(\d+)\s*(\w+)\s+\$end", header)
    if m:
        scale = int(m.group(1)) * units[m.group(2)]
    for m in re.finditer(r"\$var\s+\w+\s+(\d+)\s+(\S+)\s+(\S+)(?:\s+\[[^\]]*\])?\s+\$end", header):
        width, ident, name = m.groups()
        if width == "1":
            ids[ident] = name
            names.append(name)
            changes[name] = []
    for tok in body.split():
        if tok.startswith("#"):
            t = int(tok[1:])
        elif tok[0] in "01xXzZ" and tok[1:] in ids:
            level = 1 if tok[0] == "1" else 0
            series = changes[ids[tok[1:]]]
            if not series or series[-1][1] != level:     # VCD may repeat a value; keep real edges only
                series.append((t * scale, level))
    return changes, names


def group_events(series, quiet_ns):
    """Splits edges into events separated by at least `quiet_ns` of silence. The first sample is the
    initial level, not an edge."""
    if not series:
        return 1, []
    level0 = series[0][1]
    edges = series[1:]
    events, cur = [], []
    for e in edges:
        if cur and e[0] - cur[-1][0] >= quiet_ns:
            events.append(cur)
            cur = []
        cur.append(e)
    if cur:
        events.append(cur)
    return level0, events


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("vcd")
    ap.add_argument("--button", help="button channel name (default: BUTTON or the first channel)")
    ap.add_argument("--isr", help="ISR marker channel name (default: ISR if present)")
    ap.add_argument("--quiet-ms", type=float, default=QUIET_US / 1000, help="silence that ends an event")
    a = ap.parse_args()

    changes, names = read_vcd(a.vcd)
    if not names:
        sys.exit("no 1-bit channels in the VCD")
    button = a.button or ("BUTTON" if "BUTTON" in changes else names[0])
    isr = a.isr or ("ISR" if "ISR" in changes else None)
    if button not in changes:
        sys.exit(f"channel {button!r} not found; channels: {', '.join(names)}")

    stable, events = group_events(changes[button], a.quiet_ms * 1e6)
    print(f"channel {button}: {sum(len(e) for e in events)} edges, {len(events)} events "
          f"(an event ends after {a.quiet_ms:g} ms without edges)\n")
    print("  #  event    edges  fall  rise  bounce,us  min gap,us  edges, us from the first (v = LOW, ^ = HIGH)")
    print("---  -------  -----  ----  ----  ---------  ----------  ----------------------------------------------")
    n = {"PRESS": 0, "release": 0, "glitch": 0, "start": 0}
    worst = {"PRESS": 0.0, "release": 0.0}
    total = {"PRESS": [0, 0.0], "release": [0, 0.0]}
    falling_total = 0
    for i, ev in enumerate(events):
        last = ev[-1][1]
        kind = "PRESS" if last == 0 and stable == 1 else "release" if last == 1 and stable == 0 else "glitch"
        if i == 0 and len(ev) == 1:
            kind = "start"   # a lone first edge: the level settling at power-up (pull-up switched on)
        stable = last
        n[kind] += 1
        t0 = ev[0][0]
        bounce_us = (ev[-1][0] - t0) / 1000
        gaps = [(b[0] - a_[0]) / 1000 for a_, b in zip(ev, ev[1:])]
        fall = sum(1 for _, lv in ev if lv == 0)
        if kind != "start":
            falling_total += fall
        if kind in worst:
            worst[kind] = max(worst[kind], bounce_us)
            total[kind][0] += len(ev)
            total[kind][1] += bounce_us
        shown = " ".join(f"{'^' if lv else 'v'}{(t - t0) / 1000:.0f}" for t, lv in ev[:SHOW_EDGES])
        more = f" ... +{len(ev) - SHOW_EDGES}" if len(ev) > SHOW_EDGES else ""
        gap = f"{min(gaps):10.1f}" if gaps else f"{'-':>10}"
        print(f"{n[kind] if kind in worst else 0:3d}  {kind:<7}  {len(ev):5d}  {fall:4d}  {len(ev) - fall:4d}  "
              f"{bounce_us:9.0f}  {gap}  {shown}{more}")

    print()
    for kind in ("PRESS", "release"):
        if n[kind]:
            cnt, bsum = total[kind]
            print(f"{kind.lower():8} edges avg {cnt / n[kind]:.1f}, bounce avg {bsum / n[kind]:.0f} us, "
                  f"max {worst[kind]:.0f} us")
    print(f"falling edges (an ideal FALLING interrupt would count them all): {falling_total} for {n['PRESS']} presses")
    w = max(worst.values())
    print(f"debounce >= {max(1, -(-w * 1.5 // 1000)):.0f} ms (worst bounce {w:.0f} us x 1.5)")

    if isr and isr in changes:
        runs = [t for t, lv in changes[isr][1:] if lv == 1]
        ends = [t for t, lv in changes[isr][1:] if lv == 0]
        edges = [t for t, _ in changes[button][1:]]
        lat, j = [], 0
        for r in runs:                       # latency: ISR start minus the latest button edge before it
            while j + 1 < len(edges) and edges[j + 1] <= r:
                j += 1
            if edges and edges[j] <= r:
                lat.append((r - edges[j]) / 1000)
        dur = [(e - r) / 1000 for r, e in zip(runs, ends) if e >= r]
        print(f"\nISR channel {isr}: handler ran {len(runs)} times for {len(edges)} button edges")
        if lat:
            lat.sort()
            print(f"ISR latency after the last edge: min {lat[0]:.1f} us, median {lat[len(lat) // 2]:.1f} us, "
                  f"max {lat[-1]:.1f} us")
        if dur:
            print(f"ISR duration: median {sorted(dur)[len(dur) // 2]:.2f} us")
        if len(runs) < len(edges):
            print("Fewer ISR runs than edges: edges that arrive while the interrupt is still pending are merged.")


if __name__ == "__main__":
    main()
