import type {
  MealReadDto,
  PrivateMealRecord,
  StoredMediaAsset
} from './contracts';

export function toMealReadDto(
  record: PrivateMealRecord,
  assets: readonly StoredMediaAsset[]
): MealReadDto {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return {
    id: record.id,
    localDate: record.localDate,
    timezone: record.timezone,
    mealType: record.mealType,
    foodLabels: [...record.foodLabels],
    preparationMethods: [...record.preparationMethods],
    ...(record.notes ? { notes: record.notes } : {}),
    photos: record.mediaAssetIds.flatMap((assetId, index) => {
      const asset = assetsById.get(assetId);
      if (!asset) {
        return [];
      }

      return [
        {
          // This relative endpoint must authenticate the viewer and mint/read
          // private media server-side. It is not an object-store URL.
          thumbnailUrl: `/api/meals/${encodeURIComponent(record.id)}/photos/${index}/thumbnail`,
          width: asset.thumbnailWidth,
          height: asset.thumbnailHeight,
          alt: `${record.localDate} ${record.mealType} 餐食照片 ${index + 1}`
        }
      ];
    }),
    source: 'chatgpt'
  };
}
