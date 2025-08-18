import './css/theme.css';
import Topbar from './components/Topbar.js';
import { initRouter } from './router.js';

const app = document.getElementById('app');
document.body.prepend(Topbar());
initRouter(app);
