import type { TeactNode } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type {ApiChatFolder, ApiMessageEntity} from '../../../api/types';
import type { IconName } from '../../../types/icons';
import { ApiMessageEntityTypes } from '../../../api/types';

import { processEntity, renderTextWithEntities } from './renderTextWithEntities';

import Icon from '../icons/Icon';

export const EmoticonChat = /* 💬 */ '\u{1F4AC}';
const defaultIcon = /* 🗂 */ '\u{1F5C2}';
const emoticonIcons: Record<string, IconName> = {
  /* ⭐ */ '\u{2B50}': 'star-filled',
  /* 🤖 */ '\u{1F916}': 'bot',
  /* 👤 */ '\u{1F464}': 'user-filled',
  /* 👥 */ '\u{1F465}': 'group-filled',
  /* 📢 */ '\u{1F4E2}': 'channel-filled',
  /* ☑️ */ '\u{2611}\u{FE0F}': 'chat',

  [EmoticonChat]: 'chats',
  [defaultIcon]: 'folder-badge',
};

export function renderFolderIcon(emoticon?: string, entities?: ApiMessageEntity[], emojiSize?: number) {
  if (entities && entities.length > 0) {
    const firstEntity = entities[0];
    if (firstEntity.offset === 0 && firstEntity.type === ApiMessageEntityTypes.CustomEmoji) {
      return processEntity({
        entity: firstEntity,
        entityContent: '...',
        nestedEntityContent: [],
        isSimple: true,
        emojiSize,
      });
    }
  }

  return <Icon name={emoticonIcons[emoticon ?? defaultIcon] ?? emoticonIcons[defaultIcon]} />;
}

export function renderFolderTitle(
  text: string, entities?: ApiMessageEntity[], noCustomEmojiPlayback?: boolean, emojiSize?: number,
) {
  if (entities && entities.length > 0) {
    const firstEntity = entities[0];
    if (firstEntity.offset === 0 && firstEntity.type === ApiMessageEntityTypes.CustomEmoji) {
      return renderTextWithEntities({
        text: text.slice(firstEntity.length),
        entities: entities!.slice(1),
        noCustomEmojiPlayback,
        emojiSize,
      });
    }
  }

  return renderTextWithEntities({
    text,
    entities,
    noCustomEmojiPlayback,
    emojiSize,
  });
}
