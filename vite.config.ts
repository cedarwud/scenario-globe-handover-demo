import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        // Cesium resolves runtime files from a shared base URL and a Workers prefix.
        // Keep these folders together for the future bootstrap path.
        // Evidence: node_modules/@cesium/engine/Source/Core/buildModuleUrl.js:36-46
        // Evidence: node_modules/@cesium/engine/Source/Core/TaskProcessor.js:91-125
        {
          src: "node_modules/cesium/Build/Cesium/Workers/**/*",
          dest: "cesium/Workers",
          rename: { stripBase: 5 }
        },
        {
          src: "node_modules/cesium/Build/Cesium/Assets/**/*",
          dest: "cesium/Assets",
          rename: { stripBase: 5 }
        },
        {
          src: "node_modules/cesium/Build/Cesium/ThirdParty/**/*",
          dest: "cesium/ThirdParty",
          rename: { stripBase: 5 }
        },
        {
          src: "node_modules/cesium/Build/Cesium/Widgets/**/*",
          dest: "cesium/Widgets",
          rename: { stripBase: 5 }
        }
      ]
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  }
});
