import { Grid, Point, Rectangle } from './Grid';

export interface Room {
    id: string;
    name: string;
    bounds: Rectangle;
    type: 'workspace' | 'meeting' | 'social' | 'utility';
    capacity: number;
    ambientNoise: number;
    lighting: number;
}

export interface Furniture {
    id: string;
    type: string;
    x: number;
    y: number;
    interactionPoint: Point;
}

export interface Zone {
    id: string;
    name: string;
    bounds: Rectangle;
    restricted: boolean;
}

export interface OfficeConfig {
    name: string;
    grid: { width: number; height: number; tileSize: number };
    rooms: Room[];
    furniture: Furniture[];
    spawnPoints: Point[];
    zones: Zone[];
}

export class Office {
    public config: OfficeConfig;
    public grid: Grid;

    constructor(config: OfficeConfig) {
        this.config = config;
        this.grid = new Grid(config.grid.width, config.grid.height, config.grid.tileSize);
    }

    public getRoomAt(x: number, y: number): Room | undefined {
        return this.config.rooms.find(r =>
            x >= r.bounds.x && x < r.bounds.x + r.bounds.width &&
            y >= r.bounds.y && y < r.bounds.y + r.bounds.height
        );
    }
}
