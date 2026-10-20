const reduced = matchMedia('(prefers-reduced-motion: reduce)');
if (!reduced.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(element => {
    // Content already in view is never hidden after the first paint.
    if (element.getBoundingClientRect().top < innerHeight) return;
    element.classList.add('reveal-ready');
    observer.observe(element);
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer.disconnect();
    document.querySelectorAll('.reveal-ready').forEach(element => element.classList.add('in'));
  });
}
export {};
