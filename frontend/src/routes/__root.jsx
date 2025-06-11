import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRouteWithContext()({
  component: () => (
    <>
      <div className="p-2 flex gap-2">
        <div>Hello</div>
        <hr />
      </div>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
