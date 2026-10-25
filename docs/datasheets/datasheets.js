// datasheets.js: «Тренажер даташитів» (docs/datasheets/). Page-local; loaded with `defer` after study.js.
//
// SHEETS holds re-typed excerpts of real datasheet tables (not screenshots). Every value row names its source:
//   f: 'fact-id' | ['id', …]  → a <sup class="cite" data-fact> (docs/data/facts.json, numbered by Study.cites)
//   d: 'vishay' | …           → a page-local primary source (DOCS below, listed in #ds-docs with its URL)
// Values that could not be verified are not in the tables («·» = not carried over into this excerpt).
// Cell keys are `${row.k}:${col.k}` (a spanning cell takes the key of its first column).
// Tasks: { id, q, a: key | [keys] | 'none', skill, explain, wrong: { key: text } }. Progress: Study.store 'datasheets.v1'.
(() => {
  'use strict';
  const S = window.Study;
  const doc = document;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Datasheet symbols get their subscripts back: VCEO → V<sub>CEO</sub>, hFE → h<sub>FE</sub> (text is escaped first).
  const SYMS = ['VCE(sat)', 'VBE(on)', 'IF(AV)', 'Ioutput', 'TSTORE', 'λpeak', 'VCEO', 'VCBO', 'VEBO', 'VRRM', 'VRMS', 'IVDD', 'Tstg', 'TSTG',
    'VCE', 'VBE', 'VCB', 'VEB', 'VDC', 'IFSM', 'IFP', 'VIH', 'VIL', 'VOH', 'VOL', 'IOH', 'IOL', 'RPU', 'RPD', 'CIN', 'VDD', 'TCV', 'hFE',
    'IC', 'IB', 'IE', 'PD', 'TA', 'TC', 'TJ', 'Tj', 'IF', 'IR', 'VF', 'VR'];
  const SYM_RE = new RegExp(`(?<![A-Za-z0-9_])(${SYMS.map((x) => x.replace(/[()]/g, '\\$&')).join('|')})(?![A-Za-z0-9_])`, 'g');
  const subs = (html) => html.replace(SYM_RE, (m) => {
    if (m === 'TCV') return 'TC<sub>V</sub>';
    if (m === 'λpeak') return 'λ<sub>peak</sub>';
    return `${m[0]}<sub>${m.slice(1)}</sub>`;
  });
  const fmt = (s) => subs(esc(s));
  const store = S ? S.store : { get: (k, f) => f, set() {}, del() {} };
  const toast = (m, k) => { if (S && S.toast) S.toast(m, k); };

  /* ================================================================ primary sources (not in facts.json) */
  const DOCS = {
    bc546: { n: 'Д1', t: 'onsemi BC546/D Rev. 8 (Aug 2021): BC546B, BC547A/B/C, BC548B/C', url: 'https://www.onsemi.com/pdf/datasheet/bc546-d.pdf',
      note: 'Значення цієї деталі взято з реєстру фактів (посилання [n] біля рядків).' },
    p2n2222a: { n: 'Д2', t: 'onsemi P2N2222A/D Rev. 7 (Jan 2013), копія на SparkFun', url: 'https://cdn.sparkfun.com/datasheets/Components/General/P2N2222A-D.PDF',
      note: 'Maximum Ratings (VCBO, VEBO, PD, TJ) і On Characteristics перевірено за цим PDF 25.10.2026.' },
    vishay: { n: 'Д3', t: 'Vishay 1N4001 thru 1N4007, Document Number 88503, Revision 29-Apr-2020', url: 'https://www.vishay.com/docs/88503/1n4001.pdf',
      note: 'Maximum Ratings і Electrical Characteristics (VRMS, VDC, IFSM, IR, TJ) перевірено за цим PDF 25.10.2026.' },
    kb7113: { n: 'Д4', t: 'Kingbright WP7113ID, T-1 3/4 (5 мм), Spec DSAF0012 Rev V.14A (01/08/2026)', url: 'https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf',
      note: 'Червоний 5 мм світлодіод з розсіювальною лінзою. Усі рядки перевірено за цим PDF 25.10.2026. У реєстрі фактів поки лише 3 мм WP710A10ID — у нього ті самі VF 1,9 / 2,3 В і IF 30 мА.' },
    esp: { n: 'Д5', t: 'ESP32-S3 Series Datasheet v2.2, §5 Electrical Characteristics', url: 'https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf',
      note: 'Таблиці 5-1, 5-2, 5-4 звірено з PDF 25.10.2026 (рядок TSTORE — лише за PDF).' },
    ut136: { n: 'Д6', t: 'UNI-T UT136B+/C+ User Manual (P/N 110401107604X)', url: 'https://f00.psgsm.net/product/917141/ut136-english-manual.pdf',
      note: 'Інструкція — скан, тож рядки переказано українською лише за реєстром фактів; інших рядків (діапазони 400 В, 600 В тощо) тут немає.' },
  };

  /* ================================================================ the sheets */
  const C = (k, h, kind, extra) => ({ k, h, kind, ...extra });
  const SHEETS = [
    {
      id: 'bc547', tab: 'BC547B', title: 'BC547B', kind: 'NPN-транзистор, TO-92', maker: 'onsemi', docRef: 'BC546/D Rev. 8', src: 'bc546',
      tables: [
        { title: 'MAXIMUM RATINGS', sub: 'уривок: лише стовпець BC547',
          cols: [C('p', 'Rating', 'p'), C('sym', 'Symbol', 'sym'), C('val', 'BC547', 'val'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'vceo', c: [['Collector − Emitter Voltage', 'напруга колектор–емітер'], 'VCEO', '45', 'V'], f: 'bc547-vceo' },
            { k: 'ic', c: [['Collector Current − Continuous', 'постійний струм колектора'], 'IC', '100', 'mA'], f: 'bc547-ic-max' },
            { k: 'pd', c: [['Total Device Dissipation @ TA = 25 °C', 'потужність розсіювання'], 'PD', '625', 'mW'], f: 'bc547-pd' },
          ] },
        { title: 'ON CHARACTERISTICS', sub: 'TA = 25 °C',
          cols: [C('p', 'Characteristic', 'p'), C('sym', 'Symbol', 'sym'), C('cond', 'Test conditions', 'cond'), C('min', 'Min', 'min'), C('typ', 'Typ', 'typ'), C('max', 'Max', 'max'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'ha', c: [['DC Current Gain — BC547A', 'підсилення, група A'], 'hFE', 'IC = 2.0 mA, VCE = 5.0 V', '110', '·', '220', '—'], f: 'bc547-hfe-groups' },
            { k: 'hb', c: [['DC Current Gain — BC547B', 'підсилення, група B'], 'hFE', 'IC = 2.0 mA, VCE = 5.0 V', '200', '290', '450', '—'], f: 'bc547b-hfe' },
            { k: 'hc', c: [['DC Current Gain — BC547C', 'підсилення, група C'], 'hFE', 'IC = 2.0 mA, VCE = 5.0 V', '420', '·', '800', '—'], f: 'bc547-hfe-groups' },
            { k: 'sat1', c: [['Collector − Emitter Saturation Voltage', 'напруга насичення'], 'VCE(sat)', 'IC = 10 mA, IB = 0.5 mA', '·', '0.09', '0.25', 'V'], f: 'bc547-vcesat' },
            { k: 'sat2', c: ['', '', 'IC = 100 mA, IB = 5.0 mA', '·', '0.2', '0.6', 'V'], f: 'bc547-vcesat' },
            { k: 'vbe1', c: [['Base − Emitter On Voltage', 'напруга база–емітер'], 'VBE(on)', 'IC = 2.0 mA, VCE = 5.0 V', '0.55', '·', '0.7', 'V'], f: 'bc547-vbe' },
            { k: 'vbe2', c: ['', '', 'IC = 10 mA', '·', '·', '0.77', 'V'], f: 'bc547-vbe' },
          ] },
      ],
      tasks: [
        { id: 'bc-ic', skill: 'abs', a: 'ic:val',
          q: 'Який максимальний постійний струм колектора BC547B?',
          explain: 'Рядок <b>IC</b> у таблиці <b>Maximum Ratings</b>: <b>100 мА</b>. Maximum Ratings — це абсолютні максимуми: межа, за якою деталь може зіпсуватися. Це не робочий струм: схему розраховують так, щоб до цієї межі лишався запас.' },
        { id: 'bc-hfe-min', skill: 'mtm', a: 'hb:min',
          q: 'Ви рахуєте базовий резистор для BC547B. На яке <em>найменше</em> підсилення h<sub>FE</sub> можна гарантовано розраховувати?',
          explain: 'Рядок <b>BC547B</b>, стовпець <b>Min</b>: <b>200</b>. Min — гарантована нижня межа для кожного екземпляра. Typ (290) — «середній» транзистор: половина партії може бути слабшою. Для розрахунку беріть Min, і лише для активного режиму: ключ у насиченні рахують інакше (I<sub>B</sub> ≈ I<sub>C</sub>/10…I<sub>C</sub>/20).',
          wrong: { 'hb:typ': '290 — типове значення. Половина транзисторів може мати менше. Питання про те, на що можна <em>гарантовано</em> розраховувати.', 'hb:max': '450 — верхня межа групи B: так буває, але гарантії немає.' } },
        { id: 'bc-group', skill: 'col', a: 'hc:min',
          q: 'На корпусі транзистора написано <b>BC547C</b>. Клацніть найменше h<sub>FE</sub>, яке має ця група.',
          explain: 'Літера після номера — <b>група за підсиленням</b>: A — 110…220, B — 200…450, C — <b>420</b>…800. Це той самий кристал, відсортований після виробництва. Тому спершу знайдіть рядок своєї літери, а потім уже стовпець.' },
        { id: 'bc-sat', skill: 'cond', a: 'sat2:max',
          q: 'Ключ на BC547 вмикає навантаження <b>100 мА</b>, у базу йде <b>5 мА</b>. Скільки вольт найбільше «з’їсть» відкритий транзистор?',
          explain: 'V<sub>CE(sat)</sub> має два рядки з різними умовами. Ваша схема збігається з другим: I<sub>C</sub> = 100 mA, I<sub>B</sub> = 5.0 mA → максимум <b>0,6 В</b>. Зверніть увагу: умови задано з I<sub>B</sub> = I<sub>C</sub>/20. Якщо базового струму менше, транзистор може не насититися, і напруга буде більша.',
          wrong: { 'sat1:max': '0,25 В — це для I<sub>C</sub> = 10 мА. Значення в даташиті правдиве лише за тих умов, що в стовпці Test conditions. Знайдіть рядок зі своїм струмом.', 'sat2:typ': 'Рядок правильний, але 0,2 В — типове. Питання «найбільше» — це Max.' } },
      ],
    },
    {
      id: 'p2n2222', tab: '2N2222A', title: 'P2N2222A', kind: 'NPN-транзистор, TO-92', maker: 'onsemi', docRef: 'P2N2222A/D Rev. 7', src: 'p2n2222a',
      tables: [
        { title: 'PIN CONNECTIONS', sub: 'TO−92, CASE 29, STYLE 17',
          cols: [C('pin', 'Pin', 'val'), C('fn', 'Function', 'val')],
          rows: [
            { k: 'p1', c: ['1', 'COLLECTOR'], f: 'p2n2222a-pinout' },
            { k: 'p2', c: ['2', 'BASE'], f: 'p2n2222a-pinout' },
            { k: 'p3', c: ['3', 'EMITTER'], f: 'p2n2222a-pinout' },
          ] },
        { title: 'MAXIMUM RATINGS', sub: 'TA = 25 °C unless otherwise noted',
          cols: [C('p', 'Characteristic', 'p'), C('sym', 'Symbol', 'sym'), C('val', 'Value', 'val'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'vceo', c: [['Collector − Emitter Voltage', 'напруга колектор–емітер'], 'VCEO', '40', 'Vdc'], f: 'p2n2222a-ic-max' },
            { k: 'vcbo', c: [['Collector − Base Voltage', 'напруга колектор–база'], 'VCBO', '75', 'Vdc'], d: 'p2n2222a' },
            { k: 'vebo', c: [['Emitter − Base Voltage', 'зворотна напруга емітер–база'], 'VEBO', '6.0', 'Vdc'], d: 'p2n2222a' },
            { k: 'ic', c: [['Collector Current − Continuous', 'постійний струм колектора'], 'IC', '600', 'mAdc'], f: 'p2n2222a-ic-max' },
            { k: 'pda', c: [['Total Device Dissipation @ TA = 25 °C', 'потужність, повітря 25 °C'], 'PD', '625', 'mW'], d: 'p2n2222a' },
            { k: 'pdad', c: [['Derate above 25 °C', 'зменшення на кожен градус'], '', '5.0', 'mW/°C'], d: 'p2n2222a' },
            { k: 'pdc', c: [['Total Device Dissipation @ TC = 25 °C', 'потужність, корпус 25 °C'], 'PD', '1.5', 'W'], d: 'p2n2222a' },
            { k: 'tj', c: [['Operating and Storage Junction Temperature Range', 'температура переходу'], 'TJ, Tstg', '−55 to +150', '°C'], d: 'p2n2222a' },
          ] },
        { title: 'ON CHARACTERISTICS', sub: 'уривок; (1) Pulse Test: Pulse Width ≤ 300 µs, Duty Cycle ≤ 2.0 %',
          cols: [C('p', 'Characteristic', 'p'), C('sym', 'Symbol', 'sym'), C('cond', 'Test conditions', 'cond'), C('min', 'Min', 'min'), C('max', 'Max', 'max'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'h150', c: [['DC Current Gain (1)', 'підсилення'], 'hFE', 'IC = 150 mAdc, VCE = 10 Vdc', '100', '300', '—'], f: 'p2n2222a-hfe' },
            { k: 'h150l', c: ['', '', 'IC = 150 mAdc, VCE = 1.0 Vdc', '50', '−', '—'], f: 'p2n2222a-hfe' },
            { k: 's150', c: [['Collector − Emitter Saturation Voltage (1)', 'напруга насичення'], 'VCE(sat)', 'IC = 150 mAdc, IB = 15 mAdc', '−', '0.3', 'Vdc'], f: 'p2n2222a-vcesat' },
            { k: 's500', c: ['', '', 'IC = 500 mAdc, IB = 50 mAdc', '−', '1.0', 'Vdc'], f: 'p2n2222a-vcesat' },
          ] },
      ],
      tasks: [
        { id: 'p2-base', skill: 'col', a: ['p2:pin', 'p2:fn'],
          q: 'Який вивід P2N2222A — база? Клацніть його номер.',
          explain: 'У Style 17: <b>1 — колектор, 2 — база, 3 — емітер</b> (плоский бік до себе, виводи вниз, зліва направо C-B-E). Але PN2222A інших виробників часто має E-B-C, а металевий 2N2222A (TO-18) — іншу розкладку. Тому таблицю виводів читають у даташиті <em>саме вашої</em> деталі, а сумнів перевіряють мультиметром.' },
        { id: 'p2-ic', skill: 'abs', a: 'ic:val',
          q: 'Який найбільший постійний струм колектора P2N2222A?',
          explain: '<b>600 мА</b> (mAdc — «міліампер постійного струму»). Це в шість разів більше, ніж у BC547 (100 мА), тому для реле чи мотора частіше беруть 2N2222A. І знову: це абсолютний максимум, а не робочий струм.' },
        { id: 'p2-pd', skill: 'cond', a: 'pda:val',
          q: 'Транзистор стоїть на макетці без радіатора, у кімнаті 25 °C. Яку найбільшу потужність він може розсіяти?',
          explain: '<b>625 мВт</b> — рядок «@ T<sub>A</sub> = 25 °C»: A = ambient, температура повітря довкола. Рядок «@ T<sub>C</sub> = 25 °C» (C = case) означає, що корпус примусово тримають при 25 °C — на великому радіаторі. На макетці так не буває. А рядок «Derate» каже: що тепліше в кімнаті, то менше — на 5 мВт за кожен градус понад 25 °C.',
          wrong: { 'pdc:val': '1,5 Вт — при T<sub>C</sub> = 25 °C: корпус тримають холодним радіатором. Без радіатора корпус нагрівається, тож це не ваш випадок. Шукайте T<sub>A</sub> (ambient — повітря).', 'pdad:val': 'Це не сама потужність, а її зменшення на кожен градус понад 25 °C (мВт/°C).' } },
        { id: 'p2-sat', skill: 'cond', a: 's500:max',
          q: 'Через ключ іде <b>500 мА</b>, у базу — <b>50 мА</b>. Яка найбільша напруга на відкритому транзисторі?',
          explain: 'Рядок з умовами I<sub>C</sub> = 500 mAdc, I<sub>B</sub> = 50 mAdc: <b>1,0 В</b>. При 500 мА це вже 0,5 Вт тепла в корпусі — помітна частина від 625 мВт. Позначка (1) — вимірювання короткими імпульсами, щоб кристал не встиг нагрітися.',
          wrong: { 's150:max': '0,3 В — для 150 мА. Знайдіть рядок, де умови збігаються з вашими 500 мА.' } },
      ],
    },
    {
      id: 'd4007', tab: '1N4007', title: '1N4007', kind: 'випрямний діод, DO-41', maker: 'Vishay', docRef: 'Doc. 88503, 29-Apr-2020', src: 'vishay',
      tables: [
        { title: 'MAXIMUM RATINGS', sub: 'TA = 25 °C unless otherwise noted',
          cols: [C('p', 'Parameter', 'p'), C('sym', 'Symbol', 'sym'), C('1', '1N4001', 'other'), C('2', '1N4002', 'other'), C('3', '1N4003', 'other'), C('4', '1N4004', 'other'),
            C('5', '1N4005', 'other'), C('6', '1N4006', 'other'), C('7', '1N4007', 'val'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'vrrm', c: [['Maximum repetitive peak reverse voltage', 'повторювана пікова зворотна напруга'], 'VRRM', '50', '100', '200', '400', '600', '800', '1000', 'V'], f: ['diode-1n4007', 'd1n4007-polarity'] },
            { k: 'vrms', c: [['Maximum RMS voltage', 'діюча (RMS) напруга'], 'VRMS', '35', '70', '140', '280', '420', '560', '700', 'V'], d: 'vishay' },
            { k: 'vdc', c: [['Maximum DC blocking voltage', 'постійна зворотна напруга'], 'VDC', '50', '100', '200', '400', '600', '800', '1000', 'V'], d: 'vishay' },
            { k: 'ifav', c: [['Maximum average forward rectified current, 0.375" (9.5 mm) lead length at TA = 75 °C', 'середній прямий струм'], 'IF(AV)', { v: '1.0', span: 7 }, 'A'], f: 'diode-1n4007' },
            { k: 'ifsm', c: [['Peak forward surge current 8.3 ms single half sine-wave superimposed on rated load', 'одиночний кидок струму'], 'IFSM', { v: '30', span: 7 }, 'A'], d: 'vishay' },
            { k: 'tj', c: [['Operating junction and storage temperature range', 'температура переходу'], 'TJ, TSTG', { v: '−50 to +150', span: 7 }, '°C'], d: 'vishay' },
          ] },
        { title: 'ELECTRICAL CHARACTERISTICS', sub: 'TA = 25 °C unless otherwise noted; однакові для 1N4001…1N4007',
          cols: [C('p', 'Parameter', 'p'), C('cond', 'Test conditions', 'cond'), C('sym', 'Symbol', 'sym'), C('val', '1N4001…1N4007', 'val'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'vf', c: [['Maximum instantaneous forward voltage', 'пряма напруга (найбільша)'], '1.0 A', 'VF', '1.1', 'V'], f: 'diode-1n4007' },
            { k: 'ir25', c: [['Maximum DC reverse current at rated DC blocking voltage', 'зворотний струм витоку'], 'TA = 25 °C', 'IR', '5.0', 'µA'], d: 'vishay' },
            { k: 'ir125', c: ['', 'TA = 125 °C', 'IR', '50', 'µA'], d: 'vishay' },
          ] },
      ],
      tasks: [
        { id: 'd-vrrm', skill: 'col', a: 'vrrm:7',
          q: 'Яку найбільшу повторювану зворотну напругу витримує саме <b>1N4007</b>?',
          explain: 'Одна таблиця описує сім діодів 1N4001…1N4007: вони відрізняються лише зворотною напругою. Рядок V<sub>RRM</sub>, стовпець <b>1N4007</b>: <b>1000 В</b>. Звідси й звичка класти в набір саме 1N4007: він заміняє будь-якого «молодшого брата».' },
        { id: 'd-ifav', skill: 'cond', a: 'ifav:1',
          q: 'Який <em>середній</em> прямий струм дозволено 1N4007?',
          explain: '<b>1,0 А</b> — одна клітинка на всі сім стовпців. Прочитайте умови в назві рядка: виводи довжиною 9,5 мм і повітря T<sub>A</sub> = 75 °C. Котушці реле на 70–90 мА цього більш ніж досить; для струмів, близьких до 1 А, умови охолодження вже важать.' },
        { id: 'd-vf', skill: 'mtm', a: 'vf:val',
          q: 'Скільки найбільше вольт падає на діоді при прямому струмі <b>1 А</b>?',
          explain: '<b>1,1 В</b>. Тут немає стовпців Min / Typ / Max: слово <b>Maximum</b> стоїть у самій назві рядка. А умова 1.0 A стоїть у стовпці Test conditions: при меншому струмі (як на макетці) падіння менше — зазвичай 0,6–0,8 В.',
          wrong: { 'vf:cond': '1.0 A — це умова вимірювання (за якого струму виміряно), а не відповідь. Саме число — у стовпці 1N4001…1N4007.' } },
        { id: 'd-ifsm', skill: 'abs', a: 'ifsm:1',
          q: 'У момент увімкнення через діод проходить короткий кидок струму. Яку одиночну хвилю він витримує?',
          explain: 'I<sub>FSM</sub> = <b>30 А</b>, але лише як <em>одиночна</em> напівхвиля тривалістю 8,3 мс. Це не означає, що діод можна тримати на 30 А. Повторюваний струм — I<sub>F(AV)</sub>, 1 А. Читайте не лише число, а й те, як довго і як часто воно дозволене.',
          wrong: { 'ifav:1': '1,0 А — середній струм, який діод несе постійно. Для короткого кидка є окремий рядок (surge — «кидок»).' } },
      ],
    },
    {
      id: 'led', tab: 'LED 5 мм', title: 'WP7113ID', kind: 'червоний світлодіод 5 мм', maker: 'Kingbright', docRef: 'DSAF0012 Rev V.14A', src: 'kb7113',
      tables: [
        { title: 'ELECTRICAL / OPTICAL CHARACTERISTICS', sub: 'at TA = 25 °C; уривок',
          cols: [C('p', 'Parameter', 'p'), C('sym', 'Symbol', 'sym'), C('typ', 'Typ.', 'typ'), C('max', 'Max.', 'max'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'lp', c: [['Wavelength at Peak Emission IF = 10 mA', 'довжина хвилі'], 'λpeak', '627', '−', 'nm'], d: 'kb7113' },
            { k: 'vf', c: [['Forward Voltage IF = 10 mA', 'пряма напруга'], 'VF [2]', '1.9', '2.3', 'V'], d: 'kb7113' },
            { k: 'ir', c: [['Reverse Current (VR = 5 V)', 'зворотний струм'], 'IR', '−', '10', 'µA'], d: 'kb7113' },
            { k: 'tcv', c: [['Temperature Coefficient of VF, IF = 10 mA, −10 °C ≤ T ≤ 85 °C', 'зміна VF від нагріву'], 'TCV', '−1.9', '−', 'mV/°C'], d: 'kb7113' },
          ],
          notes: ['[2] Forward voltage: ±0.1 V.'] },
        { title: 'ABSOLUTE MAXIMUM RATINGS', sub: 'at TA = 25 °C; уривок',
          cols: [C('p', 'Parameter', 'p'), C('sym', 'Symbol', 'sym'), C('val', 'Value', 'val'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'pd', c: [['Power Dissipation', 'потужність'], 'PD', '75', 'mW'], d: 'kb7113' },
            { k: 'vr', c: [['Reverse Voltage', 'зворотна напруга'], 'VR', '5', 'V'], d: 'kb7113' },
            { k: 'tj', c: [['Junction Temperature', 'температура кристала'], 'Tj', '125', '°C'], d: 'kb7113' },
            { k: 'if', c: [['DC Forward Current', 'постійний прямий струм'], 'IF', '30', 'mA'], d: 'kb7113' },
            { k: 'ifp', c: [['Peak Forward Current', 'імпульсний струм'], 'IFP [1]', '160', 'mA'], d: 'kb7113' },
          ],
          notes: ['[1] 1/10 Duty Cycle, 0.1 ms Pulse Width.'] },
      ],
      tasks: [
        { id: 'led-vf', skill: 'mtm', a: 'vf:typ',
          q: 'Яку пряму напругу світлодіода підставляють у звичайний розрахунок резистора (типове значення)?',
          explain: '<b>1,9 В</b> — Typ. Подивіться і на умову в назві рядка: I<sub>F</sub> = 10 mA. Kingbright міряє червоні світлодіоди при 10 мА, а не при «стандартних» 20. Від 3,3 В через 220 Ом: (3,3 − 1,9) / 220 ≈ 6,4 мА.',
          wrong: { 'vf:max': '2,3 В — найгірший екземпляр (Max). Для звичайного розрахунку беруть Typ; Max знадобиться, коли треба гарантувати, що вистачить напруги.' } },
        { id: 'led-vfmax', skill: 'mtm', a: 'vf:max',
          q: 'Якою найбільшою може бути V<sub>F</sub> у будь-якого світлодіода цієї моделі при 10 мА?',
          explain: '<b>2,3 В</b> — стовпець Max. Примітка [2] додає ще допуск вимірювання ±0,1 В. Якщо живлення ледве більше за V<sub>F</sub> (синій чи білий від 3,3 В), саме Max вирішує, чи світитиме кожен екземпляр.' },
        { id: 'led-if', skill: 'abs', a: 'if:val',
          q: 'Який найбільший <em>постійний</em> струм дозволено через цей світлодіод?',
          explain: '<b>30 мА</b> — DC Forward Current в Absolute Maximum Ratings. Це межа, а не робоча точка: на уроках беремо 5–10 мА, і світлодіод світить яскраво.',
          wrong: { 'ifp:val': '160 мА — лише імпульсами: 0,1 мс, скважність 1/10 (примітка [1]). Постійно так не можна. Знаходьте примітки, на які посилаються квадратні дужки.' } },
        { id: 'led-vr', skill: 'abs', a: 'vr:val',
          q: 'Яку найбільшу зворотну напругу (світлодіод вставлено навпаки) витримує ця деталь?',
          explain: 'V<sub>R</sub> = <b>5 В</b>. Світлодіод — поганий випрямляч: зворотна межа в нього крихітна порівняно з 1000 В у 1N4007. Від 3,3 В навпаки йому нічого не станеться — він просто не світить.',
          wrong: { 'ir:p': 'Рядок Reverse Current містить «VR = 5 V», але це умова вимірювання струму витоку. Межу шукайте в Absolute Maximum Ratings.' } },
      ],
    },
    {
      id: 'esp', tab: 'ESP32-S3', title: 'ESP32-S3', kind: 'мікроконтролер', maker: 'Espressif', docRef: 'Datasheet v2.2, §5', src: 'esp', none: true,
      tables: [
        { title: 'Table 5-1. Absolute Maximum Ratings', sub: '',
          cols: [C('p', 'Parameter', 'p'), C('d', 'Description', 'desc'), C('min', 'Min', 'min'), C('max', 'Max', 'max'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'vin', c: [['Input power pins ¹', 'виводи живлення'], 'Allowed input voltage', '−0.3', '3.6', 'V'], f: 's3-abs-max-vdd' },
            { k: 'iout', c: [['Ioutput ²', 'сумарний струм IO'], 'Cumulative IO output current', '—', '1500', 'mA'], f: 's3-abs-max-io-total' },
            { k: 'tst', c: [['TSTORE', 'зберігання'], 'Storage temperature', '−40', '150', '°C'], d: 'esp' },
          ],
          notes: ['¹ For more information on input power pins, see Section 2.5.1 Power Pins.',
            '² The product proved to be fully functional after all its IO pins were pulled high while being connected to ground for 24 consecutive hours at ambient temperature of 25 °C.'] },
        { title: 'Table 5-2. Recommended Operating Conditions', sub: 'уривок',
          cols: [C('p', 'Parameter', 'p'), C('d', 'Description', 'desc'), C('min', 'Min', 'min'), C('typ', 'Typ', 'typ'), C('max', 'Max', 'max'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'vdd', c: [['VDDA, VDD3P3', 'живлення'], 'Recommended input voltage', '3.0', '3.3', '3.6', 'V'], f: 's3-supply-range' },
            { k: 'ivdd', c: [['IVDD', 'струм джерела'], 'Cumulative input current', '0.5', '—', '—', 'A'], f: 's3-supply-range' },
          ] },
        { title: 'Table 5-4. DC Characteristics (3.3 V, 25 °C)', sub: 'уривок',
          cols: [C('p', 'Parameter', 'p'), C('d', 'Description', 'desc'), C('min', 'Min', 'min'), C('typ', 'Typ', 'typ'), C('max', 'Max', 'max'), C('u', 'Unit', 'unit')],
          rows: [
            { k: 'cin', c: [['CIN', 'ємність входу'], 'Pin capacitance', '—', '2', '—', 'pF'], f: 's3-pin-capacitance' },
            { k: 'vih', c: [['VIH', 'вхід: HIGH'], 'High-level input voltage', '0.75 × VDD', '—', 'VDD + 0.3', 'V'], f: ['s3-vih', 's3-not-5v-tolerant'] },
            { k: 'vil', c: [['VIL', 'вхід: LOW'], 'Low-level input voltage', '−0.3', '—', '0.25 × VDD', 'V'], f: 's3-vil' },
            { k: 'voh', c: [['VOH ²', 'вихід: HIGH'], 'High-level output voltage', '0.8 × VDD', '—', '—', 'V'], f: 's3-voh' },
            { k: 'vol', c: [['VOL ²', 'вихід: LOW'], 'Low-level output voltage', '—', '—', '0.1 × VDD', 'V'], f: 's3-vol' },
            { k: 'ioh', c: [['IOH', 'струм віддачі'], 'High-level source current (VDD = 3.3 V, VOH ≥ 2.64 V, PAD_DRIVER = 3)', '—', '40', '—', 'mA'], f: 's3-ioh' },
            { k: 'iol', c: [['IOL', 'струм стоку'], 'Low-level sink current (VDD = 3.3 V, VOL = 0.495 V, PAD_DRIVER = 3)', '—', '28', '—', 'mA'], f: 's3-iol' },
            { k: 'rpu', c: [['RPU', 'підтяжка вгору'], 'Internal weak pull-up resistor', '—', '45', '—', 'kΩ'], f: 's3-pullup' },
            { k: 'rpd', c: [['RPD', 'підтяжка донизу'], 'Internal weak pull-down resistor', '—', '45', '—', 'kΩ'], f: 's3-pulldown' },
          ],
          notes: ['VDD — voltage from a power pin of a respective power domain.', '² VOH and VOL are measured using high-impedance load.'] },
      ],
      tasks: [
        { id: 's3-vdd', skill: 'abs', a: 'vdd:max',
          q: 'Яку найбільшу напругу живлення ESP32-S3 Espressif <em>рекомендує для роботи</em>?',
          explain: '<b>Recommended Operating Conditions</b>: 3,0…<b>3,6 В</b>, типово 3,3 В. Тут це число збігається з абсолютним максимумом, тож запасу над 3,6 В немає зовсім: 5 В на виводи живлення чипа подавати не можна.',
          wrong: { 'vin:max': 'Теж 3,6 В, але це <b>Absolute Maximum</b>: стрес-межа, після якої чип може зіпсуватися, а не робочий режим. Питання про рекомендовані умови — Table 5-2.' } },
        { id: 's3-vih', skill: 'unit', a: 'vih:min',
          q: 'Від якої напруги вхід GPIO <em>гарантовано</em> читається як HIGH?',
          explain: 'V<sub>IH</sub> min = <b>0,75 × VDD</b>, тобто ≈ 2,48 В при 3,3 В. Одиниці тут незвичні: не вольти, а частка напруги живлення. Між 0,25 × VDD і 0,75 × VDD рівень не визначений — звідси вимога до чистих сигналів і підтяжок.',
          wrong: { 'vil:max': '0,25 × VDD — межа для LOW: нижче неї вхід гарантовано читає 0.' } },
        { id: 's3-5v', skill: 'abs', a: 'vih:max',
          q: 'Чи можна подати 5 В на вхід GPIO? Клацніть клітинку, яка це вирішує.',
          explain: 'V<sub>IH</sub> max = <b>VDD + 0,3 В</b> ≈ 3,6 В. 5 В — більше, тож виводи ESP32-S3 <b>не розраховані на 5 В</b>. Сигнал від 5-вольтового модуля опускають дільником або перетворювачем рівнів.',
          wrong: { 'vin:max': 'Це виводи живлення чипа (Input power pins), а не GPIO. Межу для входу шукайте в рядку V<sub>IH</sub>.' } },
        { id: 's3-ioh', skill: 'cond', a: 'ioh:typ',
          q: 'Скільки струму віддає вихід у HIGH за найсильнішого налаштування?',
          explain: '<b>40 мА</b>, але читайте все навколо: це <b>Typ</b>, а не гарантований Min і не дозволений Max. Умова — PAD_DRIVER = 3 (найсильніший). Після скидання більшість пінів має ≈20 мА. Світлодіод від GPIO проектують на 2–10 мА.' },
        { id: 's3-pin', skill: 'none', a: 'none',
          q: 'Який <em>абсолютний максимум</em> струму для <em>одного</em> GPIO? Якщо такого рядка немає — натисніть «У таблиці цього немає».',
          explain: 'Такого рядка <b>немає</b>: Espressif не дає межі «на один пін». I<sub>output</sub> = 1500 мА — сумарний струм усіх IO, і примітка ² пояснює, що це результат стрес-тесту, а не дозвіл. 40 мА в I<sub>OH</sub> — типове значення за умов. Уміти сказати «даташит цього не обіцяє» — теж навичка.',
          wrong: { 'iout:max': '1500 мА — сумарний струм усіх виводів, і це стрес-тест (примітка ²), а не межа для одного піна.', 'ioh:typ': '40 мА — типовий струм при PAD_DRIVER = 3 (Typ), а не абсолютний максимум.' } },
      ],
    },
    {
      id: 'ut136', tab: 'UT136C+', title: 'UT136C+', kind: 'мультиметр', maker: 'UNI-T', docRef: 'User Manual P/N 110401107604X', src: 'ut136', retold: true,
      tables: [
        { title: '10.1 DC Voltage', sub: 'постійна напруга; уривок',
          cols: [C('r', 'Range', 'val'), C('acc', 'Accuracy', 'val')],
          rows: [
            { k: 'v400m', c: ['400.0 mV', '±(0.7 % + 3)'], f: 'ut136-dcv-40v-range' },
            { k: 'v4', c: ['4.000 V', '±(0.5 % + 2)'], f: 'ut136-dcv-accuracy' },
            { k: 'v40', c: ['40.00 V', '±(0.7 % + 3)'], f: 'ut136-dcv-40v-range' },
          ],
          notes: ['Вхідний опір ≈ 10 MΩ (на діапазоні 400 mV — понад 1000 MΩ).'], noteFact: 'ut136-input-impedance' },
        { title: '10.7 DC Current', sub: 'постійний струм; захист від перевантаження 250 V rms',
          cols: [C('r', 'Range', 'val'), C('acc', 'Accuracy', 'val'), C('jack', 'Гніздо', 'cond')],
          rows: [
            { k: 'a400u', c: ['400.0 µA', '±(1.0 % + 3)', 'VΩmA'], f: 'ut136-dca-accuracy' },
            { k: 'a4000u', c: ['4000 µA', '±(1.0 % + 3)', 'VΩmA'], f: 'ut136-dca-accuracy' },
            { k: 'a40m', c: ['40.00 mA', '±(1.0 % + 3)', 'VΩmA'], f: 'ut136-dca-accuracy' },
            { k: 'a400m', c: ['400.0 mA', '±(1.0 % + 3)', 'VΩmA'], f: ['ut136-dca-accuracy', 'ut136-ma-range'] },
            { k: 'a4', c: ['4.000 A', '±(1.2 % + 5)', '10A'], f: 'ut136-dca-accuracy' },
            { k: 'a10', c: ['10.00 A', '±(1.2 % + 5)', '10A'], f: ['ut136-dca-accuracy', 'ut136-10a-limit'] },
          ],
          notes: ['Струм ≈ 10 A — не довше 10 с, наступне вимірювання — щонайменше через 15 хв.'] },
        { title: '10.4 Continuity, Diode and Transistor', sub: 'прозвонка, діод, hFE',
          cols: [C('fn', 'Функція', 'p'), C('r', 'Діапазон / показ', 'val'), C('cond', 'Умови', 'cond')],
          rows: [
            { k: 'beep', c: [['Прозвонка', 'continuity'], 'пищить: ≤ 10 Ω', 'мовчить: > 50 Ω'], f: 'ut136-continuity' },
            { k: 'diode', c: [['Діод', 'diode'], 'Si p-n: 0.5–0.8 V', 'до 3 V, ≈ 1 mA'], f: 'ut136-diode-test' },
            { k: 'hfe', c: [['hFE', 'транзистор'], '1–1000', 'IB ≈ 20 µA, VCE ≈ 3 V'], f: 'ut136-hfe-socket' },
          ] },
      ],
      tasks: [
        { id: 'ut-4v', skill: 'unit', a: 'v4:acc',
          q: 'Яка похибка UT136C+ на діапазоні <b>4 В</b> постійної напруги?',
          explain: '<b>±(0,5 % + 2)</b>. Читається так: 0,5 % від показу <em>плюс</em> 2 одиниці останнього розряду. На діапазоні 4.000 V останній розряд — 0,001 В, тож «+2» = ±0,002 В. При показі 3,300 В: 0,5 % ≈ 0,017 В, разом ≈ ±0,019 В.' },
        { id: 'ut-5v', skill: 'col', a: 'v40:acc',
          q: 'Ви міряєте 5 В з USB. Прилад сам вибирає діапазон. Клацніть похибку, з якою він покаже ці 5 В.',
          explain: '5 В не влазять у 4.000 V, тож автовибір бере <b>40.00 V</b>: похибка <b>±(0,7 % + 3)</b>, а останній розряд — 0,01 В. 0,7 % × 5 В + 3 × 0,01 В ≈ ±0,07 В. Показ 4,95 В на «п’ятивольтовій» лінії — у межах похибки.',
          wrong: { 'v4:acc': 'Діапазон 4.000 V закінчується на 4 В, а 5 В у нього не вмістяться. Шукайте наступний.' } },
        { id: 'ut-ma', skill: 'col', a: 'a400m:r',
          q: 'Який найбільший діапазон струму доступний через гніздо <b>VΩmA</b>? Клацніть діапазон.',
          explain: '<b>400.0 mA</b>. Гніздо VΩmA захищене запобіжником 0,5 А; більші струми — лише через гніздо <b>10A</b>. Тому, коли струм невідомий, починайте з гнізда 10A.',
          wrong: { 'a10:r': '10.00 A — це вже гніздо 10A (стовпець «Гніздо»). Питання про VΩmA.', 'a400m:acc': 'Рядок правильний, але клацніть сам діапазон, а не похибку.',
            'a400m:jack': 'Рядок правильний, але це назва гнізда. Клацніть сам діапазон.' } },
        { id: 'ut-hfe', skill: 'cond', a: 'hfe:cond',
          q: 'BC547B у гнізді hFE показує 380, а в даташиті Typ — 290. За яких умов міряє прилад?',
          explain: 'Прилад подає <b>I<sub>B</sub> ≈ 20 мкА при V<sub>CE</sub> ≈ 3 В</b>, тобто I<sub>C</sub> ≈ 4–9 мА, а даташит нормує h<sub>FE</sub> при 2 мА і 5 В. Інші умови — інше число. До того ж 380 лежить у межах групи B (200…450). Порівнювати можна лише значення, виміряні за однакових умов.' },
      ],
    },
  ];

  const SKILL = {
    abs: 'Абсолютний максимум', mtm: 'Min / Typ / Max', cond: 'Умови вимірювання', col: 'Потрібний рядок і стовпець', unit: 'Одиниці', none: 'Чого немає в таблиці',
  };
  const KIND_HINT = {
    min: 'Min — гарантована нижня межа.', typ: 'Typ — типовий, «середній» екземпляр, без гарантії.', max: 'Max — гарантована верхня межа.',
    val: '', other: '',
  };

  /* ================================================================ state */
  const KEY = 'datasheets.v1';
  const st = Object.assign({ part: SHEETS[0].id, idx: {}, done: {} }, store.get(KEY, {}) || {});
  if (!SHEETS.some((s) => s.id === st.part)) st.part = SHEETS[0].id;
  st.idx = st.idx && typeof st.idx === 'object' ? st.idx : {};
  st.done = st.done && typeof st.done === 'object' ? st.done : {};
  const save = () => store.set(KEY, { part: st.part, idx: st.idx, done: st.done });
  const ALL = SHEETS.flatMap((s) => s.tasks);
  const solved = (t) => st.done[t.id] === 'first' || st.done[t.id] === 'ok';

  /* ================================================================ render */
  const host = $('#ds-trainer');
  if (!host) return;

  const cellHTML = (sheet, tbl, row, col, raw, ci) => {
    const key = `${row.k}:${col.k}`;
    const span = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.span : 0;
    const v = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? raw.v : raw;
    const empty = Array.isArray(v) ? false : v === '';
    const tag = col.kind === 'p' ? 'th' : 'td';
    const attrs = `${tag === 'th' ? ' scope="row"' : ''}${span ? ` colspan="${span}"` : ''} class="k-${col.kind}${span ? ' span' : ''}"`;
    if (empty) return `<${tag}${attrs}></${tag}>`;
    const inner = Array.isArray(v) ? `<span class="pn">${fmt(v[0])}</span><span class="gl" lang="uk">${esc(v[1])}</span>` : fmt(v);
    let cite = '';
    if (ci === 0 && col.kind === 'p' || (ci === 0 && !tbl.cols.some((c) => c.kind === 'p'))) cite = citeHTML(row);
    return `<${tag}${attrs}><button type="button" class="ds-c" data-key="${esc(key)}">${inner}</button>${cite}</${tag}>`;
  };
  const citeHTML = (row) => {
    const fs = row.f ? [].concat(row.f) : [];
    let out = fs.map((id) => `<sup class="cite" data-fact="${esc(id)}"></sup>`).join('');
    if (row.d) out += `<sup class="ds-cite"><a href="#doc-${esc(row.d)}" title="${esc(DOCS[row.d].t)}" aria-label="Даташит ${esc(DOCS[row.d].n)}">[${esc(DOCS[row.d].n)}]</a></sup>`;
    return out;
  };
  const tableHTML = (sheet, tbl, ti) => {
    const head = tbl.cols.map((c) => `<th scope="col" class="k-${c.kind}">${esc(c.h)}</th>`).join('');
    const body = tbl.rows.map((row) => {
      let ci = 0, out = '';
      row.c.forEach((raw) => {
        const col = tbl.cols[ci];
        out += cellHTML(sheet, tbl, row, col, raw, ci);
        ci += raw && typeof raw === 'object' && !Array.isArray(raw) && raw.span ? raw.span : 1;
      });
      return `<tr data-row="${esc(row.k)}"${row.c[0] === '' ? ' class="cont"' : ''}>${out}</tr>`;
    }).join('');
    const notes = tbl.notes ? `<ul class="ds-notes">${tbl.notes.map((n, i) => `<li>${fmt(n)}${i === 0 && tbl.noteFact ? `<sup class="cite" data-fact="${esc(tbl.noteFact)}"></sup>` : ''}</li>`).join('')}</ul>` : '';
    return `<div class="ds-tbl">
      <p class="ds-cap" id="cap-${sheet.id}-${ti}"><b>${esc(tbl.title)}</b>${tbl.sub ? ` <span>${fmt(tbl.sub)}</span>` : ''}</p>
      <div class="ds-scroll" tabindex="0" role="region" aria-labelledby="cap-${sheet.id}-${ti}">
        <table class="ds"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </div>${notes}</div>`;
  };
  const sheetHTML = (sheet) => {
    const d = DOCS[sheet.src];
    return `<div class="ds-sheet" data-sheet="${sheet.id}" hidden>
      <div class="ds-sheet-head">
        <span class="ds-pn">${esc(sheet.title)}</span><span class="ds-kind">${esc(sheet.kind)}</span>
        <a class="ds-doc" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(sheet.maker)} · ${esc(sheet.docRef)}</a>
      </div>
      ${sheet.retold ? '<p class="ds-retold">Інструкція UT136C+ — сканована, тому рядки нижче переказано українською за перевіреними фактами, без вигаданих значень.</p>' : ''}
      ${sheet.tables.map((t, i) => tableHTML(sheet, t, i)).join('')}
      ${sheet.none ? '<div class="ds-none-row"><button type="button" class="btn ds-c ds-none" data-key="none">У таблиці цього немає</button></div>' : ''}
    </div>`;
  };

  host.innerHTML = `
    <div class="ds-top">
      <div class="ds-tabs" role="tablist" aria-label="Деталі">${SHEETS.map((s) => `<button type="button" role="tab" class="ds-tab" data-part="${s.id}" aria-selected="false" aria-controls="ds-stage">
        <span class="t">${esc(s.tab)}</span><span class="n"></span></button>`).join('')}</div>
      <div class="ds-meta">
        <span class="ds-total" aria-live="polite"></span>
        <span class="ds-bar" aria-hidden="true"><span></span></span>
        <button type="button" class="btn sm ghost ds-proj-btn" aria-pressed="false">На проєктор</button>
        <button type="button" class="btn sm ghost ds-reset" title="Почати тренажер спочатку">↺ Скинути</button>
      </div>
    </div>
    <div class="ds-stage" id="ds-stage" role="tabpanel">
      <div class="ds-q">
        <div class="ds-q-top"><span class="ds-q-n"></span><span class="ds-skill"></span>
          <span class="ds-dots" role="group" aria-label="Завдання цієї деталі"></span></div>
        <p class="ds-q-text"></p>
        <div class="ds-fb" role="status"></div>
        <div class="ds-q-nav">
          <button type="button" class="btn ghost sm ds-prev">← Назад</button>
          <button type="button" class="btn sm ds-show">Показати відповідь</button>
          <button type="button" class="btn primary sm ds-next">Далі →</button>
        </div>
      </div>
      <div class="ds-sheets">${SHEETS.map(sheetHTML).join('')}</div>
    </div>`;

  const tabs = $$('.ds-tab', host), qText = $('.ds-q-text', host), fb = $('.ds-fb', host), dots = $('.ds-dots', host);
  let attempts = 0, answered = false;
  // Side-by-side (question card next to the sheet) only on wide screens; stacked, the feedback moves under the table
  // the student is clicking in, so it is never off screen.
  const twoCol = () => matchMedia(doc.documentElement.classList.contains('ds-proj') ? '(min-width: 980px)' : '(min-width: 1360px)').matches;
  const fbHome = () => { const nav = $('.ds-q-nav', host); if (fb.nextElementSibling !== nav) nav.before(fb); fb.classList.remove('away'); };
  const fbNear = (btn) => {
    if (twoCol() || !btn) return fbHome();
    const at = btn.closest('.ds-tbl, .ds-none-row');
    if (at) { at.after(fb); fb.classList.add('away'); }
  };
  const nextBtn = () => (fb.classList.contains('away') ? ' <button type="button" class="btn primary sm ds-next">Далі →</button>' : '');
  const sheetOf = (id) => SHEETS.find((s) => s.id === id);
  const cur = () => { const s = sheetOf(st.part); const i = Math.min(s.tasks.length - 1, Math.max(0, st.idx[s.id] || 0)); return { s, i, t: s.tasks[i] }; };
  const answers = (t) => [].concat(t.a);
  const sheetEl = (s) => $(`.ds-sheet[data-sheet="${s.id}"]`, host);

  const findCell = (s, key) => {
    if (key === 'none') return { none: true };
    const [rk, ck] = key.split(':');
    for (const tbl of s.tables) {
      const row = tbl.rows.find((r) => r.k === rk);
      if (!row) continue;
      const col = tbl.cols.find((c) => c.k === ck);
      if (col) return { tbl, row, col };
    }
    return null;
  };
  const rowName = (row) => {
    for (let k = 0; k < row.c.length; k++) { const v = row.c[k]; if (Array.isArray(v)) return v[0]; }
    return '';
  };
  const rowLabel = (tbl, row) => {
    let r = row;
    if (rowName(r) === '' && row.c[0] === '') { const i = tbl.rows.indexOf(row); for (let j = i; j >= 0; j--) if (rowName(tbl.rows[j])) { r = tbl.rows[j]; break; } }
    const nm = rowName(r) || (typeof r.c[0] === 'string' ? r.c[0] : '');
    return nm;
  };

  // A targeted hint for a wrong click: same row / same column / a non-value column.
  function wrongText(s, t, key) {
    if (t.wrong && t.wrong[key]) return t.wrong[key];
    const got = findCell(s, key);
    if (got && got.none) return 'Потрібний рядок у таблиці є. Пошукайте ще раз: спершу назву параметра, потім стовпець.';
    if (t.a === 'none') return 'Цей рядок про інше. Перечитайте питання: можливо, такого рядка в даташиті немає зовсім.';
    const want = findCell(s, answers(t)[0]);
    if (!got || !want) return 'Не це. Спробуйте ще раз.';
    if (got.row === want.row || (got.tbl === want.tbl && answers(t).some((a) => a.split(':')[0] === got.row.k))) {
      if (got.col.kind === 'p') return 'Рядок знайдено правильно! Тепер клацніть саме число в цьому рядку.';
      if (got.col.kind === 'sym') return 'Рядок правильний, але це позначення (назва) параметра. Число стоїть правіше.';
      if (got.col.kind === 'cond') return 'Рядок правильний, але це <b>умови вимірювання</b>: за яких умов виміряно значення. Саме значення — в іншому стовпці.';
      if (got.col.kind === 'desc') return 'Рядок правильний, але це опис параметра. Число стоїть правіше, у стовпцях Min / Typ / Max.';
      if (got.col.kind === 'other') return `Рядок правильний, але стовпець «${esc(got.col.h)}» — для іншої деталі. Тут одна таблиця на кілька моделей: знайдіть заголовок стовпця саме вашої.`;
      if (got.col.kind === 'unit') return 'Рядок правильний, але це <b>одиниці</b>. Вони важливі (mA чи A?), та відповідь — число поруч.';
      return `Рядок правильний, але стовпець не той: «${esc(got.col.h)}». ${KIND_HINT[want.col.kind] || ''}`;
    }
    const nm = rowLabel(got.tbl, got.row);
    return `Це ${nm ? `рядок «${esc(nm)}»` : 'інший рядок'}${got.tbl !== want.tbl ? ` з таблиці ${esc(got.tbl.title)}` : ''}. Перечитайте питання і знайдіть потрібний параметр.`;
  }

  function mark(sheet, keys, cls) {
    keys.forEach((k) => { const b = $(`.ds-c[data-key="${CSS.escape(k)}"]`, sheetEl(sheet)); if (b) b.classList.add(cls); });
  }
  function clearMarks() { $$('.ds-c.right, .ds-c.wrong, .ds-c.shown', host).forEach((b) => b.classList.remove('right', 'wrong', 'shown')); }

  function paintHead() {
    tabs.forEach((b) => {
      const s = sheetOf(b.dataset.part), n = s.tasks.filter(solved).length;
      $('.n', b).textContent = `${n}/${s.tasks.length}`;
      b.classList.toggle('full', n === s.tasks.length);
      b.setAttribute('aria-selected', String(s.id === st.part));
      b.tabIndex = s.id === st.part ? 0 : -1;
      b.setAttribute('aria-label', `${s.tab}: розв’язано ${n} з ${s.tasks.length}`);
    });
    const n = ALL.filter(solved).length, first = ALL.filter((t) => st.done[t.id] === 'first').length;
    $('.ds-total', host).textContent = `${n} з ${ALL.length} · з першої спроби ${first}`;
    $('.ds-bar > span', host).style.width = (n / ALL.length * 100) + '%';
  }

  function open() {
    const { s, i, t } = cur();
    $$('.ds-sheet', host).forEach((el) => { el.hidden = el.dataset.sheet !== s.id; });
    clearMarks();
    attempts = 0; answered = false;
    $('.ds-q-n', host).textContent = `${s.tab} · завдання ${i + 1} з ${s.tasks.length}`;
    $('.ds-skill', host).textContent = SKILL[t.skill] || '';
    qText.innerHTML = t.q;
    dots.innerHTML = s.tasks.map((x, k) => `<button type="button" data-k="${k}" class="${solved(x) ? 'ok' : st.done[x.id] === 'shown' ? 'seen' : ''}" aria-current="${k === i ? 'step' : 'false'}"
      aria-label="Завдання ${k + 1}${solved(x) ? ', розв’язано' : ''}">${k + 1}</button>`).join('');
    fbHome();
    fb.className = 'ds-fb'; fb.innerHTML = '';
    if (solved(t) || st.done[t.id] === 'shown') {
      // revisit: show the answer straight away, with the explanation
      reveal(s, t, solved(t) ? 'Розв’язано раніше.' : 'Відповідь уже показано.');
    }
    $('.ds-prev', host).disabled = i === 0 && SHEETS.indexOf(s) === 0;
    paintHead();
  }

  function reveal(s, t, lead, btn) {
    answered = true;
    if (btn) fbNear(btn); else fbHome();
    if (t.a === 'none') { const nb = $('.ds-none', sheetEl(s)); if (nb) nb.classList.add('right'); } else mark(s, answers(t), 'right');
    fb.className = 'ds-fb ok' + (fb.classList.contains('away') ? ' away' : '');
    fb.innerHTML = `<b>${lead}</b> ${t.explain}${nextBtn()}`;
    const first = t.a === 'none' ? $('.ds-none', sheetEl(s)) : $(`.ds-c[data-key="${CSS.escape(answers(t)[0])}"]`, sheetEl(s));
    if (first && first.scrollIntoView) {
      const sc = first.closest('.ds-scroll');
      if (sc) { const r = first.getBoundingClientRect(), rs = sc.getBoundingClientRect(); if (r.right > rs.right || r.left < rs.left) sc.scrollLeft += r.left - rs.left - 40; }
    }
  }

  function choose(key, btn) {
    const { s, t } = cur();
    if (answered) return;
    const ok = answers(t).includes(key);
    attempts++;
    if (ok) {
      if (!solved(t)) st.done[t.id] = attempts === 1 && st.done[t.id] !== 'shown' ? 'first' : 'ok';
      save();
      clearMarks();
      reveal(s, t, attempts === 1 ? 'Так, з першої спроби!' : 'Так!', btn);
      const all = ALL.every(solved), part = s.tasks.every(solved);
      if (all) toast('Усі завдання тренажера розв’язано!', 'ok');
      else if (part) toast(`Деталь ${s.tab}: усе розв’язано`, 'ok');
      open.paintDots();
      paintHead();
    } else {
      $$('.ds-c.wrong', host).forEach((b) => b.classList.remove('wrong'));
      btn.classList.add('wrong');
      fbNear(btn);
      fb.className = 'ds-fb no' + (fb.classList.contains('away') ? ' away' : '');
      fb.innerHTML = `<b>Ще ні.</b> ${wrongText(s, t, key)}`;
    }
  }
  open.paintDots = () => {
    const { s, i } = cur();
    $$('button', dots).forEach((b, k) => { const x = s.tasks[k]; b.className = solved(x) ? 'ok' : st.done[x.id] === 'shown' ? 'seen' : ''; b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
  };

  function go(delta) {
    const { s, i } = cur();
    let si = SHEETS.indexOf(s), ni = i + delta;
    if (ni >= s.tasks.length) { si = (si + 1) % SHEETS.length; ni = 0; }
    else if (ni < 0) { if (si === 0) return; si -= 1; ni = SHEETS[si].tasks.length - 1; }
    st.part = SHEETS[si].id; st.idx[st.part] = ni; save(); open();
  }

  host.addEventListener('click', (e) => {
    const c = e.target.closest('.ds-c');
    if (c && host.contains(c)) { choose(c.dataset.key, c); return; }
    const tab = e.target.closest('.ds-tab');
    if (tab) { st.part = tab.dataset.part; save(); open(); return; }
    const dot = e.target.closest('.ds-dots button');
    if (dot) { st.idx[st.part] = +dot.dataset.k; save(); open(); return; }
    if (e.target.closest('.ds-next')) { go(1); focusQ(); return; }
    if (e.target.closest('.ds-prev')) { go(-1); focusQ(); return; }
    if (e.target.closest('.ds-show')) {
      const { s, t } = cur();
      if (answered) return;
      if (!solved(t)) { st.done[t.id] = 'shown'; save(); }
      clearMarks(); reveal(s, t, 'Відповідь:'); open.paintDots(); paintHead();
      return;
    }
    if (e.target.closest('.ds-reset')) {
      if (!confirm('Скинути весь поступ тренажера даташитів?')) return;
      st.done = {}; st.idx = {}; st.part = SHEETS[0].id; save(); open();
      return;
    }
    if (e.target.closest('.ds-proj-btn')) setProj(!doc.documentElement.classList.contains('ds-proj'));
  });
  const focusQ = () => { if (doc.documentElement.classList.contains('ds-proj')) return; const q = $('.ds-q', host); if (q && q.getBoundingClientRect().top < 0) q.scrollIntoView({ block: 'start' }); };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  $('.ds-tabs', host).addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const k = SHEETS.findIndex((s) => s.id === st.part), n = (k + (e.key === 'ArrowRight' ? 1 : -1) + SHEETS.length) % SHEETS.length;
    st.part = SHEETS[n].id; save(); open(); tabs[n].focus();
  });

  /* ================================================================ projector */
  function setProj(on) {
    doc.documentElement.classList.toggle('ds-proj', on);
    const b = $('.ds-proj-btn', host);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Вийти з проєктора' : 'На проєктор';
    try { const u = new URL(location.href); if (on) u.searchParams.set('mode', 'projector'); else u.searchParams.delete('mode'); history.replaceState(null, '', u); } catch { /* file:// */ }
    if (on) host.scrollIntoView({ block: 'start' });
  }
  doc.addEventListener('keydown', (e) => {
    if (!doc.documentElement.classList.contains('ds-proj')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [role="tablist"], .ds-scroll')) return;
    if (e.key === 'Escape') setProj(false);
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
  });
  try { if (new URLSearchParams(location.search).get('mode') === 'projector') setProj(true); } catch { /* ignore */ }

  /* ================================================================ primary-source list */
  const docsList = $('#ds-docs');
  if (docsList) docsList.innerHTML = Object.entries(DOCS).map(([id, d]) => `<li id="doc-${esc(id)}"><b>[${esc(d.n)}]</b> <a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.t)}</a><span class="src-meta">${esc(d.note)}</span></li>`).join('');

  open();
  // Citations: study.js numbers .cite[data-fact] at boot; if boot already ran, number the freshly drawn ones now.
  if (S && S.isReady && S.cites) S.cites().catch(() => {});

  window.DatasheetTrainer = { SHEETS, DOCS, go, open, setProj, state: st };
})();
