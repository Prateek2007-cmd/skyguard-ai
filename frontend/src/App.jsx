import { LiveProvider } from "./app/LiveProvider";
import AppRouter from "./app/router";
import { ToastProvider } from "./components/ui/Toast";

export default function App() {
  return (
    <ToastProvider>
      <LiveProvider>
        <AppRouter />
      </LiveProvider>
    </ToastProvider>
  );
}
