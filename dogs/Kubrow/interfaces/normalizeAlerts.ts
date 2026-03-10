import type { IAlertData, RawAlertFromApi } from './warframeWorldState';

export function normalizeAlert(raw: RawAlertFromApi): IAlertData {
    const mission = raw.MissionInfo;
    const reward = mission?.missionReward;

    return {
        id: raw._id?.$oid ?? '',
        activation: raw.Activation,
        expiry: raw.Expiry,
        mission: {
            node: mission?.location ?? '',
            type: mission?.missionType ?? '',
            faction: mission?.faction ?? '',
            reward: reward
                ? {
                      credits: reward.credits,
                      items: reward.items,
                      countedItems: reward.countedItems?.map((c) => ({
                          count: c.ItemCount,
                          type: c.ItemType,
                      })),
                  }
                : undefined,
            minEnemyLevel: mission?.minEnemyLevel,
            maxEnemyLevel: mission?.maxEnemyLevel,
        },
        active: !raw.Expiry?.isExpired(),
        tag: raw.Tag,
    };
}
