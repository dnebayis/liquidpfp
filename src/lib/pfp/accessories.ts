export type AccessoryCategory = "Hats" | "Glasses" | "Seasonal";

export type AccessoryDef = {
  id: string;
  name: string;
  category: AccessoryCategory;
  src: string;
  suggestedY: number;
  suggestedWidthRatio: number;
};

export const ACCESSORIES: AccessoryDef[] = [
  {
    id: "liquidmas-hat",
    name: "Merry Liquidmas Hat",
    category: "Seasonal",
    src: "/pfp/accessories/liquidmas-hat.png",
    suggestedY: 0.24,
    suggestedWidthRatio: 0.82,
  },
  {
    id: "cap-liquidator-angle-2",
    name: "Liquidator Cap (Angle 2)",
    category: "Hats",
    src: "/pfp/accessories/cap-liquidator-angle-2.png",
    suggestedY: 0.3,
    suggestedWidthRatio: 0.86,
  },
  {
    id: "cap-liquidator-front",
    name: "Liquidator Cap (Front)",
    category: "Hats",
    src: "/pfp/accessories/cap-liquidator-front.png",
    suggestedY: 0.3,
    suggestedWidthRatio: 0.78,
  },
];


