"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

export default function CampusMap({
  onMarkerClick,
}: {
  onMarkerClick: (location: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import("leaflet"); // import Leaflet

      if (mapRef.current && !mapInstance.current) {
        const imageBounds: L.LatLngBoundsExpression = [
          [0, 0],
          [1000, 1000],
        ];

        mapInstance.current = L.map(mapRef.current, {
          crs: L.CRS.Simple,
          minZoom: -1,
          maxZoom: 1,
          maxBounds: imageBounds,
          maxBoundsViscosity: 1.0,
        });

        const imageUrl = "/maps/adu_map.jpg";
        L.imageOverlay(imageUrl, imageBounds).addTo(mapInstance.current);
        mapInstance.current.fitBounds(imageBounds);

        // Function to create a marker
        const createInteractiveMarker = (
          coords: [number, number],
          color: string,
          popupText: string
        ) => {
          const iconSize: [number, number] = [50, 50]; // icon size
          const marker = L.marker(coords, {
            icon: L.divIcon({
              className: "custom-icon",
              html: `<div style="color: ${color}; font-size: ${iconSize[1]}px;"><i class="fas fa-map-marker-alt"></i></div>`,
              iconSize: iconSize,
              iconAnchor: [iconSize[0] / 2, iconSize[1]],
              popupAnchor: [2, -iconSize[1]], // position on popup
            }),
          });

          marker.on("click", () => {
            onMarkerClick(popupText);
          });

          marker
            .addTo(mapInstance.current!)
            .bindPopup(
              `<div style="font-size: 18px; font-weight: bold; color: ${color};">${popupText}</div>`,
              { autoPan: false }
            );
        };

        // marker locations
        createInteractiveMarker([400, 335], "red", "Quadrangle");
        createInteractiveMarker([350, 490], "blue", "Falcon Bridge");
        createInteractiveMarker(
          [630, 310],
          "green",
          "SV Entrance / Parking Lot"
        );
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-[300px] rounded-lg overflow-hidden shadow-lg">
      <div ref={mapRef} className="w-full h-full"></div>
    </div>
  );
}
