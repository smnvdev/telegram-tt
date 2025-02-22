import { useCallback, useEffect, useRef } from '../../../../lib/teact/teact';

import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import focusEditableElement from '../../../../util/focusEditableElement';
import { getCaretPosition, setCaretPosition } from '../../../../util/selection';

interface Change {
  timestamp: number;
  from: number;
  removed: string;
  added: string;
  caret: number;
}

export const useUndoManager = (
  inputRef: React.RefObject<HTMLDivElement>,
  onChange: (html: string) => void,
  mergeChangesWithDelay: number = 300,
) => {
  const initState = useCallback(() => ({
    undo: [] as Change[], redo: [] as Change[], content: '', caret: 0,
  }), []);

  const state = useRef(initState());

  const buildChange = (previous: string, current: string, caret: number): Change => {
    let left = 0; let right = Math.max(previous.length, current.length);
    while (left < previous.length && previous[left] === current[left]) left++;
    while (right > left && previous[right - 1] === current[right - 1]) right--;

    return {
      timestamp: Date.now(),
      from: left,
      removed: previous.slice(left, right),
      added: current.slice(left, right),
      caret,
    };
  };

  const merge = (changes: Change[], change: Change): Change[] => {
    if (changes.length === 0) return [change];

    const previousChange = changes[changes.length - 1];
    const delay = change.timestamp - previousChange.timestamp;
    if (
      delay <= mergeChangesWithDelay && change.removed === ''
      && previousChange.from + previousChange.added.length === change.from
    ) {
      previousChange.added += change.added;
      previousChange.timestamp = change.timestamp;
      return changes;
    }

    if (
      delay < mergeChangesWithDelay && change.added === '' && previousChange.added === ''
      && change.from === previousChange.from + previousChange.removed.length
    ) {
      previousChange.removed += change.removed;
      previousChange.timestamp = change.timestamp;
      return changes;
    }

    changes.push(change);
    return changes;
  };

  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  const record = useCallback((content: string) => {
    if (state.current.content === content) return;

    const undo = merge(state.current.undo, buildChange(state.current.content, content, state.current.caret));
    // eslint-disable-next-line object-curly-newline
    state.current = { undo, redo: [], content, caret: state.current.caret };
  }, []);

  useEffect(() => {
    state.current = initState();

    const handleBeforeInput = () => {
      if (!inputRef.current) return;
      state.current.caret = getCaretPosition(inputRef.current);
    };

    const handleInput = () => {
      if (!inputRef.current) return;
      record(inputRef.current.innerHTML);
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener('beforeinput', handleBeforeInput);
      // input.addEventListener('input', handleInput);
    }
    return () => {
      if (input) {
        input.removeEventListener('beforeinput', handleBeforeInput);
        // input.removeEventListener('input', handleInput);
      }
    };
  }, [initState, record, inputRef]);

  const applyChange = (val: string, change: Change, reverse = false): string => {
    const { from, removed, added } = change;
    return val.slice(0, from) + (reverse ? removed : added) + val.slice(from + (reverse ? added : removed).length);
  };

  const handleCommand = (origin: Change[], destination: Change[], reverse: boolean = false) => {
    if (origin.length === 0 || !inputRef.current) return;
    const change = origin.pop();
    if (!change) return;

    destination.push(change);
    state.current.content = applyChange(state.current.content, change, reverse);
    inputRef.current.innerHTML = state.current.content;
    onChange(state.current.content);

    if (state.current.content) {
      requestNextMutation(() => {
        if (!inputRef.current) return;
        focusEditableElement(inputRef.current, true);
        setCaretPosition(inputRef.current, change.caret);
      });
    }
  };

  const handleUndoCommand = () => handleCommand(state.current.undo, state.current.redo, true);
  const handleRedoCommand = () => handleCommand(state.current.redo, state.current.undo);

  return { undo: handleUndoCommand, redo: handleRedoCommand, record };
};
