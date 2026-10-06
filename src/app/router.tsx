import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "../auth/LoginPage";
import { RequireApiKey } from "../auth/RequireApiKey";
import { PayPage } from "../checkout/PayPage";
import { CustomersPage } from "../customer/CustomersPage";
import { NewCustomerPage } from "../customer/NewCustomerPage";
import { NewOrderPage } from "../order/NewOrderPage";
import { OrderDetailPage } from "../order/OrderDetailPage";
import { OrdersPage } from "../order/OrdersPage";
import { AppLayout } from "./AppLayout";

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
          { path: "orders", element: <OrdersPage /> },
          { path: "orders/new", element: <NewOrderPage /> },
          { path: "orders/:id", element: <OrderDetailPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "customers/new", element: <NewCustomerPage /> },
        ],
      },
    ],
  },
  { path: "/pay/:token", element: <PayPage /> },
]);
