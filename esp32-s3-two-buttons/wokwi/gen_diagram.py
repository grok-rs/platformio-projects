#!/usr/bin/env python3
# Generates ../diagram.json — Wokwi version of docs/breadboard.png:  python3 wokwi/gen_diagram.py
import os

from breadboard import Diagram, hole, rail, row_of

if __name__ == "__main__":
    d = Diagram()
    d.gnd_rail()
    # D1, D2: GPIO -> jumper over the top -> 220 Ω (letter c) -> LED (letter a) -> GND rail.
    # Resistors start at row 26: rows 23…25 are under the board's antenna end.
    for n, gpio, row, lane, wire in ((1, "15", 26, 0, "orange"), (2, "16", 36, 1, "gold")):
        d.arc_top(row_of(gpio), row, lane, wire)
        d.resistor(f"r{n}", row, "c", 220)
        d.led(f"led{n}", row + 5, "red")
        d.led_to_gnd(row + 5)
    # BOOT: the button on the board itself (see Diagram.onboard_boot), keyboard key 2.
    d.onboard_boot("2")
    # S1, the only external button: GPIO21 -> bottom strip of row 48, top strip of row 46 -> GND rail.
    # Diagonal legs, as in the README.
    d.button("btnS1", 46, "green", "1")
    d.arc_bottom(row_of("21"), 48, 0, "purple")
    d.to_gnd(46)
    d.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "diagram.json"))
