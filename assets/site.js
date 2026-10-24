(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 搜索：按卡片文本过滤 */
  var q = document.getElementById('q');
  if (q) {
    var clear = document.getElementById('qclear');
    var cards = [].slice.call(document.querySelectorAll('#results .card'));
    var groups = [].slice.call(document.querySelectorAll('#results .group-block'));
    var none = document.getElementById('noresult');
    var hay = cards.map(function (c) { return (c.textContent || '').toLowerCase(); });

    function run() {
      var v = (q.value || '').trim().toLowerCase();
      clear.hidden = !v;
      var shown = 0;
      cards.forEach(function (c, i) {
        var hit = !v || hay[i].indexOf(v) !== -1;
        c.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        var any = [].slice.call(g.querySelectorAll('.card')).some(function (c) {
          return c.style.display !== 'none';
        });
        g.style.display = any ? '' : 'none';
      });
      none.hidden = shown > 0;
    }

    q.addEventListener('input', run);
    clear.addEventListener('click', function () { q.value = ''; run(); q.focus(); });
    run();
  }

  /* 目录：滚动到哪节高亮哪条 */
  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-90px 0px -65% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  /* 桌面快捷键：/ 聚焦搜索，Esc 清除 */
  var searchInput = document.getElementById('q');
  if (searchInput) {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInput.focus();
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.blur();
      }
    });
  }

  /* 角色：选中后高亮对应环节 */
  var chips = [].slice.call(document.querySelectorAll('.role-chip'));
  if (chips.length) {
    var blocks = [].slice.call(document.querySelectorAll('.role-block'));
    var summary = document.getElementById('roleSummary');

    function apply(i, scroll) {
      chips.forEach(function (c, j) {
        c.classList.toggle('is-on', j === i);
        c.setAttribute('aria-pressed', j === i ? 'true' : 'false');
      });
      blocks.forEach(function (b, j) { b.classList.toggle('is-on', j === i); });

      var b = blocks[i];
      if (b && summary) {
        var pub = b.querySelector('.role-pub');
        var n = b.querySelectorAll('.role-steps li').length;
        summary.textContent = b.querySelector('h3').textContent + ' · ' + n + ' 项任务' +
          (pub ? ' · ' + pub.textContent.replace('📣', '').trim() : '');
      }
      if (scroll && b) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    chips.forEach(function (c, i) {
      c.addEventListener('click', function () { apply(i, true); });
    });

    // 默认选中「学生本人」：按名称开头匹配，避免命中「财务处 + 学生资助管理中心」
    var student = 0;
    for (var i = 0; i < chips.length; i++) {
      var nm = (chips[i].querySelector('.rc-name') || chips[i]).textContent.trim();
      if (nm.indexOf('学生') === 0) { student = i; break; }
    }
    apply(student, false);
  }

  /* 打印：写入打印时间 */
  function stampPrintDate() {
    var d = new Date();
    var s = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    [].slice.call(document.querySelectorAll('.ph-date')).forEach(function (el) { el.textContent = s; });
  }
  stampPrintDate();
  window.addEventListener('beforeprint', stampPrintDate);

  /* 首页导航：滚动时高亮当前区块 */
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a')).filter(function (a) {
    var h = a.getAttribute('href');
    return h.charAt(0) === '#' && h !== '#top';
  });
  if (navLinks.length && 'IntersectionObserver' in window) {
    var ids = navLinks.map(function (a) { return a.getAttribute('href').slice(1); });
    var targets = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
        var link = navLinks[ids.indexOf(e.target.id)];
        if (link) link.setAttribute('aria-current', 'page');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* 入场动效 */
  if (!reduce && 'IntersectionObserver' in window) {
    var targets = [].slice.call(document.querySelectorAll('.card, .flow > li, .timeline > li, .author > div'));
    targets.forEach(function (t, i) {
      t.classList.add('reveal');
      t.style.transitionDelay = (Math.min(i % 6, 5) * 40) + 'ms';
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }
})();