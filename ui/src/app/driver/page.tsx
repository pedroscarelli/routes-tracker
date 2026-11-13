import { RouteModel } from "../../utils/models";
import { MapDriver } from "./MapDriver";
import { StartRouteForm } from "./StartRouteForm";

// rendered per request: the route list comes from the API, which is not available at build time
export const dynamic = "force-dynamic";

async function getRoutes() {
  const response = await fetch(`${process.env.NEST_API_URL}/routes`, {
    cache: "force-cache",
    next: {
      tags: ["routes"],
    },
  });
  // cached until a new route is created (see revalidateTag("routes"))
  return response.json();
}

async function DriverPage() {
  const routes = await getRoutes();

  return (
    <div className="flex flex-1 w-full h-full">
      <div className="w-1/3 p-2 h-full">
        <h4 className="text-3xl text-contrast mb-2">Start a route</h4>
        <div className="flex flex-col">
          <StartRouteForm>
            <select
              id="route_id"
              name="route_id"
              className="mb-2 p-2 border rounded bg-default text-contrast"
            >
              <option key="0" value="">
                Select a route
              </option>
              {routes.map((route: RouteModel) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
            <button
              className="bg-main text-primary p-2 rounded text-xl font-bold"
              style={{ width: "100%" }}
            >
              Start the trip
            </button>
          </StartRouteForm>
        </div>
      </div>
      <MapDriver routeIdElementId={"route_id"} />
    </div>
  );
}

export default DriverPage;
