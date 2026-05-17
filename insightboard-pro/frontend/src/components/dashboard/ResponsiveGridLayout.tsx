"use client";

import type { ComponentType } from "react";
import * as RGL from "react-grid-layout";

type GridComponent = ComponentType<Record<string, unknown>>;

const mod = RGL as unknown as {
  Responsive: GridComponent;
  WidthProvider: (component: GridComponent) => GridComponent;
  default?: {
    Responsive?: GridComponent;
    WidthProvider?: (component: GridComponent) => GridComponent;
  };
};

const Responsive = mod.Responsive ?? mod.default?.Responsive;
const WidthProvider = mod.WidthProvider ?? mod.default?.WidthProvider;

if (!Responsive || !WidthProvider) {
  throw new Error("react-grid-layout: Responsive or WidthProvider export missing");
}

const ResponsiveGridLayout = WidthProvider(Responsive);

export default ResponsiveGridLayout;
