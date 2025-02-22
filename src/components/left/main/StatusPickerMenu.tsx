import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { selectIsContextMenuTranslucent } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';

import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';

import styles from './StatusPickerMenu.module.scss';

export type OwnProps = {
  isOpen: boolean;
  statusButtonRef: RefObject<HTMLButtonElement>;
  onEmojiStatusSelect: (emojiStatus: ApiSticker) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
}

const StatusPickerMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  statusButtonRef,
  areFeaturedStickersLoaded,
  isTranslucent,
  onEmojiStatusSelect,
  onClose,
}) => {
  const { loadFeaturedEmojiStickers } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const [isContextMenuShown, markContextMenuShown, unmarkContextMenuShown] = useFlag();
  useEffect(() => {
    ref.current!.style.setProperty('--offset-right', `${statusButtonRef.current!.getBoundingClientRect().right}px`);
  }, [isOpen, statusButtonRef]);

  useEffect(() => {
    if (isOpen && !areFeaturedStickersLoaded) {
      loadFeaturedEmojiStickers();
    }
  }, [areFeaturedStickersLoaded, isOpen, loadFeaturedEmojiStickers]);

  const handleEmojiSelect = useCallback((sticker: ApiSticker) => {
    onEmojiStatusSelect(sticker);
    onClose();
  }, [onClose, onEmojiStatusSelect]);

  return (
    <Portal>
      <Menu
        ref={ref}
        isOpen={isOpen}
        noCompact
        positionX="left"
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        noCloseOnBackdrop={isContextMenuShown}
      >
        <CustomEmojiPicker
          idPrefix="status-emoji-set-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          isStatusPicker
          isTranslucent={isTranslucent}
          onContextMenuOpen={markContextMenuShown}
          onContextMenuClose={unmarkContextMenuShown}
          onCustomEmojiSelect={handleEmojiSelect}
          onContextMenuClick={onClose}
        />
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
    isTranslucent: selectIsContextMenuTranslucent(global),
  };
})(StatusPickerMenu));
