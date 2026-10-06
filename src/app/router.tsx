import { createBrowserRouter, Navigate } from "react-router";

// Placeholders: the panel and the checkout replace these in the next tasks.
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/orders" replace /> },
  { path: "/app/*", element: <div>painel</div> },
  { path: "/pay/:token", element: <div>pagar</div> },
]);
