#!/usr/bin/env python3
# Generates ../diagram.json — Wokwi version of the module 1.5 bench:  python3 wokwi/gen_diagram.py
#
# S1 (a bouncing button, Wokwi simulates bounce by default) between GPIO16 and GND, plus an 8-channel
# logic analyzer: D0 = GPIO16 (the button), D1 = GPIO17 (ISR marker). Stop the simulation and the
# analyzer saves a VCD file; open it in PulseView / GTKWave or run tools/vcd_bounce.py on it.
import os

from breadboard import Diagram, hole, rail, row_of

if __name__ == "__main__":
    d = Diagram()
    d.gnd_rail()
    # S1 across the channel: contact 1 in row 48 (GPIO16 jumper), contact 2 in row 46 -> GND rail.
    d.button("btnS1", 46, "green", "1")
    d.arc_top(row_of("16"), 48, 0, "orange")
    d.to_gnd(46)
    # Logic analyzer below the breadboard, wired to the board's own rows (letter c is free there).
    d.parts.append({"type": "wokwi-logic-analyzer", "id": "la", "top": 240, "left": 220,
                    "attrs": {"channelNames": "BUTTON,ISR,D2,D3,D4,D5,D6,D7", "bufferSize": "200000"}})
    d.wire("la:D0", hole(row_of("16"), "c"), "orange")
    d.wire("la:D1", hole(row_of("17"), "c"), "violet")
    d.wire("la:GND", rail("bn", 40), "black")
    d.wire(rail("tn", 52), rail("bn", 52), "black")          # GND to the bottom rail as well
    d.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "diagram.json"))
