import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';


import { APP_NAME, DEBUG, IS_BETA } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { IS_ELECTRON, IS_MAC_OS } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import LeftSideMenuItems from './LeftSideMenuItems';

import './SideMenu.scss';

type OwnProps = {
  className?: string;
  shouldHideSearch?: boolean; // TODO: переименовать аттрибут
  // hasMenu: boolean;
  // content: LeftColumnContent;
  shouldSkipTransition?: boolean;

  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  // onReset: NoneToVoidFunction;
};

type StateProps = {

};

const SideMenu: FC<OwnProps & StateProps> = ({
  className,
  // shouldHideSearch,
  // hasMenu,
  shouldSkipTransition,

  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  // onReset,
}) => {
  const lang = useLang();
  const { isMobile } = useAppLayout();
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();

  // const hasMenu = content === LeftColumnContent.ChatList;

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={onTrigger}
        ariaLabel={lang('AccDescrOpenMenu2')}
      >
        <div className={buildClassName('animated-menu-icon', shouldSkipTransition && 'no-animation')} />
      </Button>
    );
  }, [isMobile, lang, shouldSkipTransition]);

  // Disable dropdown menu RTL animation for resize
  // const {
  //   shouldDisableDropdownMenuTransitionRef,
  //   handleDropdownMenuTransitionEnd,
  // } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const isFullscreen = useFullscreenStatus();

  return (
    <DropdownMenu
      trigger={MainButton}
      footer={`${APP_NAME} ${versionString}`}
      className={buildClassName(
        'SideMenu',
        'main-menu',
        className,
        lang.isRtl && 'rtl right-aligned',
        // shouldHideSearch && lang.isRtl && 'right-aligned',
        // shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
      )}
      forceOpen={isBotMenuOpen}
      positionX={lang.isRtl ? 'right' : 'left'}
      transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
      // onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={onSelectArchived}
        onSelectContacts={onSelectContacts}
        onSelectSettings={onSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
      />
    </DropdownMenu>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {

    };
  },
)(SideMenu));
