import { Navigate, Route, Routes } from "react-router-dom";
import { useWebEndpointSession } from "./providers/WebEndpointSessionProvider";
import Layout from "./pages/Layout";
import Login from "./pages/Login";
import Instances from "./pages/Instances";
import InstanceDetail from "./pages/InstanceDetail";
import "./App.css";

function ProtectedShell() {
  const { hasSessionEndpoint } = useWebEndpointSession();

  if (!hasSessionEndpoint) {
    return <Navigate to="/login" replace />;
  }

  return <Layout accessMode="private" />;
}

function PublicShell() {
  const { hasSessionEndpoint } = useWebEndpointSession();

  if (hasSessionEndpoint) {
    return <Navigate to="/instances" replace />;
  }

  return <Layout accessMode="public" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProtectedShell />}>
        <Route index element={<Navigate to="/instances" replace />} />
        <Route path="instances" element={<Instances />} />
        <Route path="instances/:instanceId" element={<InstanceDetail />} />
      </Route>
      <Route path="/" element={<PublicShell />}>
        <Route path="login" element={<Login />} />
      </Route>

      <Route path="*" element={<div>404</div>} />
    </Routes>
  );
}
