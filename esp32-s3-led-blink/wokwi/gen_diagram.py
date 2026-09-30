#!/usr/bin/env python3
# Generates the Wokwi diagrams (Wokwi versions of docs/breadboard*.png):  python3 wokwi/gen_diagram.py
#   ../diagram.json              env esp32-s3-devkitc-1:  red/blue/green on GPIO4/5/6
#   single-gpio/diagram.json     env esp32-s3-single-gpio: red and blue both on GPIO7
import os

from breadboard import Diagram, hole, row_of

HERE = os.path.dirname(os.path.abspath(__file__))


def three_leds():
    d = Diagram()
    d.gnd_rail()
    # GPIO -> jumper over the top -> resistor (letter c) -> upright LED (letter a) -> GND rail.
    # Resistors start at row 26: rows 23…25 are under the board's antenna end.
    for n, gpio, row, lane, wire, color, ohms in (
            (1, "4", 26, 0, "orange", "red", 220),
            (2, "5", 36, 1, "blue", "blue", 100),     # blue: higher forward voltage, smaller resistor
            (3, "6", 46, 2, "green", "green", 220)):
        d.arc_top(row_of(gpio), row, lane, wire)
        d.resistor(f"r{n}", row, "c", ohms)
        d.led(f"led{n}", row + 5, color)
        d.led_to_gnd(row + 5)
    d.onboard_boot("b")           # BOOT on the board itself, keyboard key B
    d.save(os.path.join(HERE, "..", "diagram.json"))


def single_gpio():
    d = Diagram()
    d.gnd_rail()
    d.power_rail()                # the blue LED is fed from 3V3
    # Red: GPIO7 -> jumper -> 220 Ω -> red LED -> GND   (lit when the pin is HIGH)
    d.arc_top(row_of("7"), 26, 0, "purple")
    d.resistor("r1", 26, "c", 220)
    d.led("led1", 31, "red")
    d.led_to_gnd(31)
    # Blue: 3V3 rail -> 100 Ω -> blue LED -> back into the GPIO7 net (lit when the pin is LOW).
    # The cathode strip (row 41) joins row 26, which the GPIO7 jumper already feeds.
    d.to_3v3(36)
    d.resistor("r2", 36, "c", 100)
    d.led("led2", 41, "blue")
    d.wire(hole(41, "e"), hole(26, "e"), "purple")
    d.onboard_boot("b")
    d.save(os.path.join(HERE, "single-gpio", "diagram.json"))


if __name__ == "__main__":
    three_leds()
    single_gpio()
