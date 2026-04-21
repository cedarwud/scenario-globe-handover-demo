export interface LocalDensityLookupBand {
  key: "equatorial" | "subtropical" | "mid-latitude" | "high-latitude";
  label: string;
  maxAbsLatitudeDeg: number;
  minAbsLatitudeDeg: number;
  suggestedBackgroundSatelliteCount: number;
}

export interface LocalDensityLookupConfig {
  assumptionNote: string;
  bands: readonly LocalDensityLookupBand[];
  demoLookupElevationDeg: number;
  researchBaselineElevationDeg: number;
}

export interface LocalDensityLookupResult {
  absLatitudeDeg: number;
  band: LocalDensityLookupBand;
  demoLookupElevationDeg: number;
  latitudeDeg: number;
  researchBaselineElevationDeg: number;
  suggestedBackgroundSatelliteCount: number;
}

export const LOCAL_DENSITY_LOOKUP: LocalDensityLookupConfig = {
  assumptionNote:
    "Demo lookup assumption only. Latitude is the only input; longitude and live visibility solving are intentionally ignored for this local-view background cast.",
  bands: [
    {
      key: "equatorial",
      label: "Equatorial",
      maxAbsLatitudeDeg: 20,
      minAbsLatitudeDeg: 0,
      suggestedBackgroundSatelliteCount: 5
    },
    {
      key: "subtropical",
      label: "Subtropical",
      maxAbsLatitudeDeg: 40,
      minAbsLatitudeDeg: 20,
      suggestedBackgroundSatelliteCount: 6
    },
    {
      key: "mid-latitude",
      label: "Mid-Latitude",
      maxAbsLatitudeDeg: 60,
      minAbsLatitudeDeg: 40,
      suggestedBackgroundSatelliteCount: 7
    },
    {
      key: "high-latitude",
      label: "High-Latitude",
      maxAbsLatitudeDeg: 90,
      minAbsLatitudeDeg: 60,
      suggestedBackgroundSatelliteCount: 8
    }
  ],
  demoLookupElevationDeg: 20,
  researchBaselineElevationDeg: 10
};

export const LOCAL_DENSITY_LOOKUP_MAX_BACKGROUND_COUNT = Math.max(
  ...LOCAL_DENSITY_LOOKUP.bands.map((band) => band.suggestedBackgroundSatelliteCount)
);

export function lookupLocalDensityByLatitude(
  latitudeDeg: number
): LocalDensityLookupResult {
  const absLatitudeDeg = Math.abs(latitudeDeg);
  const lastBand =
    LOCAL_DENSITY_LOOKUP.bands[LOCAL_DENSITY_LOOKUP.bands.length - 1];

  const band =
    LOCAL_DENSITY_LOOKUP.bands.find((candidate) => {
      const withinUpperBound =
        candidate === lastBand
          ? absLatitudeDeg <= candidate.maxAbsLatitudeDeg
          : absLatitudeDeg < candidate.maxAbsLatitudeDeg;
      return (
        absLatitudeDeg >= candidate.minAbsLatitudeDeg && withinUpperBound
      );
    }) ?? lastBand;

  if (!band) {
    throw new Error("Local density lookup requires at least one latitude band");
  }

  return {
    absLatitudeDeg,
    band,
    demoLookupElevationDeg: LOCAL_DENSITY_LOOKUP.demoLookupElevationDeg,
    latitudeDeg,
    researchBaselineElevationDeg:
      LOCAL_DENSITY_LOOKUP.researchBaselineElevationDeg,
    suggestedBackgroundSatelliteCount: band.suggestedBackgroundSatelliteCount
  };
}
