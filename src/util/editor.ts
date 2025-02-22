import { EditableParagraphs } from './editableParagraphs';

export class Editor {
  private static setCursorAfter(node: Node) {
    const range = document.createRange();
    range.setStartAfter(node); range.collapse(true);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  public static mergeWithBlockquote() {
    const br = () => document.createElement('br');

    const currentContainer = EditableParagraphs.currentContainer() as Element;
    const containerBeforeCaret = EditableParagraphs.containerBeforeCaret() as Element;

    if (!currentContainer || !containerBeforeCaret) return;

    if (
      currentContainer.nodeName === 'BLOCKQUOTE' && containerBeforeCaret.nodeName === 'BLOCKQUOTE'
      && !currentContainer.isSameNode(containerBeforeCaret)
    ) {
      const range = document.createRange(); range.selectNodeContents(currentContainer);

      if (containerBeforeCaret.lastChild && containerBeforeCaret.lastChild.nodeName !== 'BR') {
        containerBeforeCaret.append(br());
      }
      containerBeforeCaret.append(br());

      EditableParagraphs.setCursorAtEndOf(containerBeforeCaret);
      containerBeforeCaret.append(range.extractContents());
      currentContainer.remove();
      return;
    }

    if (currentContainer.nodeName === 'BLOCKQUOTE' && containerBeforeCaret.nodeName !== 'BLOCKQUOTE') {
      const range = EditableParagraphs.getParagraphRangeBefore(currentContainer);
      if (!range) return;

      const border = br();
      currentContainer.prepend(range.extractContents(), border);
      this.setCursorAfter(border);
      return;
    }

    if (currentContainer.nodeName !== 'BLOCKQUOTE' && containerBeforeCaret.nodeName === 'BLOCKQUOTE') {
      const range = EditableParagraphs.getParagraphRangeAfter(containerBeforeCaret);
      if (!range) return;

      const last = containerBeforeCaret.lastChild;
      if (last) {
        if (last.nodeType === Node.TEXT_NODE && last.nodeValue?.endsWith('\n')) { //
        } else if (containerBeforeCaret.lastChild.nodeName !== 'BR') containerBeforeCaret.append(br());
      }

      const border = br();
      containerBeforeCaret.append(border, range.extractContents());
      this.setCursorAfter(border);
    }
  }

  public static correctNewLine(): boolean {
    const currentContainer = EditableParagraphs.currentContainer() as Element;
    // const containerAfterCaret = EditableParagraphs.containerAfterCaret() as Element;

    if (!currentContainer) return false;

    if (currentContainer.nodeName === 'BLOCKQUOTE') {
      const range = document.createRange();
      range.selectNodeContents(currentContainer);

      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) return false;

      const selectionRange = selection.getRangeAt(0).cloneRange();
      selectionRange.setStart(currentContainer, 0);

      if (
        (range.cloneContents().textContent || '').length
        === (selectionRange.cloneContents().textContent || '').length
      ) {
        currentContainer.after(document.createElement('br'));
        this.setCursorAfter(currentContainer);
        return true;
      }
    }
    return false;
  }

  public static formatCorrector(node: Element) {
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_ELEMENT,
      (n) => (n.nodeName === 'BLOCKQUOTE' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    );
    // BR
    while (walker.nextNode()) {
      const blockquote = walker.currentNode as HTMLQuoteElement;
      if (blockquote.parentNode && blockquote.parentNode.isSameNode(node)) continue;

      if (blockquote.firstChild && blockquote.firstChild.nodeName !== 'BR') {
        blockquote.prepend(document.createElement('br'));
      }

      if (blockquote.lastChild && blockquote.lastChild.nodeName !== 'BR') {
        blockquote.append(document.createElement('br'));
      }

      blockquote.replaceWith(...blockquote.childNodes);
    }
  }
}
