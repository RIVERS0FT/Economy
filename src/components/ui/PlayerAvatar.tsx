import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import {
  PLAYER_AVATAR_UPDATED_EVENT,
  playerAvatarUrl,
  type PlayerAvatarUpdatedDetail,
} from '../../utils/playerAvatar';

function fallbackText(playerName: string) {
  return playerName.trim().slice(0, 1).toUpperCase() || '?';
}

export function PlayerAvatar({
  userId,
  playerName,
  size = 40,
  className = '',
}: {
  userId: number;
  playerName: string;
  size?: number;
  className?: string;
}) {
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => {
    const base = playerAvatarUrl(userId);
    return revision > 0 ? `${base}?v=${revision}` : base;
  }, [revision, userId]);

  useEffect(() => {
    setFailed(false);
  }, [source]);

  useEffect(() => {
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PlayerAvatarUpdatedDetail>).detail;
      if (Number(detail?.userId) !== Number(userId)) return;
      setRevision(Date.now());
    };
    window.addEventListener(PLAYER_AVATAR_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(PLAYER_AVATAR_UPDATED_EVENT, handleUpdated);
  }, [userId]);

  const style = {
    '--player-avatar-size': `${Math.max(1, size)}px`,
  } as CSSProperties;

  return (
    <span
      className={className ? `player-avatar ${className}` : 'player-avatar'}
      style={style}
      aria-hidden="true"
    >
      {failed ? (
        <span className="player-avatar__fallback">{fallbackText(playerName)}</span>
      ) : (
        <img
          src={source}
          width={size}
          height={size}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
