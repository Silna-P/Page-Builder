import React from "react";
import { createRoot } from "react-dom/client";
import PageBuilder from "./PageBuilder";

frappe.ready(() => {
  const el = document.getElementById("pagebuilder-root");
  if (el) createRoot(el).render(<PageBuilder />);
});
