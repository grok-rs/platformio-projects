#!/usr/bin/env python3
"""Апаратний чи програмний ШІМ: частота, заповнення й тремтіння періоду з запису логічного аналізатора (VCD).

    # PulseView: File → Export → Value Change Dump (.vcd); канал PWM — GPIO5 прошивок levels і softpwm
    python3 tools/vcd_pwm.py ledc.vcd soft.vcd [docs/pwm-compare.png]

Канал PWM (D0 логічного аналізатора) ділиться на «пачки» періодів: між натисканнями заповнення
постійне, а на OFF (0 %) і HIGH (100 %) фронтів немає зовсім. Для кожної пачки друкується
частота, заповнення і розкид періоду (max − min) — у LEDC він нульовий, у програмного ШІМ
дорівнює кроку millis() і затримкам циклу.
"""

import sys
from statistics import mean

# Пауза між фронтами, довша за цю, — кінець пачки (рівень 0 % / 100 %, фронтів немає).
BURST_GAP_NS = 50_000_000
# Між LOW і MID ШІМ не зупиняється — змінюється лише час HIGH. Стрибок більший за цю частку
# від середнього в пачці — нова пачка (тремтіння в межах одного рівня значно менше).
DUTY_JUMP = 0.25
MIN_PERIODS = 5  # коротші пачки — перехідні процеси на межі натискання


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


def bursts(pwm):
    """Пачки повних періодів: [(період_нс, час HIGH_нс, початок_нс), ...] для кожної пачки."""
    rises = [i for i in range(1, len(pwm)) if pwm[i][1] == 1 and pwm[i - 1][1] == 0]
    result, current = [], []
    for a, b in zip(rises, rises[1:]):
        period = pwm[b][0] - pwm[a][0]
        fall = next((t for t, v in pwm[a + 1:b + 1] if v == 0), None)
        if period > BURST_GAP_NS or fall is None:
            if len(current) >= MIN_PERIODS:
                result.append(current)
            current = []
            continue
        high = fall - pwm[a][0]
        if current:
            avg = mean(h for _, h, _ in current)
            if abs(high - avg) > DUTY_JUMP * avg:
                if len(current) >= MIN_PERIODS:
                    result.append(current)
                current = []
        current.append((period, high, pwm[a][0]))
    if len(current) >= MIN_PERIODS:
        result.append(current)
    return result


def describe(burst):
    # Перший і останній період пачки — перехідні (заповнення змінилось посеред періоду): без них.
    steady = burst[1:-1]
    periods = [p for p, _, _ in steady]
    highs = [h for _, h, _ in steady]
    return {
        "start_ms": burst[0][2] / 1e6,
        "n": len(burst),
        "freq_hz": 1e9 / mean(periods),
        "duty_pct": 100 * sum(highs) / sum(periods),
        "jitter_us": (max(periods) - min(periods)) / 1e3,
    }


def report(label, path):
    rows = [describe(b) for b in bursts(read_vcd(path)["PWM"])]
    print(f"{label}: {path}")
    print(f"  {'from, ms':>9} {'periods':>8} {'freq, Hz':>10} {'duty, %':>8} {'period jitter, us':>18}")
    for r in rows:
        print(f"  {r['start_ms']:9.0f} {r['n']:8d} {r['freq_hz']:10.1f} {r['duty_pct']:8.2f} {r['jitter_us']:18.2f}")
    return rows


def plot(png, ledc_vcd, soft_vcd):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(2, 1, figsize=(11, 4.8), constrained_layout=True)
    for ax, (label, path, window_ms) in zip(axes, (("LEDC", ledc_vcd, 1.0), ("програмний ШІМ на millis()", soft_vcd, 50.0))):
        pwm = read_vcd(path)["PWM"]
        # Рівень LOW (40) — пачка з найменшим заповненням: тут різниця найпомітніша. Очікувано:
        # LEDC — 40/256 = 15,6 %; програмний — 40/255 × 10 мс = 1,57 мс → 1 мс = 10 % (квантування).
        b = min(bursts(pwm), key=lambda b: describe(b)["duty_pct"])
        r = describe(b)
        t0 = b[2][2]
        xs, ys = [], []
        for t, v in pwm:
            if not t0 <= t <= t0 + window_ms * 1e6:
                continue
            if xs:  # сходинка: спершу старий рівень у момент фронту
                xs.append((t - t0) / 1e6)
                ys.append(ys[-1])
            xs.append((t - t0) / 1e6)
            ys.append(v)
        ax.plot(xs, ys, color="#0a6a86")
        ua = lambda x: f"{x:.1f}".replace(".", ",")  # десяткова кома
        ax.set_title(f"{label}, LOW = 40: {r['freq_hz']:.0f} Гц, заповнення {ua(r['duty_pct'])} %, "
                     f"розкид періоду {ua(r['jitter_us'])} мкс", loc="left", fontsize=11)
        ax.set_yticks([0, 1], ["LOW", "HIGH"])
        ax.set_xlim(0, window_ms)
        ax.set_xlabel("мс")
        ax.grid(alpha=0.3)
    fig.savefig(png, dpi=110)
    print(f"plot: {png}")


def main(argv):
    if len(argv) not in (3, 4):
        sys.exit(__doc__)
    report("LEDC (hardware)", argv[1])
    report("Software PWM (millis)", argv[2])
    if len(argv) == 4:
        plot(argv[3], argv[1], argv[2])


if __name__ == "__main__":
    main(sys.argv)
