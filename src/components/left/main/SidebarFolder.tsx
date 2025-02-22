import type {FC, TeactNode} from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { MenuItemContextAction } from '../../ui/ListItem';

import buildClassName from '../../../util/buildClassName';
import { MouseButton } from '../../../util/windowEnvironment';
import renderText from '../../common/helpers/renderText';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../../hooks/useFastClick';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

interface OwnProps {
  title: TeactNode;
  icon?: TeactNode;
  isActive?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  onClick?: (arg: number) => void;
  clickArg?: number;
  contextActions?: MenuItemContextAction[];
}

// const classNames = {
//   active: 'Tab--active',
//   badgeActive: 'Tab__badge--active',
// };


const SidebarFolder: FC<OwnProps> = ({
  title,
  icon,
  isActive,
  badgeCount,
  isBadgeActive,
  onClick,
  clickArg,
  contextActions,
}) => {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLDivElement>(null);

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(tabRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getTriggerElement = useLastCallback(() => tabRef.current);
  const getRootElement = useLastCallback(() => tabRef.current!.closest('#Sidebar'));
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Folder-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <div
      className={buildClassName('Folder', isActive && 'is-active')}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={tabRef}
    >
      <span className="Folder_inner">
        { icon !== undefined ? icon : <Icon name="folder-badge" />}
        <span className="Folder-title">{typeof title === 'string' ? renderText(title) : title}</span>
        {Boolean(badgeCount) && (
          <span className={buildClassName('badge')}>
            {badgeCount}
          </span>
        )}
      </span>

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Folder-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default memo(SidebarFolder);
