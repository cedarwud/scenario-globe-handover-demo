import {
  CesiumTerrainProvider,
  ProviderViewModel,
  buildModuleUrl
} from "cesium";
import createDefaultTerrainProviderViewModels from "@cesium/widgets/Source/BaseLayerPicker/createDefaultTerrainProviderViewModels.js";

export interface TerrainSelectionOptions {
  selectedTerrainProviderViewModel: ProviderViewModel;
  terrainProviderViewModels?: ProviderViewModel[];
}

function readConfiguredTerrainUrl(): string | undefined {
  const terrainUrl = import.meta.env.VITE_CESIUM_TERRAIN_URL?.trim();
  return terrainUrl ? terrainUrl : undefined;
}

function resolveDefaultWorldTerrain(
  terrainProviderViewModels: ProviderViewModel[]
): ProviderViewModel {
  return (
    terrainProviderViewModels.find(
      (providerViewModel) => providerViewModel.name === "Cesium World Terrain"
    ) ?? terrainProviderViewModels[0]
  );
}

export function resolveTerrainSelection(): TerrainSelectionOptions {
  const terrainProviderViewModels = createDefaultTerrainProviderViewModels();
  const terrainUrl = readConfiguredTerrainUrl();

  if (!terrainUrl) {
    // Keep the shell on Cesium's own BaseLayerPicker path while defaulting the
    // terrain selection to Cesium World Terrain rather than leaving the viewer
    // on the ellipsoid-only baseline.
    // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/terrain/main.js:4-18
    // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/widgets/Source/BaseLayerPicker/createDefaultTerrainProviderViewModels.js:12-42
    // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/@cesium/widgets/Source/BaseLayerPicker/BaseLayerPickerViewModel.js:301-303
    return {
      terrainProviderViewModels,
      selectedTerrainProviderViewModel: resolveDefaultWorldTerrain(terrainProviderViewModels)
    };
  }

  // Keep the native BaseLayerPicker selection in sync with an explicitly
  // configured terrain endpoint by representing it as a ProviderViewModel.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/terrain/main.js:48-99
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Core/CesiumTerrainProvider.js:1191-1207
  // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/@cesium/widgets/Source/BaseLayerPicker/BaseLayerPickerViewModel.js:254-291
  const configuredTerrain = new ProviderViewModel({
    name: "Configured Terrain",
    iconUrl: buildModuleUrl("Widgets/Images/TerrainProviders/CesiumWorldTerrain.png"),
    tooltip: `CesiumTerrainProvider.fromUrl(${terrainUrl})`,
    category: "Configured",
    creationFunction: () => CesiumTerrainProvider.fromUrl(terrainUrl)
  });

  return {
    terrainProviderViewModels: [configuredTerrain, ...terrainProviderViewModels],
    selectedTerrainProviderViewModel: configuredTerrain
  };
}
