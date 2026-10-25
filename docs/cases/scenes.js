/* cases/scenes.js — window.CaseScenes: the five benches of «Справи групи» and their faults.
   Classic script, load with `defer` after assets/kit.js. No page state here: templates, the fault catalogue and draw().

   Every bench copies a tidy layout of a lesson (docs/kit/index.html «Tidy layout», the tidy-breadboard rules): the board sits
   IN the breadboard (rot −90, headers in rows i and b), parts share strips, every jumper is a Kit.route on the hole grid.
     led    1-2  MB-102 → bottom rails → red j13 → R1 1 кОм h13–h17 → LED1 A f17 / K f18 → black j18 → «−»
     esp    1-3  board c14…35: GPIO15 (j21) → lane → j8 · R1 220 Ом h4–h8 · LED1 A f4 / K f3 · black j3 → «−» · GND j35 → «−»
     btn    1-5  board c3…24: GPIO21 (a20) → top lane → a34 · S1 e34/e36 · R1 10 кОм h30–h34 → «+» · 3V3 j3 → «+» · S1 j36 → «−»
     ldr    1-6  board c13…34: 3V3 j13 → j8 · LDR1 g7–g8 · R1 10 кОм h3–h7 · GPIO4 j16 → lane → j7 · black j3 → «−»
     relay  2-2  board c14…35, MB-102 5 В on the top rails: GPIO5 j18 → lane → j45 · Rб f45–e45 · BC547B d44/45/46 ·
                 D1 e44 → e40 · relay module above the board (VCC from «+», GND pin ← collector, IN tied to GND)
   A case = { t: template, f: fault id | 'mv', m: [element, ±1] (only for 'mv') }. draw(stage, t, f, m) builds the scene into
   `stage` and returns { svg, el: {key: node}, aria }. Elements removed by a fault get an invisible hit area (class cs-gap) at
   the place where they belong, so «click the faulty part» still works for a missing wire. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const sv = (tag, a, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ------------------------------------------------------------------ catalogue */
  // els: clickable elements (key → name for the editor's «деталь на малюнку» menu); moves: element → allowed column shifts
  // (a shift that would put two leads in one hole, or a part under the board's module, is left out).
  // fault: label (menu), el (the faulty element), adds (elements that exist only with this fault), decoys (two elements for the
  // wrong options), sym / right / wrong / explain (suggested texts the author can edit), lit / burnt (the LED in the scene).
  const T = {};

  T.led = {
    name: 'Світлодіод від MB-102', lesson: '1.2',
    about: 'MB-102 дає 5 В на нижні шини, R1 1 кОм і червоний LED1 стоять у смужках макетки.',
    els: { pm: 'Модуль живлення MB-102', red: 'Червоний дріт від шини «+»', res: 'Резистор R1 1 кОм', led: 'Світлодіод LED1',
      blk: 'Чорний дріт на шину «−»', byp: 'Жовта перемичка біля R1' },
    moves: { res: [-1, 1], led: [-1, 1], red: [-1, 1], blk: [-1, 1] },
    faults: {
      rev: { label: 'LED1 вставлено навпаки', el: 'led', decoys: ['res', 'blk'],
        sym: 'Модуль увімкнений, деталі ті самі, що на схемі. LED1 не світиться, а вольтметр на його виводах показує ≈ 5 В.',
        right: 'LED1 вставлено навпаки: катод до R1, анод до «−»', wrong: ['R1 завеликий: 1 кОм — забагато', 'Чорний дріт не на шині «−»'],
        explain: 'Світлодіод пропускає струм лише від анода (довга ніжка) до катода (коротка, з боку плаского зрізу). Тут анод у смужці 18, що йде на «−»: LED закритий, струму немає, тож уся напруга стоїть на LED. Розверніть його: анод у 17, катод у 18.' },
      nores: { label: 'Немає резистора: дріт з «+» прямо до анода', el: 'red', decoys: ['led', 'blk'], burnt: true,
        sym: 'Увімкнули модуль — LED1 яскраво спалахнув і за мить згас. Тепер він не світиться зовсім.',
        right: 'Резистора немає: дріт з «+» іде прямо в стовпчик анода', wrong: ['LED1 вставлено навпаки', 'Чорний дріт не на шині «−»'],
        explain: 'Червоний дріт приносить 5 В прямо в смужку анода. Струм обмежує лише крихітний опір кристала: сотні міліампер замість 3 мА, і кристал згорає. Між «+» і LED завжди стоїть резистор: тут R1 1 кОм зі стовпчика 13 у 17.' },
      strip: { label: 'R1 стоїть уздовж однієї смужки', el: 'res', decoys: ['led', 'red'],
        sym: 'LED1 темний. Вольтметр: у стовпчику 13 є 5 В, а на аноді LED1 (стовпчик 17) — 0 В.',
        right: 'Обидві ніжки R1 в одній смужці 13, до стовпчика 17 нічого не доходить', wrong: ['LED1 вставлено навпаки', 'Червоний дріт не на шині «+»'],
        explain: 'П’ять отворів стовпчика з’єднані металевою смужкою. R1 стоїть уздовж смужки 13, тож обидві його ніжки — одна точка: він нічого ні з чим не з’єднує. Від 13 до 17 провідника немає. Резистор кладуть поперек смужок: зі стовпчика 13 у 17.' },
      nogd: { label: 'Немає дроту на «−» (GND)', el: 'blk', decoys: ['led', 'res'],
        sym: 'LED1 темний. На шинах 5 В, R1 і LED1 стоять правильно, а амперметр у колі показує 0 мА.',
        right: 'Від стовпчика катода (18) немає дроту на шину «−»', wrong: ['LED1 вставлено навпаки', 'R1 стоїть в одній смужці'],
        explain: 'Струм тече лише по замкненому колу: «+» → R1 → LED1 → «−». Катод LED1 у смужці 18, а з неї нікуди не йде дріт, тож коло розірване. Додайте чорний дріт з j18 на синю шину «−».' },
      blkplus: { label: 'Чорний дріт встромлено в шину «+»', el: 'blk', decoys: ['led', 'red'],
        sym: 'LED1 темний. Вольтметр між катодом LED1 і шиною «−» показує 5 В, а на R1 — 0 В.',
        right: 'Чорний дріт від катода встромлено в шину «+», а не в «−»', wrong: ['LED1 вставлено навпаки', 'Червоний дріт не в тому стовпчику'],
        explain: 'Колір дроту нічого не гарантує: чорний дріт стоїть у червоній шині «+». Обидва кінці кола на 5 В, різниці напруг немає, струму немає. Дивіться, в яку шину встромлено дріт: катод має йти на синю «−».' },
      off: { label: 'Перемичка MB-102 нижніх шин на OFF', el: 'pm', decoys: ['led', 'res'],
        sym: 'Індикатор MB-102 світиться, деталі стоять правильно, але LED1 темний. Вольтметр між нижніми шинами «+» і «−» показує 0 В.',
        right: 'Перемичка нижніх шин на MB-102 стоїть в OFF', wrong: ['LED1 вставлено навпаки', 'R1 1 кОм завеликий'],
        explain: 'Кожна жовта перемичка MB-102 вмикає свою пару шин: 5 В, 3,3 В або OFF. Тут нижня пара вимкнена, тож на «+» нічого немає. Перед складанням перевірте вольтметром саме ту шину, від якої живиться коло.' },
      bypass: { label: 'Перемичка в обхід R1', el: 'byp', adds: ['byp'], decoys: ['res', 'led'], burnt: true,
        sym: 'R1 1 кОм стоїть, як на схемі, але LED1 спалахнув і згорів, щойно ввімкнули модуль.',
        right: 'Жовта перемичка з 13 у 17 іде в обхід R1', wrong: ['R1 замалого номіналу', 'LED1 вставлено навпаки'],
        explain: 'Жовта перемичка з’єднує стовпчики 13 і 17 напряму, паралельно R1. Струм іде дротом майже без опору, а резистор ніби вийняли: LED опиняється просто на 5 В. Приберіть перемичку.' },
    },
  };

  T.esp = {
    name: 'GPIO15 → 220 Ом → LED', lesson: '1.3',
    about: 'Плата ESP32-S3 у макетці, скетч Blink на GPIO15: R1 220 Ом і LED1, земля через шину «−».',
    els: { esp: 'Плата ESP32-S3', res: 'Резистор R1 220 Ом', led: 'Світлодіод LED1', sig: 'Жовтий дріт від виводу плати',
      blk: 'Чорний дріт від катода', gnd: 'Чорний дріт від GND плати', br: 'Перемичка через розрив шини «−»' },
    moves: { res: [-1], led: [-1, 1], sig: [-1, 1], blk: [-1, 1] },
    faults: {
      rev: { label: 'LED1 вставлено навпаки', el: 'led', decoys: ['res', 'sig'],
        sym: 'Скетч Blink на GPIO15 працює: Serial друкує «LED: HIGH» і «LED: LOW». А LED1 не блимає жодного разу.',
        right: 'LED1 вставлено навпаки', wrong: ['R1 220 Ом завеликий', 'Жовтий дріт не на GPIO15'],
        explain: 'Анод LED1 (довга ніжка) має бути в смужці R1 (стовпчик 4), катод — у смужці чорного дроту (3). Тут навпаки: діод закритий, і HIGH на GPIO15 нічого не змінює. Розверніть LED1.' },
      gpio: { label: 'Жовтий дріт від сусіднього виводу (GPIO16)', el: 'sig', decoys: ['led', 'res'],
        sym: 'Скетч перемикає GPIO15 (LED_PIN = 15), Serial друкує «LED: HIGH» і «LED: LOW», а LED1 темний.',
        right: 'Жовтий дріт іде від GPIO16, а не від GPIO15', wrong: ['LED1 вставлено навпаки', 'R1 стоїть не в тих стовпчиках'],
        explain: 'Жовтий дріт виходить зі стовпчика 22, а там GPIO16. GPIO15 — у стовпчику 21, на один лівіше. Читайте підпис біля виводу на платі, а не рахуйте отвори навмання.' },
      nogd: { label: 'GND плати не з’єднаний із шиною «−»', el: 'gnd', decoys: ['blk', 'led'],
        sym: 'GPIO15 у HIGH (вольтметр між GPIO15 і GND плати: 3,3 В), а LED1 темний. Деталі стоять так само, як на схемі.',
        right: 'Від GND плати немає дроту на шину «−»', wrong: ['Чорний дріт від катода не на шині «−»', 'LED1 вставлено навпаки'],
        explain: 'Струм виходить з GPIO15 і мусить повернутися в плату через її GND. Катод іде на шину «−», але сама шина ні з чим не з’єднана: немає дроту з j35 (GND плати) на «−». Коло розірване.' },
      gndplus: { label: 'GND плати встромлено в шину «+»', el: 'gnd', decoys: ['blk', 'sig'],
        sym: 'LED1 не світиться ні в HIGH, ні в LOW. R1, LED1 і жовтий дріт на своїх місцях, як на схемі.',
        right: 'Дріт від GND плати встромлено в шину «+», а не в «−»', wrong: ['Чорний дріт від катода не на шині «−»', 'Жовтий дріт не на GPIO15'],
        explain: 'Дріт від GND плати (j35) стоїть у червоній шині «+», а катод LED1 — у синій «−». Ці шини між собою не з’єднані, тож струму нікуди повернутися. GND завжди на синю «−».' },
      nobr: { label: 'Немає перемички через розрив шини «−»', el: 'br', decoys: ['led', 'sig'],
        sym: 'LED1 не світиться. Обидва чорні дроти встромлені в синю шину «−», дроти цілі, деталі стоять як на схемі.',
        right: 'Шина «−» розірвана посередині (31 | 33), а перемички через розрив немає', wrong: ['LED1 вставлено навпаки', 'Жовтий дріт не на GPIO15'],
        explain: 'Шини нашої WB-102 розірвані посередині: ліва й права половини не з’єднані. Катод LED1 іде на ліву половину, а GND плати (j35) — на праву. Потрібна коротка чорна перемичка 31 → 33.' },
      strip: { label: 'R1 стоїть уздовж однієї смужки', el: 'res', decoys: ['led', 'sig'],
        sym: 'GPIO15 у HIGH: у стовпчику 8 є 3,3 В, а на аноді LED1 (стовпчик 4) — 0 В.',
        right: 'R1 стоїть уздовж смужки 8: обидві ніжки в одному стовпчику', wrong: ['LED1 вставлено навпаки', 'Жовтий дріт не на GPIO15'],
        explain: 'Отвори f–j одного стовпчика — одна металева смужка. R1 стоїть уздовж стовпчика 8, тож обидві ніжки — одна точка, і до стовпчика 4 нічого не доходить. Резистор кладуть поперек: h4 → h8.' },
    },
  };

  T.btn = {
    name: 'Кнопка на GPIO21 з підтяжкою', lesson: '1.4–1.5',
    about: 'Кнопка S1 на GPIO21, R1 10 кОм підтягує вхід до 3,3 В, скетч читає digitalRead(21).',
    els: { esp: 'Плата ESP32-S3', res: 'Резистор R1 10 кОм', btn: 'Кнопка S1', sig: 'Жовтий дріт від виводу плати',
      v33: 'Помаранчевий дріт 3V3 → шина «+»', gnd: 'Чорний дріт від GND плати', r: 'Дріт від R1 до шини', k: 'Чорний дріт від S1',
      br: 'Перемичка через розрив шини «−»', pbr: 'Перемичка через розрив шини «+»' },
    moves: { btn: [-1, 1], res: [-1, 1], sig: [-1, 1], k: [-1, 1] },
    faults: {
      s1plus: { label: 'Дріт від S1 у шині «+»', el: 'k', adds: ['pbr'], decoys: ['res', 'sig'],
        sym: 'Скетч весь час друкує 1 — і коли S1 відпущено, і коли натиснуто.',
        right: 'Дріт від S1 (стовпчик 36) встромлено в шину «+», а не в «−»', wrong: ['R1 підтягує вхід не до того живлення', 'Жовтий дріт іде не на GPIO21'],
        explain: 'Друга сторона S1 стоїть у шині «+», а там 3,3 В. R1 і так тягне вхід до 3,3 В, тож натискання з’єднує 3,3 В з 3,3 В — нічого не змінюється. З підтяжкою вгору кнопка має замикати вхід на GND (синя «−»).' },
      nobr: { label: 'Немає перемички через розрив шини «−»', el: 'br', decoys: ['btn', 'res'],
        sym: 'Скетч весь час друкує 1, натискання S1 нічого не змінює. Усі дроти в правильних шинах.',
        right: 'Шина «−» розірвана між 31 і 33, а перемички немає', wrong: ['S1 стоїть не над жолобком', 'R1 10 кОм завеликий'],
        explain: 'S1 іде на праву половину шини «−», а GND плати — на ліву. Без перемички 31 → 33 права половина ні з чим не з’єднана: натискання з’єднує вхід із «повітрям», і R1 далі тримає 1.' },
      gpio: { label: 'Жовтий дріт від сусіднього виводу (GPIO20)', el: 'sig', decoys: ['res', 'btn'],
        sym: 'digitalRead(21) показує то 0, то 1 навмання, а натискання S1 на це не впливає.',
        right: 'Жовтий дріт іде від GPIO20, а не від GPIO21', wrong: ['R1 не з’єднаний із «+»', 'S1 стоїть не над жолобком'],
        explain: 'Жовтий дріт виходить зі стовпчика 21, а там GPIO20. GPIO21 ні з чим не з’єднаний: вхід «висить у повітрі» і ловить наводки, звідси випадкові 0 і 1. Перенесіть дріт у a20.' },
      rgnd: { label: 'R1 підтягує до «−» замість «+»', el: 'r', decoys: ['sig', 'btn'],
        sym: 'Скетч весь час друкує 0 — і коли S1 відпущено, і коли натиснуто.',
        right: 'Дріт від R1 іде в шину «−»: це підтяжка до землі, а не до 3,3 В', wrong: ['Жовтий дріт іде не на GPIO21', 'S1 залипла в натиснутому стані'],
        explain: 'R1 має тягнути вхід до 3,3 В, а його дріт стоїть у шині «−». Відпущена кнопка дає 0 через R1, натиснута — 0 через S1: різниці немає. Перенесіть дріт R1 у шину «+».' },
      nov33: { label: 'Немає дроту 3V3 → шина «+»', el: 'v33', decoys: ['res', 'k'],
        sym: 'Коли S1 відпущено, digitalRead(21) показує то 0, то 1 навмання. Коли натиснуто — стабільний 0.',
        right: 'Від 3V3 плати немає дроту на шину «+»: R1 ні до чого не підтягує', wrong: ['R1 стоїть в одній смужці', 'Дріт від S1 не на «−»'],
        explain: 'R1 веде до шини «+», але на неї ніхто не подав 3,3 В. Без живлення підтяжка не працює: відпущена кнопка лишає вхід «у повітрі». Додайте помаранчевий дріт j3 (3V3) → «+».' },
    },
  };

  T.ldr = {
    name: 'Подільник з LDR на GPIO4', lesson: '1.6',
    about: 'Фоторезистор LDR1 і R1 10 кОм між 3V3 і GND, середня точка на GPIO4, скетч читає analogRead(4).',
    els: { esp: 'Плата ESP32-S3', ldr: 'Фоторезистор LDR1', res: 'Резистор R1', sig: 'Жовтий дріт від виводу плати',
      top: 'Дріт живлення верху подільника', blk: 'Чорний дріт від R1', gnd: 'Чорний дріт від GND плати', br: 'Перемичка через розрив шини «−»',
      v5: 'Червоний дріт від 5V плати', v5b: 'Перемичка через розрив шини «+»' },
    moves: { ldr: [-1, 1], res: [-1, 1], sig: [-1], top: [1] },
    faults: {
      adc2: { label: 'Жовтий дріт від GPIO15 замість GPIO4', el: 'sig', decoys: ['res', 'ldr'],
        sym: 'Відліки analogRead(4) «плавають» і не реагують на світло, хоча мультиметр на середній точці подільника показує, що напруга змінюється як треба.',
        right: 'Жовтий дріт іде від GPIO15, а не від GPIO4', wrong: ['R1 100 кОм замість 10 кОм', 'LDR1 і R1 поміняні місцями'],
        explain: 'Жовтий дріт виходить зі стовпчика 20, а там GPIO15. GPIO4 (стовпчик 16) ні з чим не з’єднаний і читає наводки. До того ж GPIO15 — канал ADC2, який не працює разом із Wi-Fi. Перенесіть дріт у j16.' },
      swap: { label: 'LDR1 і R1 поміняні місцями', el: 'ldr', decoys: ['sig', 'top'],
        sym: 'Усе працює, але навпаки: що більше світла, то менші відліки analogRead(4).',
        right: 'LDR1 і R1 поміняні місцями: LDR1 тепер між вузлом і GND', wrong: ['Жовтий дріт не на GPIO4', 'Немає дроту 3V3'],
        explain: 'Світло зменшує опір LDR1. Коли LDR1 стоїть унизу подільника (до GND), менший опір тягне вузол до 0 В. Нагорі (до 3V3) — до 3,3 В. Обидва варіанти робочі, але тоді формула в скетчі має бути інша.' },
      float: { label: 'Дріт від R1 у шині «+»', el: 'blk', decoys: ['ldr', 'sig'],
        sym: 'Відліки analogRead(4) майже завжди ≈ 4095 і ледь змінюються, хоч закрийте LDR1 долонею.',
        right: 'Дріт від R1 встромлено в шину «+», а не в «−»: нижнього плеча подільника немає', wrong: ['LDR1 вставлено навпаки', 'Жовтий дріт не на GPIO4'],
        explain: 'R1 має йти на GND, а його дріт стоїть у шині «+», на яку тут нічого не подано. Нижнє плече висить у повітрі, і вузол через LDR1 підтягується до 3,3 В. У фоторезистора полярності немає: «навпаки» його не вставиш.' },
      r100k: { label: 'R1 100 кОм замість 10 кОм', el: 'res', decoys: ['sig', 'br'],
        sym: 'Відліки майже весь час біля 4095 і помітно падають лише в повній темряві.',
        right: 'R1 100 кОм (коричневий-чорний-жовтий) замість 10 кОм', wrong: ['Жовтий дріт не на GPIO4', 'Шина «−» розірвана'],
        explain: 'Третя смужка R1 жовта: ×10 000, тобто 100 кОм. Нижнє плече в десять разів більше за LDR1 при кімнатному світлі, тож вузол майже весь час біля 3,3 В. Потрібні коричневий-чорний-помаранчевий (10 кОм).' },
      v5: { label: 'Верх подільника від 5V замість 3V3', el: 'top', adds: ['v5', 'v5b'], decoys: ['res', 'ldr'],
        sym: 'На яскравому світлі analogRead(4) упирається в 4095 задовго до максимуму, а мультиметр на вузлі показує понад 3,6 В.',
        right: 'Верх подільника живиться від 5V плати, а не від 3V3', wrong: ['R1 замалий', 'LDR1 і R1 поміняні місцями'],
        explain: 'Червоний дріт іде від виводу 5V (стовпчик 33) на шину «+», а з неї на LDR1. На яскравому світлі вузол піднімається вище 3,3 В — а вхід ESP32-S3 витримує не більше ≈ 3,6 В. Верх подільника — лише від 3V3.' },
      nobr: { label: 'Немає перемички через розрив шини «−»', el: 'br', decoys: ['res', 'sig'],
        sym: 'Відліки analogRead(4) хаотично стрибають, світло на них майже не впливає.',
        right: 'Шина «−» розірвана посередині, а перемички немає: R1 не дістає до GND плати', wrong: ['R1 100 кОм замість 10 кОм', 'Жовтий дріт не на GPIO4'],
        explain: 'R1 іде на ліву половину шини «−», а GND плати (j34) — на праву. Без перемички 31 → 33 нижнє плече подільника висить у повітрі. Додайте коротку чорну перемичку через розрив.' },
    },
  };

  T.relay = {
    name: 'Ключ BC547B і модуль реле', lesson: 'МП1 · 2.2',
    about: 'GPIO5 через Rб 680 Ом відкриває BC547B, той вмикає модуль реле від MB-102 (5 В), D1 1N4007 гасить викид котушки.',
    els: { mb: 'Модуль живлення MB-102', esp: 'Плата ESP32-S3', rb: 'Резистор бази Rб 680 Ом', q: 'Транзистор Q1', d1: 'Діод D1 1N4007',
      relay: 'Модуль реле K1', sig: 'Жовтий дріт від виводу плати', gnd: 'Чорний дріт від GND плати', em: 'Чорний дріт від емітера',
      dW: 'Червоний дріт від катода D1', coll: 'Помаранчевий дріт колектор → реле', brG: 'Перемичка через розрив шини «−»',
      brV: 'Перемичка через розрив шини «+»', jump: 'Жовта перемичка біля бази' },
    moves: { rb: [1], q: [-1, 1], d1: [-1], sig: [-1, 1] },
    faults: {
      fly: { label: 'Немає захисного діода D1', el: 'd1', decoys: ['rb', 'em'],
        sym: 'Реле клацає як треба, але після кількох десятків перемикань ESP32 почала сама перезавантажуватися, а потім BC547B перестав відкриватися.',
        right: 'Немає захисного діода D1 паралельно котушці', wrong: ['Rб 680 Ом завеликий', 'Емітер Q1 не на шині «−»'],
        explain: 'Котушка реле — індуктивність. Коли ключ закривається, вона видає викид у десятки вольт на колектор. D1 (анод до колектора, смужка до «+») дає цьому струму доріжку. Без D1 кожен викид б’є по BC547B і по живленню.' },
      drev: { label: 'D1 вставлено навпаки', el: 'd1', decoys: ['gnd', 'rb'],
        sym: 'Щойно GPIO5 стає HIGH, реле не клацає, а BC547B за кілька секунд стає гарячим.',
        right: 'D1 вставлено навпаки: смужка-катод на колекторі', wrong: ['Немає спільної землі', 'Rб 680 Ом замалий'],
        explain: 'Смужка на D1 — катод, вона має дивитися на «+». Тут D1 розвернутий: коли ключ відкривається, діод проводить від «+» прямо в колектор — коротке замикання в обхід котушки. Реле не отримує напруги, транзистор гріється.' },
      gnd: { label: 'Немає спільної землі (GND плати)', el: 'gnd', decoys: ['d1', 'rb'],
        sym: 'Вольтметр між GPIO5 і GND плати показує 3,3 В, а реле не клацає. MB-102 увімкнений, на шинах 5 В.',
        right: 'GND плати ні з чим не з’єднаний: немає спільної землі з MB-102', wrong: ['D1 вставлено навпаки', 'Rб 680 Ом завеликий'],
        explain: 'Від GND плати (a35) немає дроту на шину «−». Струм бази виходить з GPIO5 і мусить повернутися в плату через емітер і спільну землю, а дороги немає. Окреме живлення — добре, окрема земля — ні.' },
      ce: { label: '2N2222 замість BC547B', el: 'q', decoys: ['d1', 'sig'],
        sym: 'Реле не клацає. На базі Q1 ≈ 0,7 В, а струм у колі котушки — лише кілька міліампер.',
        right: 'Замість BC547B стоїть 2N2222: його виводи E-B-C, тож колектор і емітер помінялися', wrong: ['Немає захисного діода', 'Жовтий дріт не на GPIO5'],
        explain: 'Отвори розкладені під BC547B: C-B-E зліва направо. У 2N2222 (плаский бік до вас) порядок E-B-C. Тут колектор опинився на «−», а емітер на котушці: транзистор працює «задом наперед» з дуже малим підсиленням. Читайте напис на корпусі.' },
      rb: { label: 'Перемичка замість резистора бази', el: 'jump', adds: ['jump'], decoys: ['d1', 'mb'],
        sym: 'Реле клацає, але вольтметр на GPIO5 у HIGH показує близько 0,9 В замість 3,3 В.',
        right: 'Замість резистора бази — жовта перемичка через канавку', wrong: ['D1 вставлено навпаки', 'MB-102 дає забагато напруги'],
        explain: 'Між GPIO5 і базою має стояти Rб 680 Ом, а тут перемичка. Перехід база–емітер — це діод: він тримає на виводі ≈ 0,8 В, а струм бази обмежує лише сам вивід. Реле працює, але GPIO5 перевантажений.' },
      nobrG: { label: 'Немає перемички через розрив шини «−»', el: 'brG', decoys: ['d1', 'em'],
        sym: 'Реле не клацає. Усі чорні дроти встромлені в синю верхню шину «−», MB-102 увімкнений.',
        right: 'Шина «−» розірвана між 31 і 33, а перемички немає', wrong: ['Немає захисного діода D1', 'Емітер Q1 не на шині «−»'],
        explain: 'MB-102 стоїть на лівій половині шин, а емітер і GND плати — на правій. Струм котушки мусить повернутися в MB-102 через «−», але половини не з’єднані. Додайте чорну перемичку 31 → 33.' },
      off: { label: 'Перемичка MB-102 верхніх шин на OFF', el: 'mb', decoys: ['d1', 'q'],
        sym: 'Реле не клацає, червоний вогник живлення на модулі реле теж не світиться. Вольтметр між верхніми шинами «+» і «−» показує 0 В.',
        right: 'Перемичка верхніх шин на MB-102 стоїть в OFF', wrong: ['D1 вставлено навпаки', 'Транзистор не той'],
        explain: 'Кожна перемичка MB-102 вмикає свою пару шин. Тут верхня пара, від якої живиться модуль реле, вимкнена (OFF). Перед увімкненням перевіряйте вольтметром саме ту шину, від якої живиться навантаження.' },
      gpio: { label: 'Жовтий дріт від сусіднього виводу (GPIO6)', el: 'sig', decoys: ['q', 'rb'],
        sym: 'Скетч перемикає GPIO5, Serial показує «реле: ON», а реле мовчить. Вольтметр на базі Q1 — 0 В.',
        right: 'Жовтий дріт іде від GPIO6, а не від GPIO5', wrong: ['Транзистор вставлено не тим боком', 'Rб 680 Ом завеликий'],
        explain: 'Жовтий дріт виходить зі стовпчика 19, а там GPIO6. GPIO5 — у стовпчику 18. Скетч керує не тим виводом, тож на базу нічого не приходить.' },
    },
  };

  const ORDER = ['led', 'esp', 'btn', 'ldr', 'relay'];

  // The «move by one column» pseudo-fault: generated texts (the author edits them).
  const side = (d) => (d < 0 ? 'ліворуч' : 'праворуч');
  function moveInfo(t, key, d) {
    const n = T[t].els[key];
    return {
      label: `${n}: на стовпчик ${side(d)}`, el: key,
      decoys: Object.keys(T[t].els).filter((k) => k !== key && !(T[t].faults && Object.values(T[t].faults).some((f) => (f.adds || []).includes(k)))).slice(0, 2),
      sym: 'Усе зібрано «як на схемі», деталі ті самі, але коло не працює.',
      right: `${n} стоїть на один стовпчик ${side(d)} від свого місця`,
      wrong: ['Деталь несправна, її треба замінити', 'Не та напруга живлення'],
      explain: `${n} зсунуто на один стовпчик ${side(d)}. П’ять отворів стовпчика — одна металева смужка, тож зсув на один отвір переносить вивід в інший вузол: коло рветься або з’єднує не те. Звіряйте номер стовпчика кожного виводу.`,
    };
  }
  // fault info for (t, f, m) or null
  function info(t, f, m) {
    if (!T[t]) return null;
    if (f === 'mv') return m ? moveInfo(t, m[0], m[1]) : null;
    return T[t].faults[f] || null;
  }
  // every element key that may appear in a case of template t with fault f
  function elKeys(t, f) {
    const fa = info(t, f, null), adds = new Set(fa && fa.adds || []);
    const all = Object.values(T[t].faults).flatMap((x) => x.adds || []);
    return Object.keys(T[t].els).filter((k) => !all.includes(k) || adds.has(k));
  }

  /* ------------------------------------------------------------------ drawing helpers */
  function ctx(svg) {
    const K = window.Kit, P = K.P;
    const c = { K, P, svg, el: {} };
    c.bb = null;
    c.board = (opts = {}) => { c.bb = K.part('breadboard', Object.assign({ parent: svg, title: 'Макетна плата WB-102' }, opts)); return c.bb; };
    c.H = (col, row) => c.bb.hole(col, row);
    c.A = (n) => c.bb.at(n);
    c.X = (col) => c.bb.hole(col, 'a').x;
    c.route = (pts, colour, title, o) => {
      const w = K.route(svg, pts.map((q) => (typeof q === 'string' ? c.A(q) : q)), colour, o);
      if (title) sv('title', {}, w).textContent = title;
      return w;
    };
    // a hole → its rail; when the column has no rail hole (every sixth is a gap) the wire steps along the rail row
    c.toRail = (hole, sideSign, colour, title) => {
      const h = c.A(hole), col = +hole.slice(1), side = sideSign.startsWith('top') ? 'top' : 'bottom', sg = sideSign.slice(-1);
      const r = c.bb.rail(side, sg, col);
      return c.route(Math.abs(r.x - h.x) < 0.5 ? [h, r] : [h, { x: h.x, y: r.y }, r], colour, title);
    };
    c.esp = (col, title) => { const p = c.H(col, 'i'); return K.part('esp32s3', { parent: svg, x: p.x, y: p.y, rot: -90, title }); };
    // an invisible hit area where a missing element belongs (bbox of the points, inflated)
    c.gap = (pts, title) => {
      const q = pts.map((p) => (typeof p === 'string' ? c.A(p) : p));
      const xs = q.map((p) => p.x), ys = q.map((p) => p.y), pad = 16;
      const g = sv('g', { class: 'cs-gap' }, svg);
      sv('rect', { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + 2 * pad,
        height: Math.max(...ys) - Math.min(...ys) + 2 * pad, rx: 12 }, g);
      sv('title', {}, g).textContent = title;
      return g;
    };
    c.lbl = (x, y, s, anchor = 'middle') => { const t = sv('text', { class: 'cs-lbl', x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': anchor }, svg); t.textContent = s; return t; };
    // the breadboard fades out from x = cut, so a short scene does not carry 40 empty columns
    c.fade = (part, cut) => {
      const id = 'cs-fade-' + (++uid), defs = sv('defs', {}, svg);
      const lg = sv('linearGradient', { id: id + 'g', gradientUnits: 'userSpaceOnUse', x1: cut, x2: cut + 60, y1: 0, y2: 0 }, defs);
      sv('stop', { offset: 0, 'stop-color': '#fff' }, lg); sv('stop', { offset: 1, 'stop-color': '#000' }, lg);
      const m = sv('mask', { id, maskUnits: 'userSpaceOnUse', x: -600, y: -600, width: 3200, height: 2000 }, defs);
      sv('rect', { x: -600, y: -600, width: 3200, height: 2000, fill: `url(#${id}g)` }, m);
      part.setAttribute('mask', `url(#${id})`);
    };
    return c;
  }

  /* ------------------------------------------------------------------ the benches */
  const D = {};

  D.led = (c, f, s) => {
    const { K, P, el } = c;
    const bb = c.board();
    c.fade(bb, 22.6 * P);
    el.pm = K.part('power-module', { parent: c.svg, ...bb.rail('top', '+', 4), title: 'Модуль живлення MB-102' })
      .set({ on: true, top: 'OFF', bottom: f === 'off' ? 'OFF' : '5V' });
    const p = f === 'nores' ? 17 : 13 + s('red');
    el.red = c.toRail('j' + p, 'bottom+', 'red', `Червоний дріт: шина «+» → j${p}`);
    let rTxt = 'резистора немає';
    if (f !== 'nores') {
      if (f === 'strip') {
        el.res = K.part('resistor', { parent: c.svg, ohms: 1000, span: 3, rot: 90, ...c.H(13, 'f'), title: 'R1 1 кОм: f13 і i13' });
        rTxt = 'R1 1 кОм стоїть уздовж стовпчика 13 (f13–i13)';
      } else {
        const r = 13 + s('res');
        el.res = K.part('resistor', { parent: c.svg, ohms: 1000, ...c.H(r, 'h'), title: `R1 1 кОм: h${r} і h${r + 4}` });
        rTxt = `R1 1 кОм у h${r}–h${r + 4}`;
      }
    }
    const rev = f === 'rev', l = 17 + s('led');
    el.led = K.part('led', { parent: c.svg, color: 'red', leg: 40, mirror: rev, ...c.H(rev ? 18 : l, 'f'),
      title: rev ? 'LED1: катод f17, анод f18' : `LED1: анод f${l}, катод f${l + 1}` });
    const burnt = f === 'nores' || f === 'bypass';
    el.led.set({ on: c.broken ? 0 : 0.45, burnt });
    const k = 18 + s('blk');
    if (f === 'nogd') el.blk = c.gap(['j18', 'bottom-18'], 'Місце між стовпчиком 18 і шиною «−»');
    else el.blk = c.toRail('j' + k, f === 'blkplus' ? 'bottom+' : 'bottom-', 'black', `Чорний дріт: j${k} → шина «${f === 'blkplus' ? '+' : '−'}»`);
    if (f === 'bypass') el.byp = c.route(['i13', 'i17'], 'yellow', 'Жовта перемичка i13 → i17');
    const below = bb.size.h + 46;
    c.lbl(el.pm.pins['B+'].x + P / 2, below, 'MB-102');
    c.lbl(c.X(15), below, 'R1 1 кОм');
    c.lbl((el.led.pins.A.x + el.led.pins.K.x) / 2, -24, 'LED1');
    c.svg.setAttribute('viewBox', '-115 -66 735 690');
    return `Макетка: MB-102 на лівому краю (перемичка нижніх шин ${f === 'off' ? 'OFF' : '5 В'}), червоний дріт з шини «+» у стовпчик ${p}, ${rTxt}, ` +
      `червоний LED1 ${rev ? 'катодом у f17, анодом у f18' : `анодом у f${l}, катодом у f${l + 1}`}${burnt ? ' (згорів)' : ''}, ` +
      (f === 'nogd' ? 'дроту на шину «−» немає' : `чорний дріт з j${k} на шину «${f === 'blkplus' ? '+' : '−'}»`) + (f === 'bypass' ? ', жовта перемичка i13–i17.' : '.');
  };

  D.esp = (c, f, s) => {
    const { K, el } = c;
    const C0 = 14, bb = c.board();
    el.esp = c.esp(C0, 'Плата YD-ESP32-S3 у макетці: GPIO15 у стовпчику 21, GND у стовпчику 35');
    let rTxt;
    if (f === 'strip') { el.res = K.part('resistor', { parent: c.svg, ohms: 220, span: 3, rot: 90, ...c.H(8, 'f'), title: 'R1 220 Ом: f8 і i8' }); rTxt = 'R1 220 Ом уздовж стовпчика 8'; }
    else { const r = 4 + s('res'); el.res = K.part('resistor', { parent: c.svg, ohms: 220, ...c.H(r, 'h'), title: `R1 220 Ом: h${r} і h${r + 4}` }); rTxt = `R1 220 Ом у h${r}–h${r + 4}`; }
    const rev = f === 'rev', l = 4 + s('led');
    // mirrored = anode right (the R1 strip), cathode left; reversed = put in unmirrored at f3
    el.led = K.part('led', { parent: c.svg, color: 'red', leg: 40, mirror: !rev, ...c.H(rev ? 3 : l, 'f'),
      title: rev ? 'LED1: анод f3, катод f4' : `LED1: анод f${l}, катод f${l - 1}` });
    el.led.set({ on: c.broken ? 0 : 0.6 });
    const laneY = c.H(1, 'j').y + c.P * 1.15;
    const gc = f === 'gpio' ? C0 + 8 : C0 + 7, to = 8 + s('sig');
    const jg = c.A('j' + gc), jt = c.A('j' + to);
    el.sig = c.route([jg, { x: jg.x, y: laneY }, { x: jt.x, y: laneY }, jt], 'yellow', `Жовтий дріт: j${gc} (${f === 'gpio' ? 'GPIO16' : 'GPIO15'}) → j${to}`);
    const k = 3 + s('blk');
    el.blk = c.toRail('j' + k, 'bottom-', 'black', `Чорний дріт: j${k} → шина «−»`);
    if (f === 'nogd') el.gnd = c.gap(['j35', 'bottom-35'], 'Місце між GND плати (j35) і шиною «−»');
    else el.gnd = c.toRail('j35', f === 'gndplus' ? 'bottom+' : 'bottom-', 'black', `GND плати (j35) → шина «${f === 'gndplus' ? '+' : '−'}»`);
    if (f === 'nobr') el.br = c.gap(['bottom-31', 'bottom-33'], 'Місце розриву шини «−» (31 | 33)');
    else el.br = c.route(['bottom-31', 'bottom-33'], 'black', 'Перемичка через розрив шини «−»: 31 → 33');
    const below = bb.size.h + 46;
    c.lbl(c.X(6), below, 'R1 220 Ом');
    c.lbl((el.led.pins.A.x + el.led.pins.K.x) / 2, -24, 'LED1');
    c.lbl(c.X(25), below, 'ESP32-S3');
    c.K.fit(c.svg, 30);
    return `Макетка з платою ESP32-S3 (ліва гребінка в ряду i, стовпчики 14–35). Жовтий дріт з j${gc} по смузі під рядом j у j${to}, ${rTxt}, ` +
      `червоний LED1 ${rev ? 'анодом у f3, катодом у f4' : `анодом у f${l}, катодом у f${l - 1}`}, чорний дріт з j${k} на шину «−», ` +
      (f === 'nogd' ? 'від GND плати дроту немає' : `GND плати (j35) на шину «${f === 'gndplus' ? '+' : '−'}»`) + (f === 'nobr' ? ', перемички через розрив шини «−» немає.' : ', перемичка через розрив шини «−».');
  };

  D.btn = (c, f, s) => {
    const { K, P, el } = c;
    const C0 = 3, N = 34, bb = c.board();
    el.esp = c.esp(C0, 'Плата YD-ESP32-S3 у макетці: GPIO21 у стовпчику 20 (ряд a), 3V3 у стовпчику 3, GND у стовпчику 24');
    const r = N - 4 + s('res');
    el.res = K.part('resistor', { parent: c.svg, ohms: 10000, ...c.H(r, 'h'), title: `R1 10 кОм: h${r} і h${r + 4}` });
    const b = N + s('btn');
    el.btn = K.part('button', { parent: c.svg, ...c.H(b, 'e'), title: `Кнопка S1: ніжки в стовпчиках ${b} і ${b + 2}, над жолобком` });
    const laneT = c.H(1, 'a').y - P * 1.15;
    const gc = f === 'gpio' ? C0 + 18 : C0 + 17, to = N + s('sig'), ag = c.A('a' + gc), at = c.A('a' + to);
    el.sig = c.route([ag, { x: ag.x, y: laneT }, { x: at.x, y: laneT }, at], 'yellow', `Жовтий дріт: a${gc} (${f === 'gpio' ? 'GPIO20' : 'GPIO21'}) → a${to}`);
    if (f === 'nov33') el.v33 = c.gap(['j3', 'bottom+3'], 'Місце між 3V3 плати (j3) і шиною «+»');
    else el.v33 = c.toRail('j3', 'bottom+', 'orange', '3V3 плати (j3) → шина «+»');
    el.gnd = c.toRail('j24', 'bottom-', 'black', 'GND плати (j24) → шина «−»');
    el.r = c.toRail('j30', f === 'rgnd' ? 'bottom-' : 'bottom+', 'orange', `Дріт від R1: j30 → шина «${f === 'rgnd' ? '−' : '+'}»`);
    const k = N + 2 + s('k');
    el.k = c.toRail('j' + k, f === 's1plus' ? 'bottom+' : 'bottom-', 'black', `Чорний дріт від S1: j${k} → шина «${f === 's1plus' ? '+' : '−'}»`);
    if (f === 'nobr') el.br = c.gap(['bottom-31', 'bottom-33'], 'Місце розриву шини «−» (31 | 33)');
    else el.br = c.route(['bottom-31', 'bottom-33'], 'black', 'Перемичка через розрив шини «−»: 31 → 33');
    if (f === 's1plus') el.pbr = c.route(['bottom+31', 'bottom+33'], 'orange', 'Перемичка через розрив шини «+»: 31 → 33');
    const below = bb.size.h + 46;
    c.lbl(c.X(b + 1), -24, 'S1');
    c.lbl(c.X(r + 2), below, 'R1 10 кОм');
    c.lbl(c.X(14), below, 'ESP32-S3');
    K.fit(c.svg, 30);
    return `Макетка з платою ESP32-S3 (стовпчики 3–24). Жовтий дріт з a${gc} по смузі над рядом a у a${to}, кнопка S1 над жолобком у стовпчиках ${b} і ${b + 2}, ` +
      `R1 10 кОм у h${r}–h${r + 4}, ${f === 'nov33' ? 'дроту від 3V3 на шину «+» немає' : 'помаранчевий дріт 3V3 → «+»'}, дріт від R1 (j30) на «${f === 'rgnd' ? '−' : '+'}», ` +
      `чорний дріт від S1 (j${k}) на «${f === 's1plus' ? '+' : '−'}», GND плати на «−»` + (f === 'nobr' ? ', перемички через розрив «−» немає.' : ', перемичка через розрив «−».');
  };

  D.ldr = (c, f, s) => {
    const { K, P, el } = c;
    const C = { c0: 13, v33: 13, gpio: 16, gnd: 34, node: 7, top: 8, rgnd: 3 };
    const bb = c.board();
    el.esp = c.esp(C.c0, 'Плата YD-ESP32-S3 у макетці: 3V3 у стовпчику 13, GPIO4 у 16, GND у 34');
    const swap = f === 'swap', v5 = f === 'v5';
    const ldrL = (swap || v5 ? C.node - 1 : C.node) + s('ldr');
    el.ldr = K.part('ldr', { parent: c.svg, leg: 60, ...c.H(ldrL, 'g'), title: `Фоторезистор LDR1: g${ldrL} і g${ldrL + 1}` });
    const r1a = (swap ? C.node : C.rgnd) + s('res'), row = swap ? 'i' : 'h', ohms = f === 'r100k' ? 100000 : 10000;
    el.res = K.part('resistor', { parent: c.svg, ohms, ...c.H(r1a, row), title: `R1 ${ohms === 10000 ? '10' : '100'} кОм: ${row}${r1a} і ${row}${r1a + 4}` });
    const laneY = c.H(1, 'j').y + P * 1.15;
    const gc = f === 'adc2' ? 20 : C.gpio, to = C.node + s('sig'), jg = c.A('j' + gc), jn = c.A('j' + to);
    el.sig = c.route([jg, { x: jg.x, y: laneY }, { x: jn.x, y: laneY }, jn], 'yellow', `Жовтий дріт: j${gc} (${gc === C.gpio ? 'GPIO4' : 'GPIO15'}) → j${to}`);
    const top = (swap ? C.node + 4 : C.top) + s('top');
    if (v5) {
      el.v5 = c.toRail('j33', 'bottom+', 'red', '5V плати (j33) → шина «+»');
      el.v5b = c.route(['bottom+31', 'bottom+33'], 'red', 'Перемичка через розрив шини «+»: 31 → 33');
      el.top = c.route([c.bb.rail('bottom', '+', ldrL), 'j' + ldrL], 'red', `Шина «+» → j${ldrL}: верхня ніжка LDR1`);
    } else el.top = c.route(['j' + C.v33, 'j' + top], 'orange', `3V3 плати (j13) → j${top}`);
    const rk = swap ? C.node - 1 : C.rgnd;
    el.blk = c.toRail('j' + rk, f === 'float' ? 'bottom+' : 'bottom-', 'black', `Чорний дріт: j${rk} → шина «${f === 'float' ? '+' : '−'}»`);
    el.gnd = c.toRail('j' + C.gnd, 'bottom-', 'black', 'GND плати (j34) → шина «−»');
    if (f === 'nobr') el.br = c.gap(['bottom-31', 'bottom-33'], 'Місце розриву шини «−» (31 | 33)');
    else el.br = c.route(['bottom-31', 'bottom-33'], 'black', 'Перемичка через розрив шини «−»: 31 → 33');
    const below = bb.size.h + 46;
    c.lbl(c.X(ldrL) + P / 2, -24, 'LDR1');
    c.lbl(c.X(r1a + 2), below, `R1 ${ohms === 10000 ? '10' : '100'} кОм`);
    c.lbl(c.X(24), below, 'ESP32-S3');
    K.fit(c.svg, 30);
    return `Макетка з платою ESP32-S3 (стовпчики 13–34). LDR1 у g${ldrL}–g${ldrL + 1}, R1 ${ohms === 10000 ? '10' : '100'} кОм у ${row}${r1a}–${row}${r1a + 4}, ` +
      (v5 ? `червоний дріт від 5V плати (j33) на шину «+», перемичка через розрив «+», з шини «+» у j${ldrL}` : `помаранчевий дріт з 3V3 (j13) у j${top}`) +
      `, жовтий дріт з j${gc} по смузі під рядом j у j${to}, чорний дріт з j${rk} на «${f === 'float' ? '+' : '−'}», GND плати на «−»` +
      (f === 'nobr' ? ', перемички через розрив «−» немає.' : ', перемичка через розрив «−».');
  };

  D.relay = (c, f, s) => {
    const { K, P, el } = c;
    const bb = c.board(), A = c.A, H = c.H, X = c.X;
    const laneB = H(1, 'j').y + P * 1.15;
    el.mb = K.part('power-module', { parent: c.svg, ...bb.rail('top', '+', 1), title: 'Модуль живлення MB-102' })
      .set(f === 'off' ? { top: 'OFF', bottom: '5V' } : { top: '5V', bottom: '5V' });
    el.esp = c.esp(14, 'Плата YD-ESP32-S3 у макетці: GPIO5 у стовпчику 18, GND у стовпчику 35 (ряд a)');
    // BC547B: C d44 · B d45 · E d46 (flat face to you)
    const cB = 45, cC = 44, cE = 46, model = f === 'ce' ? '2N2222' : 'BC547B';
    const rb = cB + s('rb');
    if (f !== 'rb') el.rb = K.part('resistor', { parent: c.svg, ohms: 680, span: 3, ...H(rb, 'f'), rot: -90, title: `Rб 680 Ом: f${rb} → e${rb}` });
    else el.jump = c.route(['f45', 'e45'], 'yellow', 'Жовта перемичка f45 → e45');
    const q0 = cC + s('q');
    el.q = K.part('npn', { parent: c.svg, model, leg: 12, ...H(q0, 'd'), title: `Транзистор Q1 ${model}: d${q0}, d${q0 + 1}, d${q0 + 2}` });
    const d0 = cC + s('d1');
    if (f === 'fly') el.d1 = c.gap(['e40', 'e44'], 'Місце між e40 і e44');
    else if (f === 'drev') el.d1 = K.part('diode', { parent: c.svg, ...H(cC - 4, 'e'), title: 'Діод D1 1N4007: анод e40, смужка-катод e44' });
    else el.d1 = K.part('diode', { parent: c.svg, ...H(d0, 'e'), rot: 180, title: `Діод D1 1N4007: анод e${d0}, смужка-катод e${d0 - 4}` });
    el.relay = K.part('relay-module', { parent: c.svg, x: X(47), y: -7 * P, xray: true, title: 'Модуль реле над макеткою' }).set({ power: f !== 'off' });
    const gc = f === 'gpio' ? 19 : 18, to = cB + s('sig'), j18 = A('j' + gc), jB = A('j' + to);
    el.sig = c.route([j18, { x: j18.x, y: laneB }, { x: jB.x, y: laneB }, jB], 'yellow', `Жовтий дріт: j${gc} (${f === 'gpio' ? 'GPIO6' : 'GPIO5'}) → j${to}`);
    if (f === 'gnd') el.gnd = c.gap(['a35', 'top-35'], 'Місце між GND плати (a35) і шиною «−»');
    else el.gnd = c.route(['a35', 'top-35'], 'black', 'GND плати (a35) → шина «−»');
    el.brV = c.route(['top+31', 'top+33'], 'red', 'Перемичка через розрив шини «+»: 31 → 33');
    if (f === 'nobrG') el.brG = c.gap(['top-31', 'top-33'], 'Місце розриву шини «−» (31 | 33)');
    else el.brG = c.route(['top-31', 'top-33'], 'black', 'Перемичка через розрив шини «−»: 31 → 33');
    el.em = c.route(['a' + cE, 'top-' + cE], 'black', `Емітер (a${cE}) → шина «−»`);
    el.dW = c.route(['a' + (cC - 4), 'top+' + (cC - 4)], 'red', `Катод D1 (a${cC - 4}) → шина «+»`);
    const rl = el.relay, vcc = rl.pin('VCC'), gp = rl.pin('GND'), a = A('a' + cC), v = c.bb.rail('top', '+', cC - 1);
    c.route([v, { x: v.x, y: vcc.y }, vcc], 'red', 'Шина «+» → VCC модуля реле');
    el.coll = c.route([a, { x: a.x, y: gp.y }, gp], 'orange', `Колектор (a${cC}) → GND модуля реле`);
    c.route([rl.pin('IN'), gp], 'yellow', 'IN модуля реле з’єднаний з його GND', { width: 5 });
    const below = bb.size.h + 44;
    c.lbl(X(25), below, 'ESP32-S3');
    c.lbl(40, -44, 'MB-102');
    c.lbl(X(42), -7 * P + 30, 'K1 · модуль реле', 'end');
    K.fit(c.svg, 30);
    const vb = c.svg.viewBox.baseVal; // headroom: the ⤢ button sits in the top-right corner, keep it off the relay module
    c.svg.setAttribute('viewBox', `${vb.x} ${vb.y - 90} ${vb.width} ${vb.height + 90}`);
    return `Макетка: MB-102 на лівому краю (верхні шини ${f === 'off' ? 'OFF' : '5 В'}), плата ESP32-S3 у стовпчиках 14–35, жовтий дріт з j${gc} по смузі під рядом j у j${to}, ` +
      (f === 'rb' ? 'жовта перемичка f45–e45 замість резистора бази' : `Rб 680 Ом через жолобок f${rb}–e${rb}`) + `, ${model} у d${q0}–d${q0 + 2}, ` +
      (f === 'fly' ? 'діода D1 немає' : f === 'drev' ? 'D1 анодом у e40, смужкою в e44' : `D1 анодом у e${d0}, смужкою в e${d0 - 4}`) +
      `, модуль реле над макеткою: VCC від «+», GND модуля — помаранчевим дротом на колектор, ` +
      (f === 'gnd' ? 'GND плати ні з чим не з’єднаний' : 'GND плати на «−»') + (f === 'nobrG' ? ', перемички через розрив «−» немає.' : ', перемички через розриви шин.');
  };

  /* ------------------------------------------------------------------ draw */
  // stage: an element in the document (visible: Kit.fit measures). Returns { svg, el, aria }.
  // labels ≈ 13 px at the rendered width (never above 40 units: a phone shows the whole bench small, ⤢ zooms in)
  const ro = 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((e) => fitText(e.target))) : null;
  function fitText(svg) {
    if (!svg.isConnected) { if (ro) ro.unobserve(svg); return; }
    // the drawing is letterboxed inside the box (max-height), so the scale is the smaller of the two ratios
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    if (!(r.width > 0 && r.height > 0 && vb && vb.width && vb.height)) return;
    const k = Math.min(r.width / vb.width, r.height / vb.height);
    svg.style.setProperty('--cs-fs', Math.min(40, 13 / k).toFixed(1) + 'px');
  }
  function draw(stage, t, f, m) {
    const K = window.Kit;
    const svg = K.svg(stage, '0 0 10 10', T[t].name);
    svg.classList.add('cs-svg');
    const c = ctx(svg);
    c.broken = !!f;
    const shift = (key) => (f === 'mv' && m && m[0] === key ? m[1] : 0);
    const aria = D[t](c, f === 'mv' ? null : f, shift);
    svg.setAttribute('aria-label', aria);
    fitText(svg);
    if (ro) ro.observe(svg);
    return { svg, el: c.el, aria };
  }

  window.CaseScenes = { T, ORDER, info, elKeys, draw, moveInfo };
})();
