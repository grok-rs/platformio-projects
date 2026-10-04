#!/usr/bin/env python3
# Generates ../diagram.json — Wokwi version of the module 1.6 circuit:  python3 wokwi/gen_diagram.py
#
# Wokwi has no bare LDR, and its "photoresistor sensor" module is wired the other way round
# (VCC ── 10 kΩ ── AO ── LDR ── GND, 5 V), so dark gives a *high* voltage there. The custom chip
# wokwi/chip/ldr-divider computes the homework divider instead: 3V3 ── LDR ── OUT ── 10 kΩ ── GND.
# Its "light" slider (log10 of lux) appears when you click the chip during the simulation.
import os

from breadboard import Diagram, hole, rail, row_of

if __name__ == "__main__":
    d = Diagram()
    d.gnd_rail()
    d.power_rail()
    # GPIO4 -> jumper over the top -> row 30 (same breadboard strip as the chip's OUT wire).
    d.arc_top(row_of("4"), 30, 0, "orange")
    # The chip sits above the breadboard; Wokwi draws its three wires straight: 3V3 rail, OUT -> row 30, GND rail.
    d.parts.append({"type": "chip-ldr-divider", "id": "ldr", "top": -144, "left": 316.8, "attrs": {}})
    d.wire("ldr:3V3", rail("tp", 34), "red", [])
    d.wire("ldr:OUT", hole(30, "c"), "orange", [])
    d.wire("ldr:GND", rail("tn", 40), "black", [])
    d.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "diagram.json"))
