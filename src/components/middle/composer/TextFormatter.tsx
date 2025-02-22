import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { IAnchorPosition } from '../../../types';
import { ApiMessageEntityTypes } from '../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { ensureProtocol } from '../../../util/ensureProtocol';
import getKeyFromEvent from '../../../util/getKeyFromEvent';
import stopEvent from '../../../util/stopEvent';
import { INPUT_CUSTOM_EMOJI_SELECTOR } from './helpers/customEmoji';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import useVirtualBackdrop from '../../../hooks/useVirtualBackdrop';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import './TextFormatter.scss';

export type OwnProps = {
  isOpen: boolean;
  anchorPosition?: IAnchorPosition;
  selectedRange?: Range;
  setSelectedRange: (range: Range) => void;
  onClose: () => void;
  onFormatting: (content: string) => void;
};

interface ISelectedTextFormats {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  monospace?: boolean;
  spoiler?: boolean;
  quote?: boolean;
}

const TEXT_FORMAT_BY_TAG_NAME: Record<string, keyof ISelectedTextFormats> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  DEL: 'strikethrough',
  CODE: 'monospace',
  SPAN: 'spoiler',
  BLOCKQUOTE: 'quote',
};
const fragmentEl = document.createElement('div');

const TextFormatter: FC<OwnProps> = ({
  isOpen,
  anchorPosition,
  selectedRange,
  setSelectedRange,
  onClose,
  onFormatting,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen);
  const [isLinkControlOpen, openLinkControl, closeLinkControl] = useFlag();
  const [linkUrl, setLinkUrl] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [inputClassName, setInputClassName] = useState<string | undefined>();
  const [selectedTextFormats, setSelectedTextFormats] = useState<ISelectedTextFormats>({});

  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);
  useVirtualBackdrop(
    isOpen,
    containerRef,
    onClose,
    true,
  );

  useEffect(() => {
    if (isLinkControlOpen) {
      linkUrlInputRef.current!.focus();
    } else {
      setLinkUrl('');
      setIsEditingLink(false);
    }
  }, [isLinkControlOpen]);

  useEffect(() => {
    if (!shouldRender) {
      closeLinkControl();
      setSelectedTextFormats({});
      setInputClassName(undefined);
    }
  }, [closeLinkControl, shouldRender]);

  useEffect(() => {
    if (!isOpen || !selectedRange) {
      return;
    }

    const selectedFormats: ISelectedTextFormats = {};
    let parentElement = selectedRange.commonAncestorContainer as HTMLElement | null;
    while (parentElement && parentElement.id !== EDITABLE_INPUT_ID) {
      const textFormat = TEXT_FORMAT_BY_TAG_NAME[parentElement.tagName];
      if (textFormat) {
        selectedFormats[textFormat] = true;
      }

      parentElement = parentElement.parentElement;
    }

    setSelectedTextFormats(selectedFormats);
  }, [isOpen, selectedRange, openLinkControl]);

  const restoreSelection = useLastCallback(() => {
    if (!selectedRange) {
      return;
    }

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  });

  const updateSelectedRange = useLastCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      setSelectedRange(selection.getRangeAt(0));
    }
  });

  const getSelectedText = useLastCallback((shouldDropCustomEmoji?: boolean) => {
    if (!selectedRange) {
      return undefined;
    }
    fragmentEl.replaceChildren(selectedRange.cloneContents());
    if (shouldDropCustomEmoji) {
      fragmentEl.querySelectorAll(INPUT_CUSTOM_EMOJI_SELECTOR).forEach((el) => {
        el.replaceWith(el.getAttribute('alt')!);
      });
    }
    return fragmentEl.innerHTML;
  });

  const getSelectedElement = useLastCallback(() => {
    if (!selectedRange) {
      return undefined;
    }

    return selectedRange.commonAncestorContainer.parentElement;
  });

  function updateInputStyles() {
    const input = linkUrlInputRef.current;
    if (!input) {
      return;
    }

    const { offsetWidth, scrollWidth, scrollLeft } = input;
    if (scrollWidth <= offsetWidth) {
      setInputClassName(undefined);
      return;
    }

    let className = '';
    if (scrollLeft < scrollWidth - offsetWidth) {
      className = 'mask-right';
    }
    if (scrollLeft > 0) {
      className += ' mask-left';
    }

    setInputClassName(className);
  }

  function handleLinkUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLinkUrl(e.target.value);
    updateInputStyles();
  }

  /**
   * Разбивает текстовые узлы, если граница Range находится внутри узла.
   */
  function splitRangeBoundaries(range: Range) {
    // Если начало выделения внутри текстового узла – разбиваем его.
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer as Text;
      if (range.startOffset > 0 && range.startOffset < textNode.length) {
        // Разбиваем текстовый узел на две части.
        textNode.splitText(range.startOffset);
        // Перенастраиваем начало выделения на начало нового (второго) узла.
        range.setStart(textNode.nextSibling!, 0);
      }
    }
    // Аналогично для конца выделения.
    if (range.endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.endContainer as Text;
      if (range.endOffset > 0 && range.endOffset < textNode.length) {
        textNode.splitText(range.endOffset);
        // Здесь граница остается корректной, так как текущий текстовый узел теперь содержит текст до split.
      }
    }
  }

  /**
   * Ищет ближайшего родителя для узла, у которого tagName совпадает (без учета регистра).
   */
  function getClosestAncestor(node: Node, tagName: string): HTMLElement | null {
    let current: Node | null = node;
    tagName = tagName.toLowerCase();
    while (current) {
      if (
        current.nodeType === Node.ELEMENT_NODE &&
        (current as HTMLElement).tagName.toLowerCase() === tagName
      ) {
        return current as HTMLElement;
      }
      current = current.parentNode;
    }
    return null;
  }

  /**
   * Убирает заданный формат (например, 'i') с выделенного диапазона.
   * Если выделение находится внутри форматированного элемента, то элемент будет разделён на три части:
   *  - Левая часть (до выделения) – остаётся с форматом,
   *  - Выделение – без данного формата,
   *  - Правая часть (после выделения) – остаётся с форматом.
   *
   * При этом вложенные форматы (например, <b>) остаются без изменений.
   *
   * @param selectedRange Выделенный диапазон (Range)
   * @param tagName Имя тега, формат которого нужно убрать (например, "i")
   */
  function removeFormattingFromSelection(tagName: string) {
    if (!selectedRange) return; // Если нет выделения – выходим.
    // Находим ближайший родительский элемент с нужным тегом.
    const formatEl = getClosestAncestor(selectedRange.startContainer, tagName);
    if (!formatEl) return; // Если формат не найден – выходим.

    // Подготовим границы выделения: если они находятся внутри текстовых узлов, то разобьем узлы.
    splitRangeBoundaries(selectedRange);

    // Создаем Range, охватывающий всё содержимое форматированного элемента.
    const fullRange = document.createRange();
    fullRange.selectNodeContents(formatEl);

    // Создаем Range для левой части (до выделения).
    const leftRange = document.createRange();
    leftRange.setStart(fullRange.startContainer, fullRange.startOffset);
    leftRange.setEnd(selectedRange.startContainer, selectedRange.startOffset);

    // Создаем Range для правой части (после выделения).
    const rightRange = document.createRange();
    rightRange.setStart(selectedRange.endContainer, selectedRange.endOffset);
    rightRange.setEnd(fullRange.endContainer, fullRange.endOffset);

    // Извлекаем содержимое левой, выделенной и правой частей.
    const leftFragment = leftRange.extractContents();
    const selectedFragment = selectedRange.extractContents();
    const rightFragment = rightRange.extractContents();

    const parent = formatEl.parentNode;
    if (!parent) return;

    // Если левая часть не пустая – оборачиваем её в новый элемент с тем же тегом и атрибутами.
    if (leftFragment.textContent?.trim()) {
      const newLeft = formatEl.cloneNode(false) as HTMLElement;
      newLeft.appendChild(leftFragment);
      parent.insertBefore(newLeft, formatEl);
    }

    // Вставляем выделенный фрагмент (он остается без обертки удаляемого формата).
    parent.insertBefore(selectedFragment, formatEl);

    // Если правая часть не пустая – оборачиваем её в новый элемент.
    if (rightFragment.textContent?.trim()) {
      const newRight = formatEl.cloneNode(false) as HTMLElement;
      newRight.appendChild(rightFragment);
      if (formatEl.nextSibling) {
        parent.insertBefore(newRight, formatEl.nextSibling);
      } else {
        parent.appendChild(newRight);
      }
    }

    // Удаляем исходный форматированный элемент.
    parent.removeChild(formatEl);
  }


  function getFormatButtonClassName(key: keyof ISelectedTextFormats) {
    // if (key === 'quote' && selectedTextFormats.quote) {
    //   return 'active disabled';
    // }

    if (selectedTextFormats[key]) {
      return 'active';
    }

    if (key === 'monospace' || key === 'strikethrough') {
      if (Object.keys(selectedTextFormats).some(
        (fKey) => fKey !== key && Boolean(selectedTextFormats[fKey as keyof ISelectedTextFormats]),
      )) {
        return 'disabled';
      }
    } else if (selectedTextFormats.monospace || selectedTextFormats.strikethrough) {
      return 'disabled';
    }

    return undefined;
  }

  const handleSpoilerText = useLastCallback(() => {
    if (selectedTextFormats.spoiler) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.dataset.entityType !== ApiMessageEntityTypes.Spoiler
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        spoiler: false,
      }));

      return;
    }

    const text = getSelectedText();
    document.execCommand(
      'insertHTML', false, `<span class="spoiler" data-entity-type="${ApiMessageEntityTypes.Spoiler}">${text}</span>`,
    );
    onClose();
  });

  const handleBoldText = useLastCallback(() => {
    setSelectedTextFormats((selectedFormats) => {
      // Somehow re-applying 'bold' command to already bold text doesn't work
      document.execCommand(selectedFormats.bold ? 'removeFormat' : 'bold');
      Object.keys(selectedFormats).forEach((key) => {
        if ((key === 'italic' || key === 'underline') && Boolean(selectedFormats[key])) {
          document.execCommand(key);
        }
      });

      updateSelectedRange();
      return {
        ...selectedFormats,
        bold: !selectedFormats.bold,
      };
    });
  });

  const handleItalicText = useLastCallback(() => {
    document.execCommand('italic');
    updateSelectedRange();
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      italic: !selectedFormats.italic,
    }));
  });

  const handleUnderlineText = useLastCallback(() => {
    document.execCommand('underline');
    updateSelectedRange();
    setSelectedTextFormats((selectedFormats) => ({
      ...selectedFormats,
      underline: !selectedFormats.underline,
    }));
  });

  const handleStrikethroughText = useLastCallback(() => {
    if (selectedTextFormats.strikethrough) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.tagName !== 'DEL'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        strikethrough: false,
      }));

      return;
    }

    const text = getSelectedText();
    document.execCommand('insertHTML', false, `<del>${text}</del>`);
    onClose();
  });

  const handleMonospaceText = useLastCallback(() => {
    if (selectedTextFormats.monospace) {
      const element = getSelectedElement();
      if (
        !selectedRange
        || !element
        || element.tagName !== 'CODE'
        || !element.textContent
      ) {
        return;
      }

      element.replaceWith(element.textContent);
      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        monospace: false,
      }));

      return;
    }

    const text = getSelectedText(true);
    document.execCommand('insertHTML', false, `<code class="text-entity-code" dir="auto">${text}</code>`);
    onClose();
  });

  const handleQuoteText = useLastCallback(() => {
    if (selectedTextFormats.quote) {
      if (!selectedRange) return;

      let element = selectedRange.commonAncestorContainer as HTMLElement | null;
      while (element && element.tagName !== 'BLOCKQUOTE') { element = element.parentElement; }

      if (!selectedRange || !element || element.tagName !== 'BLOCKQUOTE') return;

      selectedRange.selectNodeContents(element);
      onFormatting(element.innerHTML);

      setSelectedTextFormats((selectedFormats) => ({
        ...selectedFormats,
        quote: false,
      }));

      return;
    }

    const text = getSelectedText(false);
    onFormatting(`<blockquote class="blockquote">${text}</blockquote>`);
    // document.execCommand('insertHTML', false, `<blockquote class="blockquote">${text}</blockquote>`);
    onClose();
  });

  const handleLinkUrlConfirm = useLastCallback(() => {
    const formattedLinkUrl = (ensureProtocol(linkUrl) || '').split('%').map(encodeURI).join('%');

    if (isEditingLink) {
      const element = getSelectedElement();
      if (!element || element.tagName !== 'A') {
        return;
      }

      (element as HTMLAnchorElement).href = formattedLinkUrl;

      onClose();

      return;
    }

    const text = getSelectedText(true);
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<a href=${formattedLinkUrl} class="text-entity-link" dir="auto">${text}</a>`,
    );
    onClose();
  });

  const handleKeyDown = useLastCallback((e: KeyboardEvent) => {
    const HANDLERS_BY_KEY: Record<string, AnyToVoidFunction> = {
      k: openLinkControl,
      b: handleBoldText,
      u: handleUnderlineText,
      i: handleItalicText,
      m: handleMonospaceText,
      s: handleStrikethroughText,
      p: handleSpoilerText,
      q: handleQuoteText,
    };

    const handler = HANDLERS_BY_KEY[getKeyFromEvent(e)];

    if (
      e.altKey
      || !(e.ctrlKey || e.metaKey)
      || !handler
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handler();
  });

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const lang = useOldLang();

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && isLinkControlOpen) {
      handleLinkUrlConfirm();
      e.preventDefault();
    }
  }

  if (!shouldRender) {
    return undefined;
  }

  const className = buildClassName(
    'TextFormatter',
    transitionClassNames,
    isLinkControlOpen && 'link-control-shown',
  );

  const linkUrlConfirmClassName = buildClassName(
    'TextFormatter-link-url-confirm',
    Boolean(linkUrl.length) && 'shown',
  );

  const style = anchorPosition
    ? `left: ${anchorPosition.x}px; top: ${anchorPosition.y}px;--text-formatter-left: ${anchorPosition.x}px;`
    : '';

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onKeyDown={handleContainerKeyDown}
      // Prevents focus loss when clicking on the toolbar
      onMouseDown={stopEvent}
    >
      <div className="TextFormatter-buttons">
        <Button
          color="translucent"
          ariaLabel="Spoiler text"
          className={getFormatButtonClassName('spoiler')}
          onClick={handleSpoilerText}
        >
          <Icon name="eye-closed" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button
          color="translucent"
          ariaLabel="Bold text"
          className={getFormatButtonClassName('bold')}
          onClick={handleBoldText}
        >
          <Icon name="bold" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Italic text"
          className={getFormatButtonClassName('italic')}
          onClick={handleItalicText}
        >
          <Icon name="italic" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Underlined text"
          className={getFormatButtonClassName('underline')}
          onClick={handleUnderlineText}
        >
          <Icon name="underlined" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Strikethrough text"
          className={getFormatButtonClassName('strikethrough')}
          onClick={handleStrikethroughText}
        >
          <Icon name="strikethrough" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Monospace text"
          className={getFormatButtonClassName('monospace')}
          onClick={handleMonospaceText}
        >
          <Icon name="monospace" />
        </Button>
        <Button
          color="translucent"
          ariaLabel="Quote text"
          className={getFormatButtonClassName('quote')}
          onClick={handleQuoteText}
        >
          <Icon name="quote-text" />
        </Button>
        <div className="TextFormatter-divider" />
        <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')} onClick={openLinkControl}>
          <Icon name="link" />
        </Button>
      </div>

      <div className="TextFormatter-link-control">
        <div className="TextFormatter-buttons">
          <Button color="translucent" ariaLabel={lang('Cancel')} onClick={closeLinkControl}>
            <Icon name="arrow-left" />
          </Button>
          <div className="TextFormatter-divider" />

          <div
            className={buildClassName('TextFormatter-link-url-input-wrapper', inputClassName)}
          >
            <input
              ref={linkUrlInputRef}
              className="TextFormatter-link-url-input"
              type="text"
              value={linkUrl}
              placeholder="Enter URL..."
              autoComplete="off"
              inputMode="url"
              dir="auto"
              onChange={handleLinkUrlChange}
              onScroll={updateInputStyles}
            />
          </div>

          <div className={linkUrlConfirmClassName}>
            <div className="TextFormatter-divider" />
            <Button
              color="translucent"
              ariaLabel={lang('Save')}
              className="color-primary"
              onClick={handleLinkUrlConfirm}
            >
              <Icon name="check" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TextFormatter);
