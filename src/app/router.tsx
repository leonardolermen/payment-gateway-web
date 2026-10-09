import { createBrowserRouter, Navigate } from "react-router";
import { ForgotPage } from "../auth/ForgotPage";
import { InvitePage } from "../auth/InvitePage";
import { LoginPage } from "../auth/LoginPage";
import { RequireSession } from "../auth/RequireSession";
import { ResetPage } from "../auth/ResetPage";
import { SignupPage } from "../auth/SignupPage";
import { VerifyPage } from "../auth/VerifyPage";
import { PayPage } from "../checkout/PayPage";
import { CustomersPage } from "../customer/CustomersPage";
import { NewCustomerPage } from "../customer/NewCustomerPage";
import { OrderDetailPanel } from "../order/OrderDetailPanel";
import { NoOrderSelected, OrdersWorkspace } from "../order/OrdersWorkspace";
import { PlansPage } from "../plan/PlansPage";
import { SettingsPage } from "../settings/SettingsPage";
import { AppLayout } from "./AppLayout";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/orders" replace /> },
  { path: "/app/login", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot", element: <ForgotPage /> },
  { path: "/reset/:token", element: <ResetPage /> },
  { path: "/verify/:token", element: <VerifyPage /> },
  { path: "/invite/:token", element: <InvitePage /> },
  {
    path: "/app",
    element: <RequireSession />,
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
          { path: "customers", element: <CustomersPage /> },
          { path: "customers/new", element: <NewCustomerPage /> },
          { path: "plans", element: <PlansPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "/pay/:token", element: <PayPage /> },
]);
