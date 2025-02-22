import { EDITABLE_INPUT_ID } from '../config';

export class EditableParagraphs {
  private static nodeContainer(node: Node): Node | null {
    let editable: Node | null = node;

    let parent = node.parentElement;
    while (parent && parent.id !== EDITABLE_INPUT_ID) {
      editable = parent; parent = parent.parentElement;
    }
    return editable;
  }

  private static caretContainer(modify: (selection: Selection) => void): Node | null {
    const selection = document.getSelection();
    // eslint-disable-next-line no-null/no-null
    if (!selection || selection.rangeCount === 0) return null;

    const ranges = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      ranges.push(selection.getRangeAt(i).cloneRange());
    }

    modify(selection);
    const range = selection.getRangeAt(0);
    const container = this.nodeContainer(range.startContainer);

    selection.removeAllRanges();
    ranges.forEach((r) => selection.addRange(r));

    return container;
  }

  static currentContainer = () => {
    return this.caretContainer(() => {});
  };

  static containerBeforeCaret = () => {
    return this.caretContainer((s) => s.modify('move', 'backward', 'character'));
  };

  static containerAfterCaret = () => {
    return this.caretContainer((s) => s.modify('move', 'forward', 'character'));
  };

  private static blocksNodeFilter = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
    if (node.nodeName === 'BR') return NodeFilter.FILTER_ACCEPT;
    if (node.nodeName === 'BLOCKQUOTE') return NodeFilter.FILTER_ACCEPT;

    return NodeFilter.FILTER_SKIP;
  };

  private static collectBreaks(node: Node): Node[] {
    const breaks: Node[] = [];

    if (this.blocksNodeFilter(node) === NodeFilter.FILTER_ACCEPT) breaks.push(node);
    else {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, this.blocksNodeFilter);
      while (walker.nextNode()) breaks.push(walker.currentNode);
    }

    return breaks;
  }

  static getParagraphRangeBefore(node: Node): Range | null {
    // eslint-disable-next-line no-null/no-null
    if (!node.previousSibling || !node.parentNode) return null;

    const range = document.createRange();
    range.selectNodeContents(node.parentNode); range.setEndBefore(node);

    let fistCheck = false;
    const enough = (stack: Node[]): boolean => {
      let idx = stack.length - 1;

      if (!fistCheck) {
        fistCheck = true; const breakNode = stack[idx]; idx--;

        if (breakNode.nodeType === Node.TEXT_NODE) {
          const value = breakNode.nodeValue || '';

          let lastIndex = value.lastIndexOf('\n');
          if (lastIndex > 0) {
            lastIndex = value.lastIndexOf('\n', lastIndex - 1);
            if (lastIndex !== -1) {
              range.setStart(breakNode, lastIndex + 1);
              return true;
            }
          }
        }
      }

      for (; idx >= 0; idx--) {
        const breakNode = stack[idx];
        if (breakNode.nodeType !== Node.TEXT_NODE) {
          range.setStartAfter(breakNode);
          return true;
        }
        const value = breakNode.nodeValue || '';
        const lastIndex = value.lastIndexOf('\n');
        if (lastIndex !== -1) {
          range.setStart(breakNode, lastIndex + 1);
          return true;
        }
      }

      return false;
    };

    for (let cur: ChildNode | null = node.previousSibling; cur; cur = cur.previousSibling) {
      if (enough(this.collectBreaks(cur))) break;
    }

    return range;
  }

  static getParagraphRangeAfter(node: Node): Range | null {
    // eslint-disable-next-line no-null/no-null
    if (!node.nextSibling || !node.parentNode) return null;

    const range = document.createRange();
    range.selectNodeContents(node.parentNode); range.setStartAfter(node);

    const enough = (breaks: Node[]): boolean => {
      for (const breakNode of breaks) {
        if (breakNode.nodeType !== Node.TEXT_NODE) {
          range.setEndAfter(breakNode);
          return true;
        } else {
          const value = breakNode.nodeValue || '';
          const lastIndex = value.indexOf('\n');
          if (lastIndex !== -1) {
            range.setEnd(breakNode, lastIndex + 1);
            return true;
          }
        }
      }
      return false;
    };

    for (let cur: ChildNode | null = node.nextSibling; cur; cur = cur.nextSibling) {
      if (enough(this.collectBreaks(cur))) break;
    }

    return range;
  }

  static setCursorAtEndOf(node: Node) {
    const range = document.createRange();
    range.selectNodeContents(node); range.collapse(false);

    const selection = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
