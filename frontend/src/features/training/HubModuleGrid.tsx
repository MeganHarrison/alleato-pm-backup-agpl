import { HubModuleTile, type HubModuleTileProps } from "./HubModuleTile";

export interface HubModuleGridProps {
  tiles: HubModuleTileProps[];
}

export function HubModuleGrid({ tiles }: HubModuleGridProps) {
  return (
    <div className="grid grid-flow-dense grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <HubModuleTile key={tile.title} {...tile} />
      ))}
    </div>
  );
}
