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