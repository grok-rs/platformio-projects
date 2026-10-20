//! Лабораторія брязкоту — аналіз фронтів без жодного звернення до заліза.
//!
//! Обробник переривання кладе кожен фронт ([`Edge`]) у кільцевий буфер; головний цикл
//! передає їх в [`Analyzer`], який групує фронти в події (натискання або відпускання разом
//! з усім брязкотом), веде статистику й друкує таблицю в будь-який [`core::fmt::Write`]:
//! на платі це Serial, у тестах — `String`. Тому формат таблиці перевіряється на ПК:
//!
//! ```text
//! cargo +stable host-test -p button-bounce
//! ```

#![cfg_attr(not(test), no_std)]

use core::fmt::{self, Write};

use heapless::Vec;

/// Скільки тиші вважати «кінцем брязкоту». Більше, ніж найдовший брязкіт (Ganssle: до ~6 мс
/// у більшості кнопок), і менше, ніж найкоротше натискання людини (~50…100 мс).
pub const QUIET_US: u32 = 50_000;
/// Скільки перших фронтів розписати в рядку події.
pub const SHOW_EDGES: usize = 12;
/// Підсумок після кожних 10 натискань-відпускань (як у завданні).
pub const SUMMARY_EVERY: u32 = 10;
/// Шапку таблиці повторювати кожні 20 рядків.
const HEADER_EVERY: u32 = 20;

/// Один фронт, як його побачив обробник переривання.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Edge {
    /// Момент переривання, мкс від старту.
    pub t_us: u32,
    /// Рівень на піні, прочитаний у самому обробнику.
    pub high: bool,
}

/// Подія: натискання або відпускання разом із брязкотом.
#[derive(Debug, Clone)]
struct Event {
    first_us: u32,
    last_us: u32,
    edges: u32,
    falling: u32, // фронти, після яких ISR прочитав LOW
    rising: u32,  // фронти, після яких ISR прочитав HIGH
    min_gap_us: Option<u32>, // `None` замість UINT32_MAX: «проміжків ще не було»
    last_high: bool,
    shown: Vec<Edge, SHOW_EDGES>, // `t_us` тут — від першого фронту події
}

impl Event {
    fn new(first_us: u32) -> Self {
        Self {
            first_us,
            last_us: first_us,
            edges: 0,
            falling: 0,
            rising: 0,
            min_gap_us: None,
            last_high: true,
            shown: Vec::new(),
        }
    }

    fn add(&mut self, e: Edge) {
        if self.edges > 0 {
            let gap = e.t_us.wrapping_sub(self.last_us);
            self.min_gap_us = Some(self.min_gap_us.map_or(gap, |m| m.min(gap)));
        }
        let _ = self.shown.push(Edge { t_us: e.t_us.wrapping_sub(self.first_us), high: e.high });
        self.edges += 1;
        *if e.high { &mut self.rising } else { &mut self.falling } += 1;
        self.last_us = e.t_us;
        self.last_high = e.high;
    }

    fn bounce_us(&self) -> u32 {
        self.last_us.wrapping_sub(self.first_us)
    }
}

/// Тип завершеної події — за рівнем, на якому все заспокоїлось.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Press,
    Release,
    /// Рівень не змінився (наприклад, лише голка-завада): фронти були, а стан кнопки — той самий.
    Glitch,
}

impl fmt::Display for Kind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.pad(match self {
            Self::Press => "PRESS",
            Self::Release => "release",
            Self::Glitch => "glitch",
        })
    }
}

/// Статистика для одного напрямку (натискання або відпускання).
#[derive(Debug, Clone, Copy, Default)]
struct Direction {
    count: u32,
    edges: u32,
    bounce_sum_us: u32,
    bounce_max_us: u32,
}

impl Direction {
    fn add(&mut self, event: &Event) {
        self.count += 1;
        self.edges += event.edges;
        self.bounce_sum_us += event.bounce_us();
        self.bounce_max_us = self.bounce_max_us.max(event.bounce_us());
    }

    fn print(&self, out: &mut impl Write, name: &str) -> fmt::Result {
        if self.count == 0 {
            return Ok(());
        }
        writeln!(
            out,
            "{name} edges avg {:.1}, bounce avg {} us, max {} us",
            self.edges as f32 / self.count as f32,
            self.bounce_sum_us / self.count,
            self.bounce_max_us
        )
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct Stats {
    press: Direction,
    release: Direction,
    falling_total: u32, // фронти з рівнем LOW — приблизно стільки нарахував би код з умови
    min_gap_us: Option<u32>,
}

/// Групує фронти в події, рахує статистику й друкує звіт.
#[derive(Debug)]
pub struct Analyzer {
    event: Option<Event>, // `None` = зараз не всередині події (у C++ — окремий `gInEvent`)
    stats: Stats,
    stable_high: bool, // рівень після останньої завершеної події
    rows_printed: u32,
}

impl Analyzer {
    /// `high` — рівень кнопки на старті (відпущена = HIGH).
    pub const fn new(high: bool) -> Self {
        Self {
            event: None,
            stats: Stats {
                press: Direction { count: 0, edges: 0, bounce_sum_us: 0, bounce_max_us: 0 },
                release: Direction { count: 0, edges: 0, bounce_sum_us: 0, bounce_max_us: 0 },
                falling_total: 0,
                min_gap_us: None,
            },
            stable_high: high,
            rows_printed: 0,
        }
    }

    /// Додати фронт із кільцевого буфера.
    pub fn add_edge(&mut self, edge: Edge) {
        self.event.get_or_insert_with(|| Event::new(edge.t_us)).add(edge);
    }

    /// Якщо `QUIET_US` немає нових фронтів — завершити подію й надрукувати її рядок
    /// (і підсумок, якщо це кожне десяте відпускання). `dropped` — для підсумку.
    pub fn poll(&mut self, now_us: u32, dropped: u32, out: &mut impl Write) -> fmt::Result {
        match &self.event {
            Some(event) if now_us.wrapping_sub(event.last_us) >= QUIET_US => {
                let event = self.event.take().expect("matched Some above");
                self.finish(&event, dropped, out)
            }
            _ => Ok(()),
        }
    }

    fn finish(&mut self, event: &Event, dropped: u32, out: &mut impl Write) -> fmt::Result {
        let kind = match (self.stable_high, event.last_high) {
            (true, false) => Kind::Press,
            (false, true) => Kind::Release,
            _ => Kind::Glitch,
        };
        self.stable_high = event.last_high;

        let s = &mut self.stats;
        let number = match kind {
            Kind::Press => {
                s.press.add(event);
                s.press.count
            }
            Kind::Release => {
                s.release.add(event);
                s.release.count
            }
            Kind::Glitch => 0,
        };
        s.falling_total += event.falling;
        s.min_gap_us = min_option(s.min_gap_us, event.min_gap_us);

        if self.rows_printed.is_multiple_of(HEADER_EVERY) {
            print_header(out)?;
        }
        self.rows_printed += 1;

        write!(
            out,
            "{number:>3}  {kind:<7}  {:>5}  {:>4}  {:>4}  {:>9}  ",
            event.edges,
            event.falling,
            event.rising,
            event.bounce_us()
        )?;
        match event.min_gap_us {
            Some(gap) if event.edges > 1 => write!(out, "{gap:>10}  ")?,
            _ => write!(out, "{:>10}  ", "-")?,
        }
        for edge in &event.shown {
            write!(out, "{}{} ", if edge.high { '^' } else { 'v' }, edge.t_us)?;
        }
        if event.edges as usize > SHOW_EDGES {
            write!(out, "... +{}", event.edges as usize - SHOW_EDGES)?;
        }
        writeln!(out)?;

        if kind == Kind::Release && self.stats.release.count.is_multiple_of(SUMMARY_EVERY) {
            self.print_summary(dropped, out)?; // подія вже завершена, тож жоден фронт не губиться
        }
        Ok(())
    }

    /// Підсумок (клавіша `s` або кожні [`SUMMARY_EVERY`] відпускань).
    pub fn print_summary(&mut self, dropped: u32, out: &mut impl Write) -> fmt::Result {
        let s = &self.stats;
        writeln!(out)?;
        writeln!(out, "=== summary: {} presses, {} releases ===", s.press.count, s.release.count)?;
        s.press.print(out, "press:  ")?;
        s.release.print(out, "release:")?;
        // Код з умови (FALLING) додає 1 на кожен фронт униз, який встиг помітити, — і на
        // натисканні, і в брязкоті відпускання. Тут це наближення: фронти, після яких ISR прочитав LOW.
        writeln!(
            out,
            "edges read as LOW (~ homework FALLING counter): {} for {} presses",
            s.falling_total, s.press.count
        )?;
        if let Some(gap) = s.min_gap_us {
            writeln!(out, "shortest gap between edges: {gap} us")?;
        }
        let worst_us = s.press.bounce_max_us.max(s.release.bounce_max_us);
        writeln!(
            out,
            "debounce >= {} ms (worst bounce {worst_us} us x 1.5)",
            recommended_debounce_ms(worst_us)
        )?;
        if dropped > 0 {
            writeln!(out, "WARNING: {dropped} edges dropped (ring buffer full)")?;
        }
        writeln!(out)?;
        self.rows_printed = 0; // після підсумку — знову шапка
        Ok(())
    }

    /// Скинути статистику (клавіша `r`); `high` — поточний рівень кнопки.
    pub fn reset(&mut self, high: bool) {
        *self = Self::new(high);
    }
}

/// Запас ×1.5 і округлення вгору до цілої мілісекунди, але не менше 1 мс.
pub fn recommended_debounce_ms(worst_bounce_us: u32) -> u32 {
    (worst_bounce_us * 3 / 2).div_ceil(1000).max(1)
}

fn min_option(a: Option<u32>, b: Option<u32>) -> Option<u32> {
    match (a, b) {
        (Some(a), Some(b)) => Some(a.min(b)),
        (a, b) => a.or(b),
    }
}

fn print_header(out: &mut impl Write) -> fmt::Result {
    writeln!(out)?;
    writeln!(
        out,
        "  #  event    edges  fall  rise  bounce,us  min gap,us  edges, us from the first (v = LOW, ^ = HIGH)"
    )?;
    writeln!(
        out,
        "---  -------  -----  ----  ----  ---------  ----------  ----------------------------------------------"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Подати фронти (мкс від старту, рівень) і дочекатися тиші.
    fn feed(a: &mut Analyzer, edges: &[(u32, bool)], out: &mut String) {
        for &(t_us, high) in edges {
            a.add_edge(Edge { t_us, high });
        }
        let last = edges.last().unwrap().0;
        a.poll(last + QUIET_US - 1, 0, out).unwrap();
        assert!(a.event.is_some(), "event must not end before QUIET_US");
        a.poll(last + QUIET_US, 0, out).unwrap();
    }

    #[test]
    fn press_row_matches_cpp_format() {
        let mut a = Analyzer::new(true);
        let mut out = String::new();
        feed(&mut a, &[(1000, false), (1049, false), (1105, false), (1136, true), (1169, false)], &mut out);
        let row = out.lines().last().unwrap();
        assert_eq!(
            row,
            "  1  PRESS        5     4     1        169          31  v0 v49 v105 ^136 v169 "
        );
        assert!(out.starts_with("\n  #  event    edges"));
    }

    #[test]
    fn single_edge_has_no_gap() {
        let mut a = Analyzer::new(true);
        let mut out = String::new();
        feed(&mut a, &[(500, false)], &mut out);
        assert!(out.ends_with("  1  PRESS        1     1     0          0           -  v0 \n"));
    }

    #[test]
    fn long_event_is_truncated() {
        let mut a = Analyzer::new(true);
        let mut out = String::new();
        let edges: std::vec::Vec<(u32, bool)> = (0..20).map(|i| (i * 10, i % 2 == 1)).collect();
        feed(&mut a, &edges, &mut out);
        // Останній фронт HIGH — рівень не змінився: це «glitch» без номера.
        let row = out.lines().last().unwrap();
        assert!(row.starts_with("  0  glitch      20"));
        assert!(row.ends_with("^110 ... +8"));
    }

    #[test]
    fn summary_after_ten_releases() {
        let mut a = Analyzer::new(true);
        let mut out = String::new();
        let mut t = 0;
        for _ in 0..10 {
            feed(&mut a, &[(t, false), (t + 100, true), (t + 300, false)], &mut out);
            t += 200_000;
            feed(&mut a, &[(t, true), (t + 2000, true)], &mut out);
            t += 200_000;
        }
        assert!(out.contains("\n=== summary: 10 presses, 10 releases ===\n"));
        assert!(out.contains("press:   edges avg 3.0, bounce avg 300 us, max 300 us\n"));
        assert!(out.contains("release: edges avg 2.0, bounce avg 2000 us, max 2000 us\n"));
        assert!(out.contains("edges read as LOW (~ homework FALLING counter): 20 for 10 presses\n"));
        assert!(out.contains("shortest gap between edges: 100 us\n"));
        assert!(out.contains("debounce >= 3 ms (worst bounce 2000 us x 1.5)\n"));
        assert!(!out.contains("WARNING"));
    }

    #[test]
    fn empty_summary_still_recommends_one_ms() {
        let mut out = String::new();
        Analyzer::new(true).print_summary(3, &mut out).unwrap();
        assert_eq!(
            out,
            "\n=== summary: 0 presses, 0 releases ===\n\
             edges read as LOW (~ homework FALLING counter): 0 for 0 presses\n\
             debounce >= 1 ms (worst bounce 0 us x 1.5)\n\
             WARNING: 3 edges dropped (ring buffer full)\n\n"
        );
    }

    #[test]
    fn debounce_recommendation_rounds_up() {
        assert_eq!(recommended_debounce_ms(0), 1);
        assert_eq!(recommended_debounce_ms(2336), 4); // 3504 мкс -> 4 мс
        assert_eq!(recommended_debounce_ms(2000), 3);
    }
}
