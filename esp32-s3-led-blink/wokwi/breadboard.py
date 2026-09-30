# Wokwi breadboard geometry shared by the gen_*.py scripts (full 830-point breadboard + YD-ESP32-S3).
#
# Wokwi's full breadboard names holes "<row><t|b>.<letter>": rows 1…63, letters a…e in the top half
# (a at the very top) and f…j in the bottom half; power rails tp/tn (top) and bp/bn (bottom).
# That is the mirror image of the letters in docs/breadboard.png (j on top), so the ESP32 headers
# that sit in i/b there sit in b/i here. The picture is the same (J1 on top, USB-C at row 1);
# part rows differ a little because Wokwi's resistor spans 6 holes.
#
# Geometry (Wokwi units, 0.1" = 9.6) was measured from the rendered parts on wokwi.com.
import json

PITCH  = 9.6
ROW_Y  = dict(zip("abcdefghij", (51, 60.6, 70.2, 79.8, 89.4, 118.2, 127.8, 137.4, 147, 156.6)))
TOP    = -9.6                          # y of the first jumper lane above the breadboard

# YD-ESP32-S3 headers, pin 1 at the antenna end; rotated 90°, pin p lands in row 23 - p.
J1 = ["3V3.1", "3V3.2", "RST", "4", "5", "6", "7", "15", "16", "17", "18",
      "8", "3", "46", "9", "10", "11", "12", "13", "14", "5V", "GND.1"]      # letter b
J3 = ["GND.2", "TX", "RX", "1", "2", "42", "41", "40", "39", "38", "37",
      "36", "35", "0", "45", "48", "47", "21", "20", "19", "GND.3", "GND.4"]  # letter i


def hx(row):
    return 26 + (row - 1) * PITCH


def hole(row, letter):
    return f"bb:{row}{'t' if letter <= 'e' else 'b'}.{letter}"


def rail(name, row):
    """Rail hole straight above/below `row`. Rails have a gap after every 5 holes."""
    m = row - 3
    assert m >= 0 and m % 6 != 5, f"row {row} faces a gap in the rail"
    return f"bb:{name}.{m - m // 6 + 1}"


def row_of(pin):
    return 23 - (J1.index(pin) + 1) if pin in J1 else 23 - (J3.index(pin) + 1)


class Diagram:
    def __init__(self):
        self.parts = [
            {"type": "wokwi-breadboard", "id": "bb", "top": 0, "left": 0, "attrs": {}},
            {"type": "board-esp32-s3-devkitc-1", "id": "esp", "top": -28.98, "left": 76.08, "rotate": 90,
             "attrs": {"flashSize": "16", "psramSize": "8", "psramType": "octal",
                       "serialInterface": "USB_SERIAL_JTAG"}},
        ]
        self.conns = [[f"esp:{p}", hole(row_of(p), "b"), "", ["$bb"]] for p in J1]
        self.conns += [[f"esp:{p}", hole(row_of(p), "i"), "", ["$bb"]] for p in J3]

    def seat(self, part, pins):
        part["top"], part["left"] = round(part["top"], 2), round(part["left"], 2)
        self.parts.append(part)
        self.conns += [[f"{part['id']}:{pin}", h, "", ["$bb"]] for pin, h in pins.items()]

    def resistor(self, pid, row, letter, ohms):
        """Horizontal resistor, legs in `row` and `row + 6`."""
        self.seat({"type": "wokwi-resistor", "id": pid, "top": ROW_Y[letter] - 5.65, "left": hx(row),
                   "attrs": {"value": str(ohms)}},
                  {"1": hole(row, letter), "2": hole(row + 6, letter)})

    def led(self, pid, row, color):
        """Upright LED with its legs in letter a: cathode in `row`, anode in `row + 1`.
        The body rises over the unused rail holes, so nothing hides under it.
        The part is 40×50 with legs at (15, 42) cathode / (25, 42) anode. No label: it would
        make the part taller and push the text onto the rails."""
        self.seat({"type": "wokwi-led", "id": pid, "top": ROW_Y["a"] - 42, "left": hx(row) - 15,
                   "attrs": {"color": color}},
                  {"C": hole(row, "a"), "A": hole(row + 1, "a")})

    def led_to_gnd(self, row):
        """Cathode strip -> top GND rail, stepping two holes left to clear the LED body."""
        self.wire(hole(row, "b"), rail("tn", row - 2), "black", [f"h-{2 * PITCH:g}"])

    def button(self, pid, row, color, key):
        """6 mm button across the channel: contact 2 in `row`, contact 1 in `row + 2`.
        The part is 28.0×22.7; rotated 90° its legs sit at x + 4.35 / x + 23.15, y − 2.67 / y + 25.33."""
        self.seat({"type": "wokwi-pushbutton-6mm", "id": pid, "top": ROW_Y["e"] + 3.07, "left": hx(row + 2) - 23.15,
                   "rotate": 90, "attrs": {"color": color, "key": key}},
                  {"1.l": hole(row + 2, "e"), "1.r": hole(row + 2, "f"),
                   "2.l": hole(row, "e"), "2.r": hole(row, "f")})

    def onboard_boot(self, key):
        """The YD-ESP32-S3 BOOT button (GPIO0 -> GND) and its 10 kΩ pull-up are on the board itself,
        but Wokwi's board has neither. A button is laid exactly over the board's BOOT button and
        wired with hidden wires; the pull-up sits under the board (parts listed earlier are drawn
        below). So on screen you press BOOT on the board, as on the real one."""
        # BOOT button centre on the unrotated board, in Wokwi units (measured on the rendered board).
        bx, by = 26.0, 208.7
        board = self.parts[1]
        cx, cy = 25.527 * 3.7795 / 2, 70.057 * 3.7795 / 2          # board is 25.527 × 70.057 mm
        x = board["left"] + cx - (by - cy)                             # rotated 90° about the centre
        y = board["top"] + cy + (bx - cx)
        self.parts.append({"type": "wokwi-pushbutton-6mm", "id": "btnBoot", "rotate": 90,
                           "top": round(y - 11.34, 2), "left": round(x - 14.01, 2),
                           "attrs": {"color": "black", "key": key}})
        self.parts.insert(1, {"type": "wokwi-resistor", "id": "rBoot", "top": 90, "left": 120,
                              "attrs": {"value": "10000"}})
        self.wire("btnBoot:1.l", "esp:0", "")
        self.wire("btnBoot:2.r", "esp:GND.2", "")
        self.wire("rBoot:1", "esp:3V3.1", "")
        self.wire("rBoot:2", "esp:0", "")

    def wire(self, a, b, color, hints=()):
        self.conns.append([a, b, color, list(hints)])

    def arc_top(self, r1, r2, lane, color):
        """Jumper between two a-holes, bent over the top rails; lane 0 is the innermost."""
        up = round(ROW_Y["a"] - TOP + lane * PITCH, 2)
        self.wire(hole(r1, "a"), hole(r2, "a"), color, [f"v-{up:g}", f"h{round((r2 - r1) * PITCH, 2):g}", f"v{up:g}"])

    def arc_bottom(self, r1, r2, lane, color):
        """Jumper between two j-holes, bent below the board; lane 0 is the innermost."""
        down = round(7.2 + lane * 7.2, 2)
        self.wire(hole(r1, "j"), hole(r2, "j"), color, [f"v{down:g}", f"h{round((r2 - r1) * PITCH, 2):g}", f"v-{down:g}"])

    def gnd_rail(self):
        """Board G (row 1, next to 5V) -> top GND rail."""
        self.wire(hole(row_of("GND.1"), "a"), "bb:tn.1", "black", [f"v-{ROW_Y['a'] - 22.3:g}"])

    def power_rail(self):
        """Board 3V3 (row 22) -> top + rail."""
        self.wire(hole(row_of("3V3.1"), "a"), rail("tp", row_of("3V3.1")), "red")

    def to_gnd(self, row):
        self.wire(hole(row, "a"), rail("tn", row), "black")

    def to_3v3(self, row):
        self.wire(hole(row, "a"), rail("tp", row), "red")

    def save(self, path):
        # Same shape as Wokwi's own editor: one part / one connection per line.
        line = lambda x: json.dumps(x, ensure_ascii=False, separators=(", ", ": "))
        out = ['{', '  "version": 1,', '  "author": "grok-rs",', '  "editor": "wokwi",', '  "parts": [']
        out.append(",\n".join("    " + line(p) for p in self.parts))
        out += ['  ],', '  "connections": [']
        out.append(",\n".join("    " + line(c) for c in self.conns))
        out += ['  ],', '  "dependencies": {}', '}', '']
        with open(path, "w") as f:
            f.write("\n".join(out))
