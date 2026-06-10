import React from "react";
import { createRoot } from "react-dom/client";
import SimuladorReorg from "./simulador-reorg.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SimuladorReorg />
  </React.StrictMode>
);
