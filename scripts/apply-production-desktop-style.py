from pathlib import Path

path = Path('src/styles/facility-group-card-grid.css')
content = path.read_text(encoding='utf-8')
marker = '/* Desktop production workspace density. */'

if marker not in content:
    content = content.rstrip() + '''

/* Desktop production workspace density. */
@media (min-width: 961px) {
  .production-build-card {
    top: var(--desktop-page-top-offset);
    max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));
  }

  .facility-cluster-detail-shell {
    align-self: start;
  }

  .facility-cluster-detail-card {
    min-height: 0;
  }

  .facility-cluster-detail-card.facility-group-card {
    grid-template-rows: auto;
    align-content: start;
  }

  .facility-card-spacer {
    display: none;
  }
}

@media (min-width: 1600px) {
  .production-workspace {
    grid-template-columns: minmax(280px, 320px) minmax(440px, 520px) minmax(480px, 680px);
    justify-content: start;
  }

  .facility-cluster-selector-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
'''
    path.write_text(content, encoding='utf-8')
