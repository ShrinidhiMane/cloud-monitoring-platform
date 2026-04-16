import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { WebEndpointSessionProvider } from "./providers/WebEndpointSessionProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WebEndpointSessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WebEndpointSessionProvider>
  </React.StrictMode>,
);
