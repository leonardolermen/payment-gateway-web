import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "../auth/LoginPage";
import { RequireApiKey } from "../auth/RequireApiKey";
import { AppLayout } from "./AppLayout";

// Placeholders for the screens: the panel and the checkout replace these in the next tasks.
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/orders" replace /> },
  { path: "/app/login", element: <LoginPage /> },
  {
    path: "/app",
    element: <RequireApiKey />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/orders" replace /> },
          { path: "orders", element: <div>cobranças</div> },
          { path: "customers", element: <div>clientes</div> },
        ],
      },
    ],
  },
  { path: "/pay/:token", element: <div>pagar</div> },
]);
