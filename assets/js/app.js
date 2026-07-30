/* ==========================================================================
   Движок сайта: анимации, меню, аккордеон, слайдер отзывов, табы.
   Без зависимостей и без сборки — работает при открытии файла напрямую.
   ========================================================================== */
(function () {
  "use strict";


  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ----------------------------------------------------------------------
     1. Занавес при загрузке
     ---------------------------------------------------------------------- */
  function initCurtain() {
    var curtain = $(".curtain");
    if (!curtain) return;
    var hide = function () {
      curtain.classList.add("is-done");
      window.setTimeout(function () {
        curtain.style.display = "none";
      }, 1200);
    };
    if (reduceMotion) {
      curtain.style.display = "none";
      return;
    }
    window.setTimeout(hide, 650);
  }

  /* ----------------------------------------------------------------------
     2. Плавный скролл (инерция, как на референсе)
     ---------------------------------------------------------------------- */
  function initSmoothScroll() {
    if (reduceMotion) return;
    if (window.matchMedia("(hover: none)").matches) return; // на тач-устройствах нативный

    var current = window.scrollY;
    var target = window.scrollY;
    var ease = 0.085;
    var running = false;

    function max() {
      return document.documentElement.scrollHeight - window.innerHeight;
    }

    function clamp(v) {
      return Math.max(0, Math.min(v, max()));
    }

    function loop() {
      current += (target - current) * ease;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        running = false;
      }
      window.scrollTo(0, current);
      if (running) requestAnimationFrame(loop);
    }

    function start() {
      if (!running) {
        running = true;
        requestAnimationFrame(loop);
      }
    }

    window.addEventListener(
      "wheel",
      function (e) {
        if (document.body.classList.contains("is-locked")) return;
        if (e.ctrlKey) return;
        e.preventDefault();
        target = clamp(target + e.deltaY);
        start();
      },
      { passive: false }
    );

    window.addEventListener("resize", function () {
      target = current = window.scrollY;
    });

    // синхронизация при скролле не колесом (клавиатура, скроллбар)
    window.addEventListener("scroll", function () {
      if (!running) target = current = window.scrollY;
    });

    // якорные ссылки
    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href");
        if (!id || id === "#") return;
        var node = document.querySelector(id);
        if (!node) return;
        e.preventDefault();
        var top =
          node.getBoundingClientRect().top +
          window.scrollY -
          (parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--header-h"
            ),
            10
          ) || 84);
        target = clamp(top);
        start();
      });
    });
  }

  /* ----------------------------------------------------------------------
     3. Появление блоков при скролле
     ---------------------------------------------------------------------- */
  function initReveal() {
    var nodes = $$("[data-anim], [data-split]");
    if (!nodes.length) return;

    if (!("IntersectionObserver" in window) || reduceMotion) {
      nodes.forEach(function (n) {
        n.classList.add("is-inview");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-inview");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  /* ----------------------------------------------------------------------
     4. Пословная анимация заголовков  [data-split]
     ---------------------------------------------------------------------- */
  function initSplit() {
    $$("[data-split]").forEach(function (el) {
      if (el.dataset.splitDone) return;
      var html = "";
      var index = 0;

      // сохраняем <em> и <br>, режем текст на слова
      Array.prototype.forEach.call(el.childNodes, function (node) {
        if (node.nodeType === 3) {
          html += wrapWords(node.textContent);
        } else if (node.nodeName === "BR") {
          html += "<br>";
        } else {
          html += wrapWords(node.textContent, node.nodeName.toLowerCase());
        }
      });

      function wrapWords(text, tag) {
        return text
          .split(/(\s+)/)
          .map(function (word) {
            if (!word.trim()) return " ";
            var inner = tag ? "<" + tag + ">" + word + "</" + tag + ">" : word;
            var out =
              '<span class="split-word"><span style="--i:' +
              index +
              '">' +
              inner +
              "</span></span>";
            index++;
            return out;
          })
          .join("");
      }

      el.innerHTML = html;
      el.dataset.splitDone = "1";
    });
  }

  /* ----------------------------------------------------------------------
     5. Счётчики
     ---------------------------------------------------------------------- */
  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function run(el) {
      var to = parseFloat(el.dataset.count);
      var dur = parseInt(el.dataset.countDuration || "1600", 10);
      var suffix = el.dataset.countSuffix || "";
      var start = null;

      if (reduceMotion) {
        el.textContent = format(to) + suffix;
        return;
      }

      function tick(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(Math.round(to * eased)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function format(n) {
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(run);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          run(e.target);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.5 }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  /* ----------------------------------------------------------------------
     6. Параллакс  [data-parallax="0.15"]
     ---------------------------------------------------------------------- */
  function initParallax() {
    var nodes = $$("[data-parallax]");
    if (!nodes.length || reduceMotion) return;
    var ticking = false;

    function update() {
      var vh = window.innerHeight;
      nodes.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var speed = parseFloat(el.dataset.parallax) || 0.12;
        var offset = (rect.top + rect.height / 2 - vh / 2) * speed * -1;
        el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
      });
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update);
    update();
  }

  /* ----------------------------------------------------------------------
     7. Шапка: фон при скролле + скрытие вниз
     ---------------------------------------------------------------------- */
  function initHeader() {
    var header = $(".header");
    if (!header) return;
    var last = window.scrollY;

    function onScroll() {
      var y = window.scrollY;
      header.classList.toggle("is-stuck", y > 40);
      if (!document.body.classList.contains("is-locked")) {
        header.classList.toggle("is-hidden", y > 320 && y > last + 4);
      }
      last = y;

      var toTop = $(".to-top");
      if (toTop) toTop.classList.toggle("is-visible", y > 700);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------------------
     8. Мобильное меню
     ---------------------------------------------------------------------- */
  function initMenu() {
    var burger = $(".burger");
    var menu = $(".menu");
    if (!burger || !menu) return;

    function toggle(force) {
      var open = force !== undefined ? force : !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", open);
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("is-locked", open);
    }

    burger.addEventListener("click", function () {
      toggle();
    });

    $$(".menu__link, .menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        toggle(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggle(false);
    });
  }

  /* ----------------------------------------------------------------------
     9. Аккордеон
     ---------------------------------------------------------------------- */
  function initAccordion() {
    $$(".acc").forEach(function (acc) {
      var single = acc.dataset.single !== "false";

      $$(".acc__item", acc).forEach(function (item) {
        var head = $(".acc__head", item);
        var panel = $(".acc__panel", item);
        if (!head || !panel) return;

        head.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false");
        if (item.classList.contains("is-open")) {
          panel.style.height = panel.firstElementChild.offsetHeight + "px";
        }

        head.addEventListener("click", function () {
          var open = item.classList.contains("is-open");

          if (single && !open) {
            $$(".acc__item.is-open", acc).forEach(function (other) {
              other.classList.remove("is-open");
              $(".acc__panel", other).style.height = "0px";
              $(".acc__head", other).setAttribute("aria-expanded", "false");
            });
          }

          item.classList.toggle("is-open", !open);
          head.setAttribute("aria-expanded", !open ? "true" : "false");
          panel.style.height = open
            ? "0px"
            : panel.firstElementChild.offsetHeight + "px";
        });
      });
    });

    // пересчёт высоты открытых панелей: шрифты и картинки грузятся позже DOM
    function recalc() {
      $$(".acc__item.is-open").forEach(function (item) {
        var panel = $(".acc__panel", item);
        panel.style.height = panel.firstElementChild.offsetHeight + "px";
      });
    }

    window.addEventListener("resize", recalc);
    window.addEventListener("load", recalc);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalc);
  }

  /* ----------------------------------------------------------------------
     10. Слайдер отзывов
     ---------------------------------------------------------------------- */
  function initSlider() {
    $$("[data-slider]").forEach(function (root) {
      var track = $(".reviews__track", root);
      var slides = $$(".review", track);
      var prev = $("[data-slider-prev]", root);
      var next = $("[data-slider-next]", root);
      if (!track || !slides.length) return;

      var index = 0;

      function perView() {
        return window.innerWidth >= 900 ? 2 : 1;
      }

      function maxIndex() {
        return Math.max(0, slides.length - perView());
      }

      function render() {
        index = Math.min(index, maxIndex());
        var step = 100 / perView();
        track.style.transform = "translateX(-" + index * step + "%)";
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index >= maxIndex();
      }

      if (prev)
        prev.addEventListener("click", function () {
          index = Math.max(0, index - 1);
          render();
        });
      if (next)
        next.addEventListener("click", function () {
          index = Math.min(maxIndex(), index + 1);
          render();
        });

      // свайп
      var startX = null;
      track.addEventListener(
        "touchstart",
        function (e) {
          startX = e.touches[0].clientX;
        },
        { passive: true }
      );
      track.addEventListener(
        "touchend",
        function (e) {
          if (startX === null) return;
          var dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 45) {
            index = dx < 0 ? Math.min(maxIndex(), index + 1) : Math.max(0, index - 1);
            render();
          }
          startX = null;
        },
        { passive: true }
      );

      window.addEventListener("resize", render);
      render();
    });
  }

  /* ----------------------------------------------------------------------
     11. Табы прайса
     ---------------------------------------------------------------------- */
  function initTabs() {
    $$("[data-tabs]").forEach(function (root) {
      var tabs = $$(".tab", root);
      var targetSel = root.dataset.tabs;
      var items = $$(targetSel + " [data-cat]");

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var cat = tab.dataset.cat;
          tabs.forEach(function (t) {
            t.classList.toggle("is-active", t === tab);
          });
          items.forEach(function (item) {
            var show = cat === "all" || item.dataset.cat === cat;
            item.hidden = !show;
          });
        });
      });
    });
  }

  /* ----------------------------------------------------------------------
     13. Год в подвале + активный пункт меню
     ---------------------------------------------------------------------- */
  function initMisc() {
    $$("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });

    var page = document.body.dataset.page;
    if (page) {
      $$("[data-nav]").forEach(function (link) {
        link.classList.toggle("is-active", link.dataset.nav === page);
      });
    }

    var toTop = $(".to-top");
    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  function init() {
    initSplit();
    initCurtain();
    initHeader();
    initMenu();
    initReveal();
    initCounters();
    initParallax();
    initAccordion();
    initSlider();
    initTabs();
    initMisc();
    initSmoothScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
