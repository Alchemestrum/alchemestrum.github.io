document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.post-content img').forEach(function (img) {
    if (img.parentElement.tagName !== 'A') {
      const a = document.createElement('a');
      a.href = img.src;
      a.className = 'glightbox';
      a.dataset.title = img.alt || '';
      img.parentNode.insertBefore(a, img);
      a.appendChild(img);
    }
  });
  GLightbox({ touchNavigation: true, loop: false });
});
