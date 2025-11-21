export function getElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (sibling) => sibling.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parent;
  }

  return path.join(' > ');
}

export function highlightElement(element: Element) {
  element.classList.add('__comment-highlight');
}

export function unhighlightElement(element: Element) {
  element.classList.remove('__comment-highlight');
}

export const elementSelectorStyles = `
  .__comment-highlight {
    outline: 3px solid #a855f7 !important;
    outline-offset: 2px !important;
    background-color: rgba(168, 85, 247, 0.1) !important;
    cursor: pointer !important;
    position: relative !important;
  }

  .__comment-overlay-active * {
    cursor: pointer !important;
  }
`;
