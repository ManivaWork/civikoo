"use client";

import { Marker } from "react-leaflet";
import { DivIcon } from "leaflet";
import { getCategoryConfig, type Report, type ReportCategory } from "./types";

interface CustomMarkerProps {
  report: Report;
  isSelected?: boolean;
  onClick: (report: Report) => void;
}

export function CustomMarker({ report, isSelected, onClick }: CustomMarkerProps) {
  const config = getCategoryConfig(report.category);

  const icon = new DivIcon({
    className: "custom-marker",
    html: `
      <div class="marker-wrapper ${isSelected ? "selected" : ""}" style="--marker-color: ${config.color.replace("text-", "")};">
        <div class="marker-inner ${config.bgColor} ${config.color}">
          <span class="marker-emoji">${config.icon}</span>
          ${report.confirmations_count > 0 ? `<span class="marker-badge">${report.confirmations_count}</span>` : ""}
        </div>
        <div class="marker-shadow"></div>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52],
  });

  return (
    <Marker
      position={[report.latitude, report.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(report),
      }}
      zIndexOffset={isSelected ? 1000 : report.confirmations_count * 10}
    />
  );
}

// Cluster marker for grouped reports
interface ClusterMarkerProps {
  count: number;
  position: [number, number];
  onClick: () => void;
}

export function ClusterMarker({ count, position, onClick }: ClusterMarkerProps) {
  const icon = new DivIcon({
    className: "cluster-marker",
    html: `
      <div class="cluster-wrapper">
        <div class="cluster-circle">
          <span class="cluster-count">${count}</span>
        </div>
        <div class="cluster-ring"></div>
      </div>
    `,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
  });

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: onClick,
      }}
    />
  );
}