import { useEffect, useRef, useState } from 'react';

interface ElementSelectorProps {
  isActive: boolean;
  onElementSelected: (selector: string, position: { x: number; y: number }) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function ElementSelector({ isActive, onElementSelected, containerRef }: ElementSelectorProps) {
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<string>('');

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetElement = elements.find(el =>
        container.contains(el) &&
        el !== container &&
        !el.closest('[data-comment-ui]') &&
        el.tagName !== 'IFRAME'
      );

      if (targetElement && targetElement !== container && targetElement.tagName !== 'IFRAME') {
        const targetRect = targetElement.getBoundingClientRect();
        const relativeRect = new DOMRect(
          targetRect.left - rect.left,
          targetRect.top - rect.top,
          targetRect.width,
          targetRect.height
        );
        setHoveredRect(relativeRect);
        setHoveredInfo(generateElementInfo(targetElement));
      } else {
        setHoveredRect(null);
        setHoveredInfo('');
      }
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetElement = elements.find(el =>
        container.contains(el) &&
        el !== container &&
        !el.closest('[data-comment-ui]') &&
        el.tagName !== 'IFRAME'
      );

      if (targetElement && targetElement !== container && targetElement.tagName !== 'IFRAME') {
        const selector = generateSelector(targetElement);
        onElementSelected(selector, { x, y });
      } else {
        onElementSelected('', { x, y });
      }
    };

    const container = containerRef.current;
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick, true);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick, true);
    };
  }, [isActive, containerRef, onElementSelected]);

  if (!isActive || !hoveredRect) return null;

  return (
    <>
      <div
        data-comment-ui
        className="absolute border-2 border-purple-500 bg-purple-500/10 pointer-events-none z-40 transition-all duration-75"
        style={{
          left: `${hoveredRect.left}px`,
          top: `${hoveredRect.top}px`,
          width: `${hoveredRect.width}px`,
          height: `${hoveredRect.height}px`,
        }}
      />
      {hoveredInfo && (
        <div
          data-comment-ui
          className="absolute bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-lg pointer-events-none z-40 whitespace-nowrap"
          style={{
            left: `${hoveredRect.left}px`,
            top: `${Math.max(0, hoveredRect.top - 32)}px`,
          }}
        >
          {hoveredInfo}
        </div>
      )}
    </>
  );
}

function generateSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0 && !c.startsWith('data-comment'));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
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

    if (path.length > 5) break;
  }

  return path.join(' > ');
}

function generateElementInfo(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className && typeof element.className === 'string'
    ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';

  return `${tag}${id}${classes}`;
}
