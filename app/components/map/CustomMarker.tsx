"use client";

import { Marker } from "react-leaflet";
import { DivIcon } from "leaflet";
import { getCategoryConfig, getStatusConfig, type Report, type ReportCategory } from "./types";

interface CustomMarkerProps {
  report: Report;
  isSelected?: boolean;
  onClick: (report: Report) => void;
}

export function CustomMarker({ report, isSelected, onClick }: CustomMarkerProps) {
  const config = getCategoryConfig(report.category);
  const statusConfig = getStatusConfig(report.status);

  // For resolved reports, use a different style (gray/green)
  const isResolved = report.status === "resolvido";
  const markerColor = isResolved ? "green" : config.color.replace("text-", "");
  const markerBgColor = isResolved ? "bg-green-100 dark:bg-green-900/30" : config.bgColor;
  const markerTextColor = isResolved ? "text-green-600 dark:text-green-400" : config.color;
  const markerEmoji = isResolved ? "✅" : config.icon;

  const icon = new DivIcon({
    className: "custom-marker",
    html: `
      <div class="marker-wrapper ${isSelected ? "selected" : ""} ${isResolved ? "resolved" : ""}" style="--marker-color: ${markerColor};">
        <div class="marker-inner ${markerBgColor} ${markerTextColor}">
          <span class="marker-emoji">${markerEmoji}</span>
          ${report.confirmations_continua && report.confirmations_continua > 0 ? `<span class="marker-badge">${report.confirmations_continua}</span>` : ""}
          ${isResolved ? `<span class="marker-resolved-badge">✓</span>` : ""}
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
      zIndexOffset={isSelected ? 1000 : (report.confirmations_continua || 0) * 10}
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