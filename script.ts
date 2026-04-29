import { Grid } from "./grid/grid.js";
import { config } from "./setup.json";

const $ = document.querySelector.bind(document);

const g = new Grid($("#grid-container")!, config);
g.render();
