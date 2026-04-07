import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Exercises from './pages/Exercises';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Summary from './pages/Summary';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="exercises" element={<Exercises />} />
          <Route path="history" element={<History />} />
          <Route path="summary" element={<Summary />} />
        </Route>
        {/* Dashboard doesn't use the standard Layout */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
