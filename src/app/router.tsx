import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "../auth/LoginPage";
import { RequireApiKey } from "../auth/RequireApiKey";
import { PayPage } from "../checkout/PayPage";
import { CustomersPage } from "../customer/CustomersPage";
import { NewCustomerPage } from "../customer/NewCustomerPage";
import { OrderDetailPanel } from "../order/OrderDetailPanel";
import { NoOrderSelected, OrdersWorkspace } from "../order/OrdersWorkspace";
import { InstallmentSettingsPage } from "../settings/InstallmentSettingsPage";
import { SubscriptionDetailPanel } from "../subscription/SubscriptionDetailPanel";
import {
  NoSubscriptionSelected,
  SubscriptionsWorkspace,
} from "../subscription/SubscriptionsWorkspace";
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
          {
            path: "orders",
            element: <OrdersWorkspace />,
            children: [
              { index: true, element: <NoOrderSelected /> },
              // The form lives on the workspace now; an old bookmark lands next to it.
              { path: "new", element: <Navigate to="/app/orders" replace /> },
              { path: ":id", element: <OrderDetailPanel /> },
            ],
          },
          {
            path: "subscriptions",
            element: <SubscriptionsWorkspace />,
            children: [
              { index: true, element: <NoSubscriptionSelected /> },
              { path: ":id", element: <SubscriptionDetailPanel /> },
            ],
          },
          { path: "settings/installments", element: <InstallmentSettingsPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "customers/new", element: <NewCustomerPage /> },
        ],
      },
    ],
  },
  { path: "/pay/:token", element: <PayPage /> },
]);
