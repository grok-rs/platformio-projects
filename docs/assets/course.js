// course.js: the course manifest, window.COURSE (design brief §2.4). Single source of truth for the course map
// (index.html), the site navigation (site-nav.js) and the lesson hubs (Study.lessonInfo).
//
// Adding a lesson = adding one line below. Status:
//   'ready'   the hub at lessons/<id>/ is published and checked;
//   'draft'   the hub is being written (shown in the nav and on the map, marked «чернетка»);
//   'planned' no hub yet (map only, greyed out, still links to the LMS).
// Optional lesson fields: hub (path overriding lessons/<id>/), nav:false (not in the nav), deck:false (no cards/quiz),
// deep (links to existing deep pages), repo (project folders), challenge, cards and quiz (item counts once published).
// Paths (deep pages, globals, projects) are relative to the docs/ root.
//
// Privacy: never put the tldraw edit link or call recording URLs here — this file is public. They live in Slack.
(() => {
  const DAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  // Weekday from the ISO date, so a date fix never leaves a stale «пн».
  const dayOf = (iso) => (iso ? DAYS[new Date(iso + 'T12:00:00').getDay()] : null);

  // Lesson record with defaults; `x` holds the optional fields.
  const L = (id, n, title, short, date, lms, status, x = {}) => ({
    id, n, title, short, date, day: dayOf(date), lms, status,
    deep: [], repo: [], challenge: null, cards: null, quiz: null, ...x,
  });
  // A «Глибше» link from a hub to an existing deep page (key = folder under docs/, hash = optional anchor).
  const D = (key, label, hash = '') => ({ key, href: key + '/' + (hash ? '#' + hash : ''), label });

  window.COURSE = {
    title: 'Embedded на ESP32-S3',
    group: 'група Beetroot',
    lmsBase: 'https://lms.beetroot.academy/studying/cmrtipdkx2h1d0813u8g0a6le/theory/',
    repo: 'https://github.com/grok-rs/platformio-projects',
    site: 'https://grok-rs.github.io/platformio-projects/',
    verified: '2026-10-24',
    exitTicketUrl: null, // [ВИКЛАДАЧ] optional Google Form URL for exit tickets
    giscus: { repo: 'grok-rs/platformio-projects', repoId: 'R_kgDOUZinEw', category: 'Уроки', categoryId: null }, // [ВЛАСНИК]

    modules: [
      { id: '1', title: 'Модуль 1 · Електроніка і перша прошивка', short: 'Модуль 1', lessons: [
        L('1-1', '1.1', 'Мультиметр і закон Ома', 'Мультиметр', '2026-09-07', 'cmruq1s7jaooa0813bkp58q3f', 'ready',
          { cards: 27, quiz: 11, challenge: 'Детективи напруги' }),
        L('1-2', '1.2', 'Чи можна спалити світлодіод? Розрахунок резистора', 'Резистор для LED', '2026-09-09',
          'cmruq1s7maooe0813cjt0dvmg', 'ready',
          { cards: 23, quiz: 11, repo: ['esp32-s3-led-button'], challenge: 'Палітра Vf' }),
        L('1-3', '1.3', 'ESP32-S3 і перша прошивка Blink', 'Blink', '2026-09-12', 'cmruq1s7paooi0813u2ykd6m8', 'ready',
          { cards: 23, quiz: 12, deep: [D('lab', 'Стенд ESP32-S3 (інтерактивна модель)', 'led-blink')],
            repo: ['esp32-s3-led-blink', 'esp32-s3-led-pwm'], challenge: 'Азбука Морзе' }),
        L('1-4', '1.4', 'GPIO і розпіновка', 'GPIO', '2026-09-14', 'cmruq1s7saoom0813w0rub8ku', 'ready',
          { cards: 26, quiz: 11, deep: [D('pull-resistors', 'Теорія: підтяжка входу (інтерактив)'),
                   D('lab', 'Стенд ESP32-S3 (інтерактивна модель)', 'two-buttons')],
            repo: ['esp32-s3-two-buttons', 'esp32-s3-led-button'], challenge: 'Даташит-детективи' }),
        L('1-5', '1.5', 'Осцилограф, кнопка і брязкіт', 'Сигнали', '2026-09-16', 'cmruq1s7waooq0813vm0foazb', 'ready',
          { cards: 22, quiz: 12, deep: [D('scope-signals', 'Теорія: осцилограф'), D('bounce-lab', 'Лаба: брязкіт'),
                   D('bounce-bench', 'Наші дані: 190 подій брязкоту')],
            repo: ['esp32-s3-button-bounce', 'esp32-s3-bounce-test'], challenge: 'Чия кнопка найбрязкітливіша' }),
        L('1-6', '1.6', 'АЦП: як мікроконтролер «бачить» світло', 'АЦП', '2026-09-19', 'cmruq1s80aoou0813h3dh1mxd', 'ready',
          { cards: 23, quiz: 11, deep: [D('adc-light', 'Теорія: АЦП і світло'), D('ldr-lab', 'Лаба: люксметр')],
            repo: ['esp32-s3-ldr-adc'], challenge: 'Люксметр команди' }),
        L('mp1', 'МП1', 'Міні-проєкт 1: сутінковий перемикач', 'Міні-проєкт', '2026-09-21', 'cmruq1s84aooy0813msjmeaph', 'ready',
          { cards: 22, quiz: 11, deep: [D('twilight-relay', 'Міні-проєкт: сутінковий перемикач')],
            repo: ['esp32-s3-twilight-relay'], challenge: 'Музей помилок' }),
        L('mp1-review', 'МП1', 'Розбір міні-проєкту і гнучкий слот', 'Розбір', '2026-09-23', 'cmruq1s88aop2081360bppxkr', 'ready',
          { deck: false, cards: 0, quiz: 0 }), // the review hub has no cards or quiz of its own
        // The flex slot has no LMS content of its own: it is a section of the mp1-review hub, not a page (brief §1.1).
        L('flex1', '—', 'Гнучкий слот: поглиблення теми', 'Гнучкий слот', '2026-09-26', 'cmruq1s8baop60813v1ny8y1z', 'ready',
          { hub: 'lessons/mp1-review/#flex', nav: false, deck: false, cards: 0, quiz: 0 }),
      ]},
      { id: '2', title: 'Модуль 2 · Програмування MCU і силові навантаження', short: 'Модуль 2', lessons: [
        L('2-1', '2.1', 'C++ для мікроконтролера: обмеження і звички', 'C++ для MCU', '2026-09-28',
          'cmruq1s8gaopa0813apeaqj2m', 'ready',
          { cards: 26, quiz: 12, repo: ['esp32-s3-embedded-cpp'], challenge: 'Рефакторинг шкідливого скетчу' }),
        L('2-2', '2.2', 'Пасивні й активні: потужне навантаження', 'Навантаження', '2026-09-30',
          'cmruq1s8naope0813skhui09r', 'ready',
          { cards: 26, quiz: 12, deep: [D('power-loads', 'Теорія + ДЗ: потужне навантаження'),
                   D('twilight-relay', 'Міні-проєкт: сутінковий перемикач')],
            repo: ['esp32-s3-bright-module'], challenge: 'ТЗ-Б командою' }),
        L('2-3', '2.3', 'Суперцикл: кілька справ одночасно', 'Суперцикл', '2026-10-03', 'cmruq1s8raopi08136eo15xrg', 'ready',
          { cards: 25, quiz: 10, deep: [D('lab', 'Стенд ESP32-S3 (блокувальна прошивка)', 'two-buttons')],
            repo: ['esp32-s3-embedded-cpp'], challenge: 'Світлофор без delay' }),
        L('2-4', '2.4', 'Апаратні переривання', 'Переривання', '2026-10-05', 'cmruq1s8vaopm0813a135cfo6', 'ready',
          { cards: 28, quiz: 11, deep: [D('bounce-lab', 'Лаба: що бачить ISR', 'mcu'), D('bounce-bench', 'Наші дані: що бачить переривання', 'isr'),
                   D('scope-signals', 'Осцилограф: брязкіт і аналізатор', 'bounce')],
            repo: ['esp32-s3-bounce-test', 'esp32-s3-embedded-cpp'], challenge: 'Аварійна кнопка' }),
        L('2-5', '2.5', 'Таймери', 'Таймери', '2026-10-07', null, 'planned'),
        L('2-6', '2.6', 'Debounce', 'Debounce', '2026-10-10', null, 'planned'),
        L('mp2', 'МП2', 'Міні-проєкт 2', 'Міні-проєкт 2', '2026-10-12', null, 'planned'),
        L('mp2-review', 'МП2', 'Розбір міні-проєкту 2', 'Розбір', '2026-10-14', null, 'planned'),
        L('flex2', '—', 'Гнучкий слот', 'Гнучкий слот', '2026-10-17', null, 'planned', { nav: false }),
      ]},
      { id: '3', title: 'Модуль 3 · Аналогові сигнали, ШІМ і приводи', short: 'Модуль 3', lessons: [
        L('3-1', '3.1', 'Аналогові сигнали', 'Аналог', '2026-10-19', null, 'planned'),
        L('3-2', '3.2', 'Сирі дані ADC → фізичні величини', 'ADC → величини', '2026-10-21', null, 'planned'),
        L('3-3', '3.3', 'Керування потужністю і швидкістю (PWM)', 'PWM', '2026-10-24', null, 'planned'),
        L('3-4', '3.4', 'DAC', 'DAC', '2026-10-26', null, 'planned'),
        L('3-5', '3.5', 'Серво', 'Серво', '2026-10-28', null, 'planned'),
        L('3-6', '3.6', 'Енкодер', 'Енкодер', '2026-10-31', null, 'planned'),
      ]},
      { id: '4', title: 'Модуль 4 · Інтерфейси: UART, I²C, SPI', short: 'Модуль 4', starts: '2026-11-09', lessons: [
        L('4-1', '4.1', 'UART', 'UART', null, null, 'planned'),
        L('4-2', '4.2', 'I²C', 'I²C', null, null, 'planned'),
        L('4-3', '4.3', 'I²C: регістри', 'I²C регістри', null, null, 'planned'),
        L('4-4', '4.4', 'SPI', 'SPI', null, null, 'planned'),
        L('4-5', '4.5', 'SPI: датчик BME280', 'BME280', null, null, 'planned'),
        L('4-6', '4.6', 'DMA', 'DMA', null, null, 'planned'),
        L('4-7', '4.7', 'JTAG/SWD', 'JTAG/SWD', null, null, 'planned'),
      ]},
      { id: '5', title: 'Модуль 5 · Друкована плата, фільтри і регулятори', short: 'Модуль 5', lessons: [
        L('5-1', '5.1', 'KiCad: схема', 'KiCad схема', null, null, 'planned'),
        L('5-2', '5.2', 'KiCad: трасування', 'Трасування', null, null, 'planned'),
        L('5-3', '5.3', 'Gerber і виготовлення плати', 'Gerber', null, null, 'planned'),
        L('5-4', '5.4', 'RC-фільтри', 'RC-фільтри', null, null, 'planned'),
        L('5-5', '5.5', 'Програмні фільтри', 'Програмні фільтри', null, null, 'planned'),
        L('5-6', '5.6', 'PID-регулятор', 'PID', null, null, 'planned'),
      ]},
    ],

    // Global pages (brief §1.4). nav: shown in the «Довідка» nav group; ref: shown in the map's «Довідка» grid;
    // start: one of the «Почни тут» tiles.
    globals: [
      { key: 'start', href: 'start/', title: 'Як ми вчимося', short: 'Як вчимося', start: true,
        desc: 'Цикл «до заняття → на занятті → після», картки по 10 хвилин на день, команди й ролі, як просити допомоги.' },
      { key: 'cards', href: 'cards/', title: 'Картки', short: 'Картки', nav: true,
        desc: 'Тренажер інтервального повторення за всіма уроками, експорт в Anki.' },
      { key: 'warmup', href: 'warmup/', title: 'Розминка', short: 'Розминка', nav: true,
        desc: 'Питання зі старих уроків для початку заняття: великий шрифт, голосування, таймер.' },
      { key: 'team', href: 'team/', title: 'Командні виклики', short: 'Виклики', start: true,
        desc: 'Поточний виклик, ролі на тиждень, критерії й командні бали.' },
      { key: 'atlas', href: 'atlas/', title: 'Атлас компонентів', short: 'Атлас', nav: true, ref: true,
        desc: 'Кожна деталь з набору: як упізнати, символ, виводи, як перевірити мультиметром і як не спалити.' },
      { key: 'schematics', href: 'schematics/', title: 'Як читати схеми', short: 'Схеми', nav: true, ref: true,
        desc: 'Граматика схем, символи IEC і ANSI, позначення 4k7 і 104, ряд E12, вузли й кольори кіл.' },
      { key: 'bugs', href: 'bugs/', title: 'Знайди помилку', short: 'Помилки', ref: true,
        desc: 'Класичні помилки на макетці й у коді: спершу знайдіть самі, потім відповідь і як шукати мультиметром.' },
      { key: 'glossary', href: 'glossary/', title: 'Глосарій', short: 'Глосарій', nav: true, ref: true,
        desc: 'Терміни українською й англійською з пошуком і посиланням на урок, де їх пояснюють.' },
      { key: 'teacher', href: 'teacher/', title: 'Для викладача', short: 'Викладачу', ref: true,
        desc: 'Сценарій заняття на 120 хвилин, ConcepTest-и, коди помилкових уявлень, розминка й квиток на вихід.' },
    ],

    // Global card decks (data/cards/<id>.json), shown in the trainer's «Довідка» group. List a deck only once its
    // file is published: flashcards.js fetches exactly these, so an unpublished one would 404.
    decks: [
      { id: 'notation', title: 'Позначення номіналів: 4k7, 104, E12' },
      { id: 'symbols', title: 'Символи на схемах (IEC і ANSI)' },
      { id: 'atlas', title: 'Атлас компонентів: полярність, виводи, перевірка' },
    ],

    // The nine existing deep pages (brief §1.3): parent lesson first, then the other lessons that link to them.
    deepPages: {
      'pull-resistors': { lesson: '1-4', lessons: ['1-4'], title: 'Підтяжка входу', short: 'Підтяжка' },
      'lab': { lesson: '1-4', lessons: ['1-4', '1-3', '2-3'], title: 'Стенд ESP32-S3', short: 'Стенд' },
      'scope-signals': { lesson: '1-5', lessons: ['1-5', '2-4'], title: 'Осцилограф і кнопка', short: 'Осцилограф' },
      'bounce-lab': { lesson: '1-5', lessons: ['1-5', '2-4'], title: 'Лабораторія брязкоту', short: 'Лаба: брязкіт' },
      'bounce-bench': { lesson: '1-5', lessons: ['1-5', '2-4'], title: 'Брязкіт на стенді', short: 'Брязкіт на стенді' },
      'adc-light': { lesson: '1-6', lessons: ['1-6'], title: 'АЦП і світло', short: 'Теорія: АЦП' },
      'ldr-lab': { lesson: '1-6', lessons: ['1-6'], title: 'Люксметр на ESP32-S3', short: 'Лаба: люксметр' },
      'twilight-relay': { lesson: 'mp1', lessons: ['mp1', '2-2'], title: 'Сутінковий перемикач', short: 'Перемикач' },
      'power-loads': { lesson: '2-2', lessons: ['2-2'], title: 'Потужне навантаження', short: 'Навантаження' },
    },

    // Every esp32-s3-* folder in the repository (README table).
    projects: [
      { folder: 'esp32-s3-led-blink', title: 'Миготіння світлодіодів', lessons: ['1-3'],
        desc: 'Червоний і синій LED по черзі; патерни, третій LED, швидкість і два LED з одного піна (три стани виходу).' },
      { folder: 'esp32-s3-led-pwm', title: 'Яскравість через ШІМ', lessons: ['1-3'],
        desc: 'LEDC 5 кГц, 8 біт, заповнення 25 % на GPIO15 і логічний аналізатор на тому ж проводі.' },
      { folder: 'esp32-s3-led-button', title: 'Світлодіод і кнопка', lessons: ['1-2', '1-4'],
        desc: 'LED на GPIO15 через 220 Ом і кнопка на GPIO21 з INPUT_PULLUP: режим «тримати» і перемикання з debounce.' },
      { folder: 'esp32-s3-two-buttons', title: 'Дві кнопки', lessons: ['1-4'],
        desc: 'Зовнішня кнопка й BOOT на платі вибирають режим миготіння двох LED.' },
      { folder: 'esp32-s3-button-bounce', title: 'Брязкіт кнопки', lessons: ['1-5'],
        desc: 'Лічильник FALLING з ДЗ і лабораторна прошивка, що ставить мітку часу кожному фронту; скрипт для запису аналізатора.' },
      { folder: 'esp32-s3-bounce-test', title: 'Тест брязкоту з перериванням', lessons: ['1-5', '2-4'],
        desc: 'Переривання CHANGE на GPIO21 і звіт про кожне натискання, щоб порівняти з логічним аналізатором.' },
      { folder: 'esp32-s3-ldr-adc', title: 'Фоторезистор і АЦП', lessons: ['1-6'],
        desc: 'Подільник LDR + 10 кОм на GPIO4: сирі відліки, напруга з формули й калібрована, відносна похибка.' },
      { folder: 'esp32-s3-twilight-relay', title: 'Сутінковий перемикач', lessons: ['mp1'],
        desc: 'АЦП, два пороги з гістерезисом, ключ на BC547B і модуль реле 5 В; налаштований відладчик USB-JTAG.' },
      { folder: 'esp32-s3-embedded-cpp', title: 'Embedded C++', lessons: ['2-1', '2-3', '2-4'],
        desc: 'Blink без delay(), класи без купи й глобальних змінних, час проходу суперциклу, кнопка на перериванні, тести на ПК.' },
      { folder: 'esp32-s3-bright-module', title: 'ТЗ-A «Яскравий модуль»', lessons: ['2-2'],
        desc: 'Транзисторний ключ 2N2222 від живлення MB-102, ШІМ з чотирма рівнями й кнопкою, порівняння з програмним ШІМ.' },
    ],
  };
})();
