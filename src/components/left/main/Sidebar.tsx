import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../../api/types';
import type { MenuItemContextAction } from '../../ui/ListItem';
import { type ISettings, LeftColumnContent } from '../../../types';

import { ALL_FOLDER_ID } from '../../../config';
import { selectCanShareFolder, selectTabState, selectTabsView } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import buildClassName from '../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { REM } from '../../common/helpers/mediaDimensions';
import { EmoticonChat, renderFolderIcon, renderFolderTitle } from '../../common/helpers/renderFolderIcon';

import useAppLayout from '../../../hooks/useAppLayout';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import SidebarFolder from './SidebarFolder';
import SideMenu from './SideMenu';

import './Sidebar.scss';

type OwnProps = {
  onContentChange: (content: LeftColumnContent) => void;
  onReset: (forceReturnToChatList?: true | Event) => void;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
  tabsView: ISettings['tabsView'];
};

const FOLDER_ICON_EMOJI_SIZE = 2.25 * REM;
const FOLDER_TITLE_EMOJI_SIZE = 0.8125 * REM;

const Sidebar: FC<OwnProps & StateProps> = ({
  onContentChange,
  onReset,

  chatFoldersById,
  folderInvitesById,
  orderedFolderIds,
  activeChatFolder,
  maxFolders,
  maxChatLists,
  maxFolderInvites,
  tabsView,
}) => {
  const {
    closeForumPanel,
    setActiveChatFolder,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder;
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  const folderCountersById = useFolderManagerForUnreadCounters();
  const foldersTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }
    return displayedFolders.map((folder, i) => {
      const { id } = folder;
      let title = lang('FilterAllChats');
      let badgeCount: number | undefined = 0;
      let emoticon: string | undefined = EmoticonChat;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        title = folder.title.text;
        badgeCount = folderCountersById[id]?.chatsCount;
        emoticon = folder.emoticon;

        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      return {
        id,
        icon: renderFolderIcon(emoticon, folder.title.entities, FOLDER_ICON_EMOJI_SIZE),
        title: renderFolderTitle(title, folder.title.entities, folder.noTitleAnimations, FOLDER_TITLE_EMOJI_SIZE),
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        contextActions: contextActions?.length ? contextActions : undefined,
        badgeCount,
        isBlocked,
      };
    });
  }, [
    displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
    maxFolderInvites,
  ]);

  const handleSwitchTab = useLastCallback((index: number) => {
    onReset(true);
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  const handleSelectSettings = useLastCallback(() => {
    onContentChange(LeftColumnContent.Settings);
  });

  const handleSelectContacts = useLastCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  });

  const handleSelectArchived = useLastCallback(() => {
    onContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  });

  const shouldHideSidebar = tabsView !== 'sidebar' || isMobile;

  return (
    <div id="Sidebar" className={buildClassName(!shouldHideSidebar && 'is-active')}>
      <SideMenu
        onSelectSettings={handleSelectSettings}
        onSelectContacts={handleSelectContacts}
        onSelectArchived={handleSelectArchived}
      />
      {foldersTabs?.map((tab, i) => (
        <SidebarFolder
          key={tab.id}
          title={tab.title}
          icon={tab.icon}
          isActive={i === activeChatFolder}
          badgeCount={tab.badgeCount}
          isBadgeActive={tab.isBadgeActive}
          onClick={handleSwitchTab}
          clickArg={i}
          contextActions={tab.contextActions}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
    } = global;
    const { activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      folderInvitesById,
      orderedFolderIds,
      activeChatFolder,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      tabsView: selectTabsView(global),
    };
  },
)(Sidebar));
