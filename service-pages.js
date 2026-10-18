(() => {
  const menu = document.querySelector('.menu-btn');
  const nav = document.querySelector('.site-nav');
  menu?.addEventListener('click', () => {
    const expanded = nav?.classList.toggle('open') || false;
    menu.setAttribute('aria-expanded', String(expanded));
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  }));
})();
