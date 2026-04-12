import { useReplicant } from '../../hooks/useReplicant';
import type { Mode, Side } from '@/nodecg/messages';
import type { Team } from '@/schemas';

/**
 * 指定モード・サイドのチームデータと表示状態を返す。
 */
export function useTeamData(mode: Mode, side: Side): {
  team: Team | null;
  visible: boolean;
} {
  const [teamsPool] = useReplicant('teamsPool');
  const [selection] = useReplicant('selection');
  const [visibility] = useReplicant('visibility');

  const teamName = selection?.[mode]?.[side] ?? null;
  const team = teamName
    ? teamsPool?.[mode]?.find((t) => t.name === teamName) ?? null
    : null;
  const visible = visibility?.[mode]?.[side] ?? false;

  return { team, visible };
}
