import { z } from 'zod';

/**
 * ブキの内部 ID（ファイル名、例: Path_Wst_Blaster_Middle_00）から
 * 日本語名（例: プロモデラー MG）へのマッピング。
 * data/weapon_aliases.csv を運用者が手動で埋めて reloadWeaponAliases で反映する。
 * 未登録 ID は UI/CSV で ID のまま表示される。
 */
export const weaponAliasesSchema = z.record(z.string(), z.string()).default({});

export type WeaponAliases = z.infer<typeof weaponAliasesSchema>;
