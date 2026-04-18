import {
  ProviderViewModel,
  TileMapServiceImageryProvider,
  buildModuleUrl
} from "cesium";
import createDefaultImageryProviderViewModels from "@cesium/widgets/Source/BaseLayerPicker/createDefaultImageryProviderViewModels.js";

export interface ImagerySelectionOptions {
  imageryProviderViewModels?: ProviderViewModel[];
  selectedImageryProviderViewModel?: ProviderViewModel;
}

function readConfiguredImageryUrl(): string | undefined {
  const imageryUrl = import.meta.env.VITE_CESIUM_IMAGERY_URL?.trim();
  return imageryUrl ? imageryUrl : undefined;
}

export function resolveImagerySelection(): ImagerySelectionOptions {
  const imageryUrl = readConfiguredImageryUrl();
  if (!imageryUrl) {
    return {};
  }

  // Keep the native BaseLayerPicker state aligned with any explicitly
  // configured TMS imagery source by inserting it as a ProviderViewModel
  // instead of swapping layers after Viewer construction.
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/offline/main.js:10-16
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/sandcastle/gallery/imagery-layers-texture-filters/main.js:12-20
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/TileMapServiceImageryProvider.js:18-27
  // Evidence: /home/u24/papers/project/home-globe-reference-repos/cesium/packages/engine/Source/Scene/TileMapServiceImageryProvider.js:108-149
  // Evidence: /home/u24/papers/scenario-globe-handover-demo/node_modules/@cesium/widgets/Source/BaseLayerPicker/BaseLayerPickerViewModel.js:301-303
  const configuredImagery = new ProviderViewModel({
    name: "Configured TMS Imagery",
    iconUrl: buildModuleUrl("Widgets/Images/ImageryProviders/naturalEarthII.png"),
    tooltip: `TileMapServiceImageryProvider.fromUrl(${imageryUrl})`,
    category: "Configured",
    creationFunction: () => TileMapServiceImageryProvider.fromUrl(imageryUrl)
  });

  return {
    imageryProviderViewModels: [
      configuredImagery,
      ...createDefaultImageryProviderViewModels()
    ],
    selectedImageryProviderViewModel: configuredImagery
  };
}
